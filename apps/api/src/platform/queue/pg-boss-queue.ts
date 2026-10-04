// pg-boss v12 adapter (doc 04 §9, DEC-41): lifecycle, queue setup with bounded retries + a
// dead-letter queue, idempotent enqueue, workers, and per-user cancellation, including the
// deletion-shaped `cancelUser` that refuses a user's later work (doc 06 §8 step 4).
// Translation only: which queue an event maps to, and what a handler does, are decided by the
// callers (outbox relay, `apps/api/src/jobs/`). Logs carry job id, queue name and attempt — never
// job data. Each job runs in a CONSUMER span in the trace its data carries (doc 14 §3) and in its
// correlation scope, so every log line of the job carries `correlation_id`.
import { SpanKind } from '@opentelemetry/api';
import { type JobResult, type JobWithMetadata, PgBoss } from 'pg-boss';
import type { Logger } from 'pino';

import { isId } from '@ai-stylist/shared-kernel';

import { childLogger } from '../logger.js';
import {
  type CarriedTraceContext,
  SPAN_ATTRIBUTES,
  queueSpanAttributes,
  recordSpanError,
  runTraced,
} from '../telemetry/trace-context.js';

import { errorSummary } from '../errors/error-shape.js';
import { jobIdForKey } from './job-id.js';
import {
  MAX_WORK_BATCH_SIZE,
  type QueueDefinition,
  deadLetterQueueName,
} from './queue-definition.js';
import { type QueueStatsSnapshot, readQueueStats } from './queue-stats.js';

export {
  MAX_WORK_BATCH_SIZE,
  type QueueDefinition,
  deadLetterQueueName,
} from './queue-definition.js';
export type { QueueStatsSnapshot } from './queue-stats.js';

export type PgBossQueueConfig = {
  /** Passed in by the composition root; this adapter never reads `process.env`. */
  readonly connectionString: string;
  readonly queues: readonly QueueDefinition[];
  /** A pino logger built from `loggerOptions()` (apps/api/src/platform/logger.ts). */
  readonly logger: Logger;
  /**
   * Postgres schema pg-boss runs in. Default `pgboss`, the only schema migration
   * `0003_pgboss_schema` installs; any other value fails `start()` unless migrated as well.
   */
  readonly schema?: string;
  /** pg-boss pool size. Default 10 (pg-boss default). */
  readonly maxConnections?: number;
  /** Worker poll interval, seconds (>= 0.5). Default 2 (pg-boss default). */
  readonly pollingIntervalSeconds?: number;
  /** Graceful stop: how long `stop()` waits for active jobs, ms. Default 30 000. */
  readonly stopTimeoutMs?: number;
  /**
   * How often this instance's supervisor looks for `active` jobs past their `expireInSeconds`
   * (a worker that died mid-job) and fails them into retry, seconds (>= 1). Sets pg-boss
   * `superviseIntervalSeconds` and `monitorIntervalSeconds`. Default 60 (pg-boss default).
   */
  readonly superviseIntervalSeconds?: number;
  /**
   * Reads the trace context a job's data carries (an envelope's `traceparent`, `correlationId`),
   * from the composition root; must not throw. Omitted: every job starts a new trace, unscoped.
   */
  readonly traceContextOf?: (data: unknown) => CarriedTraceContext | undefined;
};

export type EnqueueOptions = {
  /** Exactly-once key: the outbox event `id` (or `entityId + pipelineVersion` for reprocessing). */
  readonly idempotencyKey: string;
  /** `usr_…` id of the user the job belongs to; stored as the pg-boss key for cancellation. */
  readonly userId?: string;
};

export type EnqueueResult = {
  readonly jobId: string;
  /**
   * false when nothing was inserted: a job with this idempotency key already exists on the queue,
   * or `userId` was cancelled with `cancelUser` (its work is refused).
   */
  readonly enqueued: boolean;
};

/** What a handler receives. `data` is untrusted JSON: parse it with the contract types. */
export type QueueJob = {
  readonly id: string;
  readonly queue: string;
  readonly data: unknown;
  /** 1 on the first run, `retryLimit + 1` on the last. */
  readonly attempt: number;
  readonly signal: AbortSignal;
};

/** Resolve = completed. Throw = failed attempt (retried with backoff, then dead-lettered). */
export type JobHandler = (job: QueueJob) => Promise<void>;

/** Upper bound on ids per `cancel()` call. */
const CANCEL_CHUNK_SIZE = 100;

