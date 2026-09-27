// Composition root for pg-boss job handlers (doc 04 §5): constructs the queue, the effect-once
// guard and the worker clients, and registers each handler on its queue. Handlers stay thin and
// import public module APIs only. The process entry is `./main.ts`; tests may call `startJobs`.
// Queue metrics (planning/14 §4): each worker's handler is wrapped to count its outcomes, each DLQ
// worker's to count dead letters, and the queue gauges read pg-boss at every metric collection.
import type { Meter } from '@opentelemetry/api';
import postgres from 'postgres';
import type { Logger } from 'pino';

import {
  CircuitBreaker,
  PgBossQueue,
  PgIdempotencyGuard,
  QueueMetrics,
  SystemClock,
  markOutboxFailed,
} from '../platform/index.js';

import { createDemoOutboxFlowHandler } from './demo-outbox-flow.js';
import { createOutboxDeadLetterHandler } from './outbox-dead-letter.js';
import {
  DEMO_OUTBOX_FLOW_QUEUE,
  JOB_QUEUES,
  OUTBOX_DEAD_LETTER_QUEUES,
  envelopeTraceContext,
} from './queues.js';
import { HttpSegmentationClient } from './segmentation-client.js';

export {
  DEMO_OUTBOX_FLOW_EVENT_TYPE,
  DEMO_OUTBOX_FLOW_QUEUE,
  EVENT_QUEUE_ROUTES,
  JOB_QUEUES,
  OUTBOX_DEAD_LETTER_QUEUES,
  envelopeTraceContext,
  queueForEventType,
  userIdOf,
} from './queues.js';

/** One segmentation call, including reading the reply. The P02 stub answers in milliseconds. */
export const SEGMENTATION_TIMEOUT_MS = 10_000;
/** Consecutive worker failures that open the circuit, and how long it stays open. */
export const SEGMENTATION_BREAKER = { failureThreshold: 5, coolDownMs: 30_000 } as const;
/**
 * Pool for the effect-once guard and the dead-letter handlers. The claim holds one connection
 * while the effect runs (one worker runs one job at a time: `PgBossQueue.work` runs a fetched
 * batch sequentially); each dead-letter worker runs one single-statement update at a time. 3
 * leaves one spare.
 */
const POOL_MAX = 3;

export type JobsConfig = {
  /** Postgres the pg-boss schema and `platform_idempotency_keys` live in (`just db-migrate`). */
  readonly databaseUrl: string;
  /** Segmentation worker origin, e.g. `http://127.0.0.1:8001`. */
  readonly segmentationBaseUrl: string;
  /** pino logger built from `loggerOptions()` (apps/api/src/platform/logger.ts). */
  readonly logger: Logger;
  /** pg-boss poll interval, seconds (>= 0.5). Default 2. */
  readonly pollingIntervalSeconds?: number;
  /**
   * Tests only: the meter of the `stylist.queue.*` instruments. Default: the global meter the
   * telemetry `--import` entry installs (a no-op without it).
   */
  readonly meter?: Meter;
};

export type RunningJobs = {
  /** Graceful: waits for active jobs (bounded by the queue's stop timeout), then closes pools. */
  stop(): Promise<void>;
};

export async function startJobs(config: JobsConfig): Promise<RunningJobs> {
  const sql = postgres(config.databaseUrl, { max: POOL_MAX });
  const queue = new PgBossQueue({
    connectionString: config.databaseUrl,
    queues: JOB_QUEUES,
    logger: config.logger,
    // Each job joins its envelope's trace and correlation scope (doc 14 §2–§3).
    traceContextOf: envelopeTraceContext,
    ...(config.pollingIntervalSeconds !== undefined
      ? { pollingIntervalSeconds: config.pollingIntervalSeconds }
      : {}),
  });
  const segmentation = new HttpSegmentationClient({
    baseUrl: config.segmentationBaseUrl,
    timeoutMs: SEGMENTATION_TIMEOUT_MS,
    breaker: new CircuitBreaker(new SystemClock(), SEGMENTATION_BREAKER),
  });
  const guard = new PgIdempotencyGuard(sql);
  const metrics = new QueueMetrics({
    jobTypes: JOB_QUEUES.map((definition) => definition.name),
    deadLetterSources: OUTBOX_DEAD_LETTER_QUEUES.map((entry) => entry.source),
    logger: config.logger,
    ...(config.meter !== undefined ? { meter: config.meter } : {}),
  });
  let stopObservingQueues: (() => void) | undefined;

  let stopped: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    stopped ??= (async () => {
      // First: a metric collection must not read a stopping pg-boss.
      stopObservingQueues?.();
      try {
        await queue.stop();
      } finally {
        await sql.end({ timeout: 5 });
      }
    })();
    return stopped;
  };

  try {
    await queue.start();
    stopObservingQueues = metrics.observeQueues(() => queue.readStats());
    await queue.work(
      DEMO_OUTBOX_FLOW_QUEUE.name,
      metrics.countOutcomes(
        DEMO_OUTBOX_FLOW_QUEUE,
        createDemoOutboxFlowHandler({ guard, segmentation, logger: config.logger }),
      ),
    );
    // Doc 04 §9.2: an exhausted job lands in its DLQ and its outbox row is marked `failed`.
    for (const { source, deadLetter } of OUTBOX_DEAD_LETTER_QUEUES) {
      const handler = createOutboxDeadLetterHandler({
        sourceQueue: source,
        markFailed: (eventId, reason) => markOutboxFailed(sql, eventId, reason),
        logger: config.logger,
      });
      await queue.work(
        deadLetter.name,
        metrics.countOutcomes(deadLetter, metrics.countDeadLetters(source, handler)),
      );
    }
  } catch (error) {
    await stop().catch(() => undefined); // the start failure is the error worth reporting
    throw error;
  }
  config.logger.info({ queues: JOB_QUEUES.map((q) => q.name) }, 'jobs started');
  return { stop };
}
