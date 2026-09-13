---
name: recommendation-rules
description: Change the recommendation engine's hard constraints, soft constraints, candidate generation, scoring, tie-break rules, validation, or reason-code emission, or run its replay/simulation/eval suites after a rule or feedback change. Use for any change inside apps/api/src/modules/recommendation/, a rule/model version bump, `just rec-replay`, `just rec-golden-update`, or a reported bad recommendation. Not for rendering the recommended outfit or 3D avatar (`native-3d-assets`), context-provider mechanics unrelated to scoring (`backend-module`), or displaying the reason code in the app (`mobile-feature`).

metadata:
  modules: recommendation
  last-reviewed: 2026-09-13
  owner-agent: recommendation-engineer
---

# Recommendation Rules and Evaluations

## Trigger

- Adding or modifying a constraint, compatibility rule, scoring weight, tie-break, context-fact consumer, reason-code emission, feedback mapping, or rule/model version in `recommendation`.
- A reported bad recommendation, an eval/replay metric regression, or a golden-fixture update request.
- Not this skill: context providers themselves (`backend-module` on `context`); rendering the result (`native-3d-assets`); explanation display (`mobile-feature`); adding a reason code to the `shared-kernel` registry (`api-contract-change`, single-writer).

## Required reading

1. `planning/09-recommendation-engine.md` — stages, hard-vs-soft precedence, conflict resolution, determinism, cold-start behaviour, eval metrics.
2. `docs/modules/recommendation.md` — invariants, forbidden dependencies, and the `recommendation-not-renderer` rule.
3. `planning/phases/P09-recommendation-engine-v1.md` — the current phase's task list and acceptance criteria for this module.
4. `packages/shared-kernel/` reason-code registry — codes are stable identifiers; explanations derive from the decision trace, never generated after the fact.
5. `.agents/skills/recommendation-rules/references/recommendation.md` — module reference (files, owned data, edges).
6. Current rule-version definition and the eval/simulation suite in `apps/api/src/modules/recommendation/tests/`.

## Workflow

1. Restate the rule change: stage (exclusion / candidate gen / scoring / validation), hard or soft, precedence relative to neighbours, reason codes emitted or affected. A change that seems to need two owners (e.g. a new context fact) is a contract question — stop and say so.
2. Invariants (SPINE + doc 09 + root `CLAUDE.md`): hard constraints evaluated before and re-validated after ranking — no soft signal overrides safety/practicality; deterministic (same inputs + rule version → same output, documented tie-breaks, no randomness); renderer-independent (no `avatar`, `apps/mobile/src/render/**`, Filament, or 3D types; `→ outfit` for item/composition types only); every decision leaves a trace entry and every user-visible reason maps to a reason code; unknown context handled explicitly, never invented; deterministic before AI.
3. Rule changes bump the rule version and update the version registry + changelog; a stored recommendation must replay from (inputs, rule version) via `just rec-replay <id>`.
4. Feedback changes: classify each signal per doc 09 and respect the overfitting guardrails — a scoring change tuned to look good on one feedback batch is the failure mode this guards against.
5. Tests first in `apps/api/src/modules/recommendation/tests/`: unit per rule, fast-check property tests for ranking invariants (a soft signal never resurrects a hard-excluded candidate), simulation cases for the doc 09 scenario set. Regression-fails-first for any reported bad recommendation. Golden fixture changes go through `just rec-golden-update` and a reviewed commit, never a manual fixture edit.

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
- A new or renamed reason code → `shared-kernel` registry change is `api-contract-change` territory (single-writer), not this skill.

## Overlap

Adjacent: `backend-module` (module mechanics, `context` providers), `native-3d-assets` (renders the structured result), `mobile-feature` (displays reason codes), `testing-regression` (bad-recommendation bug reports start there, then land here), `architecture-review` (renderer-independence check). This skill owns `recommendation`'s scoring/constraint/reason-code invariants; `backend-module` owns `outfit`, `context`, and `fashion-intel` mechanics that are not scoring-specific.
