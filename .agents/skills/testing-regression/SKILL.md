---
name: testing-regression
description: Fix a reported bug with a regression-first workflow, strengthen a module's test coverage, or resolve a flaky test. Use whenever the task is "X is broken", "add tests for Y", or CI flakiness — before touching production code.
---

# Testing and Regression Validation

## Trigger

- A bug report (user, teammate, monitoring alert) that needs a fix.
- A module's coverage is being strengthened deliberately (phase task or DoD gap).
- A test is flaky in CI (quarantine lane in the nightly tier).
- Not this skill: tests written as part of normal feature work — every skill requires those already.

## Required reading

1. `CLAUDE.md` "Testing rules" — tests in the owning `tests/`, regression must fail first, behaviour over implementation, never skip/weaken, flaky = defect.
2. `planning/13-testing-quality-and-performance.md` — pyramid per subsystem, CI tiers, flaky-test policy, fixture rules.
3. `docs/modules/<name>.md` invariants and the module's existing `tests/`; `packages/test-support/` and `packages/seed-data/` factories (reuse, never duplicate).
4. Tooling: Vitest + fast-check + Testcontainers (API/packages), Jest + RNTL + MSW (mobile), pytest + hypothesis + Schemathesis (workers), Maestro in `apps/mobile/e2e/`.

## Workflow

Bug fix (mandatory order):

1. Reproduce as a minimal failing case. Cannot reproduce → stop and report what was tried; do not "fix" what you cannot observe.
2. Write the regression test in the owning `tests/` at the lowest level that exposes the bug. Run it and paste the failure output.
3. State the root cause in one sentence. Symptom fixes are not done.
4. Fix with the smallest coherent change; search before write applies — the bug may be a drifted duplicate, fix by unifying.
5. Re-run: regression passes, scoped suite passes; sweep sibling code for the same defect class.

Coverage strengthening:

1. Map existing tests against the contract's invariants; list untested behaviours (not lines).
2. Add behaviour-level tests; minimise mocking (fake ports, real disposable Postgres for repositories). Property-based tests where doc 13 prescribes them.

Flaky test:

1. Reproduce under repetition; capture the failure mode.
2. Fix the real cause (time, ordering, shared state, network, unseeded randomness). Forbidden: deleting, `it.skip`/`xit`/`pytest.mark.skip` without an issue id (no-skip lint), blind retries, widened timeouts.
3. Unfixable now → quarantine per doc 13: marked, linked issue, named owner, deadline; noted in `PROGRESS.md`.

## Validation commands

```bash
just test <module>                    # paste both runs: failing-before and passing-after
just test                             # full suite when the fix touches shared code
just lint && just typecheck && just arch-check
just ci-parity
```

## Output

- PR: root-cause sentence, regression test + captured pre-fix failure, fix, sibling-sweep note. Flaky work: cause analysis or quarantine record.

Done checklist: failure output pasted · root cause stated · no skip without issue id · tests in `tests/` (test-placement lint) · no fixture duplication · `PROGRESS.md` updated.

## Stop / escalation

- Reproduction requires production data or a device you lack → stop; describe the missing evidence and hand off. Never copy production data.
- Root cause is architectural → fix the instance if safe, open an issue/ADR for the structure.
- The fix would weaken a test, a type, or an `arch-check` rule → wrong fix; escalate.

## Overlap

Adjacent: every implementation skill (they own feature tests; this one owns bug-driven and flake work), `recommendation-rules` (bad-recommendation reports), `performance-profiling` (perf regressions), `release-readiness` (post-halt fixes), `architecture-review` (test placement).
