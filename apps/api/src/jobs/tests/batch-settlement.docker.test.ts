// The demo queue's batched fetch (`DEMO_OUTBOX_FLOW_QUEUE.batchSize`, jobs/queues.ts) keeps the
// per-job contract of `PgBossQueue.work` on real pg-boss (Testcontainers Postgres): every job of a
// batch gets the cancelled-user refusal check, and one failing job is retried and dead-lettered
// alone while the rest of its batch completes once. FAILS without Docker, never skips.
import pino from 'pino';
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { createDb, migrate } from '@ai-stylist/db';
import { newId } from '@ai-stylist/shared-kernel';
import { startPostgres, type StartedPostgres } from '@ai-stylist/test-support';

import {
  PgBossQueue,
  type QueueJob,
  deadLetterQueueName,
} from '../../platform/queue/pg-boss-queue.js';
import { DEMO_OUTBOX_FLOW_QUEUE } from '../queues.js';

const QUEUE = DEMO_OUTBOX_FLOW_QUEUE.name;

type JobRow = { id: string; state: string; retry_count: number; source_id: string | null };

describe('demo.outbox-flow batched fetch settles per job (Testcontainers)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  let queue: PgBossQueue | undefined;

  afterAll(async () => {
    await queue?.stop();
    await sql?.end();
    await pg?.stop();
  });

  async function jobs(db: Sql, name: string): Promise<JobRow[]> {
    return db<JobRow[]>`
      select id::text as id, state::text as state, retry_count, source_id::text as source_id
      from pgboss.job where name = ${name}`;
  }

  it('one failure in a batch retries alone; a cancelled user is refused; the rest complete once', async () => {
    pg = await startPostgres();
    const handle = createDb(pg.url, { max: 1 });
    try {
      await migrate(handle.db);
    } finally {
      await handle.close();
    }
    const db = postgres(pg.url, { max: 2 });
    sql = db;
    // The real demo definition (batchSize, retryLimit); backoff shortened so retries finish fast.
    const definition = { ...DEMO_OUTBOX_FLOW_QUEUE, retryDelayMaxSeconds: 1 };
    const q = new PgBossQueue({
      connectionString: pg.url,
      queues: [definition],
      logger: pino({ level: 'silent' }),
      pollingIntervalSeconds: 0.5,
      stopTimeoutMs: 5_000,
    });
    queue = q;
    await q.start();

    const send = async (userId: string = newId('user')): Promise<string> => {
      const eventId = newId('event');
      return (await q.send(QUEUE, { eventId }, { idempotencyKey: eventId, userId })).jobId;
    };
    // One batch worth of jobs, all queued before the worker starts.
    const batch = DEMO_OUTBOX_FLOW_QUEUE.batchSize;
    const ok: string[] = [];
    for (let i = 0; i < batch - 2; i += 1) ok.push(await send());
    const failing = await send();
    const cancelledUser = newId('user');
    const raced = await send(cancelledUser);
    // A send that raced `cancelUser`: the marker exists, but the job is still `created`.
    expect(await q.cancelUser(cancelledUser)).toBe(1);
    await db`update pgboss.job set state = 'created', completed_on = null
             where name = ${QUEUE} and id = ${raced}::uuid`;

    const runs: { id: string; attempt: number }[] = [];
    await q.work(QUEUE, (job: QueueJob) => {
      runs.push({ id: job.id, attempt: job.attempt });
      return job.id === failing ? Promise.reject(new Error('injected')) : Promise.resolve();
    });
    const deadline = Date.now() + 120_000;
    for (;;) {
      const row = (await jobs(db, QUEUE)).find((r) => r.id === failing);
      if (row?.state === 'failed') break;
      if (Date.now() > deadline) throw new Error('timed out waiting for the failing job');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const rows = await jobs(db, QUEUE);
    const row = (id: string) => rows.find((r) => r.id === id);
    for (const id of ok) expect(row(id)).toMatchObject({ state: 'completed', retry_count: 0 });
    const { retryLimit } = DEMO_OUTBOX_FLOW_QUEUE;
    expect(row(failing)).toMatchObject({ state: 'failed', retry_count: retryLimit });
    expect(row(raced)).toMatchObject({ state: 'cancelled' });
    // Each healthy job ran once, only the failing one ran again, the refused one never ran.
    const healthyRuns = runs.filter((run) => run.id !== failing).map((run) => run.id);
    expect(healthyRuns.sort()).toEqual([...ok].sort());
    const failingAttempts = runs.filter((run) => run.id === failing).map((run) => run.attempt);
    expect(failingAttempts).toEqual(Array.from({ length: retryLimit + 1 }, (_, i) => i + 1));
    const dead = await jobs(db, deadLetterQueueName(QUEUE));
    expect(dead.map((r) => r.source_id)).toEqual([failing]);
  });
});
