#!/usr/bin/env bash
# Stop hook (.claude/settings.json). Blocks once if source changed under
# apps/|packages/|workers/|tools/|scripts/|justfile but neither PROGRESS.md nor
# planning/PROGRESS.md was updated (CLAUDE.md "Handoff protocol", "Session workflow" step 6).
#
# Guards against re-entry with the payload's stop_hook_active field (docs.claude.com/en/hooks —
# "Stop input": true when Claude Code is already continuing because of a Stop hook) and honours
# AGENT_SKIP_PROGRESS_GATE=1 for sessions that intentionally skip the gate.
set -uo pipefail

input="$(cat)"

stop_hook_active="$(printf '%s' "$input" | jq -r '.stop_hook_active // false')"
if [[ "$stop_hook_active" == "true" ]]; then
  exit 0
fi

if [[ "${AGENT_SKIP_PROGRESS_GATE:-0}" == "1" ]]; then
  exit 0
fi

cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
if [[ -n "$cwd" && -d "$cwd" ]]; then
  cd "$cwd" || exit 0
fi

source_changed="$(git status --porcelain -- apps packages workers tools scripts justfile 2>/dev/null || true)"
[[ -z "$source_changed" ]] && exit 0

progress_changed="$(git status --porcelain -- PROGRESS.md planning/PROGRESS.md 2>/dev/null || true)"
[[ -n "$progress_changed" ]] && exit 0

jq -nc '{decision: "block", reason: "Source changed under apps/|packages/|workers/|tools/|scripts/|justfile but neither PROGRESS.md nor planning/PROGRESS.md was updated. Follow templates/session-handoff.md and the CLAUDE.md Handoff protocol before stopping (or set AGENT_SKIP_PROGRESS_GATE=1 if this stop is intentionally mid-work)."}'
exit 0
