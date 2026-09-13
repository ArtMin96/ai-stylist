# CLAUDE.md — AI Stylist Operating Contract

> **Status: LIVE.** This is the binding operating contract at the repository root as of 2026-09-09 (P02, task T16); the copy in `planning/CLAUDE.md` is historical context only.

This file is the permanent operating contract for every AI agent session in this repository. Phase-specific detail lives in `planning/phases/`; module detail lives in module contracts. Rules here are permanent and binding.

## Source-of-truth priority

When sources conflict, higher wins. Never resolve a conflict silently — flag it.

1. `planning/SPINE.md` + the decision log (`planning/16-risks-open-questions-and-decision-log.md`)
2. The current phase file (`planning/phases/P<NN>-*.md`)
3. The module contract of the module you are changing (`docs/modules/<name>.md`)
4. Existing code

Do not reopen decisions recorded in the decision log without new evidence; if you have new evidence, propose an ADR — do not just code the alternative.

## Repository layout (orientation)

```
apps/mobile/            React Native + Expo (TypeScript, New Architecture)
apps/mobile/src/render/ Filament 3D boundary — nothing outside imports Filament types
apps/mobile/e2e/        Maestro flows (documented test-placement exception)
apps/api/               NestJS (Fastify adapter) modular monolith
apps/api/src/modules/<name>/           one directory per SPINE domain module (13): index.ts (public API), internal/, tests/
apps/api/src/modules/<name>/tests/     that module's tests (always here)
apps/api/src/platform/  infra adapters implementing ports (storage, outbox relay, logger, OTel, provider SDKs); leaf-only
apps/api/src/jobs/      pg-boss job definitions
workers/                Python FastAPI ML/media services (Docker)
packages/contracts/     OpenAPI 3.1 + event schemas (canonical) + generated clients
packages/shared-kernel/ units, IDs, reason codes, entitlement names, event envelope — pure, depends on nothing
packages/db/            drizzle-kit config, composed schema entry, migrations/ (table definitions live in modules/<name>/internal/schema.ts)
packages/seed-data/     synthetic fixtures/factories (never real user data)
packages/test-support/  shared test builders/fakes
tools/                  depcruise/rules.cjs (arch-check), codegen/ (contract generators)
planning/               SPINE, docs 00–16, phases/, templates/  (read-only context)
docs/adr/  docs/modules/                decisions and module contracts
templates/              issue, PR, ADR, session-handoff, module-contract, phase templates
.agents/skills/         one SKILL.md per task type (see "Match a skill" below)
.github/workflows/      CI tiers; every job calls `just`, never raw tools
scripts/  justfile  mise.toml           tooling; `just` is the only entry point
```

## Session workflow

1. **Orient:** read `planning/SPINE.md` (product + architecture canon; skim if already loaded this session), `PROGRESS.md`, the current phase file, and the contract of every module in scope. Check the decision log for anything touching the task.
2. **Restate** the task's scope, non-goals, and acceptance criteria in your own words. If they are unclear, or conflict with what you read, **stop and ask** — do not guess.
3. **Match a skill:** if a skill in `.agents/skills/` covers the task type, follow its workflow; skills compose (e.g., contract change first, then module work).
4. **Search before write** (below), then implement the smallest coherent change.
5. **Verify** with the scoped checks for what you touched; paste real output.
6. **Close out:** update `PROGRESS.md` and affected docs; leave the repo buildable or report the precise failure; write a handoff note if work remains.

## Parallel sessions

- Parallel agent sessions must own **disjoint file sets**, agreed before launch; use one git worktree per session — never two agents in one working tree.
- `packages/contracts`, `shared-kernel`, lockfiles, `mise.toml`, CI config, and this file are single-writer: sequence those changes, never parallelize them.
- Producers land before consumers: contract/schema PRs merge first; dependent sessions rebase on them.

## Architectural invariants (never violate)

