# `recommendation` — module reference

Last reviewed: 2026-09-25

## Contract summary

The engine pipeline: hard/soft constraints, candidate generation, scoring, validation, reason codes, and feedback ingestion. Full contract: [`docs/modules/recommendation.md`](../../../../docs/modules/recommendation.md).

## Invariants that bite

- `recommendation-not-renderer`: must not import `apps/api/src/modules/avatar/**`, any renderer, or any 3D/asset type; `→ outfit` is `import type` only, never presentation.
- Deterministic: same inputs + same rule version → same output, documented tie-breaks, no randomness; explanations come from the decision trace (reason codes), never generated after the fact (root `CLAUDE.md`).
- This module writes only the tables it owns (doc 04 §4.2 rule 8); a ruleset change ships as a new ruleset version + changelog so a stored recommendation replays via `just rec-replay <id>`. No ruleset registry exists until P09-T02 (`rulesets` table, content-hashed config).

## Key files

- `apps/api/src/modules/recommendation/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/<name>/internal/schema.ts` — owned tables, once they exist.
- `apps/api/src/modules/recommendation/tests/` — this module's test suite, including property/simulation tests once P09 lands.

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: `recommendations`, `reason_traces`, `feedback`, rule/model versions. Table definitions, when they exist, live in `apps/api/src/modules/<name>/internal/schema.ts` and are composed from `packages/db/` (ADR-0001 §3).

## Events

None yet — P02 skeleton has no rows in the contract's Events tables. P09-T01 adds the `RecommendationResult`/`RecommendationRecord`/feedback event schemas via `packages/contracts` first.

## Allowed / forbidden edges

Allowed: public APIs of `closet`, `profile`, `context`, and `outfit` (type-only imports, `recommendation-outfit-types-only`); `packages/shared-kernel` (reason-code registry, and the trend-relevance port interface `fashion-intel` implements — the two modules may not import each other). Consumed by `assistant`. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); the `recommendation-not-renderer` edge above.

## Test command

```bash
just test recommendation
```

## Phase tasks that touch this module

`planning/phases/P09-recommendation-engine-v1.md` is the current domain phase for this module: P09-T02–T09 build the versioned ruleset, hard-rule stage, candidate generation, scorers, validation/tie-break, and replay persistence; P09-T10 adds feedback ingestion; P09-T12 adds the simulation suite and `just rec-golden-update` flow; P09-T18 covers explanation-template faithfulness. Check that phase file's §12/§19 before assuming a task id still holds.

## Escalate when

- A rule needs a context fact no provider currently supplies — that is a separate `backend-module` task on `context` with its own contract, not something to invent inline here.
- A measured hard-constraint violation shows up in an eval — release blocker per the skill's Stop / escalation section; do not tune around it.
- A reason code needs to be added or renamed — the `shared-kernel` registry is single-writer (`api-contract-change`); this module only consumes registered codes.
