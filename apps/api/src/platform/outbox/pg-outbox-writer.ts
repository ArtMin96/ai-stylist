// `OutboxWriter` over postgres.js (doc 06 §6): one INSERT into `platform_outbox`, on the caller's
// transaction when given. Translation only: what an event means and when to emit it is the
// producer's decision. No logging (the envelope is the payload).
import type { JSONValue, Sql, TransactionSql } from 'postgres';

import { type EventEnvelope, type EventType, isId } from '@ai-stylist/shared-kernel';

import type { OutboxWriter } from '../ports/outbox-writer.port.js';

export class PgOutboxWriter implements OutboxWriter<TransactionSql> {
  /** `sql` is the pool the composition root opened; used when `append` gets no transaction. */
  constructor(private readonly sql: Sql) {}

  async append(envelope: EventEnvelope<EventType, unknown>, tx?: TransactionSql): Promise<void> {
    if (!isId(envelope.id, 'event')) {
      throw new TypeError('PgOutboxWriter.append: envelope.id must be an evt_ id');
    }
    const db = tx ?? this.sql;
    await db`
      insert into platform_outbox (id, type, aggregate_kind, aggregate_id, sequence, payload)
      values (${envelope.id}, ${envelope.type}, ${envelope.aggregate.kind},
              ${envelope.aggregate.id}, ${envelope.sequence},
              ${db.json(envelope as unknown as JSONValue)})`;
  }
}
