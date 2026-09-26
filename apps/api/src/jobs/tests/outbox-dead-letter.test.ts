// The dead-letter handler's translation: envelope id out of the dead-lettered job's data →
// `markFailed(eventId, 'job exhausted: <queue>')`. The real update and its idempotency run on
// Postgres in ../../platform/tests/outbox-dead-letter.docker.test.ts and the AC-2 acceptance test.
import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { newId } from '@ai-stylist/shared-kernel';
import { memoryLogStream } from '@ai-stylist/test-support';

import { loggerOptions } from '../../platform/logger.js';
import { type QueueJob } from '../../platform/queue/pg-boss-queue.js';
import {
  DeadLetterWithoutEventIdError,
  createOutboxDeadLetterHandler,
  jobExhaustedReason,
} from '../outbox-dead-letter.js';

const SOURCE = 'demo.outbox-flow';
const PAYLOAD_MARKER = 'payload-marker-5e10';

function job(data: unknown): QueueJob {
  return {
    id: 'job-1',
    queue: `${SOURCE}.dlq`,
    data,
    attempt: 1,
    signal: new AbortController().signal,
  };
}

describe('outbox dead-letter handler', () => {
  function setup() {
    const logs = memoryLogStream();
    const failed = new Set<string>();
    const calls: [string, string][] = [];
    const handler = createOutboxDeadLetterHandler({
      sourceQueue: SOURCE,
      // Structural stand-in for markOutboxFailed: true only on the first mark of an id.
      markFailed: (eventId, reason) => {
        calls.push([eventId, reason]);
        const changed = !failed.has(eventId);
        failed.add(eventId);
        return Promise.resolve(changed);
      },
      logger: pino(loggerOptions({ level: 'debug', service: 'api-test' }), logs),
    });
    return { logs, calls, handler };
  }

  it('marks the envelope’s outbox row failed with a payload-free reason, once per redelivery', async () => {
    const { logs, calls, handler } = setup();
    const eventId = newId('event');
    const data = { id: eventId, payload: { note: PAYLOAD_MARKER } };

    await handler(job(data));
    await handler(job(data));

    expect(calls).toEqual([
      [eventId, 'job exhausted: demo.outbox-flow'],
      [eventId, 'job exhausted: demo.outbox-flow'],
    ]);
    expect(jobExhaustedReason(SOURCE)).toBe('job exhausted: demo.outbox-flow');
    const marked = logs.records().filter((r) => r.component === 'job.outbox-dead-letter');
    expect(marked.map((r) => r.marked)).toEqual([true, false]);
    expect(logs.text()).not.toContain(PAYLOAD_MARKER);
  });

  it('throws, without marking anything, when the data carries no evt_ id', async () => {
    const { logs, calls, handler } = setup();
    for (const data of [null, 'evt', {}, { id: 42 }, { id: `usr_${PAYLOAD_MARKER}` }]) {
      await expect(handler(job(data))).rejects.toBeInstanceOf(DeadLetterWithoutEventIdError);
    }
    expect(calls).toEqual([]);
    expect(logs.text()).not.toContain(PAYLOAD_MARKER);
  });
});
