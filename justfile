# AI Stylist — single entry point for every dev/CI command (planning/15 §5).
# CI calls these recipes; never re-implement them in YAML. Recipe names use dashes.
# Recipes marked NOT IMPLEMENTED (P02 Tnn) exit 2 until that task lands.

# `bash` resolves to /bin/bash 3.2 on macOS (Homebrew bash is optional): recipes and scripts/**
# stay bash 3.2-clean and use only POSIX/BSD-compatible flags (docs/DEVELOPING-ON-MACOS.md).
set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

# Pinned tools resolve via mise shims without shell activation.
export PATH := home_directory() / ".local/share/mise/shims" + ":" + home_directory() / ".local/bin" + ":" + env_var("PATH")

# One compose project for every checkout and worktree. docker-compose.yml fixes the container name
# (ai-stylist-postgres), so the project that owns it must not follow the checkout directory, which
# is compose's default: a second checkout would stop with "container name already in use".
# Override: export a non-empty COMPOSE_PROJECT_NAME (in your shell, or as a prefix on one command).
# `just doctor` reports a container that another project owns, with the commands that fix it. The
# default is the same as COMPOSE_PROJECT_DEFAULT in scripts/lib.sh
# (scripts/test/bootstrap-doctor.test.sh keeps the two in step).
export COMPOSE_PROJECT_NAME := if env_var_or_default("COMPOSE_PROJECT_NAME", "") == "" { "ai-stylist" } else { env_var("COMPOSE_PROJECT_NAME") }


# Show all recipes
[private]
default:
    @just --list --unsorted

# --- environment ---------------------------------------------------------------

# Full environment setup, idempotent, incl. the mise + direnv block in your shell rc file (`--system` adds, with sudo: pacman or apt packages, udev rules and the docker group on Linux; Homebrew, OrbStack and the pinned Xcode on macOS)
bootstrap *args:
    scripts/bootstrap.sh "$@"

# Read-only environment + repo health check with a fix hint per failure
doctor:
    scripts/doctor.sh

# Decrypt secrets/<env>.enc.yaml (sops + age) and merge its keys into the gitignored .env; staging/prod need CI=true or --i-know-this-is-not-dev
secrets-sync env='dev' *args:
    scripts/security/secrets-sync.sh "$@"

# Copy the values .env holds for the .env.example keys into secrets/dev.enc.yaml through sops, no editor (the reverse of secrets-sync): bare = dry run that lists key names and writes nothing; `--apply` creates missing key names and fills empty shared values, and names but leaves alone a shared value that differs from .env; `--replace` also overwrites those; `--prune` also removes empty names .env.example no longer has, `--prune --prune-values` also the ones that hold a value; `--set KEY` stores one value from a hidden prompt or stdin (never an argument); keys tagged [machine-local] in .env.example are never copied; a .env value with an inline comment is refused; staging/prod are refused; prints key names and counts, never a value
secrets-push *args:
    bash scripts/security/secrets-push.sh "$@"

# Edit secrets/<env>.enc.yaml in $EDITOR through sops (creates it from the .env.example key list on first run)
secrets-edit env='dev':
    scripts/security/secrets-edit.sh "$@"

# Re-wrap secrets/*.enc.yaml for the recipient list in .sops.yaml after adding/removing a key (sops updatekeys; needs an identity that can decrypt today); `just secrets-updatekeys staging` for one env
secrets-updatekeys *envs:
    scripts/security/secrets-updatekeys.sh "$@"

# Approve a developer's onboarding branch: verify it only adds age recipients to .sops.yaml, re-wrap every secrets/*.enc.yaml, push, print the PR URL (§6 onboarding)
secrets-approve branch:
    scripts/security/secrets-approve.sh "$@"

# Record that your age identity is backed up in the password manager (marker file checked by just doctor)
secrets-backup-done:
    scripts/security/secrets-backup-done.sh

# --- the repository on GitHub, as code (tools/github/README.md; docs/NEW-REPO-SETUP.md) ---------

# The GitHub side of a repository move, always for the repository `origin` points at: bare = three read-only checks in order (name, secrets, settings) and the apply commands that are needed, exit 1 when one is; `name [--apply] [--from OWNER/REPO]` = tracked lines that still name this repository's old OWNER/REPO (offline; third-party links and the paths in tools/github/name-keep.txt are left alone); `secrets [--apply [--replace]]` = Actions secrets and variables by name against tools/github/actions-secrets.txt, values piped from secrets/dev.enc.yaml (sops) into gh, never an argument, never printed; `settings [--apply]` = Actions permissions, protection of main with the pr-gate job names as required checks, secret scanning, labels (tools/github/repo-settings.json; a setting the plan does not offer is reported as unavailable); nothing changes without `--apply`, which is owner-run and safe to repeat; `secrets` and `settings` need gh (not pinned in mise.toml) logged in as a repository admin
repo-setup *args:
    bash scripts/repo-setup.sh "$@"

