Fill every section; delete nothing; if a section truly does not apply write `N/A — <reason>`.

- **Phase / task:** P##-T## (`planning/phases/P##-*.md`) · **Requirements:** REQ/NFR IDs (`planning/01-requirements-and-traceability.md`)
- **Type:** feature · **Skill:** `.agents/skills/<mobile-feature | backend-module | media-ml-pipeline | native-3d-assets | recommendation-rules | entitlements-billing>/SKILL.md`
- **Labels:** `type:feature`, `mod:<owner>`, `phase:P##`

## Context

Why now, in 2–4 sentences. Link the phase task, the SPINE section, and any ADR / DEC-NN that constrains this. A feature with no phase task is not ready.

<Why this, why now. Links: `planning/phases/P##-*.md` §T## · SPINE §<n> · ADR-NNNN · DEC-NN>

## Scope

In scope = the thin end-to-end slice (contract → module → UI → test). Out of scope and non-goals are explicit and say where deferred work is tracked.

- In scope: <…>
- Out of scope: <…> (tracked in <issue / phase>)
- Non-goals: <what this deliberately will never do>

## Modules touched

Only SPINE §3 names: identity, profile, avatar, closet, media, outfit, context, recommendation, fashion-intel, billing, notifications, admin, assistant, shared-kernel, platform. Flag single-writer packages — they are sequenced, never parallelised.

- Owning module: <name> · Also touched: <names or none>
- Single-writer packages touched: <contracts | shared-kernel | lockfiles | mise.toml | CI | CLAUDE.md | none>

## Acceptance criteria

Numbered; each objectively testable; each names the command that proves it and the expected output line. "Works on my phone" is not a criterion.

1. AC-1: <behaviour> — proof: `just test <module>` → `<expected line>`
2. AC-2: <behaviour> — proof: `<curl … | Maestro flow apps/mobile/e2e/<flow>.yaml | just ml-eval → metric ≥ X>` → `<expected line>`

## Architecture guardrails

Tick what applies; every unticked box needs a reason. Reviewer re-checks these on the PR.

- [ ] Other modules used only via their public API (`index.ts`); no `internal/` imports
- [ ] No domain logic in adapters (UI components, controllers, DB models, SDK wrappers, Trigger.dev handlers, React hooks) — adapters translate, modules decide
- [ ] Domain never imports provider SDKs; providers sit behind ports implemented in `platform`
- [ ] `recommendation ⊥ renderer`: no dependency on `avatar`, Filament, or rendering; results carry reason codes
- [ ] Deterministic before AI. New AI call? Fill the doc-10 entry: input/output schema · why deterministic is insufficient · cost + latency budget · cache key (input hash) · fallback on slow/unavailable/low-confidence · eval — or `N/A — no new AI call`
- [ ] Single source of truth: schemas from `packages/contracts`, constants/units/reason codes/entitlement names from `shared-kernel`, taxonomy from `closet`; nothing copied into mobile/workers/tests; generated files regenerated (`just generate`), never hand-edited
- [ ] Explanations come from the decision trace (reason codes), never generated after the fact
- [ ] Honesty invariants: no "exact digital twin" claims; provenance marker + confidence on every generated view; a real user photo is never replaced by a generated one
- [ ] Paid capability gated by server-side entitlements, not a UI flag
- [ ] `just arch-check` and `just lint --fixtures` stay green

## Search-before-write

Describe the behaviour (not the name), then list the candidates found by behaviour/structure search (ripgrep with synonyms, LSP symbols, owning module `index.ts` + neighbours, `shared-kernel`, `packages/contracts`) and why each does or does not fit. Copy-and-diverge is forbidden.

- Behaviour in one sentence: <…>
- Candidates checked: `<path>` — fits / does not fit because <…>

## Data, security, privacy

Name every sensitive class touched and what changes in storage, logging and egress. New config keys go into `.env.example` with a comment.

- Sensitive classes touched: <measurements | selfies/face | photos | precise location | wardrobe history | tokens/credentials | none>
- Logging / redaction impact (doc 11 §8 forbidden fields): <new logs/metrics/events and what is redacted>
- New env keys (added to `.env.example`): <KEY_NAME or none>
- Provider data-policy check (doc 11 §7.5, approved list doc 10): <provider + result or N/A>
- `security-privacy-review` skill required: <yes — auth/consent/deletion/webhook/sensitive data | no — reason>

## Risks and rollback

What breaks if this is wrong, who is affected, and the exact way back.

- What can break / blast radius: <…>
- Feature flag / kill switch (PostHog; owner, created, expiry, removal issue): <flag or `N/A — direct`>
- Rollout: <internal → beta → staged production | direct>
- Rollback steps: <flag off / revert PR #… / migration down file>

## Test plan

Levels, locations, fixtures. Tests live in the owning module's `tests/` dir (Maestro flows in `apps/mobile/e2e/`). No skipped test without a linked issue ID.

- Unit: <…> · Contract: <…> · Integration (Testcontainers): <…> · E2E (Maestro): <…>
- Test locations: `apps/api/src/modules/<name>/tests/` · `<other>`
- Fixtures reused from `packages/test-support` / `packages/seed-data`: <builders/factories>
- Skips: none, or `<test> — issue <ID>`

## Dependencies / blocked by

Issues, accounts, and gates that must land first. Producers (contract, migration) land before consumers.

- Issues: <ID or none> · Accounts (`docs/SERVICES-SETUP.md` §<n>): <…> · P00 gates (OQ-07 regions, vendor accounts): <…>

## Definition of done

- [ ] Every AC above met with pasted command output (never fabricated)
- [ ] Search-before-write recorded; new code justified against candidates
- [ ] `just test <module>` · `just lint` · `just typecheck` · `just arch-check` green (+ `just generate --check` / `just assets-validate` where relevant); `just ci-parity` green before PR
- [ ] Tests in owning `tests/` dir; no skipped tests without an issue ID
- [ ] No sensitive data in logs, fixtures, prompts, screenshots or output
- [ ] Module contract (`docs/modules/<name>.md`), ADR if a decision was made, `PROGRESS.md` updated
- [ ] Skill workflow followed: `.agents/skills/<area>/SKILL.md`; PR uses `templates/pull-request.md`; human review (AI-authored PRs are never self-merged)
