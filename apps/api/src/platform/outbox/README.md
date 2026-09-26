# platform/outbox — relay + writer (P02-T08)

Table: `platform_outbox` (`packages/db/src/schema/platform.ts`, migration `0001_platform_outbox`;
no schema change here). `just db-seed` inserts a pending demo row.

## Writer: `PgOutboxWriter` (port `../ports/outbox-writer.port.ts`)

`append(envelope, tx?)` inserts the envelope as a `pending` row (id = `envelope.id`, the `evt_`
idempotency key; `type`, aggregate kind/id and `sequence` copied from the envelope; `payload` = the
full envelope). Pass the producer's postgres.js transaction (`sql.begin(async (tx) => …)`) so the
row commits or rolls back with the domain write (doc 04 §9.1 step 1); without `tx` the row is
written on its own. A duplicate id or (aggregate kind, aggregate id, sequence) rejects. Producers
depend on the `OutboxWriter` type and the `OUTBOX_WRITER` token only.

## Relay: `OutboxRelay`

Doc 04 §9.1 step 2 and §9.2. Each poll is one transaction:

1. Claim due rows, oldest first, at most `batchSize`:
   `status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= now())`,
   `ORDER BY created_at LIMIT <batchSize> FOR UPDATE SKIP LOCKED`, so concurrent relays never
   claim the same row.
2. For each row, enqueue the stored envelope on the mapped pg-boss queue via
   `PgBossQueue.send(queue, envelope, { idempotencyKey: event.id })` (plus `userId` when the
   injected extractor returns one), then set `status = 'dispatched'`, `dispatched_at = now()`.
   `enqueued: false` (the job already exists, or its user was cancelled with
   `PgBossQueue.cancelUser` and the queue refused it) also counts as dispatched.
3. A failed send (queue error, timeout, unrouted type, non-object payload) sets `attempts + 1`,
   `next_attempt_at = now() + backoffDelayMs(attempts, backoff)` (`../resilience`) and
   `last_error`; the `maxAttempts`-th failure sets `status = 'failed'` instead, left for the DLQ
   sweep (doc 04 §9.2). `last_error` (`describeSendError`, at most 500 characters) = the error
   class plus `(pg <SQLSTATE>)` when present, e.g. `Error` or `PostgresError (pg 57P01)`: a queue,
   pg-boss or driver message can echo statement parameters, so it is never stored. Only the
   relay's own errors keep their message (`TimeoutError`, `UnroutedEventError`,
   `InvalidEnvelopeError`). A non-Error throw is recorded by its type only.
   A consumer job that exhausts its retries marks the row `failed` too:
   `markOutboxFailed(sql, eventId, reason)` (`outbox-dead-letter.ts`, called by the jobs
   process's DLQ workers). It only moves a row that is not already `failed`, so a redelivered dead
   letter changes nothing, and `last_error` is a payload-free reason (`job exhausted: <queue>`).
4. COMMIT.

At-least-once dispatch, exactly-once job: the send runs on pg-boss's pool, so a relay that dies
after a send but before COMMIT re-sends that row; the job id is a UUIDv5 of the event id, so the
re-send is a no-op.

**Config** (`new OutboxRelay({ … })`, all passed in by the composition root; nothing reads
`process.env`):

- `sql`: postgres.js pool; each poll holds one connection.
- `queue`: the `PgBossQueue` (anything with its `send`).
- `logger`: a pino logger built from `loggerOptions()` (`../logger.ts`).
- `routeEvent(type)`: event type → queue name, or `undefined` (unrouted = a failed attempt). The
  mapping lives at the composition root, never here.
- `userIdOf(envelope)`: optional; the `usr_…` id stored as the pg-boss job key for per-user
  cancellation.
- `pollIntervalMs`: default 250; a full batch polls again at once.
- `batchSize`: default and maximum 100 (`MAX_OUTBOX_BATCH_SIZE`).
- `maxAttempts`: failed sends before `failed`; default 5 (doc 04 §9.2).
- `backoff`: `{ baseMs, capMs }` for the jittered exponential delay; default 1 s / 5 min.
- `sendTimeoutMs`: bound on one `queue.send` (`withTimeout`); default 10 000.

**Lifecycle:** `start()` begins polling (polls never overlap within one relay); `stop()` is
graceful: no new poll starts, and the in-flight poll finishes and commits before it resolves.
`pollOnce()` runs one poll and returns `{ claimed, dispatched, retrying, failed }`.

**Logging:** event id, type, attempts and `lastError` (the same text as `last_error`) per row; a
failed poll logs error class and pg code only. Never the payload or a foreign error message.

Not here yet: the 90-day prune of dispatched rows (doc 06 §6), relay-lag and outbox-depth metrics
(doc 14), and the DLQ sweep of `failed` rows (`admin`).

Tests: `../tests/outbox-relay.test.ts` (unit: backoff scheduling, `failed` after max, batch cap,
`last_error`), `../tests/outbox-relay.docker.test.ts` and `../tests/outbox-dead-letter.docker.test.ts`
(Testcontainers, `platform-docker` project; fail without Docker).
