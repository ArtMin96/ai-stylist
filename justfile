# AI Stylist — single entry point for every dev/CI command (planning/15 §5).
# CI calls these recipes; never re-implement them in YAML. Recipe names use dashes.
# Recipes marked NOT IMPLEMENTED (P02 Tnn) exit 2 until that task lands.

set shell := ["bash", "-euo", "pipefail", "-c"]
set positional-arguments := true

# Pinned tools resolve via mise shims without shell activation.
export PATH := home_directory() / ".local/share/mise/shims" + ":" + home_directory() / ".local/bin" + ":" + env_var("PATH")


# Show all recipes
[private]
default:
    @just --list --unsorted

# --- environment ---------------------------------------------------------------

# Full environment setup, idempotent (`--system` adds apt/udev/docker-group steps with sudo)
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

# --- dev servers ---------------------------------------------------------------

# Compose stack (Postgres+pgvector) + NestJS API in watch mode (tsx; reads the repo-root .env)
dev-api *args:
    docker compose up -d --wait postgres
    pnpm --filter @ai-stylist/api dev "$@"

# Expo dev client (Metro); `--android` targets a connected device/emulator
dev-mobile *args:
    pnpm --filter @ai-stylist/mobile exec expo start --dev-client "$@"

# Segmentation worker (FastAPI, uvicorn --reload on :8001); the Trigger.dev dev server half lands in T08
dev-workers *args:
    @echo "TODO(T08): trigger.dev dev server is not wired yet; starting the segmentation worker only"
    uv run --project workers/ml/segmentation uvicorn ai_stylist_segmentation.main:app --reload --port 8001 "$@"

# --- quality gates (* = part of ci-parity) -------------------------------------------

# * Run tests: full suite via turbo, or one module's tests/ dir (`just test recommendation`)
test module='':
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ -n "{{module}}" ]]; then
        case "{{module}}" in
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

# * ESLint per workspace via turbo (boundaries, test-placement, no-skip, no-console, forbidden-field, file-size) + root tools/ + Ruff for workers; `--fixtures` asserts tools/eslint/fixtures each fail on their rule
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

# iOS build lane: `--cloud eas` (EAS Build) or `--cloud gha` (runs xcodebuild; macOS only), `--profile dev|preview|prod` (ADR-0002 picks the default in T15)
mobile-ios-build *args:
    #!/usr/bin/env bash
    set -euo pipefail
    cloud="" profile="dev"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --cloud) cloud="$2"; shift 2 ;;
            --profile) profile="$2"; shift 2 ;;
            *) echo "mobile-ios-build: unknown argument '$1' (use --cloud eas|gha --profile dev|preview|prod)" >&2; exit 1 ;;
        esac
    done
    case "$profile" in dev|preview|prod) ;; *) echo "mobile-ios-build: --profile must be dev|preview|prod" >&2; exit 1 ;; esac
    cd apps/mobile
    case "$cloud" in
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
            echo "mobile-ios-build: --cloud eas|gha is required (ADR-0002 picks the default in T15)" >&2
            exit 1
            ;;
    esac

# Android APK/AAB: local CNG prebuild + Gradle when ANDROID_HOME is set, `--cloud` for EAS; `--profile dev|preview|prod`
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
        echo "mobile-android-build: ANDROID_HOME is not set (no Android SDK on this machine)." >&2
        echo "  install the SDK via \`just bootstrap --system\`, or run \`just mobile-android-build --cloud --profile $profile\` for an EAS build." >&2
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
