# apps/api/src/jobs — pg-boss job handlers (P02-T08)

The job composition root (doc 04 §5). It constructs the pg-boss queue, the effect-once guard and
the worker clients, then registers each handler on its queue. Handlers are thin: they parse job
data with the contract types, call public module services or bound worker clients, and report the
outcome to pg-boss. No business rule lives here. Provider clients are constructed here or in
`../platform/`, never in `modules/**`.

- `queues.ts`: queue definitions (`JOB_QUEUES`, including the worked dead-letter queues
  `OUTBOX_DEAD_LETTER_QUEUES`), the outbox event type → queue map (`EVENT_QUEUE_ROUTES`,
  `queueForEventType`), the per-user keying policy `userIdOf(envelope)` (the actor id when
  `actor.kind === 'user'`, else `undefined`; the relay composition passes it to `OutboxRelay`) and
  `envelopeTraceContext(data)` (the envelope's `traceparent` and `correlationId`, read without
  throwing; `startJobs` passes it to `PgBossQueue` as `traceContextOf`, so each job joins its
  event's trace and correlation scope). The only place any of these is declared.
- `outbox-dead-letter.ts`: the dead-letter handler; reads the envelope id from a dead-lettered
  job and calls `markOutboxFailed` (`../platform/outbox/outbox-dead-letter.ts`).
- `index.ts`: `startJobs(config)` → `{ stop }` (config: `databaseUrl`, `segmentationBaseUrl`,
  `logger`, optional `pollingIntervalSeconds` and `meter`), plus re-exports of `queues.ts`. `meter` is for tests; the default is
  the global meter of the telemetry `--import` entry (see "Metrics").
- `demo-outbox-flow.ts`: the `demo.outbox-flow` handler (envelope parsing, effect-once guard,
  segmentation call).
- `segmentation-client.ts`: `HttpSegmentationClient`, `POST {base}/v1/segment` on
  `workers/ml/segmentation`, bounded by `withTimeout` and a `CircuitBreaker`;
  `segment(request, { signal?, correlationId? })` sends a valid correlation id as
  `x-correlation-id` (the W3C `traceparent` header comes from the undici instrumentation).
- `main.ts`: process entry for a dedicated `jobs` process; flushes telemetry last on shutdown.

## Queues and routing (doc 04 §9.2)

- `demo.outbox-flow` consumes `demo.outbox-flow.requested.v1`
  (`packages/contracts/events/demo.event.json`). `retryLimit` 4 (5 attempts, the doc 04 §9.2
  default), exponential jittered backoff from 1 s capped at 60 s. An exhausted job ends `failed`
  and a copy lands in `demo.outbox-flow.dlq`, whose worker marks the outbox row `failed` (see
  "Dead-letter queues" below). `batchSize` 10: the worker fetches 10 jobs at a
  time and keeps fetching while batches come back full, then runs them one after another, each
  settled on its own (`../platform/queue/README.md`). Batch 1 measured 0.5 jobs/s against the
  DEC-41 / A11 floor of 20; batch 10 measured ≈95–103 jobs/s across acceptance runs of the
  throughput test. Worst case per batch: 10 × `SEGMENTATION_TIMEOUT_MS` = 100 s, below the 900 s
  job expiry. The pool shared by the effect-once guard and the dead-letter handlers has 3
  connections: demo jobs never run concurrently (one claim connection), each dead-letter worker
  runs one update at a time.
- The outbox relay's composition (`apps/api/src/app.module.ts`) imports `JOB_QUEUES`,
  `queueForEventType` and `userIdOf` from `./queues.js`, never `./index.js` (which would pull the
  job runtime into the API process), and passes them to the relay (platform cannot import
  `jobs/**`: `platform-leaf`). Every
  `PgBossQueue` that sends to or works a queue is constructed with the same `JOB_QUEUES`. A new
  consumer adds its queue and route to `queues.ts`, and nowhere else.

## Dead-letter queues (doc 04 §9.2 "DLQ")

An exhausted job lands in `<queue>.dlq` **and** its outbox row is marked `failed`. For every
outbox-fed queue, `OUTBOX_DEAD_LETTER_QUEUES` declares its DLQ as a worked queue (in `JOB_QUEUES`,
5 attempts, 1–60 s backoff) and `startJobs` registers `createOutboxDeadLetterHandler` on it:

1. Read `id` from the dead-lettered job's data (pg-boss copies the job's data, i.e. the envelope).
   No `evt_` id → `DeadLetterWithoutEventIdError`: the dead letter matches no outbox row, so it
   retries and ends in `<queue>.dlq.dlq` (not worked) for ops instead of being dropped.
