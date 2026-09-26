# platform/queue — pg-boss v12 adapter (P02-T08)

`PgBossQueue` (`pg-boss-queue.ts`) wraps pg-boss for the outbox relay and the job composition
root (`apps/api/src/jobs/`). Translation only: which queue an event maps to and what a handler does
are decided by the callers.

- **Lifecycle:** `new PgBossQueue({ connectionString, queues, logger })` → `start()` installs the
  pg-boss schema (`pgboss`) and creates or updates every queue plus its dead-letter queue
  `<name>.dlq` → `stop()` (graceful, bounded by `stopTimeoutMs`). The connection string is passed
  in; nothing here reads `process.env`.
- **Retries:** per queue `retryLimit` (a job runs at most `retryLimit + 1` times), exponential
  jittered backoff from `retryDelaySeconds`, capped by `retryDelayMaxSeconds` (doc 04 §9.2). An
  exhausted job ends `failed` and a copy lands in `<name>.dlq` (`sourceId` = the failed job id).
- **Exactly-once enqueue:** `send(queue, data, { idempotencyKey, userId? })`. The job id is a
  UUIDv5 of `idempotencyKey` (`job-id.ts`); pg-boss's `(name, id)` primary key plus
  `ON CONFLICT DO NOTHING` makes a repeat a no-op (`enqueued: false`) while pg-boss retains the job
  (default 7 days after completion). `singletonKey` is not used for this: on a `standard` queue
  pg-boss v12 does not enforce it without `singletonSeconds`.
- **Per-user cancellation:** `userId` (`usr_…`) is stored as the job's pg-boss key.
  `cancelPendingForUser(userId)` cancels every `created`/`retry` job with that key on every
  configured queue and its DLQ (doc 06 §8 step 4) and returns the count.
- **Logging:** through the injected pino logger built from `../logger.ts`; fields are job id,
  queue, attempt, max attempts and error class — never job data or error messages.

Tests: `../tests/queue.docker.test.ts` (Testcontainers, `platform-docker` project; fails without
Docker).
