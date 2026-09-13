#!/usr/bin/env bash
# PreToolUse guard, matcher Bash (.claude/settings.json). Denies a fixed set of destructive or
# human-only commands (CLAUDE.md "Prohibited without explicit human authorization"; lockfiles are
# single-writer per "Parallel sessions"). Matches the whole command string, so it also catches
# compound/piped/substituted forms the permission-rule matcher in permissions.deny can miss.
# Read-only: never writes anything itself.
#
# Reads the PreToolUse JSON payload on stdin (docs.claude.com/en/hooks — "PreToolUse input" →
# "Bash"): tool_input.command is the shell command text.
set -uo pipefail

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
[[ -z "$command" ]] && exit 0

deny() {
  jq -nc --arg reason "$1" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

if [[ "$command" =~ pnpm[[:space:]]+(add|remove|update)([[:space:]]|$) ]]; then
  deny "pnpm add/remove/update changes pnpm-lock.yaml, a single-writer file (CLAUDE.md). Ask the human to run it and commit the resulting lockfile diff, or propose the change in the PR description."
elif [[ "$command" =~ uv[[:space:]]+(add|remove)([[:space:]]|$) ]]; then
  deny "uv add/remove changes workers/uv.lock, a single-writer file (CLAUDE.md). Ask the human to run it and commit the resulting lockfile diff."
elif [[ "$command" =~ drizzle-kit[[:space:]]+push([[:space:]]|$) ]]; then
  deny "drizzle-kit push applies unreviewed schema changes directly to a database, bypassing migrations. Use 'just db-generate <name>' to create a migration, then 'just db-migrate'."
elif [[ "$command" =~ gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$) ]]; then
  deny "Merging a PR is a human decision (CLAUDE.md). Push the branch and let a human merge it."
elif [[ "$command" =~ git[[:space:]]+push[^\&\|\;]*--delete ]]; then
  deny "Deleting a remote branch is a destructive git operation prohibited without explicit human authorization (CLAUDE.md)."
elif [[ "$command" =~ git[[:space:]]+push[^\&\|\;]*[[:space:]]:[^[:space:]\&\|\;] ]]; then
  deny "Deleting a remote ref via the ':<branch>' refspec is a destructive git operation prohibited without explicit human authorization (CLAUDE.md)."
elif [[ "$command" =~ eas[[:space:]]+submit([[:space:]]|$) ]]; then
  deny "Store submission is a human-only release action (CLAUDE.md 'Prohibited without explicit human authorization')."
elif [[ "$command" =~ just[[:space:]]+secrets-sync[[:space:]]+(staging|prod)([[:space:]]|$) ]]; then
  deny "Syncing secrets to staging/prod is a cloud/infra mutation prohibited without explicit human authorization (CLAUDE.md)."
elif [[ "$command" =~ gh[[:space:]]+api[[:space:]] ]] && [[ "$command" =~ (-X|--method)[[:space:]]+DELETE ]]; then
  deny "Deleting a resource via the GitHub API is destructive and prohibited without explicit human authorization (CLAUDE.md)."
fi

exit 0
