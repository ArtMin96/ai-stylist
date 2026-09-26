// Composition root for pg-boss job handlers (doc 04 §5): constructs the queue, the effect-once
// guard and the worker clients, and registers each handler on its queue. Handlers stay thin and
// import public module APIs only. The process entry is `./main.ts`; tests may call `startJobs`.
import postgres from 'postgres';
import type { Logger } from 'pino';

import { CircuitBreaker, PgBossQueue, PgIdempotencyGuard, SystemClock } from '../platform/index.js';

import { createDemoOutboxFlowHandler } from './demo-outbox-flow.js';
import { DEMO_OUTBOX_FLOW_QUEUE, JOB_QUEUES } from './queues.js';
import { HttpSegmentationClient } from './segmentation-client.js';

export {
  DEMO_OUTBOX_FLOW_EVENT_TYPE,
  DEMO_OUTBOX_FLOW_QUEUE,
  EVENT_QUEUE_ROUTES,
  JOB_QUEUES,
  queueForEventType,
} from './queues.js';

/** One segmentation call, including reading the reply. The P02 stub answers in milliseconds. */
export const SEGMENTATION_TIMEOUT_MS = 10_000;
/** Consecutive worker failures that open the circuit, and how long it stays open. */
export const SEGMENTATION_BREAKER = { failureThreshold: 5, coolDownMs: 30_000 } as const;
/**
 * Pool for the effect-once guard. The claim holds one connection while the effect runs, one
 * worker runs one job at a time (`PgBossQueue.work` runs a fetched batch sequentially), so 2
 * leaves one spare.
 */
const GUARD_POOL_MAX = 2;

export type JobsConfig = {
  /** Postgres the pg-boss schema and `platform_idempotency_keys` live in (`just db-migrate`). */
  readonly databaseUrl: string;
  /** Segmentation worker origin, e.g. `http://127.0.0.1:8001`. */
  readonly segmentationBaseUrl: string;
  /** pino logger built from `loggerOptions()` (apps/api/src/platform/logger.ts). */
  readonly logger: Logger;
  /** pg-boss poll interval, seconds (>= 0.5). Default 2. */
  readonly pollingIntervalSeconds?: number;
};

export type RunningJobs = {
  /** Graceful: waits for active jobs (bounded by the queue's stop timeout), then closes pools. */
  stop(): Promise<void>;
};

export async function startJobs(config: JobsConfig): Promise<RunningJobs> {
  const sql = postgres(config.databaseUrl, { max: GUARD_POOL_MAX });
  const queue = new PgBossQueue({
    connectionString: config.databaseUrl,
    queues: JOB_QUEUES,
    logger: config.logger,
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

  let stopped: Promise<void> | undefined;
  const stop = (): Promise<void> => {
    stopped ??= (async () => {
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
    await queue.work(
      DEMO_OUTBOX_FLOW_QUEUE.name,
      createDemoOutboxFlowHandler({ guard, segmentation, logger: config.logger }),
    );
  } catch (error) {
    await stop().catch(() => undefined); // the start failure is the error worth reporting
    throw error;
  }
  config.logger.info({ queues: JOB_QUEUES.map((q) => q.name) }, 'jobs started');
  return { stop };
}
