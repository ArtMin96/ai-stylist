#!/usr/bin/env bash
# DC-09..DC-11: content scans over .agents/skills/**, .claude/agents/**, .claude/rules/** — the
# three "no raw tool invocation, no dead path" directories (doc 15 §5: `just` is the only
# sanctioned entry point). Source, do not execute; depends on common.sh being sourced first.

DOCS_CHECK_BANNED_INVOCATIONS=("pnpm --filter" "uv run" "npx " "drizzle-kit " "eas ")

# docs_check_ref_scan_files ROOT -> every *.md under the three DC-09/10/11 directories, filtered
# by file_in_scope (PATH... args) when set.
docs_check_ref_scan_files() {
  local root="$1" dir f
  for dir in .agents/skills .claude/agents .claude/rules; do
    [[ -d "$root/$dir" ]] || continue
    while IFS= read -r f; do
      file_in_scope "$f" && echo "$f"
    done < <(find "$root/$dir" -type f -name '*.md' | sort)
  done
}

# looks_like_repo_path TOKEN -> true for a backticked token worth existence-checking: has a `/`,
# no whitespace, no glob/placeholder markers, not a URL.
looks_like_repo_path() {
  local tok="$1"
  case "$tok" in
    *"/"*) ;;
    *) return 1 ;;
  esac
  case "$tok" in
    *" "*|*"*"*|*"<"*|*">"*|http*://*) return 1 ;;
  esac
  return 0
}

# is_planned_path PATH -> true if tools/docs/planned-paths.txt exempts PATH (exact match, or a
# "dir/" entry that PATH starts with). Always read from the real repo, not a --fixtures ROOT:
# this is maintained config, not per-check fixture content.
is_planned_path() {
  local path="$1" planned="$DOCS_CHECK_REPO_ROOT/tools/docs/planned-paths.txt" raw entry
  [[ -f "$planned" ]] || return 1
  while IFS= read -r raw; do
    raw="${raw%%#*}"
    entry="$(awk '{print $1}' <<<"$raw")"
    [[ -z "$entry" ]] && continue
    if [[ "$entry" == "$path" ]]; then return 0; fi
    if [[ "$entry" == */ && "$path" == "$entry"* ]]; then return 0; fi
  done <"$planned"
  return 1
}

# check_dc09 ROOT — every backticked repo-relative path exists (relative to ROOT), unless planned.
check_dc09() {
  local root="$1" f rel lineno content tok
  for f in $(docs_check_ref_scan_files "$root"); do
    rel="${f#"$root"/}"
    # One grep per file (lineno:`span`), not one per line: this check scans thousands of lines.
    # shellcheck disable=SC2016
    while IFS=: read -r lineno tok; do
      tok="${tok#\`}"; tok="${tok%\`}"
      looks_like_repo_path "$tok" || continue
      [[ -e "$root/$tok" ]] && continue
      is_planned_path "$tok" && continue
      finding ERROR DC-09 "$rel" "$lineno" "backticked path '$tok' does not exist"
    done < <(grep -noE '`[^`]+`' "$f" 2>/dev/null || true)
  done
  return 0
}

# check_dc10 ROOT — every `just <recipe>` token is a real recipe (`just --summary`, run against
# ROOT so a --fixtures case can supply its own tiny justfile). Skips comment lines.
check_dc10() {
  local root="$1" f rel lineno content span recipe known ok
  local -a real_recipes
  real_recipes=()
  while IFS= read -r known; do
    [[ -n "$known" ]] && real_recipes+=("$known")
  done < <(cd "$root" && just --summary 2>/dev/null | tr ' ' '\n')
  for f in $(docs_check_ref_scan_files "$root"); do
    rel="${f#"$root"/}"
    while IFS=: read -r lineno content; do
      [[ "$content" != *'`'* || "$content" != *'just '* ]] && continue
      is_comment_line "$content" && continue
      while IFS= read -r span; do
        while IFS= read -r recipe; do
          [[ -z "$recipe" ]] && continue
          [[ "$recipe" == *-'*' ]] && continue
          ok=0
          for known in "${real_recipes[@]}"; do [[ "$known" == "$recipe" ]] && ok=1 && break; done
          if [[ $ok -eq 0 ]]; then
            finding ERROR DC-10 "$rel" "$lineno" "'just $recipe' is not in 'just --summary'"
          fi
        done < <(grep -oE 'just [a-z][a-z0-9*-]*' <<<"$span" | sed -E 's/^just //')
      done < <(backticked_spans <<<"$content")
    done < <(grep -n '' "$f")
  done
  return 0
}

# check_dc11 ROOT — no raw pnpm/uv/npx/drizzle-kit/eas invocation; `just` is the only sanctioned
# entry point (doc 15 §5). Matched on a left word boundary so a banned token embedded inside a
# longer word (e.g. "eas " inside "areas ") is not a false positive.
check_dc11() {
  local root="$1" f rel lineno content pattern regex
  for f in $(docs_check_ref_scan_files "$root"); do
    rel="${f#"$root"/}"
    while IFS=: read -r lineno content; do
      for pattern in "${DOCS_CHECK_BANNED_INVOCATIONS[@]}"; do
        regex="(^|[^A-Za-z0-9_-])${pattern}"
        if [[ "$content" =~ $regex ]]; then
          finding ERROR DC-11 "$rel" "$lineno" "raw invocation '$pattern' — use a just recipe"
        fi
      done
    done < <(grep -n '' "$f")
  done
  return 0
}
