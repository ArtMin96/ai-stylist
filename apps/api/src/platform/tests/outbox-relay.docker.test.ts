// Outbox relay + PgOutboxWriter against a real, migrated Postgres and PgBossQueue (Testcontainers,
// `platform-docker` project). P02-T08: pending row → dispatched + exactly one job; send failure →
// backoff, then `failed` + last_error without payload; two relays on one table dispatch each row
// exactly once with no poll above 100 rows; graceful stop. FAILS without Docker, never skips.
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { createDb, migrate } from '@ai-stylist/db';
import { newId } from '@ai-stylist/shared-kernel';
import { DEMO_EVENT_TYPE, type DemoEvent, demoEvent, syntheticRandom } from '@ai-stylist/seed-data';
import { type StartedPostgres, memoryLogStream, startPostgres } from '@ai-stylist/test-support';
import pino from 'pino';

import { loggerOptions } from '../logger.js';
import {
  OutboxRelay,
  type OutboxDispatchQueue,
  type OutboxPollResult,
} from '../outbox/outbox-relay.js';
import { PgOutboxWriter } from '../outbox/pg-outbox-writer.js';
import { jobIdForKey } from '../queue/job-id.js';
import { PgBossQueue } from '../queue/pg-boss-queue.js';

const SINGLE = 'test.outbox.single';
const CONCURRENT = 'test.outbox.concurrent';
const LIFECYCLE = 'test.outbox.lifecycle';
/** Canary: a payload value that must never reach `last_error` or the log sink. */
const PAYLOAD_MARKER = 'payload-marker-9d41';

