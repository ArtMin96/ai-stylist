#!/usr/bin/env bash
# just test-regression <test-file> — proves a regression test fails before the fix and passes
# after it, making CLAUDE.md's testing rule ("a regression test that demonstrably fails before
# the fix — run it, show the failure, then fix") structural instead of prose.
#
# Checks out the merge-base of HEAD and the default branch in a throwaway `git worktree`, copies
# the CURRENT working-tree version of <test-file> over it (creating parent dirs when the file is
# new), and runs it there against the pre-fix code (expect FAIL). A regression test appended to an
# existing test file is proven this way too: the merge-base copy of that file holds only the old
# tests, which would pass. Then runs the same file in the current working tree, i.e. "at HEAD"
# including any uncommitted fix (expect PASS). Prints both raw outputs. Only <test-file> is copied:
# helpers or fixtures it imports resolve to their merge-base versions. The merge-base worktree gets
# the real tree's node_modules symlinked in so vitest resolves without a second `pnpm install`.
#
# vitest runs as `node <pkg>/…/node_modules/vitest/vitest.mjs run <file>` from the package dir, not
# through `pnpm exec`: pnpm (12.6+) refuses a symlinked node_modules as its task-state dir
# (ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH) before the runner starts. A merge-base leg counts as the
# expected FAIL only when the runner itself reported a failed test or test file (vitest's
# `Test Files … failed` summary, pytest's `N failed|error(s)` summary); a non-zero exit without
# that summary is a runner or setup error and fails the gate, so it can never pose as proof.
#
# Usage: scripts/test/regression.sh <test-file>
# Exit codes: 0 both expectations held · 1 an expectation was violated, or a runner/setup error ·
# 2 usage error.
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
cd "$REPO_ROOT"

usage() {
  cat <<'EOF'
usage: scripts/test/regression.sh <test-file>

Proves a regression test fails before the fix and passes after it: the working-tree version of
<test-file> is copied into a throwaway worktree at the merge-base with the default branch and run
against that pre-fix code (expect FAIL), then run in the current working tree (expect PASS). A
test appended to an existing file counts; a test that passes on the pre-fix code is rejected.

  <test-file>   repo-root-relative path to a single test file, e.g.
                apps/api/src/modules/billing/tests/entitlement.test.ts

A merge-base run that errors before the runner reports a failed test (a setup or runner error) is
rejected too.

Exit codes: 0 both expectations held · 1 an expectation was violated, or a runner/setup error ·
2 usage error.
EOF
}

