---
name: recommendation-rules
description: Change the recommendation engine — hard/soft constraints, candidate generation, scoring, tie-breaks, validation, reason codes, feedback ingestion — and run its evaluation, simulation, and replay suites. Use for any change inside apps/api/src/modules/recommendation/ or its rule/model versions.
---

# Recommendation Rules and Evaluations

## Trigger

- Adding or modifying a constraint, compatibility rule, scoring weight, tie-break, context-fact consumer, reason-code emission, feedback mapping, or rule/model version in `recommendation`.
- Not this skill: context providers (`backend-module` on `context`); rendering (`native-3d-assets`); explanation display (`mobile-feature`).

## Required reading

1. `planning/09-recommendation-engine.md` — stages, hard-vs-soft precedence, conflict resolution, determinism, cold-start behaviour, eval metrics.
2. `docs/modules/recommendation.md` — invariants and the `recommendation-not-renderer` rule.
3. `packages/shared-kernel/` reason-code registry — codes are stable identifiers; explanations derive from the decision trace.
4. Current rule-version definition and the eval/simulation suite in `apps/api/src/modules/recommendation/tests/`.

## Workflow

1. Restate the rule change: stage (exclusion / candidate gen / scoring / validation), hard or soft, precedence relative to neighbours, reason codes emitted or affected.
2. Invariants (SPINE + doc 09 + CLAUDE.md): hard constraints evaluated before and re-validated after ranking — no soft signal overrides safety/practicality; deterministic (same inputs + rule version → same output, documented tie-breaks, no randomness); renderer-independent (no `avatar`, `apps/mobile/src/render/**`, Filament, or 3D types; `outfit` for item/composition types only); every decision leaves a trace entry and every user-visible reason maps to a reason code; unknown context handled explicitly, never invented; deterministic before AI.
3. Rule changes bump the rule version and update the version registry + changelog; a stored recommendation must replay from (inputs, rule version) via `just rec-replay <id>`.
4. Feedback changes: classify each signal per doc 09 and respect the overfitting guardrails.
5. Tests first in `apps/api/src/modules/recommendation/tests/`: unit per rule, fast-check property tests for ranking invariants (a soft signal never resurrects a hard-excluded candidate), simulation cases for the doc 09 scenario set. Regression-fails-first for any reported bad recommendation. Golden fixture changes go through `just rec-golden-update` and a reviewed commit.

## Validation commands

```bash
just test recommendation
just rec-replay <id>                  # reproducibility of a stored recommendation
just ml-eval                          # offline eval vs golden set (stub in P02; metrics per doc 10/09)
just rec-golden-update                # only when goldens legitimately change; reviewed separately
just lint && just typecheck && just arch-check
```

Report eval metric deltas before → after; a scoring change with no stated metric movement is unreviewable. Never fabricate metrics.

## Output

- PR: rule diff, rule-version bump + changelog, new/updated simulation cases, eval delta table (real output), reason-code additions via `shared-kernel` (single-writer: sequence with other sessions).

Done checklist: property + simulation suites green · replay reproducible · no avatar/render import · reason codes registered · eval delta pasted · `docs/modules/recommendation.md` updated if invariants changed.

## Stop / escalation

- Any measured hard-constraint violation in evals → release blocker; do not tune around it.
- Requested behaviour needs randomness or unexplainable ranking → conflicts with SPINE; escalate.
- Rule needs a context fact no provider supplies → separate `backend-module` task on `context` with its own contract.

## Overlap

Adjacent: `backend-module` (module mechanics, `context` providers), `native-3d-assets` (renders the structured result), `mobile-feature` (displays reason codes), `testing-regression` (bad-recommendation bug reports start there, then land here), `architecture-review` (renderer-independence check).
