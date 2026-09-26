// Outbox side of the pg-boss dead-letter queue (doc 04 §9.2 "DLQ": exhausted jobs land in the
// queue's dead-letter queue **and** the outbox row is marked `failed`). The jobs composition root
// works each `<queue>.dlq` and calls `markOutboxFailed` with the envelope id the dead-lettered job
// carries. Translation only: which queues are dead-lettered, and when, is decided by pg-boss and
// `apps/api/src/jobs/`. Writes `platform_outbox` only; never reads or logs the payload.
import type { Sql } from 'postgres';

import { MAX_LAST_ERROR_LENGTH } from './outbox-relay.js';

/**
 * Mark the outbox row `id = eventId` as `failed` with `reason` as its `last_error` (truncated to
 * `MAX_LAST_ERROR_LENGTH`), for the nightly DLQ sweep (doc 06 §6: `failed` rows are kept until
 * resolved). Idempotent: a row that is already `failed` keeps its first `last_error`. Returns
 * true when this call changed the row; false when the row was already `failed` or does not exist
 * (pruned after the 90-day window, or the job was not enqueued from the outbox).
 *
 * A `pending` row is marked too: the relay may have enqueued the job and died before its COMMIT,
 * and its re-send would only dedupe against the failed job. The relay claims `pending` rows only,
 * so a `failed` row is never re-dispatched.
 *
 * `reason` must be payload-free (error class or code and queue name, e.g.
 * `job exhausted: demo.outbox-flow`): it is stored and read by the ops sweep.
 */
export async function markOutboxFailed(
  sql: Sql,
  eventId: string,
  reason: string,
): Promise<boolean> {
  const lastError =
    reason.length > MAX_LAST_ERROR_LENGTH
      ? `${reason.slice(0, MAX_LAST_ERROR_LENGTH - 1)}…`
      : reason;
  const updated = await sql`
    update platform_outbox
    set status = 'failed', next_attempt_at = null, last_error = ${lastError}
    where id = ${eventId} and status <> 'failed'`;
  return updated.count === 1;
}