if [[ $# -eq 0 || "$1" == "-h" || "$1" == "--help" ]]; then
  usage
  exit 0
fi
if [[ $# -ne 1 ]]; then
  echo "scripts/test/regression.sh: expected exactly one <test-file> argument" >&2
  usage >&2
  exit 2
fi
test_file="$1"
if [[ ! -f "$test_file" ]]; then
  echo "scripts/test/regression.sh: '$test_file' does not exist in the working tree" >&2
  exit 2
fi

# The shell command that runs one file through its package's test runner, printed pre-quoted so
# it can be `eval`'d verbatim in either tree (it starts with a `cd`, so eval it in a subshell).
# vitest runs from the package dir like `pnpm --filter <pkg> exec` would, so the path passed to it
# is package-relative (matches how the `test module=''` recipe scopes a single module's tests/
# dir), and its entry point is found by walking up from the package to the repo root, each step
# adding a `../` so the same relative path resolves in the merge-base worktree.
runner_kind=""
runner_for() {  # $1 = repo-root-relative test file, must exist under $PWD
  local path="$1" dir pkg_dir="" rel up="" entry=""
  case "$path" in
    workers/*)
      runner_kind=pytest
      printf 'uv run --project workers pytest %q -q\n' "$path"
      return 0
      ;;
  esac
  runner_kind=vitest
  dir="$(dirname "$path")"
  while [[ "$dir" != "." && "$dir" != "/" ]]; do
    if [[ -f "$dir/package.json" ]]; then
      pkg_dir="$dir"
      break
    fi
    dir="$(dirname "$dir")"
  done
  if [[ -z "$pkg_dir" ]]; then
    echo "scripts/test/regression.sh: no package.json found above '$path'" >&2
    return 1
  fi
  dir="$pkg_dir"
  while :; do
    if [[ -f "$dir/node_modules/vitest/vitest.mjs" ]]; then
      entry="${up}node_modules/vitest/vitest.mjs"
      break
    fi
    [[ "$dir" == "." ]] && break
    dir="$(dirname "$dir")"
    up="../$up"
  done
  if [[ -z "$entry" ]]; then
    echo "scripts/test/regression.sh: no node_modules/vitest/vitest.mjs from '$pkg_dir' up to the repo root (run \`pnpm install\`)" >&2
    return 1
  fi
  rel="${path#"$pkg_dir"/}"
  printf 'cd %q && node %q run %q\n' "$pkg_dir" "$entry" "$rel"
}

# Succeeds when <output> shows the runner itself ran the file and reported a failure, as opposed
# to an error before or around the run (a package-manager refusal, a missing binary, no test file
# matched). vitest: the `Test Files  1 failed (1)` summary, printed for a failing test and for a
# test file that fails to import (the code under test is absent at the merge-base). pytest -q:
# `1 failed in 0.1s`, `1 passed, 1 failed in …`, `1 error in …` (collection errors included).
runner_reported_failure() {  # $1 = output
  case "$runner_kind" in
    vitest) grep -Eq '^ *Test Files .*[0-9]+ failed' <<<"$1" ;;
    pytest) grep -Eq '(^|[ ,])[0-9]+ (failed|errors?)(,| in )' <<<"$1" ;;
    *) return 1 ;;
  esac
}

# Symlinks every top-level workspace `node_modules` dir into the matching path of a throwaway
# worktree, so pnpm resolves without reinstalling (mirrors scripts/security/secrets-lib.sh's
# single-package `secrets_link_node_modules`, generalised across the whole workspace).
link_node_modules() {  # $1 = worktree root
  local wt="$1" nm rel target
  while IFS= read -r nm; do
    rel="${nm#"$REPO_ROOT"/}"
    target="$wt/$rel"
    if [[ -d "$(dirname "$target")" && ! -e "$target" ]]; then
      ln -s "$nm" "$target"
    fi
  done < <(find "$REPO_ROOT" -maxdepth 3 -type d -name node_modules -not -path '*/node_modules/*')
}

default_branch_ref() {
  if git symbolic-ref --short refs/remotes/origin/HEAD >/dev/null 2>&1; then
    git symbolic-ref --short refs/remotes/origin/HEAD
  elif git show-ref --verify --quiet refs/heads/main; then
    echo main
  elif git show-ref --verify --quiet refs/remotes/origin/main; then
    echo origin/main
  else
    return 1
  fi
}

default_branch="$(default_branch_ref)" || die "scripts/test/regression.sh: could not resolve a default branch (no origin/HEAD, no local or remote main)"
base="$(git merge-base "$default_branch" HEAD)" || die "scripts/test/regression.sh: could not compute the merge-base of HEAD and $default_branch"

# Not in a command substitution: runner_for sets runner_kind, which a subshell would lose.
cmd_file="$(mktemp)"
if ! runner_for "$test_file" >"$cmd_file"; then
  rm -f "$cmd_file"
  exit 1
fi
cmd="$(cat "$cmd_file")"
rm -f "$cmd_file"

wt=""
cleanup() {
  if [[ -n "$wt" ]]; then
    git worktree remove --force "$wt" >/dev/null 2>&1 || true
    git worktree prune >/dev/null 2>&1 || true
    rm -rf "$wt"
  fi
}
trap cleanup EXIT

wt="$(mktemp -d)"
git worktree add --detach --quiet "$wt" "$base"
link_node_modules "$wt"

# Run the working tree's test file against the merge-base code, never the merge-base's own copy
# of it (that copy lacks a test appended on this branch and would pass).
if [[ -f "$wt/$test_file" ]]; then
  test_origin="working-tree copy over the merge-base version"
else
  test_origin="working-tree copy; the file is new since the merge-base"
fi
mkdir -p "$wt/$(dirname "$test_file")"
cp "$test_file" "$wt/$test_file"

heading "test-regression: $test_file ($test_origin) @ merge-base ($base) — expect FAIL"
if merge_base_output="$(cd "$wt" && eval "$cmd" 2>&1)"; then
  merge_base_status=0
else
  merge_base_status=$?
fi
printf '%s\n' "$merge_base_output"

heading "test-regression: $test_file @ HEAD (working tree) — expect PASS"
if head_output="$(eval "$cmd" 2>&1)"; then
  head_status=0
else
  head_status=$?
fi
printf '%s\n' "$head_output"

echo
if [[ "$merge_base_status" -eq 0 ]]; then
  error "test-regression: '$test_file' PASSED at the merge-base — it does not prove a regression"
  exit 1
fi
if ! runner_reported_failure "$merge_base_output"; then
  error "test-regression: the merge-base run exited $merge_base_status without a $runner_kind test failure in its output — a runner or setup error, not proof of a regression (command: $cmd)"
  exit 1
fi
if [[ "$head_status" -ne 0 ]]; then
  if runner_reported_failure "$head_output"; then
    error "test-regression: '$test_file' FAILED at HEAD — the fix is not working"
  else
    error "test-regression: the HEAD run exited $head_status without a $runner_kind test failure in its output — a runner or setup error (command: $cmd)"
  fi
  exit 1
fi
log "test-regression: '$test_file' fails at the merge-base and passes at HEAD"
