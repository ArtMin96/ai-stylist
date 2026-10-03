// Span redaction before export (planning/14 §3: span attributes carry ids and enums only, the same
// redaction rules as logs, planning/11 §8). The OSS instrumentations record things our rules
// forbid: query strings (`url.query`, the query part of `url.full` / `url.path`; signed URLs carry
// credentials), client IPs and user agents, error messages in span status and `exception` events
// (driver messages echo statement parameters). `SanitizingSpanExporter` wraps the real exporter and
// hands it copies without them. Our own spans already comply (./trace-context.ts); this is the
// backstop for everything else. Translation only: no span is dropped, no id or enum is changed.
import type { Attributes, AttributeValue } from '@opentelemetry/api';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import {
  ATTR_CLIENT_ADDRESS,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_NETWORK_PEER_ADDRESS,
  ATTR_URL_FULL,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_USER_AGENT_ORIGINAL,
} from '@opentelemetry/semantic-conventions';

import { REDACTED, isForbiddenLogKey } from '../logger.js';

/** The SDK's exporter and span types, taken from `NodeSDK`'s own configuration type. */
export type SpanExporter = NodeSDKConfiguration['traceExporter'];
export type ExportedSpan = Parameters<SpanExporter['export']>[0][number];
type TimedEvent = ExportedSpan['events'][number];

/** Dropped from every span and event: free text, network identity or error detail. */
const DROPPED_ATTRIBUTES: ReadonlySet<string> = new Set([
  ATTR_URL_QUERY,
  ATTR_CLIENT_ADDRESS,
  ATTR_NETWORK_PEER_ADDRESS,
  ATTR_USER_AGENT_ORIGINAL,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
]);

/** URL-valued attributes kept without their query and fragment (older names included). */
const URL_ATTRIBUTES: ReadonlySet<string> = new Set([
  ATTR_URL_FULL,
  ATTR_URL_PATH,
  'http.url',
  'http.target',
]);

function stripQuery(value: AttributeValue): AttributeValue {
  if (typeof value !== 'string') return value;
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

/**
 * The attribute set a span may carry. The log denylist applies to the last dot-segment of the key
 * (`http.request.header.authorization` is redacted, `http.request.body.size` is kept).
 */
export function sanitizeAttributes(attributes: Attributes): Attributes {
  const out: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || DROPPED_ATTRIBUTES.has(key)) continue;
    const lastSegment = key.slice(key.lastIndexOf('.') + 1);
    if (isForbiddenLogKey(lastSegment)) out[key] = REDACTED;
    else out[key] = URL_ATTRIBUTES.has(key) ? stripQuery(value) : value;
  }
  return out;
}

function sanitizeEvent(event: TimedEvent): TimedEvent {
  return event.attributes === undefined
    ? event
    : { ...event, attributes: sanitizeAttributes(event.attributes) };
}

/** A copy of `span` that satisfies the redaction rules; ids, times, kind and links unchanged. */
export function sanitizeSpan(span: ExportedSpan): ExportedSpan {
  return {
    name: span.name,
    kind: span.kind,
    spanContext: () => span.spanContext(),
    ...(span.parentSpanContext !== undefined ? { parentSpanContext: span.parentSpanContext } : {}),
    startTime: span.startTime,
    endTime: span.endTime,
    // The status message is free text (often `error.message`); the code is kept.
    status: { code: span.status.code },
    attributes: sanitizeAttributes(span.attributes),
    links: span.links,
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
