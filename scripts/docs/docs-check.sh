#!/usr/bin/env bash
# `just docs-check [--strict] [--fixtures] [PATH...]` — the docs/agent-ops enforcement engine
# (plan .claude/plans/s3-agent-operating-foundation.md, T2). Checks DC-01..DC-15:
#   DC-01  docs/modules/*.md <-> apps/api/src/modules/* + platform + shared-kernel bijection
#   DC-02  every module contract has the 8 templates/module-contract.md headings, in order
#   DC-03  module contract Status enum + Last-updated not older than the module's code
#   DC-04  docs/adr/*.md <-> docs/adr/README.md index rows
#   DC-05  .agents/skills/*/SKILL.md frontmatter, sections, line count, review date
#   DC-06  .agents/skills/README.md rows <-> skill dirs <-> .claude/skills/* symlinks
#   DC-07  .claude/agents/*.md frontmatter, tools allowlist, review date, README rows
#   DC-08  every SPINE module has skill detail + exactly one README coverage row
#   DC-09  every backticked repo-relative path in the three dirs below exists
#   DC-10  every `just <recipe>` token in the three dirs below is a real recipe
#   DC-11  no raw pnpm/uv/npx/drizzle-kit/eas/gradlew/xcodebuild invocation in the three dirs below
#   DC-12  root PROGRESS.md current-phase line == its row in planning/PROGRESS.md
#   DC-13  banned stale vendor names absent from .agents/**, .claude/**, docs/**, justfile
#   DC-14  (WARN unless --strict) CLAUDE.md layout block vs the real top-level tree
#   DC-15  (WARN unless --strict) doc 15 §5 recipe catalog == `just --summary`
# "the three dirs below" (DC-09/10/11) = .agents/skills/**, .claude/agents/**, .claude/rules/**.
#
# PATH... scopes the run to only the five file-scoped checks (DC-05, DC-07, DC-09, DC-10, DC-11),
# restricted to files under the given paths — every other check always runs full-repo (there is
# no meaningful way to scope a bijection or a roster-sync check to one file).
#
# Exit 0 = pass (warnings allowed), 1 = a check reported an ERROR, 2 = usage error.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$HERE/lib/common.sh"
# shellcheck source=lib/checks-contracts.sh
source "$HERE/lib/checks-contracts.sh"
# shellcheck source=lib/checks-skills-agents.sh
source "$HERE/lib/checks-skills-agents.sh"
# shellcheck source=lib/checks-coverage.sh
source "$HERE/lib/checks-coverage.sh"
# shellcheck source=lib/checks-refs.sh
source "$HERE/lib/checks-refs.sh"
# shellcheck source=lib/checks-repo.sh
source "$HERE/lib/checks-repo.sh"

usage() {
  echo "usage: docs-check.sh [--strict] [--fixtures] [PATH...]" >&2
}

# run_all_checks ROOT [scoped] — runs every DC-01..DC-15 check against ROOT, or (when "scoped" is
# passed) only the five file-scoped checks. Resets and leaves DOCS_CHECK_ERRORS/WARNINGS set for
# the caller to inspect.
run_all_checks() {
  local root="$1" scoped="${2:-0}"
  docs_check_reset_counters
  if [[ "$scoped" == "1" ]]; then
    check_dc05 "$root"
    check_dc07 "$root"
    check_dc09 "$root"
    check_dc10 "$root"
    check_dc11 "$root"
  else
    check_dc01 "$root"
    check_dc02 "$root"
    check_dc03 "$root"
    check_dc04 "$root"
    check_dc05 "$root"
    check_dc06 "$root"
    check_dc07 "$root"
    check_dc08 "$root"
    check_dc09 "$root"
    check_dc10 "$root"
    check_dc11 "$root"
    check_dc12 "$root"
    check_dc13 "$root"
    check_dc14 "$root"
    check_dc15 "$root"
  fi
  [[ "$DOCS_CHECK_ERRORS" -eq 0 ]]
}

# stage_fixture SRC DEST — copy one fixture tree into DEST and restore its dot-dirs. Fixtures keep
# `.claude`/`.agents` checked in as `dot-claude`/`dot-agents` so Claude Code (which walks the repo
# for `.claude/skills/*`) never discovers fixture content as real project config; the checks only
# ever see the renamed copy. cp -R keeps symlinks as symlinks on both GNU and BSD.
stage_fixture() {
  local src="$1" dest="$2" dir
  mkdir -p "$dest"
  cp -R "$src/." "$dest/"
  while IFS= read -r dir; do
    [[ -n "$dir" ]] || continue
    mv "$dir" "$(dirname "$dir")/.${dir##*/dot-}"
  done < <(find "$dest" -depth \( -name dot-claude -o -name dot-agents \) -type d)
  rm -f "$dest/.expect-only" "$dest/.shallow-clone"
  # Each case is its own git work tree so list_repo_files honours the fixture's .gitignore exactly
  # as it does the real repo's (a staged copy under TMPDIR is otherwise outside any repo).
  git -C "$dest" init -q
  if [[ -f "$src/.shallow-clone" ]]; then
    # Reproduce actions/checkout's default fetch-depth: 1 — two commits, cloned at depth 1.
    local -a gitc
    gitc=(-c user.name=docs-check -c user.email=docs-check@invalid -c commit.gpgsign=false -c core.hooksPath=/dev/null)
    git -C "$dest" add -A
    git -C "$dest" "${gitc[@]}" commit -q -m fixture
    git -C "$dest" "${gitc[@]}" commit -q --allow-empty -m head
    mv "$dest" "$dest.full"
    git clone -q --depth 1 "file://$dest.full" "$dest"
  fi
}

