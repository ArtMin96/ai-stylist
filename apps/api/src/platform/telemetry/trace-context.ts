// Trace context across async hops (planning/14 §3): the W3C `traceparent` an outbox envelope
// carries, and the platform's manual spans (outbox dispatch, job processing). Uses only
// `@opentelemetry/api`: with telemetry off (no OTLP endpoint) every call here is a no-op
// (no propagator → no traceparent; no tracer provider → non-recording spans).
//
// Span attributes carry ids and enums only, the same redaction rules as logs (planning/11 §8): no
// payload, no error message (`recordSpanError` keeps the error class).
import {
  type Attributes,
  type Context,
  ROOT_CONTEXT,
  type Span,
  type SpanKind,
  SpanStatusCode,
  type Tracer,
  context,
  propagation,
  trace,
} from '@opentelemetry/api';

import { errorSummary } from '../errors/error-shape.js';

import { CORRELATION_ID_KEY, isValidCorrelationId, runWithCorrelationId } from './correlation.js';

/** Instrumentation scope of the platform's manual spans. */
export const PLATFORM_TRACER_NAME = '@ai-stylist/platform';

/** W3C Trace Context `traceparent`, as `EventEnvelope.traceparent` (envelope.json) constrains it. */
export const TRACEPARENT_PATTERN = /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/**
 * Attribute names of the platform's manual spans besides `correlation_id`. `messaging.*` are
 * OpenTelemetry messaging semantic conventions (development status, so copied here rather than
 * imported from the semantic-conventions `incubating` entry point); the rest are ours.
 */
export const SPAN_ATTRIBUTES = {
  messagingSystem: 'messaging.system',
  messagingOperationType: 'messaging.operation.type',
  messagingDestinationName: 'messaging.destination.name',
  messagingMessageId: 'messaging.message.id',
  outboxEventId: 'outbox.event.id',
  outboxEventType: 'outbox.event.type',
  jobAttempt: 'job.attempt',
  errorType: 'error.type',
} as const;

/** The trace context a queued message carries. Invalid values are ignored, never rejected. */
export type CarriedTraceContext = {
  /** W3C `traceparent` of the span that caused the work. */
  readonly traceparent?: string | undefined;
  /** Correlation id; a value `isValidCorrelationId` rejects is dropped. */
  readonly correlationId?: string | undefined;
};

export function platformTracer(): Tracer {
  return trace.getTracer(PLATFORM_TRACER_NAME);
}

/** `traceparent` of the active span, or `undefined` when nothing is traced. */
export function currentTraceparent(): string | undefined {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  const traceparent = carrier['traceparent'];
  return traceparent !== undefined && TRACEPARENT_PATTERN.test(traceparent)
    ? traceparent
    : undefined;
}

/**
 * The context to parent a span on: the remote span `traceparent` names, or the root context (a new
 * trace) when it is absent or malformed. Never the ambient context: a queue worker's or the relay's
 * polling loop is not the cause of the work.
 */
export function contextFromTraceparent(traceparent: unknown): Context {
  if (typeof traceparent !== 'string' || !TRACEPARENT_PATTERN.test(traceparent)) {
    return ROOT_CONTEXT;
  }
  return propagation.extract(ROOT_CONTEXT, { traceparent });
}

/** `messaging.*` attributes of a pg-boss queue span. */
export function queueSpanAttributes(operation: 'send' | 'process', queue: string): Attributes {
  return {
    [SPAN_ATTRIBUTES.messagingSystem]: 'pg-boss',
    [SPAN_ATTRIBUTES.messagingOperationType]: operation,
    [SPAN_ATTRIBUTES.messagingDestinationName]: queue,
  };
}

/**
 * Mark `span` failed with the error class only: `error.type`, an `exception` event whose only
 * attribute is `exception.type`, and ERROR status without a message. A thrown message can quote
 * the payload (driver errors echo statement parameters), so it never reaches a span.
 */
export function recordSpanError(span: Span, error: unknown): void {
  const { errorName } = errorSummary(error);
  span.setAttribute(SPAN_ATTRIBUTES.errorType, errorName);
  span.recordException({ name: errorName });
  span.setStatus({ code: SpanStatusCode.ERROR });
}

/**
 * Run `work` in a `kind` span named `name`, parented on `carried.traceparent` (a new trace when
 * absent or malformed), tagged with `attributes` plus `correlation_id` when `carried` has a valid
 * one, and inside that correlation scope (every log line of `work` carries it). A throw marks the
 * span failed (`recordSpanError`) and propagates; the span always ends.
 */
export function runTraced<T>(
  name: string,
  kind: SpanKind,
  attributes: Attributes,
  carried: CarriedTraceContext | undefined,
  work: (span: Span) => Promise<T>,
): Promise<T> {
  const candidate = carried?.correlationId;
  const correlationId = isValidCorrelationId(candidate) ? candidate : undefined;
  const correlation = correlationId === undefined ? {} : { [CORRELATION_ID_KEY]: correlationId };
  const options = { kind, attributes: { ...attributes, ...correlation } };
  const traced = async (span: Span): Promise<T> => {
    try {
      return await work(span);
    } catch (error) {
      recordSpanError(span, error);
      throw error;
    } finally {
      span.end();
    }
  };
  const parent = contextFromTraceparent(carried?.traceparent);
  return platformTracer().startActiveSpan(name, options, parent, (span) => {
    return runWithCorrelationId(correlationId, () => traced(span));
  });
}
