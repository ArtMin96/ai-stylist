# Proposal: doc 15 §5 names the new `design-tokens` suite of `just test tooling`

> Status: PROPOSED (2026-10-19). Written by `tooling-engineer` on branch
> `artmins96/ai-189-design-system-design-tokens-generate-native-theme-code-from` (base `ac8cbdb`),
> Linear AI-189 pass 1 (the DESIGN.md parser, validator and in-memory token model). The file is
> human-only (`.claude/rules/human-only.md` invariant 1). Wording only; no behaviour changes here.

## What changes and why

`planning/15-team-workflow-and-ai-agent-operations.md` §5, the `just test <module>` row: the
`tooling` suite list gains `design-tokens`, which this branch adds to the `justfile`
`test-tooling` recipe (`bash scripts/test/design-tokens.test.sh`) and to the `test` recipe's doc
comment. The row also still lacks `contracts-spectral`, `generate` and `skills-eval`, which the
recipe already runs; the 2026-10-13 spectral proposal
(`.claude/plans/2026-10-13-spectral-gate-human-edits-proposal.md`) adds those three. If that
proposal is applied first, add only `, design-tokens (the DESIGN.md parser, validator and
in-memory token model)` after `skills-eval`.

## Patch (against the row as it is on `ac8cbdb`)

```diff
--- a/planning/15-team-workflow-and-ai-agent-operations.md
+++ b/planning/15-team-workflow-and-ai-agent-operations.md
@@ -107 +107 @@
-| `just test <module>` | Scoped: one module's `tests/` dir (e.g. `just test recommendation`); `ios`, `android`, `workers`, `secrets`, `tooling`, `platform`, `api` route to their own suites (`tooling` = the `scripts/test` shell suites: bootstrap/doctor, contracts-breaking, test-regression, ci-metrics, dev service names, dev (the `just dev` plan, ports, logs, stop, device choice), observability-sync, repo-setup) instead of a `modules/<name>/tests` dir (`ios` = `ios-test-packages`, `android` = `android-test`); the full run includes the native unit tests |
+| `just test <module>` | Scoped: one module's `tests/` dir (e.g. `just test recommendation`); `ios`, `android`, `workers`, `secrets`, `tooling`, `platform`, `api` route to their own suites (`tooling` = the `scripts/test` shell suites: bootstrap/doctor, contracts-breaking, contracts-spectral, generate, test-regression, ci-metrics, dev service names, dev (the `just dev` plan, ports, logs, stop, device choice), observability-sync, repo-setup, skills-eval, design-tokens (the DESIGN.md parser, validator and in-memory token model)) instead of a `modules/<name>/tests` dir (`ios` = `ios-test-packages`, `android` = `android-test`); the full run includes the native unit tests |
```

## Proof after applying

`just docs-check --strict` (DC-15 compares recipe names only, so it passes before and after; the
row text is reviewer-checked against the `test` recipe's doc comment in the `justfile`).