# run_fixtures — every tools/docs/fixtures/DC-NN/ (or DC-NN-<variant>/) must fail with finding id
# DC-NN, and exactly as its optional .expect-only file says (tools/docs/fixtures/README.md); the shared
# tools/docs/fixtures/_clean/ tree must pass every check (including DC-14/DC-15 under --strict).
# Each fixture is staged into a temp dir via stage_fixture before its checks run.
run_fixtures() {
  local fixtures_dir="$DOCS_CHECK_REPO_ROOT/tools/docs/fixtures"
  local failures=0 case_dir case_name check_id output rc stage_root
  stage_root="$(mktemp -d "${TMPDIR:-/tmp}/docs-check-fixtures.XXXXXX")"
  # shellcheck disable=SC2064  # expand now: stage_root is local to this function
  trap "rm -rf '$stage_root'" EXIT

  for case_dir in "$fixtures_dir"/DC-*/; do
    [[ -d "$case_dir" ]] || continue
    case_name="$(basename "$case_dir")"
    check_id="${case_name%%-[a-z]*}" # DC-03-shallow -> DC-03
    DOCS_CHECK_STRICT=0
    case "$check_id" in DC-14|DC-15) DOCS_CHECK_STRICT=1 ;; esac
    stage_fixture "${case_dir%/}" "$stage_root/$case_name"
    set +e
    output="$(run_all_checks "$stage_root/$case_name" 0 2>&1)"
    rc=$?
    set -e
    if [[ $rc -ne 1 ]] || ! grep -q " $check_id " <<<"$output"; then
      echo "FAIL  $case_name: expected exit 1 with a '$check_id' finding, got exit $rc:" >&2
      echo "$output" >&2
      failures=$((failures + 1))
    elif [[ -f "$case_dir/.expect-only" ]] \
      && [[ "$(grep " $check_id " <<<"$output")" != "$(cat "$case_dir/.expect-only")" ]]; then
      # .expect-only: the case's $check_id findings must be exactly this text, nothing more.
      echo "FAIL  $case_name: expected exactly these '$check_id' findings:" >&2
      cat "$case_dir/.expect-only" >&2
      echo "got:" >&2
      echo "$output" >&2
      failures=$((failures + 1))
    else
      echo "ok    $case_name -> reported (exit $rc)"
    fi
  done

  DOCS_CHECK_STRICT=1
  stage_fixture "$fixtures_dir/_clean" "$stage_root/_clean"
  set +e
  output="$(run_all_checks "$stage_root/_clean" 0 2>&1)"
  rc=$?
  set -e
  if [[ $rc -ne 0 || -n "$output" ]]; then
    echo "FAIL  _clean: expected exit 0 with no findings (--strict), got exit $rc:" >&2
    echo "$output" >&2
    failures=$((failures + 1))
  else
    echo "ok    _clean -> no findings (exit 0, --strict)"
  fi

  if [[ $failures -gt 0 ]]; then
    echo "docs-check --fixtures: $failures failure(s)" >&2
    return 1
  fi
  echo "docs-check --fixtures: all fixtures reported by their own check id"
  return 0
}

main() {
  local fixtures=0
  DOCS_CHECK_STRICT=0
  local -a paths
  paths=()

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --strict) DOCS_CHECK_STRICT=1; shift ;;
      --fixtures) fixtures=1; shift ;;
      -h|--help) usage; exit 0 ;;
      --*) echo "docs-check: unknown flag '$1'" >&2; usage; exit 2 ;;
      *) paths+=("$(abspath "$1")"); shift ;;
    esac
  done

  if [[ $fixtures -eq 1 ]]; then
    if [[ "${#paths[@]}" -gt 0 ]]; then
      echo "docs-check: --fixtures takes no PATH arguments" >&2
      exit 2
    fi
    if run_fixtures; then exit 0; else exit 1; fi
  fi

  DOCS_CHECK_PATH_FILTERS=("${paths[@]}")
  local scoped=0
  [[ "${#paths[@]}" -gt 0 ]] && scoped=1

  run_all_checks "$DOCS_CHECK_REPO_ROOT" "$scoped" || true

  if [[ "$DOCS_CHECK_ERRORS" -gt 0 ]]; then
    echo "docs-check: $DOCS_CHECK_ERRORS error(s), $DOCS_CHECK_WARNINGS warning(s)" >&2
    exit 1
  fi
  echo "docs-check: ok (0 errors, $DOCS_CHECK_WARNINGS warning(s))"
  exit 0
}

main "$@"
