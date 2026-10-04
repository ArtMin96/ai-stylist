#!/usr/bin/env bash
# Black-box suite for scripts/test/regression.sh (`just test-regression <test-file>`): the working
# tree's copy of the test file must be the one run against the merge-base code, so a regression
# test appended to an existing file is proven, a test that passes on the pre-fix code is still
# rejected, and a runner or setup error at the merge-base (e.g. pnpm 12.6's
# ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH) is a gate error, never the expected FAIL.
# Usage: scripts/test/regression.test.sh   (run by `just test tooling` and `just test`)
# Each case builds a throwaway git repo (default branch `main`) holding a copy of regression.sh and
# lib.sh plus a fake package with a fake node_modules/vitest/vitest.mjs; `node`, `pnpm` and `uv`
# are stubs on PATH. The stub `node <vitest.mjs> run <file>` and `uv run … pytest <file>` run the
# test file with bash and print the real runner's summary line. Nothing reads or writes the real
# repository.
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

# `node <…>/vitest/vitest.mjs run <rel>` (cwd = the package dir) → run <rel> with bash and print
# vitest's `Test Files` summary. FAKE_SETUP_ERROR_IN_WORKTREE=1 makes it fail like pnpm 12.6 does
# in the merge-base worktree, where the package's node_modules is a symlink: exit 1, no summary.
stub "$TEST_ROOT/bin" node '
case "$1" in */vitest/vitest.mjs) ;; *) echo "node stub: unexpected args: $*" >&2; exit 97 ;; esac
[ "$2" = run ] || { echo "node stub: expected \`run\`, got: $*" >&2; exit 97; }
if [ "${FAKE_SETUP_ERROR_IN_WORKTREE:-}" = 1 ] && [ -L node_modules ]; then
  echo "Error: ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH (fake)"; exit 1
fi
if bash "$3"; then echo " Test Files  1 passed (1)"; else echo " Test Files  1 failed (1)"; exit 1; fi'
# The gate must never go through pnpm any more: a call fails loudly.
stub "$TEST_ROOT/bin" pnpm 'echo "pnpm stub: regression.sh must not call pnpm: $*" >&2; exit 98'
# `uv run --project workers pytest <path> -q` (cwd = the tree root) → run <path> with bash and print
# pytest -q`s summary. FAKE_SETUP_ERROR_IN_WORKTREE=1 fails in a linked worktree (.git is a file)
# the way a uv environment error does: exit 2, no pytest summary.
stub "$TEST_ROOT/bin" uv '
[ "$4" = pytest ] || { echo "uv stub: unexpected args: $*" >&2; exit 97; }
if [ "${FAKE_SETUP_ERROR_IN_WORKTREE:-}" = 1 ] && [ -f .git ]; then
  echo "error: Failed to fetch: offline (fake)"; exit 2
fi
if bash "$5"; then echo "1 passed in 0.01s"; else echo "1 failed in 0.01s"; exit 1; fi'

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
  mkdir -p "$repo/scripts/test" "$repo/pkg/tests" "$repo/workers/tests"
  cp "$ROOT/scripts/lib.sh" "$repo/scripts/lib.sh"
  cp "$ROOT/scripts/test/regression.sh" "$repo/scripts/test/regression.sh"
  printf 'node_modules/\n' >"$repo/.gitignore"
  printf '{ "name": "fixture-pkg" }\n' >"$repo/pkg/package.json"
  printf '%s\n' "$BUGGY_SRC" >"$repo/pkg/src.sh"
  printf '%s\n' "$OLD_TEST" >"$repo/pkg/tests/math.test.sh"
  printf '%s\n' "$BUGGY_SRC" >"$repo/workers/src.sh"
  printf '%s\n' "$OLD_TEST" >"$repo/workers/tests/test_math.sh"
  (
    cd "$repo"
    g init -q
    g symbolic-ref HEAD refs/heads/main
    g add -A
    g commit -q -m base
    g checkout -q -b fix
  )
  # Installed (untracked) dependencies, as `pnpm install` leaves them: only the real tree has them,
  # regression.sh symlinks them into the merge-base worktree.
  mkdir -p "$repo/pkg/node_modules/vitest"
  printf '// fake vitest entry\n' >"$repo/pkg/node_modules/vitest/vitest.mjs"
  printf '%s\n' "$repo"
}

