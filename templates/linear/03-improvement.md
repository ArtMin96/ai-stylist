Fill every section; delete nothing; if a section truly does not apply write `N/A — <reason>`.

- **Phase / task:** P##-T## · **Requirements:** NFR IDs (perf budget, DX, file-size NFR-TEAM-050, …)
- **Type:** improvement · **Skill:** `.agents/skills/<backend-module | ios-feature | android-feature | performance-profiling | architecture-review>/SKILL.md`
- **Labels:** `type:improvement`, `mod:<owner>`, `phase:P##` · **Kind:** <refactor | perf | DX | dependency>

## Context

Why this debt is worth paying now (blocks a phase task, budget breach, repeated friction). Link the phase task, NFR, ADR / DEC-NN, or the measurement that motivates it.

<Motivation + links: `planning/phases/P##-*.md` §T## · NFR-… · ADR-NNNN · DEC-NN · measurement <…>>

## Scope

No user-visible behaviour change. State the observable invariant that must hold before and after.

- In scope: <…>
- Out of scope: <…> (tracked in <issue>)
- Non-goals: <no behaviour change; no API/schema change unless a separate Contract/Migration issue exists>
- Behaviour invariant: <"all existing tests in <module> pass unchanged" / "API responses byte-identical for <fixtures>">

## Modules touched

Only SPINE §3 names: identity, profile, avatar, closet, media, outfit, context, recommendation, fashion-intel, billing, notifications, admin, assistant, shared-kernel, platform.

- Owning module: <name> · Also touched: <names or none>
- Single-writer packages touched: <contracts | shared-kernel | lockfiles | mise.toml | CI | CLAUDE.md | none>

## Acceptance criteria

Numbered and testable. Perf claims need before/after numbers from the same procedure — no measurement, no perf claim.

1. AC-1: behaviour invariant holds — proof: `just test <module>` → `<n passed, 0 failed>` (same count as before)
2. AC-2: <structural goal, e.g. "no file in <module> exceeds 400 lines" / "duplicate mapper removed"> — proof: `just lint` / `just arch-check` → `<expected line>`
3. AC-3 (perf only): <metric> from <X> to <Y> measured by `<just recipe / script>` on `<device/env>` — before: `<…>` after: `<…>`

## Architecture guardrails

Refactors are where boundaries erode. Tick what applies; every unticked box needs a reason.

- [ ] Public API of the module unchanged, or the change is additive and documented in `docs/modules/<name>.md`
- [ ] Other modules used only via `index.ts`; no `internal/` reach-through introduced
- [ ] No domain logic moved into adapters; domain still never imports provider SDKs
- [ ] `recommendation ⊥ renderer` preserved; reason-code explanations preserved
- [ ] No new AI call (deterministic before AI); if one is removed, evals still pass
- [ ] Single source of truth: consolidation moves code to the canonical owner (`shared-kernel`, `contracts`, `closet` taxonomy) instead of creating a second copy
- [ ] No speculative abstraction; smallest coherent change
- [ ] New runtime dependency? ADR-lite in the PR (what it replaces, why not stdlib/existing dep) per doc 15 §9
- [ ] `just arch-check` and `just lint --fixtures` stay green

## Search-before-write

Name the canonical implementation you are consolidating onto and every candidate considered, found by behaviour search (not name search).

- Behaviour in one sentence: <…>
- Candidates checked: `<path>` — canonical / merged into canonical / does not fit because <…>

## Data, security, privacy

- Sensitive classes touched: <measurements | selfies/face | photos | precise location | wardrobe history | tokens/credentials | none>
- Logging / redaction impact: <none | …> · New env keys (`.env.example`): <none | KEY>
- Provider data-policy check: <N/A | provider + result>
- `security-privacy-review` skill required: <yes — touches auth/consent/deletion/webhook/logging | no — reason>

## Risks and rollback

- What can break / blast radius: <…>
- Feature flag / kill switch: <`N/A — pure refactor, plain revert` | flag>
- Rollback steps: <revert PR #…>

## Test plan

Existing tests are the safety net; add tests only for behaviour that was untested. Tests live in the owning module's `tests/` dir.

- Existing suites that must pass unchanged: `just test <module>` · <others>
- New tests (if any) + location: <…> · Fixtures reused from `packages/test-support` / `packages/seed-data`: <…>
- Perf procedure (if perf): <recipe, env, runs, percentile> · Skips: none, or `<test> — issue <ID>`

## Dependencies / blocked by

- Issues: <ID or none> · Accounts (`docs/SERVICES-SETUP.md` §<n>): <…> · P00 gates: <…>

## Definition of done

- [ ] Behaviour invariant demonstrated (test counts / outputs pasted)
- [ ] Perf: before/after numbers from the same procedure pasted, or `N/A — not perf`
- [ ] `just test <module>` · `just lint` · `just typecheck` · `just arch-check` green; `just ci-parity` green before PR
- [ ] No duplicated schema/constant/validator/mapping introduced; generated files regenerated, not edited
- [ ] Module contract / ADR / `PROGRESS.md` updated where structure changed
- [ ] Skill followed (`.agents/skills/<area>`); PR uses `templates/pull-request.md`; human review
