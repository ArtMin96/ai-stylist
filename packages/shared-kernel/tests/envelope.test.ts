import { describe, expectTypeOf, it } from 'vitest';

import {
  type ActorKind,
  type EventEnvelope,
  type EventType,
  type Id,
  newId,
} from '../src/index.js';

describe('EventEnvelope (type-level)', () => {
  it('has exactly the doc 06 §4 fields', () => {
    expectTypeOf<keyof EventEnvelope>().toEqualTypeOf<
      | 'id'
      | 'type'
      | 'occurredAt'
      | 'producer'
      | 'aggregate'
      | 'sequence'
      | 'actor'
      | 'correlationId'
      | 'causationId'
      | 'consentScope'
      | 'payload'
    >();
    expectTypeOf<EventEnvelope['id']>().toEqualTypeOf<Id<'event'>>();
    expectTypeOf<EventEnvelope['sequence']>().toBeNumber();
    expectTypeOf<EventEnvelope['actor']['kind']>().toEqualTypeOf<ActorKind>();
    expectTypeOf<EventEnvelope['aggregate']>().toEqualTypeOf<{
      readonly kind: string;
      readonly id: string;
    }>();
  });

  it('constrains `type` to <module>.<entity>.<action>.v<N>', () => {
    expectTypeOf<'closet.item.created.v1'>().toExtend<EventType>();
    expectTypeOf<'demo.outbox-flow.requested.v1'>().toExtend<EventType>();
    expectTypeOf<'closet.item.created'>().not.toExtend<EventType>();
  });

  it('accepts a well-formed value and narrows the payload', () => {
    const envelope: EventEnvelope<'demo.outbox-flow.requested.v1', { readonly note: string }> = {
      id: newId('event'),
      type: 'demo.outbox-flow.requested.v1',
      occurredAt: '2026-09-10T12:00:00Z',
      producer: 'platform',
      aggregate: { kind: 'demo', id: 'demo_1' },
      sequence: 1,
      actor: { kind: 'system' },
      correlationId: 'corr-1',
      payload: { note: 'hello' },
    };
    expectTypeOf(envelope.payload.note).toBeString();
  });
});
