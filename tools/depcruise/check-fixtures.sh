#!/usr/bin/env bash
# AC-3: every fixture under tools/depcruise/fixtures/<case>/ must FAIL `depcruise` with the
# rule named in EXPECTED. Each fixture is a self-contained tree mirroring the real layout, so
# the production config (rules.cjs) runs against it unchanged from inside the fixture root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT/tools/depcruise/rules.cjs"
FIXTURES="$ROOT/tools/depcruise/fixtures"

declare -A EXPECTED=(
  [internal-import]=public-api-only
  [recommendation-to-avatar]=recommendation-not-renderer
  [provider-sdk-in-domain]=domain-no-provider-sdk
  [assistant-to-internal]=assistant-app-services-only
  [utils-dir]=no-utils-dirs
  [prototype-import]=prototype-unimportable
)

failures=0
for case_dir in "$FIXTURES"/*/; do
  name="$(basename "$case_dir")"
  rule="${EXPECTED[$name]:-}"
  if [[ -z "$rule" ]]; then
    echo "FAIL  $name: no expected rule registered in check-fixtures.sh" >&2
    failures=$((failures + 1))
    continue
  fi
  set +e
  output="$(cd "$case_dir" && "$ROOT/node_modules/.bin/depcruise" --config "$CONFIG" apps 2>&1)"
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    echo "FAIL  $name: depcruise exited 0, expected a '$rule' violation" >&2
    failures=$((failures + 1))
  elif ! grep -q "error $rule:" <<<"$output"; then
    echo "FAIL  $name: exit $rc but rule '$rule' not in output:" >&2
    echo "$output" >&2
    failures=$((failures + 1))
  else
    echo "ok    $name -> $rule (exit $rc)"
  fi
done

for name in "${!EXPECTED[@]}"; do
  [[ -d "$FIXTURES/$name" ]] || { echo "FAIL  $name: fixture directory missing" >&2; failures=$((failures + 1)); }
done

if [[ $failures -gt 0 ]]; then
  echo "check-fixtures: $failures failure(s)" >&2
  exit 1
fi
echo "check-fixtures: ${#EXPECTED[@]} fixtures failed on their named rule"
