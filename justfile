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

[private]
test-secrets:
    scripts/security/tests/secrets.test.sh

# Prove a regression test fails at the merge-base and passes at HEAD (scripts/test/regression.sh <test-file>); structural version of CLAUDE.md's "regression test fails before the fix"
test-regression file:
    scripts/test/regression.sh "$@"

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
    shellcheck -s bash -x -P SCRIPTDIR scripts/*.sh scripts/security/*.sh scripts/security/tests/*.sh scripts/docs/*.sh scripts/docs/lib/*.sh scripts/hooks/*.sh scripts/test/*.sh scripts/db/*.sh scripts/ci/*.sh scripts/lint-file.sh tools/codegen/*.sh tools/depcruise/*.sh tools/eslint/*.sh

# Single-file lint dispatch by extension (.ts/.tsx/.mjs/.cjs -> eslint, .py -> ruff, .sh -> shellcheck, else no-op); used by the PostToolUse hook so one edit doesn't pay for a whole-repo lint
lint-file path:
    scripts/lint-file.sh "$@"

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

# * Docs enforcement gate (scripts/docs/docs-check.sh): module<->contract bijection, ADR/skill/agent README sync, PROGRESS.md sync, stale last-reviewed dates, dead repo paths, undocumented just recipes, raw pnpm/uv/npx/drizzle-kit/eas invocations in .agents|.claude|.claude/rules; `--strict` errors on the two human-approval-pending checks, `--fixtures` proves every check fails on its own fixture
docs-check *args:
    scripts/docs/docs-check.sh "$@"

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

# osv-scanner over every lockfile and manifest in the tree (npm + PyPI + Actions; nightly)
[private]
ci-osv-source:
    osv-scanner scan source --recursive .

# Run the exact PR-gate sequence locally: format --check, lint (+ fixtures), typecheck, arch-check (+ fixtures), generate --check, test, security-scan (+ license fixtures)
ci-parity:
    just format --check
    just lint
    just lint --fixtures
    just typecheck
    just arch-check
    just arch-check --fixtures
    just docs-check --strict
    just generate --check
    just test
    just security-scan
    scripts/security/license-check.sh --fixtures

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
