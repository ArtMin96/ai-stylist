# Observability

Two vendors, both on free tiers: Grafana Cloud in the EU, PostHog Cloud in the US (ADR-0007, DEC-48;
OQ-07 decides whether PostHog must move to EU). Everything else is files in this repo.

| Signal                                                                     | Tool                                                                                              | Configured in                                                            | Guide                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| Traces, metrics and logs from `api` and `jobs`; traces from `segmentation` | OpenTelemetry SDK → OTLP/HTTP → Grafana Cloud (Tempo, Mimir, Loki)                                | env `OTEL_EXPORTER_OTLP_*`                                               | [grafana.md](grafana.md)                             |
| Dashboards, alert rules, contact point, quiet hours, routing               | Grafana Cloud                                                                                     | [`grafana/*.json`](grafana/README.md) → `just observability-sync`        | [grafana.md](grafana.md)                             |
| Product analytics (consent-gated), native crash and error tracking         | PostHog Cloud US                                                                                  | apps' build config, [`posthog/project-settings.json`](posthog/README.md) | [posthog.md](posthog.md)                             |
| Feature flags                                                              | PostHog, declared in `packages/shared-kernel/registry/feature-flags.json`                         | registry → `just observability-sync`                                     | [posthog.md](posthog.md#feature-flags)               |
| Who owns what                                                              | `packages/shared-kernel/registry/owners.json` (roles `observability`, `feature-flags`, `on-call`) | edit the file → `just observability-sync`                                | [grafana.md](grafana.md#adding-or-changing-a-person) |
| Analytics event names                                                      | `packages/contracts/events/analytics/events.json`                                                 | contract change                                                          | [posthog.md](posthog.md#privacy-rules)               |
| Never-logged keys                                                          | `packages/shared-kernel/registry/forbidden-log-keys.json` (planning/11 §8)                        | contract change                                                          | planning/14 §2                                       |
| What to do when an alert fires                                             | [`docs/runbooks/`](../runbooks/README.md)                                                         | one runbook per alert                                                    | planning/14 §8                                       |

Decision and exit triggers: [ADR-0007](../adr/0007-observability-backend.md). Catalog of metrics,
dashboards, alerts and flags: planning/14. Vendor accounts: `docs/SERVICES-SETUP.md` §10 and §11.

## Owners model

People and roles live only in `owners.json`, with ids and display names and no contact details. Alert
recipients live only in the sops key `GRAFANA_ALERT_EMAILS` (comma list). Dashboards show owners
through the `${OWNERS:<role>}` and `${OWNER_TAGS:<role>}` tokens, and alert rules carry an
`owner_role` label. `just observability-sync` fills in the rest. No name or address sits in a
dashboard or alert file, so changing who owns or receives something needs no code change:
[the steps](grafana.md#adding-or-changing-a-person).

## One request, one trace, one correlation id

```text
client ──x-correlation-id──▶ API  span "POST /v1/…"; logs: correlation_id, trace_id
  │ same DB transaction
  ▼
platform_outbox row: envelope.correlationId + envelope.traceparent (W3C, trace context only)
  │ relay (API process)
  ▼
span "outbox.dispatch <event type>" ──▶ pg-boss job (data = the envelope)
  │ jobs process
  ▼
span "job.process <queue>"  (continues the trace from envelope.traceparent)
  │ HTTP: W3C traceparent + x-correlation-id headers; body request_id = event id
  ▼
segmentation worker span (FastAPI); logs: correlation_id, trace_id (stdout)
```

The correlation id is minted by the client for each logical operation (planning/14 §2). The API
echoes it in `x-correlation-id`, mints a UUID when it is absent or invalid, and the envelope it
appends carries that same id. The jobs process sends it on to the worker as `x-correlation-id`, and
the worker echoes it and logs it the same way. It is ours, never user data. How to follow one flow in
Loki and Tempo: [grafana.md](grafana.md#find-one-flow-by-correlation-id).

## Status (2026-09-27)

| Piece                                                      | State                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OTel wiring in `api`, `jobs` and `segmentation`            | implemented (P02-T09); exports only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. `segmentation` exports traces only; its logs stay on stdout                                                                                                                                                                                                                                          |
| `just observability-sync`                                  | implemented in `tools/observability/` and tested against local stubs; first run against Grafana and PostHog on 2026-10-03, and a second run reported every object unchanged                                                                                                                                                                                                         |
| Dashboard 01: API, SLO and queue rows                      | in the stack since the first sync (2026-10-03); shows data from any environment that exports (dev today)                                                                                                                                                                                                                                                                            |
| Dashboard 01: CI row                                       | empty until the GitHub repository secrets `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` exist (not set as of 2026-10-03). The step is already in pr-gate's summary job: on each push to `main` it runs `just ci-pr-gate-metrics` ([`tools/ci-metrics/`](../../tools/ci-metrics/README.md)), which prints a notice and pushes nothing while the secrets are missing |
| Alert `queue.job.dlq`                                      | in the stack since the first sync (2026-10-03) and fired that day in the proof run; the jobs process emits its metric ([proof run](../runbooks/04-queue-dlq.md#proof-run-injected-failure-fires-the-alert-p02-ac-6))                                                                                                                                                                |
| Alert `db.backup_age`                                      | silent (no data = OK) until P02-T07 provisions PostgreSQL, pgBackRest and its exporter                                                                                                                                                                                                                                                                                              |
| Alert `host.disk`                                          | silent (no data = OK) until a host runs node exporter and a collector (first deploy P03)                                                                                                                                                                                                                                                                                            |
| Staging and prod hosts                                     | not provisioned (P03)                                                                                                                                                                                                                                                                                                                                                               |
| PostHog prod project, persisted consent, first user events | P03                                                                                                                                                                                                                                                                                                                                                                                 |
