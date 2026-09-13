#!/usr/bin/env bash
# just test-regression <test-file> — proves a regression test fails before the fix and passes
# after it, making CLAUDE.md's testing rule ("a regression test that demonstrably fails before
# the fix — run it, show the failure, then fix") structural instead of prose.
#
# Runs <test-file> at the merge-base of HEAD and the default branch, in a throwaway `git
# worktree` (expect FAIL — the fix, or the file itself, isn't there yet); then runs it again in
# the current working tree, i.e. "at HEAD" including any uncommitted fix (expect PASS). Prints
# both raw outputs. The merge-base worktree gets the real tree's node_modules symlinked in so
# pnpm/vitest/jest resolve without a second `pnpm install`.
#
# Usage: scripts/test/regression.sh <test-file>
# Exit codes: 0 both expectations held · 1 an expectation was violated · 2 usage error.
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
cd "$REPO_ROOT"

usage() {
  cat <<'EOF'
usage: scripts/test/regression.sh <test-file>

Proves a regression test fails at the merge-base with the default branch (before the fix) and
passes at HEAD / the current working tree (after the fix).

  <test-file>   repo-root-relative path to a single test file, e.g.
                apps/api/src/modules/billing/tests/entitlement.test.ts

Exit codes: 0 both expectations held · 1 an expectation was violated · 2 usage error.
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
# it can be `eval`'d verbatim in either tree. `pnpm --filter <pkg> exec` runs with cwd set to
# that package's directory, so the path passed to the runner must be package-relative (matches
# how the `test module=''` recipe scopes a single module's tests/ dir).
runner_for() {  # $1 = repo-root-relative test file, must exist under $PWD
  local path="$1" dir pkg_dir="" pkg_name rel
  case "$path" in
    workers/*)
      printf 'uv run --project workers pytest %q -q\n' "$path"
      return 0
      ;;
    apps/mobile/*)
      printf 'pnpm --filter @ai-stylist/mobile exec jest --ci %q\n' "${path#apps/mobile/}"
      return 0
      ;;
  esac
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
  pkg_name="$(node -pe "require('./${pkg_dir}/package.json').name")"
  rel="${path#"$pkg_dir"/}"
  printf 'pnpm --filter %q exec vitest run %q\n' "$pkg_name" "$rel"
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

cmd="$(runner_for "$test_file")" || exit 1

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

heading "test-regression: $test_file @ merge-base ($base) — expect FAIL"
merge_base_status=0
if [[ -f "$wt/$test_file" ]]; then
  if merge_base_output="$(cd "$wt" && eval "$cmd" 2>&1)"; then
    merge_base_status=0
  else
    merge_base_status=$?
  fi
else
  merge_base_output="(no such file at the merge-base — the regression test is new)"
  merge_base_status=1
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
if [[ "$head_status" -ne 0 ]]; then
  error "test-regression: '$test_file' FAILED at HEAD — the fix is not working"
  exit 1
fi
log "test-regression: '$test_file' fails at the merge-base and passes at HEAD"