type OutboxRow = {
  status: string;
  attempts: number;
  dispatched_at: Date | null;
  last_error: string | null;
  due_later: boolean | null;
};
type JobRow = { id: string; data: unknown; singleton_key: string | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('OutboxRelay + PgOutboxWriter (Testcontainers Postgres, pg-boss v12)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  let queue: PgBossQueue | undefined;
  const extraPools: Sql[] = [];
  const logs = memoryLogStream();
  const logger = pino(loggerOptions({ level: 'debug', service: 'api-test' }), logs);
  const random = syntheticRandom();

  afterAll(async () => {
    await queue?.stop();
    for (const pool of extraPools) await pool.end();
    await sql?.end();
    await pg?.stop();
  });

  /** Migrated database + started queue, lazily in the first test (no Docker ⇒ the test FAILS). */
  async function boot(): Promise<{ sql: Sql; queue: PgBossQueue }> {
    if (sql === undefined || queue === undefined) {
      pg = await startPostgres();
      const handle = createDb(pg.url, { max: 1 });
      try {
        await migrate(handle.db);
      } finally {
        await handle.close();
      }
      sql = postgres(pg.url, { max: 4 });
      queue = new PgBossQueue({
        connectionString: pg.url,
        logger,
        queues: [SINGLE, CONCURRENT, LIFECYCLE].map((name) => ({
          name,
          retryLimit: 0,
          retryDelaySeconds: 1,
          retryDelayMaxSeconds: 1,
        })),
      });
      await queue.start();
    }
    // Each test starts from an empty outbox (throwaway container database).
    await sql`delete from platform_outbox`;
    return { sql, queue };
  }

  function pool(): Sql {
    if (pg === undefined) throw new Error('boot() first');
    const extra = postgres(pg.url, { max: 2 });
    extraPools.push(extra);
    return extra;
  }

  function relay(
    db: Sql,
    dispatchQueue: OutboxDispatchQueue,
    queueName: string,
    overrides: Partial<ConstructorParameters<typeof OutboxRelay>[0]> = {},
  ): OutboxRelay {
    return new OutboxRelay({
      sql: db,
      queue: dispatchQueue,
      logger,
      routeEvent: (type) => (type === DEMO_EVENT_TYPE ? queueName : undefined),
      userIdOf: (envelope) => (envelope.actor.kind === 'user' ? envelope.actor.id : undefined),
      ...overrides,
    });
  }

  /** A slower queue so concurrent polls overlap in time. */
  function slowed(inner: OutboxDispatchQueue, delayMs: number): OutboxDispatchQueue {
    return {
      send: async (name, data, options) => {
        await sleep(delayMs);
        return inner.send(name, data, options);
      },
    };
  }

  function event(overrides: Partial<DemoEvent> = {}): DemoEvent {
    return demoEvent(
      { aggregate: { kind: 'demo_run', id: `run-${newId('event')}` }, ...overrides },
      random,
    );
  }

  async function outboxRow(db: Sql, id: string): Promise<OutboxRow | undefined> {
    const [row] = await db<OutboxRow[]>`
      select status, attempts, dispatched_at, last_error,
             next_attempt_at > now() + interval '59 seconds' as due_later
      from platform_outbox where id = ${id}`;
    return row;
  }

  async function jobs(db: Sql, name: string): Promise<JobRow[]> {
    return db<JobRow[]>`
      select id::text as id, data, singleton_key from pgboss.job where name = ${name}`;
  }

  async function statusCounts(db: Sql): Promise<Record<string, number>> {
    const rows = await db<{ status: string; n: number }[]>`
      select status, count(*)::int as n from platform_outbox group by status`;
    return Object.fromEntries(rows.map((row) => [row.status, row.n]));
  }

  it('dispatches a pending row as exactly one job keyed by the event id, also on re-dispatch', async () => {
    const { sql, queue } = await boot();
    const writer = new PgOutboxWriter(sql);
    const userId = newId('user');
    const envelope = event({ actor: { kind: 'user', id: userId } });

    // The producer's transaction owns the row: a rollback leaves nothing behind.
    const rolledBack = event();
    await expect(
      sql.begin(async (tx) => {
        await writer.append(rolledBack, tx);
        throw new Error('producer rolled back');
      }),
    ).rejects.toThrow('producer rolled back');
    expect(await outboxRow(sql, rolledBack.id)).toBeUndefined();

    await sql.begin(async (tx) => {
      await writer.append(envelope, tx);
    });
    const r = relay(sql, queue, SINGLE);

    expect(await r.pollOnce()).toEqual({ claimed: 1, dispatched: 1, retrying: 0, failed: 0 });
    const row = await outboxRow(sql, envelope.id);
    expect(row).toMatchObject({ status: 'dispatched', attempts: 0, last_error: null });
    expect(row?.dispatched_at).toBeInstanceOf(Date);
    const sent = await jobs(sql, SINGLE);
    expect(sent).toEqual([{ id: jobIdForKey(envelope.id), data: envelope, singleton_key: userId }]);
    expect(await r.pollOnce()).toEqual({ claimed: 0, dispatched: 0, retrying: 0, failed: 0 });

    // A relay that died after send() but before COMMIT leaves the row pending: the re-send is an
    // idempotent no-op (enqueued: false) that still marks the row dispatched.
    await sql`update platform_outbox set status = 'pending', dispatched_at = null
              where id = ${envelope.id}`;
    expect(await r.pollOnce()).toMatchObject({ claimed: 1, dispatched: 1 });
    expect(await jobs(sql, SINGLE)).toHaveLength(1);
  });

  it('backs off after a send failure, then marks the row failed with a payload-free last_error', async () => {
    const { sql } = await boot();
    const envelope = event({
      payload: {
        demoId: `demo-${PAYLOAD_MARKER}`,
        requestedAt: new Date().toISOString(),
        note: PAYLOAD_MARKER,
      },
    });
    await new PgOutboxWriter(sql).append(envelope);
    let sends = 0;
    const down: OutboxDispatchQueue = {
      send: () => {
        sends += 1;
        return Promise.reject(new Error('injected queue outage'));
      },
    };
    const r = relay(sql, down, SINGLE, {
      maxAttempts: 3,
      backoff: { baseMs: 60_000, capMs: 60_000 },
    });

    expect(await r.pollOnce()).toEqual({ claimed: 1, dispatched: 0, retrying: 1, failed: 0 });
    expect(await outboxRow(sql, envelope.id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      due_later: true,
      // Class only: a foreign error's message is never stored (driver messages echo parameters).
      last_error: 'Error',
    });
    // Not due yet: the backoff holds the row back.
    expect(await r.pollOnce()).toMatchObject({ claimed: 0 });

    for (const expected of [
      { claimed: 1, retrying: 1, failed: 0 },
      { claimed: 1, retrying: 0, failed: 1 },
    ]) {
      await sql`update platform_outbox set next_attempt_at = now() where id = ${envelope.id}`;
      expect(await r.pollOnce()).toMatchObject(expected);
    }
    const failed = await outboxRow(sql, envelope.id);
    expect(failed).toMatchObject({ status: 'failed', attempts: 3, due_later: null });
    expect(failed?.last_error).toBe('Error');
    for (const value of [envelope.payload.demoId, envelope.correlationId, PAYLOAD_MARKER]) {
      expect(failed?.last_error).not.toContain(value);
    }
    expect(sends).toBe(3);
    // A failed row is left for the DLQ sweep, never re-sent.
    await sql`update platform_outbox set next_attempt_at = now() where id = ${envelope.id}`;
    expect(await r.pollOnce()).toMatchObject({ claimed: 0 });

    const log = logs.text();
    expect(log).toContain(envelope.id);
    expect(log).toContain('"attempts":3');
    expect(log).not.toContain(PAYLOAD_MARKER);
  });

  it('never stores or logs a send error message that echoes the payload (class + pg code only)', async () => {
    const { sql } = await boot();
    const envelope = event({
      payload: { demoId: 'demo-echo', requestedAt: new Date().toISOString(), note: PAYLOAD_MARKER },
    });
    await new PgOutboxWriter(sql).append(envelope);
    // What a driver or pg-boss error can look like: its message quotes the statement parameters.
    const failures = [
      new Error(PAYLOAD_MARKER),
      Object.assign(new Error(`insert into pgboss.job ... (${PAYLOAD_MARKER})`), {
        name: 'PostgresError',
        code: '57P01',
      }),
    ];
    let sends = 0;
    const echoing: OutboxDispatchQueue = {
      send: () => Promise.reject(failures[sends++] ?? new Error(PAYLOAD_MARKER)),
    };
    const r = relay(sql, echoing, SINGLE, { maxAttempts: 2, backoff: { baseMs: 1, capMs: 1 } });
    const logStart = logs.text().length;

    expect(await r.pollOnce()).toMatchObject({ claimed: 1, retrying: 1 });
    expect((await outboxRow(sql, envelope.id))?.last_error).toBe('Error');
    await sql`update platform_outbox set next_attempt_at = now() where id = ${envelope.id}`;
    expect(await r.pollOnce()).toMatchObject({ claimed: 1, failed: 1 });
    const failed = await outboxRow(sql, envelope.id);
    expect(failed).toMatchObject({ status: 'failed', last_error: 'PostgresError (pg 57P01)' });

    const log = logs.text().slice(logStart);
    expect(log).toContain(envelope.id);
    expect(log).toContain('"lastError":"PostgresError (pg 57P01)"');
    expect(log).not.toContain(PAYLOAD_MARKER);
  });

  it('two relays on one table dispatch each of 250 rows exactly once, never > 100 per poll', async () => {
    const { sql, queue } = await boot();
    const writer = new PgOutboxWriter(sql);
    const envelopes = Array.from({ length: 250 }, () => event());
    await sql.begin(async (tx) => {
      for (const envelope of envelopes) await writer.append(envelope, tx);
    });
    const relays = [pool(), pool()].map((db) => relay(db, slowed(queue, 2), CONCURRENT));

    const drain = async (r: OutboxRelay): Promise<OutboxPollResult[]> => {
      const results: OutboxPollResult[] = [];
      for (;;) {
        const result = await r.pollOnce();
        results.push(result);
        if (result.claimed === 0) return results;
      }
    };
    const perRelay = await Promise.all(relays.map(drain));

    const all = perRelay.flat();
    expect(Math.max(...all.map((result) => result.claimed))).toBeLessThanOrEqual(100);
    expect(all.reduce((sum, result) => sum + result.dispatched, 0)).toBe(250);
    for (const results of perRelay) {
      // SKIP LOCKED split the work: both relays dispatched a share.
      expect(results.reduce((sum, result) => sum + result.dispatched, 0)).toBeGreaterThan(0);
    }
    expect(await statusCounts(sql)).toEqual({ dispatched: 250 });
    const sent = await jobs(sql, CONCURRENT);
    expect(sent).toHaveLength(250);
    expect(new Set(sent.map((job) => job.id))).toEqual(
      new Set(envelopes.map((envelope) => jobIdForKey(envelope.id))),
    );
  });

  it('stops gracefully: the in-flight batch commits whole, no poll after stop, restart drains', async () => {
    const { sql, queue } = await boot();
    const writer = new PgOutboxWriter(sql);
    await sql.begin(async (tx) => {
      for (let i = 0; i < 150; i += 1) await writer.append(event(), tx);
    });
    const r = relay(sql, slowed(queue, 20), LIFECYCLE, { pollIntervalMs: 50 });

    r.start();
    await sleep(300); // mid-way through the first 100-row batch (~2 s of sends)
    await r.stop();

    // The first batch finished and committed; nothing half-updated, nothing claimed after stop.
    expect(await statusCounts(sql)).toEqual({ dispatched: 100, pending: 50 });
    expect(await jobs(sql, LIFECYCLE)).toHaveLength(100);
    await sleep(300);
    expect(await statusCounts(sql)).toEqual({ dispatched: 100, pending: 50 });

    r.start();
    const deadline = Date.now() + 30_000;
    while ((await statusCounts(sql)).pending !== undefined && Date.now() < deadline) {
      await sleep(100);
    }
    await r.stop();
    expect(await statusCounts(sql)).toEqual({ dispatched: 150 });
    expect(await jobs(sql, LIFECYCLE)).toHaveLength(150);
  });
});
