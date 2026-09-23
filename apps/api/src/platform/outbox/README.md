# platform/outbox — relay (T08)

Placeholder (P02-T08 `NOT_STARTED`). T08 adds the outbox relay (doc 04 §9.1): poll
`platform_outbox` with `FOR UPDATE SKIP LOCKED`, batch ≤ 100, ~250 ms interval, enqueue on the
mapped pg-boss queue via `boss.send()` with `singletonKey = event.id` (doc 04 §9.2), mark
`dispatched_at` / `status`, retry with backoff (`attempts`, `next_attempt_at`), mark `failed` +
`last_error` for the DLQ sweep. Table: `packages/db/src/schema/platform.ts` (migration
`0001_platform_outbox`); `just db-seed` inserts a pending demo row.
