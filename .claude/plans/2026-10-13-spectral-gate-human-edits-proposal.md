# Proposal: two human-only texts left stale by the spectral gate fix

> Status: PROPOSED (2026-10-13). Written by the main session on branch `fix/contracts-spectral-gate`
> (base `main` @ `dc1b5b5`), after `just ci-contracts-spectral` was changed to run the contracts
> package's `lint:spectral` instead of skipping (see the 2026-10-13 (spectral) entry in
> `planning/PROGRESS.md`). Both files are human-only: `planning/15-*.md` (`.claude/rules/human-only.md`
> invariant 1) and `.github/workflows/**` (`.claude/rules/tooling-ci.md` invariant 2). Nothing here
> changes behaviour; both edits are wording.

## What changes and why

1. `planning/15-team-workflow-and-ai-agent-operations.md` §5, the `just test <module>` row: the
   `tooling` suite list gains `contracts-spectral` (new in this branch). It also gains `generate`
   and `skills-eval`, which the `justfile` `test-tooling` recipe already runs and its description
   already names; the doc row lacked them before this branch.
2. `.github/workflows/pr-gate.yml`, the `contracts` job: the step "Verify · Spectral lint of the
   OpenAPI sources" becomes "Verify · Spectral lint of the bundled OpenAPI contract". The step now
   lints the redocly bundle, not the source files. Only the step name changes; the job name, which
   `tools/github/repo-settings.json` lists as a required check, stays the same.

## Patch

Apply from the repository root with `git apply`. `git apply --check` passed against `main` @
`dc1b5b5` plus this branch.

```diff
--- a/planning/15-team-workflow-and-ai-agent-operations.md
+++ b/planning/15-team-workflow-and-ai-agent-operations.md
@@ -104,7 +104,7 @@
 | `just dev` | Run the whole app with one command (`scripts/dev.sh`): setup checks (bootstrap on a first run, dependencies whose lockfile changed, `.env`, the container runtime: Docker Engine on Linux, OrbStack on macOS, the Android SDK, Xcode after asking), Postgres + migrations, the API and workers in the background, then the Dev app on an Android emulator or phone (Linux, macOS) and an iPhone simulator (macOS); `down`, `status`, `logs`; `--dry-run` prints the plan |
 | `just dev-api` | Compose stack (Postgres+pgvector; compose project `ai-stylist` from every checkout unless `COMPOSE_PROJECT_NAME` is exported) + NestJS API in watch mode; an empty `APP_ENV` runs as `local` |
 | `just dev-workers` | Compose Postgres + the pg-boss `jobs` process (apps/api `src/jobs/main.ts`, tsx watch; needs `just db-migrate`) + the Python segmentation worker (uvicorn on :8001); the outbox relay runs inside `just dev-api` |
-| `just test <module>` | Scoped: one module's `tests/` dir (e.g. `just test recommendation`); `ios`, `android`, `workers`, `secrets`, `tooling`, `platform`, `api` route to their own suites (`tooling` = the `scripts/test` shell suites: bootstrap/doctor, contracts-breaking, test-regression, ci-metrics, dev service names, dev (the `just dev` plan, ports, logs, stop, device choice), observability-sync, repo-setup) instead of a `modules/<name>/tests` dir (`ios` = `ios-test-packages`, `android` = `android-test`); the full run includes the native unit tests |
+| `just test <module>` | Scoped: one module's `tests/` dir (e.g. `just test recommendation`); `ios`, `android`, `workers`, `secrets`, `tooling`, `platform`, `api` route to their own suites (`tooling` = the `scripts/test` shell suites: bootstrap/doctor, contracts-breaking, contracts-spectral, generate, test-regression, ci-metrics, dev service names, dev (the `just dev` plan, ports, logs, stop, device choice), observability-sync, repo-setup, skills-eval) instead of a `modules/<name>/tests` dir (`ios` = `ios-test-packages`, `android` = `android-test`); the full run includes the native unit tests |
 | `just test` | Full suite (all modules + packages), as CI PR gate runs it |
 | `just test-regression <file>` | Prove a regression test fails at the merge-base and passes at HEAD — the structural form of CLAUDE.md's "regression test fails before the fix" |
 | `just lint` | Analytics taxonomy check (`tools/analytics`: every event name and property key the native apps build is declared in `packages/contracts/events/analytics/events.json`, 14 §9) + ESLint (incl. boundary rules) + Ruff for workers + shellcheck + actionlint + the native linters (`ios-lint`, `android-lint`, `android-detekt`); `--fixtures` proves the ESLint rules and the taxonomy check still fail on their fixtures |
--- a/.github/workflows/pr-gate.yml
+++ b/.github/workflows/pr-gate.yml
@@ -118,7 +118,7 @@
           key: codegen-${{ runner.os }}-${{ hashFiles('tools/codegen/gen-swift.sh', 'tools/codegen/gen-kotlin.sh') }}
       - name: Verify · Generated clients are up to date (TS, Python, Swift, Kotlin)
         run: just generate --check
-      - name: Verify · Spectral lint of the OpenAPI sources
+      - name: Verify · Spectral lint of the bundled OpenAPI contract
         run: just ci-contracts-spectral
       - name: Verify · No breaking changes against the base branch (oasdiff + event schemas)
         if: github.event_name == 'pull_request'
```

## Proof after applying

`just docs-check --strict` (DC-15 compares the doc 15 §5 catalog with `just --summary`) and `just lint`
(actionlint covers the workflow).
