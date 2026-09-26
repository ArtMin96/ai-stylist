# AI Stylist — single entry point for every dev/CI command (planning/15 §5).
# CI calls these recipes; never re-implement them in YAML. Recipe names use dashes.
# Recipes marked NOT IMPLEMENTED (P02 Tnn) exit 2 until that task lands.

# `bash` resolves to /bin/bash 3.2 on macOS (Homebrew bash is optional): recipes and scripts/**
# stay bash 3.2-clean and use only POSIX/BSD-compatible flags (docs/DEVELOPING-ON-MACOS.md).
set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

# Pinned tools resolve via mise shims without shell activation.
export PATH := home_directory() / ".local/share/mise/shims" + ":" + home_directory() / ".local/bin" + ":" + env_var("PATH")


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

# --- dev servers ---------------------------------------------------------------

# Compose stack (Postgres+pgvector) + NestJS API in watch mode (tsx; reads the repo-root .env)
dev-api *args:
    docker compose up -d --wait postgres
    pnpm --filter @ai-stylist/api dev "$@"

# Segmentation worker (FastAPI, uvicorn --reload on :8001); TODO(T08): pg-boss handlers run in the API process; starting the segmentation worker only
dev-workers *args:
    @echo "TODO(T08): pg-boss handlers run in the API process; starting the segmentation worker only"
    uv run --project workers/ml/segmentation uvicorn ai_stylist_segmentation.main:app --reload --port 8001 "$@"

# --- quality gates (* = part of ci-parity) -------------------------------------------

# * Run tests: full suite via turbo + the native lanes, or one module's tests/ dir (`just test recommendation`; `just test ios` / `just test android` = that app's unit tests; `just test secrets` = the sops+age shell suite; `just test tooling` = the scripts/test shell suites: bootstrap/doctor, contracts-breaking, test-regression); SKIP_DOCKER_TESTS=1 leaves out the Testcontainers `migrations` project (runners without Docker only)
test module='':
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${SKIP_DOCKER_TESTS:-}" == "1" && -z "{{module}}" ]]; then
        # apps/api/vitest.config.ts has two projects: `api` and `migrations` (Testcontainers; it
        # FAILS without Docker, never skips). Run every other workspace through turbo, then only
        # the `api` project. Docker-less hosts only (portability.yml on macos-15): never in pr-gate.
        echo "SKIP_DOCKER_TESTS=1: skipping apps/api vitest project 'migrations' (Testcontainers needs Docker)" >&2
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
    scripts/test/regression.test.sh

# Native unit tests for the full `just test` (lane/toolchain policy: scripts/native-lane.sh)
[private]
test-native:
    scripts/native-lane.sh ios swift just ios-test-packages
    scripts/native-lane.sh android android just android-test

# Prove a regression test fails before the fix and passes after it: the working-tree test file runs against the merge-base code (expect FAIL), then at HEAD (expect PASS) (scripts/test/regression.sh <test-file>); structural version of CLAUDE.md's "regression test fails before the fix"
test-regression file:
    scripts/test/regression.sh "$@"

