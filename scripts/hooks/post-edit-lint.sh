#!/usr/bin/env bash
# PostToolUse hook, matcher Edit|Write|MultiEdit (.claude/settings.json, 30 s timeout). Delegates to
# `just lint-file <path>` (scripts/lint-file.sh, T1) and shows any lint failure to Claude
# immediately. PostToolUse can't block — the tool has already run — so a lint failure exits 2 to
# surface stderr to Claude without re-running the edit (docs.claude.com/en/hooks, "Exit code 2
# behavior per event"). Also flags, non-blocking, when a module contract may need updating.
#
# Reads the PostToolUse JSON payload on stdin: tool_input.file_path is always absolute.
set -uo pipefail

input="$(cat)"
path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
[[ -z "$path" ]] && exit 0

# Non-blocking reminder that a module contract likely needs a matching update (CLAUDE.md
# "Single source of truth"). Emitted via hookSpecificOutput.additionalContext regardless of the
# lint outcome below, since JSON stdout is read on every exit code.
doc_hint=""
case "$path" in
  */apps/api/src/modules/*/index.ts)
    module="$(printf '%s' "$path" | sed -E 's#.*/apps/api/src/modules/([^/]+)/index\.ts$#\1#')"
    doc_hint="docs/modules/${module}.md must change in this PR — run \`just docs-check\`."
    ;;
  */apps/api/src/modules/*/internal/schema.ts)
    module="$(printf '%s' "$path" | sed -E 's#.*/apps/api/src/modules/([^/]+)/internal/schema\.ts$#\1#')"
    doc_hint="docs/modules/${module}.md must change in this PR — run \`just docs-check\`."
    ;;
  */packages/contracts/openapi/modules/*.yaml)
    module="$(basename "$path" .yaml)"
    doc_hint="docs/modules/${module}.md must change in this PR — run \`just docs-check\`."
    ;;
  */packages/contracts/events/*)
    doc_hint="This event schema change may require the affected module's docs/modules/<name>.md to change in this PR — run \`just docs-check\`."
    ;;
esac

lint_output="$(just lint-file "$path" 2>&1)"
lint_status=$?

if [[ -n "$doc_hint" ]]; then
  hint_json="$(jq -nc --arg ctx "$doc_hint" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}')"
else
  hint_json=""
fi

if (( lint_status != 0 )); then
  printf '%s\n' "$lint_output" >&2
  [[ -n "$hint_json" ]] && printf '%s\n' "$hint_json"
  exit 2
fi

[[ -n "$hint_json" ]] && printf '%s\n' "$hint_json"
exit 0
