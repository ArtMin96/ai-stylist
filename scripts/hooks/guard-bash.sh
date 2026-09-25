#!/usr/bin/env bash
# PreToolUse guard, matcher Bash (.claude/settings.json). Denies a fixed set of destructive or
# human-only commands (CLAUDE.md "Prohibited without explicit human authorization"; lockfiles are
# single-writer per "Parallel sessions"). Matches the whole command string, so it also catches
# compound/piped/substituted forms the permission-rule matcher in permissions.deny can miss — and
# text that merely mentions a command (write such text with the Write tool instead). Destructive
# git that a human may approve (force push, reset --hard, rebase, ...) is a permissions.ask rule in
# .claude/settings.json, not a deny here. `gh` rules match both `gh` and this repo's `git gh`.
# No jq → deny (fail closed). Read-only: never writes anything itself.
#
# Reads the PreToolUse JSON payload on stdin (https://code.claude.com/docs/en/hooks — "PreToolUse
# input" → "Bash"): tool_input.command is the shell command text.
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  while IFS= read -r _; do :; done
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"jq is not installed, so the repo Bash guard cannot inspect this command (fail closed). Install jq (macOS ships /usr/bin/jq; on Linux use the distro package) and retry."}}'
  exit 0
fi

input="$(cat)"
command="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
[[ -z "$command" ]] && exit 0

deny() {
  jq -nc --arg reason "$1 (This guard matches the whole command text; to write text that merely mentions this command, use the Write tool.)" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

# A command word at the start of the text or after a separator, then any words, then the verb.
pre='(^|[[:space:];&|(/])'
words='([[:space:]]+[^[:space:];&|]+)*[[:space:]]+'
gh='(^|[[:space:];&|(/])(git[[:space:]]+)?gh[[:space:]]+'

if [[ "$command" =~ ${pre}pnpm${words}(add|remove|rm|uninstall|un|update|up|upgrade|dedupe)([[:space:]]|$) ]]; then
  deny "pnpm add/remove/update/dedupe changes pnpm-lock.yaml, a single-writer file (CLAUDE.md). Ask the human to run it and commit the resulting lockfile diff, or propose the change in the PR description."
elif [[ "$command" =~ ${pre}uv${words}(add|remove)([[:space:]]|$) ]] \
  || [[ "$command" =~ ${pre}uv${words}(lock|sync)[^\&\|\;]*[[:space:]]--upgrade ]]; then
  deny "uv add/remove/lock --upgrade changes workers/uv.lock, a single-writer file (CLAUDE.md). Ask the human to run it and commit the resulting lockfile diff."
elif [[ "$command" =~ drizzle-kit[[:space:]]+push([[:space:]]|$) ]]; then
  deny "drizzle-kit push applies unreviewed schema changes directly to a database, bypassing migrations. Use 'just db-generate <name>' to create a migration, then 'just db-migrate'."
elif [[ "$command" =~ ${gh}pr[[:space:]]+merge([[:space:]]|$) ]] \
  || [[ "$command" =~ ${gh}api[^\&\|\;]*/merges?([[:space:]/?\"\']|$) ]]; then
  deny "Merging a PR or branch is a human decision (CLAUDE.md). Push the branch and let a human merge it."
elif [[ "$command" =~ git[[:space:]]+push[^\&\|\;]*[[:space:]](--delete|-d)([[:space:]]|$) ]]; then
  deny "Deleting a remote branch is a destructive git operation prohibited without explicit human authorization (CLAUDE.md)."
elif [[ "$command" =~ git[[:space:]]+push[^\&\|\;]*[[:space:]]:[^[:space:]\&\|\;] ]]; then
  deny "Deleting a remote ref via the ':<branch>' refspec is a destructive git operation prohibited without explicit human authorization (CLAUDE.md)."
elif [[ "$command" =~ ${pre}fastlane[[:space:]]+(run[[:space:]]+)?(deliver|pilot|supply|upload_to_testflight|upload_to_app_store|upload_to_play_store)([[:space:]]|$) ]] \
  || [[ "$command" =~ xcrun[[:space:]]+altool[^\&\|\;]*--upload ]] \
  || [[ "$command" =~ xcrun[[:space:]]+iTMSTransporter ]] \
  || [[ "$command" =~ gradle[^\&\|\;]*[[:space:]]:?([a-z-]+:)*publish[A-Za-z]*(Bundle|Apk|Listing|Products) ]]; then
  deny "Uploading a build to TestFlight/App Store Connect or Google Play is a human-only release action (CLAUDE.md 'Prohibited without explicit human authorization')."
elif [[ "$command" =~ just[[:space:]]+secrets-sync[[:space:]]+(staging|prod)([[:space:]]|$) ]]; then
  deny "Syncing secrets to staging/prod is a cloud/infra mutation prohibited without explicit human authorization (CLAUDE.md)."
elif [[ "$command" =~ ${gh}api[[:space:]] ]] && [[ "$command" =~ (-X|--method)[[:space:]=]*[Dd][Ee][Ll][Ee][Tt][Ee] ]]; then
  deny "Deleting a resource via the GitHub API is destructive and prohibited without explicit human authorization (CLAUDE.md)."
elif [[ "$command" =~ ${gh}api[^\&\|\;]*/(protection|rulesets)([[:space:]/?\"\']|$) ]]; then
  deny "Branch protection and rulesets (the required checks) are human-only (CLAUDE.md 'changing CI required checks')."
elif [[ "$command" =~ ${gh}(repo[[:space:]]+(delete|archive|rename|edit)|secret[[:space:]]+(set|delete|remove)|variable[[:space:]]+(set|delete|remove)|release[[:space:]]+delete)([[:space:]]|$) ]]; then
  deny "Deleting, archiving, renaming or reconfiguring the repository, its secrets/variables, or a release is prohibited without explicit human authorization (CLAUDE.md)."
fi

exit 0
