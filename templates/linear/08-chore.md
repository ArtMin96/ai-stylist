Fill every section; delete nothing; if a section truly does not apply write `N/A — <reason>`.

- **Phase / task:** P##-T## · **Requirements:** NFR-TEAM / NFR-OPS IDs
- **Type:** chore · **Skill:** `.agents/skills/<release-readiness | architecture-review | testing-regression>/SKILL.md` or `N/A — tooling only`
- **Labels:** `type:chore`, `mod:platform` (or owner), `phase:P##` · **Kind:** <account/vendor | CI | tooling | dependency | docs | ops>

## Context

Why now (phase gate, CI red, onboarding, vendor requirement). Link the phase task and the `docs/SERVICES-SETUP.md` section if a vendor/account is involved.

<Motivation + links: `planning/phases/P##-*.md` §T## · `docs/SERVICES-SETUP.md` §<n> · doc 15 §<n> · DEC-NN>

## Scope

- In scope: <…>
- Out of scope: <…> (tracked in <issue>)
- Non-goals: <no product behaviour change; no cloud/infra mutation beyond what is listed under Human-only steps>

## Human-only steps

Agents never do these (doc 15 §12.6, CLAUDE.md "Prohibited without explicit human authorization"). List each with who does it and how completion is verified.

- <e.g. create vendor account / accept ToS / enter payment method / rotate secret / change CI required checks / production deploy / store submission> — owner: <human> — verified by: <`just doctor` line / dashboard screenshot without secrets>
- Or `N/A — no human-only steps`

## Secrets involved

Names only. Values never appear in issues, PRs, logs or commits; they live in sops (`secrets/<env>.enc.yaml`) or GitHub encrypted secrets per doc 15 §6.

- Key names: <e.g. `COOLIFY_TOKEN`, `EAS_TOKEN`> · Added to `.env.example` with a comment: <yes/no> · Envs: <local | dev | staging | prod | CI>
- Rotation owner + trigger: <…> · Or `N/A — no secrets`

## Modules touched

- Areas: <CI (`.github/workflows`) | `justfile`/`scripts` | `mise.toml` | lockfiles | `tools/` | docs | SPINE module name>
- Single-writer packages touched (sequence, never parallelise): <contracts | shared-kernel | lockfiles | mise.toml | CI | CLAUDE.md | none>

## Acceptance criteria

1. AC-1: <outcome> — proof: `just doctor` → `<expected line>`
2. AC-2: <outcome> — proof: `just ci-parity` → `<green>` / CI run link
3. AC-3: docs record what was created (IDs, region, plan) without secrets — proof: `docs/SERVICES-SETUP.md` §<n> "What to record" filled

## Architecture guardrails

- [ ] CI jobs call `just` recipes only, never raw tools; `just ci-parity` still mirrors the PR gate
- [ ] No weakening of `just arch-check`, lint rules, `just lint --fixtures`, security scans, or required checks
- [ ] New dependency / GitHub Action pinned and justified (doc 15 §9: what it replaces, why not existing); lockfiles frozen in CI
- [ ] Config comes from environment; no plaintext secret anywhere (gitleaks stays green)
- [ ] No domain logic added to scripts/tooling; single source of truth untouched (no copied constants)
- [ ] Region / vendor choices deferred to P00 / OQ-07 unless that gate is passed
- [ ] `CLAUDE.md`, `planning/SPINE.md`, workflow policy not edited without human authorization

## Search-before-write

Existing recipe, script, workflow job or doc section that already does this?

- Candidates checked: `justfile:<recipe>` / `scripts/<…>` / `.github/workflows/<…>` — reused / extended / does not fit because <…>

## Data, security, privacy

- Sensitive classes touched: <none | tokens/credentials | …>
- Logging / CI output: secrets masked; no tokens in job logs or `just doctor` output: <verified how>
- Provider data-policy check for any new vendor (doc 11 §7.5): <N/A | result> · New env keys (`.env.example`): <list>
- `security-privacy-review` skill required: <yes — CI secrets / webhook / auth tooling | no — reason>

## Risks and rollback

- What can break: <CI red for everyone, builds, dev environment> · Blast radius: <…>
- Rollback steps: <revert PR #… / disable workflow / restore previous pin / rotate key>

## Test plan

- Verification commands: `just doctor` · `just ci-parity` · <recipe-specific> · shellcheck via `just lint`
- CI: <run link on a branch before merge> · Skips: none, or `<job> — issue <ID>`

## Dependencies / blocked by

- Accounts (`docs/SERVICES-SETUP.md` §<n>): <…> · Human-only steps above: <owner> · P00 gates (OQ-07 regions, vendor accounts): <…> · Issues: <ID or none>

## Definition of done

- [ ] All AC met with pasted output; human-only steps confirmed by the human
- [ ] `just ci-parity` green; `just doctor` green on a fresh checkout
- [ ] Secrets in sops / GitHub encrypted secrets only; `.env.example` updated; nothing plaintext in the repo
- [ ] `docs/SERVICES-SETUP.md` "What to record" / doc 15 / `PROGRESS.md` updated
- [ ] Skill followed where one applies; PR uses `templates/pull-request.md`; human review
