#!/usr/bin/env bash
# Start (or stop) the capture camera Managed Agent on this Mac.
#
#   capture-agent.sh start [message-file]   sync the agent, start the worker, open a capped session
#   capture-agent.sh stop                   stop the local worker
#
# The agent loop runs at Anthropic; every tool call runs here through `ant beta:worker poll`
# (self-hosted environment). Each session's budget is whatever is left of CAPTURE_AGENT_TOTAL_CENTS
# after the list cost of every earlier "capture-camera:" session, so all runs together stay under the
# owner's cap ($197, 2026-10-22). See tools/managed-agents/README.md.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && git rev-parse --show-toplevel)"
# The worker works from the main checkout so it can reach every worktree under .claude/worktrees/.
workdir="$(cd "$(git -C "$repo" rev-parse --git-common-dir)/.." && pwd)"
state="$workdir/artifacts/managed-agents"
agent_file="./agents/capture-camera/agent.md"
env_file="./agents/capture-camera/environment.yaml"
keychain_service="ai-stylist-capture-agent-environment-key"
title_prefix="capture-camera:"
total_cents="${CAPTURE_AGENT_TOTAL_CENTS:-19700}"

die() {
  echo "capture-agent: $*" >&2
  exit 1
}

need_tools() {
  command -v jq >/dev/null || die "jq is missing (brew install jq)"
  command -v ant >/dev/null || die "the Anthropic CLI is missing. Install it once:
  brew install anthropics/tap/ant && xattr -d com.apple.quarantine \"\$(brew --prefix)/bin/ant\"
then log in once: ant auth login"
  ant auth status >/dev/null 2>&1 || die "not logged in to Anthropic. Run once: ant auth login"
}

lock_id() {
  jq -r --arg key "$1" '.resources[$key].id // empty' "$here/claude-lock.json" 2>/dev/null
}

stop_worker() {
  if [[ -f "$state/worker.pid" ]] && kill -0 "$(cat "$state/worker.pid")" 2>/dev/null; then
    kill "$(cat "$state/worker.pid")"
    echo "capture-agent: worker stopped"
  else
    echo "capture-agent: no worker running"
  fi
  rm -f "$state/worker.pid"
}

start_worker() {
  local env_id="$1" key
  if [[ -f "$state/worker.pid" ]] && kill -0 "$(cat "$state/worker.pid")" 2>/dev/null; then
    echo "capture-agent: worker already running (pid $(cat "$state/worker.pid"))"
    return
  fi
  key="$(security find-generic-password -s "$keychain_service" -w 2>/dev/null)" || die "no environment key in the Keychain.
Generate one in the Anthropic Console on the environment page for $env_id (\"Generate environment key\"), then store it:
  security add-generic-password -a \"\$USER\" -s $keychain_service -w
(it prompts for the key; nothing is written to disk)"
  mkdir -p "$state"
  # The worker gets only the environment key: no Anthropic API key or profile token, and no PostHog
  # upload keys, so tool calls cannot reach an organisation credential or upload symbols.
  env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_PROFILE \
    -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID \
    ANTHROPIC_ENVIRONMENT_KEY="$key" \
    nohup ant beta:worker poll --environment-id "$env_id" --workdir "$workdir" \
    --max-idle 12h >>"$state/worker.log" 2>&1 &
  echo $! >"$state/worker.pid"
  echo "capture-agent: worker started (pid $!, log $state/worker.log)"
}

spent_cents() {
  # Sum the list cost (cents) of every earlier session this script started for this agent.
  ant beta:sessions list --agent-id "$1" --max-items -1 --format jsonl \
    --transform '{title,cost:usage.list_cost.amount}' |
    jq -s --arg p "$title_prefix" \
      '[.[] | select((.title // "") | startswith($p)) | (.cost // "0" | tonumber)] | add // 0'
}

start() {
  local message_file="${1:-$here/agents/capture-camera/kickoff.md}" agent_id env_id spent left sid event
  [[ -f "$message_file" ]] || die "message file not found: $message_file"
  need_tools

  (cd "$here" && ant apply "$agent_file" "$env_file")
  agent_id="$(lock_id "$agent_file")"
  env_id="$(lock_id "$env_file")"
  [[ -n "$agent_id" && -n "$env_id" ]] || die "ant apply did not record the agent and environment in $here/claude-lock.json"

  spent="$(spent_cents "$agent_id")" || die "could not read the spend of earlier sessions; not starting without a known cap"
  left=$((total_cents - spent))
  ((left > 0)) || die "the total cap of \$$((total_cents / 100)) is used up (spent $spent cents)"
  echo "capture-agent: spent so far $spent cents; this session's cap is $left cents"

  start_worker "$env_id"

  sid="$(ant beta:sessions create --agent "$agent_id" --environment-id "$env_id" \
    --title "$title_prefix $(date '+%Y-%m-%d %H:%M')" \
    --budget "{type: limit, max_list_cost: {amount: \"$left\", currency: USD}}" \
    --transform id -r)"
  event="$(jq -n --rawfile text "$message_file" \
    '{type: "user.message", content: [{type: "text", text: $text}]}')"
  ant beta:sessions:events send --session-id "$sid" --event "$event" >/dev/null
  echo "capture-agent: session $sid started. Ctrl+C detaches; the session keeps running."
  echo "capture-agent: reattach with: ant beta:sessions connect $sid"
  ant beta:sessions connect "$sid"
}

case "${1:-start}" in
  start) start "${2:-}" ;;
  stop) stop_worker ;;
  *) die "usage: capture-agent.sh [start [message-file] | stop]" ;;
esac
