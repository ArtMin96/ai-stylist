#!/usr/bin/env bash
# DC-05..DC-07: skill files (.agents/skills/*/SKILL.md), the skills README/symlink roster, and
# agent files (.claude/agents/*.md) + their README roster. Source, do not execute; depends on
# common.sh being sourced first.

# The six NFR-TEAM-100 sections (.agents/skills/README.md) plus the Overlap note every skill adds.
DOCS_CHECK_SKILL_SECTIONS=(
  "Trigger" "Required reading" "Workflow" "Validation commands" "Output" "Stop / escalation" "Overlap"
)
DOCS_CHECK_SKILL_MAX_LINES=500
DOCS_CHECK_SKILL_DESC_MAX=1024
DOCS_CHECK_SKILL_NAME_PLUS_DESC_MAX=1536
DOCS_CHECK_AGENT_DESC_MAX=1024
# Subagent `color` values Claude Code accepts (https://code.claude.com/docs/en/sub-agents.md).
DOCS_CHECK_AGENT_COLORS="red blue green yellow purple orange pink cyan"
# Every agent preloads this skill (SPEC D2): the shared workflow, report format and stop rules.
DOCS_CHECK_AGENT_BASE_SKILL="agent-operating-contract"
DOCS_CHECK_AGENT_WRITE_GUARD="scripts/hooks/guard-agent-write-set.sh"
DOCS_CHECK_AGENT_BASH_GUARD="scripts/hooks/guard-agent-bash.sh"

