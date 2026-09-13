---
name: tooling-ci
description: Add or change a `just` recipe, a workflow under `.github/workflows/`, a `tools/**` gate (depcruise, eslint, docs-check, shellcheck, security) and its fixtures, `scripts/bootstrap.sh` / `scripts/doctor.sh`, or anything about developer-machine portability (bash 3.2, macOS) or CI gate duration. Use when asked to add a `just` recipe, fix a failing or slow CI job, add a fixture that proves a gate still fails, clean up a shellcheck finding in `scripts/**`, run `just doctor` / `just bootstrap`, or investigate `just ci-parity` timing. Not for product code inside `apps/`, `packages/`, or `workers/` — use that area's skill instead; not for editing the doc 15 §5 recipe catalog or `CLAUDE.md` directly (propose a diff, a human applies it), and not for changing CI required checks (human-only).

metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: tooling-engineer
---

# Tooling and CI Machinery

## Trigger

- Adding, renaming, or changing a `just` recipe in the root `justfile`.
- Changing a workflow under `.github/workflows/**`, the composite action `.github/actions/setup`, or CI gate ordering/timing.
- Adding or extending a gate under `tools/**` (`tools/depcruise`, `tools/eslint`, `tools/docs`, `tools/security`) — including its fixture.
- `scripts/bootstrap.sh`, `scripts/doctor.sh`, `scripts/lib.sh`, or anything about running the same command correctly on macOS's bash 3.2 as well as Linux bash.
- `just docs-check` failed and you need to know which `DC-NN` check fired and what fixes it.
- Trigger phrases: "just recipe", "justfile", "add a recipe", "CI workflow", "GitHub Actions", "shellcheck", "bootstrap", "doctor", "portability", "macOS", "docs-check", "arch-check rule", "eslint rule", "fixture".
- Not for product code inside `apps/`, `packages/`, `workers/` — that is the owning area's skill; this skill only owns the machinery that runs and gates it.

## Required reading

1. The `justfile` header comment and `just --summary` — the full recipe catalog and the `# * = part of ci-parity` marker convention.
2. `.github/workflows/README.md` — the tier table, required secrets, action pins, and what `portability.yml` actually covers.
3. `tools/depcruise/README.md` and `tools/eslint/README.md` — the rule tables and their fixture conventions; `scripts/docs/docs-check.sh`'s header comment (`DC-01`..`DC-15`) for the docs/agent-ops gate this repo already runs.
4. `docs/DEVELOPING-ON-MACOS.md` — why bash 3.2 / BSD-flag portability matters here, not generically.
5. `PROGRESS.md` and the current phase file, for tooling work already in flight.

## Workflow

1. Describe the behavior in one sentence, then search `justfile`, `scripts/`, `tools/`, `.github/` for an existing recipe, script, or rule that already does most of it — `scripts/lib.sh` and the composite setup action exist precisely so nothing gets reimplemented per script or per workflow.
2. Every dev and CI command is a `just` recipe; a workflow step that runs a raw tool CI does not otherwise run (a bare `pnpm`, `uv`, `npx`, `eslint`, or `drizzle-kit` invocation) is a defect, not a shortcut — CI YAML calling `just` is exactly what keeps `just ci-parity` an honest local reproduction of the PR gate.
3. Scripts and recipes stay bash-3.2 / BSD-portable: no associative arrays, `mapfile`/`readarray`, `${var,,}`, or GNU-only flags (`sed -i ''` vs `-i`, `readlink -f`, `date -d`, `grep -P`, `find -printf`). `portability.yml` runs every gate on `macos-15` (arm64, no Docker, `SKIP_DOCKER_TESTS=1`) and `ubuntu-latest`; a change under `scripts/**`, `justfile`, `mise.toml`, `.npmrc`, or `tools/**/*.sh` triggers it, but you cannot run that leg here — say so explicitly rather than claiming portability you didn't check.
4. Never weaken a gate to make something pass: `tools/depcruise/rules.cjs` and `tools/eslint/**` rules stay `severity: 'error'`; an exception is an ADR-backed `pathNot` narrowing, never a deleted rule or a new warn tier. The same applies to `docs-check`'s two `--strict` checks: flip strict mode only after the human applies the pending `CLAUDE.md` / doc 15 proposals it depends on, never by loosening the check itself.
5. A gate change ships with a fixture: a tree under `tools/<gate>/fixtures/<case>/` (or `tools/docs/fixtures/<DC-NN>/` for `docs-check`) that still fails on the named rule, proven by `just <gate> --fixtures` (or `just docs-check --fixtures`). A gate without a fixture that demonstrably fails is unproven, the same way an unfixed test is unproven.
6. Adding a recipe means its `justfile` doc comment is accurate — it is exactly what `just --summary`/`just --list` shows — and, separately, that the doc 15 §5 recipe catalog needs the same addition; propose that as a diff under `.claude/plans/`, never hand-edit `planning/15-*.md` (root `CLAUDE.md`: editing this file is human-authorized only).
7. Changing which checks are required to merge a PR, adding a secret, or touching a store-submission/deploy step is human-only; stop and report instead of guessing at the right value.