# --- observability (Grafana Cloud + PostHog as code; tools/observability/README.md) -------------

# * Push docs/observability/grafana/**, posthog/project-settings.json and the flag registry to Grafana Cloud and PostHog (env from the repo-root .env that `just secrets-sync` writes): `just observability-sync [grafana|posthog|all] [--check|--dry-run|--prune]`; `--check` is offline and CI-safe (ci-parity runs `all --check`), `--dry-run` sends only GETs
observability-sync *args:
    #!/usr/bin/env bash
    set -euo pipefail
    # Node loads .env without overriding variables that are already exported (direnv, CI).
    if [[ -f .env ]]; then
        exec node --env-file=.env tools/observability/sync.mjs "$@"
    fi
    exec node tools/observability/sync.mjs "$@"

# --- dev servers ---------------------------------------------------------------

# Run the whole app with one command (scripts/dev.sh): setup checks (bootstrap on a first run, dependencies whose lockfile changed, .env, the container runtime: Docker Engine on Linux, OrbStack on macOS, the Android SDK, Xcode), Postgres + migrations, the API and workers in the background, then the Dev app on an Android emulator or phone (Linux and macOS) and an iPhone simulator (macOS): `just dev [backend|android|ios|all] [-d|--detach] [--seed] [--no-workers] [--no-backend] [--no-setup] [--android-serial S] [--ios-simulator UDID] [-y] [-n|--dry-run]`; `just dev down [--keep-db] [--keep-devices]`, `just dev status`, `just dev logs [api|workers|emulator]`
dev *args:
    scripts/dev.sh "$@"

# Compose stack (Postgres+pgvector; compose project `ai-stylist` from every checkout and worktree unless COMPOSE_PROJECT_NAME is exported) + NestJS API in watch mode (tsx; reads the repo-root .env); OTel service.name `api` is set here, so an OTEL_SERVICE_NAME in the shared .env never renames it; an APP_ENV that is empty both in the environment and in .env runs as `local`
dev-api *args:
    docker compose up -d --wait postgres
    APP_ENV="$(bash scripts/dev-app-env.sh)" OTEL_SERVICE_NAME='api' pnpm --filter @ai-stylist/api dev "$@"

# Compose Postgres (same compose project as dev-api) + pg-boss jobs process (apps/api src/jobs/main.ts, tsx watch; needs `just db-migrate`) in the background + segmentation worker (uvicorn --reload on :8001; args go to uvicorn); both read the repo-root .env, with OTel service.name `jobs` and `segmentation` set per process and an empty APP_ENV running as `local`
dev-workers *args:
    #!/usr/bin/env bash
    set -euo pipefail
    docker compose up -d --wait postgres
    # Non-interactive bash starts background jobs with SIGINT ignored, so Ctrl-C alone would
    # orphan the jobs process: stop it with SIGTERM (graceful in main.ts) whenever this exits.
    jobs_pid=''
    stop_jobs() {
        if [[ -n "$jobs_pid" ]] && kill -0 "$jobs_pid" 2>/dev/null; then
            kill -TERM "$jobs_pid" 2>/dev/null || true
            wait "$jobs_pid" 2>/dev/null || true
        fi
    }
    trap stop_jobs EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    # One .env serves every process, so each gets its service name here: an exported variable beats
    # Node's --env-file-if-exists and uvicorn's --env-file (scripts/test/dev-service-names.test.sh).
    # APP_ENV is passed the same way, as the exported value, else the .env value, else `local`
    # (scripts/dev-app-env.sh), so an empty APP_ENV never drops deployment.environment.name.
    APP_ENV="$(bash scripts/dev-app-env.sh)" OTEL_SERVICE_NAME='jobs' pnpm --filter @ai-stylist/api run dev:jobs &
    jobs_pid=$!
    # The worker reads the repo-root .env like the jobs process; uvicorn --env-file fails on a missing file.
    if [[ -f .env ]]; then set -- --env-file .env "$@"; fi
    APP_ENV="$(bash scripts/dev-app-env.sh)" OTEL_SERVICE_NAME='segmentation' uv run --project workers/ml/segmentation uvicorn ai_stylist_segmentation.main:app --reload --port 8001 "$@"

