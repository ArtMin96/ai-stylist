// P02-T08 acceptance (DEC-41 pg-boss gate), wave 4a: AC-1 idempotency, AC-2 retry + DLQ, AC-3
// replay, AC-5 SKIP LOCKED concurrency, plus the AC-13 / assumption A11 throughput measurement.
// The REAL pipeline on Testcontainers Postgres: PgOutboxWriter → OutboxRelay → PgBossQueue →
// `startJobs` (demo.outbox-flow handler + PgIdempotencyGuard + HttpSegmentationClient) → a local
// fake segmentation worker that counts calls. FAILS without Docker, never skips. Lives under
// jobs/tests because it drives the jobs composition root (platform tests may not import jobs).
// Companion: apps/api/src/platform/tests/acceptance-lifecycle.docker.test.ts (AC-4, AC-6–AC-8).
import { performance } from 'node:perf_hooks';

import pino from 'pino';
import postgres, { type Sql } from 'postgres';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { createDb, migrate } from '@ai-stylist/db';
import { newId } from '@ai-stylist/shared-kernel';
import { type DemoEvent, demoEvent, syntheticRandom } from '@ai-stylist/seed-data';
import { type StartedPostgres, memoryLogStream, startPostgres } from '@ai-stylist/test-support';

import { loggerOptions } from '../../platform/logger.js';
import {
  MAX_OUTBOX_BATCH_SIZE,
  OutboxRelay,
  type OutboxDispatchQueue,
  type OutboxPollResult,
} from '../../platform/outbox/outbox-relay.js';
import { PgOutboxWriter } from '../../platform/outbox/pg-outbox-writer.js';
import { jobIdForKey } from '../../platform/queue/job-id.js';
import {
  type EnqueueResult,
  PgBossQueue,
  deadLetterQueueName,
} from '../../platform/queue/pg-boss-queue.js';
import { DEMO_OUTBOX_FLOW_SCOPE } from '../demo-outbox-flow.js';
import {
  DEMO_OUTBOX_FLOW_QUEUE,
  JOB_QUEUES,
  type RunningJobs,
  queueForEventType,
  startJobs,
  userIdOf,
} from '../index.js';
import { jobExhaustedReason } from '../outbox-dead-letter.js';

import {
  type FakeSegmentationWorker,
  startFakeSegmentationWorker,
} from './fake-segmentation-worker.js';

const QUEUE = DEMO_OUTBOX_FLOW_QUEUE.name;
/** Canary: a payload value that must never reach `last_error` or the log sink. */
const PAYLOAD_MARKER = 'payload-marker-a7c2';
/** Throughput sample size and the floor asserted: 2× the A11 planning rate of ~10 jobs/s. */
const THROUGHPUT_EVENTS = 500;
const THROUGHPUT_FLOOR_JOBS_PER_SECOND = 20;
/** Functional tests poll fast (pg-boss minimum); the throughput test keeps production defaults. */
const TEST_POLLING_SECONDS = 0.5;

