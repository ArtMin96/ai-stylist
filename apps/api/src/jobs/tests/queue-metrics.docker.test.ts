// The jobs process's queue metrics on real pg-boss (Testcontainers Postgres): `startJobs` as
// `main.ts` runs it, with an in-memory metric reader instead of OTLP, and a fake segmentation
// worker that always fails. The injected failure runs the T08 retry → DLQ path, and
// `stylist.queue.job.dlq` for `demo.outbox-flow` goes 0 → 1: the local counterpart of the
// `queue.job.dlq` alert proof run (docs/runbooks/04-queue-dlq.md). FAILS without Docker.
import pino from 'pino';
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { migrateUrl } from '@ai-stylist/db';
import { demoEvent, syntheticRandom } from '@ai-stylist/seed-data';
import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

import {
  type MemoryMetrics,
  memoryMetrics,
  metricNamed,
  numberPoints,
  valueAt,
} from '../../platform/tests/memory-metrics.js';
import { METRIC_NAMES } from '../../platform/telemetry/metrics.js';
import { PgBossQueue, deadLetterQueueName } from '../../platform/queue/pg-boss-queue.js';
import { DEMO_OUTBOX_FLOW_QUEUE, JOB_QUEUES, type RunningJobs, startJobs } from '../index.js';

import {
  type FakeSegmentationWorker,
  startFakeSegmentationWorker,
} from './fake-segmentation-worker.js';

const QUEUE = DEMO_OUTBOX_FLOW_QUEUE.name;
const DLQ = deadLetterQueueName(QUEUE);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('jobs process queue metrics (injected failure → DLQ, Testcontainers)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  let sender: PgBossQueue | undefined;
  let worker: FakeSegmentationWorker | undefined;
  let jobs: RunningJobs | undefined;
  let metrics: MemoryMetrics | undefined;

  afterAll(async () => {
    await jobs?.stop();
    await sender?.stop();
    await sql?.end();
    await worker?.close();
    await metrics?.shutdown();
    await pg?.stop();
  });

  it('counts every attempt, the retries and one dead letter, and reports the queue gauges', async () => {
    pg = await startPostgres();
    await migrateUrl(pg.url);
    const db = postgres(pg.url, { max: 2 });
    sql = db;
    const logger = pino({ level: 'silent' });
    sender = new PgBossQueue({ connectionString: pg.url, queues: JOB_QUEUES, logger });
    await sender.start();
    worker = await startFakeSegmentationWorker();
    worker.behaviour = { status: 503 };
    const m = memoryMetrics();
    metrics = m;
    jobs = await startJobs({
      databaseUrl: pg.url,
      segmentationBaseUrl: worker.baseUrl,
      logger,
      pollingIntervalSeconds: 0.5,
      meter: m.meter,
    });

    // Before any job: every series exists at 0, so the first dead letter is an `increase()`.
    const atStart = await m.collect();
    const dlqAt = (collected: Awaited<ReturnType<MemoryMetrics['collect']>>) =>
      valueAt(metricNamed(collected, METRIC_NAMES.jobDeadLetters), { job_type: QUEUE });
    expect(dlqAt(atStart)).toBe(0);
    expect(numberPoints(metricNamed(atStart, METRIC_NAMES.jobDeadLetters))).toHaveLength(1);
    for (const name of [METRIC_NAMES.jobCompletions, METRIC_NAMES.jobFailures]) {
      const counter = metricNamed(atStart, name);
      for (const jobType of [QUEUE, DLQ]) expect(valueAt(counter, { job_type: jobType })).toBe(0);
    }

    const envelope = demoEvent({}, syntheticRandom());
    await sender.send(QUEUE, envelope, { idempotencyKey: envelope.id });
    const deadline = Date.now() + 150_000;
    for (;;) {
      const [row] = await db<{ state: string }[]>`
        select state::text as state from pgboss.job
        where name = ${DLQ} and data->>'id' = ${envelope.id}`;
      if (row?.state === 'completed') break;
      if (Date.now() > deadline) throw new Error('timed out waiting for the dead letter');
      await sleep(250);
    }

    const collected = await m.collect();
    const at = (name: string, jobType: string) =>
      valueAt(metricNamed(collected, name), { job_type: jobType });
    const attempts = DEMO_OUTBOX_FLOW_QUEUE.retryLimit + 1;
    expect(dlqAt(collected)).toBe(1);
    expect(at(METRIC_NAMES.jobFailures, QUEUE)).toBe(attempts);
    expect(at(METRIC_NAMES.jobRetries, QUEUE)).toBe(attempts - 1);
    expect(at(METRIC_NAMES.jobCompletions, QUEUE)).toBe(0);
    // The DLQ worker handled the dead letter once (no outbox row: marking it is a no-op).
    expect(at(METRIC_NAMES.jobCompletions, DLQ)).toBe(1);
    expect(at(METRIC_NAMES.jobFailures, DLQ)).toBe(0);
    expect(worker.requests).toHaveLength(attempts);

    const depth = numberPoints(metricNamed(collected, METRIC_NAMES.queueDepth));
    expect(depth.map((p) => p.attributes.queue)).toEqual([QUEUE, DLQ, deadLetterQueueName(DLQ)]);
    const age = numberPoints(metricNamed(collected, METRIC_NAMES.jobAgeOldest));
    expect(age.map((p) => p.attributes.job_type)).toEqual([QUEUE, DLQ]);
    expect(age.every((p) => p.value >= 0)).toBe(true);
  });
});