# --- quality gates (* = part of ci-parity) -------------------------------------------

# * Run tests: full suite via turbo + the native lanes, or one module's tests/ dir (`just test recommendation`; `just test ios` / `just test android` = that app's unit tests; `just test secrets` = the sops+age shell suite; `just test tooling` = the scripts/test shell suites: bootstrap/doctor, contracts-breaking, contracts-spectral, generate (a failing generator fails `just generate [--check]`), test-regression, ci-metrics, dev service names, dev (the `just dev` plan, ports, logs, stop, device choice), observability-sync, repo-setup, skills-eval, design-tokens (the DESIGN.md parser, validator and in-memory token model); `just test platform` = the `api` + `platform-docker` vitest projects); SKIP_DOCKER_TESTS=1 leaves out the Testcontainers `migrations` and `platform-docker` projects (runners without Docker only)
test module='':
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${SKIP_DOCKER_TESTS:-}" == "1" && -z "{{module}}" ]]; then
        # apps/api/vitest.config.ts has three projects: `api`, plus the Testcontainers projects
        # `migrations` and `platform-docker` (each FAILS without Docker, never skips). Run every
        # other workspace through turbo, then only the `api` project. Docker-less hosts only
        # (portability.yml on macos-26): never in pr-gate.
        echo "SKIP_DOCKER_TESTS=1: skipping apps/api vitest projects 'migrations' and 'platform-docker' (Testcontainers needs Docker)" >&2
        pnpm turbo run test --filter='!@ai-stylist/api'
        pnpm --filter @ai-stylist/api exec vitest run --project api
        uv run --project workers pytest workers -q
        just test-secrets
        just test-tooling
        just test-native
        exit 0
    fi
    if [[ -n "{{module}}" ]]; then
        case "{{module}}" in
            secrets) just test-secrets; exit 0 ;;
            tooling) just test-tooling; exit 0 ;;
            ios) just ios-test-packages; exit 0 ;;
            android) just android-test; exit 0 ;;
            workers) uv run --project workers pytest workers -q; exit 0 ;;
            platform) dir="src/platform/tests" ;;
            api) dir="." ;;
            *) dir="src/modules/{{module}}/tests" ;;
        esac
        if [[ ! -d "apps/api/$dir" ]]; then
            echo "just test: no such module '{{module}}' (expected apps/api/$dir)" >&2
            exit 1
        fi
        if [[ "$dir" == "." ]]; then
            pnpm --filter @ai-stylist/api test
        elif [[ "{{module}}" == "platform" ]]; then
            # platform adapters also have Testcontainers tests (`platform-docker`: *.docker.test.ts).
            if [[ "${SKIP_DOCKER_TESTS:-}" == "1" ]]; then
                echo "SKIP_DOCKER_TESTS=1: skipping apps/api vitest project 'platform-docker' (Testcontainers needs Docker)" >&2
                pnpm --filter @ai-stylist/api exec vitest run --project api "$dir"
            else
                pnpm --filter @ai-stylist/api exec vitest run --project api --project platform-docker "$dir"
            fi
        else
            pnpm --filter @ai-stylist/api exec vitest run --project api "$dir"
        fi
        exit 0
    fi
    pnpm turbo run test
    uv run --project workers pytest workers -q
    just test-secrets
    just test-tooling
    just test-native

[private]
test-secrets:
    scripts/security/tests/secrets.test.sh

[private]
test-tooling:
    scripts/test/bootstrap-doctor.test.sh
    scripts/test/contracts-breaking.test.sh
    scripts/test/contracts-spectral.test.sh
    scripts/test/generate.test.sh
    scripts/test/regression.test.sh
    bash scripts/test/ci-metrics.test.sh
    bash scripts/test/dev-service-names.test.sh
    bash scripts/test/dev.test.sh
    bash scripts/test/observability-sync.test.sh
    bash scripts/test/repo-setup.test.sh
    bash scripts/test/skills-eval.test.sh
    bash scripts/test/design-tokens.test.sh

# Native unit tests for the full `just test` (lane/toolchain policy: scripts/native-lane.sh)
[private]
test-native:
    scripts/native-lane.sh ios swift just ios-test-packages
    scripts/native-lane.sh android android just android-test

# Prove a regression test fails before the fix and passes after it: the working-tree test file runs against the merge-base code (expect FAIL), then at HEAD (expect PASS) (scripts/test/regression.sh <test-file>); structural version of CLAUDE.md's "regression test fails before the fix"
test-regression file:
    scripts/test/regression.sh "$@"

