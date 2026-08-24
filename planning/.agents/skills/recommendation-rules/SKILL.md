---
name: recommendation-rules
description: Change the recommendation engine — hard/soft constraints, candidate generation, scoring, tie-breaks, validation, reason codes, feedback ingestion — and run its evaluation/simulation suites. Use for any change inside the recommendation module or its rule/model versions.
---

# Recommendation Rules and Evaluations

## Trigger

- Adding/modifying a constraint, compatibility rule, scoring weight, tie-break, context-fact consumer, reason code emission, feedback-to-preference mapping, or rule/model version inside `recommendation`.

**Not this skill:** context providers themselves (`backend-module` on `context`); rendering the outfit (`native-3d-assets`); explanation *display* (`mobile-feature`).

## Required reading

1. `planning/09-recommendation-engine.md` — pipeline stages, hard-vs-soft precedence, conflict resolution, determinism and reproducibility rules, cold-start/sparse-closet behavior, eval metrics.
2. Reason-code registry in `shared-kernel` — codes are stable identifiers; explanations derive from the decision trace, never post-hoc.
3. Current rule version definition and the eval/simulation suite in `recommendation/tests/`.

## Workflow

1. Restate the rule change as: stage (exclusion / candidate gen / scoring / validation), hard or soft, precedence relative to neighbors, and which reason codes it emits or affects.
2. Invariants (SPINE + doc 09 — violating any is a defect):
   - **Hard constraints are evaluated before and re-validated after ranking**; no soft signal (trend, holiday, novelty) can override safety/practicality — the cold-weather-shorts case must stay impossible.
   - **Deterministic:** same inputs + same rule version → same output. No randomness; ties break by the documented deterministic tie-break; "show me something different" is an explicit mode, still constraint-safe.
   - **Renderer-independent:** structured results only; no avatar/Filament imports (`arch-check` enforces).
   - Every accepted/rejected decision leaves a trace entry; every user-visible reason maps to an emitted reason code.
   - Unknown context is handled explicitly (missing-data note / lowered confidence), never invented.
3. Rule changes bump the **rule version**; a recommendation must remain reproducible from (inputs, rule version). Update the version registry + changelog in the module.
4. Feedback-ingestion changes: classify each signal per doc 09 (hard rule / weight / session signal / eval data) and respect the overfitting guardrails (one action must not swing the profile).
5. Tests first, in `recommendation/tests/`: unit tests per rule, property tests for ranking invariants (e.g., adding a soft signal never resurrects a hard-excluded candidate), and **simulation cases** for the doc-09 scenario set (cold-holiday, laundry-unavailable, conflicting dress codes, sparse closet, future forecast). Regression-fails-first for any reported bad recommendation.

## Validation

```bash
just test recommendation                 # unit + property + simulation suites
just ml-eval --suite recommendation      # offline eval vs golden set: validity, violation rate, diversity, repetition
just lint && just typecheck && just arch-check
```

Report eval metric deltas (before → after) — a scoring change with no metric movement stated is unreviewable. Never fabricate metrics.

## Output

- PR with: rule diff, rule-version bump + changelog entry, new/updated simulation cases, eval delta table (real output), reason-code registry additions if any (via `shared-kernel`, contract-checked).

## Stop / escalate

- Any measured hard-constraint violation in evals → stop, do not tune around it; it's a release blocker.
- A requested behavior needs randomness or unexplainable ranking → conflicts with SPINE; escalate.
- Rule needs a context fact that no provider supplies → stop; provider work is a separate `backend-module` (context) task with its own contract.
