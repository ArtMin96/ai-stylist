# platform/outbox — relay (T08)

Placeholder. T08 adds the outbox relay (doc 04 §9.1): poll `platform_outbox` with
`FOR UPDATE SKIP LOCKED`, batch ≤ 100, ~250 ms interval, dispatch to the mapped pg-boss job
with `idempotencyKey = event.id`, mark `dispatched_at` / `status`, retry with backoff, mark
`failed` + `last_error` for the DLQ sweep. Table: `packages/db/src/schema/platform.ts`.
