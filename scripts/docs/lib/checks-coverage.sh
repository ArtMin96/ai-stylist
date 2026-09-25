#!/usr/bin/env bash
# DC-08: every SPINE module resolves to skill detail (a references/<module>.md file, or a skill
# whose metadata.modules names it) and appears in exactly one .agents/skills/README.md coverage
# row naming an existing skill and an existing agent. Source, do not execute; depends on
# common.sh being sourced first.
#
# Every membership test below uses an explicit `if`, never a bare `cond && action` chain: under
# `set -e` (docs-check.sh), a standalone `cond && action` aborts the whole script the moment cond
# is false, because that is a simple command that just returned non-zero.

# module_has_reference_doc ROOT MODULE -> true if some skill has references/<MODULE>.md.
module_has_reference_doc() {
  local root="$1" module="$2" f
  for f in "$root"/.agents/skills/*/references/"$module".md; do
    if [[ -f "$f" ]]; then return 0; fi
  done
  return 1
}

# module_named_in_metadata ROOT MODULE -> true if some SKILL.md's metadata.modules names MODULE
# (a comma/space separated scalar, e.g. `modules: "notifications"` or `modules: "avatar, media"`).
module_named_in_metadata() {
  local root="$1" module="$2" f modules_field tok
  for f in "$root"/.agents/skills/*/SKILL.md; do
    [[ -f "$f" ]] || continue
    modules_field="$(frontmatter_subfield "$f" metadata modules)"
    [[ -z "$modules_field" ]] && continue
    for tok in ${modules_field//,/ }; do
      if [[ "$tok" == "$module" ]]; then return 0; fi
    done
  done
  return 1
}

# coverage_row_count ROOT MODULE -> number of data rows in the README coverage table whose
# first column (trimmed, plain text) equals MODULE.
coverage_row_count() {
  local root="$1" module="$2" readme="$1/.agents/skills/README.md" row cell count=0
  if [[ ! -f "$readme" ]]; then echo 0; return; fi
  while IFS= read -r row; do
    cell="$(md_table_cells "$row" | head -n1)"
    if [[ "$cell" == "$module" ]]; then count=$((count + 1)); fi
  done <<<"$(md_table_data_rows "$readme" 'Module')"
  echo "$count"
}

# coverage_row_names_are_real ROOT ROW -> true if the row's skill column (2nd) names at least one
# existing skill directory AND its agent column (4th) names at least one existing agent file.
# shellcheck disable=SC2016
coverage_row_names_are_real() {
  local root="$1" row="$2" skill_cell agent_cell name ok_skill=1 ok_agent=1
  skill_cell="$(md_table_cells "$row" | sed -n '2p')"
  agent_cell="$(md_table_cells "$row" | sed -n '4p')"

  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    if [[ -d "$root/.agents/skills/$name" ]]; then ok_skill=0; fi
  done <<<"$(grep -oE '`[a-z0-9-]+`' <<<"$skill_cell" | tr -d '`')"

  while IFS= read -r name; do
    [[ -z "$name" ]] && continue
    if [[ -f "$root/.claude/agents/$name.md" ]]; then ok_agent=0; fi
  done <<<"$(grep -oE '`[a-z0-9-]+`' <<<"$agent_cell" | tr -d '`')"

  [[ $ok_skill -eq 0 && $ok_agent -eq 0 ]]
}

# check_dc08 ROOT — always full-repo (DC-08 is not one of the five PATH-scoped checks).
check_dc08() {
  local root="$1" module count row cell found_valid_row=0
  local readme_rel=".agents/skills/README.md"

  for module in $(module_names_from_docs "$root"); do
    if ! module_has_reference_doc "$root" "$module" && ! module_named_in_metadata "$root" "$module"; then
      finding ERROR DC-08 "$readme_rel" 1 "module '$module' has no references/$module.md and no skill metadata.modules entry"
    fi

    count="$(coverage_row_count "$root" "$module")"
    if [[ "$count" -eq 0 ]]; then
      finding ERROR DC-08 "$readme_rel" 1 "module '$module' has no coverage-table row"
    elif [[ "$count" -gt 1 ]]; then
      finding ERROR DC-08 "$readme_rel" 1 "module '$module' has $count coverage-table rows, expected exactly one"
    else
      found_valid_row=0
      while IFS= read -r row; do
        cell="$(md_table_cells "$row" | head -n1)"
        [[ "$cell" != "$module" ]] && continue
        if coverage_row_names_are_real "$root" "$row"; then found_valid_row=1; fi
      done <<<"$(md_table_data_rows "$root/.agents/skills/README.md" 'Module')"
      if [[ $found_valid_row -eq 0 ]]; then
        finding ERROR DC-08 "$readme_rel" 1 "module '$module' coverage row names a skill or agent that does not exist"
      fi
    fi
  done
  return 0
}
