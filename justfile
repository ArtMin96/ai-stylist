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

# Full environment setup, idempotent (`--system` adds apt/udev/docker-group steps with sudo on Linux, Homebrew packages on macOS)
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

# --- dev servers ---------------------------------------------------------------

# Compose stack (Postgres+pgvector) + NestJS API in watch mode (tsx; reads the repo-root .env)
dev-api *args:
    docker compose up -d --wait postgres
    pnpm --filter @ai-stylist/api dev "$@"

# Expo dev client (Metro); `--android` targets a connected device/emulator, `--ios` the iOS simulator (macOS only)
dev-mobile *args:
    #!/usr/bin/env bash
    set -euo pipefail
    for a in "$@"; do
        if [[ "$a" == "--ios" && "$(uname -s)" != "Darwin" ]]; then
            echo "dev-mobile: --ios needs the iOS simulator (macOS + Xcode); on $(uname -s) use --android or Expo Go" >&2
            exit 1
        fi
    done
    pnpm --filter @ai-stylist/mobile exec expo start --dev-client "$@"

# Segmentation worker (FastAPI, uvicorn --reload on :8001); the Trigger.dev dev server half lands in T08
dev-workers *args:
    @echo "TODO(T08): trigger.dev dev server is not wired yet; starting the segmentation worker only"
    uv run --project workers/ml/segmentation uvicorn ai_stylist_segmentation.main:app --reload --port 8001 "$@"

# --- quality gates (* = part of ci-parity) -------------------------------------------

# * Run tests: full suite via turbo, or one module's tests/ dir (`just test recommendation`; `just test secrets` = the sops+age shell suite); SKIP_DOCKER_TESTS=1 leaves out the Testcontainers `migrations` project (runners without Docker only)
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
        exit 0
    fi
    if [[ -n "{{module}}" ]]; then
        case "{{module}}" in
            secrets) just test-secrets; exit 0 ;;
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

[private]
test-secrets:
    scripts/security/tests/secrets.test.sh