# check_dc05 ROOT — one skill's SKILL.md against every DC-05 sub-rule (respects PATH... scoping
# via file_in_scope, common.sh).
check_dc05() {
  local root="$1" f rel dir_name fm_name description heading today
  today="$(today_date)"
  local -a skill_files
  skill_files=()
  for f in "$root"/.agents/skills/*/SKILL.md; do
    [[ -f "$f" ]] || continue
    file_in_scope "$f" || continue
    skill_files+=("$f")
  done

  for f in ${skill_files[@]+"${skill_files[@]}"}; do   # empty when no skill is in scope (bash 3.2 + set -u)
    rel="${f#"$root"/}"
    dir_name="$(basename "$(dirname "$f")")"

    fm_name="$(frontmatter_field "$f" name)"
    if [[ -z "$fm_name" ]]; then
      finding ERROR DC-05 "$rel" 1 "frontmatter 'name' missing"
    elif [[ "$fm_name" != "$dir_name" ]]; then
      finding ERROR DC-05 "$rel" 1 "frontmatter name '$fm_name' != directory name '$dir_name'"
    fi

    description="$(frontmatter_field "$f" description)"
    if [[ -z "$description" ]]; then
      finding ERROR DC-05 "$rel" 1 "frontmatter 'description' missing"
    else
      if [[ "${#description}" -gt "$DOCS_CHECK_SKILL_DESC_MAX" ]]; then
        finding ERROR DC-05 "$rel" 1 "description is ${#description} chars, max $DOCS_CHECK_SKILL_DESC_MAX"
      fi
      if [[ $(( ${#fm_name} + ${#description} )) -gt "$DOCS_CHECK_SKILL_NAME_PLUS_DESC_MAX" ]]; then
        finding ERROR DC-05 "$rel" 1 "len(name)+len(description) exceeds $DOCS_CHECK_SKILL_NAME_PLUS_DESC_MAX"
      fi
      if [[ "$description" != *"Not for"* && "$description" != *"NOT for"* ]]; then
        finding ERROR DC-05 "$rel" 1 "description has no negative-trigger marker ('Not for' / 'NOT for')"
      fi
    fi

    local reviewed
    reviewed="$(frontmatter_subfield "$f" metadata last-reviewed)"
    if [[ -z "$reviewed" ]]; then
      finding ERROR DC-05 "$rel" 1 "metadata.last-reviewed missing"
    elif ! [[ "$reviewed" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
      finding ERROR DC-05 "$rel" 1 "metadata.last-reviewed '$reviewed' is not YYYY-MM-DD"
    elif [[ "$(days_between "$reviewed" "$today")" -gt "$DOCS_CHECK_MAX_REVIEW_DAYS" ]]; then
      finding ERROR DC-05 "$rel" 1 "metadata.last-reviewed $reviewed is more than $DOCS_CHECK_MAX_REVIEW_DAYS days old"
    fi

    for heading in "${DOCS_CHECK_SKILL_SECTIONS[@]}"; do
      grep -qxF "## $heading" "$f" || finding ERROR DC-05 "$rel" 1 "missing required section heading '## $heading'"
    done

    local n_lines
    n_lines="$(wc -l <"$f" | tr -d ' ')"
    if [[ "$n_lines" -gt "$DOCS_CHECK_SKILL_MAX_LINES" ]]; then
      finding ERROR DC-05 "$rel" 1 "$n_lines lines, max $DOCS_CHECK_SKILL_MAX_LINES"
    fi

    # metadata.owner-agent: a comma list of .claude/agents/<name>.md agents, or main-session.
    local owners owner owner_line
    owners="$(frontmatter_subfield "$f" metadata owner-agent)"
    owner_line="$(line_number_of_first_match "$f" '^[[:space:]]+owner-agent:')"
    if [[ -z "$owners" ]]; then
      finding ERROR DC-05 "$rel" "$owner_line" "metadata.owner-agent missing (an agent in .claude/agents/, a comma list of them, or main-session)"
    else
      while IFS= read -r owner; do
        owner="$(awk '{$1=$1; print}' <<<"$owner")"
        [[ -z "$owner" || "$owner" == "main-session" ]] && continue
        [[ -f "$root/.claude/agents/$owner.md" ]] ||
          finding ERROR DC-05 "$rel" "$owner_line" "metadata.owner-agent '$owner' has no .claude/agents/$owner.md (use an agent name or main-session)"
      done <<<"$(tr ',' '\n' <<<"$owners")"
    fi

    local evals
    for evals in evals/evals.json evals/trigger-evals.json; do
      [[ -f "$(dirname "$f")/$evals" ]] ||
        finding ERROR DC-05 "$rel" 1 "missing $evals next to SKILL.md"
    done
  done
  return 0
}

# check_dc06 ROOT — .agents/skills/README.md table rows <-> skill directories, and the
# .claude/skills/<name> symlink for each.
check_dc06() {
  local root="$1" skills_dir="$1/.agents/skills" readme="$1/.agents/skills/README.md"
  local claude_skills="$1/.claude/skills"
  local -a dir_names readme_names
  dir_names=()
  local entry
  for entry in "$skills_dir"/*/; do
    [[ -d "$entry" ]] || continue
    dir_names+=("$(basename "$entry")")
  done

  readme_names=()
  if [[ ! -f "$readme" ]]; then
    finding ERROR DC-06 ".agents/skills/README.md" 1 "index file missing"
  else
    local row cell name
    while IFS= read -r row; do
      cell="$(md_table_cells "$row" | head -n1)"
      name="$(first_backticked "$cell")"
      [[ -n "$name" ]] && readme_names+=("$name")
    done <<<"$(md_table_data_rows "$readme" 'Skill')"
  fi

  local found name
  for name in ${dir_names[@]+"${dir_names[@]}"}; do
    found=0
    for r in ${readme_names[@]+"${readme_names[@]}"}; do [[ "$r" == "$name" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding ERROR DC-06 ".agents/skills/README.md" 1 "no index row for skill directory '$name'"
    fi
    local link="$claude_skills/$name"
    if [[ ! -L "$link" ]]; then
      finding ERROR DC-06 ".claude/skills/$name" 1 "missing or not a symlink"
    elif [[ ! -e "$link" ]]; then
      finding ERROR DC-06 ".claude/skills/$name" 1 "symlink does not resolve"
    fi
  done
  for name in ${readme_names[@]+"${readme_names[@]}"}; do
    found=0
    for d in ${dir_names[@]+"${dir_names[@]}"}; do [[ "$d" == "$name" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding ERROR DC-06 ".agents/skills/README.md" 1 "index row '$name' has no matching skill directory"
    fi
  done
  return 0
}

# matcher_covers MATCHER TOOL -> true when a hook matcher ("Edit|Write|NotebookEdit", "*", "")
# fires for TOOL.
matcher_covers() {
  local m="$1" t="$2" tok
  [[ -z "$m" || "$m" == "*" ]] && return 0
  local -a toks
  IFS='|' read -r -a toks <<<"$m"
  for tok in "${toks[@]}"; do [[ "$tok" == "$t" ]] && return 0; done
  return 1
}

# agent_has_guard FILE SCRIPT TOOL... -> true when FILE's frontmatter has a PreToolUse hook running
# SCRIPT whose matcher covers every TOOL.
agent_has_guard() {
  local file="$1" script="$2" ev matcher cmd t ok
  shift 2
  while IFS=$'\t' read -r ev matcher cmd; do
    [[ "$ev" == "PreToolUse" && "$cmd" == *"/$script" ]] || continue
    ok=1
    for t in "$@"; do matcher_covers "$matcher" "$t" || ok=0; done
    [[ $ok -eq 1 ]] && return 0
  done <<<"$(frontmatter_hook_commands "$file")"
  return 1
}

# check_dc07_frontmatter ROOT FILE REL — the SPEC D2 frontmatter standard for one agent: a valid
# color; plain tool names (a `Bash(...)` specifier does not restrict Bash); Edit/Write/NotebookEdit
# ⇒ a guard-agent-write-set.sh PreToolUse hook; Bash ⇒ a guard-agent-bash.sh PreToolUse hook;
# skills: preloads agent-operating-contract and names only real .agents/skills/<name>/ skills.
check_dc07_frontmatter() {
  local root="$1" f="$2" rel="$3" color tool skill line has_base=0
  local -a tools writes skills
  color="$(frontmatter_field "$f" color)"
  line="$(line_number_of_first_match "$f" '^color:')"
  if [[ -z "$color" ]]; then
    finding ERROR DC-07 "$rel" 1 "frontmatter 'color' missing (one of: $DOCS_CHECK_AGENT_COLORS)"
  elif ! grep -qw -- "$color" <<<"$DOCS_CHECK_AGENT_COLORS" || [[ "$color" == *[!a-z]* ]]; then
    finding ERROR DC-07 "$rel" "$line" "color '$color' is not one of: $DOCS_CHECK_AGENT_COLORS"
  fi

  tools=() writes=()
  while IFS= read -r tool; do [[ -n "$tool" ]] && tools+=("$tool"); done <<<"$(frontmatter_list "$f" tools)"
  line="$(line_number_of_first_match "$f" '^tools:')"
  if [[ ${#tools[@]} -eq 0 ]]; then
    finding ERROR DC-07 "$rel" 1 "frontmatter 'tools' missing"
  fi
  local has_bash=0
  for tool in ${tools[@]+"${tools[@]}"}; do
    if [[ "$tool" == *"("* ]]; then
      finding ERROR DC-07 "$rel" "$line" "tools entry '$tool' has a '(...)' specifier: tools takes plain names (limit Bash with the $DOCS_CHECK_AGENT_BASH_GUARD hook)"
    fi
    case "$tool" in
      Edit | Write | NotebookEdit) writes+=("$tool") ;;
      Bash | "Bash("*) has_bash=1 ;;
    esac
  done
  if [[ ${#writes[@]} -gt 0 ]] && ! agent_has_guard "$f" "$DOCS_CHECK_AGENT_WRITE_GUARD" "${writes[@]}"; then
    finding ERROR DC-07 "$rel" "$line" "tools has ${writes[*]} but no PreToolUse hook runs $DOCS_CHECK_AGENT_WRITE_GUARD with a matcher covering them"
  fi
  if [[ $has_bash -eq 1 ]] && ! agent_has_guard "$f" "$DOCS_CHECK_AGENT_BASH_GUARD" Bash; then
    finding ERROR DC-07 "$rel" "$line" "tools has Bash but no PreToolUse hook runs $DOCS_CHECK_AGENT_BASH_GUARD with a matcher covering Bash"
  fi

  skills=()
  while IFS= read -r skill; do [[ -n "$skill" ]] && skills+=("$skill"); done <<<"$(frontmatter_list "$f" skills)"
  line="$(line_number_of_first_match "$f" '^skills:')"
  for skill in ${skills[@]+"${skills[@]}"}; do
    [[ "$skill" == "$DOCS_CHECK_AGENT_BASE_SKILL" ]] && has_base=1
    [[ -f "$root/.agents/skills/$skill/SKILL.md" ]] ||
      finding ERROR DC-07 "$rel" "$line" "skills entry '$skill' has no .agents/skills/$skill/SKILL.md"
  done
  if [[ $has_base -eq 0 ]]; then
    finding ERROR DC-07 "$rel" "$line" "skills: must preload '$DOCS_CHECK_AGENT_BASE_SKILL'"
  fi
}

# check_dc07 ROOT — .claude/agents/*.md against every DC-07 sub-rule, plus README sync (respects
# PATH... scoping via file_in_scope, common.sh — README sync always runs in full since it is not
# meaningful to check half a roster).
check_dc07() {
  local root="$1" agents_dir="$1/.claude/agents" readme="$1/.claude/agents/README.md"
  local -a agent_files agent_names readme_names
  agent_files=()
  local f
  for f in "$agents_dir"/*.md; do
    [[ -f "$f" ]] || continue
    [[ "$(basename "$f")" == "README.md" ]] && continue
    file_in_scope "$f" || continue
    agent_files+=("$f")
  done

  local rel name description reviewed_line reviewed today
  today="$(today_date)"
  agent_names=()
  for f in ${agent_files[@]+"${agent_files[@]}"}; do   # empty when no agent is in scope (bash 3.2 + set -u)
    rel="${f#"$root"/}"
    name="$(frontmatter_field "$f" name)"
    [[ -n "$name" ]] && agent_names+=("$name")
    [[ -z "$name" ]] && finding ERROR DC-07 "$rel" 1 "frontmatter 'name' missing"

    description="$(frontmatter_field "$f" description)"
    if [[ -z "$description" ]]; then
      finding ERROR DC-07 "$rel" 1 "frontmatter 'description' missing"
    elif [[ "${#description}" -gt "$DOCS_CHECK_AGENT_DESC_MAX" ]]; then
      finding ERROR DC-07 "$rel" 1 "description is ${#description} chars, max $DOCS_CHECK_AGENT_DESC_MAX"
    fi

    check_dc07_frontmatter "$root" "$f" "$rel"

    reviewed_line="$(grep -nE '^Last reviewed:' "$f" | head -n1 || true)"
    if [[ -z "$reviewed_line" ]]; then
      finding ERROR DC-07 "$rel" 1 "no 'Last reviewed: YYYY-MM-DD' line"
    else
      reviewed="$(sed -E 's/^[0-9]+:Last reviewed:[[:space:]]*//' <<<"$reviewed_line" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
      local line="${reviewed_line%%:*}"
      if [[ -z "$reviewed" ]]; then
        finding ERROR DC-07 "$rel" "$line" "'Last reviewed' is not a YYYY-MM-DD date"
      elif [[ "$(days_between "$reviewed" "$today")" -gt "$DOCS_CHECK_MAX_REVIEW_DAYS" ]]; then
        finding ERROR DC-07 "$rel" "$line" "Last reviewed $reviewed is more than $DOCS_CHECK_MAX_REVIEW_DAYS days old"
      fi
    fi
  done

  readme_names=()
  if [[ ! -f "$readme" ]]; then
    finding ERROR DC-07 ".claude/agents/README.md" 1 "index file missing"
  else
    local row cell rname
    while IFS= read -r row; do
      cell="$(md_table_cells "$row" | head -n1)"
      rname="$(first_backticked "$cell")"
      [[ -n "$rname" ]] && readme_names+=("$rname")
    done <<<"$(md_table_data_rows "$readme" 'Agent')"
  fi

  local found n
  for n in ${agent_names[@]+"${agent_names[@]}"}; do
    found=0
    for r in ${readme_names[@]+"${readme_names[@]}"}; do [[ "$r" == "$n" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding ERROR DC-07 ".claude/agents/README.md" 1 "no index row for agent '$n'"
    fi
  done
  # The reverse direction (README row with no matching file) only makes sense against the full
  # roster: a PATH-scoped run loaded a subset of agent_files on purpose (file_in_scope above).
  if [[ "${#DOCS_CHECK_PATH_FILTERS[@]}" -eq 0 ]]; then
    for n in ${readme_names[@]+"${readme_names[@]}"}; do
      found=0
      for a in ${agent_names[@]+"${agent_names[@]}"}; do [[ "$a" == "$n" ]] && found=1 && break; done
      if [[ $found -eq 0 ]]; then
        finding ERROR DC-07 ".claude/agents/README.md" 1 "index row '$n' has no matching .claude/agents/$n.md"
      fi
    done
  fi
  return 0
}
