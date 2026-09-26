// P02-T08 / DEC-41 pg-boss gate, acceptance cases AC-4, AC-6, AC-7 and AC-8 (Linear AI-9): the
// outbox relay, PgBossQueue and PgIdempotencyGuard against a real, migrated Postgres
// (Testcontainers pgvector/pgvector:pg18, `platform-docker` project). AC-4 and AC-8 hard-kill a
// separate worker process (`acceptance-b-worker-process.ts`, SIGKILL + pg_terminate_backend), so
// abandoned `active` jobs must expire and retry. Synthetic user ids only (`newId('user')`).
// FAILS without Docker, never skips.
import { type ChildProcessByStdio, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { PgBoss } from 'pg-boss';
import pino from 'pino';
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { migrateUrl } from '@ai-stylist/db';
import { DEMO_EVENT_TYPE, type DemoEvent, demoEvent, syntheticRandom } from '@ai-stylist/seed-data';
import { newId } from '@ai-stylist/shared-kernel';
import { type StartedPostgres, memoryLogStream, startPostgres } from '@ai-stylist/test-support';

import { PgIdempotencyGuard } from '../idempotency/pg-idempotency-guard.js';
import { loggerOptions } from '../logger.js';
import {
  OutboxRelay,
  type OutboxDispatchQueue,
  type OutboxRelayConfig,
} from '../outbox/outbox-relay.js';
import { PgOutboxWriter } from '../outbox/pg-outbox-writer.js';
import { jobIdForKey } from '../queue/job-id.js';
import {
  PgBossQueue,
  type QueueDefinition,
  type QueueJob,
  deadLetterQueueName,
} from '../queue/pg-boss-queue.js';

import {
  CHILD_APPLICATION_NAME,
  EXPORT_QUEUES,
  EXPORT_SCOPE,
  EXPORT_STEPS,
  type ExportStepData,
  KILL_RETRY_QUEUE,
  KILL_RETRY_SCOPE,
  SUPERVISE_INTERVAL_SECONDS,
  createBookkeepingTables,
  eventIdOf,
  exportStepHandler,
  exportStepKey,
  killRetryHandler,
  sleep,
} from './acceptance-b-fixtures.js';

const API_DIR = fileURLToPath(new URL('../../../', import.meta.url));
const WORKER_ENTRY = fileURLToPath(new URL('./acceptance-b-worker-process.ts', import.meta.url));
/** `application_name` of pg-boss (PgBossQueue) and of the child's own pool. */
const WORKER_APPLICATION_NAMES = ['ai-stylist-jobs', CHILD_APPLICATION_NAME];
/** The event contract whose payload properties bound what an outbox row may carry (AC-7). */
const DEMO_EVENT_SCHEMA = createRequire(import.meta.url).resolve(
  '@ai-stylist/contracts/events/demo.event.json',
);
type DemoEventSchema = {
  $defs: { DemoOutboxFlowRequestedV1Payload: { properties: Record<string, unknown> } };
};
type EffectCount = { subject: string; n: number };
/** Canary: a payload value that must never appear in the log sink. */
const PAYLOAD_MARKER = 'payload-marker-ac7-5b2e';

type JobRow = {
  id: string;
  state: string;
  retry_count: number;
  started: boolean;
  singleton_key: string | null;
};
type CallRow = { job_id: string; subject: string; attempt: number; pid: number };
type WorkerProcess = {
  readonly child: ChildProcessByStdio<null, Readable, Readable>;
  readonly pid: number;
  readonly ready: Promise<void>;
  readonly exited: Promise<NodeJS.Signals | number | null>;
};

describe('DEC-41 pg-boss gate: lifecycle acceptance (AC-4, AC-6, AC-7, AC-8)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  const queues: PgBossQueue[] = [];
  const workers: WorkerProcess[] = [];
  const logs = memoryLogStream();
  const logger = pino(loggerOptions({ level: 'debug', service: 'api-test' }), logs);
  const random = syntheticRandom();

  afterAll(async () => {
    for (const worker of workers) worker.child.kill('SIGKILL');
    for (const queue of queues) await queue.stop();
    await sql?.end();
    await pg?.stop();
  });

  /** Migrated database, lazily in the first test (no Docker ⇒ the test FAILS). Empty outbox. */
  async function boot(): Promise<{ url: string; sql: Sql }> {
    if (pg === undefined || sql === undefined) {
      pg = await startPostgres();
      await migrateUrl(pg.url);
      sql = postgres(pg.url, { max: 8 });
      await createBookkeepingTables(sql);
    }
    await sql`delete from platform_outbox`;
    return { url: pg.url, sql };
  }

  function newQueue(url: string, definitions: readonly QueueDefinition[]): PgBossQueue {
    const queue = new PgBossQueue({
      connectionString: url,
      logger,
      queues: definitions,
      pollingIntervalSeconds: 0.5,
      stopTimeoutMs: 10_000,
      superviseIntervalSeconds: SUPERVISE_INTERVAL_SECONDS,
    });
    queues.push(queue);
    return queue;
  }

  function relay(
    db: Sql,
    dispatchQueue: OutboxDispatchQueue,
    queueName: string,
    overrides: Partial<OutboxRelayConfig> = {},
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

  function slowed(inner: OutboxDispatchQueue, delayMs: number): OutboxDispatchQueue {
    return {
      send: async (name, data, options) => {
        await sleep(delayMs);
        return inner.send(name, data, options);
      },
    };
  }

  /** A demo event owned by `userId` (actor), unique aggregate. */
  function userEvent(userId: string, note?: string): DemoEvent {
    return demoEvent(
      {
        aggregate: { kind: 'demo_run', id: `run-${newId('event')}` },
        actor: { kind: 'user', id: userId },
        ...(note !== undefined ? { payload: { note } } : {}),
      },
      random,
    );
  }

  async function append(db: Sql, events: readonly DemoEvent[]): Promise<void> {
    const writer = new PgOutboxWriter(db);
    await db.begin(async (tx) => {
      for (const event of events) await writer.append(event, tx);
    });
  }

  async function jobs(db: Sql, name: string): Promise<JobRow[]> {
    return db<JobRow[]>`
      select id::text as id, state::text as state, retry_count,
             started_on is not null as started, singleton_key
      from pgboss.job where name = ${name} order by created_on`;
  }

  async function stateCounts(db: Sql, name: string): Promise<Record<string, number>> {
    const rows = await db<{ state: string; n: number }[]>`
      select state::text as state, count(*)::int as n from pgboss.job
      where name = ${name} group by state`;
    return Object.fromEntries(rows.map((row) => [row.state, row.n]));
  }

  async function outboxCounts(db: Sql): Promise<Record<string, number>> {
    const rows = await db<{ status: string; n: number }[]>`
      select status, count(*)::int as n from platform_outbox group by status`;
    return Object.fromEntries(rows.map((row) => [row.status, row.n]));
  }

  async function calls(db: Sql, queue: string): Promise<CallRow[]> {
    return db<CallRow[]>`
      select job_id::text as job_id, subject, attempt, pid from acceptance_b_calls
      where queue = ${queue} order by id`;
  }

  async function waitFor(
    check: () => Promise<boolean> | boolean,
    what: string,
    timeoutMs = 90_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await check()) return;
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${what}`);
  }

  function spawnWorker(url: string, mode: 'kill-retry' | 'export'): WorkerProcess {
    // Mode and database URL go on argv, not env: test-only settings stay out of .env.example.
    const child = spawn(process.execPath, ['--import', 'tsx', WORKER_ENTRY, mode, url], {
      cwd: API_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (child.pid === undefined) throw new Error('worker process did not spawn');
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    const exited = new Promise<NodeJS.Signals | number | null>((resolve) => {
      child.once('exit', (code, signal) => resolve(signal ?? code));
    });
    const ready = new Promise<void>((resolve, reject) => {
      let stdout = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
        if (stdout.includes('ready\n')) resolve();
      });
      child.once('exit', (code) => {
        reject(new Error(`worker process exited (${code}) before ready: ${stderr}`));
      });
    });
    const worker = { child, pid: child.pid, ready, exited };
    workers.push(worker);
    return worker;
  }

  /**
   * Hard kill: SIGKILL (no graceful stop, no COMMIT, no job completion), then terminate any
   * backend the dead process still holds. Callers stop their in-process queues first: pg-boss
   * connections share one `application_name`.
   */
  async function hardKill(db: Sql, worker: WorkerProcess): Promise<void> {
    worker.child.kill('SIGKILL');
    expect(await worker.exited).toBe('SIGKILL');
    await db`
      select pg_terminate_backend(pid) from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
        and application_name in ${db(WORKER_APPLICATION_NAMES)}`;
    await waitFor(async () => {
      const [row] = await db<{ n: number }[]>`
        select count(*)::int as n from pg_stat_activity
        where datname = current_database()
          and application_name in ${db(WORKER_APPLICATION_NAMES)}`;
      return row?.n === 0;
    }, "the killed process's backends to be gone");
  }

  it('AC-4: kill/retry, zero lost events — N outbox events; the relay+worker is stopped mid-batch, then SIGKILLed mid-job with its backends terminated; after restart every event reaches exactly one completed job (count = N, duplicates = 0)', async () => {
    const { url, sql } = await boot();
    const N = 60;
    const Q = KILL_RETRY_QUEUE.name;
    const users = [newId('user'), newId('user'), newId('user')];
    const events = Array.from({ length: N }, (_, i) => userEvent(users[i % users.length] ?? ''));
    await append(sql, events);
    const guard = new PgIdempotencyGuard(sql);

    // 1. Graceful stop mid-run: the in-flight relay batch commits whole, the active job finishes.
    const first = newQueue(url, [KILL_RETRY_QUEUE]);
    await first.start();
    await first.work(Q, killRetryHandler({ sql, guard, effectMs: 100 }));
    const firstRelay = relay(sql, slowed(first, 50), Q, { batchSize: 10, pollIntervalMs: 50 });
    firstRelay.start();
    await waitFor(async () => ((await stateCounts(sql, Q)).completed ?? 0) >= 3, '3 completions');
    await firstRelay.stop();
    await first.stop();
    const afterGraceful = await outboxCounts(sql);
    expect(afterGraceful.pending ?? 0).toBeGreaterThan(0);
    expect((await stateCounts(sql, Q)).active ?? 0).toBe(0);

    // 2. Hard kill: a separate relay+worker process, SIGKILLed while a job's effect is running.
    const child = spawnWorker(url, 'kill-retry');
    await child.ready;
    await waitFor(async () => {
      const childCalls = (await calls(sql, Q)).filter((call) => call.pid === child.pid);
      return childCalls.length >= 2 && ((await stateCounts(sql, Q)).active ?? 0) >= 1;
    }, 'the worker process to be mid-job');
    await hardKill(sql, child);

    // What the dead process abandoned: active jobs nobody will complete, and relay rows it had
    // sent but never committed (still `pending` although their job exists: mid-batch).
    const abandoned = (await jobs(sql, Q)).filter((job) => job.state === 'active');
    expect(abandoned.length).toBeGreaterThan(0);
    const pendingIds = await sql<{ id: string }[]>`
      select id from platform_outbox where status = 'pending'`;
    expect(pendingIds.length).toBeGreaterThan(0);
    const jobIds = new Set((await jobs(sql, Q)).map((job) => job.id));
    const sentUncommitted = pendingIds.filter((row) => jobIds.has(jobIdForKey(row.id)));
    expect(sentUncommitted.length).toBeGreaterThan(0);

    // 3. Restart: the relay re-sends the uncommitted rows (no-op sends), the supervisor expires
    // the abandoned active jobs into retry, the worker drains everything.
    const restarted = newQueue(url, [KILL_RETRY_QUEUE]);
    await restarted.start();
    await restarted.work(Q, killRetryHandler({ sql, guard, effectMs: 20 }));
    const restartedRelay = relay(sql, restarted, Q, { batchSize: 10, pollIntervalMs: 50 });
    restartedRelay.start();
    await waitFor(async () => (await stateCounts(sql, Q)).completed === N, `${N} completed jobs`);
    await restartedRelay.stop();
    await restarted.stop();

    const final = await jobs(sql, Q);
    expect(final).toHaveLength(N);
    expect(new Set(final.map((job) => job.id)).size).toBe(N); // duplicates = 0
    expect(new Set(final.map((job) => job.id))).toEqual(
      new Set(events.map((event) => jobIdForKey(event.id))),
    );
    expect(final.every((job) => job.state === 'completed')).toBe(true);
    expect(await jobs(sql, deadLetterQueueName(Q))).toHaveLength(0);
    expect(await outboxCounts(sql)).toEqual({ dispatched: N });
    const [keys] = await sql<{ n: number }[]>`
      select count(*)::int as n from platform_idempotency_keys where scope = ${KILL_RETRY_SCOPE}`;
    expect(keys?.n).toBe(N);

    // Each abandoned job was retried (not lost): its first run was in the killed process, its
    // completing run in the restarted one.
    const allCalls = await calls(sql, Q);
    for (const job of abandoned) {
      const done = final.find((row) => row.id === job.id);
      expect(done).toMatchObject({ state: 'completed' });
      expect(done?.retry_count).toBeGreaterThanOrEqual(1);
      const pids = allCalls.filter((call) => call.job_id === job.id).map((call) => call.pid);
      expect(pids[0]).toBe(child.pid);
      expect(pids.at(-1)).toBe(process.pid);
    }
  });

  it("AC-6: per-user cancellation — pending jobs for users A and B; cancelling user A leaves A's jobs cancelled with no worker call, and user B's jobs complete", async () => {
    const { url, sql } = await boot();
    const Q: QueueDefinition = {
      name: 'acceptance.per-user',
      retryLimit: 0,
      retryDelaySeconds: 1,
      retryDelayMaxSeconds: 1,
    };
    const queue = newQueue(url, [Q]);
    await queue.start();
    const userA = newId('user');
    const userB = newId('user');
    const [a1, a2, a3] = [userEvent(userA), userEvent(userA), userEvent(userA)];
    const [b1, b2, b3] = [userEvent(userB), userEvent(userB), userEvent(userB)];
    const aEvents = [a1, a2, a3];
    const bEvents = [b1, b2, b3];
    await append(sql, [a1, b1, a2, b2, a3, b3]);
    expect(await relay(sql, queue, Q.name).pollOnce()).toMatchObject({ claimed: 6, dispatched: 6 });

    expect(await queue.cancelPendingForUser(userA)).toBe(3);

    const handled: string[] = [];
    await queue.work(Q.name, (job: QueueJob) => {
      handled.push(eventIdOf(job.data));
      return Promise.resolve();
    });
    const bJobIds = bEvents.map((event) => jobIdForKey(event.id));
    await waitFor(async () => {
      const rows = await jobs(sql, Q.name);
      return bJobIds.every((id) => rows.find((row) => row.id === id)?.state === 'completed');
    }, "user B's jobs to complete");
    await sleep(1_500); // three more poll intervals: nothing else may run

    const rows = await jobs(sql, Q.name);
    for (const event of aEvents) {
      const row = rows.find((job) => job.id === jobIdForKey(event.id));
      expect(row).toMatchObject({ state: 'cancelled', started: false, singleton_key: userA });
    }
    for (const id of bJobIds) {
      expect(rows.find((job) => job.id === id)).toMatchObject({ state: 'completed' });
    }
    expect(handled.sort()).toEqual(bEvents.map((event) => event.id).sort());
    await queue.stop();
  });

  it("AC-7: deletion scenario (doc 06 §8 steps 4, 6) — a deletion-shaped cancel for one user while that user's jobs are active: the active jobs finish or fail without re-queueing, no new job for that user starts afterwards (pending jobs, pending outbox rows, a racing send), and that user's outbox rows hold IDs only", async () => {
    const { url, sql } = await boot();
    const Q: QueueDefinition = {
      name: 'acceptance.deletion',
      retryLimit: 3,
      retryDelaySeconds: 1,
      retryDelayMaxSeconds: 1,
    };
    const queue = newQueue(url, [Q]);
    await queue.start();
    const deleted = newId('user');
    const other = newId('user');
    const [x1, x2, x3] = [userEvent(deleted), userEvent(deleted), userEvent(deleted)];
    const [y1, y2] = [userEvent(other), userEvent(other)];
    await append(sql, [x1, x2, y1, y2, x3]);
    const outboxRelay = relay(sql, queue, Q.name);
    expect(await outboxRelay.pollOnce()).toMatchObject({ claimed: 5, dispatched: 5 });

    // Two workers: both pick up one of the deleted user's jobs and hold it `active` on a gate.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const handled: { eventId: string; userId: string | undefined }[] = [];
    let deletedStarted = 0;
    const handler = async (job: QueueJob): Promise<void> => {
      const envelope = job.data as DemoEvent;
      handled.push({ eventId: eventIdOf(envelope), userId: envelope.actor.id });
      if (envelope.actor.id !== deleted) return;
      deletedStarted += 1;
      const nth = deletedStarted;
      await gate;
      if (nth === 2) throw new Error('injected failure after the deletion cancel');
    };
    await queue.work(Q.name, handler);
    await queue.work(Q.name, handler);
    await waitFor(() => deletedStarted === 2, "two of the user's jobs to be active");
    const before = await jobs(sql, Q.name);
    const stateOf = (rows: JobRow[], event: DemoEvent) =>
      rows.find((row) => row.id === jobIdForKey(event.id))?.state;
    expect([stateOf(before, x1), stateOf(before, x2), stateOf(before, x3)]).toEqual([
      'active',
      'active',
      'created',
    ]);

    // Still-pending outbox rows for the user (written, not yet relayed) at deletion time.
    const [x4, x5] = [userEvent(deleted, PAYLOAD_MARKER), userEvent(deleted)];
    await append(sql, [x4, x5]);

    // Deletion step 4: the two active jobs and the created one.
    expect(await queue.cancelUser(deleted)).toBe(3);
    const handledAtCancel = handled.length;
    release();

    // The relay still dispatches the pending rows: the queue refuses them, nothing is inserted.
    expect(await outboxRelay.pollOnce()).toEqual({
      claimed: 2,
      dispatched: 2,
      retrying: 0,
      failed: 0,
    });
    // A send that raced the cancel (checked before the marker existed, inserted after the cancel
    // sweep) — inserted here behind the adapter's back: the worker must refuse it.
    const raced = userEvent(deleted);
    const racedJobId = jobIdForKey(raced.id);
    const boss = new PgBoss({ connectionString: url, migrate: false, supervise: false });
    boss.on('error', () => undefined);
    await boss.start();
    try {
      await boss.send(Q.name, raced, { id: racedJobId, singletonKey: deleted });
    } finally {
      await boss.stop({ graceful: false });
    }

    const yJobIds = [y1, y2].map((event) => jobIdForKey(event.id));
    await waitFor(async () => {
      const rows = await jobs(sql, Q.name);
      const state = (id: string) => rows.find((row) => row.id === id)?.state;
      return state(racedJobId) === 'cancelled' && yJobIds.every((id) => state(id) === 'completed');
    }, 'the raced job to be refused and the other user’s jobs to complete');
    await sleep(3_000); // > retry delay (1 s) + poll: a re-queued job would have run by now

    const after = await jobs(sql, Q.name);
    // The active jobs finished (one resolved, one threw) without re-queueing: still cancelled.
    for (const event of [x1, x2]) {
      expect(after.find((row) => row.id === jobIdForKey(event.id))).toMatchObject({
        state: 'cancelled',
        retry_count: 0,
      });
    }
    // No new job for the user started: the created job never ran, the pending outbox rows made
    // no job, the raced job was cancelled without a handler call.
    expect(after.find((row) => row.id === jobIdForKey(x3.id))).toMatchObject({
      state: 'cancelled',
      started: false,
    });
    for (const event of [x4, x5]) {
      expect(after.find((row) => row.id === jobIdForKey(event.id))).toBeUndefined();
    }
    expect(after.find((row) => row.id === racedJobId)).toMatchObject({ state: 'cancelled' });
    expect(handled.filter((call) => call.userId === deleted)).toHaveLength(2);
    expect(handled.slice(handledAtCancel).every((call) => call.userId === other)).toBe(true);
    for (const id of yJobIds) {
      expect(after.find((row) => row.id === id)).toMatchObject({ state: 'completed' });
    }
    expect(await jobs(sql, deadLetterQueueName(Q.name))).toHaveLength(0);
    expect(await queue.cancelUser(deleted)).toBe(0); // idempotent

    // Step 6: the user's outbox rows (historical envelopes) carry only contract payload fields.
    const contract = JSON.parse(await readFile(DEMO_EVENT_SCHEMA, 'utf8')) as DemoEventSchema;
    const payloadSchema = contract.$defs.DemoOutboxFlowRequestedV1Payload;
    const allowed = new Set(Object.keys(payloadSchema.properties));
    const rows = await sql<{ payload: DemoEvent }[]>`
      select payload from platform_outbox where payload -> 'actor' ->> 'id' = ${deleted}`;
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      for (const key of Object.keys(row.payload.payload)) expect(allowed).toContain(key);
    }
    expect(logs.text()).not.toContain(PAYLOAD_MARKER);
    await queue.stop();
  });

  it('AC-8: export scenario — an export-shaped 3-step job chain keyed to one user survives a SIGKILL of its worker process between steps (mid step 2) and completes each step exactly once (per-step idempotency, doc 06 §8)', async () => {
    const { url, sql } = await boot();
    const userId = newId('user');
    const [collect, pack, publish] = EXPORT_STEPS;
    const child = spawnWorker(url, 'export');
    await child.ready;

    const starter = newQueue(url, EXPORT_QUEUES);
    await starter.start();
    const start: ExportStepData = { userId };
    await starter.send(collect, start, {
      idempotencyKey: exportStepKey(userId, collect),
      userId,
    });
    await starter.stop();

    // Step 1 done, step 2 running its (slow) effect in the child: kill between the steps.
    await waitFor(async () => {
      const done = (await stateCounts(sql, collect)).completed === 1;
      return done && (await calls(sql, pack)).some((call) => call.pid === child.pid);
    }, 'step 1 done and step 2 running in the worker process');
    await hardKill(sql, child);
    expect((await jobs(sql, pack)).map((job) => job.state)).toEqual(['active']);
    expect(await jobs(sql, publish)).toHaveLength(0);

    const restarted = newQueue(url, EXPORT_QUEUES);
    await restarted.start();
    const guard = new PgIdempotencyGuard(sql);
    for (const [index, step] of EXPORT_STEPS.entries()) {
      await restarted.work(
        step,
        exportStepHandler({ sql, guard, queue: restarted, effectMs: 20 }, index),
      );
    }
    await waitFor(
      async () => (await stateCounts(sql, publish)).completed === 1,
      'the last step to complete',
    );

    const effects = async (): Promise<EffectCount[]> => {
      return sql<EffectCount[]>`
        select subject, count(*)::int as n from acceptance_b_effects
        where scope = ${EXPORT_SCOPE} group by subject order by subject`;
    };
    const stepKeys = EXPORT_STEPS.map((step) => exportStepKey(userId, step)).sort();
    const exactlyOnce = stepKeys.map((subject) => ({ subject, n: 1 }));
    expect(await effects()).toEqual(exactlyOnce);
    for (const step of EXPORT_STEPS) {
      const rows = await jobs(sql, step);
      expect(rows.map((job) => job.state)).toEqual(['completed']);
      expect(await jobs(sql, deadLetterQueueName(step))).toHaveLength(0);
    }
    const [packJob] = await jobs(sql, pack);
    expect(packJob?.retry_count).toBeGreaterThanOrEqual(1);
    expect((await calls(sql, pack)).map((call) => call.pid)).toEqual([child.pid, process.pid]);
    expect((await calls(sql, collect)).map((call) => call.pid)).toEqual([child.pid]);

    // A redelivered step (a new job for the same user + step, e.g. after pg-boss retention) runs
    // the handler but not the effect, and does not duplicate the next step.
    await restarted.send(pack, start, {
      idempotencyKey: `${exportStepKey(userId, pack)}:redelivery`,
      userId,
    });
    await waitFor(
      async () => (await stateCounts(sql, pack)).completed === 2,
      'the redelivered step to complete',
    );
    expect(await effects()).toEqual(exactlyOnce);
    expect(await jobs(sql, publish)).toHaveLength(1);
    await restarted.stop();
  });
});
