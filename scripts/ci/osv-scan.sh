#!/usr/bin/env bash
# osv-scanner over every lockfile in the checkout (`just security-scan`, nightly `just ci-osv-source`).
# Usage: scripts/ci/osv-scan.sh              scan the repo; fail on advisories or missing coverage
#        scripts/ci/osv-scan.sh --fixtures   prove the gate still fails when it scans nothing
#
# Never a silent pass:
#   - exit 128 ("No package sources found") is a FAILURE: this repo has lockfiles, so an empty
#     scan means the scan was misrooted, not that there is nothing to scan;
#   - every tracked lockfile of a type osv-scanner parses (LOCKFILE_RE) must appear in its
#     "Scanned <path> file ..." log, otherwise the gate fails and names the unscanned files.
# Worktrees: osv-scanner (2.5.x) finds the git root by walking up to a `.git` DIRECTORY. In a
# git worktree or submodule `.git` is a FILE, so it climbs to an enclosing repo and applies that
# repo's .gitignore — for `.claude/worktrees/<name>/` that ignores the whole checkout and the scan
# covers nothing. When `.git` is not a directory the scan goes through a symlink from a fresh
# temp dir, so only the checkout's own .gitignore files apply (same result as a normal clone).
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

# Lockfile types osv-scanner extracts that this repo tracks. settings-gradle.lockfile is not
# parsed by osv-scanner (and holds no dependencies), so it is deliberately not listed.
LOCKFILE_RE='(^|/)(pnpm-lock\.yaml|package-lock\.json|uv\.lock|(buildscript-)?gradle\.lockfile|verification-metadata\.xml|Package\.resolved)$'

tmp_base="${TMPDIR:-/tmp}"
tmp_base="${tmp_base%/}"
CLEANUP=""
cleanup() {
  local p
  for p in $CLEANUP; do rm -rf "$p"; done
}
trap cleanup EXIT

# osv_scan <checkout-root>: runs osv-scanner, prints its report, then the coverage summary.
# Returns osv-scanner's exit code (1 = advisories found), or 1 for an empty/incomplete scan.
osv_scan() {
  local root target view log rc=0 scanned expected missing
  root="$(cd "$1" && pwd -P)"
  target="$root"
  if [[ ! -d "$root/.git" ]]; then
    view="$(mktemp -d "$tmp_base/osv-scan-view.XXXXXX")"
    view="$(cd "$view" && pwd -P)"
    CLEANUP="$CLEANUP $view"
    ln -s "$root" "$view/repo"
    target="$view/repo"
    echo "osv-scanner: $root/.git is not a directory (git worktree?); scanning via $target so an enclosing repo's .gitignore cannot hide the checkout"
  fi
  log="$(mktemp "$tmp_base/osv-scan-log.XXXXXX")"
  CLEANUP="$CLEANUP $log"

  osv-scanner scan --recursive "$target" 2>&1 | tee "$log" || rc=$?
  if [[ $rc -eq 128 ]]; then
    error "osv-scanner found no package sources under $root (exit 128): the scan covered nothing. This repo tracks lockfiles, so this is a misrooted scan, not a pass."
    return 1
  fi
  if [[ $rc -ne 0 && $rc -ne 1 ]]; then
    error "osv-scanner failed (exit $rc)"
    return "$rc"
  fi

  # Relative paths of every source osv-scanner reported scanning.
  scanned="$(awk -v prefix="$target/" '
    /^Scanned .* file and found / {
      p = $0; sub(/^Scanned /, "", p); sub(/ file and found .*$/, "", p)
      if (index(p, prefix) == 1) p = substr(p, length(prefix) + 1)
      print p
    }' "$log" | LC_ALL=C sort -u)"
  expected="$(git -C "$root" ls-files | grep -E "$LOCKFILE_RE" | LC_ALL=C sort -u || true)"
  if [[ -z "$expected" ]]; then
    error "no tracked lockfiles matched under $root; cannot prove osv-scanner coverage"
    return 1
  fi
  missing="$(LC_ALL=C comm -23 <(printf '%s\n' "$expected") <(printf '%s\n' "$scanned"))"
  if [[ -n "$missing" ]]; then
    error "osv-scanner did not scan these tracked lockfiles (incomplete scan is a failure):"
    printf '%s\n' "$missing" | sed 's/^/  - /' >&2
    return 1
  fi
  echo "osv-scanner coverage: $(printf '%s\n' "$scanned" | grep -c .) package sources scanned; all $(printf '%s\n' "$expected" | grep -c .) tracked lockfiles covered:"
  printf '%s\n' "$expected" | sed 's/^/  /'
  return "$rc"
}

run_fixtures() {
  local empty outer out rc
  # 1. A tree with no package sources must FAIL (it used to print "no packages found" and pass).
  empty="$(mktemp -d "$tmp_base/osv-fixture-empty.XXXXXX")"
  CLEANUP="$CLEANUP $empty"
  rc=0
  out="$(osv_scan "$empty" 2>&1)" || rc=$?
  if [[ $rc -eq 0 ]] || ! printf '%s\n' "$out" | grep -q 'found no package sources'; then
    printf '%s\n' "$out"
    die "fixture empty-tree: expected a failure naming 'found no package sources' (rc=$rc)"
  fi
  echo "fixture empty-tree: fails as expected (rc=$rc)"

  # 2. A checkout whose `.git` is a FILE, nested in a repo whose .gitignore ignores it (the
  #    `.claude/worktrees/<name>/` layout), must still have its lockfile scanned.
  outer="$(mktemp -d "$tmp_base/osv-fixture-worktree.XXXXXX")"
  CLEANUP="$CLEANUP $outer"
  git init -q "$outer/enclosing"
  printf 'inner/\n' >"$outer/enclosing/.gitignore"
  git init -q --separate-git-dir "$outer/inner.git" "$outer/enclosing/inner"
  # Synthetic single-package uv.lock; six 1.17.0 has no known advisories.
  printf '%s\n' 'version = 1' 'requires-python = ">=3.12"' '' '[[package]]' 'name = "six"' \
    'version = "1.17.0"' 'source = { registry = "https://pypi.org/simple" }' \
    >"$outer/enclosing/inner/uv.lock"
  git -C "$outer/enclosing/inner" add uv.lock
  rc=0
  out="$(osv_scan "$outer/enclosing/inner" 2>&1)" || rc=$?
  if [[ $rc -ne 0 ]] || ! printf '%s\n' "$out" | grep -q 'all 1 tracked lockfiles covered'; then
    printf '%s\n' "$out"
    die "fixture ignored-worktree: expected uv.lock to be scanned (rc=$rc)"
  fi
  echo "fixture ignored-worktree: uv.lock scanned as expected"
}

case "${1:-}" in
  "") osv_scan "$REPO_ROOT" ;;
  --fixtures) run_fixtures ;;
  *) echo "osv-scan.sh: unknown argument '$1' (use --fixtures)" >&2; exit 2 ;;
esac
