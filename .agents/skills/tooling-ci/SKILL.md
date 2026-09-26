---
name: tooling-ci
description: Add or change developer tooling and CI plumbing — `just` recipes, `tools/**` gates (depcruise, eslint, docs-check, shellcheck, security) and their fixtures, bootstrap/doctor scripts, root workspace configs and `.env.example` keys, tooling dependency bumps, macOS/bash 3.2 portability, CI gate timing, and CI workflow changes (as an exact diff a human applies). Not for product code in `apps/`, `packages/` or `workers/` — use that area's skill; not for `scripts/hooks/`, `.claude/**`, `.agents/**`, the doc 15 §5 catalog, `CLAUDE.md` or CI required checks — those are human-applied.
metadata:
  modules:
  last-reviewed: 2026-09-26
  owner-agent: tooling-engineer
---

# Tooling and CI Machinery

## Trigger

- Adding, renaming, or changing a `just` recipe in the root `justfile`.
- Changing a workflow under `.github/workflows/**` or the composite action `.github/actions/setup`,
  or CI gate ordering/timing. The path guard denies agent edits there: write the exact diff into
  the report for a human to apply.
- Adding or extending a gate under `tools/**` (`tools/depcruise`, `tools/eslint`, `tools/docs`,
  `tools/security`) — including its fixture.
- `scripts/bootstrap.sh`, `scripts/doctor.sh`, `scripts/lib.sh`, or anything about running the same
  command correctly on macOS's bash 3.2 as well as Linux bash.
- A new or renamed key in `.env.example`, or how to use the `just secrets-*` recipes. Human-only:
  `just secrets-approve`, editing or syncing staging/prod secrets, and key rotation.
- A TS or Python tooling dependency bump in a root workspace config.
- `just docs-check` failed and you need to know which `DC-NN` check fired and what fixes it.
- Trigger phrases: "just recipe", "justfile", "add a recipe", "CI workflow", "GitHub Actions",
  "shellcheck", "bootstrap", "doctor", "portability", "macOS", "docs-check", "arch-check rule",
  "eslint rule", "fixture", "env key".