type JobRow = { id: string; state: string; retry_count: number };
type OutboxRow = { status: string; attempts: number; last_error: string | null };
type Send = { readonly eventId: string; readonly result: EnqueueResult };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('P02-T08 acceptance: outbox → pg-boss → demo job → worker (DEC-41 gate, Testcontainers)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  let sender: PgBossQueue | undefined;
  let worker: FakeSegmentationWorker | undefined;
  const running: RunningJobs[] = [];
  const relays: OutboxRelay[] = [];
  const extraPools: Sql[] = [];
  const logs = memoryLogStream();
  const logger = pino(loggerOptions({ level: 'debug', service: 'api-test' }), logs);
  /** Writes the measured throughput to the test output (stdout), not to the canary sink. */
  const report = pino(loggerOptions({ level: 'info', service: 'api-test' }));
  const random = syntheticRandom();

  afterEach(async () => {
    for (const r of relays.splice(0)) await r.stop();
    for (const jobs of running.splice(0)) await jobs.stop();
  });

  afterAll(async () => {
    await sender?.stop();
    for (const extra of extraPools) await extra.end();
    await sql?.end();
    await worker?.close();
    await pg?.stop();
  });

  /** Migrated database + the relay's sending queue + the fake worker, lazily in the first test. */
  async function boot(): Promise<{
    sql: Sql;
    sender: PgBossQueue;
    worker: FakeSegmentationWorker;
  }> {
    if (sql === undefined || sender === undefined || worker === undefined) {
      pg = await startPostgres();
      const handle = createDb(pg.url, { max: 1 });
      try {
        await migrate(handle.db);
      } finally {
        await handle.close();
      }
      sql = postgres(pg.url, { max: 4 });
      // The relay's composition: the same queue list the job runtime works (jobs/queues.ts).
      sender = new PgBossQueue({ connectionString: pg.url, queues: JOB_QUEUES, logger });
      await sender.start();
      worker = await startFakeSegmentationWorker();
    }
    // Each test starts from an empty outbox and demo queue (throwaway container database): AC-5
    // leaves 250 jobs no worker ran, which would otherwise sit ahead of the next test's jobs.
    await sql`delete from platform_outbox`;
    await sql`delete from pgboss.job where name = ${QUEUE} and state in ('created', 'retry')`;
    worker.requests.length = 0;
    worker.behaviour = 'echo';
    return { sql, sender, worker };
  }

  /** The jobs process as `apps/api/src/jobs/main.ts` starts it, pointed at the fake worker. */
  async function runJobs(pollingIntervalSeconds: number | undefined): Promise<void> {
    if (pg === undefined || worker === undefined) throw new Error('boot() first');
    running.push(
      await startJobs({
        databaseUrl: pg.url,
        segmentationBaseUrl: worker.baseUrl,
        logger,
        ...(pollingIntervalSeconds !== undefined ? { pollingIntervalSeconds } : {}),
      }),
    );
  }

  function pool(): Sql {
    if (pg === undefined) throw new Error('boot() first');
    const extra = postgres(pg.url, { max: 2 });
    extraPools.push(extra);
    return extra;
  }

  function relay(
    db: Sql,
    queue: OutboxDispatchQueue,
    overrides: Partial<ConstructorParameters<typeof OutboxRelay>[0]> = {},
  ): OutboxRelay {
    const r = new OutboxRelay({
      sql: db,
      queue,
      logger,
      routeEvent: queueForEventType,
      userIdOf,
      ...overrides,
    });
    relays.push(r);
    return r;
  }

  /** Delegates to the real queue and records every send's outcome. */
  function recording(
    inner: OutboxDispatchQueue,
    delayMs = 0,
  ): OutboxDispatchQueue & { sends: Send[] } {
    const sends: Send[] = [];
    return {
      sends,
      send: async (name, data, options) => {
        if (delayMs > 0) await sleep(delayMs);
        const result = await inner.send(name, data, options);
        sends.push({ eventId: options.idempotencyKey, result });
        return result;
      },
    };
  }

  function event(overrides: Parameters<typeof demoEvent>[0] = {}): DemoEvent {
    return demoEvent(
      { aggregate: { kind: 'demo_run', id: `run-${newId('event')}` }, ...overrides },
      random,
    );
  }

  function requestIdOf(request: FakeSegmentationWorker['requests'][number]): unknown {
    return (request.json as { request_id?: unknown }).request_id;
  }

  function workerCalls(w: FakeSegmentationWorker, eventId: string): number {
    const calls = w.requests.filter((r) => requestIdOf(r) === eventId);
    return calls.length;
  }

  /** `job started` records the queue adapter logged for one job id, in order. */
  function startedAttempts(jobId: string): unknown[] {
    return logs
      .records()
      .filter((r) => r.msg === 'job started' && r.jobId === jobId)
      .map((r) => r.attempt);
  }

  function handlerRecords(eventId: string): Record<string, unknown>[] {
    const records = logs.records();
    return records.filter((r) => r.component === 'job.demo-outbox-flow' && r.eventId === eventId);
  }

  async function jobsFor(db: Sql, name: string, eventId: string): Promise<JobRow[]> {
    return db<JobRow[]>`
      select id::text as id, state::text as state, retry_count
      from pgboss.job where name = ${name} and data->>'id' = ${eventId}`;
  }

  async function outboxRow(db: Sql, id: string): Promise<OutboxRow | undefined> {
    const [row] = await db<OutboxRow[]>`
      select status, attempts, last_error from platform_outbox where id = ${id}`;
    return row;
  }

  async function completedCount(db: Sql, eventIds: readonly string[]): Promise<number> {
    const [row] = await db<{ n: number }[]>`
      select count(*)::int as n from pgboss.job
      where name = ${QUEUE} and state = 'completed'
        and data->>'id' = any(${db.array([...eventIds])})`;
    return row?.n ?? -1;
  }

  async function waitFor(check: () => Promise<boolean>, what: string, timeoutMs = 90_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await check()) return;
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${what}`);
  }

  it('AC-1: the same outbox event enqueued twice runs one job and makes one worker call', async () => {
    const { sql, sender, worker } = await boot();
    await runJobs(TEST_POLLING_SECONDS);
    const writer = new PgOutboxWriter(sql);
    const envelope = event({ actor: { kind: 'user', id: newId('user') } });
    const jobId = jobIdForKey(envelope.id);
    await writer.append(envelope);
    // The outbox itself holds an event id once (primary key).
    await expect(writer.append(envelope)).rejects.toThrow();

    const queue = recording(sender);
    const r = relay(sql, queue);
    expect(await r.pollOnce()).toEqual({ claimed: 1, dispatched: 1, retrying: 0, failed: 0 });
    // Enqueue #2: a relay that died after send() but before COMMIT re-sends the same row.
    await sql`update platform_outbox set status = 'pending', dispatched_at = null
              where id = ${envelope.id}`;
    expect(await r.pollOnce()).toMatchObject({ claimed: 1, dispatched: 1 });
    // Enqueue #3: the same event id sent directly on the queue.
    const direct = await sender.send(QUEUE, envelope, { idempotencyKey: envelope.id });

    expect(queue.sends.map((s) => s.result)).toEqual([
      { jobId, enqueued: true },
      { jobId, enqueued: false },
    ]);
    expect(direct).toEqual({ jobId, enqueued: false });
    await waitFor(
      async () => (await jobsFor(sql, QUEUE, envelope.id))[0]?.state === 'completed',
      'the job to complete',
    );
    // Enqueue #4, after completion: still the retained job, no new execution.
    expect(await sender.send(QUEUE, envelope, { idempotencyKey: envelope.id })).toEqual({
      jobId,
      enqueued: false,
    });
    await sleep(TEST_POLLING_SECONDS * 1000 * 3);

    expect(await jobsFor(sql, QUEUE, envelope.id)).toEqual([
      { id: jobId, state: 'completed', retry_count: 0 },
    ]);
    expect(startedAttempts(jobId)).toEqual([1]);
    expect(handlerRecords(envelope.id).map((r) => r.ran)).toEqual([true]);
    expect(workerCalls(worker, envelope.id)).toBe(1);
    expect(worker.requests).toHaveLength(1);
  });

  it('AC-2: an injected worker failure is retried retryLimit times, then the job is failed, dead-lettered and its outbox row marked failed', async () => {
    const { sql, sender, worker } = await boot();
    await runJobs(TEST_POLLING_SECONDS);
    worker.behaviour = { status: 503 };
    const envelope = event({ payload: { note: PAYLOAD_MARKER } });
    const jobId = jobIdForKey(envelope.id);
    await new PgOutboxWriter(sql).append(envelope);
    expect(await relay(sql, sender).pollOnce()).toMatchObject({ claimed: 1, dispatched: 1 });

    await waitFor(
      async () => (await jobsFor(sql, QUEUE, envelope.id))[0]?.state === 'failed',
      'the job to fail after its retries',
    );

    const retryLimit = DEMO_OUTBOX_FLOW_QUEUE.retryLimit;
    expect(retryLimit).toBe(4); // doc 04 §9.2: max 5 attempts
    expect(workerCalls(worker, envelope.id)).toBe(retryLimit + 1);
    expect(startedAttempts(jobId)).toEqual([1, 2, 3, 4, 5]);
    expect(await jobsFor(sql, QUEUE, envelope.id)).toEqual([
      { id: jobId, state: 'failed', retry_count: retryLimit },
    ]);
    // Doc 04 §9.2 DLQ: the exhausted job lands in the DLQ **and** the outbox row is marked
    // `failed` (by the jobs process's DLQ worker), with a payload-free `last_error`.
    const deadLetters = async () => sql<{ state: string; source_id: string | null }[]>`
      select state::text as state, source_id::text as source_id
      from pgboss.job where name = ${deadLetterQueueName(QUEUE)} and source_id = ${jobId}::uuid`;
    await waitFor(
      async () => (await outboxRow(sql, envelope.id))?.status === 'failed',
      'the DLQ worker to mark the outbox row failed',
    );
    await waitFor(
      async () => (await deadLetters())[0]?.state === 'completed',
      'the dead letter to settle',
    );
    expect(await deadLetters()).toEqual([{ state: 'completed', source_id: jobId }]);
    const row = await outboxRow(sql, envelope.id);
    // `attempts` counts relay sends: the one send succeeded.
    expect(row).toEqual({ status: 'failed', attempts: 0, last_error: jobExhaustedReason(QUEUE) });
    expect(row?.last_error).toBe('job exhausted: demo.outbox-flow');
    // The relay claims `pending` rows only: a failed row is never re-dispatched.
    expect(await relay(sql, sender).pollOnce()).toMatchObject({ claimed: 0 });
    // No retry after `failed`.
    await sleep(TEST_POLLING_SECONDS * 1000 * 3);
    expect(workerCalls(worker, envelope.id)).toBe(retryLimit + 1);
    expect(await jobsFor(sql, QUEUE, envelope.id)).toHaveLength(1);
    expect(logs.text()).not.toContain(PAYLOAD_MARKER);
  });

  it('AC-2: a relay dispatch failure is retried maxAttempts times, then the outbox row is failed with a payload-free last_error', async () => {
    const { sql, worker } = await boot();
    const envelope = event({
      correlationId: `corr-${PAYLOAD_MARKER}`,
      payload: { demoId: `demo-${PAYLOAD_MARKER}`, note: PAYLOAD_MARKER },
    });
    await new PgOutboxWriter(sql).append(envelope);
    let sends = 0;
    const down: OutboxDispatchQueue = {
      send: () => {
        sends += 1;
        return Promise.reject(new Error('injected queue outage'));
      },
    };
    const r = relay(sql, down, { backoff: { baseMs: 1, capMs: 1 } });
    const maxAttempts = r.settings.maxAttempts;
    expect(maxAttempts).toBe(5); // doc 04 §9.2 default

    const results: OutboxPollResult[] = [];
    for (let poll = 0; poll < maxAttempts * 4 && sends < maxAttempts; poll += 1) {
      results.push(await r.pollOnce());
      await sleep(20); // past the 1 ms backoff
    }

    expect(sends).toBe(maxAttempts);
    expect(results.reduce((n, x) => n + x.retrying, 0)).toBe(maxAttempts - 1);
    expect(results.reduce((n, x) => n + x.failed, 0)).toBe(1);
    const row = await outboxRow(sql, envelope.id);
    expect(row).toMatchObject({ status: 'failed', attempts: maxAttempts });
    expect(row?.last_error).toBe('Error');
    for (const value of [
      PAYLOAD_MARKER,
      envelope.payload.demoId,
      envelope.payload.requestedAt,
      envelope.correlationId,
      envelope.aggregate.id,
      'payload',
    ]) {
      expect(row?.last_error).not.toContain(value);
    }
    // A failed row is left for the DLQ sweep: never re-sent, never enqueued, never reaches a worker.
    expect(await r.pollOnce()).toMatchObject({ claimed: 0 });
    expect(sends).toBe(maxAttempts);
    expect(await jobsFor(sql, QUEUE, envelope.id)).toEqual([]);
    expect(workerCalls(worker, envelope.id)).toBe(0);
    expect(logs.text()).not.toContain(PAYLOAD_MARKER);
  });

  it('AC-3: replaying a dispatched outbox row with its original event id makes no second worker call, even after pg-boss dropped the job', async () => {
    const { sql, sender, worker } = await boot();
    await runJobs(TEST_POLLING_SECONDS);
    const envelope = event();
    const jobId = jobIdForKey(envelope.id);
    await new PgOutboxWriter(sql).append(envelope);
    const queue = recording(sender);
    const r = relay(sql, queue);
    const replay = async () => {
      await sql`update platform_outbox set status = 'pending', dispatched_at = null
                where id = ${envelope.id} and status = 'dispatched'`;
      expect(await r.pollOnce()).toEqual({ claimed: 1, dispatched: 1, retrying: 0, failed: 0 });
    };
    const completed = async () => {
      const [job] = await jobsFor(sql, QUEUE, envelope.id);
      return job?.state === 'completed';
    };

    expect(await r.pollOnce()).toMatchObject({ claimed: 1, dispatched: 1 });
    await waitFor(completed, 'the first run to complete');
    expect(workerCalls(worker, envelope.id)).toBe(1);

    // Replay 1: pg-boss still holds the job, so the queue dedupes the enqueue.
    await replay();
    expect(queue.sends.at(-1)?.result).toEqual({ jobId, enqueued: false });

    // Replay 2: pg-boss no longer holds the job (retention elapsed, or deleted), so the replay
    // enqueues and RUNS a new job; only the durable PgIdempotencyGuard stops the second call.
    const deleted = await sql`delete from pgboss.job where name = ${QUEUE} and id = ${jobId}::uuid`;
    expect(deleted.count).toBe(1);
    await replay();
    expect(queue.sends.at(-1)?.result).toEqual({ jobId, enqueued: true });
    await waitFor(completed, 'the replayed job to complete');

    expect(startedAttempts(jobId)).toEqual([1, 1]); // two job executions …
    expect(handlerRecords(envelope.id).map((x) => [x.ran, x.msg])).toEqual([
      [true, 'demo outbox flow handled'],
      [false, 'demo outbox flow already handled'],
    ]);
    expect(workerCalls(worker, envelope.id)).toBe(1); // … one worker call
    const keys = await sql<{ scope: string }[]>`
      select scope from platform_idempotency_keys where key = ${envelope.id}`;
    expect(keys).toEqual([{ scope: DEMO_OUTBOX_FLOW_SCOPE }]);
    expect(await outboxRow(sql, envelope.id)).toMatchObject({ status: 'dispatched' });
  });

  it('AC-5: two relays polling one table dispatch each of 250 rows once (SKIP LOCKED), never more than 100 rows per poll', async () => {
    const { sql, sender } = await boot();
    const writer = new PgOutboxWriter(sql);
    const envelopes = Array.from({ length: 250 }, () => event());
    await sql.begin(async (tx) => {
      for (const envelope of envelopes) await writer.append(envelope, tx);
    });
    // The cap is enforced, not just defaulted.
    expect(() => relay(sql, sender, { batchSize: MAX_OUTBOX_BATCH_SIZE + 1 })).toThrow(RangeError);
    relays.length = 0;
    const queues = [recording(sender, 2), recording(sender, 2)];
    const pair = queues.map((q) => relay(pool(), q));
    for (const r of pair) expect(r.settings.batchSize).toBe(MAX_OUTBOX_BATCH_SIZE);

    const drain = async (r: OutboxRelay): Promise<OutboxPollResult[]> => {
      const results: OutboxPollResult[] = [];
      for (;;) {
        const result = await r.pollOnce();
        results.push(result);
        if (result.claimed === 0) return results;
      }
    };
    const perRelay = await Promise.all(pair.map(drain));

    const all = perRelay.flat();
    expect(Math.max(...all.map((x) => x.claimed))).toBeLessThanOrEqual(100);
    for (const results of perRelay) {
      expect(results.reduce((n, x) => n + x.dispatched, 0)).toBeGreaterThan(0);
    }
    const sends = queues.flatMap((q) => q.sends);
    // Each row sent by exactly one relay, exactly once, and each send created its job.
    expect(sends).toHaveLength(250);
    expect(new Set(sends.map((s) => s.eventId))).toEqual(new Set(envelopes.map((e) => e.id)));
    expect(sends.every((s) => s.result.enqueued)).toBe(true);
    const [statuses] = await sql<{ dispatched: number; other: number }[]>`
      select count(*) filter (where status = 'dispatched')::int as dispatched,
             count(*) filter (where status <> 'dispatched')::int as other
      from platform_outbox`;
    expect(statuses).toEqual({ dispatched: 250, other: 0 });
    const [jobs] = await sql<{ n: number; distinct_ids: number }[]>`
      select count(*)::int as n, count(distinct data->>'id')::int as distinct_ids
      from pgboss.job where name = ${QUEUE}
        and data->>'id' = any(${sql.array(envelopes.map((e) => e.id))})`;
    expect(jobs).toEqual({ n: 250, distinct_ids: 250 });
  });

  it(`throughput (AC-13 / A11): ${THROUGHPUT_EVENTS} events relay → pg-boss → demo handler → fake worker, measured above ${THROUGHPUT_FLOOR_JOBS_PER_SECOND} jobs/s`, async () => {
    const { sql, sender, worker } = await boot();
    // Production defaults: startJobs as jobs/main.ts runs it, relay with its default settings.
    await runJobs(undefined);
    const writer = new PgOutboxWriter(sql);
    const envelopes = Array.from({ length: THROUGHPUT_EVENTS }, () => event());
    await sql.begin(async (tx) => {
      for (const envelope of envelopes) await writer.append(envelope, tx);
    });
    const eventIds = envelopes.map((e) => e.id);
    // Finishing later than this is below the floor by definition; stop waiting and report.
    const budgetMs = (THROUGHPUT_EVENTS / THROUGHPUT_FLOOR_JOBS_PER_SECOND) * 1000;

    const started = performance.now();
    relay(sql, sender).start();
    while (performance.now() - started < budgetMs) {
      if ((await completedCount(sql, eventIds)) === THROUGHPUT_EVENTS) break;
      await sleep(50);
    }
    const seconds = (performance.now() - started) / 1000;
    const completed = await completedCount(sql, eventIds);
    const jobsPerSecond = Math.round((completed / seconds) * 10) / 10;
    const [dispatched] = await sql<{ n: number }[]>`
      select count(*)::int as n from platform_outbox where status = 'dispatched'`;
    report.info(
      {
        events: THROUGHPUT_EVENTS,
        dispatched: dispatched?.n,
        workerCalls: worker.requests.length,
        completed,
        seconds: Math.round(seconds * 100) / 100,
        jobsPerSecond,
        floor: THROUGHPUT_FLOOR_JOBS_PER_SECOND,
      },
      'acceptance throughput: relay → pg-boss → demo handler → fake worker',
    );

    expect(jobsPerSecond).toBeGreaterThan(THROUGHPUT_FLOOR_JOBS_PER_SECOND);
    expect(completed).toBe(THROUGHPUT_EVENTS);
    const called = new Set(worker.requests.map(requestIdOf));
    for (const envelope of envelopes) expect(called.has(envelope.id)).toBe(true);
  });
});
