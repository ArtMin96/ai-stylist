// OpenTelemetry pipeline for the API and jobs processes (planning/14 §1–§3, ADR-0007): NodeSDK
// with OTLP/HTTP-protobuf exporters for traces, metrics and logs, and the maintained OSS
// instrumentations (http + @fastify/otel in the API, undici, pg, pino in both). Loaded only by
// `./register.ts` (the `--import` entry) and tests, so a process without an OTLP endpoint never
// loads the SDK.
//
// Standard OTel env semantics: the exporters read `OTEL_EXPORTER_OTLP_ENDPOINT` (plus the
// per-signal `OTEL_EXPORTER_OTLP_{TRACES,METRICS,LOGS}_ENDPOINT` overrides) and
// `OTEL_EXPORTER_OTLP_HEADERS` themselves; `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` win
// over the resource built here (env detector); the sampler follows `OTEL_TRACES_SAMPLER`
// (default parent-based always-on: 100 % at launch volume, planning/14 §3).
//
// Spans pass through `SanitizingSpanExporter` (ids and enums only); log records are the pino lines
// after the logger's allowlist and denylist (instrumentation-pino parses the written line).
import { FastifyOtelInstrumentation } from '@fastify/otel';
import { ProxyTracerProvider, trace } from '@opentelemetry/api';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { defaultResource, envDetector, resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK, type NodeSDKConfiguration, core } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { type Telemetry, clearActiveTelemetry, setActiveTelemetry } from './lifecycle.js';
import { SanitizingSpanExporter, type SpanExporter } from './span-sanitizer.js';

/** Which process is instrumented: picks the default `service.name` and the instrumentations. */
export type TelemetryService = 'api' | 'jobs';

/**
 * `deployment.environment.name` (semantic conventions, development status: copied, not imported
 * from the `incubating` entry point).
 */
const ATTR_DEPLOYMENT_ENVIRONMENT_NAME = 'deployment.environment.name';

export type TelemetryOptions = {
  /** Default `service.name`; `OTEL_SERVICE_NAME` wins when set. */
  readonly service: TelemetryService;
  /** `service.version` (`APP_VERSION`); omitted when undefined. */
  readonly serviceVersion?: string | undefined;
  /** `deployment.environment.name` (`APP_ENV`); omitted when undefined. */
  readonly environment?: string | undefined;
  /** `OTEL_EXPORTER_OTLP_ENDPOINT`. Empty or undefined: nothing starts (no SDK, no network). */
  readonly otlpEndpoint?: string | undefined;
  /**
   * Tests only: export spans (sanitized) here instead of OTLP; metrics and logs are not exported.
   * Starts the pipeline even without an endpoint.
   */
  readonly spanExporter?: SpanExporter;
};

type Instrumentations = NonNullable<NodeSDKConfiguration['instrumentations']>;

function instrumentationsFor(service: TelemetryService): Instrumentations {
  const shared: Instrumentations = [
    // fetch → CLIENT span + W3C `traceparent` header (provider and worker calls).
    new UndiciInstrumentation(),
    // pg-boss's queries, only inside a traced operation: its polling loop stays out of traces.
    // Statement text is parameterized; values are never recorded.
    new PgInstrumentation({
      requireParentSpan: true,
      enhancedDatabaseReporting: false,
      ignoreConnectSpans: true,
    }),
    // `trace_id` / `span_id` / `trace_flags` on every log line in a span, and the lines sent to
    // the OTel logs pipeline.
    new PinoInstrumentation(),
  ];
  if (service !== 'api') return shared;
  return [
    new HttpInstrumentation(),
    // Request + route-handler spans; no per-hook spans (volume), no exception events (messages).
    new FastifyOtelInstrumentation({
      registerOnInitialization: true,
      instrumentHooks: false,
      recordExceptions: false,
    }),
    ...shared,
  ];
}

async function flushSpans(): Promise<void> {
  const provider = trace.getTracerProvider();
  const delegate: unknown =
    provider instanceof ProxyTracerProvider ? provider.getDelegate() : provider;
  if (
    typeof delegate === 'object' &&
    delegate !== null &&
    'forceFlush' in delegate &&
    typeof delegate.forceFlush === 'function'
  ) {
    await (delegate.forceFlush as () => Promise<void>).call(delegate);
  }
}

const DISABLED: Telemetry = {
  enabled: false,
  flush: () => Promise.resolve(),
  shutdown: () => Promise.resolve(),
};

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/**
 * Start the process's telemetry: instrumentations, context propagation (W3C `traceparent` only;
 * client `baggage` is not propagated) and the three OTLP pipelines. Without an endpoint (and
 * without a test exporter) it returns a disabled handle and starts nothing. Call once per process,
 * before the instrumented modules load (the `--import` entry does).
 */
export function startTelemetry(options: TelemetryOptions): Telemetry {
  const endpoint = nonEmpty(options.otlpEndpoint);
  if (endpoint === undefined && options.spanExporter === undefined) return DISABLED;

  const version = nonEmpty(options.serviceVersion);
  const environment = nonEmpty(options.environment);
  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.service,
      ...(version !== undefined ? { [ATTR_SERVICE_VERSION]: version } : {}),
      ...(environment !== undefined ? { [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment } : {}),
    }),
  );
  const exporting = options.spanExporter === undefined;
  const sdk = new NodeSDK({
    resource,
    // OTEL_SERVICE_NAME / OTEL_RESOURCE_ATTRIBUTES only: no host or process detectors, so no
    // command line, user or host name leaves the process.
    resourceDetectors: [envDetector],
    textMapPropagator: new core.W3CTraceContextPropagator(),
    instrumentations: instrumentationsFor(options.service),
    // Wrapped by NodeSDK in its batch span processor (OTEL_BSP_* env). The plural
    // `spanProcessors` would need `@opentelemetry/sdk-trace` as a direct dependency.
    traceExporter: new SanitizingSpanExporter(options.spanExporter ?? new OTLPTraceExporter()),
    metricReaders: exporting
      ? [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })]
      : [],
    logRecordProcessors: exporting
      ? [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })]
      : [],
  });
  sdk.start();

  let stopped: Promise<void> | undefined;
  const telemetry: Telemetry = {
    enabled: true,
    flush: flushSpans,
    shutdown: () => {
      clearActiveTelemetry(telemetry);
      stopped ??= sdk.shutdown();
      return stopped;
    },
  };
  setActiveTelemetry(telemetry);
  return telemetry;
}
