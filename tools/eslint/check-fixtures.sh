#!/usr/bin/env bash
# AC-4: every fixture under tools/eslint/fixtures/<case>/ must be reported by ESLint with the
# rule named in EXPECTED (error, or warning for the warn-only file-size rule). Fixtures are
# ignored by every workspace `eslint .` (root ignores `tools/**/fixtures/**`); this script lints
# them with tools/eslint/fixtures/eslint.config.mjs, which is the root config minus that ignore.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURES="$ROOT/tools/eslint/fixtures"

# case → rule id in ESLint output → severity expected (error|warn)
declare -A EXPECTED=(
  [stray-test]='quality/test-placement error'
  [skip-without-issue]='local/no-skip-without-issue error'
  [file-size]='max-lines warn'
  [log-request-body]='quality/no-log-request-body error'
)

failures=0
for case_dir in "$FIXTURES"/*/; do
  name="$(basename "$case_dir")"
  spec="${EXPECTED[$name]:-}"
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

for name in "${!EXPECTED[@]}"; do
  [[ -d "$FIXTURES/$name" ]] || { echo "FAIL  $name: fixture directory missing" >&2; failures=$((failures + 1)); }
done

if [[ $failures -gt 0 ]]; then
  echo "check-fixtures: $failures failure(s)" >&2
  exit 1
fi
echo "check-fixtures: ${#EXPECTED[@]} lint fixtures reported by their named rule"