/**
 * Internal queue holding one never-worked job per user cancelled with `cancelUser`: the durable
 * "refuse this user's work" marker every `PgBossQueue` instance (API, relay, jobs process) reads.
 * pg-boss deletes a marker `CANCELLED_USER_MARKER_RETENTION_SECONDS` after it was written.
 */
export const CANCELLED_USERS_QUEUE = 'platform.cancelled-users';

/**
 * How long a cancelled-user marker refuses the user's work: 100 days. It must outlive every path
 * that can still enqueue work for a deleted user: an outbox replay re-dispatches events retained
 * 90 days (planning/04-architecture.md §9.2, "Replay"), and account deletion runs after a 7-day
 * grace window (planning/11-security-privacy-and-compliance.md §13.2). 90 + 7, plus 3 days margin.
 * pg-boss's default created-job retention (14 days) would let a replay reach a deleted user.
 */
export const CANCELLED_USER_MARKER_RETENTION_SECONDS = 100 * 24 * 60 * 60;

/** Job states a cancellation can still stop (pg-boss `cancel` only changes these). */
const UNFINISHED_STATES: ReadonlySet<string> = new Set(['created', 'retry', 'active']);

function cancelledUserMarkerId(userId: string): string {
  return jobIdForKey(`cancelled-user:${userId}`);
}

export class PgBossQueue {
  private readonly boss: PgBoss;
  private readonly logger: Logger;
  private readonly queues: ReadonlyMap<string, QueueDefinition>;
  private readonly pollingIntervalSeconds: number;
  private readonly stopTimeoutMs: number;
  private readonly traceContextOf: PgBossQueueConfig['traceContextOf'];
  private readonly schema: string;

  constructor(config: PgBossQueueConfig) {
    this.logger = childLogger(config.logger, { component: 'pg-boss-queue' });
    this.traceContextOf = config.traceContextOf;
    this.schema = config.schema ?? 'pgboss';
    this.queues = new Map(config.queues.map((queue) => [queue.name, queue]));
    if (this.queues.size !== config.queues.length) {
      throw new TypeError('PgBossQueue: queue names must be unique');
    }
    if (this.queues.has(CANCELLED_USERS_QUEUE)) {
      throw new TypeError(`PgBossQueue: queue name '${CANCELLED_USERS_QUEUE}' is reserved`);
    }
    for (const queue of config.queues) {
      const size = queue.batchSize;
      const valid = size === undefined || (Number.isInteger(size) && size >= 1);
      if (!valid || (size ?? 1) > MAX_WORK_BATCH_SIZE) {
        throw new RangeError(
          `PgBossQueue: batchSize of '${queue.name}' must be an integer in 1..${MAX_WORK_BATCH_SIZE}`,
        );
      }
    }
    this.pollingIntervalSeconds = config.pollingIntervalSeconds ?? 2;
    this.stopTimeoutMs = config.stopTimeoutMs ?? 30_000;
    const supervise = config.superviseIntervalSeconds;
    this.boss = new PgBoss({
      connectionString: config.connectionString,
      application_name: 'ai-stylist-jobs',
      // Never install or upgrade the pg-boss schema on boot (planning/06 §7): migration
      // 0003_pgboss_schema (packages/db) installs it, and start() only checks the version.
      migrate: false,
      ...(config.schema !== undefined ? { schema: config.schema } : {}),
      ...(config.maxConnections !== undefined ? { max: config.maxConnections } : {}),
      ...(supervise !== undefined
        ? { superviseIntervalSeconds: supervise, monitorIntervalSeconds: supervise }
        : {}),
    });
    // An unhandled 'error' event would crash the process. Only the error class and pg code are
    // logged: driver messages can echo statement parameters (job data).
    this.boss.on('error', (error: Error) => {
      this.logger.error(errorSummary(error), 'pg-boss error');
    });
  }

