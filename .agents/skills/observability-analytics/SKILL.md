---
name: observability-analytics
description: Add or change OpenTelemetry metrics/traces/spans, Grafana dashboards and alert rules, PostHog product-analytics events and taxonomy, runbooks, audit-trail entries, feature-flag policy (owner, expiry, rollout plan), error budgets, or AI/infra spend alerts — the operational instrumentation catalog defined in `planning/14-observability-operations-and-analytics.md`. Use for "metric", "dashboard", "alert", "runbook", "analytics event", "PostHog", "OTel", "trace", "SLO", "p95", "error budget", "audit log"/"audit trail", a feature flag's owner/expiry/rollout plan, or a `stylist.*` metric name. Not for finding out why something is already slow — use `performance-profiling` instead; not for reviewing whether a log line or event payload leaks sensitive data — use `security-privacy-review` instead.
metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: platform-engineer
---

# Observability & Analytics

## Trigger

- Adding or changing an OTel metric, trace span, or the metrics catalog in `planning/14-observability-operations-and-analytics.md` §4.
- Adding a Grafana dashboard panel or alert rule, writing or updating a runbook, or touching the alert-budget/on-call policy (§6–§8).
- Adding or changing a PostHog product-analytics event, its schema, or its consent gating (§9).
- Adding an audit-trail entry, a feature-flag policy field, a backup/restore procedure, or an AI-cost/infra-spend guardrail (§10, §11, §13).
- Not this skill: root-causing why something is already slow (`performance-profiling` — this skill wires the dashboard/alert that _shows_ the problem, not the investigation); reviewing whether a log field or event property leaks sensitive data (`security-privacy-review` — redaction _rules_ are owned by doc 11 §8, this skill only emits within them); the pipeline code that produces the metric in the first place (`media-ml-pipeline`, `backend-module`, `recommendation-rules` — those own the emission call site, this skill owns the catalog entry, dashboard, and alert).

## Required reading

1. `planning/14-observability-operations-and-analytics.md` — the full catalog: metrics (§4), crash reporting (§5), dashboards (§6), alert severities and the alert budget (§7), runbooks (§8), analytics event taxonomy (§9), audit trails (§10), feature-flag policy (§11), error budgets (§12), backup/DR (§13), per-phase observability rule (§15).
2. `planning/11-security-privacy-and-compliance.md` §8 — the redaction rules this skill's logs/metrics/events must never violate (forbidden-field denylist, allowlist serialization).
3. `planning/13-testing-quality-and-performance.md` §12 — the latency/error-budget thresholds a dashboard or alert wires to.
4. `docs/modules/platform.md` — `platform` owns the logger, OTel init, and PostHog server wiring; nothing outside `platform` constructs these adapters directly.
5. `apps/api/src/platform/logger.ts` and `apps/api/src/platform/tests/logger.redaction.test.ts` — the current redaction canary; the native apps' analytics port and its consent gate (consent off by default, nothing recorded until opt-in) live in the iOS and Android app sources.

## Workflow

1. Restate which catalog row is being added or changed (a metric name, an event name, an alert, a runbook) and cite its doc 14 section — this skill is a sharpening pass against a fixed catalog, not a place to invent new taxonomy freely.
2. Search before write: check whether the metric/event/dashboard/runbook already exists in doc 14 or in the module contract before adding a new one; a near-duplicate metric name is a drift risk the catalog exists to prevent.
3. Metrics/traces/spans carry ids and enums only, the same redaction rules as logs (doc 11 §8, no payloads, no free text, no coordinates); a metric or span attribute that would carry a forbidden field is a stop condition, not a design choice.
4. Analytics events: consent-gated (`analytics` purpose), pseudonymous `user_id`, properties are enums/booleans/counts/ids only; the event schema lives in `packages/contracts` so mobile and backend cannot drift apart — never duplicate the event shape by hand in both places.
5. Every alert maps to a runbook before it ships (doc 14 §7 — "an alert without a runbook cannot ship"); every runbook lands under docs/runbooks/ per §8 (that directory does not exist yet — the first runbook to ship creates it).
6. Feature flags declare owner, purpose, expiry (≤ 90 days for rollout flags), rollout plan, and a safe "off" state (doc 14 §11); a flag gating a paid capability sits behind the entitlement check, never instead of it.
7. Be honest in the PR about which piece of the launch-set instrumentation (doc 14 §1, §15) is still a stub in the current phase — do not claim a dashboard or alert is live when the underlying metric is not yet emitted.

## Validation commands

```bash
just test <module>                   # the module whose metric/event emission call site changed
just lint && just typecheck          # forbidden-field lint runs as part of just lint
just generate --check                # analytics/event schema lives in packages/contracts — check it's not stale
just arch-check                      # platform stays leaf-only; no domain module constructs an OTel/PostHog adapter directly
```

No dedicated `just` recipe exists yet for dashboards, alert rules, or runbooks (P02 skeleton — Grafana/PostHog config and the future docs/runbooks/ directory are edited directly and reviewed, not generated); say so rather than inventing a command.

## Output

- PR with the catalog entry (metric/event/alert/runbook) diff, the dashboard or alert rule config, and — for a new analytics event — the `packages/contracts` schema change plus `just generate --check` output.

Done checklist: no forbidden field in any new log/metric/span/event attribute · new analytics event has a `packages/contracts` schema and a consent gate · new alert has a linked runbook and a severity per the ladder in doc 14 §7 · `PROGRESS.md` updated.

## Stop / escalation

- The task is actually "why is this slow" rather than "show me that it's slow" → hand off to `performance-profiling`; this skill builds the dashboard that investigation will use.
- A new field would carry a sensitive value (measurements, selfie/face data, photos, location, wardrobe text, tokens) → stop; `security-privacy-review` first.
- A new provider (self-hosted Grafana, Sentry activation) or leaving the Cloud free tier → ADR territory (the doc 16 decision log has the current provider decisions, e.g. DEC-48); do not just wire it in.
- Alert budget (≤ 2 pages/week) is being exceeded → that is a mandatory tuning session per doc 14 §7, not a new alert.

## Overlap

Adjacent: `performance-profiling` (root-causes what a dashboard shows; this skill wires the dashboard and alert), `security-privacy-review` (owns the redaction rules this skill's emissions must respect), `media-ml-pipeline` / `backend-module` / `recommendation-rules` (own the call sites that emit metrics/events; this skill owns the catalog entry, dashboard, and alert), `release-readiness` (consumes the crash-free-sessions and error-budget gates this skill defines).
