// Infrastructure tables owned by `platform` (docs/modules/platform.md, planning/06 §6).
// Column names follow doc 06 §6 for the outbox; `last_error` is added for the relay's DLQ path
// (doc 04 §9.2). Rows are written by every module's transactions; only the relay reads them.
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const platformOutbox = pgTable(
  'platform_outbox',
  {
    /** `evt_` ULID = envelope id (doc 06 §4). */
    id: text('id').primaryKey(),
    /** `<module>.<entity>.<action>.v<N>` */
    type: text('type').notNull(),
    aggregateKind: text('aggregate_kind').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    /** Per-aggregate monotonic sequence assigned in the producing transaction. */
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    /** Full event envelope. IDs and references only — never raw media or sensitive text. */
    payload: jsonb('payload').notNull(),
    /** pending | dispatched | failed */
    status: text('status').notNull().default('pending'),
    attempts: smallint('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    /** Last relay/dispatch error (message only, no payloads) for the DLQ sweep. */
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('platform_outbox_aggregate_sequence_uq').on(
      t.aggregateKind,
      t.aggregateId,
      t.sequence,
    ),
    index('platform_outbox_pending_idx')
      .on(t.status, t.nextAttemptAt)
      .where(sql`${t.status} <> 'dispatched'`),
  ],
);

/**
 * Idempotency-Key store (doc 06 §2): key + request hash + response for 48 h; replay returns the
 * stored response, same key with a different request hash ⇒ 409 IDEMPOTENCY_KEY_REUSED.
 */
export const platformIdempotencyKeys = pgTable(
  'platform_idempotency_keys',
  {
    /** Client-generated ULID from the `Idempotency-Key` header. */
    key: text('key').primaryKey(),
    /** Scope the key is unique within, e.g. `<principal>:<method> <route>`. */
    scope: text('scope').notNull(),
    /** Hash of the canonical request body; mismatch on replay ⇒ 409. */
    requestHash: text('request_hash').notNull(),
    /** Hash of the stored response (T08 decides where the response body itself lives). */
    responseHash: text('response_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('platform_idempotency_keys_expires_idx').on(t.expiresAt)],
);

export type PlatformOutboxRow = typeof platformOutbox.$inferSelect;
export type NewPlatformOutboxRow = typeof platformOutbox.$inferInsert;
export type PlatformIdempotencyKeyRow = typeof platformIdempotencyKeys.$inferSelect;
