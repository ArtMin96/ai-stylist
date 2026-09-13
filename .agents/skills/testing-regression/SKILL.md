---
name: testing-regression
description: Fix a reported bug with a regression-first workflow proved by `just test-regression <file>`, strengthen a module's test coverage against its contract's invariants, or resolve a flaky test under CLAUDE.md's no-skip policy. Use whenever the task is "X is broken", "add tests for Y", a CI flake in the quarantine lane, or before touching production code for any bug fix. Not for Maestro flows, device-farm runs, golden/visual-regression baselines, or k6 load profiles — use `e2e-device-testing` instead.

metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: test-engineer
---

# Testing and Regression Validation

## Trigger

- A bug report (user, teammate, monitoring alert) that needs a fix.
- A module's coverage is being strengthened deliberately (phase task or DoD gap).
- A test is flaky in CI (quarantine lane in the nightly tier).
- Not this skill: tests written as part of normal feature work — every skill requires those already.

## Required reading

1. `CLAUDE.md` "Testing rules" — tests belong in the module's own tests/ directory, a regression must fail first, behaviour over implementation, never skip/weaken, flaky = defect.
2. `planning/13-testing-quality-and-performance.md` — pyramid per subsystem, CI tiers, flaky-test policy, fixture rules.
3. `docs/modules/<name>.md` invariants and the module's existing tests/ directory; `packages/test-support/` and `packages/seed-data/` factories (reuse, never duplicate).
4. Tooling: Vitest + fast-check + Testcontainers (API/packages), Jest + RNTL + MSW (mobile), pytest + hypothesis + Schemathesis (workers). Maestro E2E flows in `apps/mobile/e2e/`, golden/visual regression, and k6 load profiles are `e2e-device-testing`'s territory, not this skill's.

## Workflow

Bug fix (mandatory order):

1. Reproduce as a minimal failing case. Cannot reproduce → stop and report what was tried; do not "fix" what you cannot observe.
2. Write the regression test in the owning tests/ directory at the lowest level that exposes the bug — do not fix the production code yet.
3. State the root cause in one sentence. Symptom fixes are not done.
4. Fix with the smallest coherent change; search before write applies — the bug may be a drifted duplicate, fix by unifying.
5. Run `just test-regression <test-file>` (`scripts/test/regression.sh`): it re-runs the file at the merge-base with the default branch in a throwaway worktree — expecting FAIL, since the fix isn't there — and again in your working tree at HEAD — expecting PASS — and exits 1 if either expectation is violated. Paste its output in full. This is the mechanical proof for CLAUDE.md's "demonstrably fails before the fix" rule; a manually narrated before/after is not a substitute.
6. Run the scoped suite (`just test <module>`) to confirm nothing else broke, then sweep sibling code for the same defect class with a concrete method, not a vague scan: `rg` for other call sites sharing the buggy call shape (same function name and argument pattern), then LSP `findReferences` on the symbol you fixed to check every caller — not just the one named in the bug report.

Coverage strengthening:

1. Map existing tests against the contract's invariants; list untested behaviours (not lines).
2. Add behaviour-level tests; minimise mocking (fake ports, real disposable Postgres for repositories). Property-based tests where doc 13 prescribes them.

Flaky test:

1. Reproduce under repetition; capture the failure mode.
2. Fix the real cause (time, ordering, shared state, network, unseeded randomness). Forbidden: deleting, `it.skip`/`xit`/`pytest.mark.skip` without an issue id (no-skip lint), blind retries, widened timeouts.
3. Unfixable now → quarantine per doc 13: marked, linked issue, named owner, deadline; noted in `PROGRESS.md`.

## Validation commands

```bash
just test-regression <test-file>      # mandatory proof: fails at the merge-base, passes at HEAD — paste the raw output
just test <module>                    # scoped suite after the fix; full `just test` when shared code changed
just lint && just typecheck && just arch-check
just ci-parity
```

## Output

- PR: root-cause sentence, the full `just test-regression <file>` output, the fix, and the sibling-sweep note (the `rg` search and the `findReferences` result). Flaky work: cause analysis or quarantine record.

Done checklist: `just test-regression <file>` output pasted in full · root cause stated · sibling sweep done (`rg` + LSP `findReferences`) and noted · no skip without issue id · tests placed in the owning tests/ directory (test-placement lint) · no fixture duplication · `PROGRESS.md` updated.

## Stop / escalation

- Reproduction requires production data or a device you lack → stop; describe the missing evidence and hand off. Never copy production data.
- Root cause is architectural → fix the instance if safe, open an issue/ADR for the structure.
- The fix would weaken a test, a type, or an `arch-check` rule → wrong fix; escalate.

## Overlap

Adjacent: every implementation skill (they own feature tests; this one owns bug-driven and flake work), `e2e-device-testing` (Maestro/device/golden/k6 work; this skill owns unit/integration bug fixes and flakes only), `recommendation-rules` (bad-recommendation reports), `performance-profiling` (perf regressions), `release-readiness` (post-halt fixes), `architecture-review` (test placement).
