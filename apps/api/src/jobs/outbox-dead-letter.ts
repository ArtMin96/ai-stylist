// Dead-letter handler (doc 04 §9.2 "DLQ"): one worker per `<queue>.dlq` of an outbox-fed queue.
// Translation only: read the envelope id from the dead-lettered job's data and mark that outbox
// row `failed` with a payload-free reason, for the nightly DLQ sweep. No business rule.
import type { Logger } from 'pino';

import { isId } from '@ai-stylist/shared-kernel';

import { type JobHandler } from '../platform/index.js';

/** Dead-lettered job data carries no `evt_` envelope id. The message names no value. */
export class DeadLetterWithoutEventIdError extends Error {
  constructor(queue: string) {
    super(`dead-lettered job on ${queue} carries no envelope id`);
    this.name = 'DeadLetterWithoutEventIdError';
  }
}

/** The `last_error` stored for a job that exhausted its retries on `sourceQueue`. */
export function jobExhaustedReason(sourceQueue: string): string {
  return `job exhausted: ${sourceQueue}`;
}

export type OutboxDeadLetterHandlerDeps = {
  /** Queue whose exhausted jobs this DLQ receives (named in `last_error`). */
  readonly sourceQueue: string;
  /** `markOutboxFailed` bound to a pool (`../platform/outbox/outbox-dead-letter.ts`). */
  readonly markFailed: (eventId: string, reason: string) => Promise<boolean>;
  readonly logger: Logger;
};

/**
 * Resolve = the row is `failed` (now or already) or absent. Throw = the mark could not be written
 * (retried, then `<queue>.dlq.dlq`), or the data carries no event id: that dead letter matches no
 * outbox row and stays visible to ops in `<queue>.dlq.dlq` instead of being dropped. Logs ids only.
 */
export function createOutboxDeadLetterHandler(deps: OutboxDeadLetterHandlerDeps): JobHandler {
  const logger = deps.logger.child({ component: 'job.outbox-dead-letter' });
  const reason = jobExhaustedReason(deps.sourceQueue);
  return async (job) => {
    const data = job.data;
    const eventId = typeof data === 'object' && data !== null && 'id' in data ? data.id : undefined;
    if (typeof eventId !== 'string' || !isId(eventId, 'event')) {
      throw new DeadLetterWithoutEventIdError(job.queue);
    }
    const marked = await deps.markFailed(eventId, reason);
    const fields = { jobId: job.id, queue: job.queue, sourceQueue: deps.sourceQueue, eventId };
    if (marked) {
      logger.warn({ ...fields, marked }, 'outbox event marked failed; left for the DLQ sweep');
    } else {
      logger.warn({ ...fields, marked }, 'outbox event already failed or absent');
    }
  };
}
