// pg-boss queue adapter against a real Postgres (Testcontainers, `platform-docker` project).
// Part of the P02-T08 pg-boss gate (DEC-41): exactly-once enqueue by idempotency key, per-user
// cancellation (AC-6 / doc 06 §8 step 4), and retry → failed + dead-letter after exactly the
// configured retries. FAILS without Docker, never skips.
import { Writable } from 'node:stream';

import pino from 'pino';
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { newId } from '@ai-stylist/shared-kernel';
import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

import { loggerOptions } from '../logger.js';
import { PgBossQueue, type QueueJob, deadLetterQueueName } from '../queue/pg-boss-queue.js';

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
  async function boot(): Promise<{ queue: PgBossQueue; sql: Sql }> {
    if (queue !== undefined && sql !== undefined) return { queue, sql };
    pg = await startPostgres();
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

    // Logs name the job, queue and attempt; never the payload or the error message.
    const log = logLines.join('');
    expect(log).toContain(jobId);
    expect(log).toContain('"attempt":3');
    expect(log).not.toContain(PAYLOAD_MARKER);
  });
});
