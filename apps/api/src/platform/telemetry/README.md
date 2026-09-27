# platform/telemetry — OTel pipeline, correlation id, trace context (P02-T09)

Planning/14 §2–§3, ADR-0007 (OTel → Grafana Cloud over OTLP). Translation only: the SDK wiring and
the maintained OSS instrumentations, plus the glue they cannot provide (correlation scope, the
outbox/job spans, span redaction). No business rule lives here.

## Files

- `telemetry.ts`: `startTelemetry(options)` → `Telemetry` (`enabled`, `flush()`, `shutdown()`);
  options `service`, `serviceVersion`, `environment`, `otlpEndpoint` and the test-only
  `spanExporter`. NodeSDK with the OTLP/HTTP-protobuf exporters: traces (`traceExporter`, wrapped by `SanitizingSpanExporter`, then
  by NodeSDK's env-configured batch span processor), metrics (`metricReaders`: one periodic reader)
  and logs (`logRecordProcessors`: one batch processor). Resource: `service.name` = `api` or
  `jobs`, `service.version` = `APP_VERSION`, `deployment.environment.name` = `APP_ENV`, merged over
  the SDK defaults; only the env detector runs (`OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES`
  win; no host or process detector, so no command line or host name leaves the process).
  Propagation: W3C `traceparent` only (client `baggage` is not propagated). Sampler:
  `OTEL_TRACES_SAMPLER`, default parent-based always-on (100 % at launch volume).
- `register.ts` + the `--import` entries `instrument-api.ts` / `instrument-jobs.ts`:
  `registerTelemetry(service, env)`. **An empty `OTEL_EXPORTER_OTLP_ENDPOINT` returns before
  anything happens**: no loader hook, no SDK, no exporter, no network (tests, CI, local runs without
  Grafana). With an endpoint it registers the import-in-the-middle loader through
  `@opentelemetry/instrumentation/hook.mjs` (limited to the ESM-imported modules an instrumentation
  patches: `pino`, `pg`), then imports `telemetry.ts` and starts it. The exporters read
  `OTEL_EXPORTER_OTLP_ENDPOINT` (plus per-signal overrides) and `OTEL_EXPORTER_OTLP_HEADERS`
  themselves.
- `lifecycle.ts`: `shutdownTelemetry()` (flush and stop; a no-op when nothing started) and the
  process-wide handle, kept on `globalThis` so the `--import` entry and the process entry share it.
  Imports nothing, so a process entry can call it without loading the SDK.
- `correlation.ts`: the correlation id (planning/14 §2). `x-correlation-id` accepted when it matches
  `CORRELATION_ID_PATTERN` (1–128 chars of `[A-Za-z0-9._:-]`), else a minted UUID.
  `registerCorrelationId(fastify)` adds an `onRequest` hook (read or mint, echo it in the response
  header, set `correlation_id` on the active span, run the request in its scope) and a
  `preValidation` hook (re-enters the scope after body parsing). `currentCorrelationId()` reads the
  scope; `runWithCorrelationId(id, fn)` opens one (an invalid or `undefined` id runs `fn` unscoped).
  The pino `mixin` in `../logger.ts` adds `correlation_id` to every line inside a scope.
- `trace-context.ts`: `currentTraceparent()`, `contextFromTraceparent()`, `runTraced()` (a span
  parented on a carried `traceparent`, in the carried correlation scope; a throw records the error
  class and rethrows), `recordSpanError()`, and the attribute names.
- `span-sanitizer.ts`: `SanitizingSpanExporter`, the export-side backstop for spans the OSS
  instrumentations produce (see "Redaction").

## Instrumentations

- API only: `@opentelemetry/instrumentation-http` (a SERVER span per request, extracting an inbound
  `traceparent`; CLIENT spans for `http`) and `@fastify/otel` (`registerOnInitialization`; a
  `request` span and a route-handler span with `http.route`; no per-hook spans, no exception
  events).
- Both processes: `@opentelemetry/instrumentation-undici` (a CLIENT span per `fetch` and the W3C
  `traceparent` request header: worker and provider calls), `@opentelemetry/instrumentation-pg`
  (`requireParentSpan`, no values, no connect spans: pg-boss queries inside a traced operation
  only) and `@opentelemetry/instrumentation-pino` (`trace_id` / `span_id` / `trace_flags` on log
  lines in a span; the lines sent to the OTel logs pipeline).

## Manual spans (ids and enums only)

- `outbox.dispatch <event type>`, PRODUCER, parented on the envelope's `traceparent` (else a new
  trace): `messaging.system` = `pg-boss`, `messaging.operation.type` = `send`,
  `messaging.destination.name` (queue), `outbox.event.id`, `outbox.event.type`, `correlation_id`.
- `job.process <queue>`, CONSUMER, parented on the job data's `traceparent` (else a new trace):
  `messaging.system` = `pg-boss`, `messaging.operation.type` = `process`,
  `messaging.destination.name`, `messaging.message.id` (job id), `job.attempt`, `correlation_id`.

On failure both get `error.type` (error class), an `exception` event with `exception.type` only,
and ERROR status without a message. `PgOutboxWriter.append` stores the active span's `traceparent`
in an envelope that has none, so both spans join the producing request's trace; the job's handler
runs in its span, so the undici span of its worker call (and the header) continue the same trace.

## Redaction

Logs: `../logger.ts` (allowlist serializers + the shared-kernel denylist); the OTel log records are
the pino lines after redaction (instrumentation-pino parses the written line). Spans:
`SanitizingSpanExporter` drops `url.query`, `client.address`, `network.peer.address`,
`user_agent.original`, `exception.message` and `exception.stacktrace`; cuts the query and fragment
from `url.full`, `url.path`, `http.url` and `http.target`; drops span status messages; and redacts
an attribute whose last dot-segment is a forbidden log word (`http.request.header.authorization`).

## Running

- API: `tsx --import ./src/platform/telemetry/instrument-api.ts src/main.ts` (built:
  `node --import ./dist/apps/api/src/platform/telemetry/instrument-api.js dist/apps/api/src/main.js`).
  Then `registerCorrelationId(app.getHttpAdapter().getInstance())` in the composition root and
  `shutdownTelemetry()` last on shutdown.
- Jobs: `tsx --import ./src/platform/telemetry/instrument-jobs.ts src/jobs/main.ts`;
  `jobs/main.ts` calls `shutdownTelemetry()` last. `jobs/index.ts` passes `envelopeTraceContext` to
  `PgBossQueue` as `traceContextOf`.
- Started without the entry, a process runs untraced; logs still carry `correlation_id`.

## Tests

- `../tests/telemetry.process.test.ts`: the `--import` entries in a tsx child process against a stub
  OTLP receiver (no endpoint → no export and no `traceparent`; endpoint → traces, metrics and logs
  with the resource, `OTEL_SERVICE_NAME` override, no query string or planted value exported).
- `../tests/logger.redaction.test.ts`: the canary, in process (`correlation_id`) and behind the entry
  (`trace_id` / `span_id`, nothing planted on stdout or in any OTLP body).
- `../tests/trace-context.test.ts`: `runTraced`, `currentTraceparent`, the span sanitizer.
- `../tests/correlation.test.ts`: the Fastify hooks on a Nest app (echo, mint, scope across body
  parsing, every log line and the request span).
- `../../jobs/tests/trace-propagation.docker.test.ts`: AC-1, one trace and one correlation id from
  the outbox append to the worker request (Testcontainers).