2. `markOutboxFailed(sql, eventId, 'job exhausted: <queue>')` sets `status = 'failed'`,
   `next_attempt_at = null`, `last_error` = that payload-free reason, only when the row is not
   already `failed` (idempotent: a redelivered dead letter changes nothing and the first reason,
   including the relay's own send error, is kept). A `pending` row is marked too (the relay may
   have died after the send, before its COMMIT). A missing row (pruned, or never from the outbox)
   is a no-op.
3. The relay claims `pending` rows only, so a `failed` row is never re-dispatched; the nightly DLQ
   sweep (`admin`, not built yet) picks it up. The dead-letter job itself ends `completed`, kept
   for the queue's retention.
4. Logs: job id, queues, event id and whether the row changed. Never the payload.

## Metrics (planning/14 §4)

`startJobs` builds one `QueueMetrics` (`../platform/telemetry/README.md` "Metrics") for
`JOB_QUEUES` and the sources of `OUTBOX_DEAD_LETTER_QUEUES`, so every
`stylist.queue.job.{completions,failures,retries}` series (per worked `job_type`) and every
`stylist.queue.job.dlq` series (per source `job_type`, e.g. `demo.outbox-flow`) exists at 0 from
process start. Each worker's handler is wrapped with `countOutcomes(definition, handler)`; each
DLQ worker's handler also with `countDeadLetters(source, handler)`, so a job that reaches
`<queue>.dlq` counts once for its source queue, whatever the DLQ handler then does. After
`queue.start()`, `observeQueues(() => queue.readStats())` reports `stylist.queue.depth` (every queue
and DLQ, `.dlq.dlq` included) and `stylist.queue.job.age_oldest` (per worked queue) at each metric
collection; `stop()` ends that first, before the queue stops. The handlers themselves are
unchanged: counting lives in the wrappers.

## `demo.outbox-flow` handler

1. Validate `job.data` against the envelope (`envelope.json`) and `demo.event.json` with Ajv
   (JSON Schema 2020-12, `ajv-formats`) validators compiled once at module load from the contract
   files themselves (`@ai-stylist/contracts/events/*.json`); no constraint is copied here, and the
   result is typed with the generated `EventEnvelope & DemoOutboxFlowRequestedV1`. Whatever the
   contract says holds: today unknown envelope fields are tolerated (envelope.json) and a valid
   W3C `traceparent` is accepted, while unknown payload fields, another `type`, a malformed `evt_`
   id or `traceparent`, a missing required field or a note over the contract's `maxLength` throw
   `InvalidJobDataError`, which names field paths only, never values. The job fails, is retried
   and ends in the DLQ: nothing is silently dropped.
   `DEMO_OUTBOX_FLOW_EVENT_TYPE` in `queues.ts` `satisfies` the generated `type` const.
2. `guard.runOnce({ key: envelope.id, scope: 'job:demo.outbox-flow', retentionSeconds: 90 days })`
   wraps the worker call (`PgIdempotencyGuard` on `platform_idempotency_keys`). 90 days is the
   outbox replay window (doc 04 §9.2 "Replay … `outbox` (retained 90 days)"): a replayed event
   carries the original id, so the key outlives every redelivery. A repeat returns
   `{ ran: false }` and the worker is not called.
3. The worker request is `{ request_id: envelope.id, image_ref: 'demo/outbox-flow' }`, with the
   envelope's `correlationId` as `x-correlation-id` (omitted when it is not a valid correlation
   id). The demo event carries no image and the P02 segmentation stub only echoes the reference;
   no object exists under that key.
4. A worker failure (non-2xx, a reply that is not a `SegmentResponse` for this request, the
   timeout, an open circuit) throws. The guard rolls its claim back and pg-boss retries.
5. Logs: job id, event id, event type, attempt and whether the effect ran. Never the payload.

## Segmentation client

`HttpSegmentationClient` mirrors `SegmentRequest` / `SegmentResponse` from
`workers/ml/segmentation/src/ai_stylist_segmentation/schemas.py` minimally. That file's TODO
moves the worker schemas into `packages/contracts`; then these types come from the generated
contract (not part of P02-T08). Bounds, set in `index.ts`: `SEGMENTATION_TIMEOUT_MS` (10 s per
call; the job's abort signal also cancels it) and `SEGMENTATION_BREAKER` (opens after 5
consecutive failures, for 30 s).

