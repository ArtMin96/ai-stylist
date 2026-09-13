#!/usr/bin/env bash
# SessionStart hook (.claude/settings.json). Read-only orientation print: the root PROGRESS.md
# "Current phase" block, the newest handoff heading from planning/PROGRESS.md, `git status -sb`,
# and a pointer to the skill/agent rosters (CLAUDE.md "Session workflow" step 1). Plain stdout
# reaches Claude directly for this event (docs.claude.com/en/hooks — "SessionStart decision
# control"), so no JSON wrapper is needed. Never exits non-zero.
set -uo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

repo_root="${CLAUDE_PROJECT_DIR:-$REPO_ROOT}"
cd "$repo_root" 2>/dev/null || exit 0

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
