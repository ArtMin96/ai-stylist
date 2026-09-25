#!/usr/bin/env bash
# Shared helpers for scripts/docs/docs-check.sh and its lib/checks-*.sh files. Source, do not
# execute. Mirrors scripts/lib.sh house style (bash-3.2-clean; no associative arrays).
#   source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# The real repository root, independent of ROOT (which --fixtures overrides per check).
# shellcheck disable=SC2034
DOCS_CHECK_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# DC-05/DC-07: a `metadata.last-reviewed` / `Last reviewed:` date older than this many days fails
# (plan "Risks & decisions": "last-reviewed window is 180 days").
# shellcheck disable=SC2034
DOCS_CHECK_MAX_REVIEW_DAYS=180

# --- finding output (docs-check.sh CLI contract) --------------------------------------
# One line per finding: "<LEVEL> <CHECK-ID> <file>:<line> <message>". LEVEL is ERROR or WARN.
DOCS_CHECK_ERRORS=0
DOCS_CHECK_WARNINGS=0

# finding LEVEL CHECK-ID FILE LINE MESSAGE...
finding() {
  local level="$1" check_id="$2" file="$3" line="$4"
  shift 4
  case "$level" in
    ERROR) DOCS_CHECK_ERRORS=$((DOCS_CHECK_ERRORS + 1)) ;;
    WARN)  DOCS_CHECK_WARNINGS=$((DOCS_CHECK_WARNINGS + 1)) ;;
    *) echo "finding: unknown level '$level' (want ERROR|WARN)" >&2; exit 2 ;;
  esac
  printf '%s %s %s:%s %s\n' "$level" "$check_id" "$file" "$line" "$*"
}

# Reset finding counters before a fresh check run (docs-check.sh's normal run, and once per
# --fixtures case so each fixture's pass/fail is judged independently).
docs_check_reset_counters() {
  DOCS_CHECK_ERRORS=0
  DOCS_CHECK_WARNINGS=0
}

# level_for_strict_check CHECK-ID — DC-14/DC-15 depend on human-approved edits (CLAUDE.md layout
# block, doc 15 §5 catalog): WARN by default, ERROR under --strict (plan "Risks & decisions").
# shellcheck disable=SC2120
level_for_strict_check() {
  if [[ "${DOCS_CHECK_STRICT:-0}" == "1" ]]; then echo ERROR; else echo WARN; fi
}

# --- portable date helpers (macOS ships BSD date; Linux CI ships GNU date) ------------------
# date_to_epoch YYYY-MM-DD -> epoch seconds
date_to_epoch() {
  if date -d "$1" +%s >/dev/null 2>&1; then
    date -d "$1" +%s
  else
    date -j -f '%Y-%m-%d' "$1" +%s
  fi
}

# days_between YYYY-MM-DD YYYY-MM-DD -> whole days, second minus first (negative if first is later)
days_between() {
  local from_epoch to_epoch
  from_epoch="$(date_to_epoch "$1")"
  to_epoch="$(date_to_epoch "$2")"
  echo $(( (to_epoch - from_epoch) / 86400 ))
}

# today_date -> YYYY-MM-DD, overridable via DOCS_CHECK_TODAY for deterministic --fixtures runs.
today_date() {
  echo "${DOCS_CHECK_TODAY:-$(date +%Y-%m-%d)}"
}

# file_mtime_date PATH -> YYYY-MM-DD of the file's filesystem mtime (GNU stat vs BSD stat).
file_mtime_date() {
  local epoch
  if stat -c %Y "$1" >/dev/null 2>&1; then
    epoch="$(stat -c %Y "$1")"
  else
    epoch="$(stat -f %m "$1")"
  fi
  if date -d @0 >/dev/null 2>&1; then
    date -d "@$epoch" +%Y-%m-%d
  else
    date -r "$epoch" +%Y-%m-%d
  fi
}

