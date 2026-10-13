#!/usr/bin/env bash
# Regression test for scripts/ci/contracts-spectral.sh (pr-gate's Spectral step): it must lint the
# OpenAPI contract with the contracts package's spectral (@stoplight/spectral-cli) instead of
# skipping with "spectral not installed", and a failing lint, a missing spectral included, must fail
# the gate.
# Usage: scripts/test/contracts-spectral.test.sh   (run by `just test tooling` and `just test`)
# Needs `pnpm install`. The first run lints the committed contract for real; the second puts a
# failing `pnpm` stub on PATH. Nothing is written to the repo. The rules themselves live in
# .spectral.yaml.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-contracts-spectral-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

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
echo "PASS  contracts-spectral: spectral lints the contract at --fail-severity=warn and a failing lint fails the gate"
