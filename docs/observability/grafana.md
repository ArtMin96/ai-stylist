# Grafana Cloud: traces, metrics, logs, dashboards, alerts

Every server process exports OpenTelemetry (OTLP/HTTP) to one Grafana Cloud free-tier stack in the EU:
Tempo for traces, Mimir (Prometheus) for metrics, Loki for logs (the segmentation worker exports
traces only; see below). Dashboards, alert rules and routing are JSON files in
[`grafana/`](grafana/README.md), pushed by `just observability-sync`. Decision and exit path:
[ADR-0007](../adr/0007-observability-backend.md). Catalog: planning/14 §3, §4, §6, §7.

## Configure a process

| Process                             | Started locally by | `service.name` |
| ----------------------------------- | ------------------ | -------------- |
| API (NestJS, runs the outbox relay) | `just dev-api`     | `api`          |
| pg-boss jobs process                | `just dev-workers` | `jobs`         |
| Segmentation worker (FastAPI)       | `just dev-workers` | `segmentation` |

| Key                           | Value                                                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | the stack's OTLP endpoint, a URL ending in `/otlp`, copied from the Grafana Cloud Portal (step 1). **Empty = export disabled**, so tests, CI and local runs need no Grafana account.                                             |
| `OTEL_EXPORTER_OTLP_HEADERS`  | `Authorization=Basic%20<base64 of instanceId:token>` (secret; step 1)                                                                                                                                                            |
| `OTEL_SERVICE_NAME`           | per process, as in the table above. `just dev-api` / `just dev-workers` set it on the command line (`api`, `jobs`, `segmentation`), so a shared `.env` value never renames a process (`scripts/test/dev-service-names.test.sh`). |
| `APP_ENV`                     | becomes the resource attribute `deployment.environment.name`, which dashboards filter by and the DLQ alert groups by. An empty value leaves the attribute off (see the note below).                                              |

An empty `APP_ENV` is kept from reaching telemetry locally: `just bootstrap` writes `local` into an
empty `APP_ENV` in `.env`, `just doctor` warns while it is empty, and `just dev-api` /
`just dev-workers` start each process with the exported value, else the `.env` value, else `local`
(`scripts/test/bootstrap-doctor.test.sh`). A process started any other way with an empty `APP_ENV`
exports without the attribute.

1. Human, once per environment: create the stack's OTLP token (`docs/SERVICES-SETUP.md` §11). Use a
   separate token per environment, so one can be revoked alone.
   - Endpoint: in the Grafana Cloud Portal (grafana.com, **My account**), click **Details** on the
     stack's card, then **Configure** on the **OpenTelemetry** tile, and copy the URL under "OTLP
     Endpoint". Copy it; never build it from a pattern. Stacks in older regions have a host such as
     `otlp-gateway-prod-<region>.grafana.net`, and regions created on or after 2026-01-15 have a
     longer one (Grafana Cloud docs, "Determine Grafana Cloud URLs based on region", checked
     2026-10-03).
   - Headers: `Authorization=Basic%20` followed by the base64 of `<Instance ID>:<token>`. The
     Instance ID is the number under "Instance ID" on the same page. Encode the pair in your own
     terminal, never one an AI agent can read, with the commands in `docs/SERVICES-SETUP.md` §11
     step 3: they read the token without showing it and store the finished header, so the token
     is never typed on a command line. `%20` is an encoded space. The
     Node and Python OTLP exporters and the CI metrics script percent-decode header values, so the
     request carries `Authorization: Basic …` while the stored value holds no space.
2. Those commands store the headers; store the endpoint with
   `just secrets-push --set OTEL_EXPORTER_OTLP_ENDPOINT` (or `just secrets-edit dev`), then
   `just secrets-sync` to write `.env`.
3. `just dev-api`, then `curl localhost:3000/v1/health`. The request shows up in Explore → Tempo within
   a minute.

## What is instrumented

- **API:** incoming HTTP (`@fastify/otel`), outgoing HTTP (undici), and pino log correlation
  (`trace_id` and `span_id` on each log record). Metrics `stylist.api.request.duration` and
  `stylist.api.request.errors`. The `pg` instrumentation sees only pg-boss's own driver. Our
  postgres.js queries (outbox relay, idempotency guard, repositories) produce no database spans.
- **Outbox relay:** one span `outbox.dispatch <event type>` per dispatched row, for example
  `outbox.dispatch demo.outbox-flow.requested.v1`.
- **Jobs:** one span `job.process <queue>` per job, for example `job.process demo.outbox-flow`. It
  continues the producer's trace from the envelope's `traceparent`. Metrics `stylist.queue.*`.
- **Segmentation worker:** the OpenTelemetry Python SDK with FastAPI instrumentation, traces only over
  OTLP. Its logs are JSON on stdout (with `correlation_id`, `trace_id`, `span_id`) and reach Loki
  only once the platform ships container logs (the Python OTel logs SDK is still in Development).
  Details: [`workers/README.md`](../../workers/README.md).