## Validation commands

```bash
just --list                                   # recipe registered with a doc comment
just lint && just lint --fixtures             # eslint + ruff + shellcheck; every eslint fixture still fails
just arch-check && just arch-check --fixtures # depcruise rules + every fixture still fails
just docs-check && just docs-check --fixtures # DC-01..DC-15 + every tools/docs/fixtures/DC-NN case still fails
just doctor                                   # environment check still passes
just ci-parity                                # the exact PR gate, before handing back a CI/justfile change
```

## Output

- PR scoped to `scripts/**` / `tools/**` / `justfile` / `.github/**` (never product code), with the new or changed recipe's doc comment, the fixture proving the gate still fails, and real command output pasted.
- If the change needs the doc 15 §5 catalog or a `CLAUDE.md` layout update, a proposal diff under `.claude/plans/` instead of an edit to those files.

Done checklist: `just lint` / `typecheck` / `arch-check` / `docs-check` green · every touched gate's fixtures still fail on their named rule · shellcheck clean · no raw tool invocation added where a `just` recipe should exist · portability risk stated even when the macOS leg wasn't run locally · `PROGRESS.md` line suggested.

## Stop / escalation

- Any change that would weaken a rule, fixture, threshold, or required check → ADR + human decision, never a quiet loosening.
- A toolchain version bump in `mise.toml`, a lockfile change, or an edit to a single-writer file (`mise.toml`, CI config, lockfiles per root `CLAUDE.md` "Parallel sessions") while another session might be touching it → confirm before editing, or stop.
- A change to `tools/codegen/gen-python.sh` or anything that alters generated output → `api-contract-change` regenerates; this skill doesn't own that step.
- A new secret, required check, or deploy/store-submission step → human-only; report exactly what would need to change and why.
- A `docs-check` finding you don't understand → read the matching `DC-NN` comment in `scripts/docs/docs-check.sh`'s header before guessing at a fix.

## Overlap

Adjacent: `data-lifecycle` (consent/deletion/export product behavior — this skill only owns the CI/tooling machinery that runs its tests and gates), `api-contract-change` (owns `tools/codegen/gen-python.sh` and anything that changes generated output), `architecture-review` (reviews the result of an `arch-check` rule change), `security-privacy-review` (`scripts/security/**`, `.gitleaks.toml`, secrets tooling — read its secrets/config item first; this skill implements the mechanics it reviews), `performance-profiling` (owns the measure-first methodology and the doc 13 budget for a CI-gate-duration claim; this skill implements the recipe/workflow change that claim leads to — e.g. reordering or parallelizing `ci-parity` steps). This skill owns `scripts/**`, `tools/**` (gates and fixtures), the root `justfile`, `.github/**`, and the root tooling dotfiles; it owns no SPINE module.
