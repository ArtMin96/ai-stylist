// `demo.outbox-flow` job handler (P02-T08): the consumer end of the API → outbox → pg-boss →
// worker round-trip. Translation only: parse the envelope with the contract types, call the
// segmentation worker at most once per event id, report the outcome to pg-boss. No business rule.
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { Logger } from 'pino';

import type {
  DemoOutboxFlowRequestedV1,
  EventEnvelope as ContractEventEnvelope,
} from '@ai-stylist/contracts/events';
import demoEventSchema from '@ai-stylist/contracts/events/demo.event.json' with { type: 'json' };
import envelopeSchema from '@ai-stylist/contracts/events/envelope.json' with { type: 'json' };

import { type JobHandler, type PgIdempotencyGuard, childLogger } from '../platform/index.js';

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

/** The envelope (envelope.json) narrowed by demo.event.json, as generated from the contract. */
export type DemoOutboxFlowEnvelope = ContractEventEnvelope & DemoOutboxFlowRequestedV1;

/**
 * Validators compiled once, at module load, from the contract JSON Schemas themselves (the Ajv
 * 2020-12 setup of packages/contracts/tests/events.test.ts), so a contract change applies here
 * with nothing to copy. Whatever the contract says holds: today unknown envelope fields are
 * tolerated (envelope.json: "consumers must tolerate unknown fields") and unknown payload fields
 * are rejected (demo.event.json: `additionalProperties: false`).
 */
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
const validateEnvelope: ValidateFunction<ContractEventEnvelope> = ajv.compile(envelopeSchema);
const validateDemoEvent: ValidateFunction<DemoOutboxFlowRequestedV1> = ajv.compile(demoEventSchema);

/** Ajv error → dotted field path (`payload.note`, `correlationId`); never the offending value. */
function errorPath(error: ErrorObject): string {
  const segments = error.instancePath
    .split('/')
    .slice(1)
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
  const params = error.params as { missingProperty?: unknown; additionalProperty?: unknown };
  const child = params.missingProperty ?? params.additionalProperty;
  if (typeof child === 'string') segments.push(child);
  return segments.join('.') || '(root)';
}

/** Job data is not a valid demo envelope. The message names paths only, never values. */
export class InvalidJobDataError extends Error {
  constructor(paths: readonly string[]) {
    super(`job data is not a valid ${DEMO_OUTBOX_FLOW_EVENT_TYPE} envelope: ${paths.join(', ')}`);
    this.name = 'InvalidJobDataError';
  }
}

export function parseDemoOutboxFlowEnvelope(data: unknown): DemoOutboxFlowEnvelope {
  // Both validators always run, so the error names every failing path of either schema.
  const envelopeValid = validateEnvelope(data);
  const envelopeErrors = validateEnvelope.errors ?? [];
  const demoValid = validateDemoEvent(data);
  const demoErrors = validateDemoEvent.errors ?? [];
  if (!envelopeValid || !demoValid) {
    throw new InvalidJobDataError([...new Set([...envelopeErrors, ...demoErrors].map(errorPath))]);
  }
  return data;
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
  const logger = childLogger(deps.logger, { component: 'job.demo-outbox-flow' });
  return async (job) => {
    const envelope = parseDemoOutboxFlowEnvelope(job.data);
    const request: SegmentRequest = { request_id: envelope.id, image_ref: DEMO_IMAGE_REF };
    // The worker gets the envelope's correlation id as `x-correlation-id` (planning/14 §2).
    const call = { signal: job.signal, correlationId: envelope.correlationId };
    const result = await deps.guard.runOnce(
      {
        key: envelope.id,
        scope: DEMO_OUTBOX_FLOW_SCOPE,
        retentionSeconds: DEMO_OUTBOX_FLOW_RETENTION_SECONDS,
      },
      () => deps.segmentation.segment(request, call),
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
