---
name: testing-regression
description: Fix a reported bug with a regression-first workflow, strengthen test coverage for a module, or deal with a flaky test. Use whenever the task is "X is broken", "add tests for Y", or CI flakiness — before touching any production code.
---

# Testing and Regression Validation

## Trigger

- A bug report (user, teammate, monitoring) that needs a fix.
- A module's coverage is being deliberately strengthened (phase task or DoD gap).
- A test is flaky (intermittently failing in CI).

**Not this skill:** writing tests as part of normal feature work — every skill already requires that; this skill is for bug-driven and test-focused tasks.

## Required reading

1. `planning/13-testing-quality-and-performance.md` — test pyramid per subsystem, CI tiers, flaky-test policy, fixture/factory rules.
2. The owning module's contract and its existing `tests/` directory + test-support package (reuse factories; never duplicate fixtures).

## Workflow — bug fix (regression-first, mandatory order)

1. Reproduce: turn the report into a minimal failing case. If you cannot reproduce, stop and report what you tried — do not "fix" what you cannot observe.
2. Write the regression test in the owning module's `tests/` at the lowest level that exposes the bug (unit > integration > E2E). **Run it and paste the failure output** — a regression test that never failed proves nothing.
3. Diagnose the root cause; state it in one sentence. Fixing the symptom while the cause survives is not done.
4. Fix with the smallest coherent change (semantic reuse check applies — the bug may be a duplicated implementation drifting from the canonical one; fix by unifying, not by patching the copy).
5. Re-run: regression test passes, full scoped suite passes, and check sibling code for the same defect class (same pattern, same bug elsewhere?).

## Workflow — coverage strengthening

1. Map existing tests against the module contract's invariants and the doc-13 pyramid; list the genuinely untested behaviors (not lines — behaviors).
2. Add behavior-level tests: assert observable outcomes, not call shapes; minimize mocking (fake ports, real disposable Postgres for repositories per doc 13).
3. Property-based tests where doc 13 prescribes them (unit conversions, taxonomy, ranking invariants, constraint combinations).

## Workflow — flaky test

1. Reproduce flakiness (`just test <module>` under repetition / `--repeat` harness per doc 13); capture the failure mode.
2. Fix the real cause (time, ordering, shared state, ports/network, unseeded randomness). Forbidden resolutions: deleting the test, skipping it, blind retries, widening timeouts without understanding.
3. If unfixable now: quarantine per doc-13 policy — explicitly marked, linked issue, named owner, deadline. Note it in `PROGRESS.md`.

## Validation

```bash
just test <module>          # includes the new tests; regression shown failing first (paste both runs)
just test                   # full suite when the fix touches shared code
just lint && just typecheck && just ci-parity
```

## Output

- PR with: root-cause sentence, regression test + its captured pre-fix failure output, fix, note on sibling-code sweep. For flaky work: cause analysis or quarantine record.

## Stop / escalate

- Reproduction requires production data or a real device you lack → stop; describe the exact missing evidence and hand off.
- The root cause is architectural (invariant violation, cross-module duplication) → fix the instance if safe, and open an issue/ADR for the structural cause rather than expanding scope silently.
- Fix would require weakening a test, a type, or an arch-check rule → that's the wrong fix; escalate.
