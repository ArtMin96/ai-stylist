// Dev-only: POST /v1/dev/demo-events appends a fresh `demo.outbox-flow.requested.v1` envelope to
// `platform_outbox` through the OutboxWriter port; the outbox relay dispatches it to the
// `demo.outbox-flow` pg-boss job. Registered by the composition root only when
// `isLocalOrDevDeployment(config)` (../config.ts): NODE_ENV !== 'production' and APP_ENV is
// `local` or `dev`.
// Gated by the `demo-outbox-flow` flag (registry `offBehavior`): off → 404, no outbox row.
// The envelope's `correlationId` is the request's (`x-correlation-id`, or the id the platform
// minted), so the envelope, the request's logs and span, and the response header carry one id.
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';

import type { DemoOutboxFlowRequestedV1Payload } from '@ai-stylist/contracts/events';
import {
  CLOCK,
  type Clock,
  type EventEnvelope,
  FEATURE_FLAGS,
  type FeatureFlags,
  OUTBOX_WRITER,
  type OutboxWriter,
  type ProblemFieldError,
  newId,
} from '@ai-stylist/shared-kernel';

export type DemoEventEnvelope = EventEnvelope<
  'demo.outbox-flow.requested.v1',
  DemoOutboxFlowRequestedV1Payload
>;

/**
 * The current request's correlation id (the platform's `currentCorrelationId`, bound by the
 * composition root: `src/dev` may not import platform).
 */
export type CurrentCorrelationId = () => string | undefined;
export const CURRENT_CORRELATION_ID = Symbol('CurrentCorrelationId');

/** The correlation id comes from the `x-correlation-id` header only, never from the body. */
type DemoEventRequest = { demoId?: unknown; note?: unknown };

/** `note` is free text the contract caps (demo.event.json `maxLength: 200`): truncated. */
const NOTE_MAX = 200;

/**
 * `demoId` is an identifier (the worker correlates its reply by `demoId`), so an over-long one is
 * rejected with a 400 problem, never truncated: truncation could merge two distinct ids into one.
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
    @Inject(FEATURE_FLAGS) private readonly flags: FeatureFlags,
    @Inject(CURRENT_CORRELATION_ID) private readonly correlationId: CurrentCorrelationId,
  ) {}

  @Post()
  @HttpCode(202)
  async request(@Body() body: DemoEventRequest | undefined): Promise<DemoEventEnvelope> {
    if (!(await this.flags.isEnabled('demo-outbox-flow'))) throw new NotFoundException();
    const errors: ProblemFieldError[] = [];
    const requestedDemoId = clientId(body?.demoId, '/demoId', errors);
    if (errors.length > 0) {
      throw new BadRequestException({ detail: 'demo event request is invalid', errors });
    }
    const correlationId = this.correlationId();
    if (correlationId === undefined) {
      // A wiring fault (createApp installs the correlation hooks), never minted here: a second id
      // would split the envelope from the request's logs, span and response header.
      throw new Error('no correlation scope: registerCorrelationId is not installed');
    }
    const now = this.clock.now();
    const occurredAt = now.toISOString();
    const demoId = requestedDemoId ?? `demo-${now.getTime()}`;
    const note = typeof body?.note === 'string' ? body.note.slice(0, NOTE_MAX) : undefined;
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
