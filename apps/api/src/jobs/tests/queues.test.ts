// Queue definitions and the event-type → queue routing map the outbox relay shares.
import { describe, expect, it } from 'vitest';

import { DEMO_EVENT_TYPE } from '@ai-stylist/seed-data';

import {
  DEMO_OUTBOX_FLOW_EVENT_TYPE,
  DEMO_OUTBOX_FLOW_QUEUE,
  EVENT_QUEUE_ROUTES,
  JOB_QUEUES,
  queueForEventType,
} from '../index.js';

describe('job queues', () => {
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
});
