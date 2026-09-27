// What a composition root declares per pg-boss queue, and the dead-letter naming rule. Split from
// ./pg-boss-queue.ts (which re-exports all of it) so ./queue-stats.ts can use them without a cycle.

/** One application queue. Every queue gets a dead-letter queue named `deadLetterQueueName(name)`. */
export type QueueDefinition = {
  /** pg-boss queue name: letters, digits, `_`, `-`, `.`, `/`. */
  readonly name: string;
  /** Retries after the first attempt; a job runs at most `retryLimit + 1` times, then `failed`. */
  readonly retryLimit: number;
  /** Base of the exponential, jittered retry backoff (pg-boss `retryDelay`, seconds, >= 1). */
  readonly retryDelaySeconds: number;
  /** Upper bound of one backoff delay (pg-boss `retryDelayMax`, seconds). */
  readonly retryDelayMaxSeconds: number;
  /** Seconds a job may stay `active` before it is failed (and retried). pg-boss default: 900. */
  readonly expireInSeconds?: number;
  /**
   * Jobs one worker fetches per poll, 1..`MAX_WORK_BATCH_SIZE`. Default 1. Above 1 the worker
   * fetches again at once, without the poll delay, while fetches come back full (pg-boss
   * `burstWhenBatchFull`); a short fetch resumes normal polling. The jobs of a batch still run one
   * at a time and settle one by one (pg-boss `perJobResults`): a failing job retries alone. The
   * whole batch shares one `expireInSeconds` deadline, so `batchSize` × the slowest job must stay
   * below it.
   */
  readonly batchSize?: number;
};

/** Upper bound on `QueueDefinition.batchSize` (the outbox relay's per-poll cap, doc 04 §9). */
export const MAX_WORK_BATCH_SIZE = 100;

export function deadLetterQueueName(queue: string): string {
  return `${queue}.dlq`;
}
