---
name: architecture-review
description: Review a diff or PR for module-boundary violations, duplicated behaviour, single-source-of-truth drift and, when both native apps are in the diff, iOS/Android parity before merge — use whenever a PR adds a function, hook, component, service, mapper, validator, schema, constant, fixture, or job, whenever `just arch-check` or a boundary lint fails, or when asked "review this diff", "is this duplicated", "does this already exist", or "did I break a boundary". Not for security/privacy findings (auth, consent, sensitive data, webhooks, logging) — use `security-privacy-review` for that lens on the same PR — and not for writing the fix, which goes back to the owning engineer skill (`backend-module`, `ios-feature` / `android-feature`, etc.).
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: architecture-reviewer
---

# Architecture and Duplicate-Code Review

## Trigger

- A PR adds any new function, hook, component, service, mapper, validator, schema, constant,
  fixture, or job.
- `just arch-check` or a boundary lint rule fails, or a reviewer suspects a single-source-of-truth
  violation.
- The lead integrated two app lanes and needs the boundary, duplication and parity lens on the
  integrated diff (`cross-platform-feature` step 9).
- A reviewer asks "review this diff", "is this duplicated", "does this already exist", or "did I
  break a boundary".
- A finding needs an ADR (a wider dependency graph, a weaker rule, a SPINE override): this skill
  drafts the proposal; a human decides.

## Required reading

1. `CLAUDE.md` "Architectural invariants" and "Search before write" (the rules this review enforces).
2. `planning/04-architecture.md` §4.1 (allowed-dependency DAG), §4.2 (binding rules), §4.4 (no
   utils/ directories), §5 (composition roots).
3. `tools/depcruise/rules.cjs`: every rule, listed with `rg -n "name: '" tools/depcruise/rules.cjs`;
   `tools/eslint/README.md` (test-placement, no-skip-without-issue, no-log-request-body,
   `no-console`, `max-lines`).
4. Native rules: `apps/ios/scripts/check-banned.sh` (its `RULES` list) and `ALLOWED_MODULE_EDGES` in
   `apps/android/build-logic/convention/src/main/kotlin/RootConventionPlugin.kt`.
5. `docs/modules/<name>.md` for every module the diff touches.
6. Both apps in the diff: `.agents/skills/cross-platform-feature/SKILL.md` step 8 (parity commands)
   and the lead's brief. An ADR is needed: `templates/adr.md` and `docs/adr/README.md`.

## Workflow

1. Fix the scope. A PR or branch: `git diff <base>...HEAD --stat` then `git diff <base>...HEAD`.
   A working tree: `git diff HEAD --stat`, `git diff HEAD` and `git status --porcelain`; read every
   untracked (`??`) file in full, since `git diff` never shows new files.
2. Describe the behaviour each new symbol adds in one sentence, independent of its name.
3. Search semantically, not by name, with the `agent-operating-contract` step 4 commands across the
   owning module, neighbouring modules' `index.ts`, `packages/shared-kernel/`, `packages/contracts/`
   and `packages/test-support/`. For each new symbol find callers with
   `rg -n '\b<symbol>\b' apps packages workers` and re-exports or aliases with
   `rg -n 'export \{[^}]*<symbol>|as <symbol>\b' apps packages`. Use LSP `findReferences` only
   when your tool list has it.
4. Read the complete candidates, not just their signatures.
5. Judge duplication: equivalent behaviour exists → require reuse/extension; a new implementation is
   acceptable only with a written reason per candidate in the PR. Copy-and-diverge is never
   acceptable.
6. Judge boundaries against every import in the diff:
   - TypeScript: public `index.ts` only; no `internal/**` crossing; no provider SDK in `modules/**`;
     `modules/**` never imports `apps/api/src/platform/**`; `recommendation` never touches
     `avatar`, a renderer, or 3D types; `assistant` calls application services only; adapters are
     constructed only in composition roots; no utils/, helpers/, or common/ directory anywhere.
     Name the violated rule exactly as `just arch-check` prints it.
   - iOS: each `check-banned.sh` rule (`unchecked-sendable`, `nonisolated-unsafe`,
     `preconcurrency-import`, `ui-import-in-core`, `api-import-outside-apidata`); features depend on
     `AppServices` protocols, never on `APIData`; adapters only in `apps/ios/App/CompositionRoot.swift`.
   - Android: a new edge in `ALLOWED_MODULE_EDGES` is its own reviewed change; features never depend
     on each other; only `:core:data` sees `:core:api-client`; `AppContainer` alone builds adapters.
