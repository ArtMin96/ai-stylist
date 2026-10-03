// The platform's span helpers and the span redaction, through a real in-process SDK
// (`startTelemetry` with an in-memory exporter behind the SanitizingSpanExporter): traceparent
// serialization, spans that join a carried trace in its correlation scope, failures recorded by
// error class only, and instrumentation attributes stripped to ids and enums (planning/14 §3). The
// same rules reach the span name, link attributes and the process resource.
import { SpanKind, SpanStatusCode, TraceFlags, trace } from '@opentelemetry/api';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import envelopeSchema from '@ai-stylist/contracts/events/envelope.json' with { type: 'json' };

import { REDACTED } from '../logger.js';
import { currentCorrelationId } from '../telemetry/correlation.js';
import type { Telemetry } from '../telemetry/lifecycle.js';
import type { ExportedSpan } from '../telemetry/span-sanitizer.js';
import { startTelemetry } from '../telemetry/telemetry.js';
import { TRACEPARENT_PATTERN, currentTraceparent, runTraced } from '../telemetry/trace-context.js';

import { memorySpanExporter } from './memory-span-exporter.js';
import { CANARY, PLANTED_RESOURCE_ATTRIBUTES } from './redaction-canary.js';

const CARRIED_TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const CARRIED_SPAN_ID = '00f067aa0ba902b7';
const CARRIED = `00-${CARRIED_TRACE_ID}-${CARRIED_SPAN_ID}-01`;

/** Names the tests and dashboards find spans by: none has a query or a fragment to cut. */
const KEPT_SPAN_NAMES = [
  'GET',
  'outbox.dispatch demo.outbox-flow.requested.v1',
  'job.process demo.outbox-flow',
];

