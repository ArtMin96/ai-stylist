#!/usr/bin/env bash
# Fixture for the gitleaks path allowlists (.gitleaks.toml, tools/security/gitleaks-worktree.toml).
# It scans a private temp tree the way `just security-scan` scans the working tree (`gitleaks dir .`
# from the tree root, with the working-tree config) and proves both allowlists are narrow:
#   - native build caches: a fake-but-matching generic-api-key is still detected in source-style
#     paths (and near-miss names such as build.gradle.kts, build-logic/), and is NOT reported under
#     the gitignored build caches (apps/ios .build/ + DerivedData/, apps/android build/ + .gradle/
#     + .kotlin/);
#   - the repo-root .env (DEC-77): NOT reported at the tree root, still detected in a nested .env
#     and under every other name (.env.local).
# A second scan with .gitleaks.toml alone, the config of the pre-commit hook and the history scans,
# proves the root .env is still reported there. Run by `just ci-parity`.
# Usage: scripts/security/gitleaks-fixtures.sh
# Exit codes: 0 every case holds; 1 a case failed, or gitleaks could not run.
# The token is assembled at runtime and written only to a private temp tree, so this file never
# contains a key-shaped string and the repo's own scans stay clean. Findings are --redact'ed.
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

WORKTREE_CONFIG="tools/security/gitleaks-worktree.toml"
tmp_base="${TMPDIR:-/tmp}"
TREE="$(mktemp -d "${tmp_base%/}/ai-stylist-gitleaks-fixture.XXXXXX")"
# Beside the tree, not inside it: a report inside the scan root would be scanned too.
reports="$TREE.reports"
trap 'rm -rf "$TREE" "$reports"' EXIT
mkdir -p "$reports"

# The scans run from the fixture tree, where a mise shim cannot resolve the pinned gitleaks (a shim
# takes the version from the mise.toml at or above its working directory), so the path of the
# binary itself is resolved here, from the repo, with the mise that scripts/lib.sh found
# (MISE_BIN). Without mise, the gitleaks on PATH is used.
if ! gitleaks_bin="$(cd "$REPO_ROOT" && { "$MISE_BIN" which gitleaks 2>/dev/null || command -v gitleaks; })"; then
    echo "FAIL  gitleaks fixture: gitleaks not found (mise.toml pins it: run 'just bootstrap')" >&2
    exit 1
fi

# Synthetic test token, typed by hand for this fixture — not a credential for any service. It
# cannot say "fake"/"test" itself: generic-api-key's stopword filter drops such values, which would
# make the fixture pass vacuously. Split so no source line in this file matches a rule.
fake_token="$(printf 'Zq7%s' 'Xv2Lp9Rt4Wm8Kd3Hs6Ny1Bf5Gj0Ce')"

must_detect="apps/ios/Packages/Core/Sources/Core/Config.swift
apps/android/core/data/src/main/kotlin/Config.kt
apps/android/build.gradle.kts
apps/android/build-logic/convention/src/main/kotlin/Config.kt
packages/example/build/config.txt
apps/api/.env
workers/.env
.env.local"

must_ignore="apps/ios/.build/spm-Core/out/v5/records/AB/Core.swiftmodule-fixture
apps/ios/Packages/Core/.build/debug/Core.swiftmodule-fixture
apps/ios/DerivedData/AIStylist/Build/Intermediates/fixture.txt
apps/android/app/build/intermediates/fixture.txt
apps/android/build-logic/convention/build/tmp/fixture.txt
apps/android/.gradle/8.14/fixture.txt
apps/android/.kotlin/sessions/fixture.txt
.env"

for rel in $must_detect $must_ignore; do
    mkdir -p "$TREE/$(dirname "$rel")"
    printf 'api_key = "%s"\n' "$fake_token" > "$TREE/$rel"
done
# Both configs sit where they do in the repo: the working-tree config extends .gitleaks.toml by a
# path that gitleaks resolves from the directory it runs in.
mkdir -p "$TREE/$(dirname "$WORKTREE_CONFIG")"
cp "$REPO_ROOT/.gitleaks.toml" "$TREE/.gitleaks.toml"
cp "$REPO_ROOT/$WORKTREE_CONFIG" "$TREE/$WORKTREE_CONFIG"

# Scan the fixture tree from its root with config $1 (a path inside the tree) and write the JSON
# report to $2. Anything but "leaks found" with a report (config error, broken binary) is a hard
# failure: otherwise every must_ignore case would pass vacuously on an empty report.
scan_tree() {
    local config="$1" report="$2" rc=0
    (cd "$TREE" && "$gitleaks_bin" dir . --config "$config" --no-banner --redact \
        --log-level error --report-format json --report-path "$report") || rc=$?
    if [[ $rc -ne 1 || ! -s "$report" ]]; then
        echo "FAIL  gitleaks fixture: expected exit 1 with a JSON report from $config, got exit $rc" >&2
        exit 1
    fi
}

# True when report $2 has a finding in file $1 (a path relative to the tree root).
reported() {
    grep -qF "\"File\": \"$1\"" "$2"
}

scan_tree "$WORKTREE_CONFIG" "$reports/worktree.json"
scan_tree .gitleaks.toml "$reports/base.json"

failures=0
for rel in $must_detect; do
    if reported "$rel" "$reports/worktree.json"; then
        echo "PASS  detected    $rel"
    else
        echo "FAIL  gitleaks fixture: not detected: $rel" >&2
        failures=$((failures + 1))
    fi
done
for rel in $must_ignore; do
    if reported "$rel" "$reports/worktree.json"; then
        echo "FAIL  gitleaks fixture: not allowlisted in the working-tree scan: $rel" >&2
        failures=$((failures + 1))
    else
        echo "PASS  allowlisted $rel"
    fi
done
# The pre-commit hook, the PR-diff scan and the history scans use .gitleaks.toml alone. A root .env
# must be reported there, so a force-added .env cannot be committed unnoticed.
if reported .env "$reports/base.json"; then
    echo "PASS  detected    .env (with .gitleaks.toml alone)"
else
    echo "FAIL  gitleaks fixture: .gitleaks.toml alone does not report the root .env" >&2
    failures=$((failures + 1))
fi
if [[ $failures -ne 0 ]]; then
    echo "gitleaks fixtures: $failures failure(s)" >&2
    exit 1
fi
echo "gitleaks fixtures: source paths and other .env files still detected (generic-api-key); native build caches and the root .env allowlisted in the working-tree scan only"
