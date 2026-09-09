---
name: architecture-review
description: Review changes for module-boundary violations, duplicated behaviour, and architectural drift. Run before merging any PR that adds a file, function, schema, mapper, validator, constant, or job, or whenever equivalent behaviour may already exist in the repo.
---

# Architecture and Duplicate-Code Review

## Trigger

- A PR adds any new function, hook, component, service, mapper, validator, schema, constant, fixture, or job.
- `just arch-check` or a boundary lint rule fails, or a reviewer suspects a single-source-of-truth violation.
- An agent is about to implement behaviour and has not yet proven it does not already exist.

## Required reading

1. `CLAUDE.md` — "Architectural invariants" and "Search before write" (the rules this review enforces).
2. `planning/04-architecture.md` §4.1 (allowed-dependency DAG), §4.2 (nine binding rules), §4.4 (no `utils/`), §5 (composition roots).
3. `tools/depcruise/rules.cjs` — the encoded rules (public-api-only, no-cycles, allowed-edges-only, recommendation-not-renderer, assistant-app-services-only, domain-no-provider-sdk, platform-leaf, modules-not-platform, shared-kernel-pure, no-utils-dirs, prototype-unimportable, render-boundary, mobile/workers-not-server, composition-root-only).
4. `docs/modules/<name>.md` for every module the diff touches.

## Workflow

1. Describe the behaviour the change adds in one sentence, independent of its name.
2. Search semantically: `rg` with domain terms and synonyms; LSP references on adjacent symbols; the owning module's `index.ts` and neighbours; `packages/shared-kernel/`; `packages/contracts/`. Name-only grep is insufficient.
3. Read the complete candidates, not signatures.
4. Judge duplication: equivalent behaviour exists → require reuse/extension; a new implementation is acceptable only with a written reason per candidate in the PR. Copy-and-diverge is never acceptable.
5. Judge boundaries against every import in the diff: public `index.ts` only; no `internal/**` crossing; no provider SDK in `modules/**`; `modules/**` never imports `apps/api/src/platform/**`; `recommendation` never touches `avatar`, `apps/mobile/src/render/**`, or 3D types; `assistant` calls application services only; adapters are constructed only in composition roots; no `utils/`, `helpers/`, `common/`.
6. Judge source of truth: schemas, units, taxonomy, reason codes, entitlement names, event envelope come from `packages/contracts` / `packages/shared-kernel` / `closet`; flag any re-declared copy, and any hand-edited generated file.
7. Record each finding as a PR comment: file/line, violated rule name, compliant alternative.

## Validation commands

```bash
just arch-check                       # dependency-cruiser rules with failing fixtures
just lint                             # eslint-plugin-boundaries, no-utils, test-placement, file-size
just generate --check                 # stale generated output = re-declared truth
just test <touched modules>
```

## Output

- PR review with an explicit verdict: APPROVE or REQUEST CHANGES.
- Per duplication finding: canonical path + reuse instruction. Per boundary finding: rule + compliant import or module move.
- If a new abstraction is justified and it changes a module contract: a one-paragraph note for `docs/modules/<name>.md` and, if it overrides SPINE, an ADR proposal.

Done checklist: every new symbol has a reuse justification or a canonical reuse · `arch-check` + `lint` green · no generated file edited · verdict posted.

## Stop / escalation

- Two modules claim the same concept → SPINE §3 ownership question; escalate.
- A fix would require widening the doc 04 §4.1 graph or weakening `tools/depcruise/rules.cjs` → ADR + DEC entry, never a rule edit in the PR.
- The same duplication keeps reappearing → process problem; raise it in `PROGRESS.md` and doc 16.

## Overlap

Adjacent: `backend-module` and `mobile-feature` (produce the diffs reviewed here), `api-contract-change` (source-of-truth checks defer to it for wire shapes), `security-privacy-review` (separate lens, same PR), `testing-regression` (test placement is checked here, test quality there).
