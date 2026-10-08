#!/usr/bin/env bash
# Regression test for scripts/ci/contracts-breaking.sh (pr-gate's breaking-change step): it must
# run the event-schema check, diff the bundle tools/codegen/gen-ts.sh writes
# (packages/contracts/gen/openapi.bundle.json) with oasdiff at --fail-on WARN instead of skipping
# with "bundle absent", and fail when oasdiff fails.
# Usage: scripts/test/contracts-breaking.test.sh   (run by `just test tooling` and `just test`)
# oasdiff is a stub on PATH that records its arguments; HEAD is the base ref, so the committed
# bundle and event schemas are the base side. Nothing is written to the repo. The event check's
# rules and fixtures are tested by packages/contracts/tests/events-breaking.test.ts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-contracts-breaking-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin"
# The stub exits with $OASDIFF_STUB_STATUS (default 0).
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$@" >"%s/oasdiff.args"\n' "$TEST_ROOT" >"$TEST_ROOT/bin/oasdiff"
cat >>"$TEST_ROOT/bin/oasdiff" <<'STUB'
exit "${OASDIFF_STUB_STATUS:-0}"
STUB
chmod +x "$TEST_ROOT/bin/oasdiff"

if ! out="$(PATH="$TEST_ROOT/bin:$PATH" "$ROOT/scripts/ci/contracts-breaking.sh" HEAD 2>&1)"; then
  echo "FAIL  contracts-breaking: exited non-zero: $out" >&2
  exit 1
fi
case "$out" in
  *"events-breaking: OK"*) ;;
  *)
    echo "FAIL  contracts-breaking: the event-schema check did not run; output: $out" >&2
    exit 1
    ;;
esac
if [[ ! -f "$TEST_ROOT/oasdiff.args" ]]; then
  echo "FAIL  contracts-breaking: oasdiff was never run; output: $out" >&2
  exit 1
fi
if ! command grep -qx 'packages/contracts/gen/openapi.bundle.json' "$TEST_ROOT/oasdiff.args"; then
  echo "FAIL  contracts-breaking: oasdiff did not get the generated bundle; args: $(tr '\n' ' ' <"$TEST_ROOT/oasdiff.args")" >&2
  exit 1
fi
if ! command grep -qx 'WARN' "$TEST_ROOT/oasdiff.args"; then
  echo "FAIL  contracts-breaking: oasdiff did not run with --fail-on WARN; args: $(tr '\n' ' ' <"$TEST_ROOT/oasdiff.args")" >&2
  exit 1
fi
if out="$(OASDIFF_STUB_STATUS=1 PATH="$TEST_ROOT/bin:$PATH" "$ROOT/scripts/ci/contracts-breaking.sh" HEAD 2>&1)"; then
  echo "FAIL  contracts-breaking: exited 0 although oasdiff failed; output: $out" >&2
  exit 1
fi
echo "PASS  contracts-breaking: event schemas checked; oasdiff diffs packages/contracts/gen/openapi.bundle.json at --fail-on WARN and its failure fails the gate"