# * ESLint per workspace via turbo (boundaries, test-placement, no-skip, no-console, forbidden-field, file-size) + root tools/ + Ruff for workers + shellcheck for scripts/**, tools/**/*.sh and the native apps' scripts + actionlint + the native lanes (SwiftLint; Android Lint + detekt); `--fixtures` asserts tools/eslint/fixtures each fail on their rule
lint *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${1:-}" == "--fixtures" ]]; then
        exec tools/eslint/check-fixtures.sh
    elif [[ -n "${1:-}" ]]; then
        echo "just lint: unknown argument '$1' (use --fixtures)" >&2; exit 2
    fi
    pnpm turbo run lint
    pnpm exec eslint tools eslint.config.mjs
    uv run --project workers ruff check workers
    # -s bash: every script must run under macOS /bin/bash 3.2 as well (docs/DEVELOPING-ON-MACOS.md)
    shellcheck -s bash -x -P SCRIPTDIR scripts/*.sh scripts/security/*.sh scripts/security/tests/*.sh scripts/docs/*.sh scripts/docs/lib/*.sh scripts/hooks/*.sh scripts/test/*.sh scripts/db/*.sh scripts/ci/*.sh scripts/lint-file.sh scripts/native-lane.sh tools/codegen/*.sh tools/depcruise/*.sh tools/eslint/*.sh apps/ios/scripts/*.sh apps/android/tools/*.sh
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

# * Docs enforcement gate (scripts/docs/docs-check.sh): module<->contract bijection, ADR/skill/agent README sync, PROGRESS.md sync, stale last-reviewed dates, dead repo paths, undocumented just recipes, raw pnpm/uv/npx/drizzle-kit/eas/gradlew/xcodebuild invocations in .agents|.claude|.claude/rules; `--strict` errors on the two human-approval-pending checks, `--fixtures` proves every check fails on its own fixture
docs-check *args:
    scripts/docs/docs-check.sh "$@"

# * Contract codegen: OpenAPI bundle -> hey-api, json-schema-to-typescript, datamodel-code-generator, swift-openapi-generator (Swift client), openapi-generator (Kotlin client); `--check` diffs committed output
generate *args:
    tools/codegen/generate.sh "$@"

# * gitleaks + osv-scanner + pnpm audit + license gate (tools/security/license-policy.json) + syft SBOM (artifacts/sbom/, gitignored)
security-scan:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "==> gitleaks (git history)"
    gitleaks detect --source . --no-banner --redact
    echo "==> gitleaks (working tree)"
    gitleaks dir . --no-banner --redact
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

# --- CI-only helpers ([private]: hidden from `just --list`; called by .github/workflows/**) --

# Enable pgvector on the CI service-container database at DATABASE_URL
[private]
ci-pgvector:
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# Spectral lint of packages/contracts/openapi (skips until the sources and spectral exist)
[private]
ci-contracts-spectral:
    scripts/ci/contracts-spectral.sh

# oasdiff breaking-change check of the OpenAPI bundle against a base commit
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

# Run the PR gates locally: format --check, lint (+ fixtures), typecheck, arch-check (+ fixtures), docs-check --strict (+ fixtures, incl. the hook replay), generate --check, test, native builds, security-scan (+ license, gitleaks and osv-scanner fixtures); native toolchains are required (Xcode-only steps skip on Linux with a notice); `--core` = pr-gate's parity job (native lanes run in ios.yml / android.yml)
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
    just docs-check --strict
    just docs-check --fixtures
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
# Every recipe needs JDK 21 (mise) + the SDK packages `just android-sdk` checks. Only android-e2e
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
    apps/android/tools/gradle.sh testDebugUnitTest :core:data:test :core:analytics:test

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
    apps/android/tools/gradle.sh spotlessCheck checkModuleGraph detektMain detektTest :app:lintDebug testDebugUnitTest :core:data:test :core:analytics:test :app:assembleDebug :app:assemblePreview :app:assembleRelease

# Check (default) or install the Android SDK packages apps/android needs: `just android-sdk [check|install]` (user-level, no emulator, no sudo)
android-sdk mode='check':
    apps/android/tools/sdk.sh "$@"

# Refresh the Gradle lockfiles + gradle/verification-metadata.xml after a version bump (review the diff; run once on macOS too)
android-deps-lock:
    apps/android/tools/gradle.sh spotlessCheck checkModuleGraph detektMain detektTest :app:lintDebug testDebugUnitTest :core:data:test :core:analytics:test :app:assembleDebug :app:assemblePreview :app:assembleRelease --write-locks --write-verification-metadata sha256

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

# Accept updated golden / visual-regression baselines as a reviewed commit
golden-accept:
    @echo "NOT IMPLEMENTED (P02 T10): accept golden baselines"; exit 2

# Re-run a stored recommendation from its snapshots and diff against the stored result
rec-replay id:
    @echo "NOT IMPLEMENTED (P02 T08): replay recommendation {{id}}"; exit 2

# Regenerate recommendation golden fixtures for review
rec-golden-update:
    @echo "NOT IMPLEMENTED (P02 T08): regenerate recommendation golden fixtures"; exit 2
