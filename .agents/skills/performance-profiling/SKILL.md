---
name: performance-profiling
description: Investigate or improve performance against documented budgets — API latency, job throughput, mobile startup/interaction, 3D frame time, memory, app size, AI cost/latency, CI gate duration. Use when something is slow, a budget is exceeded, or a perf claim must be verified. Measurement first, always.
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
2. Measure before touching code: fixed seed data (`packages/seed-data/`), named device tier or environment, ≥ 5 runs, median + p95. Tools by area: API — OTel traces + Postgres `EXPLAIN ANALYZE`; jobs — pg-boss job timings (Grafana job metrics), outbox queue age; mobile — React DevTools profiler, Perfetto on device; 3D — on-device frame-time capture on a low-tier device; size — bundle analyzers; CI — GHA job timings.
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

- Meeting the budget needs an architectural change (cache layer, LOD system, schema change, provider swap) → findings + options to a human/ADR.
- Budget looks wrong (unachievable on the low-tier device, or trivially loose) → propose a revision in doc 13; do not ignore it.
- Optimisation would degrade output quality → explicit human trade-off.

## Overlap

Adjacent: `native-3d-assets` (frame-time measurement on device), `media-ml-pipeline` (job throughput and AI latency), `mobile-feature` (startup/interaction), `backend-module` (query hotspots), `release-readiness` (device-matrix perf in the pre-release tier).
