// pg-boss queues and the event-type → queue routing map (doc 04 §9). Single source of truth: the
// job runtime (`./index.ts`) and the outbox relay's composition both import these values; nothing
// else declares a queue name or a route.
import { type QueueDefinition } from '../platform/index.js';

/** Event type the demo round-trip dispatches (packages/contracts/events/demo.event.json). */
export const DEMO_OUTBOX_FLOW_EVENT_TYPE = 'demo.outbox-flow.requested.v1' as const;

/**
 * P02 demo queue. Doc 04 §9.2 default: max 5 attempts (`retryLimit` 4 = 4 retries after the first
 * run), exponential jittered backoff from 1 s capped at 60 s, then `failed` + `<name>.dlq`.
 */
export const DEMO_OUTBOX_FLOW_QUEUE = {
  name: 'demo.outbox-flow',
  retryLimit: 4,
  retryDelaySeconds: 1,
  retryDelayMaxSeconds: 60,
} as const satisfies QueueDefinition;

/** Every queue the job runtime works; pass the same list to each `PgBossQueue` that sends to it. */
export const JOB_QUEUES: readonly QueueDefinition[] = [DEMO_OUTBOX_FLOW_QUEUE];

/** Outbox event `type` → pg-boss queue name. An event type missing here has no consumer. */
export const EVENT_QUEUE_ROUTES: Readonly<Record<string, string>> = Object.freeze({
  [DEMO_OUTBOX_FLOW_EVENT_TYPE]: DEMO_OUTBOX_FLOW_QUEUE.name,
});

/** Queue for an outbox event type, or `undefined` when no consumer is registered for it. */
export function queueForEventType(eventType: string): string | undefined {
  return Object.hasOwn(EVENT_QUEUE_ROUTES, eventType) ? EVENT_QUEUE_ROUTES[eventType] : undefined;
}