- **CI:** `stylist.ci.pr_gate_duration` and `stylist.ci.pr_gate.runs`, pushed once per run by
  `just ci-pr-gate-metrics` ([`tools/ci-metrics/`](../../tools/ci-metrics/README.md)) from the
  summary job of `.github/workflows/pr-gate.yml`, on pushes to `main` only. Pull request runs push
  nothing. The step is in the workflow, but the CI panels stay empty until the GitHub repository
  secrets `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` exist (not set as of
  2026-10-03). The headers secret must hold a separate `ci-metrics` token that can only write
  metrics, never the dev token. Without the secrets the step prints a notice, pushes nothing, and
  the gate still passes.

Span attributes, metric labels and log fields carry ids and enums only (planning/11 §8). The keys in
`packages/shared-kernel/registry/forbidden-log-keys.json` never appear. Never put a user id, event id
or other unbounded value on a **metric**: that breaks the 10k-series cap as well as privacy. Ids
belong on spans and logs.

## Metric names in PromQL

Grafana Cloud converts OTLP metrics to Prometheus names (Grafana Cloud docs, "OTLP: OpenTelemetry
Protocol format considerations", checked 2026-09-27):

- `.` and `-` become `_`, in metric and attribute names alike.
- The unit is appended (`s` becomes `_seconds`), annotation units such as `{job}` are dropped, and a
  gauge with unit `1` gets `_ratio`.
- Monotonic counters get `_total`. Explicit-bucket histograms give `_bucket`, `_sum` and `_count`.
- `service.name` becomes the labels `service_name` and `job`, and `deployment.environment.name`
  becomes `deployment_environment_name`. Other resource attributes are only on `target_info`.

| OTel instrument (fixed names)                                               | Prometheus series                                                                           | Labels                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `stylist.api.request.duration` (histogram, s)                               | `stylist_api_request_duration_seconds_bucket` / `_sum` / `_count`                           | `http_route`, `http_request_method`, `http_response_status_code` |
| `stylist.api.request.errors` (counter)                                      | `stylist_api_request_errors_total`                                                          | `http_route`, `error_class` (`5xx`)                              |
| `stylist.queue.depth` (gauge)                                               | `stylist_queue_depth`                                                                       | `queue`                                                          |
| `stylist.queue.job.age_oldest` (gauge, s)                                   | `stylist_queue_job_age_oldest_seconds`                                                      | `job_type`                                                       |
| `stylist.queue.job.completions` / `failures` / `retries` / `dlq` (counters) | `stylist_queue_job_completions_total` / `_failures_total` / `_retries_total` / `_dlq_total` | `job_type`                                                       |
| `stylist.ci.pr_gate_duration` (gauge, s)                                    | `stylist_ci_pr_gate_duration_seconds`                                                       | `workflow`, `conclusion`                                         |
| `stylist.ci.pr_gate.runs` (counter)                                         | `stylist_ci_pr_gate_runs_total`                                                             | `attempt`, `conclusion`                                          |

Every series also carries `service_name`, `job` and `deployment_environment_name`.

### Rules when you add or change a metric

The dashboards and alerts depend on these rules. Break one and a panel goes blank or an alert stays
silent.

1. Add the name to planning/14 §4 first, in the `stylist.*` namespace, with ids or enums as attributes.
2. Histograms in seconds need explicit bucket boundaries in seconds, for example
   `0.005 … 10`. The SDK's default boundaries (`0 … 10000`) are sized for milliseconds and would put
   every request in the first bucket. Keep explicit-bucket histograms: exponential ones arrive as
   native histograms with no `_bucket` series, and the latency panels read `_bucket`.
3. Register every counter at 0 for each known label value when the process starts (`add(0, …)`).
   `increase()` cannot see the first increment of a series that starts at 1, so without this the
   first dead letter after a restart would not fire `queue.job.dlq`.
4. Never use unit `1` on a gauge that is not a ratio: it would get a `_ratio` suffix.
5. Short-lived emitters (the CI step) export exactly once per run and set no per-run resource attribute
   such as `service.instance.id`. The CI panels count samples (`count_over_time`) and take quantiles
   over one series per workflow.

## Find one flow by correlation id

How the id and the trace context travel from the API through the outbox and the job to the worker:
[README.md](README.md#one-request-one-trace-one-correlation-id).

1. In Explore → Loki: `{service_name=~"api|jobs"} | correlation_id = "<id>"`. If the attribute is
   not there, fall back to `{service_name=~"api|jobs"} |= "<id>"`. Every record inside a span carries
   `trace_id`. The segmentation worker's logs are not in Loki yet (stdout only, see above); locally,
   read `just dev-workers` output for the same `correlation_id`.
2. Open that `trace_id` in Explore → Tempo. One trace shows the HTTP request, `outbox.dispatch …`,
   `job.process …` and the worker call (its span carries `correlation_id` too).
3. Useful TraceQL: `{ name = "job.process demo.outbox-flow" && status = error }` and
   `{ resource.service.name = "jobs" }`.

The worker receives the event id as `request_id` in the request body, which it does not log; its
log lines carry the `correlation_id` from `x-correlation-id`. Retention is 14 days (ADR-0007). An
older flow is gone.

## Dashboards and alerts

Files and the sync contract are in [`grafana/README.md`](grafana/README.md). Run
`just observability-sync` after changing a file, `owners.json` or an alert address. The first sync
run was on 2026-10-03: the folder, contact point, mute timings, policy, three rule groups and
dashboard 01 are in the stack. A new stack holds none of them until its first sync run.

| Object                                                                       | File                                        | Can show data or fire once synced                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard 01 Service health: API, SLO, queues                                | `grafana/dashboards/01-service-health.json` | Yes, from any environment that exports (dev today)                                                                                                                                                                        |
| Dashboard 01 CI row                                                          | same                                        | No, until the GitHub repository secrets `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` are set (not yet, 2026-10-03). pr-gate's summary job already runs `just ci-pr-gate-metrics` on each push to `main` |
| `queue.job.dlq` (SEV2) → [runbook 04](../runbooks/04-queue-dlq.md)           | `grafana/alerts/queue-job-dlq.json`         | Yes. Proof run in runbook 04.                                                                                                                                                                                             |
| `db.backup_age` (SEV2) → [runbook 02](../runbooks/02-postgresql-incident.md) | `grafana/alerts/db-backup-age.json`         | No. The metric comes with P02-T07's pgBackRest exporter; no data counts as OK until then.                                                                                                                                 |
| `host.disk` (SEV2) → [runbook 01](../runbooks/01-api-down.md)                | `grafana/alerts/host-disk.json`             | No. It needs a host with node exporter plus a collector; no data counts as OK until then.                                                                                                                                 |

Add an alert: write or extend its runbook, add `grafana/alerts/<name>.json` with the `severity` and
`owner_role` labels and the `summary` and `runbook_url` annotations, run `just observability-sync --check`,
then `just observability-sync`. During an incident, silence a noisy alert in Grafana (left-side
menu: **Alerts & IRM** → **Alerting** → **Silences**). Never edit the rule in the UI.

## SEV ladder and paging

| Severity | When (planning/14 §7)                                                                                     | Delivery                                                                                          | Acknowledge         |
| -------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------- |
| SEV1     | API hard-down, data exposure, auth bypass, hard-constraint violation, global entitlement failure          | email at any hour                                                                                 | 30 min              |
| SEV2     | error-budget fast burn, DLQ growth, drift, deletion SLA, cost guardrail, provider outage without fallback | email, muted 23:00–08:00 (`quiet-hours`); a muted alert still firing at 08:00 notifies then       | 4 h in waking hours |
| SEV3     | degradation with working fallback, flake-rate rise, cache drop, slow burn                                 | no notification (`no-page` mute); visible under **Alerts & IRM** → **Alerting** → **Alert rules** | next working day    |

- Everything goes to the contact point `ai-stylist-oncall`. Its addresses come from the sops key
  `GRAFANA_ALERT_EMAILS`, and quiet hours follow `GRAFANA_ONCALL_TIMEZONE`. Email is the only channel
  today. A push or phone app (planning/14 §7) would be one more integration in
  `grafana/contact-points.json`.
- Alert budget: at most 2 pages a week on a rolling average. Check it under **Alerts & IRM** →
  **Alerting** → **History**. Going over it means a tuning session: fix, demote or delete the noisy
  alert.

## Free-tier limits

10k active metric series, 50 GB logs and 50 GB traces a month, 14-day retention, 3 active users
(grafana.com/pricing, checked 2026-09-27 in ADR-0007). Watch usage in the Grafana Cloud portal. Any
change that would leave the free tier is an ADR (DEC-48 exit: self-hosted, on a separate failure
domain).

## Adding or changing a person

1. Add `{ "id", "name" }` to `people` in `packages/shared-kernel/registry/owners.json`, and add the id to
   the roles they take (`observability`, `feature-flags`, `on-call`). No emails in that file.
   `packages/shared-kernel` is single-writer: land it as its own change. Its tests check that every
   role member and flag owner is a declared person.
2. `just secrets-edit dev` and add the address to `GRAFANA_ALERT_EMAILS` (comma list).
3. `just secrets-sync`, then `just observability-sync`. Dashboard owners, owner tags and alert
   recipients update. No dashboard or alert file changes.
4. Human-only: invite them to the Grafana Cloud stack (3 active users on the free tier) and the
   PostHog organization, and onboard their sops key (`docs/SERVICES-SETUP.md` §2).

To remove someone, reverse the steps. Move the flags they own to another owner first, or the
registry tests fail.
