---
name: performance-profiling
description: Investigate or improve performance against documented budgets — API latency, job throughput, mobile startup/interaction, 3D frame time, memory, app size, AI cost/latency, CI gate duration. Use when something is slow, a budget from `planning/13-testing-quality-and-performance.md` is exceeded or suspected, or a PR's performance claim needs verified before/after numbers. Not for AI provider spend policy — use `media-ml-pipeline` (doc 10 owns cost budgets); not for 3D render-quality trade-offs on their own — use `native-3d-assets`, which calls this skill's measurement procedure. Measurement first, always: no before/after numbers from the same procedure, no perf claim.
metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: platform-engineer
---

# Performance Profiling

## Trigger

- A budget from `planning/13-testing-quality-and-performance.md` (or the P02 `ci.pr_gate_duration` < 10 min budget) is exceeded or suspected.
- A PR claims a performance improvement — this skill verifies it.
- Phase work that measures budgets (P01 prototype gate, P14 hardening).
- Not this skill: AI spend policy (doc 10; `media-ml-pipeline` implements); render-quality trade-offs (`native-3d-assets`, which reuses this procedure).

## Required reading

1. `planning/13-testing-quality-and-performance.md` — budget table (hypotheses until measured), device matrix, measurement procedures.
2. `planning/14-observability-operations-and-analytics.md` — existing metrics/traces (OTel → Grafana Cloud, `ci.*` metrics) to use before adding instrumentation.
3. `CLAUDE.md` "Testing rules" — performance work requires before/after measurements from the same procedure; no measurement, no perf claim.

## Workflow

1. Restate the budget, its target, and the measurement procedure. No budget? Propose one as a hypothesis in doc 13 terms first; do not optimise toward an undefined target.
2. Measure before touching code: fixed seed data (`packages/seed-data/`), named device tier or environment, ≥ 5 runs, median + p95. Exact capture procedure per surface:
   - **API** — the OTel trace span for the exact route + params under test, read from the Grafana Cloud trace view (doc 14 §2); for a suspected query hotspot, `EXPLAIN (ANALYZE, BUFFERS)` the query against the same Postgres instance the trace ran against.
   - **Jobs** — pg-boss job duration and outbox queue age for the same job type and payload shape, read from the Grafana job-metrics dashboard (doc 14 §4); exclude idempotent-retry runs from the timing set, they are not comparable.
   - **Mobile startup/interaction** — Android: an on-device `perfetto` system trace (`adb shell perfetto`) around the traced interaction on the doc 13 §7 low/mid-tier device, inspected in the Perfetto UI; iOS: since the team has no local Mac (doc 15 §3), capture via an Xcode Instruments run against a TestFlight/EAS dev-profile build on the cloud macOS lane (ADR-0002) — state in the report which lane produced the trace, and if neither is available that session, say so rather than substituting an estimate.
   - **3D frame time / memory** — on-device capture on a real low-tier Android device (doc 13 §7); `native-3d-assets` owns the exact avatar/garment scenario, this skill owns the before/after discipline.
   - **App / bundle size** — the artifact size reported by `just mobile-android-build` / `just mobile-ios-build`'s build output, compared against the doc 13 §12 size budget.
   - **CI gate duration** — the GitHub Actions job wall-clock time from the run (`gh run view`), compared against the `ci.pr_gate_duration` budget.
   - **AI cost/latency** — the doc 10 cost dashboard plus the OTel span around the provider call; never re-run a paid call just to re-measure it — use recorded spans from real traffic or an already-budgeted eval run.
3. Profile to the actual hotspot; write the hypothesis down before changing code.
4. Optimise the smallest thing that moves the metric. Behaviour preserved; tests stay green; no correctness traded for speed without a human decision.
5. Measure after with the same procedure and environment. The improvement is the delta between two recorded runs — never estimated, never from a different machine.
6. Guard the win: extend the relevant perf gate (doc 13 CI tier) or a Grafana alert.

## Validation commands

```bash
just test <touched modules> && just lint && just typecheck && just arch-check
just ci-parity
# plus the doc 13 measurement procedure for the metric, before and after, output attached
```

## Output

- PR or findings note: budget cited, before table, hotspot evidence, change, after table, regression guard added. Fabricated or "roughly remembered" numbers are prohibited (CLAUDE.md "Honesty about results").

Done checklist: before/after from the same procedure · ≥ 5 runs, median + p95 · tests green · guard added · numbers pasted verbatim.

## Stop / escalation

- **No measurement, no claim (the stop condition, not a suggestion):** if the before/after numbers cannot be captured with the same procedure on the same environment — device unavailable, provider call too costly to repeat, macOS lane unreachable for an iOS trace — stop and report the gap instead of estimating, extrapolating, or "roughly remembering" a number (CLAUDE.md "Testing rules" and "Honesty about results").
- Meeting the budget needs an architectural change (cache layer, LOD system, schema change, provider swap) → findings + options to a human/ADR.
- Budget looks wrong (unachievable on the low-tier device, or trivially loose) → propose a revision in doc 13; do not ignore it.
- Optimisation would degrade output quality → explicit human trade-off.

## Overlap

Adjacent: `native-3d-assets` (frame-time measurement on device), `media-ml-pipeline` (job throughput and AI latency), `mobile-feature` (startup/interaction), `backend-module` (query hotspots), `release-readiness` (device-matrix perf in the pre-release tier).
