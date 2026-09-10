Fill every section; delete nothing; if a section truly does not apply write `N/A — <reason>`.

- **Phase / task:** P##-T## · **Requirements:** REQ/NFR IDs
- **Type:** contract · **Skill:** `.agents/skills/api-contract-change/SKILL.md` (runs first; consumers follow)
- **Labels:** `type:contract`, `mod:shared-kernel` and/or `mod:<owner>`, `phase:P##` · **Single-writer:** `packages/contracts` / `shared-kernel` — one session at a time

## Context

Which consumer (mobile, workers, another module) needs what, and why now. Link the phase task and the doc 06 rule that applies (`planning/06-data-api-and-event-contracts.md`).

<Consumer need: <…>. Links: `planning/phases/P##-*.md` §T## · doc 06 §<n> · ADR-NNNN · DEC-NN>

## Scope

Exactly which files under `packages/contracts/` (OpenAPI 3.1 paths/schemas, event schemas) and/or `packages/shared-kernel/` registries (reason codes, entitlement names, units, IDs, event envelope) change. Server/mobile/worker implementation is a separate consumer issue.

- In scope: <endpoints / schemas / events / registry entries>
- Out of scope: <implementation in modules; storage shape (→ Migration issue)>
- Non-goals: <…>

## Breaking?

Decide additive vs breaking with `oasdiff` (runs in the PR gate). Breaking = remove / rename / retype / semantic change → doc 06 versioning path + deprecation note + `feat(contracts)!:` with `BREAKING CHANGE:` footer.

- Classification: <additive | breaking> — `oasdiff` output summary: `<…>`
- If breaking: versioning path <vN / new event version>, deprecation window <…>, ADR: `docs/adr/NNNN-…` (required for contract-shape changes, doc 15 §8)

## Version bump

- OpenAPI `info.version` / event schema version: <from → to> · Generated client package version: <…>
- Conventional commit: `feat(contracts): …` | `feat(contracts)!: …` + `BREAKING CHANGE:` footer

## Consumers to regenerate

Every consumer of the generated output must be listed; producers land before consumers rebase.

- `gen/ts-client` (mobile): <yes/no — follow-up issue ID> · `gen/events-ts` (api): <…> · worker Pydantic models: <…>
- Server conformance in module: <name> — follow-up issue ID <…>

## Modules touched

SPINE §3 names owning the endpoint/event/registry entry.

- Owning module: <name> · Consumers: <names> · Single-writer packages: `contracts` / `shared-kernel` <+ lockfiles?>

## Acceptance criteria

1. AC-1: source edited and regenerated together — proof: `just generate --check` → `<no stale output>`
2. AC-2: spec valid — proof: spectral lint in `just lint` → `0 errors`; `oasdiff` → `<additive | breaking as declared>`
3. AC-3: one-line compatibility statement in the PR ("additive" | "breaking: vN + deprecation note") — proof: PR body
4. AC-4: consumer issues exist and are linked — proof: IDs in Consumers to regenerate

## Architecture guardrails

- [ ] Schema lives only in `packages/contracts`; constants/reason codes/entitlement names only in `shared-kernel`; taxonomy only in `closet` — nothing copied into mobile/workers/tests
- [ ] Generated files regenerated with `just generate`, never hand-edited
- [ ] Field-level contracts respect doc 11: no measurement fields in list endpoints; no sensitive fields in push/analytics payloads
- [ ] Error model, idempotency, pagination and naming follow doc 06
- [ ] Reason codes added to the registry carry the explanation template (explanations come from the decision trace)
- [ ] No provider SDK types leak into the contract; ports stay behind `platform`
- [ ] Entitlement names added only via `shared-kernel` registry; gating stays server-side
- [ ] `just arch-check` and `just lint --fixtures` stay green

## Search-before-write

Existing schema, shared enum, reason code or event that already expresses this? Search `packages/contracts` and `shared-kernel` by meaning, not name.

- Behaviour in one sentence: <…>
- Candidates checked: `<schema / enum / event>` — reused / extended / does not fit because <…>

## Data, security, privacy

- Sensitive classes exposed by the new shape: <measurements | selfies/face | photos | precise location | wardrobe history | tokens | none>; minimised how: <…>
- Logging / redaction: new fields added to the forbidden-field list (doc 11 §8) if sensitive: <…>
- New env keys (`.env.example`): <none | KEY> · Provider data-policy check: <N/A | …>
- `security-privacy-review` skill required: <yes — auth/consent/deletion/webhook payloads | no — reason>

## Risks and rollback

- Blast radius: <consumers that break if the shape is wrong; mobile versions in the field>
- Kill switch: <server keeps serving previous version until consumers migrate | N/A additive>
- Rollback steps: <revert contract PR + regenerate; deprecation reversal note>

## Test plan

- Contract tests (server conformance) in `apps/api/src/modules/<name>/tests/` · consumer typecheck via `just typecheck`
- Fixtures reused from `packages/test-support` / `packages/seed-data`: <…> · Skips: none, or `<test> — issue <ID>`

## Dependencies / blocked by

- No parallel session owns `packages/contracts` / `shared-kernel`: <confirmed by …>
- Issues: <ID or none> · P00 gates: <…>

## Definition of done

- [ ] `just generate --check` · `just lint` · `just typecheck` · `just arch-check` green; `just ci-parity` green before PR
- [ ] Contract diff + regenerated artefacts + compatibility statement in one PR; ADR if breaking
- [ ] Consumer issues created (mobile / workers / module) and linked; merge order recorded
- [ ] `docs/modules/<name>.md` public API section and `PROGRESS.md` updated
- [ ] `api-contract-change` skill followed; PR uses `templates/pull-request.md`; human review (contracts get the most senior eyes per CODEOWNERS)
