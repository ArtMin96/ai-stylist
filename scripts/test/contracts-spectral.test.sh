#!/usr/bin/env bash
# Regression test for scripts/ci/contracts-spectral.sh (pr-gate's Spectral step) and for the
# .spectral.yaml rules that carry a fixture. The gate must lint the OpenAPI contract with the
# contracts package's spectral (@stoplight/spectral-cli) instead of skipping with "spectral not
# installed", a failing lint, a missing spectral included, must fail the gate, and each rule must
# fire on its fixture.
# Usage: scripts/test/contracts-spectral.test.sh   (run by `just test tooling` and `just test`)
# Needs `pnpm install` and jq. The runs, in order:
#   1. the gate on the committed contract: spectral prints "No results ... found";
#   2. the gate with a failing `pnpm` stub on PATH: it exits non-zero;
#   3. tools/spectral/fixtures/idempotency-key-missing: spectral exits non-zero and
#      ai-stylist-mutating-operation-has-idempotency-key reports exactly its ten operations
#      (POST, PUT, PATCH and DELETE without the header, the header on the path item only, a
#      /v1/auth/ operation not named, the marker without a reason, the marker outside /v1/auth/),
#      each with a message that names the operation;
#   4. tools/spectral/fixtures/_clean: spectral exits 0 and that rule reports nothing (the header
#      by $ref on every mutating method, marked required or not; GET, HEAD, OPTIONS and TRACE
#      without it; one named /v1/auth/ exception);
#   5. packages/contracts/gen/openapi.bundle.json (the committed contract, bundled): spectral
#      exits 0 and that rule reports nothing.
# Runs 3-5 call the package's spectral at the gate's --fail-severity=warn with .spectral.yaml, so
# they stay red until a rule is in .spectral.yaml; no run is skipped. CONTRACTS_SPECTRAL_RULESET=<file>
# swaps the ruleset of runs 3-5 to try a proposed rule before a human applies it; CI never sets it.
# Nothing is written to the repo. The rules themselves live only in .spectral.yaml.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-contracts-spectral-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

RULE=ai-stylist-mutating-operation-has-idempotency-key
RULESET="${CONTRACTS_SPECTRAL_RULESET:-$ROOT/.spectral.yaml}"
FIXTURES="$ROOT/tools/spectral/fixtures"

if ! out="$("$ROOT/scripts/ci/contracts-spectral.sh" 2>&1)"; then
  echo "FAIL  contracts-spectral: exited non-zero on the committed contract: $out" >&2
  exit 1
fi
case "$out" in
  *"No results with a severity of 'warn' or higher found"*) ;;
  *)
    echo "FAIL  contracts-spectral: spectral did not lint the contract; output: $out" >&2
    exit 1
    ;;
esac

mkdir -p "$TEST_ROOT/bin"
printf '#!/bin/sh\necho "sh: 1: spectral: not found" >&2\nexit 1\n' >"$TEST_ROOT/bin/pnpm"
chmod +x "$TEST_ROOT/bin/pnpm"
if out="$(PATH="$TEST_ROOT/bin:$PATH" "$ROOT/scripts/ci/contracts-spectral.sh" 2>&1)"; then
  echo "FAIL  contracts-spectral: exited 0 although the lint failed; output: $out" >&2
  exit 1
fi

if [[ "$RULESET" != "$ROOT/.spectral.yaml" ]]; then
  echo "NOTE  contracts-spectral: runs 3-5 use CONTRACTS_SPECTRAL_RULESET=$RULESET, not .spectral.yaml" >&2
fi

failures=0
fail_case() {
  echo "FAIL  contracts-spectral: $*" >&2
  failures=$((failures + 1))
}

# lint <name> <document>: the package's spectral at the gate's level. Sets $status; writes the
# results to $TEST_ROOT/<name>.json and the console output to $TEST_ROOT/<name>.log. Returns 1, after
# a FAIL line, when spectral wrote no results (a crash, not a lint finding).
lint() {
  status=0
  pnpm --filter @ai-stylist/contracts exec spectral lint --fail-severity=warn --format json \
    --output "$TEST_ROOT/$1.json" --ruleset "$RULESET" "$2" >"$TEST_ROOT/$1.log" 2>&1 || status=$?
  if ! jq -e 'type == "array"' "$TEST_ROOT/$1.json" >/dev/null 2>&1; then
    fail_case "$1: spectral wrote no results (exit $status): $(cat "$TEST_ROOT/$1.log")"
    return 1
  fi
}