- **Modules** (canonical names in SPINE §3): `identity`, `profile`, `avatar`, `closet`, `media`, `outfit`, `context`, `recommendation`, `fashion-intel`, `billing`, `notifications`, `admin`, `assistant`, `shared-kernel`, `platform`.
- Import other modules **only via their public API** (`index.ts`). Never import another module's internals. `just arch-check` enforces this; do not weaken its rules.
- **No domain logic in adapters**: business rules never live in UI components, NestJS controllers, database models, provider SDK wrappers, pg-boss job handlers, or React hooks. Adapters translate; modules decide.
- **Domain never imports provider SDKs.** Providers (weather, holidays, fal.ai, RevenueCat, R2, …) sit behind ports; `platform` implements them.
- **`recommendation` ⊥ renderer:** the recommendation module must not depend on `avatar`, Filament, or any rendering concern. It returns structured results with reason codes; rendering happens elsewhere.
- **Deterministic before AI:** if rules, geometry, a query, or cached computation can solve it reliably, do not call a model. Any new AI call needs the doc-10 justification (contract, cost, cache, fallback, eval).
- **Single source of truth:** schemas in `packages/contracts` (OpenAPI 3.1), constants/units/reason codes/entitlement names in `shared-kernel`, taxonomy in `closet`. Never copy them into mobile, workers, or tests — import or regenerate (`just generate`). Never hand-edit generated files.
- **Explanations come from the decision trace** (reason codes), never generated after the fact.
- **`assistant` (future chat) only calls the same application services as every other client** — no second recommendation engine, no direct table access, no forked business logic.
- **Honesty invariants:** no "exact digital twin" claims; provenance marker + confidence on every generated view; a real user photo is never replaced by a generated one.

## Search before write (mandatory)

Before adding any function, hook, component, service, mapper, validator, schema, constant, fixture, or job:

1. Describe the behavior you intend to add (one sentence, not a name).
2. Search by behavior and structure: ripgrep with domain terms **and synonyms**; LSP workspace symbols and references; the owning module's public API and neighbors; `shared-kernel`; `packages/contracts`. Name-only search is insufficient.
3. Read the full candidates you find.
4. Reuse or extend the canonical implementation when it fits.
5. If new code is necessary, state in the PR why each candidate does not fit.

Copy-and-diverge is forbidden. So are speculative abstractions: build for the current requirement, not imagined ones. Smallest coherent change wins.

## Standard commands

Use `just` recipes only — never raw tool invocations that CI does not run. Full catalog: `planning/15-team-workflow-and-ai-agent-operations.md` §5.

- `just doctor` — environment check (run when anything is weird)
- `just dev-api` / `just dev-mobile` / `just dev-workers`
- `just test <module>` (scoped) · `just test` (full)
- `just lint` · `just typecheck` · `just format` · `just arch-check`
- `just generate` — contracts → clients (`--check` = staleness gate)
- `just db-migrate` / `just db-rollback` / `just db-reset` (local only)
- `just assets-validate` · `just ml-eval` · `just security-scan`
- `just ci-parity` — the exact PR gate, locally

Minimum before claiming done: scoped tests for every touched module + `just lint` + `just typecheck` + `just arch-check`; add `just generate --check` if contracts touched, `just assets-validate` if 3D assets touched, `just ci-parity` before opening a PR.

## AI usage in product code

- New AI-backed behavior requires the doc-10 entry: input/output schema, why deterministic code is insufficient, cost + latency budget, caching keyed on input hash, fallback when the provider is slow/unavailable/low-confidence, and an eval.
- Cache and reuse derived results with lineage; never send the same input through a paid model twice.
- Small/specialized models before large general ones; template-generated explanations from reason codes before LLM-generated prose.
- Customer data goes only to providers on the approved list (doc 10/11); default is no provider training on customer data.

## Testing rules

