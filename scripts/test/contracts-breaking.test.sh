#!/usr/bin/env bash
# Regression test for scripts/ci/contracts-breaking.sh (pr-gate's oasdiff step): it must diff the
# bundle tools/codegen/gen-ts.sh writes (packages/contracts/gen/openapi.bundle.json) instead of
# skipping with "bundle absent".
# Usage: scripts/test/contracts-breaking.test.sh   (run by `just test tooling` and `just test`)
# oasdiff is a stub on PATH that records its arguments; HEAD is the base ref, so the committed
# bundle is the base side. Nothing is written to the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-contracts-breaking-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin"
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$@" >"%s/oasdiff.args"\n' "$TEST_ROOT" >"$TEST_ROOT/bin/oasdiff"
chmod +x "$TEST_ROOT/bin/oasdiff"

if ! out="$(PATH="$TEST_ROOT/bin:$PATH" "$ROOT/scripts/ci/contracts-breaking.sh" HEAD 2>&1)"; then
  echo "FAIL  contracts-breaking: exited non-zero: $out" >&2
  exit 1
fi
if [[ ! -f "$TEST_ROOT/oasdiff.args" ]]; then
  echo "FAIL  contracts-breaking: oasdiff was never run; output: $out" >&2
  exit 1
fi
if ! command grep -qx 'packages/contracts/gen/openapi.bundle.json' "$TEST_ROOT/oasdiff.args"; then
  echo "FAIL  contracts-breaking: oasdiff did not get the generated bundle; args: $(tr '\n' ' ' <"$TEST_ROOT/oasdiff.args")" >&2
  exit 1
fi
echo "PASS  contracts-breaking: oasdiff diffs packages/contracts/gen/openapi.bundle.json"
