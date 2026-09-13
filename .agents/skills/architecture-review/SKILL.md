---
name: architecture-review
description: Review a diff or PR for module-boundary violations, duplicated behaviour, and single-source-of-truth drift before merge — use whenever a PR adds a function, hook, component, service, mapper, validator, schema, constant, fixture, or job, whenever `just arch-check` or a boundary lint fails, or when asked "review this diff", "is this duplicated", "does this already exist", or "did I break a boundary". Not for security/privacy findings (auth, consent, sensitive data, webhooks, logging) — use `security-privacy-review` for that lens on the same PR — and not for writing the fix, which goes back to the owning engineer skill (`backend-module`, `mobile-feature`, etc.).
metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: architecture-reviewer
---

# Architecture and Duplicate-Code Review

## Trigger

- A PR adds any new function, hook, component, service, mapper, validator, schema, constant, fixture, or job.
- `just arch-check` or a boundary lint rule fails, or a reviewer suspects a single-source-of-truth violation.
- An agent is about to implement behaviour and has not yet proven it does not already exist.
- A reviewer asks "review this diff", "is this duplicated", "does this already exist", or "did I break a boundary".

## Required reading

1. `CLAUDE.md` — "Architectural invariants" and "Search before write" (the rules this review enforces).
2. `planning/04-architecture.md` §4.1 (allowed-dependency DAG), §4.2 (nine binding rules), §4.4 (no utils/ directories), §5 (composition roots).
3. `tools/depcruise/rules.cjs` — the encoded rules (public-api-only, no-cycles, allowed-edges-only, recommendation-not-renderer, assistant-app-services-only, domain-no-provider-sdk, platform-leaf, modules-not-platform, shared-kernel-pure, no-utils-dirs, prototype-unimportable, render-boundary, mobile/workers-not-server, composition-root-only) and `tools/eslint/README.md` (the quality/test-placement, local/no-skip-without-issue, quality/no-log-request-body, `no-console`, and `max-lines` lint rules).
4. `docs/modules/<name>.md` for every module the diff touches.

## Workflow

1. Describe the behaviour the change adds in one sentence, independent of its name.
2. Search semantically, not by name: `rg` with domain terms and synonyms across the owning module, neighbouring modules' `index.ts`, `packages/shared-kernel/`, `packages/contracts/`, `packages/test-support/`. Then run LSP `findReferences` on the new symbol's name and `goToDefinition`/`hover` on every candidate hit — LSP resolves the real call graph a text match can miss (a renamed export, a re-exported alias), and it is cheaper than reading every candidate file in full before you know which ones matter.
3. Read the complete candidates that LSP or `rg` surfaced, not just their signatures.
4. Judge duplication: equivalent behaviour exists → require reuse/extension; a new implementation is acceptable only with a written reason per candidate in the PR. Copy-and-diverge is never acceptable.
5. Judge boundaries against every import in the diff: public `index.ts` only; no `internal/**` crossing; no provider SDK in `modules/**`; `modules/**` never imports `apps/api/src/platform/**`; `recommendation` never touches `avatar`, `apps/mobile/src/render/**`, or 3D types; `assistant` calls application services only; adapters are constructed only in composition roots; no utils/, helpers/, or common/ dumping-ground directory anywhere.
6. Judge source of truth: schemas, units, taxonomy, reason codes, entitlement names, event envelope come from `packages/contracts` / `packages/shared-kernel` / `closet`; flag any re-declared copy, and any hand-edited generated file.
7. Record each finding using the report template in Output below — file:line, violated rule name (as `just arch-check` or the lint reports it), and the compliant alternative — so the PR comment is a direct copy of the block, never a paraphrase reconstructed later.

## Validation commands

```bash
just arch-check                       # dependency-cruiser rules with failing fixtures
just lint                             # eslint-plugin-boundaries, no-utils, test-placement, file-size
just typecheck                        # catches boundary violations a lint rule has no fixture for yet
just generate --check                 # stale generated output = re-declared truth
just docs-check                       # module-contract / ADR / skill-agent doc drift caught at review time, not after merge
just test <touched modules>
```

## Output

- A single verdict block, **APPROVE** or **REQUEST CHANGES**, using this exact shape so every reviewer (human or the `architecture-reviewer` agent) emits the same report:

  ```
  ## Architecture review — <diff or PR> — APPROVE | REQUEST CHANGES
  ### Boundary findings
  - <file:line> — rule `<name>` — <what imports what> — compliant alternative: <...>
  ### Duplication findings
  - <file:line> — <new symbol> duplicates <canonical path:line> — reuse/extend: <...>
  ### Source-of-truth findings
  - <file:line> — <re-declared value / hand-edited generated file> — canonical owner: <package>
  ### Gates
  - `just arch-check` → <actual>; `just lint` → <actual>; `just typecheck` → <actual>; `just docs-check` → <actual>
  ```

  The full report format, including the hygiene and reuse-justification rows, lives in
  `.claude/agents/architecture-reviewer.md` ("Report format") — copy that shape rather than
  inventing a second one.

- If a new abstraction is justified and it changes a module contract: a one-paragraph note for `docs/modules/<name>.md` and, if it overrides SPINE, an ADR proposal.

Done checklist: every new symbol has a reuse justification or a canonical reuse · `arch-check` + `lint` + `docs-check` green · no generated file edited · verdict posted.

## Stop / escalation

- Two modules claim the same concept → SPINE §3 ownership question; escalate.
- A fix would require widening the doc 04 §4.1 graph or weakening `tools/depcruise/rules.cjs` → ADR + DEC entry, never a rule edit in the PR.
- The same duplication keeps reappearing → process problem; raise it in `PROGRESS.md` and doc 16.
- The diff touches auth, consent, sensitive data, webhooks, or logging → hand off to `security-privacy-review` for that lens before approving.

## Overlap

Adjacent: `backend-module` and `mobile-feature` (produce the diffs reviewed here), `api-contract-change` (source-of-truth checks defer to it for wire shapes), `security-privacy-review` (separate lens, same PR — logging-check overlap: both run the `no-console` / no-log-request-body lint rules via `just lint` as a mechanical floor, but `security-privacy-review` still manually traces sensitive fields into logs/events/PostHog payloads because lint only catches literal `console.*` / `req.body`, not indirect field leakage), `testing-regression` (test placement is checked here, test quality there). This skill owns no SPINE module directly; it reviews the output of every module-owning skill.
