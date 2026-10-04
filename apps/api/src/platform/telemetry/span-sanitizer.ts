// Span redaction before export (planning/14 §3: span attributes carry ids and enums only, the same
// redaction rules as logs, planning/11 §8). The OSS instrumentations record things our rules
// forbid: query strings (`url.query`, the query part of `url.full` / `url.path`; signed URLs carry
// credentials), client IPs and user agents, error messages in span status and `exception` events
// (driver messages echo statement parameters), and an `exception.type` taken from a free-text
// `err.code` or `err.name`. `SanitizingSpanExporter` wraps the real exporter and
// hands it copies without them. Our own spans already comply (./trace-context.ts); this is the
// backstop for everything else. Translation only: no span is dropped, no id or enum is changed.
//
// One attribute rule, `sanitizeAttributes`, covers span, event and link attributes here and the
// process resource in ./telemetry.ts. The resource is not sanitized per span: metrics and log
// records carry it too and never pass through this exporter, so it is sanitized where it is built.
import type { Attributes, AttributeValue } from '@opentelemetry/api';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import {
  ATTR_CLIENT_ADDRESS,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
  ATTR_NETWORK_PEER_ADDRESS,
  ATTR_URL_FULL,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_USER_AGENT_ORIGINAL,
} from '@opentelemetry/semantic-conventions';

import { LOG_REDACTION_RULES } from '@ai-stylist/shared-kernel';

import { REDACTED, isForbiddenLogKey, stripQuery } from '../logger.js';

/** The SDK's exporter and span types, taken from `NodeSDK`'s own configuration type. */
export type SpanExporter = NodeSDKConfiguration['traceExporter'];
export type ExportedSpan = Parameters<SpanExporter['export']>[0][number];
type TimedEvent = ExportedSpan['events'][number];
type Link = ExportedSpan['links'][number];

/** Dropped wherever `sanitizeAttributes` applies: free text, network identity or error detail. */
const DROPPED_ATTRIBUTES: ReadonlySet<string> = new Set([
  ATTR_URL_QUERY,
  ATTR_CLIENT_ADDRESS,
  ATTR_NETWORK_PEER_ADDRESS,
  ATTR_USER_AGENT_ORIGINAL,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
]);

/**
 * URL-valued attributes kept without their query and fragment (older names included): the logger's
 * `stripQuery`, the same cut as a logged request url.
 */
const URL_ATTRIBUTES: ReadonlySet<string> = new Set([
  ATTR_URL_FULL,
  ATTR_URL_PATH,
  'http.url',
  'http.target',
]);

/**
 * A URL attribute's value without query and fragment, whatever its shape: `stripQuery` on the
 * string, or on each string of an array. The value is cut, not dropped, so the path stays
 * searchable; numbers and booleans carry no query and pass.
 */
function cutUrlValue(value: AttributeValue): AttributeValue {
  if (typeof value === 'string') return stripQuery(value);
  if (!Array.isArray(value)) return value;
  const cut = value.map((item) => (typeof item === 'string' ? stripQuery(item) : item));
  // Each element keeps its type, so the array is still one of `AttributeValue`'s array types.
  return cut as AttributeValue;
}

/**
 * `exception.type` as the log `err.type` rule keeps it: OTel JS fills it from `String(err.code)`,
 * else `err.name`, and either can be free text. Kept when name-shaped (`TypeError`,
 * `grpc.ServiceError`) or code-shaped (`23505`, `ECONNREFUSED`): `errorNameShape` and `codeShape`
 * of `LOG_REDACTION_RULES`, the rules of ../errors/error-shape.ts. Anything else, a non-string
 * included, becomes `Error`.
 */
function exceptionType(value: AttributeValue): AttributeValue {
  const { errorNameShape, codeShape } = LOG_REDACTION_RULES;
  return typeof value === 'string' && (errorNameShape.test(value) || codeShape.test(value))
    ? value
    : 'Error';
}

/**
 * The attribute set a span, an event, a link or the process resource may carry. The log denylist
 * applies to the last dot-segment of the key (`http.request.header.authorization` is redacted,
 * `http.request.body.size` is kept).
 */
export function sanitizeAttributes(attributes: Attributes): Attributes {
  const out: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || DROPPED_ATTRIBUTES.has(key)) continue;
    const lastSegment = key.slice(key.lastIndexOf('.') + 1);
    if (isForbiddenLogKey(lastSegment)) out[key] = REDACTED;
    else if (key === ATTR_EXCEPTION_TYPE) out[key] = exceptionType(value);
    else out[key] = URL_ATTRIBUTES.has(key) ? cutUrlValue(value) : value;
  }
  return out;
}

/** The event name is cut like the span name: one named from a raw URL carries its query. */
function sanitizeEvent(event: TimedEvent): TimedEvent {
  const name = stripQuery(event.name);
  return event.attributes === undefined
    ? { ...event, name }
    : { ...event, name, attributes: sanitizeAttributes(event.attributes) };
}

/** The linked span's context (trace id, span id, flags) is kept; only the attributes change. */
function sanitizeLink(link: Link): Link {
  return link.attributes === undefined
    ? link
    : { ...link, attributes: sanitizeAttributes(link.attributes) };
}

/**
 * A copy of `span` that satisfies the redaction rules; ids, times and kind unchanged. The resource
 * is passed on as it is: ./telemetry.ts sanitized it when it built it.
 */
export function sanitizeSpan(span: ExportedSpan): ExportedSpan {
  return {
    // A span named from a raw request target or URL carries its query and fragment.
    name: stripQuery(span.name),
    kind: span.kind,
    spanContext: () => span.spanContext(),
    ...(span.parentSpanContext !== undefined ? { parentSpanContext: span.parentSpanContext } : {}),
    startTime: span.startTime,
    endTime: span.endTime,
    // The status message is free text (often `error.message`); the code is kept.
    status: { code: span.status.code },
    attributes: sanitizeAttributes(span.attributes),
    links: span.links.map(sanitizeLink),
    events: span.events.map(sanitizeEvent),
    duration: span.duration,
    ended: span.ended,
    resource: span.resource,
    instrumentationScope: span.instrumentationScope,
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount,
  };
}

/** Exports `sanitizeSpan` copies through `inner` (the OTLP exporter, or a test exporter). */
export class SanitizingSpanExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}

  export(
    spans: Parameters<SpanExporter['export']>[0],
    resultCallback: Parameters<SpanExporter['export']>[1],
  ): void {
    this.inner.export(spans.map(sanitizeSpan), resultCallback);
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush?.() ?? Promise.resolve();
  }
}
