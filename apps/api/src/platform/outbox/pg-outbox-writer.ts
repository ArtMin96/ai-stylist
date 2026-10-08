// `OutboxWriter` over postgres.js (doc 06 §6): one INSERT into `platform_outbox`, on the caller's
// transaction when given. Translation only: what an event means and when to emit it is the
// producer's decision. No logging (the envelope is the payload).
//
// Trace continuity (doc 14 §3): an envelope without `traceparent` is stored with the active span's
// (the producing request), so the relay's and the job's spans join the producer's trace. Nothing
// is added when nothing is traced (telemetry off, or no active span).
import type { Sql, TransactionSql } from 'postgres';

import {
  type EventEnvelope,
  type EventType,
  type OutboxWriter,
  isId,
} from '@ai-stylist/shared-kernel';

import { currentTraceparent } from '../telemetry/trace-context.js';

export class PgOutboxWriter implements OutboxWriter<TransactionSql> {
  /** `sql` is the pool the composition root opened; used when `append` gets no transaction. */
  constructor(private readonly sql: Sql) {}

  async append(envelope: EventEnvelope<EventType, unknown>, tx?: TransactionSql): Promise<void> {
    if (!isId(envelope.id, 'event')) {
      throw new TypeError('PgOutboxWriter.append: envelope.id must be an evt_ id');
    }
    const db = tx ?? this.sql;
    const traceparent = envelope.traceparent ?? currentTraceparent();
    const stored = traceparent === undefined ? envelope : { ...envelope, traceparent };
    // Bound as text, cast in SQL: the jsonb serializer differs per client. `drizzle()` (the
    // API's `createDb()` pool) replaces it with identity, so `db.json(obj)` binds a raw object and
    // fails in Bind; a stock client re-stringifies a string bound as jsonb into a JSON scalar.
    // Text has neither problem (outbox-writer.createdb.docker.test.ts).
    await db`
      insert into platform_outbox (id, type, aggregate_kind, aggregate_id, sequence, payload)
      values (${envelope.id}, ${envelope.type}, ${envelope.aggregate.kind},
              ${envelope.aggregate.id}, ${envelope.sequence},
              ${JSON.stringify(stored)}::text::jsonb)`;
  }
}
