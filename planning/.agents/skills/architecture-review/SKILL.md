---
name: architecture-review
description: Review changes for module-boundary violations, duplicated behavior, and architectural drift. Trigger before merging any PR that adds a new file, function, schema, mapper, validator, constant, or job — or whenever an agent suspects equivalent behavior already exists somewhere in the repo.
---

# Architecture & Duplicate-Code Review

## Trigger

- A PR adds any new function, hook, component, service, mapper, validator, schema, constant, test fixture, or job.
- An agent is about to implement behavior and has not yet proven it does not already exist.
- `just arch-check` fails, or a reviewer suspects a module-boundary or single-source-of-truth violation.

## Required reading

1. `planning/SPINE.md` §3 (module table + dependency rules) — canonical module names and forbidden dependencies.
2. `planning/04-architecture.md` (allowed-dependency graph, composition roots, no-utils rule).
3. The module contract(s) of every module the diff touches (`templates/module-contract.md` instances in each module).
4. `CLAUDE.md` search-before-write workflow.

## Workflow

1. **Describe** the behavior the change adds, in one sentence, independent of its current naming.
2. **Search semantically, not just by name:** `rg` for domain terms and synonyms; LSP find-references/definitions on adjacent symbols; inspect the owning module's public `index.ts` and its neighbors; check `packages/shared-kernel` and `packages/contracts` for an existing constant/schema/validator before accepting a new one.
3. **Read the complete candidates** found — not just their signatures.
4. **Judge duplication:** if equivalent or overlapping behavior exists, require reuse or extension of the canonical implementation. A new implementation is acceptable only with a written justification in the PR of why the existing one does not fit. Copy-and-diverge is never acceptable.
5. **Judge boundaries:** every import in the diff must respect the allowed-dependency graph — public module APIs only; no domain logic in UI/controllers/adapters/jobs; `recommendation` must not import renderer/avatar internals; no provider SDK types in domain code; no additions to any `utils` dumping ground.
6. **Judge source of truth:** schemas, units, taxonomy IDs, reason codes, entitlement names, and event contracts must come from their canonical owner (`packages/contracts` / `shared-kernel`) — flag any re-declared copy.
7. Record verdicts as PR review comments: each finding names the file/line, the violated rule (SPINE §3 / CLAUDE.md invariant), and the canonical alternative.

## Validation commands

```bash
just arch-check        # dependency-cruiser + ESLint boundary rules
just lint
just generate && git diff --exit-code   # stale generated contracts = re-declared truth
just test-affected
```

## Output

- PR review with explicit verdict: APPROVE / REQUEST CHANGES.
- For each duplication finding: canonical implementation path + reuse instruction.
- For each boundary finding: violated rule + the compliant import path or module move.
- If a new abstraction is justified, a one-paragraph note for the decision log when it changes a module contract.

## Stop / escalate

- Stop and escalate to a human if: two modules both claim ownership of the same concept (SPINE §3 ambiguity), a fix would require changing a module's public contract, or the same duplication keeps reappearing (process problem, not a code problem).
- Never "fix" a boundary violation by widening the allowed-dependency graph without a decision-log entry.