  /**
   * Verify the migrated pg-boss schema (pg-boss throws `pg-boss is not installed` or
   * `pg-boss database requires migrations` when `just db-migrate` has not run), then create or
   * update every queue and its DLQ. Never runs DDL on the pg-boss schema itself.
   */
  async start(): Promise<void> {
    await this.boss.start();
    // Never worked: its jobs are the markers `cancelUser` writes and `send` / `work` read. A job's
    // keep_until is fixed at insert from the queue's retention; createQueue is a no-op for an
    // existing queue, so updateQueue corrects one created with another retention (e.g. pg-boss's
    // 14-day default) for every marker written from now on.
    const markerOptions = {
      retryLimit: 0,
      retentionSeconds: CANCELLED_USER_MARKER_RETENTION_SECONDS,
    };
    await this.boss.createQueue(CANCELLED_USERS_QUEUE, { policy: 'standard', ...markerOptions });
    await this.boss.updateQueue(CANCELLED_USERS_QUEUE, markerOptions);
    for (const queue of this.queues.values()) {
      const deadLetter = deadLetterQueueName(queue.name);
      // The DLQ holds exhausted jobs (doc 04 §9.2). It is created here with retryLimit 0; a
      // composition root that works it (apps/api/src/jobs OUTBOX_DEAD_LETTER_QUEUES) lists it as
      // its own QueueDefinition, which sets its retry policy.
      await this.boss.createQueue(deadLetter, { policy: 'standard', retryLimit: 0 });
      const options = {
        retryLimit: queue.retryLimit,
        retryDelay: queue.retryDelaySeconds,
        retryBackoff: true,
        retryDelayMax: queue.retryDelayMaxSeconds,
        deadLetter,
        ...(queue.expireInSeconds !== undefined ? { expireInSeconds: queue.expireInSeconds } : {}),
      };
      // createQueue is a no-op for an existing queue, so updateQueue applies config changes.
      await this.boss.createQueue(queue.name, { policy: 'standard', ...options });
      await this.boss.updateQueue(queue.name, options);
    }
    this.logger.info({ queues: [...this.queues.keys()] }, 'queues ready');
  }

