// pg-boss queue adapter against a real Postgres (Testcontainers, `platform-docker` project).
// Part of the P02-T08 pg-boss gate (DEC-41): exactly-once enqueue by idempotency key, per-user
// cancellation (AC-6 / doc 06 §8 step 4), retry → failed + dead-letter after exactly the
// configured retries with a message-free job output, and the 100-day cancelled-user marker
// retention. FAILS without Docker, never skips.
import { Writable } from 'node:stream';

import pino from 'pino';
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { migrateUrl } from '@ai-stylist/db';
import { newId } from '@ai-stylist/shared-kernel';
import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

import { loggerOptions } from '../logger.js';
import {
  CANCELLED_USERS_QUEUE,
  CANCELLED_USER_MARKER_RETENTION_SECONDS,
  PgBossQueue,
  type QueueJob,
  deadLetterQueueName,
} from '../queue/pg-boss-queue.js';

const IDEMPOTENT = 'test.idempotent';
const PER_USER = 'test.per-user';
const RETRYING = 'test.retrying';
const RETRY_LIMIT = 2;
/** Canary: a value that must never appear in the log sink. */
const PAYLOAD_MARKER = 'payload-marker-7f3a';

type JobRow = { id: string; state: string; retry_count: number; source_id: string | null };

describe('PgBossQueue (pg-boss v12 on Testcontainers Postgres)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  let queue: PgBossQueue | undefined;
  const logLines: string[] = [];

  afterAll(async () => {
    await queue?.stop();
    await sql?.end();
    await pg?.stop();
  });

  /** Started lazily inside the first test so a missing Docker daemon FAILS a test (never skips). */
  async function container(): Promise<StartedPostgres> {
    pg ??= await startPostgres();
    return pg;
  }

  /** Migrated database (0003_pgboss_schema installs pg-boss) + a started queue. */
  async function boot(): Promise<{ queue: PgBossQueue; sql: Sql }> {
    if (queue !== undefined && sql !== undefined) return { queue, sql };
    const pg = await container();
    await migrateUrl(pg.url);
    sql = postgres(pg.url, { max: 2 });
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        logLines.push(chunk.toString('utf8'));
        callback();
      },
    });
    queue = new PgBossQueue({
      connectionString: pg.url,
      logger: pino(loggerOptions({ level: 'debug', service: 'api-test' }), sink),
      pollingIntervalSeconds: 0.5,
      stopTimeoutMs: 5_000,
      queues: [
        { name: IDEMPOTENT, retryLimit: 0, retryDelaySeconds: 1, retryDelayMaxSeconds: 1 },
        { name: PER_USER, retryLimit: 0, retryDelaySeconds: 1, retryDelayMaxSeconds: 1 },
        {
          name: RETRYING,
          retryLimit: RETRY_LIMIT,
          retryDelaySeconds: 1,
          retryDelayMaxSeconds: 1,
        },
      ],
    });
    await queue.start();
    return { queue, sql };
  }

  async function jobs(db: Sql, name: string): Promise<JobRow[]> {
    return db<JobRow[]>`
      select id::text as id, state::text as state, retry_count, source_id::text as source_id
      from pgboss.job where name = ${name}`;
  }

  async function waitFor(check: () => Promise<boolean>, what: string): Promise<void> {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`timed out waiting for ${what}`);
  }

  it('refuses to start before `just db-migrate` installed the pg-boss schema (no boot DDL)', async () => {
    const pg = await container();
    const unmigrated = new PgBossQueue({
      connectionString: pg.url,
      logger: pino({ level: 'silent' }),
      queues: [{ name: IDEMPOTENT, retryLimit: 0, retryDelaySeconds: 1, retryDelayMaxSeconds: 1 }],
    });
    await expect(unmigrated.start()).rejects.toThrow('pg-boss is not installed');
    await unmigrated.stop();
    const probe = postgres(pg.url, { max: 1 });
    try {
      const schemas = await probe<{ n: number }[]>`
        select count(*)::int as n from information_schema.schemata where schema_name = 'pgboss'`;
      expect(schemas[0]?.n).toBe(0);
    } finally {
      await probe.end();
    }
  });

  it('enqueues exactly one job when the same idempotency key is sent twice', async () => {
    const { queue, sql } = await boot();
    const eventId = newId('event');
    const userId = newId('user');

    const first = await queue.send(IDEMPOTENT, { eventId }, { idempotencyKey: eventId, userId });
    const second = await queue.send(IDEMPOTENT, { eventId }, { idempotencyKey: eventId, userId });

    expect(first.enqueued).toBe(true);
    expect(second).toEqual({ jobId: first.jobId, enqueued: false });
    const rows = await jobs(sql, IDEMPOTENT);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first.jobId, state: 'created' });
  });

  it("cancels only user A's pending jobs; A's handler never runs, B's jobs complete", async () => {
    const { queue, sql } = await boot();
    const userA = newId('user');
    const userB = newId('user');
    const sendFor = async (userId: string) => {
      const eventId = newId('event');
      return (await queue.send(PER_USER, { eventId, userId }, { idempotencyKey: eventId, userId }))
        .jobId;
    };
    const aJobs = [await sendFor(userA), await sendFor(userA)];
    const bJobs = [await sendFor(userB), await sendFor(userB)];

    expect(await queue.cancelPendingForUser(userA)).toBe(2);

    const handled: string[] = [];
    await queue.work(PER_USER, (job: QueueJob) => {
      handled.push(job.id);
      return Promise.resolve();
    });
    await waitFor(async () => {
      const rows = await jobs(sql, PER_USER);
      return bJobs.every((id) => rows.find((row) => row.id === id)?.state === 'completed');
    }, "user B's jobs to complete");

    const rows = await jobs(sql, PER_USER);
    for (const id of aJobs) expect(rows.find((row) => row.id === id)?.state).toBe('cancelled');
    for (const id of bJobs) expect(rows.find((row) => row.id === id)?.state).toBe('completed');
    expect(handled.sort()).toEqual([...bJobs].sort());
    expect(await queue.cancelPendingForUser(userA)).toBe(0);
  });

  it('fails a job after exactly retryLimit retries and dead-letters it', async () => {
    const { queue, sql } = await boot();
    const eventId = newId('event');
    const attempts: number[] = [];

    const { jobId } = await queue.send(
      RETRYING,
      { eventId, note: PAYLOAD_MARKER },
      { idempotencyKey: eventId, userId: newId('user') },
    );
    await queue.work(RETRYING, (job: QueueJob) => {
      attempts.push(job.attempt);
      return Promise.reject(new Error(`injected failure ${PAYLOAD_MARKER}`));
    });
    await waitFor(async () => {
      const rows = await jobs(sql, RETRYING);
      return rows.find((row) => row.id === jobId)?.state === 'failed';
    }, 'the job to fail');

    expect(attempts).toEqual([1, 2, 3]); // first run + RETRY_LIMIT retries
    const [failed] = (await jobs(sql, RETRYING)).filter((row) => row.id === jobId);
    expect(failed).toMatchObject({ state: 'failed', retry_count: RETRY_LIMIT });
    const dead = await jobs(sql, deadLetterQueueName(RETRYING));
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({ source_id: jobId, state: 'created' });

    // The stored job output (pg-boss keeps it on the job row) is the error class, not the thrown
    // error with its message and stack.
    const [stored] = await sql<{ output: unknown }[]>`
      select output from pgboss.job where name = ${RETRYING} and id = ${jobId}::uuid`;
    expect(stored?.output).toEqual({ errorName: 'Error' });
    const outputs = await sql<{ output: string | null }[]>`
      select output::text as output from pgboss.job
      where name in (${RETRYING}, ${deadLetterQueueName(RETRYING)})`;
    for (const row of outputs) expect(row.output ?? '').not.toContain(PAYLOAD_MARKER);

    // Logs name the job, queue and attempt; never the payload or the error message.
    const log = logLines.join('');
    expect(log).toContain(jobId);
    expect(log).toContain('"attempt":3');
    expect(log).not.toContain(PAYLOAD_MARKER);
  });

  it('keeps a cancelled-user marker 100 days and corrects a queue created with the 14-day default', async () => {
    const { queue, sql } = await boot();
    const retention = async () => {
      const [row] = await sql<{ retention_seconds: number }[]>`
        select retention_seconds from pgboss.queue where name = ${CANCELLED_USERS_QUEUE}`;
      return row?.retention_seconds;
    };
    expect(CANCELLED_USER_MARKER_RETENTION_SECONDS).toBe(100 * 24 * 60 * 60);
    expect(await retention()).toBe(CANCELLED_USER_MARKER_RETENTION_SECONDS);

    // A queue left at pg-boss's default by an earlier version: start() updates it in place.
    await sql`update pgboss.queue set retention_seconds = 1209600
              where name = ${CANCELLED_USERS_QUEUE}`;
    const restarted = new PgBossQueue({
      connectionString: (await container()).url,
      logger: pino({ level: 'silent' }),
      queues: [{ name: IDEMPOTENT, retryLimit: 0, retryDelaySeconds: 1, retryDelayMaxSeconds: 1 }],
    });
    try {
      await restarted.start();
    } finally {
      await restarted.stop();
    }
    expect(await retention()).toBe(CANCELLED_USER_MARKER_RETENTION_SECONDS);

    // The marker outlives the 14-day default by far (the replay + grace window is 97 days)...
    const userId = newId('user');
    await queue.cancelUser(userId);
    const markers = await sql<{ n: number; lasting: boolean }[]>`
      select count(*)::int as n,
             bool_and(keep_until >= now() + interval '99 days') as lasting
      from pgboss.job where name = ${CANCELLED_USERS_QUEUE}`;
    expect(markers[0]).toEqual({ n: 1, lasting: true });
    // ...and refuses the user's work while it lasts.
    const eventId = newId('event');
    expect(
      await queue.send(IDEMPOTENT, { eventId }, { idempotencyKey: eventId, userId }),
    ).toMatchObject({ enqueued: false });
  });
});