## Running

- Process entry: `tsx src/jobs/main.ts` from `apps/api`. It reads `DATABASE_URL` and `LOG_LEVEL`
  through `../config.ts` (zod), runs `startJobs`, and on SIGINT/SIGTERM stops gracefully
  (`PgBossQueue.stop()` waits for active jobs, then the pools close, then `shutdownTelemetry()`
  flushes spans, metrics and logs).
- Telemetry (planning/14 §3): start the process behind the `--import` entry,
  `tsx --import ./src/platform/telemetry/instrument-jobs.ts src/jobs/main.ts` (built:
  `node --import ./dist/apps/api/src/platform/telemetry/instrument-jobs.js dist/apps/api/src/jobs/main.js`).
  It exports over OTLP only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set and does nothing otherwise
  (`../platform/telemetry/README.md`). Without the entry the process runs untraced; log lines
  still carry `correlation_id`.
- Needs a migrated database (`just db-migrate`: migration `0003_pgboss_schema` installs pg-boss;
  `start()` never runs DDL) and the segmentation worker.
- The segmentation worker URL is the constant `http://127.0.0.1:8001` in `main.ts`, where
  `just dev-workers` serves it. It is not an env key (P02-T08 adds none); a deployed environment
  needs a `.env.example` key and a `config.ts` entry first.

## Tests (`tests/`, vitest project `api`, no Docker)

- `demo-outbox-flow.test.ts`: the handler with the real HTTP client against a local fake worker
  (`tests/fake-segmentation-worker.ts`, which records the `x-correlation-id` and `traceparent`
  headers) and an in-memory guard with `PgIdempotencyGuard`'s contract. One worker call per event
  id across repeated runs, invalid envelopes rejected without a worker call (a malformed
  `traceparent` included; an unknown envelope field and a valid `traceparent` accepted), the
  correlation id sent to the worker, a worker failure throws and the retry calls again, and a log
  canary.
- `segmentation-client.test.ts`: request shape, the correlation header, reply validation,
  timeout, caller abort, breaker.
- `queues.test.ts`: routing map, retry bounds, the batch-size bounds (`batchSize` × the
  segmentation timeout stays below the job expiry; out-of-range sizes are rejected), a worked DLQ
  per routed queue, `userIdOf` and `envelopeTraceContext`.
- `trace-propagation.docker.test.ts` (vitest project `platform-docker`, Testcontainers, fails
  without Docker): P02-T09 AC-1. An outbox append inside a producing span, the relay dispatch, the
  demo job and its worker call share one trace id (in-process SDK, in-memory exporter), and the
  worker request carries that trace's `traceparent` and the envelope's `x-correlation-id`.
- `outbox-dead-letter.test.ts`: the dead-letter handler's translation (envelope id → reason
  `job exhausted: <queue>`, data without an `evt_` id rejected, log canary). The update itself runs
  on Postgres in `../platform/tests/outbox-dead-letter.docker.test.ts` and in the AC-2 acceptance
  test (`acceptance-dispatch.docker.test.ts`: the exhausted job's outbox row ends `failed`).
- `batch-settlement.docker.test.ts` (vitest project `platform-docker`, Testcontainers, fails
  without Docker): one demo-queue batch on real pg-boss; a failing job retries and dead-letters
  alone, a job for a cancelled user is refused, the rest complete once.
- `queue-metrics.docker.test.ts` (vitest project `platform-docker`, Testcontainers, fails without
  Docker): `startJobs` with an in-memory metric reader and an always-failing fake worker. Every
  series starts at 0; the injected failure's 5 attempts count as 5 failures and 4 retries, its dead
  letter moves `stylist.queue.job.dlq{job_type="demo.outbox-flow"}` from 0 to 1 (the local
  counterpart of the `queue.job.dlq` alert proof run in `docs/runbooks/04-queue-dlq.md`), the DLQ
  worker's run counts as a `demo.outbox-flow.dlq` completion, and the depth and age gauges report
  every queue.

The durable guard and the queue are covered against real Postgres in
`../platform/tests/idempotency.docker.test.ts` and `../platform/tests/queue.docker.test.ts`. The
end-to-end API → outbox → pg-boss → worker round-trip is the P02-T08 acceptance suite
`tests/acceptance-dispatch.docker.test.ts` (vitest project `platform-docker`; AC-1/2/3/5 +
throughput; run by `just test api`, not `just test platform`).
