# ADR-0007 (ADR-OBS-01) — Observability backend: OTel to Grafana Cloud free tier (EU)

- **Status:** Accepted
- **Date:** 2026-09-27
- **Deciders:** owner (Arthur Minasyan; Grafana Cloud stack and PostHog project created, regions confirmed 2026-09-27) + implementing session (P02-T09, Linear AI-17, branch `artmins96/ai-17-p02-t09-wire-observability-redaction-lint-canary-otel`)
- **Decision-log entry:** DEC-58 in [16-risks-open-questions-and-decision-log.md](../../planning/16-risks-open-questions-and-decision-log.md) _(drafted with this ADR; lands with the human-applied planning patch)_. Confirms DEC-48's Grafana Cloud and PostHog rows and records their regions for OQ-07.
- **Related:** NFR-OBS-010/020/030/050 · NFR-PERF-030 · RISK-11 (vendor lock-in) · RISK-17 (PostgreSQL recovery: backup-age alert) · OQ-07 (data residency) · [ADR-0003](0003-self-hosted-infrastructure-baseline.md) · phase P02 (T09) · [planning/14 §1, §3, §6, §7](../../planning/14-observability-operations-and-analytics.md)

## Context

P02-T09 needs a place to send OpenTelemetry traces, metrics and logs from the API, the pg-boss `jobs` process and the Python workers. It also needs a place for dashboard 1 (service health) and the first alerts (`queue.job.dlq`, backup age, disk). Doc 14 §1 already names Grafana Cloud's free tier as the pragmatic launch backend. DEC-48 keeps it only while it stays free, with self-hosting as the exit. That exit has to be a separate failure domain, never the app server (ADR-0003). ADR-OBS-01 was planned in P02 to confirm that choice. Two developers operate the system, so the backend must cost no ops time and no money at launch. The instrumentation must stay vendor-neutral (OTel SDK plus OTLP), so the export target stays swappable. Product analytics, error tracking and feature flags are not part of this choice: they stay on PostHog Cloud (DEC-21, DEC-48). PostHog is not a distributed-tracing backend.

## Options considered

| Option | Pros | Cons | Evidence (primary source + as-of date) |
| --- | --- | --- | --- |
| **A (chosen): Grafana Cloud free tier, EU region, fed by OTLP** | Nothing to operate. Tempo (traces), Mimir/Prometheus (metrics), Loki (logs), dashboards and alerting in one stack. OTLP endpoint takes the vendor-neutral SDK output unchanged. EU region fits the working OQ-07 assumption. | Free-tier caps (10k active metric series, 50 GB logs, 50 GB traces per month). 14-day retention for every signal, shorter than doc 14 §2's "30 d hot" for logs. Limited to 3 active users. Vendor lock-in for dashboards/alerts (JSON export mitigates). | grafana.com/pricing, Free tier limits, fetched 2026-09-27 |
| B: Self-hosted Grafana + Prometheus + Loki + Tempo (AGPL-3.0) on a separate node | Full control and data residency. No usage caps. Retention set by us. | A second host to patch, back up and monitor, on a 2-developer team. Must not share the app server's failure domain (ADR-0003), so it costs at least one extra server. The observability stack could itself fail silently. | ADR-0003; doc 14 §1; DEC-48 exit trigger |
| C: PostHog only (events + error tracking, no tracing backend) | One vendor fewer. | PostHog is not a distributed-tracing or metrics backend. It cannot show one trace across API → outbox → job → worker (P02 AC-6), so option C cannot meet NFR-OBS-020. | doc 14 §1 |

## Decision

Export OTel traces, metrics and logs from every server process over OTLP/HTTP to **one Grafana Cloud free-tier stack in an EU region**. Dashboards, alert rules and SEV routing live in that stack. **PostHog Cloud EU (Frankfurt)** keeps product analytics, native crash/error tracking and feature flags. Concretely:

1. Instrumentation is the OpenTelemetry SDK only: the Node SDK with individual official instrumentation libraries (http, undici, pg, pino) plus `@fastify/otel` (maintained by the Fastify authors) in the API and `jobs` processes, not the auto-instrumentations-node metapackage, and the OpenTelemetry Python SDK with the FastAPI instrumentation in `workers/ml/*`. No Grafana-specific agent or SDK runs in the application code. The export target comes from `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_HEADERS` (sops-managed per environment). An empty endpoint disables export, so local runs, tests and CI need no Grafana account.
2. Nothing observability-related runs on the app server except the SDKs inside our own processes. A future collector or agent (node exporter, pgBackRest metrics) sends to the same stack.
3. Dashboard and alert-rule definitions are version-controlled in the repository and imported into Grafana, so they survive an exit to option B. Owners come from the owners registry (`packages/shared-kernel/registry/owners.json`), not from names inside dashboards. Alert recipients live in the sops key `GRAFANA_ALERT_EMAILS`; `just observability-sync` writes them into the `ai-stylist-oncall` contact point and the owners into dashboard tags, so adding a person is one registry or secret edit plus a sync, never a code change.
4. Span attributes, metric labels and log fields follow the doc 11 §8 redaction rules: IDs and enums only, never payloads.

## Rationale

A is the only option that meets P02's observability ACs (one cross-process trace, dashboard 1, alerts) and costs neither money nor ops time now. B's benefits (retention, residency control, no caps) matter only at volumes and obligations the product does not have before launch. B also doubles the number of hosts the team must keep alive, and RISK-17 already puts that capacity under strain. C fails NFR-OBS-020 outright. The OTel-only instrumentation keeps the lock-in to Grafana confined to dashboard/alert definitions, which are exported JSON in the repo. The free-tier caps are well above skeleton volume. That is a hypothesis to re-check with real numbers at the P03 walking skeleton, not a measured fact.

## Consequences and revisit triggers

- Positive: zero hosting cost and zero ops time for observability at launch. One UI for traces, metrics, logs and alerts. The SDK-level code is vendor-neutral, so switching to option B means changing endpoint and header values only.
- Negative/accepted debt: 14-day retention on the free tier is below doc 14 §2's 30-day hot log retention. It is accepted for pre-launch because there are no users and no S1 data yet. The 3-active-user cap and usage caps bound the team size and volume the free tier can serve. The exact Grafana Cloud stack region is visible in the Grafana Cloud portal, not recorded in the repo.
- **Revisit when:** any usage would move the stack off the free tier (DEC-48 exit: self-hosted option B on a separate failure domain, never the app server). Also revisit when doc 14 §2's 30-day log retention becomes a launch requirement (P14 at the latest), when OQ-07's residency answer rejects the EU region chosen here, or when more than 3 people need Grafana access. Any reversal needs a new ADR and a new DEC entry.
