#!/usr/bin/env bash
# Black-box suite for scripts/test/regression.sh (`just test-regression <test-file>`): the working
# tree's copy of the test file must be the one run against the merge-base code, so a regression
# test appended to an existing file is proven, and a test that passes on the pre-fix code is still
# rejected.
# Usage: scripts/test/regression.test.sh   (run by `just test tooling` and `just test`)
# Each case builds a throwaway git repo (default branch `main`) holding a copy of regression.sh and
# lib.sh plus a fake package; `node` and `pnpm` are stubs on PATH, and the stub "vitest" runs the
# test file with bash. Nothing reads or writes the real repository.
# shellcheck disable=SC2016 # the stub bodies and fixture sources are literal shell text that must
# expand when the fixture runs, not here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-regression-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

failures=0

run_test() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS  $name"
  else
    echo "FAIL  $name" >&2
    failures=$((failures + 1))
  fi
}

# stub <dir> <name> <bash body>: an executable <dir>/<name> running <body>.
stub() {
  mkdir -p "$1"
  printf '#!/usr/bin/env bash\n%s\n' "$3" >"$1/$2"
  chmod +x "$1/$2"
}

# `node -pe "require(...).name"` → the fixture package name; `pnpm --filter <pkg> exec vitest run
# <rel>` → run <rel> with bash from the package dir, like `pnpm exec` does.
stub "$TEST_ROOT/bin" node 'echo fixture-pkg'
stub "$TEST_ROOT/bin" pnpm 'cd pkg && exec bash "$6"'

g() {
  git -c user.name=fixture -c user.email=fixture@example.invalid -c commit.gpgsign=false \
    -c core.hooksPath=/dev/null "$@"
}

BUGGY_SRC='add() { echo $(($1 + $2)); }
double() { echo $(($1 * 3)); }'
FIXED_SRC='add() { echo $(($1 + $2)); }
double() { echo $(($1 * 2)); }'
OLD_TEST='. ./src.sh
[ "$(add 1 1)" = 2 ] || { echo "add: wrong"; exit 1; }
echo "add: ok"'
DOUBLE_TEST='[ "$(double 2)" = 4 ] || { echo "double: wrong"; exit 1; }
echo "double: ok"'
ADD_MORE_TEST='[ "$(add 2 2)" = 4 ] || { echo "add 2 2: wrong"; exit 1; }
echo "add 2 2: ok"'

# new_repo <name>: a repo whose `main` holds the buggy source and the old (passing) test file, now
# on branch `fix`. Prints the repo path.
new_repo() {
  local repo="$TEST_ROOT/$1"
  mkdir -p "$repo/scripts/test" "$repo/pkg/tests"
  cp "$ROOT/scripts/lib.sh" "$repo/scripts/lib.sh"
  cp "$ROOT/scripts/test/regression.sh" "$repo/scripts/test/regression.sh"
  printf '{ "name": "fixture-pkg" }\n' >"$repo/pkg/package.json"
  printf '%s\n' "$BUGGY_SRC" >"$repo/pkg/src.sh"
  printf '%s\n' "$OLD_TEST" >"$repo/pkg/tests/math.test.sh"
  (
    cd "$repo"
    g init -q
    g symbolic-ref HEAD refs/heads/main
    g add -A
    g commit -q -m base
    g checkout -q -b fix
  )
  printf '%s\n' "$repo"
}

# run_regression <repo> <test-file>: sets $out and $status.
run_regression() {
  status=0
  out="$(cd "$1" && NO_COLOR=1 PATH="$TEST_ROOT/bin:$PATH" scripts/test/regression.sh "$2" 2>&1)" || status=$?
}

expect() {  # <expected status> <substring>
  if [[ "$status" -ne "$1" ]]; then
    printf '  expected exit %s, got %s; output:\n%s\n' "$1" "$status" "$out" >&2
    return 1
  fi
  if [[ "$out" != *"$2"* ]]; then
    printf '  expected output to contain: %s\n  output:\n%s\n' "$2" "$out" >&2
    return 1
  fi
}

