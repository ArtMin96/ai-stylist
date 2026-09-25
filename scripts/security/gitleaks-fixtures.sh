#!/usr/bin/env bash
# Fixture for the working-tree gitleaks scan (`just security-scan`, .gitleaks.toml). Proves the
# native build-cache path allowlist is narrow: a fake-but-matching generic-api-key is still
# detected in source-style paths (and near-miss names such as build.gradle.kts, build-logic/),
# and is NOT reported under the gitignored build caches (apps/ios .build/ + DerivedData/,
# apps/android build/ + .gradle/ + .kotlin/). Run by `just ci-parity`.
# Usage: scripts/security/gitleaks-fixtures.sh
# The token is assembled at runtime and written only to a private temp tree, so this file never
# contains a key-shaped string and the repo's own scans stay clean. Findings are --redact'ed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp_base="${TMPDIR:-/tmp}"
TREE="$(mktemp -d "${tmp_base%/}/ai-stylist-gitleaks-fixture.XXXXXX")"
# Physical path (macOS: $TMPDIR has a trailing slash and /var -> /private/var) so the paths
# gitleaks reports match the ones grepped below.
TREE="$(cd "$TREE" && pwd -P)"
report="$TREE.report.json"
trap 'rm -rf "$TREE" "$report"' EXIT

# Synthetic test token, typed by hand for this fixture — not a credential for any service. It
# cannot say "fake"/"test" itself: generic-api-key's stopword filter drops such values, which would
# make the fixture pass vacuously. Split so no source line in this file matches a rule.
fake_token="$(printf 'Zq7%s' 'Xv2Lp9Rt4Wm8Kd3Hs6Ny1Bf5Gj0Ce')"

must_detect="apps/ios/Packages/Core/Sources/Core/Config.swift
apps/android/core/data/src/main/kotlin/Config.kt
apps/android/build.gradle.kts
apps/android/build-logic/convention/src/main/kotlin/Config.kt
packages/example/build/config.txt"

must_ignore="apps/ios/.build/spm-Core/out/v5/records/AB/Core.swiftmodule-fixture
apps/ios/Packages/Core/.build/debug/Core.swiftmodule-fixture
apps/ios/DerivedData/AIStylist/Build/Intermediates/fixture.txt
apps/android/app/build/intermediates/fixture.txt
apps/android/build-logic/convention/build/tmp/fixture.txt
apps/android/.gradle/8.14/fixture.txt
apps/android/.kotlin/sessions/fixture.txt"

for rel in $must_detect $must_ignore; do
    mkdir -p "$TREE/$(dirname "$rel")"
    printf 'api_key = "%s"\n' "$fake_token" > "$TREE/$rel"
done

set +e
# cwd = ROOT so the mise shim resolves the pinned gitleaks; the scan root is the temp tree.
(cd "$ROOT" && gitleaks dir "$TREE" --config "$ROOT/.gitleaks.toml" --no-banner --redact \
    --log-level error --report-format json --report-path "$report")
rc=$?
set -e

# Anything but "leaks found" with a report (config error, missing binary) is a hard failure:
# otherwise every must_ignore case would pass vacuously on an empty report.
if [[ $rc -ne 1 || ! -s "$report" ]]; then
    echo "FAIL  gitleaks fixture: expected exit 1 with a JSON report, got exit $rc" >&2
    exit 1
fi
failures=0
for rel in $must_detect; do
    if grep -qF "\"File\": \"$TREE/$rel\"" "$report"; then
        echo "PASS  detected   $rel"
    else
        echo "FAIL  gitleaks fixture: not detected: $rel" >&2
        failures=$((failures + 1))
    fi
done
for rel in $must_ignore; do
    if grep -qF "\"File\": \"$TREE/$rel\"" "$report"; then
        echo "FAIL  gitleaks fixture: build cache not allowlisted: $rel" >&2
        failures=$((failures + 1))
    else
        echo "PASS  allowlisted $rel"
    fi
done
if [[ $failures -ne 0 ]]; then
    echo "gitleaks fixtures: $failures failure(s)" >&2
    exit 1
fi
echo "gitleaks fixtures: source paths still detected (generic-api-key), native build caches allowlisted"