  /** Graceful: waits up to `stopTimeoutMs` for active jobs, then closes the pool. */
  async stop(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: this.stopTimeoutMs });
  }

  /**
   * Enqueue `data` once per (queue, idempotencyKey). A repeat with the same key is a no-op that
   * returns the same job id with `enqueued: false`; so is a send for a user cancelled with
   * `cancelUser` (nothing is inserted).
   */
  async send(queue: string, data: object, options: EnqueueOptions): Promise<EnqueueResult> {
    this.requireQueue(queue);
    if (options.userId !== undefined && !isId(options.userId, 'user')) {
      throw new TypeError('PgBossQueue.send: userId must be a usr_ id');
    }
    const jobId = jobIdForKey(options.idempotencyKey);
    if (options.userId !== undefined && (await this.isUserCancelled(options.userId))) {
      this.logger.info({ jobId, queue }, 'job refused: user cancelled');
      return { jobId, enqueued: false };
    }
    const inserted = await this.boss.send(queue, data, {
      id: jobId,
      ...(options.userId !== undefined ? { singletonKey: options.userId } : {}),
    });
    const enqueued = inserted !== null;
    const message = enqueued ? 'job enqueued' : 'job already enqueued';
    this.logger.debug({ jobId, queue, enqueued }, message);
    return { jobId, enqueued };
  }

  /**
   * Start a worker on `queue`: up to the queue's `batchSize` jobs per fetch (default 1), run one at
   * a time, each settled on its own: `handler` resolving completes that job, throwing fails that
   * job alone (retried with backoff, then dead-lettered). A job keyed to a user cancelled with
   * `cancelUser` is cancelled instead; its handler is never called.
   */
  async work(queue: string, handler: JobHandler): Promise<void> {
    const definition = this.requireQueue(queue);
    const maxAttempts = definition.retryLimit + 1;
    const batchSize = definition.batchSize ?? 1;
    await this.boss.work(
      queue,
      {
        batchSize,
        // Only takes effect above batch 1: keep fetching while there is a full batch of backlog,
        // instead of waiting a poll interval after every fetch.
        burstWhenBatchFull: batchSize > 1,
        includeMetadata: true,
        perJobResults: true,
        pollingIntervalSeconds: this.pollingIntervalSeconds,
      },
      async (jobs) => {
        // Never throws: a throw would fail (and retry) the whole batch together.
        const results: JobResult[] = [];
        for (const job of jobs) {
          // pg-boss is shutting down (or the batch deadline passed): start nothing new. The jobs
          // left without a result are failed by pg-boss and retried.
          if (job.signal.aborted) break;
          results.push(await this.runJob(queue, maxAttempts, job, handler));
        }
        return results;
      },
    );
  }

  /** One fetched job → its disposition, in its `job.process <queue>` span and correlation scope. */
  private runJob(
    queue: string,
    maxAttempts: number,
    job: JobWithMetadata<unknown>,
    handler: JobHandler,
  ): Promise<JobResult> {
    const attempt = job.retryCount + 1;
    const fields = { jobId: job.id, queue, attempt, maxAttempts };
    const attributes = {
      ...queueSpanAttributes('process', queue),
      [SPAN_ATTRIBUTES.messagingMessageId]: job.id,
      [SPAN_ATTRIBUTES.jobAttempt]: attempt,
    };
    const name = `job.process ${queue}`;
    const carried = this.traceContextOf?.(job.data);
    return runTraced<JobResult>(name, SpanKind.CONSUMER, attributes, carried, async (span) => {
      try {
        // A send that raced `cancelUser` (checked before the marker, inserted after the cancel
        // sweep) is caught here, for every job of a batch. Reported `completed`, which pg-boss
        // applies only to `active` jobs, so the job stays `cancelled`.
        if (job.singletonKey !== null && (await this.isUserCancelled(job.singletonKey))) {
          await this.boss.cancel(queue, job.id);
          this.logger.info(fields, 'job refused: user cancelled');
          return { id: job.id, status: 'completed' };
        }
        this.logger.debug(fields, 'job started');
        await handler({ id: job.id, queue, data: job.data, attempt, signal: job.signal });
      } catch (error) {
        // Class and pg code only, in the log, the span and the job's stored `output` (pg-boss
        // persists it on the job row and its DLQ copy): handler and driver messages may quote it.
        const summary = errorSummary(error);
        recordSpanError(span, error);
        if (attempt >= maxAttempts) {
          this.logger.error({ ...fields, ...summary }, 'job failed; dead-lettered');
        } else {
          this.logger.warn({ ...fields, ...summary }, 'job attempt failed; will retry');
        }
        return { id: job.id, status: 'failed', output: summary };
      }
      this.logger.debug(fields, 'job completed');
      return { id: job.id, status: 'completed' };
    });
  }

  /**
   * Queue gauges (planning/14 §4): waiting jobs per configured queue and per dead-letter queue, and
   * the age of the oldest waiting job per configured queue (`./queue-stats.ts`).
   */
  readStats(): Promise<QueueStatsSnapshot> {
    return readQueueStats(this.boss, this.schema, [...this.queues.keys()]);
  }

  /**
   * Cancel every unfinished (created, retry or active) job keyed to `userId` on every configured
   * queue and its DLQ (doc 06 §8 step 4). Returns the number of jobs cancelled. A cancelled
   * `active` job's handler runs to its end (pg-boss cannot interrupt it), but its outcome is
   * dropped: it can neither complete nor fail into a retry. Later sends for the user are still
   * accepted; `cancelUser` also refuses those.
   */
  async cancelPendingForUser(userId: string): Promise<number> {
    if (!isId(userId, 'user')) {
      throw new TypeError('PgBossQueue.cancelPendingForUser: userId must be a usr_ id');
    }
    let cancelled = 0;
    for (const name of this.queues.keys()) {
      for (const queue of [name, deadLetterQueueName(name)]) {
        const keyed = await this.boss.findJobs(queue, { key: userId });
        const ids = keyed.filter((job) => UNFINISHED_STATES.has(job.state)).map((job) => job.id);
        for (let start = 0; start < ids.length; start += CANCEL_CHUNK_SIZE) {
          await this.boss.cancel(queue, ids.slice(start, start + CANCEL_CHUNK_SIZE));
        }
        if (ids.length > 0) {
          this.logger.info({ queue, jobs: ids.length }, 'pending jobs cancelled');
        }
        cancelled += ids.length;
      }
    }
    return cancelled;
  }

  /**
   * Deletion-shaped cancellation (doc 06 §8 step 4): durably mark `userId` as cancelled, then
   * `cancelPendingForUser`. From the moment this resolves no job keyed to the user reaches a
   * handler on any instance: `send` inserts nothing for the user and `work` cancels any job for
   * the user it fetches (a send that raced the marker). The marker is written first, so every
   * send either sees it or inserted a job the cancel sweep finds. Idempotent; returns the number
   * of jobs cancelled by the sweep. The marker lasts `CANCELLED_USER_MARKER_RETENTION_SECONDS`
   * (100 days) from its first write; a repeat call does not extend it.
   */
  async cancelUser(userId: string): Promise<number> {
    if (!isId(userId, 'user')) {
      throw new TypeError('PgBossQueue.cancelUser: userId must be a usr_ id');
    }
    await this.boss.send(CANCELLED_USERS_QUEUE, {}, { id: cancelledUserMarkerId(userId) });
    return this.cancelPendingForUser(userId);
  }

  private async isUserCancelled(userId: string): Promise<boolean> {
    const markers = await this.boss.findJobs(CANCELLED_USERS_QUEUE, {
      id: cancelledUserMarkerId(userId),
    });
    return markers.length > 0;
  }

  private requireQueue(queue: string): QueueDefinition {
    const definition = this.queues.get(queue);
    if (definition === undefined) {
      throw new TypeError(`PgBossQueue: unknown queue '${queue}'`);
    }
    return definition;
  }
}
