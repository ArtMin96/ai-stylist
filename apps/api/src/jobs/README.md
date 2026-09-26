# apps/api/src/jobs — pg-boss job handlers (P02-T08)

The job composition root (doc 04 §5). It constructs the pg-boss queue, the effect-once guard and
the worker clients, then registers each handler on its queue. Handlers are thin: they parse job
data with the contract types, call public module services or bound worker clients, and report the
outcome to pg-boss. No business rule lives here. Provider clients are constructed here or in
`../platform/`, never in `modules/**`.

- `queues.ts`: queue definitions (`JOB_QUEUES`) and the outbox event type → queue map
  (`EVENT_QUEUE_ROUTES`, `queueForEventType`). The only place either is declared.
- `index.ts`: `startJobs({ databaseUrl, segmentationBaseUrl, logger, pollingIntervalSeconds? })`
  → `{ stop }`, plus re-exports of `queues.ts`.
- `demo-outbox-flow.ts`: the `demo.outbox-flow` handler (envelope parsing, effect-once guard,
  segmentation call).
- `segmentation-client.ts`: `HttpSegmentationClient`, `POST {base}/v1/segment` on
  `workers/ml/segmentation`, bounded by `withTimeout` and a `CircuitBreaker`.
- `main.ts`: process entry for a dedicated `jobs` process.

## Queues and routing (doc 04 §9.2)

- `demo.outbox-flow` consumes `demo.outbox-flow.requested.v1`
  (`packages/contracts/events/demo.event.json`). `retryLimit` 4 (5 attempts, the doc 04 §9.2
  default), exponential jittered backoff from 1 s capped at 60 s. An exhausted job ends `failed`
  and a copy lands in `demo.outbox-flow.dlq`.
- The outbox relay's composition imports `JOB_QUEUES` and `queueForEventType` from `./index.js`
  and passes them to the relay (platform cannot import `jobs/**`: `platform-leaf`). Every
  `PgBossQueue` that sends to or works a queue is constructed with the same `JOB_QUEUES`. A new
  consumer adds its queue and route to `queues.ts`, and nowhere else.

## `demo.outbox-flow` handler

1. Parse `job.data` as the envelope (`envelope.json`) narrowed by `demo.event.json`. The zod
   parser `satisfies` the generated contract types, so a new required contract field fails
   `just typecheck`. Unknown envelope fields are tolerated (envelope.json); unknown payload
   fields, another `type`, a malformed `evt_` id, a missing required field or a note over 200
   chars throw `InvalidJobDataError` (paths only, no values). The job fails, is retried and ends
   in the DLQ: nothing is silently dropped.
2. `guard.runOnce({ key: envelope.id, scope: 'job:demo.outbox-flow', retentionSeconds: 90 days })`
   wraps the worker call (`PgIdempotencyGuard` on `platform_idempotency_keys`). 90 days is the
   outbox replay window (doc 04 §9.2 "Replay … `outbox` (retained 90 days)"): a replayed event
   carries the original id, so the key outlives every redelivery. A repeat returns
   `{ ran: false }` and the worker is not called.
3. The worker request is `{ request_id: envelope.id, image_ref: 'demo/outbox-flow' }`. The demo
   event carries no image and the P02 segmentation stub only echoes the reference; no object
   exists under that key.
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
  (`PgBossQueue.stop()` waits for active jobs, then the pools close).
- Needs a migrated database (`just db-migrate`: migration `0003_pgboss_schema` installs pg-boss;
  `start()` never runs DDL) and the segmentation worker.
- The segmentation worker URL is the constant `http://127.0.0.1:8001` in `main.ts`, where
  `just dev-workers` serves it. It is not an env key (P02-T08 adds none); a deployed environment
  needs a `.env.example` key and a `config.ts` entry first.

## Tests (`tests/`, vitest project `api`, no Docker)

- `demo-outbox-flow.test.ts`: the handler with the real HTTP client against a local fake worker
  (`tests/fake-segmentation-worker.ts`) and an in-memory guard with `PgIdempotencyGuard`'s
  contract. One worker call per event id across repeated runs, invalid envelopes rejected without
  a worker call, a worker failure throws and the retry calls again, and a log canary.
- `segmentation-client.test.ts`: request shape, reply validation, timeout, caller abort, breaker.
- `queues.test.ts`: routing map and retry bounds.

The durable guard and the queue are covered against real Postgres in
`../platform/tests/idempotency.docker.test.ts` and `../platform/tests/queue.docker.test.ts`. The
end-to-end API → outbox → pg-boss → worker round-trip is the P02-T08 acceptance suite.