# git_or_mtime_date REPO_ROOT PATH... -> YYYY-MM-DD of the newest commit touching any PATH
# (relative to REPO_ROOT), falling back to the newest filesystem mtime when git has no history
# for it yet (fixture fixtures are on-disk but uncommitted; DC-03 must still be exercisable).
git_or_mtime_date() {
  local repo_root="$1"
  shift
  local newest="" candidate path
  for path in "$@"; do
    if [[ ! -e "$repo_root/$path" ]]; then continue; fi
    candidate="$(cd "$repo_root" && git log -1 --format=%cs -- "$path" 2>/dev/null || true)"
    if [[ -z "$candidate" ]]; then candidate="$(file_mtime_date "$repo_root/$path")"; fi
    if [[ -z "$newest" || "$candidate" > "$newest" ]]; then newest="$candidate"; fi
  done
  echo "$newest"
}

# git_is_shallow REPO_ROOT -> exit 0 when REPO_ROOT is a shallow clone (e.g. actions/checkout's
# default fetch-depth: 1). There, `git log -1 -- PATH` returns the one grafted commit for every
# tracked PATH, so any history-derived date (DC-03) would be silently wrong. Not a git repo -> 1.
git_is_shallow() {
  [[ "$(git -C "$1" rev-parse --is-shallow-repository 2>/dev/null || true)" == "true" ]]
}

# --- markdown/frontmatter helpers ------------------------------------------------------
# frontmatter_field FILE KEY -> the scalar value of a top-level "key: value" line inside the
# leading "---" ... "---" YAML frontmatter block, without one pair of surrounding single or double
# quotes (prettier's singleQuote rewrites "2026-09-25" to '2026-09-25'). Empty if absent. Values
# are not otherwise YAML-parsed (no nested structures besides `metadata:`, handled separately).
frontmatter_field() {
  local file="$1" key="$2"
  awk -v key="$key" -v sq="'" '
    NR == 1 && $0 == "---" { infm = 1; next }
    infm && $0 == "---" { exit }
    infm && $0 ~ "^" key ":" {
      sub("^" key ":[ ]*", "")
      if (length($0) >= 2 && (($0 ~ /^".*"$/) || (substr($0, 1, 1) == sq && substr($0, length($0), 1) == sq)))
        $0 = substr($0, 2, length($0) - 2)
      print
      exit
    }
  ' "$file"
}

# frontmatter_subfield FILE PARENT-KEY CHILD-KEY -> value of an indented "child: value" line
# nested under a top-level "parent:" mapping (e.g. metadata.last-reviewed, metadata.modules),
# without one pair of surrounding single or double quotes.
frontmatter_subfield() {
  local file="$1" parent="$2" key="$3"
  awk -v parent="$parent" -v key="$key" -v sq="'" '
    NR == 1 && $0 == "---" { infm = 1; next }
    infm && $0 == "---" { exit }
    infm && $0 ~ "^" parent ":" { inparent = 1; next }
    infm && inparent && $0 ~ "^[^ ]" { inparent = 0 }
    infm && inparent && $0 ~ "^[ ]+" key ":" {
      sub("^[ ]+" key ":[ ]*", "")
      if (length($0) >= 2 && (($0 ~ /^".*"$/) || (substr($0, 1, 1) == sq && substr($0, length($0), 1) == sq)))
        $0 = substr($0, 2, length($0) - 2)
      print
      exit
    }
  ' "$file"
}

