Fill every section; delete nothing; if a section truly does not apply write `N/A — <reason>`.

- **Phase / task:** P##-T## (or the phase whose deliverable is broken) · **Requirements:** REQ/NFR IDs violated
- **Type:** bug · **Skill:** `.agents/skills/testing-regression/SKILL.md` (+ the owning area skill)
- **Labels:** `type:bug`, `mod:<owner>`, `phase:P##` · **Severity:** <P1 red main | P2 user-visible | P3 cosmetic>

## Context

Where the bug was found (user report, CI lane, eval, device run), since when, and what invariant it violates. Link the phase task / SPINE section / ADR that defines the expected behaviour.

<Discovered via <…> on <date>. Expected behaviour defined in <phase §T## / SPINE §n / ADR-NNNN>>

## Reproduction

Exact, minimal steps a stranger can run. Logs with sensitive data redacted (no tokens, measurements, photos, precise coordinates, emails — doc 11 §8).

- Environment: <local | staging | production> · build/commit `<sha>` · device/OS `<…>` · account tier `<synthetic test account>`
- Steps: 1. <…> 2. <…> 3. <…>
- Expected: <…>
- Actual: <…>
- Logs / trace IDs (redacted): <…>
- Frequency: <always | intermittent (n/m runs)>

## Scope

Fix the defect at its root, not the symptom. Say what you will not touch.

- In scope: <root cause + fix>
- Out of scope: <adjacent refactors, tracked in <issue>>
- Non-goals: <…>

## Modules touched

Only SPINE §3 names: identity, profile, avatar, closet, media, outfit, context, recommendation, fashion-intel, billing, notifications, admin, assistant, shared-kernel, platform.

- Owning module: <name> · Also touched: <names or none>
- Single-writer packages touched: <contracts | shared-kernel | lockfiles | mise.toml | CI | CLAUDE.md | none>

## Acceptance criteria

Numbered; each testable with the proving command and expected output line. AC-1 is always the regression test.

1. AC-1: regression test `<tests/…spec.ts::name>` fails on `main`, passes on the fix — proof: `just test <module>` → `<n passed, 0 failed>`
2. AC-2: <original scenario now behaves as expected> — proof: `<command>` → `<expected line>`
3. AC-3: no related scenario regressed — proof: `just test <module>` full → `<expected line>`

## Architecture guardrails

The fix must not smuggle in a violation. Tick what applies; every unticked box needs a reason.

- [ ] Fix lives in the module that owns the rule (not patched in an adapter: UI, controller, DB model, SDK wrapper, job handler, hook)
- [ ] Other modules used only via `index.ts`; domain never imports provider SDKs
- [ ] `recommendation ⊥ renderer`; explanations still come from reason codes, not post-hoc text
- [ ] No new AI call to paper over a deterministic bug (deterministic before AI; doc-10 entry if truly needed)
- [ ] Single source of truth kept: no copied schema/constant/validator; generated files regenerated, not edited
- [ ] Honesty invariants intact (provenance marker + confidence; real photo never replaced)
- [ ] No security control disabled to make it pass (rate limit, signature check, isolation guard)
- [ ] `just arch-check` and `just lint --fixtures` stay green

## Search-before-write

Is there an existing validator/mapper/guard that should have caught this? Name the candidates checked by behaviour search and why the fix goes where it goes.

- Root cause (one sentence): <…>
- Candidates checked: `<path>` — reused / extended / does not fit because <…>

## Data, security, privacy

- Sensitive classes involved: <measurements | selfies/face | photos | precise location | wardrobe history | tokens/credentials | none>
- Did the bug leak or expose any of them (logs, responses, analytics)? <no | yes → incident note + rotation per doc 15 §6/§9>
- Logging / redaction impact of the fix: <…> · New env keys (`.env.example`): <none | KEY>
- `security-privacy-review` skill required: <yes — auth/consent/deletion/webhook/sensitive data | no — reason>

## Risks and rollback

- Blast radius of the fix: <modules, users, data>
- Feature flag / kill switch: <flag or `N/A — plain revert`>
- Rollback steps: <revert PR #… / migration down file if data was touched>

## Test plan

Regression-first. Tests live in the owning module's `tests/` dir; reuse `packages/test-support` / `packages/seed-data` fixtures; no skips without an issue ID.

- Regression test level + path: <unit | contract | integration | e2e> · `apps/api/src/modules/<name>/tests/<file>`
- Additional coverage for the class of bug: <…>
- Fixtures reused: <…> · Skips: none, or `<test> — issue <ID>`

## Regression test

Must fail before the fix. Paste the failing run from `main` (command + the failure lines), then the passing run after the fix. Without both, the fix is not done.

```
$ just test <module>   # on main, before fix
<paste failing output — redacted>
```

## Dependencies / blocked by

- Issues: <ID or none> · Accounts (`docs/SERVICES-SETUP.md` §<n>): <…> · P00 gates: <…>

## Definition of done

- [ ] Regression test shown failing before and passing after (both outputs pasted, never fabricated)
- [ ] Root cause stated; fix in the owning module; search-before-write recorded
- [ ] `just test <module>` · `just lint` · `just typecheck` · `just arch-check` green; `just ci-parity` green before PR
- [ ] No test skipped, deleted or weakened; flaky test quarantined only with owner + issue
- [ ] No sensitive data in the issue, logs, fixtures or PR
- [ ] Module contract / docs updated if the expected behaviour was mis-documented; `PROGRESS.md` updated
- [ ] `testing-regression` skill followed; PR uses `templates/pull-request.md`; human review
