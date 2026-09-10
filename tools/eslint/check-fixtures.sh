#!/usr/bin/env bash
# AC-4: every fixture under tools/eslint/fixtures/<case>/ must be reported by ESLint with the
# rule named in EXPECTED (error, or warning for the warn-only file-size rule). Fixtures are
# ignored by every workspace `eslint .` (root ignores `tools/**/fixtures/**`); this script lints
# them with tools/eslint/fixtures/eslint.config.mjs, which is the root config minus that ignore.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURES="$ROOT/tools/eslint/fixtures"

# case → "rule id in ESLint output" + severity expected (error|warn). A case statement instead of
# an associative array so the script runs under macOS /bin/bash 3.2; keep EXPECTED_CASES in sync.
EXPECTED_CASES="stray-test skip-without-issue file-size log-request-body"
expected_spec() {
  case "$1" in
    stray-test)         echo 'quality/test-placement error' ;;
    skip-without-issue) echo 'local/no-skip-without-issue error' ;;
    file-size)          echo 'max-lines warn' ;;
    log-request-body)   echo 'quality/no-log-request-body error' ;;
    *)                  echo "" ;;
  esac
}

failures=0
for case_dir in "$FIXTURES"/*/; do
  name="$(basename "$case_dir")"
  spec="$(expected_spec "$name")"
  if [[ -z "$spec" ]]; then
    echo "FAIL  $name: no expected rule registered in check-fixtures.sh" >&2
    failures=$((failures + 1))
    continue
  fi
  rule="${spec% *}"
  severity="${spec#* }"
  set +e
  output="$(cd "$FIXTURES" && "$ROOT/node_modules/.bin/eslint" --config eslint.config.mjs --no-cache "$name" 2>&1)"
  rc=$?
  set -e
  if [[ "$severity" == "error" && $rc -eq 0 ]]; then
    echo "FAIL  $name: eslint exited 0, expected an error from '$rule'" >&2
    failures=$((failures + 1))
  elif [[ "$severity" == "warn" && $rc -ne 0 ]]; then
    echo "FAIL  $name: eslint exited $rc, expected a warning only ('$rule' is warn-tier):" >&2
    echo "$output" >&2
    failures=$((failures + 1))
  elif ! grep -Eq "^ +[0-9]+:[0-9]+ +$severity(ing)? .* $rule\$" <<<"$output"; then
    echo "FAIL  $name: rule '$rule' ($severity) not in output:" >&2
    echo "$output" >&2
    failures=$((failures + 1))
  else
    echo "ok    $name -> $rule ($severity, exit $rc)"
  fi
done

n_expected=0
for name in $EXPECTED_CASES; do
  n_expected=$((n_expected + 1))
  [[ -d "$FIXTURES/$name" ]] || { echo "FAIL  $name: fixture directory missing" >&2; failures=$((failures + 1)); }
done

if [[ $failures -gt 0 ]]; then
  echo "check-fixtures: $failures failure(s)" >&2
  exit 1
fi
echo "check-fixtures: $n_expected lint fixtures reported by their named rule"
