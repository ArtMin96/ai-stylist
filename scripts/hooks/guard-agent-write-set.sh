#!/usr/bin/env bash
# PreToolUse guard for ONE agent's write set. Wired from the agent's own frontmatter
# (.claude/agents/<name>.md `hooks:` → matcher "Edit|Write|NotebookEdit", exec form) with the
# agent's globs as args:
#   guard-agent-write-set.sh GLOB... [!EXCLUDE-GLOB...]
# A file is allowed iff its repo-relative path matches at least one include GLOB and no
# "!"-prefixed EXCLUDE-GLOB. Globs use bash [[ == ]] matching: "*" (and so "**") matches any run
# of characters, "/" included. The repo-relative path is taken against the top level of the
# checkout that holds the file (the main checkout or a .claude/worktrees/<name> worktree), after
# resolving symlinks. A file outside every checkout is allowed only under the session's
# scratchpad_dir. No jq → deny (fail closed). Never writes anything itself.
#
# Input (PreToolUse JSON on stdin): tool_input.file_path (Edit/Write) or tool_input.notebook_path
# (NotebookEdit); cwd (a relative path resolves against it); scratchpad_dir; agent_type.
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  while IFS= read -r _; do :; done
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"jq is not installed, so the per-agent write-set guard cannot inspect this edit (fail closed). Report this change under Blockers: jq must be installed."}}'
  exit 0
fi

input="$(cat)"
field() { jq -r "$1" <<<"$input"; }
agent="$(field '.agent_type // "this agent"')"
path="$(field '.tool_input.file_path // .tool_input.notebook_path // empty')"
cwd="$(field '.cwd // empty')"
scratch="$(field '.scratchpad_dir // empty')"

allowed_text="(nothing)"
if [[ $# -gt 0 ]]; then
  allowed_text="$1"
  for g in "${@:2}"; do allowed_text="$allowed_text, $g"; done
fi

deny() {
  jq -nc --arg reason "$1$agent may only write: $allowed_text. Report this change under 'Cross-slice requests'/'Noticed but not touched' for its owner." \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
  exit 0
}

[[ -n "$path" ]] || deny "No file path in the tool input. "
[[ "$path" == /* ]] || path="${cwd:-$PWD}/$path"
case "$path/" in */../*) deny "'$path' contains a '..' segment; use the normalized absolute path. " ;; esac

# physical_path PATH -> PATH with every symlink resolved: the nearest existing parent directory via
# `cd -P`, then the file itself if it is a symlink (bounded, so a symlink loop cannot hang).
physical_path() {
  local p="$1" dir rest target hops=0
  while :; do
    dir="$(dirname "$p")"
    rest="$(basename "$p")"
    while [[ ! -d "$dir" ]]; do
      rest="$(basename "$dir")/$rest"
      dir="$(dirname "$dir")"
    done
    dir="$(cd -P "$dir" 2>/dev/null && pwd)" || return 1
    p="$dir/$rest"
    [[ -L "$p" && $hops -lt 8 ]] || break
    target="$(readlink "$p")"
    [[ "$target" == /* ]] || target="$dir/$target"
    p="$target"
    hops=$((hops + 1))
  done
  printf '%s\n' "$p"
}

abs="$(physical_path "$path")" || deny "Cannot resolve '$path'. "
case "$abs/" in */../*) deny "'$path' resolves through a '..' segment. " ;; esac

# The nearest existing directory decides which checkout (if any) holds the file.
probe="$(dirname "$abs")"
while [[ ! -d "$probe" ]]; do probe="$(dirname "$probe")"; done
top="$(git -C "$probe" rev-parse --show-toplevel 2>/dev/null || true)"

if [[ -z "$top" ]]; then
  scratch_real=""
  [[ -n "$scratch" ]] && scratch_real="$(cd -P "$scratch" 2>/dev/null && pwd)"
  [[ -n "$scratch_real" && "$abs" == "$scratch_real"/* ]] && exit 0
  deny "'$abs' is outside every checkout and outside the session scratchpad. "
fi

rel="${abs#"$top"/}"
[[ "$rel" != "$abs" ]] || deny "'$abs' is not a file inside checkout '$top'. "

ok=0
for g in "$@"; do
  # shellcheck disable=SC2053  # the glob args are patterns on purpose
  case "$g" in '!'*) ;; *) [[ "$rel" == $g ]] && ok=1 ;; esac
done
for g in "$@"; do
  # shellcheck disable=SC2053
  case "$g" in '!'*) [[ "$rel" == ${g#!} ]] && ok=0 ;; esac
done
[[ $ok -eq 1 ]] && exit 0
deny "'$rel' is outside this agent's write set. "