# reported <name>: "<method> <path>" of each operation the rule reports, one per line, sorted.
reported() {
  jq -r --arg rule "$RULE" '.[] | select(.code == $rule) | "\(.path[2]) \(.path[1])"' \
    "$TEST_ROOT/$1.json" | LC_ALL=C sort -u
}

# unnamed <name>: "<method> <path>" of each finding of the rule whose message does not name its
# operation as the JSON pointer spectral renders for {{path}} (#/paths/~1v1~1items/post).
unnamed() {
  jq -r --arg rule "$RULE" '.[] | select(.code == $rule)
    | ("#/" + (.path[0:3] | map(gsub("~"; "~0") | gsub("/"; "~1")) | join("/"))) as $op
    | select(.message | contains($op) | not) | "\(.path[2]) \(.path[1])"' \
    "$TEST_ROOT/$1.json" | LC_ALL=C sort -u
}

# findings <name>: every finding of every rule, for a FAIL line.
findings() {
  jq -r '[.[] | "\(.code) at \(.path | join(".")): \(.message)"] | join("; ")' "$TEST_ROOT/$1.json"
}

if lint idempotency-key-missing "$FIXTURES/idempotency-key-missing/openapi.yaml"; then
  printf '%s\n' 'post /v1/items' 'put /v1/items' 'patch /v1/items' 'delete /v1/items' \
    'post /v1/items/path-item-header' 'post /v1/auth/not-named' \
    'post /v1/auth/marker-without-reason' 'delete /v1/auth/marker-without-reason' \
    'post /v1/marked' 'post /v1/authorizations' | LC_ALL=C sort >"$TEST_ROOT/expected"
  reported idempotency-key-missing >"$TEST_ROOT/found"
  missed="$(LC_ALL=C comm -23 "$TEST_ROOT/expected" "$TEST_ROOT/found" | tr '\n' ',')"
  extra="$(LC_ALL=C comm -13 "$TEST_ROOT/expected" "$TEST_ROOT/found" | tr '\n' ',')"
  if [[ -n "$missed" ]]; then
    fail_case "idempotency-key-missing: $RULE does not report ${missed%,}"
  fi
  if [[ -n "$extra" ]]; then
    fail_case "idempotency-key-missing: $RULE reports ${extra%,}, which the fixture does not list"
  fi
  unnamed_ops="$(unnamed idempotency-key-missing | tr '\n' ',')"
  if [[ -n "$unnamed_ops" ]]; then
    fail_case "idempotency-key-missing: the $RULE message does not name the operation for ${unnamed_ops%,}"
  fi
  if [[ "$status" -eq 0 ]]; then
    fail_case "idempotency-key-missing: spectral exited 0 on operations without Idempotency-Key"
  fi
fi

for case_name in _clean contract; do
  if [[ "$case_name" == contract ]]; then
    doc="$ROOT/packages/contracts/gen/openapi.bundle.json"
  else
    doc="$FIXTURES/$case_name/openapi.yaml"
  fi
  lint "$case_name" "$doc" || continue
  found="$(reported "$case_name" | tr '\n' ',')"
  if [[ -n "$found" ]]; then
    fail_case "$case_name: $RULE reports ${found%,}, which declare the header or are exempt"
  fi
  if [[ "$status" -ne 0 ]]; then
    fail_case "$case_name: spectral exited $status, want 0; findings: $(findings "$case_name")"
  fi
done

if [[ "$failures" -gt 0 ]]; then
  exit 1
fi
echo "PASS  contracts-spectral: spectral lints the contract at --fail-severity=warn, a failing lint fails the gate, and $RULE reports every mutating operation of its fixture that lacks Idempotency-Key and nothing on _clean or the committed contract"
