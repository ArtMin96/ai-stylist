// OutboxWriter port (doc 04 §9.1 step 1, doc 06 §6): a producer appends its event envelope to
// `platform_outbox`, ideally in the same transaction as the domain write it describes; the outbox
// relay (`../outbox/`) dispatches it to pg-boss. Provider-neutral: the transaction handle is a type
// parameter, so this file names no driver type (the pg adapter is `PgOutboxWriter`).
//
// P02-interim placement (like the other `platform/ports/*.port.ts`): domain modules declare their
// own port in their `index.ts` and may not import this file (rule: modules-not-platform).
import type { EventEnvelope, EventType } from '@ai-stylist/shared-kernel';

export type OutboxWriter<Tx = unknown> = {
  /**
   * Store `envelope` as a `pending` outbox row with id = `envelope.id` (the idempotency key the
   * relay dispatches with). With `tx`, the row commits or rolls back with the caller's
   * transaction; without it, the row is written on its own. Rejects on a duplicate id or a
   * duplicate (aggregate kind, aggregate id, sequence).
   */
  append(envelope: EventEnvelope<EventType, unknown>, tx?: Tx): Promise<void>;
};

export const OUTBOX_WRITER = Symbol('OutboxWriter');
