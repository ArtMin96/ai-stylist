# PR — <Short title>

**Issue:** #<n> · **Phase/task:** P##-T## · **Modules touched:** <SPINE §3 names>

## What and why

<2–5 sentences. Link the issue instead of restating it.>

## Scope check

- [ ] Restated scope + acceptance criteria from the issue before coding
- [ ] Searched for existing/overlapping behavior before adding anything new (semantic search, not name-only); reused or explained why not
- [ ] Smallest coherent change; no speculative abstractions
- [ ] Only public module APIs used; boundaries respected (`just arch-check` clean)
- [ ] No duplicated schemas/constants/validators/mappings — canonical owner updated instead

## Tests and evidence

- [ ] Tests added in owning module's `tests/` dir; levels: <unit/contract/integration/…>
- [ ] For bug fixes: regression test shown failing before the fix (link to run)
- [ ] `just test <scope>` · `just lint` · `just typecheck` all pass locally — no skipped tests
- Evidence (device runs, screenshots, eval/metric output — never fabricated): <links>

## Data, security, privacy

- [ ] No sensitive data in logs, fixtures, prompts, or screenshots
- [ ] Migrations are reversible; rollback path stated below
- [ ] Contracts/generated clients regenerated if schemas changed (CI stale-generation check green)

## Rollout / rollback

<Flag, migration order, staged rollout / exact revert steps — or "Direct + simple revert".>

## Docs / ledger

- [ ] Module contracts, planning docs, and [PROGRESS.md](../planning/PROGRESS.md) updated where this PR changes reality
