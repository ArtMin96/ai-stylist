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
  `processResource` runs that detector itself and sanitizes the merged resource before NodeSDK
  (started with `autoDetectResources: false`) hands it to the three providers (see "Redaction").
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
  instrumentations produce, and `sanitizeAttributes`, the one attribute rule it and `telemetry.ts`
  apply (see "Redaction").
- `metrics.ts`, `request-metrics.ts`, `queue-metrics.ts`: the `stylist.*` metrics catalog emitters
  (see "Metrics").

## Metrics (planning/14 §4)

Instruments come from the global `@opentelemetry/api` meter (`stylistMeter()`, scope
`@ai-stylist/api`), which the NodeSDK started by the `--import` entry installs; the periodic OTLP
reader exports them every 60 s. The metrics API has no proxy provider: without the entry (no OTLP
endpoint, tests) every instrument is a no-op, and a meter taken before the SDK started stays one.
Names are fixed; the dashboards and alerts in `docs/observability/grafana/**` query them after
Grafana Cloud's OTLP → Prometheus conversion (`docs/observability/grafana.md`).

Instruments (attributes carry ids and enums only) → Prometheus series:

- `stylist.api.request.duration`: histogram, unit `s`; `http.route` (template),
  `http.request.method`, `http.response.status_code` →
  `stylist_api_request_duration_seconds_bucket` / `_sum` / `_count`.
- `stylist.api.request.errors`: counter; `http.route`, `error.class` = `5xx` →
  `stylist_api_request_errors_total`.
- `stylist.queue.depth`: observable gauge; `queue` (dead-letter queues included) →
  `stylist_queue_depth`.
- `stylist.queue.job.age_oldest`: observable gauge, unit `s`; `job_type` →
  `stylist_queue_job_age_oldest_seconds`.
- `stylist.queue.job.completions` / `.failures` / `.retries` / `.dlq`: counters; `job_type` →
  `stylist_queue_job_completions_total` / `_failures_total` / `_retries_total` / `_dlq_total`.

Emitters:

- **API** (`request-metrics.ts`): `registerRequestMetrics(fastify, meter?)` adds an `onResponse`
  hook (duration from `reply.elapsedTime`, in seconds) and an `onRoute` hook that registers the
  error counter at 0 for every route, plus once without `http.route` for unmatched requests. Call it
  on the root Fastify instance after `NestFactory.create`, before `app.init()` / `app.listen()`.
  `http.route` is Fastify's matched template (`request.routeOptions.url`), omitted when no route
  matched (404), never the raw path; an unknown method is `_OTHER`. Bucket boundaries are explicit,
  in seconds (`REQUEST_DURATION_BUCKETS_SECONDS`: 0.005 … 10, the HTTP semantic conventions'
  advice for `http.server.request.duration`), set through the instrument's `advice`, so no SDK
  view is needed. Series budget: 17 per (route, method, status) combination.
- **Jobs** (`queue-metrics.ts`): `new QueueMetrics({ jobTypes, deadLetterSources, logger, meter? })`
  registers every counter at 0 for each known `job_type` at construction (`increase()` misses the
  first increment of a series that starts at 1). `countOutcomes(definition, handler)` wraps a
  worker's handler: resolved = completion, thrown = failure, plus a retry below the last attempt
  (`attempt < retryLimit + 1`). `countDeadLetters(source, handler)` wraps a `<source>.dlq` worker's handler and
  counts each dead letter once, on its first delivery. `observeQueues(() => queue.readStats())`
  reads depth and oldest age from `PgBossQueue` at each collection (bounded by
  `QUEUE_STATS_READ_TIMEOUT_MS`, 10 s; a failed read reports nothing and logs its error class) and
  returns the function that stops it. Wiring: `apps/api/src/jobs/index.ts`.
- Never a gauge with unit `1` (Grafana Cloud would suffix `_ratio`); counts carry no unit.

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

Logs: `../logger.ts` (allowlist serializers for `req`, `res` and errors: an error is written as its
class, a code-shaped code and its cause chain, never a message or stack; plus the shared-kernel
denylist); the OTel log records are the pino lines after redaction (instrumentation-pino parses the
written line).

Attributes: one rule, `sanitizeAttributes` in `span-sanitizer.ts`. It drops `url.query`,
`client.address`, `network.peer.address`, `user_agent.original`, `exception.message` and
`exception.stacktrace`; cuts the query and fragment from `url.full`, `url.path`, `http.url` and
`http.target`; and replaces with `[REDACTED]` the value of an attribute whose last dot-segment is a
forbidden log word (`http.request.header.authorization`). It keeps `exception.type` only when it is
name-shaped (`TypeError`, `grpc.ServiceError`) or code-shaped (`23505`, `ECONNREFUSED`), the
`errorNameShape` / `codeShape` of `LOG_REDACTION_RULES` (`@ai-stylist/shared-kernel`, registry
`log-redaction.json`; the rules `../errors/error-shape.ts` applies too), and otherwise writes `Error`:
OTel JS fills it from `String(err.code)`, else `err.name`, and either can be free text. A URL attribute is cut whatever its shape:
the string, or each string of an array value (cut rather than dropped, so the path stays
searchable). One function makes that cut, `stripQuery` in `../logger.ts` (everything from the first
`?` or `#`): the same one the logged `req.url` and the problem `instance` (`../problem.filter.ts`)
go through.