# frontmatter_list FILE KEY -> the items of a top-level list field, one per line, from any of the
# three YAML spellings used here: "key: a, b", "key: [a, b]", or a block of "  - a" lines under
# "key:". Surrounding quotes and trailing " # comments" are stripped.
frontmatter_list() {
  local file="$1" key="$2"
  awk -v key="$key" -v sq="'" '
    function emit(v) {
      sub(/[ \t]+#.*$/, "", v)
      gsub(/^[ \t]+|[ \t]+$/, "", v)
      gsub("^[\"" sq "]|[\"" sq "]$", "", v)
      if (v != "") print v
    }
    NR == 1 && $0 == "---" { infm = 1; next }
    infm && $0 == "---" { exit }
    infm && inlist {
      if ($0 ~ /^[ \t]*-[ \t]/) { v = $0; sub(/^[ \t]*-[ \t]+/, "", v); emit(v); next }
      if ($0 ~ /^[ \t]*(#.*)?$/) next
      exit
    }
    infm && $0 ~ "^" key ":" {
      v = $0
      sub("^" key ":[ \t]*", "", v)
      sub(/[ \t]+#.*$/, "", v)
      if (v == "") { inlist = 1; next }
      gsub(/^\[|\][ \t]*$/, "", v)
      n = split(v, parts, ",")
      for (i = 1; i <= n; i++) emit(parts[i])
      exit
    }
  ' "$file"
}

# frontmatter_hook_commands FILE -> "<event>\t<matcher>\t<command>" for every hook command in the
# frontmatter `hooks:` block (agent-scoped hooks; same schema as .claude/settings.json). An event
# is a capitalised key (PreToolUse, Stop, ...); the matcher is the nearest preceding `matcher:`
# under that event.
frontmatter_hook_commands() {
  awk -v sq="'" '
    function unq(v) {
      sub(/[ \t]+#.*$/, "", v)
      gsub(/^[ \t]+|[ \t]+$/, "", v)
      gsub("^[\"" sq "]|[\"" sq "]$", "", v)
      return v
    }
    NR == 1 && $0 == "---" { infm = 1; next }
    infm && $0 == "---" { exit }
    infm && /^hooks:[ \t]*$/ { inh = 1; next }
    infm && inh && /^[^ \t#]/ { inh = 0 }
    infm && inh && /^[ \t]+[A-Z][A-Za-z]*:[ \t]*$/ { ev = $0; gsub(/[ \t:]/, "", ev); matcher = ""; next }
    infm && inh && /matcher:/ { m = $0; sub(/.*matcher:/, "", m); matcher = unq(m); next }
    # Empty fields become "?" / "*" (an empty matcher matches every tool): `read` collapses tabs.
    infm && inh && /[ \t-]command:/ {
      c = $0
      sub(/.*command:/, "", c)
      print (ev == "" ? "?" : ev) "\t" (matcher == "" ? "*" : matcher) "\t" unq(c)
    }
  ' "$1"
}

# --- PATH-arg scoping (docs-check.sh PATH... narrows the five file-scoped checks) -----------
# Absolute paths given on the CLI; empty means "no scoping, check everything".
DOCS_CHECK_PATH_FILTERS=()

# abspath PATH -> absolute form, without requiring the path to exist (PATH... args are real
# files in normal use, but a --fixtures run should never depend on cwd tricks failing quietly).
abspath() {
  local p="$1"
  case "$p" in
    /*) echo "$p"; return ;;
  esac
  echo "$(pwd)/$p"
}

# file_in_scope FILE -> true (0) when no PATH filters are set, or FILE is one of / lives under
# one of them. FILE and every DOCS_CHECK_PATH_FILTERS entry must already be absolute.
file_in_scope() {
  local file="$1" filt
  [[ "${#DOCS_CHECK_PATH_FILTERS[@]}" -eq 0 ]] && return 0
  for filt in "${DOCS_CHECK_PATH_FILTERS[@]}"; do
    [[ "$file" == "$filt" || "$file" == "$filt"/* ]] && return 0
  done
  return 1
}

# line_number_of_first_match FILE PATTERN(ERE) -> 1-based line number, or 1 if not found (a
# finding always needs a line to print; the file's first line is the reasonable fallback for a
# missing-thing violation).
line_number_of_first_match() {
  local file="$1" pattern="$2" n
  n="$(grep -nE "$pattern" "$file" 2>/dev/null | head -n1 | cut -d: -f1 || true)"
  echo "${n:-1}"
}

# is_comment_line LINE -> true if the first non-space character is '#' (DC-10: skip comment
# lines so a TODO mentioning a not-yet-existing recipe is not manufactured into a bug).
is_comment_line() {
  [[ "$1" =~ ^[[:space:]]*# ]]
}

# backticked_spans <<<TEXT -> every `...` span's content on stdin, one per line (order
# preserved, may repeat). Every caller feeds it one line via a here-string.
# shellcheck disable=SC2016
backticked_spans() {
  grep -oE '`[^`]+`' 2>/dev/null | sed -e 's/^`//' -e 's/`$//' || true
}

# list_md_files DIR -> every *.md file directly inside DIR (non-recursive; every domain this
# checker scans is a flat directory of *.md or one level of <name>/SKILL.md).
list_md_files() {
  [[ -d "$1" ]] || return 0
  find "$1" -maxdepth 1 -type f -name '*.md' | sort
}

# list_repo_files ROOT DIR NAME-GLOB -> every regular (non-symlink) file under ROOT/DIR, recursive,
# whose basename matches NAME-GLOB, as sorted absolute paths — excluding anything git ignores.
# This is the single enumeration every recursive content scan (DC-09/10/11, DC-13) goes through,
# so gitignored copies of the repo (`.claude/worktrees/<agent>/`, one per parallel agent session)
# and build output are never scanned. When ROOT is not a git work tree (no worktrees can exist
# there) it falls back to plain find; --fixtures `git init`s each staged case so fixtures take the
# same git path the real repo does.
list_repo_files() {
  local root="$1" dir="$2" glob="$3" rel
  [[ -d "$root/$dir" ]] || return 0
  if (cd "$root" && git rev-parse --is-inside-work-tree >/dev/null 2>&1); then
    (cd "$root" && git -c core.quotePath=false ls-files --cached --others --exclude-standard -- "$dir") \
      | sort -u \
      | while IFS= read -r rel; do
          # shellcheck disable=SC2254  # NAME-GLOB is a pattern on purpose
          case "${rel##*/}" in $glob) ;; *) continue ;; esac
          if [[ -f "$root/$rel" && ! -L "$root/$rel" ]]; then echo "$root/$rel"; fi
        done
  else
    find "$root/$dir" -type f -name "$glob" | sort
  fi
}

# module_names_from_docs ROOT ->the SPINE module names, one per line, derived from
# docs/modules/*.md (DC-01 keeps this bijective with apps/api/src/modules + platform +
# shared-kernel, so this listing is the single source of truth DC-08 also reuses).
module_names_from_docs() {
  local root="$1" f
  for f in $(list_md_files "$root/docs/modules"); do
    basename "$f" .md
  done
}

# md_table_cells LINE -> each pipe-delimited cell, trimmed, one per output line. Handles both
# "| a | b |" and "a | b" rows (a leading/trailing "|" is optional and stripped either way).
md_table_cells() {
  local line="$1"
  line="${line#|}"
  line="${line%|}"
  awk -F'|' '{ for (i = 1; i <= NF; i++) { gsub(/^[ \t]+|[ \t]+$/, "", $i); print $i } }' <<<"$line"
}

# first_backticked SPAN_SOURCE -> the content of the first `...` span, or empty.
# shellcheck disable=SC2016
first_backticked() {
  grep -oE '`[^`]+`' <<<"$1" 2>/dev/null | head -n1 | sed -e 's/^`//' -e 's/`$//' || true
}

# md_table_data_rows FILE COLUMN-NAME -> the raw "| ... |" data-row lines of the first markdown
# table in FILE whose header row's first column (trimmed) is exactly COLUMN-NAME, stopping at the
# first line after the "|---|---|" separator that does not start with "|". COLUMN-NAME is passed
# through -v (a plain word, e.g. "Module"); the "|" anchors are literals baked into the awk
# program text, not into a -v value — a "|" arriving via -v goes through awk's string-escape
# processing first, which strips a lone backslash and turns the "|" into regex alternation.
md_table_data_rows() {
  local file="$1" column="$2"
  awk -v col="$column" '
    BEGIN { found = 0; sep = 0; hre = "^\\|[[:space:]]*" col "[[:space:]]*\\|" }
    found == 0 { if ($0 ~ hre) { found = 1 }; next }
    found == 1 && sep == 0 { sep = 1; next }
    found == 1 && sep == 1 {
      if ($0 !~ /^\|/) { exit }
      print
    }
  ' "$file"
}
