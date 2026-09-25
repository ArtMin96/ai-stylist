#!/usr/bin/env bash
# PostToolUse hook, matcher Edit|Write|NotebookEdit (.claude/settings.json, 30 s timeout).
# Delegates to `just lint-file <path>` (scripts/lint-file.sh) and shows any lint failure to Claude
# immediately. PostToolUse can't block — the tool has already run — so a lint failure exits 2 to
# surface stderr to Claude without re-running the edit (https://code.claude.com/docs/en/hooks,
# "Exit code 2 behavior per event"). Also flags, non-blocking, when a module contract may need
# updating.
#
# The lint runs in the checkout that holds the file (the main checkout or a .claude/worktrees/*
# worktree of the same repo), with that checkout's own justfile and scripts. Files outside this
# repository's checkouts (scratchpad, other repos) are not linted.
#
# Reads the PostToolUse JSON payload on stdin: tool_input.file_path (or notebook_path), absolute.
set -uo pipefail

input="$(cat)"
if ! command -v jq >/dev/null 2>&1; then
  echo "post-edit-lint: jq is not installed; this edit was not linted (install jq)." >&2
  exit 0
fi
path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"
[[ -z "$path" || ! -e "$path" ]] && exit 0

# common_dir DIR -> the physical git common dir of the checkout holding DIR, or nothing.
common_dir() {
  (cd "$1" 2>/dev/null && cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)
}
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
top="$(git -C "$(dirname "$path")" rev-parse --show-toplevel 2>/dev/null)" || exit 0
[[ -n "$top" && "$(common_dir "$top")" == "$(common_dir "$here")" ]] || exit 0
cd "$top" || exit 0

# Gate fixture trees are deliberately rule-breaking copies of the repo: no hints, no lint.
case "$path" in */tools/*/fixtures/*) exit 0 ;; esac

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

if ((lint_status != 0)); then
  printf '%s\n' "$lint_output" >&2
  [[ -n "$hint_json" ]] && printf '%s\n' "$hint_json"
  exit 2
fi

[[ -n "$hint_json" ]] && printf '%s\n' "$hint_json"
exit 0