# run_regression <repo> <test-file> [VAR=value ...]: sets $out and $status.
run_regression() {
  local repo="$1" file="$2"
  shift 2
  status=0
  out="$(cd "$repo" && env NO_COLOR=1 PATH="$TEST_ROOT/bin:$PATH" "$@" scripts/test/regression.sh "$file" 2>&1)" || status=$?
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

# The false pass this guards against: the test passes on the pre-fix code, but the merge-base run
# never reaches the runner (pnpm 12.6 refuses the symlinked node_modules) → a gate error, exit 1.
case_setup_error_at_merge_base() {
  local repo
  repo="$(new_repo setup-error)"
  printf '%s\n' "$FIXED_SRC" >"$repo/pkg/src.sh"
  printf '%s\n%s\n' "$OLD_TEST" "$ADD_MORE_TEST" >"$repo/pkg/tests/math.test.sh"
  run_regression "$repo" pkg/tests/math.test.sh FAKE_SETUP_ERROR_IN_WORKTREE=1
  expect 1 "runner or setup error, not proof of a regression" &&
    expect 1 "ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH" &&
    no_leftover_worktree "$repo"
}

# A real regression test still passes the gate when the setup error is absent from the same repo
# shape: the stub reaches the runner, the merge-base leg reports a failed test file.
case_real_failure_is_proof() {
  local repo
  repo="$(new_repo real-failure)"
  printf '%s\n' "$FIXED_SRC" >"$repo/pkg/src.sh"
  printf '%s\n%s\n' "$OLD_TEST" "$DOUBLE_TEST" >"$repo/pkg/tests/math.test.sh"
  run_regression "$repo" pkg/tests/math.test.sh
  expect 0 "Test Files  1 failed (1)" &&
    expect 0 "fails at the merge-base and passes at HEAD" &&
    no_leftover_worktree "$repo"
}

WORKERS_DOUBLE_TEST='. ./workers/src.sh
[ "$(double 2)" = 4 ] || { echo "double: wrong"; exit 1; }
echo "double: ok"'

# workers/ (pytest via uv): a failing merge-base leg with pytest's summary is proof → exit 0.
case_workers_regression() {
  local repo
  repo="$(new_repo workers-regression)"
  printf '%s\n' "$FIXED_SRC" >"$repo/workers/src.sh"
  printf '%s\n' "$WORKERS_DOUBLE_TEST" >"$repo/workers/tests/test_double.sh"
  run_regression "$repo" workers/tests/test_double.sh
  expect 0 "1 failed in" &&
    expect 0 "fails at the merge-base and passes at HEAD" &&
    no_leftover_worktree "$repo"
}

# workers/: a uv environment error at the merge-base is a gate error, not the expected FAIL.
case_workers_setup_error() {
  local repo
  repo="$(new_repo workers-setup-error)"
  printf '%s\n' "$FIXED_SRC" >"$repo/workers/src.sh"
  printf '%s\n' "$WORKERS_DOUBLE_TEST" >"$repo/workers/tests/test_double.sh"
  run_regression "$repo" workers/tests/test_double.sh FAKE_SETUP_ERROR_IN_WORKTREE=1
  expect 1 "without a pytest test failure in its output" && no_leftover_worktree "$repo"
}

run_test "regression: test appended to an existing file (committed) fails at merge-base" case_appended_committed
run_test "regression: test appended to an existing file (uncommitted) fails at merge-base" case_appended_uncommitted
run_test "regression: appended test that passes on pre-fix code is rejected" case_appended_passes_before_fix
run_test "regression: new test file is run against the merge-base code" case_new_file
run_test "regression: fix missing at HEAD is rejected" case_fix_missing
run_test "regression: a runner/setup error at the merge-base is a gate error, not proof" case_setup_error_at_merge_base
run_test "regression: a runner-reported failure at the merge-base is proof" case_real_failure_is_proof
run_test "regression: workers/ pytest failure at the merge-base is proof" case_workers_regression
run_test "regression: workers/ uv setup error at the merge-base is a gate error" case_workers_setup_error

if [[ "$failures" -ne 0 ]]; then
  echo "regression.test.sh: $failures case(s) failed" >&2
  exit 1
fi