- Not for product code inside `apps/`, `packages/`, `workers/` (the owning area's skill), and not
  for the enforcement layer (`scripts/hooks/**`, `.claude/**`, `.agents/**`, `templates/**`), which
  the main session changes with a human.

## Required reading

1. The `justfile` header comment and `just --summary`: the full recipe catalog and the
   `# * = part of ci-parity` marker convention.
2. `.github/workflows/README.md`: the tier table, required secrets, action pins, and what
   `portability.yml` actually covers.
3. `tools/depcruise/README.md` and `tools/eslint/README.md`: the rule tables and their fixture
   conventions; `scripts/docs/docs-check.sh`'s header comment (`DC-01`..`DC-15`) for the
   docs/agent-ops gate.
4. `docs/DEVELOPING-ON-MACOS.md`: why bash 3.2 / BSD-flag portability matters here.
5. `secrets/README.md` before touching `.env.example` or any `just secrets-*` usage.
6. `PROGRESS.md` and the current phase file, for tooling work already in flight.

## Workflow

1. Describe the behavior in one sentence, then search for an existing recipe, script, or rule that
   already does most of it: `rg -n -i '<term>|<synonym>' justfile scripts tools .github`.
   `scripts/lib.sh` and the composite setup action exist so nothing gets reimplemented per script
   or per workflow.
2. Ownership (write only here): `scripts/**` except `scripts/hooks/**`; the root `justfile`;
   `tools/**` except `tools/codegen/gen-swift.sh` (`ios-feature`), `tools/codegen/gen-kotlin.sh`
   (`android-feature`) and `tools/codegen/gen-python.sh` (`media-ml-pipeline`); `.github/**`
   except `.github/workflows/**` and `.github/actions/**` (human-applied: propose the exact diff);
   `mise.toml`; `.env.example`; the root workspace configs (`package.json`, `pnpm-workspace.yaml`,
   `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `.npmrc`, `.gitignore`,
   `.gitattributes`, `.pre-commit-config.yaml`, `renovate.json`, `osv-scanner.toml`,
   `.gitleaks.toml`, `commitlint.config.mjs`); new proposal files only as
   `.claude/plans/<yyyy-mm-dd>-<slug>-proposal.md`.
3. Every dev and CI command is a `just` recipe; a workflow step that runs a raw tool CI does not
   otherwise run (a bare `pnpm`, `uv`, `npx`, `eslint`, or `drizzle-kit` invocation) is a defect.
   CI YAML calling `just` is what keeps `just ci-parity` an honest local reproduction of the PR gate.
4. Scripts and recipes stay bash-3.2 / BSD-portable: no associative arrays, `mapfile`/`readarray`,
   `${var,,}`, or GNU-only flags (`sed -i ''` vs `-i`, `readlink -f`, `date -d`, `grep -P`,
   `find -printf`). `portability.yml` runs every gate on `macos-15` (arm64, no Docker,
   `SKIP_DOCKER_TESTS=1`) and `ubuntu-latest`; you cannot run that leg here, so state the
   portability risk instead of claiming it.
5. Never weaken a gate: `tools/depcruise/rules.cjs` and `tools/eslint/**` rules stay
   `severity: 'error'`; an exception is an ADR-backed `pathNot` narrowing, never a deleted rule or
   a new warn tier. `docs-check --strict` already runs in `just ci-parity`, so DC-14/DC-15 are
   errors there; never loosen either check.
6. A gate change ships with a fixture: a tree under `tools/<gate>/fixtures/<case>/` (or
   `tools/docs/fixtures/<DC-NN>/` for `docs-check`) that still fails on the named rule, proven by
   `just <gate> --fixtures`. A gate without a fixture that demonstrably fails is unproven.
7. Adding a recipe means its `justfile` doc comment is accurate (it is exactly what
   `just --summary`/`just --list` shows) and the doc 15 §5 recipe catalog needs the same addition:
   propose that as a diff in a `.claude/plans/<yyyy-mm-dd>-<slug>-proposal.md` file, never
   hand-edit `planning/15-team-workflow-and-ai-agent-operations.md`.
8. Native lanes: the aggregate recipes (`lint`, `format`, `arch-check`, `test`, `generate`,
   `ci-parity`) call the iOS/Android recipes through `scripts/native-lane.sh`. Keep that policy:
   `NATIVE_LANES` selects lanes, a missing toolchain is a loud SKIPPED notice locally and a failure
   with `CI=true` or `NATIVE_STRICT=1`, and Xcode-only steps skip on Linux with a notice. Recipe
   bodies for the apps live in `apps/ios/scripts/` and `apps/android/tools/` (their engineers'
   write sets); the justfile only wires them. A new JVM `:core:*` Android module needs its
   `:<module>:test` task added to `android-test`, `android-check` and `android-deps-lock` here.
9. Env keys: add the key to `.env.example` with an empty value and a comment; secret values live
   only in `secrets/*.enc.yaml` via `just secrets-edit dev` (a human for staging/prod). Engineers
   report the exact key line; only this skill edits `.env.example`.
10. Dependency bumps (TS or Python): change the version in the manifest only when the task grants
    it. `pnpm-lock.yaml` and `workers/uv.lock` are single-writer and path-guarded, and the Bash
    guard denies `pnpm add/remove/update` and `uv add/remove`: stop and hand the lockfile
    regeneration to the human (`uv lock` for workers is `ml-engineer`'s), listing manifest and
    lockfile under `Must be committed together:`.
11. Changing which checks are required to merge a PR, adding a secret, or touching a
    store-submission/deploy step is human-only; stop and report instead of guessing at the right
    value.

## Validation commands

```bash
just --list                                   # recipe registered with a doc comment
just lint && just lint --fixtures             # eslint + ruff + shellcheck + actionlint + native lint lanes; every eslint fixture still fails
just arch-check && just arch-check --fixtures # depcruise rules + iOS bans + Android module graph; every fixture still fails
just docs-check && just docs-check --fixtures # DC-01..DC-15 + every tools/docs/fixtures/DC-NN case still fails
just lint-file <script>                       # one edited shell script through shellcheck (bash 3.2 mode)
just test secrets                             # after scripts/security/** or secrets tooling changes
just doctor                                   # environment check still passes
just ci-parity                                # the exact PR gate, before handing back a CI/justfile change
```

## Output

The `agent-operating-contract` report: the new or changed recipe's doc comment, the fixture
proving the gate still fails, real command output, any workflow change as an exact diff under
`Blockers:` for a human, and a proposal file path when doc 15 §5 or `CLAUDE.md` needs the change.

Done checklist: `just lint` / `typecheck` / `arch-check` / `docs-check` green · every touched
gate's fixtures still fail on their named rule · shellcheck clean · no raw tool invocation added
where a `just` recipe should exist · portability risk stated even when the macOS leg wasn't run ·
`Suggested PROGRESS.md line` given.

## Stop / escalation

- Any change that would weaken a rule, fixture, threshold, or required check → ADR + human
  decision, never a quiet loosening.
- A workflow or composite-action change → the exact diff for a human; the path guard denies the
  edit.
- A hook script (`scripts/hooks/**`), `.claude/settings.json`, a skill, an agent or a template →
  enforcement layer: propose the diff to the main session and stop.
- A toolchain version bump in `mise.toml`, a lockfile change, or an edit to a single-writer file
  (`mise.toml`, CI config, lockfiles per root `CLAUDE.md` "Parallel sessions") while another
  session might be touching it → confirm before editing, or stop.
- A change that alters generated output (`tools/codegen/generate.sh`, `tools/codegen/gen-ts.sh`,
  `tools/codegen/gen-kernel.mjs`) → edit the script here, then `contracts-engineer` runs
  `just generate` and commits the regenerated output with it.
- A new secret, required check, or deploy/store-submission step → human-only; report exactly what
  would need to change and why.
- A `docs-check` finding you don't understand → read the matching `DC-NN` comment in
  `scripts/docs/docs-check.sh`'s header before guessing at a fix.

## Overlap

Adjacent: `ios-feature` (`tools/codegen/gen-swift.sh`, `apps/ios/scripts/`), `android-feature`
(`tools/codegen/gen-kotlin.sh`, `apps/android/tools/`), `media-ml-pipeline`
(`tools/codegen/gen-python.sh`), `api-contract-change` (runs `just generate` after a codegen change),
`data-lifecycle` (product behavior; this skill only runs its gates), `architecture-review` (reviews an `arch-check` rule change),
`security-privacy-review` (`scripts/security/**`, `.gitleaks.toml`, secrets tooling: it reviews what
this skill implements), `performance-profiling` (measures a CI-duration claim; this skill implements
the recipe or workflow change), `e2e-device-testing` (asks for e2e recipe arguments and lanes).
`media-ml-pipeline` owns `tools/codegen/gen-python.sh`, `ios-feature` owns `tools/codegen/gen-swift.sh`
and `android-feature` owns `tools/codegen/gen-kotlin.sh`; this skill owns the rest of
`tools/codegen/**` and the write set in Workflow step 2. It owns no SPINE module.
