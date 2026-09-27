#!/usr/bin/env bash
# P02-T09 AC-9, run by `just lint --fixtures`: every tree under tools/analytics/fixtures/<case>/
# must make check-events.mjs exit 1 with the rule named below reported for EVERY Swift and Kotlin
# file in the case, and no finding of another rule. `_clean/` holds the call shapes the apps use
# (taxonomy constants, comments, strings, the sinks' pass-through) and must exit 0 with no finding.
# The taxonomy is always the repo's own events.json, never a fixture copy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURES="$ROOT/tools/analytics/fixtures"
CHECK=(node "$ROOT/tools/analytics/check-events.mjs")

# case -> rule it must trip (`none` = must pass). A case statement instead of an associative array
# so the script runs under macOS /bin/bash 3.2; keep EXPECTED_CASES in sync.
EXPECTED_CASES="_clean unknown-event undeclared-property not-static"
expected_rule() {
  case "$1" in
    _clean)              echo none ;;
    unknown-event)       echo unknown-event ;;
    undeclared-property) echo undeclared-property ;;
    not-static)          echo not-static ;;
    *)                   echo "" ;;
  esac
}

failures=0
fail() {
  echo "FAIL  $1" >&2
  [[ -z "${2:-}" ]] || printf '%s\n' "$2" >&2
  failures=$((failures + 1))
}

for case_dir in "$FIXTURES"/*/; do
  # No trailing slash: BSD find (macOS) would print "<dir>//<file>".
  case_dir="${case_dir%/}"
  name="$(basename "$case_dir")"
  rule="$(expected_rule "$name")"
  if [[ -z "$rule" ]]; then
    fail "$name: no expected rule registered in check-fixtures.sh"
    continue
  fi
  set +e
  output="$("${CHECK[@]}" --root "$case_dir" 2>&1)"
  rc=$?
  set -e
  if [[ "$rule" == none ]]; then
    if [[ $rc -eq 0 ]]; then
      echo "ok    $name -> no finding (exit 0)"
    else
      fail "$name: expected exit 0 and no finding, got exit $rc:" "$output"
    fi
    continue
  fi
  if [[ $rc -ne 1 ]]; then
    fail "$name: exit $rc, expected 1 with '$rule' findings:" "$output"
    continue
  fi
  findings="$(grep -E '^[^ ]+:[0-9]+: [a-z-]+: ' <<<"$output" || true)"
  other="$(grep -vE "^[^ ]+:[0-9]+: $rule: " <<<"$findings" || true)"
  if [[ -n "$other" ]]; then
    fail "$name: findings of a rule other than '$rule':" "$other"
    continue
  fi
  sources="$(find "$case_dir" -type f \( -name '*.swift' -o -name '*.kt' \) | sort)"
  unreported=0
  while IFS= read -r src; do
    rel="${src#"$case_dir"/}"
    hits="$(grep -F -- "$rel:" <<<"$findings" || true)"
    if [[ -z "$hits" ]]; then
      fail "$name: $rel is not reported with '$rule':" "$output"
      unreported=1
    fi
  done <<<"$sources"
  if [[ $unreported -eq 0 ]]; then
    echo "ok    $name -> $rule (exit $rc)"
    while IFS= read -r line; do echo "        $line"; done <<<"$findings"
  fi
done

n_expected=0
for name in $EXPECTED_CASES; do
  n_expected=$((n_expected + 1))
  [[ -d "$FIXTURES/$name" ]] || fail "$name: fixture directory missing"
done

if [[ $failures -gt 0 ]]; then
  echo "check-fixtures: $failures failure(s)" >&2
  exit 1
fi
echo "check-fixtures: $n_expected analytics fixtures (_clean passes, every other case fails on its rule)"
