---
name: testing-regression
description: Fix a reported bug with a regression-first workflow proved by `just test-regression <file>` (or a test-first native run), strengthen a module's test coverage against its contract's invariants, or resolve a flaky test under CLAUDE.md's no-skip policy. Use whenever the task is "X is broken", "add tests for Y", a CI flake in the quarantine lane, or before touching production code for any bug fix. Not for Maestro flows, device-farm runs, golden/visual-regression baselines, or k6 load profiles — use `e2e-device-testing` instead.
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: test-engineer
---

# Testing and Regression Validation

## Trigger

- A bug report (user, teammate, monitoring alert) that needs a fix.
- A module's coverage is being strengthened deliberately (phase task or DoD gap).
- A test is flaky in CI (quarantine lane in the nightly tier).
- Not this skill: tests written as part of normal feature work (every area skill requires those);
  Maestro, device, golden and k6 work (`e2e-device-testing`).

## Required reading

1. `CLAUDE.md` "Testing rules": tests belong in the owning tests directory, a regression must fail
   first, behaviour over implementation, never skip or weaken, flaky = defect.
2. `planning/13-testing-quality-and-performance.md`: pyramid per subsystem, CI tiers, flaky-test
   policy, fixture rules.
3. `docs/modules/<name>.md` invariants and the module's existing tests directory;
   `packages/test-support/src/` and `packages/seed-data/` factories (reuse, never duplicate).
4. Tooling: Vitest + fast-check + Testcontainers (API and packages); Swift Testing
   (`import Testing`, under `apps/ios/Packages/<Pkg>/tests/<Target>Tests/`) for iOS; JUnit +
   Robolectric (each Gradle module's src/test/kotlin) for Android; pytest + hypothesis +
   Schemathesis (workers).
5. `scripts/test/regression.sh`: what `just test-regression` can run (a file inside a `package.json`
   workspace via Vitest, or under `workers/` via pytest; nothing else).

## Workflow

Bug fix (mandatory order):

1. Reproduce as a minimal failing case. Cannot reproduce → stop and report what was tried; do not
   "fix" what you cannot observe.
2. Write the regression test in the owning tests directory at the lowest level that exposes the
   bug. Do not fix the production code yet.
3. State the root cause in one sentence. Symptom fixes are not done.
4. Fix with the smallest coherent change; search before write applies (the bug may be a drifted
   duplicate: fix by unifying).
5. Prove failed-then-passed:
   - TypeScript or Python: `just test-regression <test-file>` re-runs the file at the merge-base
     with the default branch in a throwaway worktree (expects FAIL) and in your tree at HEAD
     (expects PASS), and exits 1 if either expectation is violated. Paste its output in full.
   - Swift or Kotlin (`just test-regression` has no native runner): run `just test ios` or
     `just test android` after writing the test and before the fix, keep the failing line, then
     fix, rerun and keep the passing line. Never stash or check out to fake the order.
6. Run the scoped suite (`just test <module>`) to confirm nothing else broke, then sweep for the
   same defect class: `rg -n '\b<symbol>\b' apps packages workers` for every caller and
   `rg -n 'export \{[^}]*<symbol>|as <symbol>\b' apps packages` for re-exports and aliases; read
   each hit and list the callers checked. Use LSP `findReferences` only when your tool list has it.

Coverage strengthening:

1. Map existing tests against the contract's invariants; list untested behaviours (not lines).
2. Add behaviour-level tests; minimise mocking (fake ports, real disposable Postgres via
   `packages/test-support/src/postgres.ts` for repositories). Property-based tests where doc 13
   prescribes them. A new shared builder or fake is a hand-back: `packages/test-support/**` →
   `api-engineer`, `packages/seed-data/**` → `platform-engineer`.

Flaky test:

1. Reproduce under repetition; capture the failure mode.
2. Fix the real cause (time, ordering, shared state, network, unseeded randomness). Forbidden:
   deleting, `it.skip`/`xit`/`pytest.mark.skip` without an issue id (no-skip lint), blind retries,
   widened timeouts.
3. Unfixable now → quarantine per doc 13: marked, linked issue, named owner, deadline; a
   `Suggested PROGRESS.md line` records it.

## Validation commands

```bash
just test-regression <test-file>      # TS/Python proof: fails at the merge-base, passes at HEAD — paste the raw output
just test ios                         # Swift proof: run before the fix (failing line) and after (passing line)
just test android                     # Kotlin proof: same order
just test <module>                    # scoped suite after the fix; full `just test` when shared code changed
just lint && just typecheck && just arch-check
just ci-parity
```

## Output

The `agent-operating-contract` report, with `Regression test failed-then-passed:` quoting the
failing and passing lines (or the full `just test-regression` output), the root-cause sentence, and
the sibling sweep (the `rg` commands and the callers they found) under `Self-review:`. Flaky work:
cause analysis or the quarantine record.

Done checklist: failed-then-passed proof pasted · root cause stated · sibling sweep done (`rg`
callers + re-exports) and listed · no skip without issue id · tests in the owning tests directory
(test-placement lint) · no fixture duplication · `Suggested PROGRESS.md line` given.

## Stop / escalation

- Reproduction requires production data or a device you lack → stop; describe the missing evidence
  and hand off. Never copy production data.
- Root cause is architectural → fix the instance if safe, open an issue/ADR for the structure.
- The fix would weaken a test, a type, or an `arch-check` rule → wrong fix; escalate.
- The production fix is outside your write set → hand the proven failing test to the owning
  engineer with the failing line.

## Overlap

Adjacent: every implementation skill (they own feature tests; this one owns bug-driven and flake
work), `e2e-device-testing` (Maestro/device/golden/k6 work), `recommendation-rules`
(bad-recommendation reports), `performance-profiling` (perf regressions), `release-readiness`
(post-halt fixes), `architecture-review` (checks test placement). This skill owns no production
path; its tests land in the owning module's tests directory.
