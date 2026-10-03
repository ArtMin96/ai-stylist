// `PgBossQueue.readStats()` on real pg-boss (Testcontainers Postgres, migrated schema): the
// `stylist.queue.depth` reading comes from pg-boss's own queue stats for every configured queue
// and its dead-letter queue, and `stylist.queue.job.age_oldest` from the oldest waiting job
// (planning/14 §4). FAILS without Docker, never skips.
import pino from 'pino';
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { migrateUrl } from '@ai-stylist/db';
import { newId } from '@ai-stylist/shared-kernel';
import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

import {
  PgBossQueue,
  type QueueDefinition,
  type QueueStatsSnapshot,
  deadLetterQueueName,
} from '../queue/pg-boss-queue.js';

const SOURCE: QueueDefinition = {
  name: 'stats.source',
  retryLimit: 1,
  retryDelaySeconds: 1,
  retryDelayMaxSeconds: 1,
};
const WORKED_DLQ: QueueDefinition = { ...SOURCE, name: deadLetterQueueName(SOURCE.name) };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PgBossQueue.readStats (pg-boss v12 on Testcontainers Postgres)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  let queue: PgBossQueue | undefined;

  afterAll(async () => {
    await queue?.stop();
    await sql?.end();
    await pg?.stop();
  });

  it('reads waiting jobs per queue (DLQs included) and the oldest waiting job’s age per job type', async () => {
    pg = await startPostgres();
    await migrateUrl(pg.url);
    const db = postgres(pg.url, { max: 2 });
    sql = db;
    const q = new PgBossQueue({
      connectionString: pg.url,
      queues: [SOURCE, WORKED_DLQ],
      logger: pino({ level: 'silent' }),
      // pg-boss refreshes its cached queue counts on the monitor interval; 1 s keeps this test short.
      superviseIntervalSeconds: 1,
    });
    queue = q;
    await q.start();

    for (let i = 0; i < 3; i += 1) {
      const key = newId('event');
      await q.send(SOURCE.name, { eventId: key }, { idempotencyKey: key });
    }
    const deadLetterKey = newId('event');
    await q.send(WORKED_DLQ.name, { eventId: deadLetterKey }, { idempotencyKey: deadLetterKey });
    // The oldest waiting job was created two minutes ago; completed jobs never count.
    await db`update pgboss.job set created_on = now() - interval '120 seconds'
             where id = (select id from pgboss.job where name = ${SOURCE.name} limit 1)`;
    const doneKey = newId('event');
    const done = await q.send(SOURCE.name, { eventId: doneKey }, { idempotencyKey: doneKey });
    await db`update pgboss.job set state = 'completed', completed_on = now(),
             created_on = now() - interval '1 hour' where id = ${done.jobId}::uuid`;

    let stats: QueueStatsSnapshot | undefined;
    const deadline = Date.now() + 90_000;
    for (;;) {
      stats = await q.readStats();
      if (stats.depth.find((d) => d.queue === SOURCE.name)?.jobs === 3) break;
      if (Date.now() > deadline) throw new Error('pg-boss queue stats never counted the jobs');
      await sleep(500);
    }

    expect(stats.depth).toEqual([
      { queue: SOURCE.name, jobs: 3 },
      { queue: WORKED_DLQ.name, jobs: 1 },
      { queue: deadLetterQueueName(WORKED_DLQ.name), jobs: 0 },
    ]);
    const age = (jobType: string) =>
      stats?.oldestAgeSeconds.find((a) => a.jobType === jobType)?.seconds ?? -1;
    expect(stats.oldestAgeSeconds.map((a) => a.jobType)).toEqual([SOURCE.name, WORKED_DLQ.name]);
    expect(age(SOURCE.name)).toBeGreaterThanOrEqual(120);
    expect(age(SOURCE.name)).toBeLessThan(600);
    expect(age(WORKED_DLQ.name)).toBeGreaterThanOrEqual(0);
    expect(age(WORKED_DLQ.name)).toBeLessThan(120);

    // Nothing waits: every age reads 0.
    await db`delete from pgboss.job where name in (${SOURCE.name}, ${WORKED_DLQ.name})`;
    const empty = await q.readStats();
    expect(empty.oldestAgeSeconds).toEqual([
      { jobType: SOURCE.name, seconds: 0 },
      { jobType: WORKED_DLQ.name, seconds: 0 },
    ]);
  });
});