no_leftover_worktree() {  # <repo>
  local n
  n="$(cd "$1" && git worktree list | wc -l | tr -d ' ')"
  if [[ "$n" != "1" ]]; then
    printf '  expected 1 worktree after the run, found %s\n' "$n" >&2
    return 1
  fi
}

# A regression test appended to an EXISTING test file, with the fix, committed on the branch:
# the merge-base copy of the file (old tests only) passes, but the working tree's copy must fail
# against the merge-base code → exit 0.
case_appended_committed() {
  local repo
  repo="$(new_repo appended-committed)"
  printf '%s\n' "$FIXED_SRC" >"$repo/pkg/src.sh"
  printf '%s\n%s\n' "$OLD_TEST" "$DOUBLE_TEST" >"$repo/pkg/tests/math.test.sh"
  (cd "$repo" && g commit -q -am 'fix double + regression test')
  run_regression "$repo" pkg/tests/math.test.sh
  expect 0 "fails at the merge-base and passes at HEAD" &&
    expect 0 "double: wrong" &&
    no_leftover_worktree "$repo"
}

# Same, but the appended test and the fix are uncommitted working-tree edits.
case_appended_uncommitted() {
  local repo
  repo="$(new_repo appended-uncommitted)"
  printf '%s\n' "$FIXED_SRC" >"$repo/pkg/src.sh"
  printf '%s\n%s\n' "$OLD_TEST" "$DOUBLE_TEST" >"$repo/pkg/tests/math.test.sh"
  run_regression "$repo" pkg/tests/math.test.sh
  expect 0 "fails at the merge-base and passes at HEAD" && no_leftover_worktree "$repo"
}

# The appended test passes on the pre-fix code too: it proves nothing and must be rejected.
case_appended_passes_before_fix() {
  local repo
  repo="$(new_repo appended-no-proof)"
  printf '%s\n' "$FIXED_SRC" >"$repo/pkg/src.sh"
  printf '%s\n%s\n' "$OLD_TEST" "$ADD_MORE_TEST" >"$repo/pkg/tests/math.test.sh"
  (cd "$repo" && g commit -q -am 'fix double, weak test')
  run_regression "$repo" pkg/tests/math.test.sh
  expect 1 "PASSED at the merge-base" && no_leftover_worktree "$repo"
}

# A brand-new test file (absent at the merge-base, parent dir absent too) is copied in and run
# against the merge-base code.
case_new_file() {
  local repo
  repo="$(new_repo new-file)"
  mkdir -p "$repo/pkg/tests/unit"
  printf '%s\n' "$FIXED_SRC" >"$repo/pkg/src.sh"
  printf '. ./src.sh\n%s\n' "$DOUBLE_TEST" >"$repo/pkg/tests/unit/double.test.sh"
  run_regression "$repo" pkg/tests/unit/double.test.sh
  expect 0 "fails at the merge-base and passes at HEAD" &&
    expect 0 "double: wrong" &&
    no_leftover_worktree "$repo"
}

# The test is right but the fix is missing: it fails at HEAD too → exit 1.
case_fix_missing() {
  local repo
  repo="$(new_repo fix-missing)"
  printf '%s\n%s\n' "$OLD_TEST" "$DOUBLE_TEST" >"$repo/pkg/tests/math.test.sh"
  run_regression "$repo" pkg/tests/math.test.sh
  expect 1 "FAILED at HEAD" && no_leftover_worktree "$repo"
}

run_test "regression: test appended to an existing file (committed) fails at merge-base" case_appended_committed
run_test "regression: test appended to an existing file (uncommitted) fails at merge-base" case_appended_uncommitted
run_test "regression: appended test that passes on pre-fix code is rejected" case_appended_passes_before_fix
run_test "regression: new test file is run against the merge-base code" case_new_file
run_test "regression: fix missing at HEAD is rejected" case_fix_missing

if [[ "$failures" -ne 0 ]]; then
  echo "regression.test.sh: $failures case(s) failed" >&2
  exit 1
fi
