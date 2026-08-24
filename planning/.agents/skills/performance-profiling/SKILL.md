---
name: performance-profiling
description: Investigate or improve performance against the documented budgets — API latency, job throughput, mobile startup/interaction, 3D frame time, memory, app size, battery, AI cost/latency. Use when something is slow, a budget is exceeded, or a perf claim must be verified. Measurement first, always.
---

# Performance Profiling

## Trigger

- A budget from `planning/13-testing-quality-and-performance.md` is exceeded or suspected exceeded (CI perf gate, monitoring alert, user report of slowness/jank/heat).
- A PR claims a performance improvement (this skill verifies it).
- Phase work explicitly measuring budgets (P01 prototype gate, P14 hardening).

**Not this skill:** AI *spend* optimization strategy (doc 10 owns policy; `media-ml-pipeline` implements); render-quality tradeoffs (`native-3d-assets`, which uses this skill's measurement procedure).

## Required reading

1. `planning/13-testing-quality-and-performance.md` — the budget table (targets are hypotheses until measured), device matrix, measurement procedures.
2. `planning/14-observability-operations-and-analytics.md` — existing metrics/traces to use before adding new instrumentation.

## Workflow

1. Restate: which budget, current target, and the measurement procedure. If no budget exists for the concern, first propose one (as a hypothesis) in doc 13 terms — do not optimize toward an undefined target.
2. **Measure before touching code.** Reproducible procedure: fixed dataset/seed, named device tier or environment, ≥5 runs, report median + p95 — not a single lucky run. Tools by area:
   - API: traces + `just test`-adjacent load script per doc 13; Postgres `EXPLAIN ANALYZE` for query suspects.
   - Jobs/pipeline: Trigger.dev run timings, queue age metrics.
   - Mobile JS/UI: React DevTools profiler, Perfetto/systrace on device.
   - 3D: on-device frame-time capture per doc 07/13 procedure, low-tier device mandatory.
   - Size: platform bundle analyzers; app-size budget in doc 13.
3. Profile to the actual hotspot; write the hypothesis down before changing code.
4. Optimize the smallest thing that moves the metric. Preserve behavior — tests stay green; no correctness sacrificed for speed without an explicit human decision.
5. **Measure after**, same procedure, same environment. Improvement is the delta between the two recorded runs — never estimated, never extrapolated from a different machine.
6. Guard the win: add/extend the relevant perf regression gate (doc 13 CI tier) or a monitoring alert so the regression is caught next time.

## Validation

```bash
just test <touched-modules> && just lint && just typecheck
just ci-parity
# plus the documented measurement procedure for the metric in question (doc 13),
# with before/after output attached
```

## Output

- PR (or findings note if investigation-only) with: budget cited, before table, profile evidence for the hotspot, change description, after table, and the regression guard added. Fabricated or "roughly"-remembered numbers are prohibited (CLAUDE.md).

## Stop / escalate

- Meeting the budget requires an architectural change (caching layer, LOD system, schema change, provider swap) → stop; findings + options to a human/ADR.
- Budget appears wrong (unachievable on the low-tier device, or trivially loose) → propose a budget revision in doc 13, don't silently ignore it.
- Optimization would degrade output quality (image quality, recommendation validity) → explicit human tradeoff decision required.
