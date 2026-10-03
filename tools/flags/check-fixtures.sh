#!/usr/bin/env bash
# P02-T09 AC-10, run by `just flags-report --fixtures` (and so by `just ci-parity`): proves the
# expired-flag report still fails. Every case is judged at the pinned FIXTURE_TODAY with the
# synthetic fixtures/owners.json, so its dates never rot:
#   expired/        exit 1, one expected row per state (ok, expires today, EXPIRED at 5 and at
#                   exactly 30 days overdue, DEFECT at 31, kill-switch exempt)
#   unknown-owner/  exit 2: an owner id missing from owners.json is a malformed registry, never
#                   reported as "expired"
# An impossible --today must exit 2 as well. Last, the real registry must load and resolve every
# owner (exit 0 or 1). Whether a real flag is past expiry today is the nightly `just flags-report`
# verdict (planning/14 §11 makes it a report), so a flag expiring never fails a PR through here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIXTURES="$ROOT/tools/flags/fixtures"
REPORT=(node "$ROOT/tools/flags/flags-report.mjs")
FIXTURE_TODAY=2026-10-20

failures=0
fail() {
  echo "FAIL  $1" >&2
  [[ -z "${2:-}" ]] || printf '%s\n' "$2" >&2
  failures=$((failures + 1))
}

# run_case <name> <expected exit> <extended regex>...: runs the report on fixtures/<name>/ and
# requires the exit code and one output line matching each regex.
run_case() {
  local name="$1" want="$2" rc output pattern missing=0
  shift 2
  set +e
  output="$("${REPORT[@]}" --today "$FIXTURE_TODAY" --owners "$FIXTURES/owners.json" \
    --registry "$FIXTURES/$name/feature-flags.json" 2>&1)"
  rc=$?
  set -e
  if [[ $rc -ne $want ]]; then
    fail "$name: exit $rc, expected $want:" "$output"
    return 0
  fi
  for pattern in "$@"; do
    if ! grep -Eq -- "$pattern" <<<"$output"; then
      fail "$name: no output line matches /$pattern/:" "$output"
      missing=1
    fi
  done
  if [[ $missing -eq 0 ]]; then
    echo "ok    $name -> exit $rc"
    while IFS= read -r line; do echo "        $line"; done <<<"$output"
  fi
}

run_case expired 1 \
  '^fixture-experiment-30-days +experiment +Fixture Owner +2026-09-20 +30 days overdue +EXPIRED$' \
  '^fixture-experiment-31-days +experiment +Fixture Owner +2026-09-19 +31 days overdue +DEFECT$' \
  '^fixture-kill-switch +kill-switch +Fixture Owner +- +- +exempt$' \
  '^fixture-rollout-current +rollout +Fixture Owner +2026-11-01 +12 days left +ok$' \
  '^fixture-rollout-due-today +rollout +Fixture Owner +2026-10-20 +0 days left +expires today$' \
  '^fixture-rollout-overdue +rollout +Fixture Owner +2026-10-15 +5 days overdue +EXPIRED$' \
  '^flags-report: 3 flag\(s\) past expiry, 1 of them DEFECT'
run_case unknown-owner 2 "owner 'nobody-registered' is not a person id"

set +e
output="$("${REPORT[@]}" --today 2026-02-30 2>&1)"
rc=$?
set -e
if [[ $rc -eq 2 ]] && grep -q 'real YYYY-MM-DD date' <<<"$output"; then
  echo "ok    --today 2026-02-30 -> exit 2 ($output)"
else
  fail "--today 2026-02-30: exit $rc, expected 2 (an impossible date):" "$output"
fi

set +e
output="$("${REPORT[@]}" 2>&1)"
rc=$?
set -e
case $rc in
  0 | 1)
    echo "ok    real registry loads, every owner resolves (exit $rc; the expiry verdict is nightly)"
    while IFS= read -r line; do echo "        $line"; done <<<"$output"
    ;;
  *) fail "real registry: exit $rc (malformed registry or unknown owner id):" "$output" ;;
esac

if [[ $failures -gt 0 ]]; then
  echo "check-fixtures: $failures failure(s)" >&2
  exit 1
fi
echo "check-fixtures: expired-flag report fails on its fixtures; the real registry loads"
