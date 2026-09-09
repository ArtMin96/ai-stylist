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

# Decrypt sops dev secrets (secrets/dev.enc.yaml) into the gitignored .env
secrets-sync:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -f secrets/dev.enc.yaml ]]; then
        echo "NOT IMPLEMENTED (P02 T02): decrypt secrets/dev.enc.yaml -> .env (no encrypted file or age keys exist yet)" >&2
        exit 2
    fi
    sops --decrypt --input-type yaml --output-type dotenv secrets/dev.enc.yaml > .env
    echo "wrote .env from secrets/dev.enc.yaml"

# --- dev servers ---------------------------------------------------------------

# Compose stack (Postgres+pgvector) + NestJS API in watch mode (tsx; reads the repo-root .env)
dev-api *args:
    docker compose up -d --wait postgres
    pnpm --filter @ai-stylist/api dev "$@"

# Expo dev client (Metro); `--android` targets a connected device/emulator
dev-mobile *args:
    @echo "NOT IMPLEMENTED (P02 T10): pnpm --filter mobile start --dev-client [--android]"; exit 2

# Python ML workers + Trigger.dev dev server locally
dev-workers *args:
    @echo "NOT IMPLEMENTED (P02 T08): uv run workers + trigger.dev dev"; exit 2

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

# * ESLint (boundaries, no-skip, no-console, ...) via turbo + Ruff for workers
lint:
    pnpm turbo run lint
    @if [ -d workers ]; then echo "TODO(P02 T08): ruff check workers/"; fi

# * `tsc --noEmit` per workspace via turbo + Pyright for workers
typecheck:
    pnpm turbo run typecheck
    @if [ -d workers ]; then echo "TODO(P02 T08): pyright workers/"; fi

# * Prettier (+ Ruff format once workers exist); `just format --check` for CI
format *args:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ "${1:-}" == "--check" ]]; then
        pnpm exec prettier --check .
    else
        pnpm exec prettier --write .
    fi
    if [[ -d workers ]]; then echo "TODO(P02 T08): ruff format workers/ ${1:-}"; fi

# * dependency-cruiser boundary rules (tools/depcruise/rules.cjs)
arch-check:
    @echo "NOT IMPLEMENTED (P02 T06): pnpm exec depcruise --config tools/depcruise/rules.cjs apps packages"; exit 2

# * Contract codegen: OpenAPI bundle -> hey-api, json-schema-to-typescript, datamodel-code-generator; `--check` diffs committed output
generate *args:
    tools/codegen/generate.sh "$@"

# * gitleaks + osv-scanner + pnpm audit + license check (+ syft SBOM in T12)
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
    echo "==> license check"
    echo "TODO(P02 T12): license gate (no GPL/AGPL) + syft SBOM"

# Run the exact PR-gate sequence locally: format --check, lint, typecheck, arch-check, generate --check, test, security-scan
ci-parity:
    just format --check
    just lint
    just typecheck
    just arch-check
    just generate --check
    just test
    just security-scan

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

# Trigger the cloud iOS build lane (EAS or GHA macOS per ADR-P02); `--profile dev|preview|prod`
mobile-ios-build *args:
    @echo "NOT IMPLEMENTED (P02 T14): trigger remote iOS build {{args}}"; exit 2

# Local release/debug APK+AAB via Gradle; `--cloud` for CI-parity build
mobile-android-build *args:
    @echo "NOT IMPLEMENTED (P02 T14): gradle assemble/bundle {{args}}"; exit 2

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
