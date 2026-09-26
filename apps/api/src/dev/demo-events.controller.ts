// Dev-only: POST /v1/dev/demo-events appends a fresh `demo.outbox-flow.requested.v1` envelope to
// `platform_outbox` through the OutboxWriter port; the outbox relay dispatches it to the
// `demo.outbox-flow` pg-boss job. Registered by the composition root only when
// `isDevRouteEnabled(config)`: NODE_ENV !== 'production' and APP_ENV is `local` or `dev`.
import { BadRequestException, Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';

import type { DemoOutboxFlowRequestedV1Payload } from '@ai-stylist/contracts/events';
import { type EventEnvelope, type ProblemFieldError, newId } from '@ai-stylist/shared-kernel';

import { CLOCK, type Clock } from '../platform/ports/clock.port.js';
import { OUTBOX_WRITER, type OutboxWriter } from '../platform/ports/outbox-writer.port.js';

export type DemoEventEnvelope = EventEnvelope<
  'demo.outbox-flow.requested.v1',
  DemoOutboxFlowRequestedV1Payload
>;

type DemoEventRequest = { demoId?: unknown; note?: unknown; correlationId?: unknown };

/** `note` is free text the contract caps (demo.event.json `maxLength: 200`): truncated. */
const NOTE_MAX = 200;

/**
 * `demoId` and `correlationId` are identifiers (the worker correlates its reply by `demoId`), so
 * an over-long one is rejected with a 400 problem, never truncated: truncation could merge two
 * distinct ids into one.
 */
export const DEMO_ID_MAX = 128;

/** A client-supplied id: absent/empty → undefined (the controller mints one); too long → error. */
function clientId(
  value: unknown,
  pointer: string,
  errors: ProblemFieldError[],
): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  if (value.length > DEMO_ID_MAX) {
    errors.push({ pointer, message: `must be at most ${DEMO_ID_MAX} characters` });
    return undefined;
  }
  return value;
}

@Controller('v1/dev/demo-events')
export class DemoEventsController {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
  ) {}

  @Post()
  @HttpCode(202)
  async request(@Body() body: DemoEventRequest | undefined): Promise<DemoEventEnvelope> {
    const errors: ProblemFieldError[] = [];
    const requestedDemoId = clientId(body?.demoId, '/demoId', errors);
    const requestedCorrelationId = clientId(body?.correlationId, '/correlationId', errors);
    if (errors.length > 0) {
      throw new BadRequestException({ detail: 'demo event request is invalid', errors });
    }
    const now = this.clock.now();
    const occurredAt = now.toISOString();
    const demoId = requestedDemoId ?? `demo-${now.getTime()}`;
    const note = typeof body?.note === 'string' ? body.note.slice(0, NOTE_MAX) : undefined;
    const correlationId = requestedCorrelationId ?? crypto.randomUUID();
    const envelope: DemoEventEnvelope = {
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
    await this.outbox.append(envelope);
    return envelope;
  }
}