# * ESLint per workspace via turbo (boundaries, test-placement, no-skip, no-console, forbidden-field, file-size) + root tools/ + Ruff for workers + shellcheck for scripts/** and tools/**/*.sh; `--fixtures` asserts tools/eslint/fixtures each fail on their rule
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
    shellcheck -s bash -x -P SCRIPTDIR scripts/*.sh scripts/security/*.sh scripts/security/tests/*.sh tools/codegen/*.sh tools/depcruise/*.sh tools/eslint/*.sh

# * `tsc --noEmit` per workspace via turbo + basedpyright for workers
typecheck:
    pnpm turbo run typecheck
    uv run --project workers basedpyright --project workers

# * Prettier + Ruff format (workers); `just format --check` for CI
format *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${1:-}" == "--check" ]]; then
        pnpm exec prettier --check .
        uv run --project workers ruff format --check workers
    else
        pnpm exec prettier --write .
        uv run --project workers ruff format workers
    fi

# * dependency-cruiser boundary rules (tools/depcruise/rules.cjs) + banned utils/ dirs; `--fixtures` asserts tools/depcruise/fixtures each fail on their rule
arch-check *args:
    tools/depcruise/arch-check.sh "$@"

# * Contract codegen: OpenAPI bundle -> hey-api, json-schema-to-typescript, datamodel-code-generator; `--check` diffs committed output
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
    osv-scanner scan --recursive . || { rc=$?; [[ $rc -eq 128 ]] && echo "osv-scanner: no packages found" || exit $rc; }
    echo "==> pnpm audit"
    pnpm audit --audit-level=high
    echo "==> license check (npm + pypi; docs/security/licenses.md)"
    scripts/security/license-check.sh
    echo "==> sbom (syft)"
    scripts/security/sbom.sh

# Generate the SPDX + CycloneDX SBOM into artifacts/sbom/ (same syft invocation as nightly.yml)
sbom:
    scripts/security/sbom.sh

# Run the exact PR-gate sequence locally: format --check, lint (+ fixtures), typecheck, arch-check (+ fixtures), generate --check, test, security-scan (+ license fixtures)
ci-parity:
    just format --check
    just lint
    just lint --fixtures
    just typecheck
    just arch-check
    just arch-check --fixtures
    just generate --check
    just test
    just security-scan
    scripts/security/license-check.sh --fixtures

# --- database (drizzle-kit; expand–contract) ----------------------------------------

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

# --- mobile builds -------------------------------------------------------------------

# iOS build lane: no `--cloud` on macOS = local `expo run:ios` (simulator; `--device` for a plugged-in iPhone); `--cloud eas` (EAS Build) or `--cloud gha` (xcodebuild archive; macOS only); `--profile dev|preview|prod` (ADR-0002 picks the default in T15)
mobile-ios-build *args:
    #!/usr/bin/env bash
    set -euo pipefail
    cloud="" profile="dev" device=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --cloud) cloud="$2"; shift 2 ;;
            --profile) profile="$2"; shift 2 ;;
            --device) device=1; shift ;;
            *) echo "mobile-ios-build: unknown argument '$1' (use [--cloud eas|gha] --profile dev|preview|prod [--device])" >&2; exit 1 ;;
        esac
    done
    case "$profile" in dev|preview|prod) ;; *) echo "mobile-ios-build: --profile must be dev|preview|prod" >&2; exit 1 ;; esac
    cd apps/mobile
    case "$cloud" in
        '')
            # Local lane (macOS only): `npx expo run:ios` is Expo's documented path for compiling a
            # development build locally (docs.expo.dev/get-started/set-up-your-environment, local
            # build env, checked 2026-09-10); `eas build --local` exists only to reproduce cloud
            # build failures (docs.expo.dev/build-reference/local-builds). run:ios prebuilds ios/
            # (CNG; CocoaPods still used in SDK 57), compiles with Xcode and installs on the
            # simulator, or on a USB device with --device (needs a signing team in Xcode).
            if [[ "$(uname -s)" != "Darwin" ]]; then
                echo "mobile-ios-build: iOS cannot be built on $(uname -s) (no Xcode). Use --cloud eas, or --cloud gha via the ios-gha-macos workflow." >&2
                exit 1
            fi
            if ! xcode-select -p >/dev/null 2>&1; then
                echo "mobile-ios-build: Xcode Command Line Tools missing — run: xcode-select --install (and install Xcode from the App Store)" >&2
                exit 1
            fi
            configuration=Release; [[ "$profile" == "dev" ]] && configuration=Debug
            run_args=(--configuration "$configuration"); [[ $device -eq 1 ]] && run_args+=(--device)
            pnpm exec expo run:ios "${run_args[@]}"
            ;;
        eas)
            # eas-cli is not pinned yet (T14 adds it to mise.toml); fall back to a one-off pnpm dlx.
            if command -v eas >/dev/null; then eas build --platform ios --profile "$profile" --non-interactive
            else pnpm dlx eas-cli@latest build --platform ios --profile "$profile" --non-interactive; fi
            ;;
        gha)
            if [[ "$(uname -s)" != "Darwin" ]]; then
                echo "mobile-ios-build: iOS cannot be built on $(uname -s) (no Xcode/Metal/signing). Run the ios-gha-macos workflow, or use --cloud eas." >&2
                exit 1
            fi
            # macOS lane: CNG prebuild (+ pod install), then an Xcode archive under ios/build/.
            # Unsigned unless APPLE_TEAM_ID is set; IPA export needs ios/ExportOptions.plist (T14).
            pnpm exec expo prebuild --platform ios
            workspace=$(ls -d ios/*.xcworkspace | head -n1)
            scheme=$(basename "$workspace" .xcworkspace)
            configuration=Release; [[ "$profile" == "dev" ]] && configuration=Debug
            signing=(CODE_SIGNING_ALLOWED=NO); [[ -n "${APPLE_TEAM_ID:-}" ]] && signing=(DEVELOPMENT_TEAM="$APPLE_TEAM_ID")
            xcodebuild -workspace "$workspace" -scheme "$scheme" -configuration "$configuration" \
                -destination 'generic/platform=iOS' -archivePath "ios/build/$scheme.xcarchive" archive "${signing[@]}"
            if [[ -n "${APPLE_TEAM_ID:-}" && -f ios/ExportOptions.plist ]]; then
                xcodebuild -exportArchive -archivePath "ios/build/$scheme.xcarchive" -exportOptionsPlist ios/ExportOptions.plist -exportPath ios/build
            else
                echo "archive at apps/mobile/ios/build/$scheme.xcarchive; IPA export skipped (needs APPLE_TEAM_ID + ios/ExportOptions.plist, T14)"
            fi
            ;;
        *)
            echo "mobile-ios-build: --cloud must be eas|gha (omit it on macOS for a local expo run:ios build; ADR-0002 picks the default in T15)" >&2
            exit 1
            ;;
    esac

# Android APK/AAB: local CNG prebuild + Gradle when the Android SDK is found (ANDROID_HOME, or the default Studio location per OS), `--cloud` for EAS; `--profile dev|preview|prod`
mobile-android-build *args:
    #!/usr/bin/env bash
    set -euo pipefail
    cloud=0 profile="dev"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --cloud) cloud=1; shift ;;
            --profile) profile="$2"; shift 2 ;;
            *) echo "mobile-android-build: unknown argument '$1' (use [--cloud] --profile dev|preview|prod)" >&2; exit 1 ;;
        esac
    done
    case "$profile" in dev|preview|prod) ;; *) echo "mobile-android-build: --profile must be dev|preview|prod" >&2; exit 1 ;; esac
    cd apps/mobile
    if [[ $cloud -eq 1 ]]; then
        if command -v eas >/dev/null; then eas build --platform android --profile "$profile" --non-interactive
        else pnpm dlx eas-cli@latest build --platform android --profile "$profile" --non-interactive; fi
        exit 0
    fi
    if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
        # Android Studio's default SDK location: ~/Library/Android/sdk (macOS), ~/Android/Sdk (Linux).
        for candidate in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
            if [[ -d "$candidate/platform-tools" ]]; then export ANDROID_HOME="$candidate"; break; fi
        done
    fi
    if [[ -z "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]]; then
        echo "mobile-android-build: ANDROID_HOME is not set and no SDK found in ~/Library/Android/sdk or ~/Android/Sdk." >&2
        echo "  install Android Studio (or the SDK via \`just bootstrap --system\` on Linux), or run \`just mobile-android-build --cloud --profile $profile\` for an EAS build." >&2
        exit 1
    fi
    pnpm exec expo prebuild --platform android --no-install
    # Outputs land in android/app/build/outputs/{apk,bundle}/** (the android.yml artifact globs).
    # Signing config for ANDROID_KEYSTORE_* is wired by T14; until then release builds are debug-signed.
    case "$profile" in
        prod) (cd android && ./gradlew --quiet bundleRelease assembleRelease) ;;
        preview) (cd android && ./gradlew --quiet assembleRelease) ;;
        *) (cd android && ./gradlew --quiet assembleDebug) ;;
    esac
    echo "artifacts under apps/mobile/android/app/build/outputs/"

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
