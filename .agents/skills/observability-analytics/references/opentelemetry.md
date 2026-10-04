# OpenTelemetry in this repository — reference

> A reference file inside `observability-analytics`, not a standalone skill. Open it when a task
> touches how telemetry starts in a process, how one trace crosses the outbox and the job queue, an
> `OTEL_*` env key, where span attributes and log fields are cleaned, or how to find one flow by
> its correlation id. It describes what is committed, not planned follow-ups. Metric names and their
> Prometheus spellings are in `docs/observability/grafana.md`.

Last reviewed: 2026-10-03

## How to read this file

Words used below, for a reader who has never used OpenTelemetry:

- **OpenTelemetry** (OTel) is a vendor-neutral standard and a set of libraries that record what a
  program does and send it elsewhere. **OTLP** is its wire format.
- A **span** is one timed step of work, such as one HTTP request or one job. A **trace** is the
  tree of spans that belong to one piece of work, even across processes.
- **`traceparent`** is one short header value, defined by the W3C, that carries the trace id and the
  id of the calling span to the next process. Whoever receives it can attach its own span to the
  same trace.
- The **correlation id** is this project's own id for one logical operation. It is not part of
  OpenTelemetry. It travels beside the trace so that log lines can be found even where nothing is
  traced.
- An **instrumentation** is a library that creates spans automatically for another library (HTTP,
  the database driver, the logger).

Almost everything here is **[repo]**: it follows from this repository's code, and each paragraph
names the file. The few statements about a vendor carry **[doc]** with the address, or
**[unconfirmed]** when nothing establishes them. Do not upgrade an unconfirmed item without new
evidence.

## Rules

1. **The repository wins.** OpenTelemetry's own documentation, and vendor skills such as the
   `opentelemetry` skill in Grafana Labs' `grafana-core`, describe general setups: automatic
   instrumentation packages, environment-variable-only configuration, a collector, every signal
   switched on. This repository wires the SDK by hand so that redaction, the correlation id and the
   outbox hop work. Where the two disagree, follow the repository (root `CLAUDE.md`, the code under
   `apps/api/src/platform/telemetry/`, `docs/modules/platform.md`) and report the difference in your
   hand-back. Do not follow the vendor text.
2. **An agent never does any of these**:
   - run `just observability-sync` as a real run, or with `--dry-run`, without the owner's
     authorization for that run;
   - call a vendor write API directly;
   - read or edit `.env` or anything under `secrets/**`. That includes printing `OTEL_*` values
     from a shell, because `OTEL_EXPORTER_OTLP_HEADERS` is a credential;
   - change a flag or a setting in a vendor screen.
