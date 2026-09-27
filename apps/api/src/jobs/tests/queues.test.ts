// Queue definitions and the event-type → queue routing map the outbox relay shares.
import { describe, expect, it } from 'vitest';

import pino from 'pino';

import { newId } from '@ai-stylist/shared-kernel';
import { DEMO_EVENT_TYPE, demoEvent, syntheticRandom } from '@ai-stylist/seed-data';

import {
  MAX_WORK_BATCH_SIZE,
  PgBossQueue,
  type QueueDefinition,
  deadLetterQueueName,
} from '../../platform/queue/pg-boss-queue.js';
import {
  DEMO_OUTBOX_FLOW_EVENT_TYPE,
  DEMO_OUTBOX_FLOW_QUEUE,
  EVENT_QUEUE_ROUTES,
  JOB_QUEUES,
  OUTBOX_DEAD_LETTER_QUEUES,
  SEGMENTATION_TIMEOUT_MS,
  envelopeTraceContext,
  queueForEventType,
  userIdOf,
} from '../index.js';

describe('job queues', () => {
  it('works the DLQ of every outbox-fed queue, with bounded retries (doc 04 §9.2)', () => {
    const worked = new Set(JOB_QUEUES.map((queue) => queue.name));
    const routed = new Set(Object.values(EVENT_QUEUE_ROUTES));
    const sources = OUTBOX_DEAD_LETTER_QUEUES.map((entry) => entry.source);
    expect(new Set(sources)).toEqual(routed);
    for (const { source, deadLetter } of OUTBOX_DEAD_LETTER_QUEUES) {
      expect(deadLetter.name).toBe(deadLetterQueueName(source));
      expect(worked.has(deadLetter.name)).toBe(true);
      expect(deadLetter.retryLimit + 1).toBe(5);
      expect(deadLetter.retryDelayMaxSeconds).toBe(60);
    }
  });

  it('keys a job to the user only for a user-caused event', () => {
    const random = syntheticRandom();
    const userId = newId('user');
    expect(userIdOf(demoEvent({ actor: { kind: 'user', id: userId } }, random))).toBe(userId);
    expect(userIdOf(demoEvent({ actor: { kind: 'system' } }, random))).toBeUndefined();
    const admin = demoEvent({ actor: { kind: 'admin', id: newId('user') } }, random);
    expect(userIdOf(admin)).toBeUndefined();
  });

  it("reads a job's trace context from its envelope, without throwing on other data", () => {
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const event = demoEvent({ correlationId: 'corr-1', traceparent }, syntheticRandom());
    expect(envelopeTraceContext(event)).toEqual({ traceparent, correlationId: 'corr-1' });
    expect(envelopeTraceContext({ correlationId: 7, traceparent: null })).toEqual({});
    for (const data of [null, 'evt', 42, undefined]) {
      expect(envelopeTraceContext(data)).toBeUndefined();
    }
  });

  it('routes demo.outbox-flow.requested.v1 to the demo.outbox-flow queue', () => {
    expect(DEMO_OUTBOX_FLOW_EVENT_TYPE).toBe(DEMO_EVENT_TYPE);
    expect(queueForEventType(DEMO_EVENT_TYPE)).toBe('demo.outbox-flow');
  });

  it('has no route for an unknown or inherited key', () => {
    expect(queueForEventType('closet.item.created.v1')).toBeUndefined();
    expect(queueForEventType('toString')).toBeUndefined();
  });

  it('routes only to declared queues', () => {
    const declared = new Set(JOB_QUEUES.map((queue) => queue.name));
    for (const queue of Object.values(EVENT_QUEUE_ROUTES)) {
      expect(declared.has(queue)).toBe(true);
    }
  });

  it('allows 5 attempts with 1–60 s backoff (doc 04 §9.2 default)', () => {
    expect(DEMO_OUTBOX_FLOW_QUEUE.retryLimit + 1).toBe(5);
    expect(DEMO_OUTBOX_FLOW_QUEUE.retryDelaySeconds).toBe(1);
    expect(DEMO_OUTBOX_FLOW_QUEUE.retryDelayMaxSeconds).toBe(60);
  });

  it('fetches the demo queue in bounded batches that finish inside the job expiry', () => {
    const { batchSize } = DEMO_OUTBOX_FLOW_QUEUE;
    // Batch 1 waits a poll interval after every fetch (≈0.5 jobs/s at the 2 s default).
    expect(batchSize).toBeGreaterThan(1);
    expect(batchSize).toBeLessThanOrEqual(MAX_WORK_BATCH_SIZE);
    // Jobs of a batch run one after another under one expiry (pg-boss default 900 s).
    expect((batchSize * SEGMENTATION_TIMEOUT_MS) / 1000).toBeLessThan(900);
  });

  it('rejects a batch size outside 1..MAX_WORK_BATCH_SIZE', () => {
    const construct = (batchSize: number) => {
      const queue: QueueDefinition = { ...DEMO_OUTBOX_FLOW_QUEUE, batchSize };
      return new PgBossQueue({
        connectionString: 'postgres://unused@127.0.0.1:1/unused',
        queues: [queue],
        logger: pino({ level: 'silent' }),
      });
    };
    for (const bad of [0, 1.5, MAX_WORK_BATCH_SIZE + 1]) {
      expect(() => construct(bad)).toThrow(RangeError);
    }
    expect(() => construct(1)).not.toThrow();
    expect(() => construct(MAX_WORK_BATCH_SIZE)).not.toThrow();
  });
});
