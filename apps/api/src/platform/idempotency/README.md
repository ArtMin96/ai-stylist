# platform/idempotency — durable effect-once guard (P02-T08)

`PgIdempotencyGuard` (`pg-idempotency-guard.ts`) runs a side effect at most once per key, durably,
on the `platform_idempotency_keys` table (`packages/db/src/schema/platform.ts`, migration
`0002_platform_idempotency_keys`; no schema change). It complements `PgBossQueue`'s enqueue dedupe,
which only lasts while pg-boss retains the job (~7 days): a job handler whose effect must never
repeat (a provider call, a push, an email) wraps it here (doc 04 §9.2 "processed-events check").

```ts
const guard = new PgIdempotencyGuard(sql); // postgres.js pool from the composition root, max >= 2
const result = await guard.runOnce(
  { key: event.id, scope: `job:${job.queue}`, retentionSeconds },
  () => moduleService.doTheThing(input),
);
// result: { ran: true, value } | { ran: false }  (false = already done under this key)
```

- **Claim and run in one transaction.** The key is inserted (`ON CONFLICT` re-claims only an
  expired row), the effect runs while the claim is uncommitted, and the key commits only if the
  effect resolved.
- **Effect throws ⇒ no key.** The transaction rolls back, so the next attempt (pg-boss retry) with
  the same key runs the effect again. A crash or lost connection rolls back the same way.
- **Concurrent same key ⇒ `IdempotencyKeyBusyError`** after `claimWaitMs` (default 5 s): throw it
  from the handler and let pg-boss retry.
- **Same key, other scope or `requestHash` ⇒ `IdempotencyKeyConflictError`.**
- **Bounds:** `maxEffectMs` (default 900 s, pg-boss's default job expiry) is set as the claim
  transaction's `idle_in_transaction_session_timeout`: a hung effect loses its claim instead of
  holding the key forever. Bound the effect itself with `withTimeout` (`../resilience`).
- **Retention** is the caller's `retentionSeconds`; it must outlive every possible redelivery of the
  key (pg-boss retention, outbox replay window). Nothing here picks a number.
- **Gap:** an effect that completed while the COMMIT failed runs again on retry. Provider calls
  still pass their own idempotency key where the provider supports one.
- No logging; errors carry no key, scope or payload. Expired rows are not purged here (a retention
  sweep is a separate job).

Tests: `../tests/idempotency.docker.test.ts` (Testcontainers, `platform-docker` project; fails
without Docker).
