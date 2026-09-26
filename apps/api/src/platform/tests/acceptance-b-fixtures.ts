// Shared by `acceptance-lifecycle.docker.test.ts` and the worker process it SIGKILLs
// (`acceptance-b-worker-process.ts`): queue definitions, test-owned bookkeeping tables and the
// test-defined job handlers. Test code only: the handlers record what ran, they decide nothing.
import type { Sql } from 'postgres';

import { isId } from '@ai-stylist/shared-kernel';

import type { PgIdempotencyGuard } from '../idempotency/pg-idempotency-guard.js';
import type { JobHandler, PgBossQueue, QueueDefinition, QueueJob } from '../queue/pg-boss-queue.js';

/**
 * A killed worker's `active` job is failed back into retry once it is `expireInSeconds` old (by
 * the restarted instance's supervisor, every `SUPERVISE_INTERVAL_SECONDS`).
 */
const RETRYING: Omit<QueueDefinition, 'name'> = {
  retryLimit: 3,
  retryDelaySeconds: 1,
  retryDelayMaxSeconds: 2,
  expireInSeconds: 4,
};
export const SUPERVISE_INTERVAL_SECONDS = 1;

/** AC-4: the outbox → pg-boss → handler queue that is stopped and killed mid-run. */
export const KILL_RETRY_QUEUE: QueueDefinition = { name: 'acceptance.kill-retry', ...RETRYING };
export const KILL_RETRY_SCOPE = `job:${KILL_RETRY_QUEUE.name}`;

/** AC-8: an export-shaped chain, one queue per step, run in this order. */
export const EXPORT_STEPS = [
  'acceptance.export.collect',
  'acceptance.export.package',
  'acceptance.export.publish',
] as const;
export type ExportStep = (typeof EXPORT_STEPS)[number];
export const EXPORT_QUEUES: readonly QueueDefinition[] = EXPORT_STEPS.map((name) => ({
  name,
  ...RETRYING,
}));
export const EXPORT_SCOPE = 'job:acceptance.export';

/** Guard retention for test keys; long enough to outlive every redelivery inside one test run. */
const TEST_RETENTION_SECONDS = 3_600;

/** Postgres `application_name` of the child's own pool (pg-boss uses `ai-stylist-jobs`). */
export const CHILD_APPLICATION_NAME = 'acceptance-b-child';

/** Test-owned bookkeeping: every handler invocation, and every committed side effect. */
export async function createBookkeepingTables(sql: Sql): Promise<void> {
  await sql`
    create table if not exists acceptance_b_calls (
      id bigserial primary key,
      queue text not null,
      job_id uuid not null,
      subject text not null,
      attempt int not null,
      pid int not null,
      called_at timestamptz not null default clock_timestamp()
    )`;
  await sql`
    create table if not exists acceptance_b_effects (
      id bigserial primary key,
      scope text not null,
      subject text not null,
      pid int not null
    )`;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function recordCall(sql: Sql, job: QueueJob, subject: string): Promise<void> {
  await sql`
    insert into acceptance_b_calls (queue, job_id, subject, attempt, pid)
    values (${job.queue}, ${job.id}, ${subject}, ${job.attempt}, ${process.pid})`;
}

async function recordEffect(sql: Sql, scope: string, subject: string): Promise<void> {
  await sql`
    insert into acceptance_b_effects (scope, subject, pid) values (${scope}, ${subject}, ${process.pid})`;
}

/** `id` of an envelope-shaped job payload (the outbox relay sends the stored envelope). */
export function eventIdOf(data: unknown): string {
  const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : undefined;
  if (typeof id !== 'string' || !isId(id, 'event')) throw new TypeError('job data has no evt_ id');
  return id;
}

function userIdOf(data: unknown): string {
  const id =
    typeof data === 'object' && data !== null && 'userId' in data ? data.userId : undefined;
  if (typeof id !== 'string' || !isId(id, 'user')) throw new TypeError('job data has no usr_ id');
  return id;
}

export type HandlerDeps = {
  readonly sql: Sql;
  readonly guard: Pick<PgIdempotencyGuard, 'runOnce'>;
  /** How long the guarded effect takes, ms: long in the process that gets killed mid-effect. */
  readonly effectMs: number;
};

/** AC-4: record the call, then run the effect at most once per event id. */
export function killRetryHandler(deps: HandlerDeps): JobHandler {
  return async (job) => {
    const eventId = eventIdOf(job.data);
    await recordCall(deps.sql, job, eventId);
    await deps.guard.runOnce(
      { key: eventId, scope: KILL_RETRY_SCOPE, retentionSeconds: TEST_RETENTION_SECONDS },
      async () => {
        await sleep(deps.effectMs);
        await recordEffect(deps.sql, KILL_RETRY_SCOPE, eventId);
      },
    );
  };
}

/** The data of every export step job: ids only. */
export type ExportStepData = { readonly userId: string };

export function exportStepKey(userId: string, step: ExportStep): string {
  return `${userId}:${step}`;
}

/**
 * AC-8 step `index`: record the call, run the step's effect at most once per (user id, step)
 * (doc 06 §8 per-step idempotency), then enqueue the next step. The enqueue runs on every attempt,
 * also when the effect had already run: it is idempotent (job id = user id + next step), so a kill
 * between the effect and the enqueue cannot strand the chain.
 */
export function exportStepHandler(
  deps: HandlerDeps & { readonly queue: Pick<PgBossQueue, 'send'> },
  index: number,
): JobHandler {
  const step = EXPORT_STEPS[index];
  if (step === undefined) throw new RangeError(`no export step ${index}`);
  const next = EXPORT_STEPS[index + 1];
  return async (job) => {
    const userId = userIdOf(job.data);
    const key = exportStepKey(userId, step);
    await recordCall(deps.sql, job, key);
    await deps.guard.runOnce(
      { key, scope: EXPORT_SCOPE, retentionSeconds: TEST_RETENTION_SECONDS },
      async () => {
        await sleep(deps.effectMs);
        await recordEffect(deps.sql, EXPORT_SCOPE, key);
      },
    );
    if (next !== undefined) {
      const data: ExportStepData = { userId };
      await deps.queue.send(next, data, { idempotencyKey: exportStepKey(userId, next), userId });
    }
  };
}
