// `demo.outbox-flow` job handler (P02-T08): the consumer end of the API → outbox → pg-boss →
// worker round-trip. Translation only: parse the envelope with the contract types, call the
// segmentation worker at most once per event id, report the outcome to pg-boss. No business rule.
import type { Logger } from 'pino';
import { z } from 'zod';

import type {
  DemoOutboxFlowRequestedV1,
  EventEnvelope as ContractEventEnvelope,
} from '@ai-stylist/contracts/events';
import { isId } from '@ai-stylist/shared-kernel';

import { type JobHandler, type PgIdempotencyGuard } from '../platform/index.js';

import { DEMO_OUTBOX_FLOW_EVENT_TYPE, DEMO_OUTBOX_FLOW_QUEUE } from './queues.js';
import { type SegmentRequest, type SegmentationClient } from './segmentation-client.js';

/** Idempotency scope of this consumer in `platform_idempotency_keys`. */
export const DEMO_OUTBOX_FLOW_SCOPE = `job:${DEMO_OUTBOX_FLOW_QUEUE.name}`;

/**
 * How long a handled event id blocks a repeat: 90 days, the outbox replay window (doc 04 §9.2
 * "Replay: re-dispatch from `outbox` (retained 90 days) … Replays carry the original event id").
 * A replay inside the window is a no-op; P02-T08 lead decision.
 */
export const DEMO_OUTBOX_FLOW_RETENTION_SECONDS = 90 * 24 * 60 * 60;

/**
 * The demo event carries no image; the P02 segmentation stub only echoes the reference. No object
 * exists under this key.
 */
export const DEMO_IMAGE_REF = 'demo/outbox-flow';

/**
 * Envelope (packages/contracts/events/envelope.json) narrowed by demo.event.json. Unknown envelope
 * fields are tolerated (envelope.json: "consumers must tolerate unknown fields"); unknown payload
 * fields are rejected (demo.event.json: `additionalProperties: false`). `satisfies` pins the parsed
 * shape to the generated contract types, so a new required contract field fails `just typecheck`.
 */
const demoEnvelopeSchema = z.looseObject({
  id: z.string().refine((value) => isId(value, 'event')),
  type: z.literal(DEMO_OUTBOX_FLOW_EVENT_TYPE),
  occurredAt: z.iso.datetime({ offset: true }),
  producer: z.string().regex(/^[a-z][a-z-]*$/),
  aggregate: z.looseObject({ kind: z.string().regex(/^[a-z][a-z0-9_]*$/), id: z.string() }),
  sequence: z.number().int().min(0),
  actor: z.looseObject({
    kind: z.enum(['user', 'system', 'admin', 'job']),
    id: z.string().exactOptional(),
  }),
  correlationId: z.string().min(1),
  causationId: z.string().exactOptional(),
  consentScope: z.string().exactOptional(),
  payload: z.strictObject({
    demoId: z.string(),
    requestedAt: z.iso.datetime({ offset: true }),
    note: z.string().max(200).exactOptional(),
  }),
}) satisfies z.ZodType<ContractEventEnvelope & DemoOutboxFlowRequestedV1>;

export type DemoOutboxFlowEnvelope = z.infer<typeof demoEnvelopeSchema>;

/** Job data is not a valid demo envelope. The message names paths only, never values. */
export class InvalidJobDataError extends Error {
  constructor(paths: readonly string[]) {
    super(`job data is not a valid ${DEMO_OUTBOX_FLOW_EVENT_TYPE} envelope: ${paths.join(', ')}`);
    this.name = 'InvalidJobDataError';
  }
}

export function parseDemoOutboxFlowEnvelope(data: unknown): DemoOutboxFlowEnvelope {
  const parsed = demoEnvelopeSchema.safeParse(data);
  if (!parsed.success) {
    throw new InvalidJobDataError(
      parsed.error.issues.map((issue) => issue.path.join('.') || '(root)'),
    );
  }
  return parsed.data;
}

/** The part of `PgIdempotencyGuard` this handler uses. */
export type EffectOnceGuard = Pick<PgIdempotencyGuard, 'runOnce'>;

export type DemoOutboxFlowHandlerDeps = {
  readonly guard: EffectOnceGuard;
  readonly segmentation: SegmentationClient;
  readonly logger: Logger;
};

/**
 * Resolve = handled (or already handled under this event id). Throw = failed attempt: pg-boss
 * retries with backoff, then dead-letters. Invalid data throws too, so it ends in the DLQ instead
 * of being dropped (doc 04 §9.2 "Nothing is silently dropped"). Logs ids, type and attempt only.
 */
export function createDemoOutboxFlowHandler(deps: DemoOutboxFlowHandlerDeps): JobHandler {
  const logger = deps.logger.child({ component: 'job.demo-outbox-flow' });
  return async (job) => {
    const envelope = parseDemoOutboxFlowEnvelope(job.data);
    const request: SegmentRequest = { request_id: envelope.id, image_ref: DEMO_IMAGE_REF };
    const result = await deps.guard.runOnce(
      {
        key: envelope.id,
        scope: DEMO_OUTBOX_FLOW_SCOPE,
        retentionSeconds: DEMO_OUTBOX_FLOW_RETENTION_SECONDS,
      },
      () => deps.segmentation.segment(request, job.signal),
    );
    logger.info(
      {
        jobId: job.id,
        eventId: envelope.id,
        eventType: envelope.type,
        attempt: job.attempt,
        ran: result.ran,
      },
      result.ran ? 'demo outbox flow handled' : 'demo outbox flow already handled',
    );
  };
}
