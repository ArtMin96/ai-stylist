// OutboxWriter port (doc 04 §9.1 step 1, doc 06 §6): a producer appends its event envelope to the
// transactional outbox, ideally in the same transaction as the domain write it describes; the
// outbox relay in `platform` dispatches it to the job queue. Provider-neutral: the transaction
// handle is a type parameter, so this file names no driver type (the Postgres adapter
// `PgOutboxWriter` lives in `platform`; module tests use `recordingOutboxWriter` from
// `@ai-stylist/test-support`). Modules must not declare their own copy.
import type { EventEnvelope, EventType } from '../envelope.js';

export type OutboxWriter<Tx = unknown> = {
  /**
   * Store `envelope` as a `pending` outbox row with id = `envelope.id` (the idempotency key the
   * relay dispatches with). With `tx`, the row commits or rolls back with the caller's
   * transaction; without it, the row is written on its own. Rejects on a duplicate id or a
   * duplicate (aggregate kind, aggregate id, sequence).
   */
  append(envelope: EventEnvelope<EventType, unknown>, tx?: Tx): Promise<void>;
};

/** DI token. `Symbol.for`: two installed copies of the kernel resolve to the same token. */
export const OUTBOX_WRITER: unique symbol = Symbol.for('ai-stylist.outbox-writer');
