---
name: recommendation-rules
description: Change the recommendation engine's hard constraints, soft constraints, candidate generation, scoring, tie-break rules, validation, or reason-code emission, or run its replay/simulation/eval suites after a rule or feedback change. Use for any change inside apps/api/src/modules/recommendation/, a scorer that consumes context facts or outfit types, a ruleset version bump, `just rec-replay`, `just rec-golden-update`, or a reported bad recommendation. Not for rendering the recommended outfit (the client apps), context providers or outfit mechanics that are not scoring (`backend-module`), the fashion-intel module or its trend-relevance scores (`fashion-intel-ingestion`), adding a reason code to the registry (`api-contract-change`), or displaying the reason code in the app (`ios-feature` / `android-feature`).
metadata:
  modules: recommendation
  last-reviewed: 2026-09-25
  owner-agent: recommendation-engineer
---

# Recommendation Rules and Evaluations

## Trigger

- Adding or modifying a constraint, compatibility rule, scoring weight, tie-break, context-fact consumer, reason-code emission, feedback mapping, or ruleset version in `recommendation`.
- A reported bad recommendation, an eval/replay metric regression, or a golden-fixture update request.
- State on 2026-09-25: `apps/api/src/modules/recommendation/` is a P02 skeleton (empty `RecommendationModule`, an internal README, one smoke test). P09 is `NOT_STARTED`; no ruleset, trace, or scorer code exists. `just rec-replay`, `just rec-golden-update` and `just ml-eval` are stubs that exit 2.
- Not this skill: context providers themselves (`backend-module` on `context`); `fashion-intel` and the relevance scores it exposes (`fashion-intel-ingestion`); rendering the result (the client apps); explanation display (`ios-feature` / `android-feature`); adding a reason code to the registry (`api-contract-change`, single-writer).

## Required reading

1. `planning/09-recommendation-engine.md` — stages, hard-vs-soft precedence, conflict resolution, determinism, cold-start behaviour, ruleset properties, eval metrics.
2. `docs/modules/recommendation.md` — invariants, forbidden dependencies, the `recommendation-not-renderer` rule.
3. `planning/phases/P09-recommendation-engine-v1.md` §6–§7 and §12 — P09-T02 creates the versioned ruleset config (`rulesets` table, content-hashed); T03–T09 build the stages.
4. `packages/shared-kernel/registry/reason-codes.json` — registered codes (e.g. `RC-EXCL-COLD-SAFETY`); explanations derive from the decision trace, never generated after the fact.
5. `.agents/skills/recommendation-rules/references/recommendation.md` — module reference (files, owned data, edges).

## Workflow

1. Restate the rule change: stage (exclusion / candidate gen / scoring / validation), hard or soft, precedence relative to neighbours, reason codes emitted or affected. A change that needs two owners (e.g. a new context fact) is a contract question: stop and say so.
2. Search before write:

   ```bash
   git ls-files apps/api/src/modules/recommendation apps/api/src/modules/outfit apps/api/src/modules/context
   rg -n -i '<rule noun>|<synonym>' apps/api/src/modules packages/shared-kernel/registry packages/shared-kernel/src packages/test-support/src
   rg -n '"RC-' packages/shared-kernel/registry/reason-codes.json
   ```

   Reuse an existing reason code or stop and request one; never define a code outside the registry.

