#!/usr/bin/env bash
# Stop hook (.claude/settings.json). Blocks once when this session changed watched files (apps
# packages workers tools scripts justfile e2e docs .claude .agents .github mise.toml
# docker-compose.yml CLAUDE.md) but changed neither PROGRESS.md nor planning/PROGRESS.md (CLAUDE.md
# "Handoff protocol", "Session workflow" step 6). "Changed" is measured against the baseline
# session-start.sh recorded for this session_id, so committed work still counts and files that were
# already dirty at session start do not (session-baseline.sh); with no baseline it falls back to
# the working tree vs HEAD. The checkout is the one holding the input cwd (Claude may have cd'ed
# into a subdirectory or a worktree). In a linked worktree the lead owns the ledger, so a final
# message containing "Suggested PROGRESS.md line:" also passes.
#
# Guards against re-entry with the payload's stop_hook_active field (https://code.claude.com/docs/
# en/hooks — "Stop input": true when Claude Code is already continuing because of a Stop hook) and
# honours AGENT_SKIP_PROGRESS_GATE=1 for sessions that intentionally skip the gate. No jq → blocks
# once (fail closed) without looping.
set -uo pipefail
# shellcheck source=scripts/hooks/session-baseline.sh
source "$(dirname "${BASH_SOURCE[0]}")/session-baseline.sh"

input="$(cat)"

if [[ "${AGENT_SKIP_PROGRESS_GATE:-0}" == "1" ]]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  [[ "$input" =~ \"stop_hook_active\"[[:space:]]*:[[:space:]]*true ]] && exit 0
  printf '%s\n' '{"decision":"block","reason":"jq is not installed, so the PROGRESS gate cannot check this session (fail closed). Install jq, then update PROGRESS.md per the CLAUDE.md Handoff protocol, or set AGENT_SKIP_PROGRESS_GATE=1 if this stop is intentionally mid-work."}'
  exit 0
fi

[[ "$(jq -r '.stop_hook_active // false' <<<"$input")" == "true" ]] && exit 0

cwd="$(jq -r '.cwd // empty' <<<"$input")"
session_id="$(jq -r '.session_id // empty' <<<"$input")"
root="$(git -C "${cwd:-${CLAUDE_PROJECT_DIR:-$PWD}}" rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$root" || exit 0

baseline="$(session_baseline_file "$session_id" || true)"
watched_changed=() progress_changed=0
while IFS= read -r p; do
  case "$p" in
    PROGRESS.md | planning/PROGRESS.md) progress_changed=1 ;;
    *) watched_changed+=("$p") ;;
  esac
done < <(session_changed_paths "$baseline" "$root")

[[ ${#watched_changed[@]} -eq 0 || $progress_changed -eq 1 ]] && exit 0

git_dir="$(cd "$(git rev-parse --git-dir)" && pwd -P)"
common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
if [[ "$git_dir" != "$common_dir" ]]; then
  [[ "$(jq -r '.last_assistant_message // empty' <<<"$input")" == *"Suggested PROGRESS.md line:"* ]] && exit 0
  how="This is a linked worktree: end your final message with a 'Suggested PROGRESS.md line: ...' for the lead (or update PROGRESS.md)"
else
  how="Update PROGRESS.md or planning/PROGRESS.md per templates/session-handoff.md and the CLAUDE.md Handoff protocol"
fi

shown="$(printf '%s, ' "${watched_changed[@]:0:5}")"
shown="${shown%, }"
[[ ${#watched_changed[@]} -gt 5 ]] && shown="$shown, ... (${#watched_changed[@]} paths)"
jq -nc --arg reason "This session changed $shown but neither PROGRESS.md nor planning/PROGRESS.md. $how before stopping, or set AGENT_SKIP_PROGRESS_GATE=1 if this stop is intentionally mid-work." \
  '{decision: "block", reason: $reason}'
exit 0
