// Dev-only: POST /v1/dev/demo-events returns a fresh `demo.outbox-flow.requested.v1` envelope.
// Registered by the composition root only when NODE_ENV !== 'production'.
// TODO(P02 T08): persist the envelope to platform_outbox in a transaction so the relay dispatches
// it to the demo pg-boss job; until then nothing is stored.
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';

import type { DemoOutboxFlowRequestedV1Payload } from '@ai-stylist/contracts/events';
import { type EventEnvelope, newId } from '@ai-stylist/shared-kernel';

import { CLOCK, type Clock } from '../platform/ports/clock.port.js';

export type DemoEventEnvelope = EventEnvelope<
  'demo.outbox-flow.requested.v1',
  DemoOutboxFlowRequestedV1Payload
>;

type DemoEventRequest = { demoId?: unknown; note?: unknown; correlationId?: unknown };

@Controller('v1/dev/demo-events')
export class DemoEventsController {
  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  @Post()
  @HttpCode(202)
  request(@Body() body: DemoEventRequest | undefined): DemoEventEnvelope {
    const now = this.clock.now();
    const occurredAt = now.toISOString();
    const demoId =
      typeof body?.demoId === 'string' && body.demoId !== ''
        ? body.demoId
        : `demo-${now.getTime()}`;
    const note = typeof body?.note === 'string' ? body.note.slice(0, 200) : undefined;
    const correlationId =
      typeof body?.correlationId === 'string' && body.correlationId !== ''
        ? body.correlationId
        : crypto.randomUUID();
    return {
      id: newId('event', now.getTime()),
      type: 'demo.outbox-flow.requested.v1',
      occurredAt,
      producer: 'platform',
      aggregate: { kind: 'demo_run', id: demoId },
      sequence: 1,
      actor: { kind: 'system' },
      correlationId,
      payload: { demoId, requestedAt: occurredAt, ...(note !== undefined ? { note } : {}) },
    };
  }
}
