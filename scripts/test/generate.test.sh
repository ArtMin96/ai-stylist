#!/usr/bin/env bash
# Regression test for tools/codegen/generate.sh (`just generate [--check]`): any failing generator
# fails the run in both modes and is named on stderr, the remaining generators do not run, and
# --check leaves the committed outputs untouched. The bug it guards: `--check` called
# run_generators inside `if ! ...`, which disables `set -e` there, so a failing gen-swift.sh was
# ignored and the check exited 0.
# Usage: scripts/test/generate.test.sh   (run by `just test tooling` and `just test`)
# The real generate.sh and scripts/native-lane.sh run in a throwaway repo copy whose generators
# are stubs; a `swift` stub on PATH satisfies native-lane's toolchain probe. Each stub records its
# name, and the one named by $GEN_STUB_FAIL exits 1. Nothing is written to the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-generate-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

FAKE="$TEST_ROOT/repo"
mkdir -p "$FAKE/tools/codegen" "$FAKE/scripts" "$TEST_ROOT/bin" \
  "$FAKE/packages/shared-kernel/src/gen" "$FAKE/packages/contracts/gen" "$FAKE/workers/ml/generated"
cp "$ROOT/tools/codegen/generate.sh" "$FAKE/tools/codegen/generate.sh"
cp "$ROOT/scripts/native-lane.sh" "$FAKE/scripts/native-lane.sh"
echo committed >"$FAKE/packages/contracts/gen/client.txt"
echo committed >"$FAKE/packages/shared-kernel/src/gen/kernel.txt"
echo committed >"$FAKE/workers/ml/generated/models.txt"
CALLS="$TEST_ROOT/calls"

# write_stub <path> <name>: records <name>; exits 1 when $GEN_STUB_FAIL is <name>, first
# scribbling on a committed output when GEN_STUB_SCRIBBLE=1 (a failed --check must restore it).
write_stub() {
  cat >"$1" <<STUB
#!/usr/bin/env bash
echo "$2" >>"$CALLS"
if [[ "\${GEN_STUB_FAIL:-}" == "$2" ]]; then
  if [[ "\${GEN_STUB_SCRIBBLE:-}" == 1 ]]; then
    echo partial >"$FAKE/packages/contracts/gen/client.txt"
  fi
  echo "$2: stub failure" >&2
  exit 1
fi
STUB
  chmod +x "$1"
}
for gen in gen-ts.sh gen-swift.sh gen-kotlin.sh gen-python.sh; do
  write_stub "$FAKE/tools/codegen/$gen" "$gen"
done
: >"$FAKE/tools/codegen/gen-kernel.mjs"
write_stub "$TEST_ROOT/bin/node" gen-kernel.mjs
printf '#!/usr/bin/env bash\nexit 0\n' >"$TEST_ROOT/bin/swift"
chmod +x "$TEST_ROOT/bin/swift"

fails=0
fail() {
  echo "FAIL  generate: $1" >&2
  fails=$((fails + 1))
}

# run <label> <expected exit: 0|nonzero> <env assignments...> -- <generate.sh args...>
# Sets $out (combined output) and $calls (space-separated generator names, in order).
run() {
  local label="$1" want="$2" rc=0
  shift 2
  local envs=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do
    envs+=("$1")
    shift
  done
  shift
  : >"$CALLS"
  out="$(env -u CI -u NATIVE_STRICT -u NATIVE_LANES -u GEN_STUB_FAIL -u GEN_STUB_SCRIBBLE PATH="$TEST_ROOT/bin:$PATH" \
    ${envs[@]+"${envs[@]}"} "$FAKE/tools/codegen/generate.sh" "$@" 2>&1)" || rc=$?
  calls="$(tr '\n' ' ' <"$CALLS")"
  calls="${calls% }"
  if [[ "$want" == "0" && $rc -ne 0 ]]; then
    fail "$label: exited $rc, expected 0; output: $out"
    return 1
  fi
  if [[ "$want" != "0" && $rc -eq 0 ]]; then
    fail "$label: exited 0 although a generator failed; output: $out"
    return 1
  fi
}

expect_in_out() {
  case "$out" in
    *"$2"*) ;;
    *) fail "$1: output lacks '$2'; output: $out" ;;
  esac
}
expect_calls() {
  [[ "$calls" == "$2" ]] || fail "$1: generators run '$calls', expected '$2'"
}
expect_committed() {
  [[ "$(cat "$FAKE/packages/contracts/gen/client.txt")" == committed ]] \
    || fail "$1: --check left a generator's partial output in packages/contracts/gen"
  echo committed >"$FAKE/packages/contracts/gen/client.txt"
}

ALL="gen-kernel.mjs gen-ts.sh gen-swift.sh gen-kotlin.sh gen-python.sh"

if run "--check, all generators pass" 0 -- --check; then
  expect_in_out "--check, all pass" "generated output is up to date"
  expect_calls "--check, all pass" "$ALL"
fi

if run "--check, gen-swift.sh fails (middle)" nonzero GEN_STUB_FAIL=gen-swift.sh -- --check; then
  expect_in_out "--check, gen-swift.sh fails" "generate --check: generator gen-swift.sh failed"
  expect_calls "--check, gen-swift.sh fails" "gen-kernel.mjs gen-ts.sh gen-swift.sh"
fi
expect_committed "--check, gen-swift.sh fails"

if run "--check, gen-kernel.mjs fails (first)" nonzero GEN_STUB_FAIL=gen-kernel.mjs GEN_STUB_SCRIBBLE=1 -- --check; then
  expect_in_out "--check, gen-kernel.mjs fails" "generate --check: generator gen-kernel.mjs failed"
  expect_calls "--check, gen-kernel.mjs fails" "gen-kernel.mjs"
fi
expect_committed "--check, gen-kernel.mjs fails"

if run "--check, gen-python.sh fails (last)" nonzero GEN_STUB_FAIL=gen-python.sh GEN_STUB_SCRIBBLE=1 -- --check; then
  expect_in_out "--check, gen-python.sh fails" "generate --check: generator gen-python.sh failed"
fi
expect_committed "--check, gen-python.sh fails"

if run "plain, gen-swift.sh fails" nonzero GEN_STUB_FAIL=gen-swift.sh --; then
  expect_in_out "plain, gen-swift.sh fails" "generate: generator gen-swift.sh failed"
  expect_calls "plain, gen-swift.sh fails" "gen-kernel.mjs gen-ts.sh gen-swift.sh"
fi
echo committed >"$FAKE/packages/contracts/gen/client.txt"

# A deselected lane is not a failure: NATIVE_LANES=android never runs the failing Swift generator.
if run "--check, NATIVE_LANES=android, gen-swift.sh would fail" 0 NATIVE_LANES=android GEN_STUB_FAIL=gen-swift.sh -- --check; then
  expect_in_out "NATIVE_LANES=android" "native-lane: ios lane not selected"
  expect_calls "NATIVE_LANES=android" "gen-kernel.mjs gen-ts.sh gen-kotlin.sh gen-python.sh"
fi

if [[ $fails -ne 0 ]]; then
  echo "FAIL  generate: $fails assertion(s) failed" >&2
  exit 1
fi
echo "PASS  generate: a failing generator (first, middle or last) fails generate and generate --check, names itself, stops the rest and leaves the committed outputs; a deselected native lane still passes"