7. Judge source of truth: schemas, units, reason codes, entitlement names and the event envelope come
   from `packages/contracts` and `packages/shared-kernel` (registries in
   `packages/shared-kernel/registry/*.json`; native apps use the generated `AIStylistKernel` and
   `app.aistylist.contracts.kernel`); taxonomy from `closet`. Flag any re-declared copy and any edit
   under `packages/contracts/gen/` or `packages/shared-kernel/src/gen/`. iOS analytics names are
   hand-written and must equal `packages/contracts/events/analytics/events.json` byte for byte.
8. Hygiene: tests in the owning tests directory (or the documented native and `e2e/` exceptions);
   `docs/modules/<name>.md` updated when the public surface changed; a `Suggested PROGRESS.md line`
   present.
9. Parity (only when the diff touches both `apps/ios/**` and `apps/android/**`): run the
   `cross-platform-feature` step 8 commands and compare states, strings, ids, analytics events,
   client operations and failure → state mapping against the brief.
10. ADR proposal (a finding that needs a wider doc 04 §4.1 graph, a weaker rule, or a SPINE
    override): draft it from `templates/adr.md` with the next number after the highest in
    `ls docs/adr`, plus a proposed DEC row for
    `planning/16-risks-open-questions-and-decision-log.md`. Put the draft under `Blockers:` for a
    human; this review writes no file.

## Validation commands

```bash
just arch-check                       # dependency-cruiser rules, iOS bans, Android module graph (with failing fixtures)
just lint                             # eslint boundaries, test-placement, no-skip, file-size, native lint lanes
just typecheck                        # catches boundary violations a lint rule has no fixture for yet
just generate --check                 # stale generated output = re-declared truth
just docs-check                       # module-contract / ADR / skill-agent doc drift caught at review time
just test <touched modules>
```

## Output

The `agent-operating-contract` reviewer variant: the header with the verdict word, the `Agent:`
line, these sections (write `none` under an empty one), then its last three lines:

```
## Architecture review of <diff or PR> — APPROVE | CHANGES REQUESTED
Agent: architecture-reviewer · Base: <sha> · Worktree: <path | main checkout> · Branch: <name>
### Boundary findings
- <file:line> — rule `<name>` — <what imports what> — compliant alternative: <…>
### Duplication findings
- <file:line> — <new symbol> duplicates <canonical path:line> — reuse/extend: <…>
### Source-of-truth findings
- <file:line> — <re-declared value | hand-edited generated file> — canonical owner: <package>
### Hygiene
- <file:line> — <test placement | contract not updated | PROGRESS line missing> — owner: <agent>
### Reuse justification check
- <new symbol> — <reason given per candidate | missing>
### Parity (both apps in scope)
- <state|string|id|event|operation|failure mapping> — iOS <file:line> vs Android <file:line> — match | mismatch → <lane>
### Gates
- just arch-check → <actual>; just lint → <actual>; just typecheck → <actual>; just docs-check → <actual>
```

Done checklist: every new symbol has a reuse justification or a canonical reuse · gates run or
listed under `Not run:` · no generated file edited · parity section filled when both apps changed
· verdict in the header.

## Stop / escalation

- Two modules claim the same concept → SPINE §3 ownership question; escalate.
- A fix would require widening the doc 04 §4.1 graph or weakening `tools/depcruise/rules.cjs`,
  `check-banned.sh` or `ALLOWED_MODULE_EDGES` → ADR proposal (step 10) + DEC entry, never a rule
  edit in the PR.
- The same duplication keeps reappearing → process problem; raise it as a `Suggested PROGRESS.md
line` and a doc 16 entry for a human.
- The diff touches auth, consent, sensitive data, webhooks, or logging → hand off to
  `security-privacy-review` for that lens before approving.

## Overlap

Adjacent: `backend-module` and `ios-feature` / `android-feature` (produce the diffs reviewed here),
`cross-platform-feature` (the lead runs this review on the integrated diff; its step 8 supplies the
parity commands), `api-contract-change` (wire-shape questions defer to it), `security-privacy-review`
(separate lens on the same PR; both use `just lint` as the mechanical floor for `no-console` and
no-log-request-body, while that skill still traces sensitive fields by hand), `testing-regression`
(test quality; placement is checked here). This skill owns no path; it reviews the output of every
module-owning skill.
