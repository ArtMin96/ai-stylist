// `markOutboxFailed` against a real, migrated Postgres (Testcontainers, `platform-docker` project).
// Doc 04 §9.2 DLQ: a dead-lettered job marks its outbox row `failed` with a payload-free
// `last_error`, idempotently; the relay never re-dispatches that row. FAILS without Docker.
import postgres, { type Sql } from 'postgres';
import pino from 'pino';
import { afterAll, describe, expect, it } from 'vitest';

import { createDb, migrate } from '@ai-stylist/db';
import { newId } from '@ai-stylist/shared-kernel';
import { type DemoEvent, demoEvent, syntheticRandom } from '@ai-stylist/seed-data';
import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

import { markOutboxFailed } from '../outbox/outbox-dead-letter.js';
import { MAX_LAST_ERROR_LENGTH, OutboxRelay } from '../outbox/outbox-relay.js';
import { PgOutboxWriter } from '../outbox/pg-outbox-writer.js';

const REASON = 'job exhausted: test.dead-letter';

type OutboxRow = {
  status: string;
  attempts: number;
  next_attempt_at: Date | null;
  last_error: string | null;
};

describe('markOutboxFailed (Testcontainers Postgres)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  const random = syntheticRandom();

  afterAll(async () => {
    await sql?.end();
    await pg?.stop();
  });

  async function boot(): Promise<Sql> {
    if (sql === undefined) {
      pg = await startPostgres();
      const handle = createDb(pg.url, { max: 1 });
      try {
        await migrate(handle.db);
      } finally {
        await handle.close();
      }
      sql = postgres(pg.url, { max: 2 });
    }
    await sql`delete from platform_outbox`;
    return sql;
  }

  function event(): DemoEvent {
    return demoEvent({ aggregate: { kind: 'demo_run', id: `run-${newId('event')}` } }, random);
  }

  async function row(db: Sql, id: string): Promise<OutboxRow | undefined> {
    const [found] = await db<OutboxRow[]>`
      select status, attempts, next_attempt_at, last_error from platform_outbox where id = ${id}`;
    return found;
  }

  it('marks a dispatched row failed once: a second dead-letter delivery changes nothing', async () => {
    const db = await boot();
    const envelope = event();
    await new PgOutboxWriter(db).append(envelope);
    await db`update platform_outbox set status = 'dispatched', dispatched_at = now()
             where id = ${envelope.id}`;

    expect(await markOutboxFailed(db, envelope.id, REASON)).toBe(true);
    const first = await row(db, envelope.id);
    expect(first).toEqual({
      status: 'failed',
      attempts: 0,
      next_attempt_at: null,
      last_error: REASON,
    });

    // Redelivery of the same dead letter (a retried DLQ job): no update, first reason kept.
    expect(await markOutboxFailed(db, envelope.id, 'job exhausted: other')).toBe(false);
    expect(await row(db, envelope.id)).toEqual(first);
  });

  it('keeps the relay’s own failure reason on a row the relay already failed', async () => {
    const db = await boot();
    const envelope = event();
    await new PgOutboxWriter(db).append(envelope);
    await db`update platform_outbox set status = 'failed', attempts = 5,
             last_error = 'Error: injected queue outage' where id = ${envelope.id}`;

    expect(await markOutboxFailed(db, envelope.id, REASON)).toBe(false);
    expect(await row(db, envelope.id)).toMatchObject({
      status: 'failed',
      attempts: 5,
      last_error: 'Error: injected queue outage',
    });
  });

  it('marks a still-pending row (relay died before COMMIT) failed, and the relay never claims it', async () => {
    const db = await boot();
    const envelope = event();
    await new PgOutboxWriter(db).append(envelope);

    expect(await markOutboxFailed(db, envelope.id, REASON)).toBe(true);
    expect(await row(db, envelope.id)).toMatchObject({ status: 'failed', last_error: REASON });

    let sends = 0;
    const relay = new OutboxRelay({
      sql: db,
      queue: {
        send: () => {
          sends += 1;
          return Promise.resolve({ jobId: 'unused', enqueued: true });
        },
      },
      logger: pino({ level: 'silent' }),
      routeEvent: () => 'test.dead-letter',
    });
    expect(await relay.pollOnce()).toEqual({ claimed: 0, dispatched: 0, retrying: 0, failed: 0 });
    expect(sends).toBe(0);
  });

  it('returns false for an event id with no outbox row', async () => {
    const db = await boot();
    expect(await markOutboxFailed(db, newId('event'), REASON)).toBe(false);
    const [count] = await db<{ n: number }[]>`select count(*)::int as n from platform_outbox`;
    expect(count?.n).toBe(0);
  });

  it('truncates an overlong reason to MAX_LAST_ERROR_LENGTH', async () => {
    const db = await boot();
    const envelope = event();
    await new PgOutboxWriter(db).append(envelope);

    expect(await markOutboxFailed(db, envelope.id, 'x'.repeat(MAX_LAST_ERROR_LENGTH * 2))).toBe(
      true,
    );
    const stored = (await row(db, envelope.id))?.last_error ?? '';
    expect(stored).toHaveLength(MAX_LAST_ERROR_LENGTH);
    expect(stored.endsWith('…')).toBe(true);
  });
});