- Tests live in the owning module's `tests/` directory. Do not scatter test files through production source (documented framework exceptions only).
- Bug fixes require a regression test that **demonstrably fails before the fix** — run it, show the failure, then fix.
- Test observable behavior, not implementation call shapes; minimize mocking.
- Never skip, delete, or weaken a test to make CI green. A flaky test is a defect: fix it or quarantine it with an owner + linked issue.
- Reuse fixtures/factories from module test-support packages; do not duplicate them.
- Performance work requires before/after measurements from the same procedure. No measurement, no perf claim.

## Security and privacy rules

- Sensitive data: body measurements, selfies and face-derived data, photos, precise location, wardrobe history, tokens/credentials. **Never** put any of it in logs, error messages, test fixtures, seed data, prompts to AI providers not on the approved list (doc 10/11), commit messages, screenshots, or debugging output.
- Test data is synthetic. Never copy production data anywhere.
- No secrets in code or plaintext files: config comes from the environment (sops/direnv per doc 15 §6). If you see a plaintext secret, stop and report it — it must be rotated.
- Auth/authorization changes, consent flows, deletion flows, and webhook handlers require the `security-privacy-review` skill before PR.
- Never disable a security control (rate limit, signature check, RLS/isolation guard) to make something work, even temporarily.

## Prohibited without explicit human authorization

- Destructive git: force-push, history rewrite, branch deletion, `reset --hard` on shared branches.
- Destructive data: dropping/truncating tables, destructive migrations, `just db-reset` outside local, deleting user media/assets.
- Cloud/infra mutation: production deploys, secret changes, store submissions, deleting cloud resources, changing CI required checks.
- Editing this file, `planning/SPINE.md`, or workflow policy.

Ask, state exactly what will run, and wait for confirmation.

## Honesty about results

- Never fabricate or extrapolate test output, benchmark numbers, device results, eval metrics, or "it works" claims. Evidence = the actual command and its actual output.
- If you did not run it, say so. If it fails, report the precise failure.
- For fast-moving APIs (Expo/RN, Filament, Drizzle, pg-boss, Coolify, RevenueCat, store policies), consult current official docs (context7 MCP or web) instead of guessing from training data; note the doc version/date in the PR when it matters.

## Completion checklist (every task)

- [ ] Acceptance criteria restated at start; all met, with evidence pasted (real command output).
- [ ] Semantic reuse check done; new code justified against candidates.
- [ ] Scoped checks green: `just test <module>` + `lint` + `typecheck` + `arch-check` (+ `generate --check` / `assets-validate` where relevant).
- [ ] Regression test failed-then-passed for any bug fix.
- [ ] No new duplication of schemas/constants/validators/mappings; generated files regenerated, not edited.
- [ ] No sensitive data introduced into logs/fixtures/prompts/output.
- [ ] Docs updated where behavior changed (owning doc, module contract).
- [ ] `PROGRESS.md` updated with status + next step before ending the session.
- [ ] Repo left buildable (`just ci-parity` green) — or the precise failure reported with output.

## Handoff protocol

If work remains when the session ends: write a handoff note from `templates/session-handoff.md` (branch, last green command, failing command + output if red, done vs. remaining criteria, decisions made, exact next action, files touched) and link it from `PROGRESS.md`. Never end a session with unexplained red state or an untracked in-flight change.

## Project map

- `PROGRESS.md` (root) — pointer to the canonical ledger `planning/PROGRESS.md` and the current phase line; read first every session.
- `planning/SPINE.md` — product + architecture canon; `planning/16-risks-open-questions-and-decision-log.md` — decision log.
- `docs/adr/` — architecture decision records (`NNNN-slug.md`, index in `docs/adr/README.md`).
- `docs/modules/<name>.md` — one contract per SPINE module (13 domain modules + `platform` + `shared-kernel`).
- `.agents/skills/<area>/SKILL.md` — task-type procedures; index in `.agents/skills/README.md`.
