// pg-boss queues and the event-type → queue routing map (doc 04 §9). Single source of truth: the
// job runtime (`./index.ts`) and the outbox relay's composition both import these values; nothing
// else declares a queue name or a route.
import type { DemoOutboxFlowRequestedV1 } from '@ai-stylist/contracts/events';

import {
  type OutboxEnvelope,
  type QueueDefinition,
  deadLetterQueueName,
} from '../platform/index.js';

/**
 * Event type the demo round-trip dispatches (packages/contracts/events/demo.event.json). The
 * `satisfies` pins it to the contract's `type` const, so a renamed event fails `just typecheck`.
 */
export const DEMO_OUTBOX_FLOW_EVENT_TYPE =
  'demo.outbox-flow.requested.v1' as const satisfies DemoOutboxFlowRequestedV1['type'];

/**
 * P02 demo queue. Doc 04 §9.2 default: max 5 attempts (`retryLimit` 4 = 4 retries after the first
 * run), exponential jittered backoff from 1 s capped at 60 s, then `failed` + `<name>.dlq`.
 * `batchSize` 10: with batch 1 pg-boss waits a poll interval (2 s) after every fetch, about 0.5
 * jobs/s; batches of 10 fetched back to back while backlog lasts clear the DEC-41 / A11 throughput
 * floor (apps/api/src/jobs/tests/acceptance-dispatch.docker.test.ts). Jobs still run one at a
 * time; worst case 10 × `SEGMENTATION_TIMEOUT_MS` (10 s) = 100 s, below the 900 s expiry.
 */
export const DEMO_OUTBOX_FLOW_QUEUE = {
  name: 'demo.outbox-flow',
  retryLimit: 4,
  retryDelaySeconds: 1,
  retryDelayMaxSeconds: 60,
  batchSize: 10,
} as const satisfies QueueDefinition;

/**
 * The worked dead-letter queue of `source` (doc 04 §9.2 "DLQ"): its handler marks the originating
 * outbox row `failed`. Default policy (5 attempts, 1–60 s backoff) so a transient database error
 * does not lose the mark; a dead letter that still fails lands in `<source>.dlq.dlq`, which
 * nothing works (left for ops).
 */
function workedDeadLetterQueue(source: QueueDefinition): QueueDefinition {
  return {
    name: deadLetterQueueName(source.name),
    retryLimit: 4,
    retryDelaySeconds: 1,
    retryDelayMaxSeconds: 60,
  };
}

/** Source queue → its worked DLQ, for every queue fed from the outbox. */
export const OUTBOX_DEAD_LETTER_QUEUES: readonly {
  readonly source: string;
  readonly deadLetter: QueueDefinition;
}[] = [
  {
    source: DEMO_OUTBOX_FLOW_QUEUE.name,
    deadLetter: workedDeadLetterQueue(DEMO_OUTBOX_FLOW_QUEUE),
  },
];

/**
 * Every queue the job runtime works, dead-letter queues included; pass the same list to each
 * `PgBossQueue` that sends to or works one of them.
 */
export const JOB_QUEUES: readonly QueueDefinition[] = [
  DEMO_OUTBOX_FLOW_QUEUE,
  ...OUTBOX_DEAD_LETTER_QUEUES.map((entry) => entry.deadLetter),
];

/**
 * Per-user keying policy (doc 06 §8 step 4): the pg-boss job key used for per-user cancellation
 * is the actor id of a user-caused event; system, admin and job events carry none. The outbox
 * relay's composition passes this as `OutboxRelay`'s `userIdOf`.
 */
export function userIdOf(envelope: OutboxEnvelope): string | undefined {
  return envelope.actor.kind === 'user' ? envelope.actor.id : undefined;
}

/** Outbox event `type` → pg-boss queue name. An event type missing here has no consumer. */
export const EVENT_QUEUE_ROUTES: Readonly<Record<string, string>> = Object.freeze({
  [DEMO_OUTBOX_FLOW_EVENT_TYPE]: DEMO_OUTBOX_FLOW_QUEUE.name,
});

/** Queue for an outbox event type, or `undefined` when no consumer is registered for it. */
export function queueForEventType(eventType: string): string | undefined {
  return Object.hasOwn(EVENT_QUEUE_ROUTES, eventType) ? EVENT_QUEUE_ROUTES[eventType] : undefined;
}
