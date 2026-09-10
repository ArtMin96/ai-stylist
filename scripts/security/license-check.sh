#!/usr/bin/env bash
# License gate for the JS (pnpm) and Python (uv) trees (planning/15 §9, P02 T12).
# Policy: tools/security/license-policy.json; how to read the output and add an exception:
# docs/security/licenses.md. Called by `just security-scan`; `--fixtures` proves the gate
# fails on tools/security/fixtures/agpl-tree (used by `just ci-parity`).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
POLICY="$ROOT/tools/security/license-policy.json"
EVAL=("node" "$ROOT/scripts/security/license-policy.mjs" "--policy" "$POLICY")
PIP_LICENSES_VERSION="5.5.5"

if [[ "${1:-}" == "--fixtures" ]]; then
    fixture="$ROOT/tools/security/fixtures/agpl-tree"
    set +e
    output="$("${EVAL[@]}" --node-modules-dir "$fixture" 2>&1)"
    rc=$?
    set -e
    echo "$output"
    if [[ $rc -ne 1 ]]; then
        echo "FAIL  license fixture: expected exit 1 from $fixture, got $rc" >&2
        exit 1
    fi
    for expected in 'FAIL  npm  fake-agpl-lib@1.0.0  "AGPL-3.0-only"  production dependency, deny' \
                    'WARN  npm  fake-gpl-devtool@2.0.0  "GPL-3.0-or-later"  dev-only dependency, deny'; do
        if ! grep -qF "$expected" <<<"$output"; then
            echo "FAIL  license fixture: missing expected line: $expected" >&2
            exit 1
        fi
    done
    if grep -q 'fake-mit-lib' <<<"$output"; then
        echo "FAIL  license fixture: fake-mit-lib (MIT) must not be reported" >&2
        exit 1
    fi
    echo "license fixtures: agpl-tree fails as expected (AGPL production = FAIL, GPL dev-only = WARN, MIT silent)"
    exit 0
elif [[ -n "${1:-}" ]]; then
    echo "license-check.sh: unknown argument '$1' (use --fixtures)" >&2
    exit 2
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$ROOT"

# JS: pnpm reads pnpm-lock.yaml + the installed virtual store; --prod drops devDependencies of
# every workspace package, which is how a finding is classified production vs dev-only.
pnpm licenses list --json > "$tmp/pnpm-all.json"
pnpm licenses list --json --prod > "$tmp/pnpm-prod.json"

# Python: uv has no license command. pip-licenses (pinned) runs as an ephemeral overlay on the
# workers venv; the locked set (all groups) filters the overlay out, the --no-dev export marks
# production packages. Workspace members are first-party (policy.firstParty) and skipped.
uv export --project workers --frozen --all-groups --no-hashes --no-emit-workspace --quiet > "$tmp/pip-locked.txt"
uv export --project workers --frozen --no-dev --no-hashes --no-emit-workspace --quiet > "$tmp/pip-prod.txt"
uv run --project workers --frozen --with "pip-licenses==$PIP_LICENSES_VERSION" \
    pip-licenses --format=json --from=mixed > "$tmp/pip-all.json"

"${EVAL[@]}" \
    --pnpm-all "$tmp/pnpm-all.json" --pnpm-prod "$tmp/pnpm-prod.json" \
    --pip-all "$tmp/pip-all.json" --pip-locked "$tmp/pip-locked.txt" --pip-prod "$tmp/pip-prod.txt"