describe('trace context and span redaction (in-process SDK)', () => {
  const exporter = memorySpanExporter();
  let telemetry: Telemetry;

  beforeAll(() => {
    // The resource is built once, when telemetry starts: planted before that.
    vi.stubEnv('OTEL_RESOURCE_ATTRIBUTES', PLANTED_RESOURCE_ATTRIBUTES);
    telemetry = startTelemetry({
      service: 'jobs',
      serviceVersion: '1.2.3',
      environment: 'staging',
      spanExporter: exporter,
    });
  });

  afterAll(async () => {
    await telemetry.shutdown();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    exporter.spans.length = 0;
  });

  async function exported(name: string): Promise<ExportedSpan | undefined> {
    await telemetry.flush();
    return exporter.spans.find((span) => span.name === name);
  }

  it('starts nothing, and reports disabled, without an endpoint or a test exporter', () => {
    expect(startTelemetry({ service: 'api', otlpEndpoint: '  ' }).enabled).toBe(false);
    expect(telemetry.enabled).toBe(true);
  });

  it('accepts exactly the traceparent format the event envelope pins', () => {
    expect(TRACEPARENT_PATTERN.source).toBe(envelopeSchema.properties.traceparent.pattern);
  });

  it('serializes the active span as a W3C traceparent, and nothing outside a span', () => {
    expect(currentTraceparent()).toBeUndefined();
    trace.getTracer('test').startActiveSpan('outer', (span) => {
      const { traceId, spanId } = span.spanContext();
      expect(currentTraceparent()).toBe(`00-${traceId}-${spanId}-01`);
      span.end();
    });
  });

  it("joins the carried traceparent's trace and runs work in its correlation scope", async () => {
    let seen: string | undefined;
    const carried = { traceparent: CARRIED, correlationId: 'corr-7' };

    await runTraced('job.process q', SpanKind.CONSUMER, { 'job.attempt': 1 }, carried, () => {
      seen = currentCorrelationId();
      return Promise.resolve();
    });

    const span = await exported('job.process q');
    expect(span?.spanContext().traceId).toBe(CARRIED_TRACE_ID);
    expect(span?.parentSpanContext?.spanId).toBe(CARRIED_SPAN_ID);
    expect(span?.kind).toBe(SpanKind.CONSUMER);
    expect(span?.attributes).toEqual({ 'job.attempt': 1, correlation_id: 'corr-7' });
    expect(seen).toBe('corr-7');
  });

  it('new trace for a malformed traceparent; an invalid correlation id is dropped', async () => {
    let seen: string | undefined = 'unset';
    const carried = { traceparent: '00-abc-def-01', correlationId: 'not valid' };

    await runTraced('outbox.dispatch x', SpanKind.PRODUCER, {}, carried, () => {
      seen = currentCorrelationId();
      return Promise.resolve();
    });

    const span = await exported('outbox.dispatch x');
    expect(span?.parentSpanContext).toBeUndefined();
    expect(span?.spanContext().traceId).not.toBe(CARRIED_TRACE_ID);
    expect(span?.attributes).toEqual({});
    expect(seen).toBeUndefined();
  });

  it('records a failure by error class only, and rethrows it', async () => {
    const failing = () => Promise.reject(new TypeError(`bad ${CANARY}`));

    const run = runTraced('y', SpanKind.PRODUCER, {}, undefined, failing);
    await expect(run).rejects.toThrow(TypeError);

    const span = await exported('y');
    expect(span?.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(span?.attributes).toEqual({ 'error.type': 'TypeError' });
    expect(span?.events.map((event) => [event.name, event.attributes])).toEqual([
      ['exception', { 'exception.type': 'TypeError' }],
    ]);
  });

  it('strips query strings, network identity and free text from instrumentation spans', async () => {
    const span = trace.getTracer('test').startSpan('GET', {
      kind: SpanKind.CLIENT,
      attributes: {
        'url.full': `https://storage.example/object?X-Amz-Signature=${CANARY}#part`,
        'url.path': `/v1/items?token=${CANARY}`,
        'url.query': `token=${CANARY}`,
        'client.address': '203.0.113.7',
        'network.peer.address': '203.0.113.7',
        'user_agent.original': CANARY,
        'http.request.header.authorization': [CANARY],
        'http.request.body.size': 42,
        'http.request.method': 'GET',
      },
    });
    span.recordException(new Error(`boom ${CANARY}`));
    span.setStatus({ code: SpanStatusCode.ERROR, message: `failed ${CANARY}` });
    span.end();

    const out = await exported('GET');
    expect(out?.attributes).toEqual({
      'url.full': 'https://storage.example/object',
      'url.path': '/v1/items',
      'http.request.header.authorization': REDACTED,
      'http.request.body.size': 42,
      'http.request.method': 'GET',
    });
    expect(out?.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(out?.events.map((event) => event.attributes)).toEqual([{ 'exception.type': 'Error' }]);
    const text = JSON.stringify([out?.name, out?.attributes, out?.events, out?.status]);
    expect(text).not.toContain(CANARY);
  });

  it('cuts every string of an array-valued URL attribute', async () => {
    const span = trace.getTracer('test').startSpan('urls', {
      attributes: {
        'url.full': [`https://a.example/x?sig=${CANARY}`, `https://b.example/y#${CANARY}`],
        'http.target': [`/v1/items?token=${CANARY}`, null],
      },
    });
    span.end();

    const out = await exported('urls');
    expect(out?.attributes).toEqual({
      'url.full': ['https://a.example/x', 'https://b.example/y'],
      'http.target': ['/v1/items', null],
    });
  });

  it('cuts the query and fragment from a span name, and keeps a name without one', async () => {
    const tracer = trace.getTracer('test');
    tracer.startSpan(`GET /v1/items?token=${CANARY}#${CANARY}`).end();
    for (const name of KEPT_SPAN_NAMES) tracer.startSpan(name).end();

    await telemetry.flush();
    expect(exporter.spans.map((span) => span.name)).toEqual(['GET /v1/items', ...KEPT_SPAN_NAMES]);
  });

  it('sanitises link attributes like span attributes, and keeps the linked ids', async () => {
    const linked = {
      traceId: CARRIED_TRACE_ID,
      spanId: CARRIED_SPAN_ID,
      traceFlags: TraceFlags.SAMPLED,
    };
    const span = trace.getTracer('test').startSpan('linked', {
      links: [
        {
          context: linked,
          attributes: {
            'url.full': `https://storage.example/object?X-Amz-Signature=${CANARY}`,
            'url.query': `token=${CANARY}`,
            'http.request.header.cookie': [CANARY],
            'messaging.message.id': 'job-1',
          },
        },
        { context: linked },
      ],
    });
    span.end();

    const out = await exported('linked');
    expect(out?.links).toEqual([
      {
        context: linked,
        attributes: {
          'url.full': 'https://storage.example/object',
          'http.request.header.cookie': REDACTED,
          'messaging.message.id': 'job-1',
        },
      },
      { context: linked },
    ]);
  });

  it('sanitises the process resource; the attributes dashboards filter on survive', async () => {
    trace.getTracer('test').startSpan('resource').end();

    const out = await exported('resource');
    expect(out?.resource.attributes).toEqual({
      'service.name': 'jobs',
      'service.version': '1.2.3',
      'deployment.environment.name': 'staging',
      'service.namespace': 'ai-stylist',
      'telemetry.sdk.language': 'nodejs',
      'telemetry.sdk.name': 'opentelemetry',
      'telemetry.sdk.version': expect.any(String) as unknown,
      'deploy.api_token': REDACTED,
      'url.full': 'https://deploy.example/hook',
    });
  });
});