Spans: `SanitizingSpanExporter` applies the attribute rule to the span's attributes, to every
event's and to every link's (the linked trace id, span id and flags are kept); cuts the span name
and every event name with `stripQuery`, because a name made from a raw request target or URL
carries its query; and drops span status messages. `GET`, `outbox.dispatch <event type>` and `job.process <queue>` have
nothing to cut. A route template that marks an optional parameter with `?` (Fastify's `/:id?`)
would lose the marker in the span name; `http.route` keeps it. No route does today.

Resource: NodeSDK gives one resource to the trace, metric and log providers, and only spans pass
the span exporter, so sanitizing it per span would leave it as it was in metrics and log records.
`processResource` in `telemetry.ts` therefore applies the attribute rule once to the merged
resource (SDK defaults, the declared service attributes, then `OTEL_SERVICE_NAME` /
`OTEL_RESOURCE_ATTRIBUTES`), and the exporter passes a span's resource on unchanged. What the
dashboards and queries filter on passes untouched: `service.name` (labels `service_name` and
`job`), `deployment.environment.name`, and with them `service.version`, `service.namespace`,
`service.instance.id` and `telemetry.sdk.*`. An attribute named with a forbidden word
(`deploy.api_token`) is exported as `[REDACTED]`.

Not covered: the value under a key that is neither dropped, forbidden nor one of the four URL keys
is not inspected (a URL with a query under `deploy.hook` passes); a span or event name is only
cut, so a value in its path part stays.

## Running

- API: `tsx --import ./src/platform/telemetry/instrument-api.ts src/main.ts` (built:
  `node --import ./dist/apps/api/src/platform/telemetry/instrument-api.js dist/apps/api/src/main.js`).
  Then `registerCorrelationId(app.getHttpAdapter().getInstance())` and
  `registerRequestMetrics(app.getHttpAdapter().getInstance())` in the composition root and
  `shutdownTelemetry()` last on shutdown.
- Jobs: `tsx --import ./src/platform/telemetry/instrument-jobs.ts src/jobs/main.ts`;
  `jobs/main.ts` calls `shutdownTelemetry()` last. `jobs/index.ts` passes `envelopeTraceContext` to
  `PgBossQueue` as `traceContextOf`.
- Started without the entry, a process runs untraced; logs still carry `correlation_id`.

## Tests

- `../tests/telemetry.process.test.ts`: the `--import` entries in a tsx child process against a stub
  OTLP receiver (no endpoint → no export and no `traceparent`; endpoint → traces, metrics and logs
  with the resource, `OTEL_SERVICE_NAME` override, no query string or planted value exported; a
  value planted in `OTEL_RESOURCE_ATTRIBUTES` reaches none of the three signals, while
  `service.name`, `deployment.environment.name` and `service.namespace` reach all of them).
- `../tests/logger.redaction.test.ts`: the canary, in process (`correlation_id`) and behind the entry
  (`trace_id` / `span_id`, nothing planted on stdout or in any OTLP body).
- `../tests/trace-context.test.ts`: `runTraced`, `currentTraceparent`, the span sanitizer (span,
  event and link attributes, array-valued URL attributes, the span name) and the sanitized resource.
- `../tests/correlation.test.ts`: the Fastify hooks on a Nest app (echo, mint, scope across body
  parsing, every log line and the request span).
- `../../jobs/tests/trace-propagation.docker.test.ts`: AC-1, one trace and one correlation id from
  the outbox append to the worker request (Testcontainers).
- Metrics, against an in-memory reader (`../tests/memory-metrics.ts`, a `MeterProvider` from
  `@opentelemetry/sdk-metrics`): `request-metrics.test.ts` (names, unit, bucket boundaries,
  attributes, 5xx only, zero series; on plain Fastify and on a Nest app wired as the composition
  root does), `queue-metrics.test.ts` (zero series, outcome and dead-letter counting, gauges),
  `metrics-catalog.test.ts` (every `stylist_api_*` / `stylist_queue_*` series and label the Grafana
  dashboards and alerts query is emitted), `../tests/queue-stats.docker.test.ts` (`readStats` on
  pg-boss) and `../../jobs/tests/queue-metrics.docker.test.ts` (an injected worker failure through
  retry → DLQ moves `stylist.queue.job.dlq` from 0 to 1; Testcontainers).