# * Analytics taxonomy check (tools/analytics: every event name and property key the Swift/Kotlin sources build is in packages/contracts/events/analytics/events.json) + ESLint per workspace via turbo (boundaries, test-placement, no-skip, no-console, forbidden-field, file-size) + root tools/ + Ruff for workers + shellcheck for scripts/**, tools/**/*.sh and the native apps' scripts + actionlint + the native lanes (SwiftLint; Android Lint + detekt); `--fixtures` asserts tools/eslint/fixtures and tools/analytics/fixtures each fail on their rule
lint *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${1:-}" == "--fixtures" ]]; then
        # Both harnesses always run, so a failing one never hides the other's result.
        rc=0
        tools/eslint/check-fixtures.sh || rc=1
        bash tools/analytics/check-fixtures.sh || rc=1
        exit "$rc"
    elif [[ -n "${1:-}" ]]; then
        echo "just lint: unknown argument '$1' (use --fixtures)" >&2; exit 2
    fi
    # Node built-ins only and sub-second: runs before the tools that need `pnpm install`.
    node tools/analytics/check-events.mjs
    pnpm turbo run lint
    pnpm exec eslint tools eslint.config.mjs
    uv run --project workers ruff check workers
    # -s bash: every script must run under macOS /bin/bash 3.2 as well (docs/DEVELOPING-ON-MACOS.md)
    shellcheck -s bash -x -P SCRIPTDIR scripts/*.sh scripts/security/*.sh scripts/security/tests/*.sh scripts/docs/*.sh scripts/docs/lib/*.sh scripts/hooks/*.sh scripts/test/*.sh scripts/db/*.sh scripts/ci/*.sh scripts/lint-file.sh scripts/native-lane.sh tools/analytics/*.sh tools/codegen/*.sh tools/depcruise/*.sh tools/eslint/*.sh tools/flags/*.sh tools/jscpd/*.sh apps/ios/scripts/*.sh apps/android/tools/*.sh
    actionlint
    scripts/native-lane.sh ios none just ios-lint
    scripts/native-lane.sh android android just android-lint
    scripts/native-lane.sh android android just android-detekt

# Single-file lint dispatch by extension (.ts/.tsx/.mjs/.cjs -> eslint, .py -> ruff, .sh -> shellcheck, .swift -> swift-format + SwiftLint, .kt/.kts -> Spotless check; else no-op); used by the PostToolUse hook so one edit doesn't pay for a whole-repo lint
lint-file path:
    scripts/lint-file.sh "$@"

# * `tsc --noEmit` per workspace via turbo + basedpyright for workers (Swift and Kotlin are type-checked by their compilers in `just test` / `just android-build`)
typecheck:
    pnpm turbo run typecheck
    uv run --project workers basedpyright --project workers

# * Prettier + Ruff format (workers) + swift-format (apps/ios) + Spotless/ktlint (apps/android); `just format --check` for CI
format *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${1:-}" == "--check" ]]; then
        pnpm exec prettier --check .
        uv run --project workers ruff format --check workers
        scripts/native-lane.sh ios swift just ios-format --check
        scripts/native-lane.sh android android just android-format --check
    elif [[ -n "${1:-}" ]]; then
        echo "just format: unknown argument '$1' (use --check)" >&2; exit 2
    else
        pnpm exec prettier --write .
        uv run --project workers ruff format workers
        scripts/native-lane.sh ios swift just ios-format
        scripts/native-lane.sh android android just android-format
    fi

# * dependency-cruiser boundary rules (tools/depcruise/rules.cjs) + banned utils/ dirs + iOS bans (`just ios-check-banned`) + the Android module-graph allow-list; `--fixtures` asserts every fixture fails on its rule
arch-check *args:
    #!/usr/bin/env bash
    set -euo pipefail
    tools/depcruise/arch-check.sh "$@"
    if [[ "${1:-}" == "--fixtures" ]]; then
        scripts/native-lane.sh ios none just ios-check-banned --fixtures
    else
        scripts/native-lane.sh ios none just ios-check-banned
        scripts/native-lane.sh android android apps/android/tools/gradle.sh -q checkModuleGraph
    fi

# * Clone detection (tools/jscpd, NFR-TEAM-040): jscpd over the hand-written TypeScript/JavaScript, Python, Kotlin, Swift and shell sources in apps, packages, workers, scripts and tools (tools/jscpd/jscpd.json excludes generated trees, fixtures, lockfiles, build output and dependencies; prototype/ and planning/ are never scanned); exit 1 when the share of duplicated lines is above `threshold` in that file, which never goes up; JSON report in artifacts/clone-check/; `--fixtures` asserts every case under tools/jscpd/fixtures fails on its format and `_clean` passes
clone-check *args:
    bash tools/jscpd/clone-check.sh "$@"

# * Docs enforcement gate (scripts/docs/docs-check.sh): module<->contract bijection, ADR/skill/agent README sync, PROGRESS.md sync, stale last-reviewed dates, dead repo paths, undocumented just recipes, raw pnpm/uv/npx/drizzle-kit/eas/gradlew/xcodebuild invocations in .agents|.claude|.claude/rules; `--strict` errors on the two human-approval-pending checks, `--fixtures` proves every check fails on its own fixture
docs-check *args:
    scripts/docs/docs-check.sh "$@"

# * Contract codegen: OpenAPI bundle -> hey-api, json-schema-to-typescript, datamodel-code-generator, swift-openapi-generator (Swift client), openapi-generator (Kotlin client); `--check` diffs committed output; any failing generator fails both modes and is named
generate *args:
    tools/codegen/generate.sh "$@"

# * gitleaks (history + working tree; a tracked or staged repo-root .env fails) + osv-scanner + pnpm audit + license gate (tools/security/license-policy.json) + syft SBOM (artifacts/sbom/, gitignored)
security-scan:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "==> gitleaks (git history)"
    gitleaks detect --source . --no-banner --redact
    echo "==> repo-root .env is not tracked or staged"
    # The working-tree scan below allow-lists the repo-root .env, and the history scan above reads
    # commits only. A .env that was force-added to the index and is not committed yet is therefore
    # the one case neither scan sees; without the pre-commit hook nothing else reports it before
    # the commit, and the repository is public.
    bash scripts/security/env-untracked-check.sh
    echo "==> gitleaks (working tree)"
    # Own config: .gitleaks.toml plus one path, the gitignored repo-root .env, which holds real keys
    # by design (DEC-77). Every scan of committed content, the history scan above included, reads
    # .gitleaks.toml alone, so a committed .env is still reported.
    gitleaks dir . --config tools/security/gitleaks-worktree.toml --no-banner --redact
    echo "==> osv-scanner"
    scripts/ci/osv-scan.sh
    echo "==> pnpm audit"
    pnpm audit --audit-level=high
    echo "==> license check (npm + pypi; docs/security/licenses.md)"
    scripts/security/license-check.sh
    echo "==> sbom (syft)"
    scripts/security/sbom.sh

# Generate the SPDX + CycloneDX SBOM into artifacts/sbom/ (same syft invocation as nightly.yml)
sbom:
    scripts/security/sbom.sh

# * Feature-flag expiry report (planning/14 §11, tools/flags): key, kind, owner name (owners.json), expiresAt and days left/overdue for each flag in packages/shared-kernel/registry/feature-flags.json; exit 1 when a rollout or experiment flag is past expiresAt (UTC; > 30 days overdue = DEFECT), kill-switches exempt; `--today YYYY-MM-DD` pins the date; the report runs nightly, ci-parity runs `--fixtures` (an expired fixture registry must fail, the real registry must load)
flags-report *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${1:-}" == "--fixtures" ]]; then
        exec bash tools/flags/check-fixtures.sh
    fi
    exec node tools/flags/flags-report.mjs "$@"

# --- CI-only helpers ([private]: hidden from `just --list`; called by .github/workflows/**) --

# Enable pgvector on the CI service-container database at DATABASE_URL
[private]
ci-pgvector:
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# Spectral lint of the bundled OpenAPI contract (the contracts package's lint:spectral)
[private]
ci-contracts-spectral:
    scripts/ci/contracts-spectral.sh

# Breaking-change checks against a base commit: event schemas (events-breaking.mjs) + oasdiff on the OpenAPI bundle
[private]
ci-contracts-breaking base:
    scripts/ci/contracts-breaking.sh "$1"

# Every env key read under apps/api/src is declared in .env.example
[private]
ci-env-example-check:
    scripts/ci/env-example-check.sh

# gitleaks over every ref of the full history (nightly; needs a fetch-depth: 0 checkout)
[private]
ci-gitleaks-history:
    gitleaks git --log-opts=--all --config .gitleaks.toml --redact --verbose .

# osv-scanner over every lockfile and manifest in the tree (scripts/ci/osv-scan.sh: an empty scan or an unscanned tracked lockfile fails; nightly)
[private]
ci-osv-source:
    scripts/ci/osv-scan.sh

# Push this pr-gate run's CI metrics (stylist.ci.pr_gate_duration + stylist.ci.pr_gate.runs, OTLP/HTTP to OTEL_EXPORTER_OTLP_ENDPOINT; tools/ci-metrics): `--duration <s> --conclusion <success|failure|cancelled>`, workflow + attempt from GITHUB_WORKFLOW / GITHUB_RUN_ATTEMPT; an empty endpoint or a failed push exits 0 (never fails the gate)
[private]
ci-pr-gate-metrics *args:
    node tools/ci-metrics/push-pr-gate-metrics.mjs "$@"

# Run the PR gates locally: format --check, lint (+ fixtures), typecheck, arch-check (+ fixtures), clone-check (+ fixtures), docs-check --strict (+ fixtures, incl. the hook replay), observability-sync all --check (offline), flags-report --fixtures, generate --check, test, native builds, security-scan (+ license, gitleaks and osv-scanner fixtures); native toolchains are required (Xcode-only steps skip on Linux with a notice); `--core` = pr-gate's parity job (native lanes run in ios.yml / android.yml)
ci-parity *args:
    #!/usr/bin/env bash
    set -euo pipefail
    case "${1:-}" in
        --core) export NATIVE_LANES=none ;;
        "") export NATIVE_LANES="${NATIVE_LANES-ios android}" ;;
        *) echo "just ci-parity: unknown argument '$1' (use --core)" >&2; exit 2 ;;
    esac
    export NATIVE_STRICT=1
    echo "ci-parity: native lanes: ${NATIVE_LANES:-none}"
    just format --check
    just lint
    just lint --fixtures
    just typecheck
    just arch-check
    just arch-check --fixtures
    just clone-check
    just clone-check --fixtures
    just docs-check --strict
    just docs-check --fixtures
    just observability-sync all --check
    just flags-report --fixtures
    just generate --check
    just test
    scripts/native-lane.sh android android just android-build all
    scripts/native-lane.sh ios xcode just ios-build --config dev
    scripts/native-lane.sh ios xcode just ios-test
    just security-scan
    scripts/security/license-check.sh --fixtures
    scripts/security/gitleaks-fixtures.sh
    scripts/ci/osv-scan.sh --fixtures

# --- ios (apps/ios: Swift 6 + SwiftUI; recipe bodies in apps/ios/scripts/*.sh) ------------------
# Linux-capable: ios-test-packages, ios-lint, ios-format, ios-check-banned, ios-check (Swift runs in
# Docker swift:6.4 when no working swift is on PATH). Xcode-only (macOS): ios-project, ios-build,
# ios-test, ios-e2e; on Linux they exit 1 and name the Linux-capable recipes instead.

# iOS toolchain check: Xcode vs apps/ios/.xcode-version, xcodegen/swiftlint/xcbeautify/maestro; on Linux reports what can run there (exit 0)
ios-doctor:
    apps/ios/scripts/xcode.sh doctor

# Generate apps/ios/AIStylist.xcodeproj from apps/ios/project.yml with XcodeGen (macOS only; the project is gitignored, never edit it)
ios-project:
    apps/ios/scripts/xcode.sh project

# Unsigned iOS simulator build: `just ios-build [--config dev|preview|prod]` (default dev; macOS only)
ios-build *args:
    apps/ios/scripts/xcode.sh build "$@"

# iOS package unit tests through the AIStylist-Dev scheme on an iOS 26+ iPhone simulator; result bundle apps/ios/.build/test.xcresult (macOS only)
ios-test:
    apps/ios/scripts/xcode.sh test

# Dev simulator build, then boot an iPhone simulator (IOS_SIMULATOR_ID, else the first iPhone on the newest iOS 26+ runtime), install the app, open Device Hub and launch the app (macOS only; `just dev ios` also starts the backend)
ios-run:
    apps/ios/scripts/xcode.sh run

# Dev simulator build + one shared Maestro flow (default e2e/smoke.yaml) with APP_ID=app.aistylist.mobile.dev: `just ios-e2e [flow]` (macOS only; needs maestro)
ios-e2e flow='e2e/smoke.yaml':
    apps/ios/scripts/xcode.sh e2e "$1"

# * `swift test` for apps/ios/Packages (Core + Features view models): `just ios-test-packages [core|features]`; macOS and Linux (swift on PATH, else Docker swift:6.4)
ios-test-packages *args:
    apps/ios/scripts/test-packages.sh "$@"

# * SwiftLint safety rules (apps/ios/.swiftlint.yml; swiftlint-static on Linux; missing SwiftLint fails only in CI)
ios-lint:
    apps/ios/scripts/lint.sh

# * swift-format over apps/ios App + Packages; `--check` = `swift format lint --strict`
ios-format *args:
    apps/ios/scripts/format.sh "$@"

# * iOS bans: @unchecked Sendable, nonisolated(unsafe), @preconcurrency import, UI imports in Core/*Model, generated-client imports outside APIData; `--fixtures` proves each still fires
ios-check-banned *args:
    apps/ios/scripts/check-banned.sh "$@"

# The iOS local gate: lint, format --check, bans (+ fixtures), package tests; on macOS also the Dev simulator build + simulator tests (Linux prints a skip for those two)
ios-check:
    just ios-lint
    just ios-format --check
    just ios-check-banned
    just ios-check-banned --fixtures
    just ios-test-packages
    scripts/native-lane.sh ios xcode just ios-build --config dev
    scripts/native-lane.sh ios xcode just ios-test

# --- android (apps/android: Kotlin + Jetpack Compose; Gradle via apps/android/tools/gradle.sh) ----
# Every recipe needs JDK 25 (mise) + the SDK packages `just android-sdk` checks. Only android-e2e
# needs a running emulator or device.

# Build APKs: debug (= dev, app.aistylist.mobile.dev) | preview | release (= prod, unsigned until Play signing) | all
android-build variant='debug':
    #!/usr/bin/env bash
    set -euo pipefail
    case "{{variant}}" in
        debug) tasks=(:app:assembleDebug) ;;
        preview) tasks=(:app:assemblePreview) ;;
        release) tasks=(:app:assembleRelease) ;;
        all) tasks=(:app:assembleDebug :app:assemblePreview :app:assembleRelease) ;;
        *) echo "android-build: variant must be debug|preview|release|all (got '{{variant}}')" >&2; exit 2 ;;
    esac
    apps/android/tools/gradle.sh "${tasks[@]}"
    echo "APKs: apps/android/app/build/outputs/apk/"

# * Android JVM unit tests + Robolectric Compose tests (no emulator needed)
android-test:
    apps/android/tools/gradle.sh testDebugUnitTest :core:data:test :core:analytics:test :core:designsystem:test

# * Android Lint over every module (warnings are errors, compose-lint-checks) + the module-graph allow-list
android-lint:
    apps/android/tools/gradle.sh :app:lintDebug checkModuleGraph

# * detekt (coroutines / exceptions / potential-bugs / complexity only), type-resolved
android-detekt:
    apps/android/tools/gradle.sh detektMain detektTest

# * Format Kotlin/KTS/misc with Spotless + ktlint (`--check` = verify only)
android-format *args:
    #!/usr/bin/env bash
    set -euo pipefail
    case "${1:-}" in
        --check) apps/android/tools/gradle.sh spotlessCheck ;;
        "") apps/android/tools/gradle.sh spotlessApply ;;
        *) echo "android-format: unknown argument '$1' (use --check)" >&2; exit 2 ;;
    esac

# The Android local gate in one Gradle invocation: Spotless, module graph, detekt, Android Lint, unit + Robolectric tests, all three APKs
android-check:
    apps/android/tools/gradle.sh spotlessCheck checkModuleGraph detektMain detektTest :app:lintDebug testDebugUnitTest :core:data:test :core:analytics:test :core:designsystem:test :app:assembleDebug :app:assemblePreview :app:assembleRelease

# Check (default) or install the Android SDK packages apps/android needs: `just android-sdk [check|install]` (user-level, no emulator, no sudo); `just android-sdk emulator` also installs the emulator and a system image
android-sdk mode='check':
    apps/android/tools/sdk.sh "$@"

# Refresh the Gradle lockfiles + gradle/verification-metadata.xml after a version bump (review the diff; run once on macOS too)
android-deps-lock:
    apps/android/tools/gradle.sh spotlessCheck checkModuleGraph detektMain detektTest :app:lintDebug testDebugUnitTest :core:data:test :core:analytics:test :core:designsystem:test :app:assembleDebug :app:assemblePreview :app:assembleRelease --write-locks --write-verification-metadata sha256

# Install and launch the debug (dev) build on a running emulator, else the connected phone (through `adb reverse`), else the AVD it creates and boots (apps/android/tools/device.sh run): `just android-run [--serial S] [--api-port N]` (`just dev android` also starts the backend)
android-run *args:
    apps/android/tools/device.sh run "$@"

# Install the debug (dev) build on the running emulator/device + run one shared Maestro flow (default e2e/smoke.yaml) with APP_ID=app.aistylist.mobile.dev: `just android-e2e [flow]` (needs adb + maestro)
android-e2e flow='e2e/smoke.yaml':
    #!/usr/bin/env bash
    set -euo pipefail
    command -v maestro >/dev/null 2>&1 || { echo "android-e2e: maestro not found (mise install maestro; needs a running emulator or device)" >&2; exit 1; }
    [[ -f "$1" ]] || { echo "android-e2e: Maestro flow '$1' not found" >&2; exit 1; }
    apps/android/tools/gradle.sh :app:installDebug
    maestro test -e APP_ID=app.aistylist.mobile.dev "$1"

# --- database (drizzle-kit; expand–contract) ----------------------------------------

# Generate a Drizzle migration from packages/db schema changes, named <name> (drizzle-kit generate --name); prints a reminder that packages/db/migrations/down/<idx>.sql is required by db-rollback
db-generate name:
    scripts/db/generate.sh "$@"

# Apply pending migrations (packages/db/migrations) to DATABASE_URL (env or repo-root .env)
db-migrate env='local':
    pnpm --filter @ai-stylist/db --silent migrate

# Roll back the last applied migration via packages/db/migrations/down/<idx>.sql (expand–contract by convention)
db-rollback *args:
    pnpm --filter @ai-stylist/db --silent rollback "$@"

# Drop + recreate + migrate + seed the LOCAL DB only (refuses non-local DATABASE_URL); requires --yes
db-reset *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${1:-}" != "--yes" ]]; then
        echo "db-reset is destructive: re-run as \`just db-reset --yes\`" >&2
        exit 1
    fi
    pnpm --filter @ai-stylist/db --silent reset --yes
    pnpm --filter @ai-stylist/seed-data --silent seed

# Load privacy-safe synthetic seed data into DATABASE_URL (`--accounts N` reserved for identity factories)
db-seed *args:
    pnpm --filter @ai-stylist/seed-data --silent seed "$@"

# --- assets / ML / recommendation ---------------------------------------------------

# 3D asset gate: glTF validity, KTX2, poly/texture budgets, manifest schema, morph-target names
assets-validate:
    @echo "NOT IMPLEMENTED (P02 T17): validate assets/3d/** against manifest schema + glTF validator"; exit 2

# Run versioned eval suites (classification/segmentation/try-on) against golden datasets
ml-eval:
    @echo "NOT IMPLEMENTED (P02 T17): ml eval stub"; exit 2

# Score the skill eval files with Claude Code's eval runner `claude plugin eval` in one run (tools/skills-eval/README.md; needs Claude Code 2.1.269+; spends model usage on your own credential, never part of CI): `just skills-eval [skill|all] [tasks|triggers] [--force] [--max-cost-usd N] [--runs N] [--effort low|medium|high|xhigh|max] [--model ID] [--judge-model ID] [--concurrency N] [--case GLOB] [--generate-only]`; no argument = every skill in both modes, all `triggers` (evals/trigger-evals.json against a plugin that holds every skill) before all `tasks` (evals/evals.json with and without the skill), skills by name; a skill and mode whose inputs are unchanged since its last stored score in tools/skills-eval/scoreboard.json is up to date and skipped (`--force` runs it); `--max-cost-usd` is one budget for the invocation (the runner's ceiling is what is left of it minus the runs that can be in flight, so the total stays inside it), what does not fit is left, and running the command again continues; a new score is compared with the last one (better, worse, or no measurable change inside the interval); cases are generated into one run directory per invocation under artifacts/skills-eval/ (gitignored) with result.json, report.html, run-config.json and summary.txt per skill and mode; defaults: 3 runs per case for tasks and 1 for triggers, effort high; the report is never published
skills-eval *args:
    node tools/skills-eval/skills-eval.mjs "$@"

# Accept updated golden / visual-regression baselines as a reviewed commit
golden-accept:
    @echo "NOT IMPLEMENTED (P02 T10): accept golden baselines"; exit 2

# Re-run a stored recommendation from its snapshots and diff against the stored result
rec-replay id:
    @echo "NOT IMPLEMENTED (P02 T08): replay recommendation {{id}}"; exit 2

# Regenerate recommendation golden fixtures for review
rec-golden-update:
    @echo "NOT IMPLEMENTED (P02 T08): regenerate recommendation golden fixtures"; exit 2
