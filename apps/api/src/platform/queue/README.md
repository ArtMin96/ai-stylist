# platform/queue — pg-boss v12 adapter (P02-T08)

`PgBossQueue` (`pg-boss-queue.ts`) wraps pg-boss for the outbox relay and the job composition
root (`apps/api/src/jobs/`). Translation only: which queue an event maps to and what a handler does
are decided by the callers.

- **Lifecycle:** `new PgBossQueue({ connectionString, queues, logger })` → `start()` verifies the
  pg-boss schema (`pgboss`) and creates or updates every queue plus its dead-letter queue
  `<name>.dlq` → `stop()` (graceful, bounded by `stopTimeoutMs`). The connection string is passed
  in; nothing here reads `process.env`.
- **Schema is a migration, not a boot step:** pg-boss runs with `migrate: false` (planning/06 §7:
  migrations never run on app boot). Migration `packages/db/migrations/0003_pgboss_schema.sql`
  (pg-boss schema version 42, generated from pg-boss 12.34.0's `getConstructionPlans()`) installs
  it through `just db-migrate`; `start()` throws `pg-boss is not installed` /
  `pg-boss database requires migrations` when it is missing or at another version. A pg-boss
  upgrade that bumps its schema version (`pgboss.schema` in its `package.json`) needs a new
  migration generated from `getMigrationPlans()`, applied before the new version boots;
  the drift test in `apps/api/tests/migrations/` fails until it exists. That test reads the DDL
  through `pgBossConstructionSql(schema)` and `PGBOSS_SCHEMA_VERSION` (`pg-boss-schema.ts`), so
  pg-boss is imported only under `apps/api/src/platform/**` and `apps/api/src/jobs/**`.
- **Retries:** per queue `retryLimit` (a job runs at most `retryLimit + 1` times), exponential
  jittered backoff from `retryDelaySeconds`, capped by `retryDelayMaxSeconds` (doc 04 §9.2). An
  exhausted job ends `failed` and a copy lands in `<name>.dlq` (`sourceId` = the failed job id).
  The jobs process works each outbox-fed `<name>.dlq` (`apps/api/src/jobs/README.md` "Dead-letter
  queues"), which marks the outbox row `failed`.
- **Workers and batches:** `work(queue, handler)` fetches up to the queue's `batchSize` jobs
  (1..`MAX_WORK_BATCH_SIZE` = 100, default 1). pg-boss waits `pollingIntervalSeconds` (default 2)
  after each fetch, so batch 1 works about 0.5 jobs/s under backlog. Above 1 the worker fetches
  again at once while fetches come back full (pg-boss `burstWhenBatchFull`) and polls normally
  after a short one. A batch's jobs run one at a time, each with the cancelled-user check before
  its handler, and settle individually (pg-boss `perJobResults`): a throwing handler fails and
  retries only its own job. A batch shares one `expireInSeconds` deadline, so `batchSize` × the
  slowest job must stay below it. On shutdown, jobs of a batch not yet started are left to pg-boss,
  which fails them into retry.
- **Exactly-once enqueue:** `send(queue, data, { idempotencyKey, userId? })`. The job id is a
  UUIDv5 of `idempotencyKey` (`job-id.ts`); pg-boss's `(name, id)` primary key plus
  `ON CONFLICT DO NOTHING` makes a repeat a no-op (`enqueued: false`) while pg-boss retains the job
  (default 7 days after completion). `singletonKey` is not used for this: on a `standard` queue
  pg-boss v12 does not enforce it without `singletonSeconds`.
- **Per-user cancellation:** `userId` (`usr_…`) is stored as the job's pg-boss key.
  `cancelPendingForUser(userId)` cancels every unfinished (`created`, `retry` or `active`) job
  with that key on every configured queue and its DLQ (doc 06 §8 step 4) and returns the count. A
  cancelled `active` job's handler runs to its end (pg-boss cannot interrupt it), but its outcome
  is dropped: pg-boss completes only `active` jobs and fails only unfinished ones, so it stays
  `cancelled` and never retries. Later sends for the user are still accepted.
- **Deletion-shaped cancellation:** `cancelUser(userId)` first writes a durable marker (a
  never-worked job in the reserved queue `platform.cancelled-users`, id = UUIDv5 of the user id),
  then runs `cancelPendingForUser`. Once it resolves, no job keyed to the user reaches a handler on
  any instance: `send` inserts nothing for the user (`enqueued: false`, so the outbox relay marks
  the row dispatched) and `work` cancels, without calling the handler, any job for the user it
  fetches (a send that raced the marker). Idempotent. The marker lives
  `CANCELLED_USER_MARKER_RETENTION_SECONDS` = 100 days from its first write (a repeat call does not
  extend it): outbox replays re-dispatch events retained 90 days (planning/04-architecture.md §9.2)
  and deletion follows a 7-day grace window (planning/11-security-privacy-and-compliance.md §13.2),
  so 90 + 7 plus margin; pg-boss's 14-day default would let a replay reach a deleted user. `start()`
  sets it on the reserved queue with `createQueue` and `updateQueue`, so a queue created with the
  default is corrected. A job's `keep_until` is fixed at insert, so markers written before the
  correction keep their original expiry.
- **Supervision:** `superviseIntervalSeconds` (default 60, pg-boss default) is how often an
  instance fails `active` jobs older than their queue's `expireInSeconds` back into retry: the
  recovery path for a worker killed mid-job.
- **Logging and job output:** through the injected pino logger built from `../logger.ts`; fields
  are job id, queue, attempt, max attempts, error class and pg code — never job data or error
  messages. A failed job's stored pg-boss `output` (on the job row and its DLQ copy) is the same
  `{ errorName, pgCode? }` (`error-summary.ts`), never the thrown error.
- **Tracing and correlation (planning/14 §2–§3):** each fetched job runs in a CONSUMER span
  `job.process <queue>` (`messaging.system` `pg-boss`, `messaging.operation.type` `process`,
  `messaging.destination.name`, `messaging.message.id` = job id, `job.attempt`, `correlation_id`)
  and in its correlation scope, so every log line of the job, the handler's included, carries
  `correlation_id`. The trace context comes from the optional `traceContextOf(data)` the
  composition root injects (`jobs/queues.ts` `envelopeTraceContext`: the envelope's `traceparent`
  and `correlationId`), so this adapter stays ignorant of the data shape; a missing or malformed
  `traceparent` starts a new trace, an invalid correlation id is dropped. A failed attempt records
  the error class on the span, never its message.

Tests: `../tests/queue.docker.test.ts` and, for the DEC-41 lifecycle acceptance cases (AC-4
kill/retry, AC-6 per-user cancel, AC-7 deletion, AC-8 export chain),
`../tests/acceptance-lifecycle.docker.test.ts` (Testcontainers, `platform-docker` project; fail
without Docker).
