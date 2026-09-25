#!/usr/bin/env bash
# SessionStart hook (.claude/settings.json). Two jobs, both silent on failure (never exits non-zero):
# 1. On source "startup" or "clear" only, records this session's change baseline
#    (session-baseline.sh) so the Stop gate (session-close-check.sh) judges only what THIS session
#    changed. "resume" and "compact" keep the original baseline.
# 2. Read-only orientation print for the checkout Claude is in (the input cwd, which follows Claude
#    into a worktree; ${CLAUDE_PROJECT_DIR} always names the main checkout): the root PROGRESS.md
#    "Current phase" block, the newest handoff heading from planning/PROGRESS.md, `git status -sb`,
#    and a pointer to the skill/agent rosters (CLAUDE.md "Session workflow" step 1). Plain stdout
#    reaches Claude directly for this event (https://code.claude.com/docs/en/hooks — "SessionStart
#    decision control"), so no JSON wrapper is needed.
set -uo pipefail
here="$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=scripts/lib.sh
source "$here/../lib.sh"
# shellcheck source=scripts/hooks/session-baseline.sh
source "$here/session-baseline.sh"

input="$(cat)"
cwd="" source_kind="" session_id=""
if command -v jq >/dev/null 2>&1; then
  cwd="$(jq -r '.cwd // empty' <<<"$input" 2>/dev/null)"
  source_kind="$(jq -r '.source // empty' <<<"$input" 2>/dev/null)"
  session_id="$(jq -r '.session_id // empty' <<<"$input" 2>/dev/null)"
fi

repo_root="$(git -C "${cwd:-${CLAUDE_PROJECT_DIR:-$REPO_ROOT}}" rev-parse --show-toplevel 2>/dev/null ||
  printf '%s' "${CLAUDE_PROJECT_DIR:-$REPO_ROOT}")"
cd "$repo_root" 2>/dev/null || exit 0

case "$source_kind" in
  startup | clear)
    if baseline="$(session_baseline_file "$session_id")"; then
      session_record_baseline "$baseline" "$repo_root"
      # Baselines of long-finished sessions are dead weight.
      find "$(dirname "$baseline")" -type f -mtime +14 -delete 2>/dev/null
    fi
    ;;
esac

echo "== PROGRESS.md: Current phase =="
awk '/^## Current phase/{flag=1; print; next} /^## /{if (flag) exit} flag' PROGRESS.md 2>/dev/null

echo
echo "== planning/PROGRESS.md: newest handoff =="
awk '/^### /{print; exit}' planning/PROGRESS.md 2>/dev/null

echo
echo "== git status -sb =="
git status -sb 2>/dev/null

echo
echo "Skill roster: .agents/skills/README.md — Agent roster: .claude/agents/README.md"

exit 0
