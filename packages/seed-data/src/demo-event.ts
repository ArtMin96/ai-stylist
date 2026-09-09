import type { DemoOutboxFlowRequestedV1Payload } from '@ai-stylist/contracts/events';
import type { EventEnvelope } from '@ai-stylist/shared-kernel';

import { type SyntheticRandom, syntheticRandom } from './random.js';

export const DEMO_EVENT_TYPE = 'demo.outbox-flow.requested.v1' as const;

export type DemoEvent = EventEnvelope<typeof DEMO_EVENT_TYPE, DemoOutboxFlowRequestedV1Payload>;

export type DemoEventOverrides = Partial<Omit<DemoEvent, 'type' | 'payload'>> & {
  readonly payload?: Partial<DemoOutboxFlowRequestedV1Payload>;
};

/**
 * A valid `demo.outbox-flow.requested.v1` envelope (packages/contracts/events/demo.event.json).
 * Deterministic for a given `random`; the payload never carries anything sensitive.
 */
export function demoEvent(
  overrides: DemoEventOverrides = {},
  random: SyntheticRandom = syntheticRandom(),
): DemoEvent {
  const occurredAt =
    overrides.occurredAt ??
    random.faker.date.recent({ days: 1, refDate: random.refDate }).toISOString();
  const demoId = overrides.payload?.demoId ?? `demo-${random.faker.string.alphanumeric(8)}`;
  const { payload: payloadOverrides, ...envelopeOverrides } = overrides;
  return {
    id: random.id('event', new Date(occurredAt)),
    type: DEMO_EVENT_TYPE,
    occurredAt,
    producer: 'platform',
    aggregate: { kind: 'demo_run', id: demoId },
    sequence: 1,
    actor: { kind: 'system' },
    correlationId: random.faker.string.uuid(),
    ...envelopeOverrides,
    payload: {
      demoId,
      requestedAt: occurredAt,
      note: random.faker.hacker.phrase().slice(0, 200),
      ...payloadOverrides,
    },
  };
}