3. Copy the structure from: pure rule + unit test with injected inputs → `apps/api/src/platform/tests/storage.port.test.ts` (fixed `fakeClock` from `packages/test-support/src/clock.ts`); module test → `apps/api/src/modules/recommendation/tests/recommendation.smoke.test.ts`; property tests with generated inputs have no TypeScript sibling yet (the only property tests are Python hypothesis tests in `workers/ml/segmentation/tests/test_segment.py`) — the first fast-check suite is a new pattern; name it in the report.
4. Invariants (SPINE + doc 09 + root `CLAUDE.md`): hard constraints evaluated before and re-validated after ranking — no soft signal overrides safety/practicality; deterministic (same inputs + ruleset version → same output, documented tie-breaks, no randomness, time passed in as an input); renderer-independent (no `avatar`, renderer, or 3D types; `→ outfit` is `import type` only, `recommendation-outfit-types-only`); every decision leaves a trace entry and every user-visible reason maps to a registered reason code; unknown context handled explicitly, never invented; deterministic before AI.
5. Trend influence enters only at stage 6 through the trend-relevance port (weight cap 0.03, doc 09 §4). `recommendation` may not import `fashion-intel` (`ALLOWED_EDGES` in `tools/depcruise/rules.cjs`), so the port interface lives in `packages/shared-kernel` and is bound at `apps/api/src/app.module.ts`.
6. Ruleset changes ship as a new ruleset version with a changelog, and a stored recommendation must replay from (inputs, ruleset version) via `just rec-replay <id>`. No ruleset registry exists until P09-T02; never invent its location.
7. Feedback changes: classify each signal per doc 09 and respect the overfitting guardrails — a scoring change tuned to one feedback batch is the failure mode this guards against.
8. Tests first in `apps/api/src/modules/recommendation/tests/`: unit per rule, property tests for ranking invariants (a soft signal never resurrects a hard-excluded candidate), simulation cases for the doc 09 scenario set. Regression-fails-first for a reported bad recommendation (`just test-regression <file>`). Golden fixtures change only through `just rec-golden-update` and a reviewed commit.

## Validation commands

```bash
just test recommendation
just test-regression <test-file>      # bug fix: fails at merge-base, passes at HEAD
just rec-replay <id>                  # stub (exit 2, tagged P02 T08); report "Not run: stub"
just ml-eval                          # stub (exit 2, P02-T17); report "Not run: stub", never a metric
just rec-golden-update                # stub (exit 2, tagged P02 T08); only when goldens legitimately change
just lint && just typecheck && just arch-check
just ci-parity                        # before PR
```

Report eval metric deltas before → after from real output; a scoring change with no stated metric movement is unreviewable. While the eval recipes are stubs, write that plainly.

## Output

- PR: rule diff, ruleset-version bump + changelog (once P09-T02 exists), new/updated simulation cases, eval delta table (real output) or the stub statement, reason codes used (all registered). Report in the `agent-operating-contract` format.

Done checklist: property + simulation suites green · replay reproducible or stub stated · no avatar/render import and `outfit` imports type-only · every reason code registered · eval delta pasted or stub stated · `docs/modules/recommendation.md` updated if invariants changed.

## Stop / escalation

- The task needs the ruleset registry, `rulesets` table, trace store, or replay harness before P09-T02–T09 have landed → stop and name the task; never create a registry location yourself.
- A new or renamed reason code → `api-contract-change` (single-writer `packages/shared-kernel`); stop until it lands.
- The rule needs a context fact no provider supplies → a separate `backend-module` task on `context` with its own contract.
- The rule needs trend data outside the stage-6 port, or the port interface is missing from `packages/shared-kernel` → stop; request it via `api-contract-change`.
- Any measured hard-constraint violation in evals → release blocker; do not tune around it.
- Requested behaviour needs randomness or unexplainable ranking → conflicts with SPINE; escalate.

## Overlap

Adjacent: `backend-module` (owns `outfit` and `context` mechanics that are not scoring: providers, `MissingFact`, saved outfits), `fashion-intel-ingestion` (owns `fashion-intel` and produces the relevance scores the stage-6 port exposes), `api-contract-change` (reason-code registry and the shared port interface), `ios-feature` / `android-feature` (display reason codes), `testing-regression` (bad-recommendation bug reports start there, then land here), `architecture-review` (renderer-independence check). This skill owns `apps/api/src/modules/recommendation/**` and every scoring, constraint, tie-break and reason-code emission rule, including scorers that consume `context` facts or `outfit` types.