3. A span attribute, metric label or log field that would carry a forbidden value is a stop, not a
   design choice: `security-privacy-review` first (the skill's "Stop / escalation").

## Three processes

| Process                        | Started locally by | Default `service.name` | Signals exported over OTLP | Entry that starts telemetry                                   |
| ------------------------------ | ------------------ | ---------------------- | -------------------------- | ------------------------------------------------------------- |
| API (NestJS on Fastify)        | `just dev-api`     | `api`                  | traces, metrics, logs      | `apps/api/src/platform/telemetry/instrument-api.ts`           |
| Jobs process (pg-boss workers) | `just dev-workers` | `jobs`                 | traces, metrics, logs      | `apps/api/src/platform/telemetry/instrument-jobs.ts`          |
| Segmentation worker (FastAPI)  | `just dev-workers` | `segmentation`         | traces only                | `workers/ml/segmentation/src/ai_stylist_segmentation/main.py` |

The outbox relay, which moves stored events onto the job queue, runs inside the API process
(`apps/api/src/app.module.ts`).

**With an empty `OTEL_EXPORTER_OTLP_ENDPOINT` nothing starts in any of the three**: no SDK, no
exporter, no network call. Tests, CI and a local run without a Grafana account are unaffected. Log
lines still carry the correlation id.

## How telemetry starts

### API and jobs (Node)

1. The process is started with Node's `--import` flag pointing at the entry file, so the entry runs
   before any application module loads. The package scripts in `apps/api/package.json` (`dev`,
   `start`, `dev:jobs`, `jobs`, `start:jobs`) carry the flag. The order matters: an instrumentation
   can only patch a module that has not been loaded yet. A process started without the entry runs
   untraced.
2. The entry calls `registerTelemetry(service, process.env)` in
   `apps/api/src/platform/telemetry/register.ts`. It returns at once when the endpoint is empty.
   Otherwise it registers the loader hook that lets instrumentations patch modules imported as ES
   modules, limited to `pino` and `pg`, and only then imports the SDK wiring.
3. `startTelemetry(options)` in `apps/api/src/platform/telemetry/telemetry.ts` builds one NodeSDK:
   - **Resource** (who is sending): `service.name` (`api` or `jobs`), `service.version` from
     `APP_VERSION`, `deployment.environment.name` from `APP_ENV`. Only the environment detector
     runs, so `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES` win and no host name, user name or
     command line leaves the process.
   - **Propagation**: W3C `traceparent` only. A client's `baggage` header is not passed on.
   - **Traces**: the OTLP trace exporter wrapped in `SanitizingSpanExporter`, behind the SDK's
     batch processor. Sampling follows `OTEL_TRACES_SAMPLER`; the default keeps every trace.
   - **Metrics**: one periodic reader, exporting every 60 seconds.
   - **Logs**: one batch processor. The records are the pino log lines after redaction.
   - **Instrumentations**: outgoing `fetch` (undici), the `pg` driver (only inside a traced
     operation, never statement values) and pino in both processes; incoming HTTP and Fastify
     (through the @fastify/otel package) in the API only.
4. The composition root finishes the job. In the API, `createApp` in `apps/api/src/app.module.ts`
   calls `registerCorrelationId(fastify)` and `registerRequestMetrics(fastify)` on the root Fastify
   instance before any route exists. In the jobs process, `startJobs` in
   `apps/api/src/jobs/index.ts` passes `envelopeTraceContext` to the queue and builds the queue
   metrics.
5. Shutdown flushes last. `shutdownTelemetry()` in `apps/api/src/platform/telemetry/lifecycle.ts`
   is called by `AppModule.onApplicationShutdown` in the API and at the end of the signal handler in
   `apps/api/src/jobs/main.ts`, so the spans and log lines of the shutdown itself are still sent. A
   failed start flushes too.

`just dev-api` and `just dev-workers` set `OTEL_SERVICE_NAME` on the command line for each process,
so one shared `.env` never renames a process (`scripts/test/dev-service-names.test.sh` proves it).

### Segmentation worker (Python)

`workers/ml/segmentation/src/ai_stylist_segmentation/main.py` is the worker's composition root. At
import time it configures logging, builds the app and calls `configure_tracing(app)`:

1. `build_tracer_provider()` returns nothing when the endpoint is empty. Otherwise it builds a
   tracer provider whose resource has `service.name` `segmentation`, the version and the
   environment, with the standard environment variables winning, and a batch processor around
   `SanitizingSpanExporter(OTLPSpanExporter())`.
2. It sets the W3C `traceparent` propagator, registers the provider and instruments the FastAPI app:
   one server span per request that continues the caller's trace, no span for the health probe, no
   per-message spans.
3. Logs are JSON on stdout only. They are not sent over OTLP, because the OpenTelemetry Python logs
   SDK is still marked as in development (`workers/README.md`). Inside a request each line carries
   `correlation_id`, and inside a traced request also `trace_id` and `span_id`.

## One trace across the outbox and the job queue

The work passes through a database table and a queue, so no HTTP header can carry the trace. The
event envelope carries it instead: `packages/contracts/events/envelope.json` has a required
`correlationId` and an optional `traceparent`.

| Step | Where                          | What happens                                                                                                                                                                          | File                                                                          |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1    | API, incoming request          | Reads `x-correlation-id` (or mints a UUID when it is absent or invalid), echoes it in the response, sets `correlation_id` on the request span, and runs the request inside that scope | `apps/api/src/platform/telemetry/correlation.ts`                              |
| 2    | API, same database transaction | `PgOutboxWriter.append` stores the envelope. An envelope without a `traceparent` gets the one of the active span                                                                      | `apps/api/src/platform/outbox/pg-outbox-writer.ts`                            |
| 3    | API, outbox relay              | Opens the span `outbox.dispatch <event type>`, with the envelope's `traceparent` as parent, and sends the whole envelope as the job's data                                            | `apps/api/src/platform/outbox/outbox-relay.ts`                                |
| 4    | Jobs process                   | For each fetched job, `envelopeTraceContext` picks `traceparent` and `correlationId` out of the job data, and the queue opens the span `job.process <queue>` with that parent         | `apps/api/src/jobs/queues.ts`, `apps/api/src/platform/queue/pg-boss-queue.ts` |
| 5    | Jobs process, worker call      | The handler calls the worker with `fetch`. The undici instrumentation adds the `traceparent` header; the client adds `x-correlation-id`. The body's `request_id` is the event id      | `apps/api/src/jobs/segmentation-client.ts`                                    |
| 6    | Segmentation worker            | The FastAPI instrumentation continues the trace. The middleware accepts or mints the correlation id, sets it on the span, binds it to every log line and echoes it                    | `workers/ml/observability/src/ai_stylist_observability/correlation.py`        |

Rules the shared helper `runTraced` in `apps/api/src/platform/telemetry/trace-context.ts` enforces
for steps 3 and 4:

- The parent is the span named by the carried `traceparent`, or a new trace when the value is
  missing or malformed. It is never the surrounding context: the relay's or the queue's polling loop
  did not cause the work.
- A `traceparent` must match `TRACEPARENT_PATTERN`; a correlation id must match
  `CORRELATION_ID_PATTERN` (1 to 128 characters of letters, digits, dot, underscore, colon and
  hyphen). An invalid value is dropped, never rejected, and the worker uses the same pattern.
- A failure marks the span with the error's class only (`recordSpanError`): no message, no stack.
- With telemetry off, the same code runs and creates nothing.

Span names and attributes of the two manual spans are listed in
`apps/api/src/platform/telemetry/README.md`. The end-to-end proof, one trace and one correlation id
from the outbox append to the worker request, is
`apps/api/src/jobs/tests/trace-propagation.docker.test.ts`.

## Env keys

| Key                           | Meaning here                                                                                                        | Where it comes from                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | base address of the OTLP receiver; each exporter adds its signal's path. **Empty switches everything off**          | sops dev, then `.env` (a human, `just secrets-edit dev`) |
| `OTEL_EXPORTER_OTLP_HEADERS`  | the credential header for that receiver. A secret                                                                   | same                                                     |
| `OTEL_SERVICE_NAME`           | overrides `service.name`. Leave it empty in `.env`; the `just` recipes and each deployed service set it per process | the command line                                         |
| `APP_ENV`                     | becomes `deployment.environment.name`, which dashboards filter on                                                   | `.env`                                                   |
| `APP_VERSION`                 | becomes `service.version`                                                                                           | `.env`, or the deployed service's own settings           |

- An empty `APP_ENV` leaves `deployment.environment.name` out of the telemetry altogether. The
  telemetry start reads the raw environment (`apps/api/src/platform/telemetry/register.ts`, and
  `main.py` in the worker), not the validated API config, whose default `local` applies only to the
  application itself (`apps/api/src/config.ts`). Dashboard 01 still shows such data under
  "All" environments, but there is then no environment to pick and an alert's summary names none.
  The tooling keeps this from happening locally: `just bootstrap` writes `local` into an empty
  `APP_ENV` in `.env`, `just doctor` warns while it is empty, and `just dev-api` and
  `just dev-workers` start each process with the exported value, else the `.env` value, else
  `local` (`scripts/lib.sh`, `scripts/dev-app-env.sh`). A process started any other way with an
  empty `APP_ENV` still exports without the attribute.
- The exporters read the two `OTEL_EXPORTER_OTLP_*` keys themselves; the repository's code only
  tests the endpoint for emptiness. Format and consumers of the header:
  `.agents/skills/observability-analytics/references/grafana-cloud.md`.
- Standard keys the SDKs also honour, none of them listed in `.env.example` and none needed:
  `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_TRACES_SAMPLER`, the `OTEL_BSP_*` batch settings, and the
  per-signal `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` and
  `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`. The worker sets `OTEL_SEMCONV_STABILITY_OPT_IN` to `http`
  unless an operator value exists, so its spans use the same HTTP attribute names as the API's.
- The exporters are the protobuf-over-HTTP ones, chosen by import. A protocol variable changes
  nothing.
- A new env key is a change to `.env.example`, which is single-writer and belongs to
  `tooling-engineer`.

## Where redaction and sanitising happen

The rule is planning doc 11 §8: logs, spans and metrics carry ids and enums only. The forbidden key
words have one source, `packages/shared-kernel/registry/forbidden-log-keys.json`.

| Signal            | Process   | Where it is cleaned                                                                                                                                                                                                                                                                                                                                                                         | File                                                                 |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Logs              | API, jobs | allowlist serializers for request and response; the forbidden-key denylist at any depth; `msg` limited to the caller's own string (`hooks.logMethod`; interpolation arguments and non-string first arguments dropped); a Nest `Logger` context kept only when it is a PascalCase class name; `childLogger` for child-logger bindings (redact paths only as a backstop for a raw `.child()`) | `apps/api/src/platform/logger.ts`                                    |
| Logs sent to OTLP | API, jobs | nothing extra: the records are the already-redacted pino lines                                                                                                                                                                                                                                                                                                                              | `apps/api/src/platform/telemetry/telemetry.ts`                       |
| Spans             | API, jobs | `SanitizingSpanExporter`, just before export                                                                                                                                                                                                                                                                                                                                                | `apps/api/src/platform/telemetry/span-sanitizer.ts`                  |
| Spans we create   | API, jobs | written clean in the first place: ids and enums, the error class only                                                                                                                                                                                                                                                                                                                       | `apps/api/src/platform/telemetry/trace-context.ts`                   |
| Metrics           | API, jobs | attributes are fixed enums and the route template, never the raw path                                                                                                                                                                                                                                                                                                                       | `apps/api/src/platform/telemetry/request-metrics.ts`                 |
| Logs              | worker    | a structlog processor chain with the same word list, generated from the registry (`ai_stylist_generated.kernel`); positional arguments dropped; a logged exception is `err: {type, code?, cause?}` only (`summarize_exc_info`)                                                                                                                                                              | `workers/ml/observability/src/ai_stylist_observability/redaction.py` |
| Spans             | worker    | a second `SanitizingSpanExporter` that mirrors the Node one and also covers the older attribute names                                                                                                                                                                                                                                                                                       | `workers/ml/observability/src/ai_stylist_observability/tracing.py`   |

What the span sanitizer does, in both languages:

- drops `url.query`, `client.address`, `network.peer.address`, `user_agent.original`,
  `exception.message` and `exception.stacktrace`;
- cuts the query string and the fragment from `url.full`, `url.path`, `http.url` and `http.target`,
  because signed addresses carry credentials there;
- removes the free-text status message of a span and keeps its status code;
- replaces the value of any attribute whose last dot-separated part is a forbidden word, so
  `http.request.header.authorization` is redacted and `http.request.body.size` is kept;
- applies the attribute rule to every event's and every link's attributes (link ids kept) and to
  the process resource, sanitized once where it is built;
- cuts every string of an array-valued URL attribute;
- cuts the span name and every event name at the first `?` or `#`;
- keeps `exception.type` only when it is name-shaped or code-shaped (`log-redaction.json`), else
  writes `Error`;
- never drops a span and never changes an id or an enum.

The sanitizer is a backstop for spans made by third-party instrumentations. It is not a licence to
put a sensitive value on a span and rely on it being removed.

Tests that hold this in place: `apps/api/src/platform/tests/logger.redaction.test.ts` (the canary
plants marker values under every forbidden key and asserts that none reaches stdout or any OTLP
body), `apps/api/src/platform/tests/telemetry.process.test.ts` (the real `--import` entries against
a stand-in receiver) and `apps/api/src/platform/tests/trace-context.test.ts`.

## Find one flow by its correlation id

The id is in the `x-correlation-id` response header of the request that started the flow.

1. **Logs first.** In Grafana, **Explore** with the Loki data source:
   `{service_name=~"api|jobs"} | correlation_id = "<id>"`. Every log line written inside a span also
   carries `trace_id`. This query is given in `docs/observability/grafana.md`. Run against the
   stack on 2026-10-03, it returned the API and jobs lines of one request with the same trace id.
2. **Then the trace.** Open that `trace_id` in **Explore** with the Tempo data source. One trace
   shows the HTTP request, `outbox.dispatch …`, `job.process …` and the worker call.
3. **Or straight to the trace.** The request span, both manual spans and the worker's span carry
   the attribute `correlation_id`, so the TraceQL query `{ span.correlation_id = "<id>" }` finds
   the trace. The attribute is [repo]. Run against the stack on 2026-10-03, the query returned
   exactly one trace: 9 spans across `api`, `jobs` and `segmentation`, 4 of them carrying the id.
   The root HTTP server span does not carry it; its child span `request` does.
4. **Without Grafana.** The output of `just dev-api` and `just dev-workers` carries
   `correlation_id` on every line of the flow. The worker's log lines are only there: they do not
   reach Loki yet.

The menu path to each screen is in
`.agents/skills/observability-analytics/references/grafana-cloud.md`. Traces and logs older than 14
days are gone.

## What is not there

Stated so that nobody assumes it:

- The worker exports traces only: no metrics, and no logs over OTLP.
- Queries made through postgres.js (the outbox relay, the idempotency guard, the repositories)
  produce no database spans. The `pg` instrumentation sees only pg-boss's own driver.
- `baggage` is not propagated in either direction.
- No collector or agent runs between a process and the receiver; each process exports directly.
- No staging or production host exports yet (P03). The worker's address in the jobs process is a
  constant in `apps/api/src/jobs/main.ts`, not an env key.

## Vendor material an agent may read

- `https://opentelemetry.io/llms.txt` indexes the documentation, and pages are available as
  Markdown, for example `https://opentelemetry.io/docs/languages/js/index.md` [doc]. The ES-module
  loading rule that step 1 above depends on is explained in the document that
  `apps/api/src/platform/telemetry/register.ts` links.
- No official OpenTelemetry skill, plugin or MCP server for coding agents was found: a search of
  the project's GitHub organization on 2026-10-03 returned none. That is a search result, not a
  statement by the project. Use the `context7` documentation server for SDK questions, and check
  the installed version in `apps/api/package.json` and `workers/ml/segmentation/pyproject.toml`
  first, because these packages change often.
- Rule 1 applies to all of it.
