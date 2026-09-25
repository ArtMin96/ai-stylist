#!/usr/bin/env bash
# Per-session change baseline shared by session-start.sh (records it) and session-close-check.sh
# (compares against it). Source, do not execute; run every function with cwd = the checkout root.
#
# Baseline file: <git common dir>/claude-sessions/<session_id> (outside the work tree, shared by
# every worktree of the repo, never committed):
#   root <checkout top level>
#   head <HEAD sha at session start>
#   <path>\t<blob sha | DELETED>      one line per watched/PROGRESS path that differed from HEAD
# A path is "changed this session" when its working-tree state differs from its baseline state
# (the recorded line, else its blob at the recorded HEAD). Committing work does not hide it, and a
# file that was already dirty at session start only counts if it changed again.

SESSION_WATCHED=(apps packages workers tools scripts justfile e2e docs .claude .agents .github mise.toml docker-compose.yml CLAUDE.md)
SESSION_PROGRESS=(PROGRESS.md planning/PROGRESS.md)

# session_baseline_file SESSION_ID -> the baseline path for this repo, or nothing (bad id / no repo).
session_baseline_file() {
  local id="$1" common
  [[ "$id" =~ ^[A-Za-z0-9._-]+$ ]] || return 1
  common="$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)" || return 1
  printf '%s/claude-sessions/%s\n' "$common" "$id"
}

# session_path_state PATH -> blob sha of the working-tree file, or DELETED.
session_path_state() {
  if [[ -e "$1" || -L "$1" ]]; then
    git hash-object -- "$1" 2>/dev/null || echo UNREADABLE
  else
    echo DELETED
  fi
}

# session_dirty_paths BASE -> paths under the watched + PROGRESS pathspecs that differ from commit
# BASE in the working tree, plus untracked ones, one per line.
session_dirty_paths() {
  {
    git -c core.quotePath=false diff --name-only "$1" -- "${SESSION_WATCHED[@]}" "${SESSION_PROGRESS[@]}"
    git -c core.quotePath=false ls-files --others --exclude-standard -- "${SESSION_WATCHED[@]}" "${SESSION_PROGRESS[@]}"
  } 2>/dev/null | sort -u
}

# session_record_baseline FILE ROOT — write the baseline for the checkout at ROOT (cwd).
session_record_baseline() {
  local file="$1" root="$2" head p
  head="$(git rev-parse -q --verify HEAD 2>/dev/null)" || return 0
  mkdir -p "$(dirname "$file")" || return 0
  {
    printf 'root %s\nhead %s\n' "$root" "$head"
    session_dirty_paths "$head" | while IFS= read -r p; do
      [[ -n "$p" ]] && printf '%s\t%s\n' "$p" "$(session_path_state "$p")"
    done
  } >"$file.tmp" && mv "$file.tmp" "$file"
}

# session_changed_paths FILE ROOT -> every watched/PROGRESS path changed since the baseline in FILE
# (when FILE exists and was recorded for ROOT), else since HEAD (no baseline: plain dirty check).
session_changed_paths() {
  local file="$1" root="$2" base="" p recorded want
  if [[ -f "$file" && "$(sed -n '1s/^root //p' "$file")" == "$root" ]]; then
    base="$(sed -n '2s/^head //p' "$file")"
    git cat-file -e "$base^{commit}" 2>/dev/null || base=""
  fi
  if [[ -z "$base" ]]; then
    base="$(git rev-parse -q --verify HEAD 2>/dev/null)" || return 0
    file=""
  fi
  {
    session_dirty_paths "$base"
    [[ -n "$file" ]] && awk -F'\t' 'NR > 2 && NF >= 2 { print $1 }' "$file"
  } | sort -u | while IFS= read -r p; do
    [[ -n "$p" ]] || continue
    recorded=""
    [[ -n "$file" ]] && recorded="$(awk -F'\t' -v p="$p" 'NR > 2 && $1 == p { print $2; exit }' "$file")"
    want="${recorded:-$(git rev-parse -q --verify "$base:$p" 2>/dev/null || echo DELETED)}"
    [[ "$(session_path_state "$p")" == "$want" ]] || printf '%s\n' "$p"
  done
}
