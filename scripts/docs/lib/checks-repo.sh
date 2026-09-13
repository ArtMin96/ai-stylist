#!/usr/bin/env bash
# DC-12..DC-15: repo-wide sync checks that do not belong to any single directory — the root
# PROGRESS.md pointer, banned stale vendor names, the CLAUDE.md layout block, and the doc 15 §5
# recipe catalog. Source, do not execute; depends on common.sh being sourced first.

DOCS_CHECK_BANNED_VENDORS=("Trigger.dev" "Neon" "Railway" "Cloudflare Images")

# check_dc12 ROOT — root PROGRESS.md "Current phase" id+status == its row in planning/PROGRESS.md.
check_dc12() {
  local root="$1" root_progress="$1/PROGRESS.md" ledger="$1/planning/PROGRESS.md"
  local head_line phase status ledger_line ledger_status
  [[ -f "$root_progress" ]] || { finding ERROR DC-12 "PROGRESS.md" 1 "file missing"; return; }
  [[ -f "$ledger" ]] || { finding ERROR DC-12 "planning/PROGRESS.md" 1 "file missing"; return; }

  head_line="$(grep -nE '^- \*\*P[0-9]+ ' "$root_progress" | head -n1 || true)"
  if [[ -z "$head_line" ]]; then
    finding ERROR DC-12 "PROGRESS.md" 1 "no '- **P<NN> — ...:** \`STATUS\`' current-phase line"
    return
  fi
  local lineno="${head_line%%:*}"
  # shellcheck disable=SC2016
  phase="$(sed -E 's/^[0-9]+:- \*\*(P[0-9]+) .*/\1/' <<<"$head_line")"
  # shellcheck disable=SC2016
  status="$(sed -E 's/^[0-9]+:.*—[^:]*:\*\*[[:space:]]*`([A-Z_]+)`.*/\1/' <<<"$head_line")"

  ledger_line="$(grep -E "^\| $phase \|" "$ledger" | head -n1 || true)"
  if [[ -z "$ledger_line" ]]; then
    finding ERROR DC-12 "PROGRESS.md" "$lineno" "phase '$phase' has no row in planning/PROGRESS.md's phase table"
    return
  fi
  ledger_status="$(md_table_cells "$ledger_line" | sed -n '3p' | grep -oE '[A-Z_]+' || true)"
  if [[ "$status" != "$ledger_status" ]]; then
    finding ERROR DC-12 "PROGRESS.md" "$lineno" "status '$status' != planning/PROGRESS.md row status '$ledger_status' for $phase"
  fi
  return 0
}

# check_dc13 ROOT — banned stale vendor names absent from .agents/**, .claude/**, docs/**, justfile.
# `.claude/plans/` is exempt: proposals under review legitimately discuss vendors under
# consideration. `docs/adr/` is exempt for the same reason in the other direction: ADRs are
# historical decision records that must keep naming the vendors they rejected or superseded.
check_dc13() {
  local root="$1" vendor dir f lineno content
  for vendor in "${DOCS_CHECK_BANNED_VENDORS[@]}"; do
    for dir in .agents .claude docs; do
      [[ -d "$root/$dir" ]] || continue
      while IFS= read -r f; do
        while IFS=: read -r lineno content; do
          finding ERROR DC-13 "${f#"$root"/}" "$lineno" "banned stale vendor name '$vendor': $content"
        done < <(grep -nF "$vendor" "$f")
      done < <(find "$root/$dir" -type f -name '*.md' -not -path '*/.claude/plans/*' -not -path '*/docs/adr/*' | sort)
    done
    if [[ -f "$root/justfile" ]]; then
      while IFS=: read -r lineno content; do
        finding ERROR DC-13 "justfile" "$lineno" "banned stale vendor name '$vendor': $content"
      done < <(grep -nF "$vendor" "$root/justfile")
    fi
  done
  return 0
}

# check_dc14 ROOT — WARN unless --strict: CLAUDE.md layout block vs the real top-level tree.
check_dc14() {
  local root="$1" claude_md="$1/CLAUDE.md" level line token dir_token
  level="$(level_for_strict_check)"
  [[ -f "$claude_md" ]] || { finding "$level" DC-14 "CLAUDE.md" 1 "file missing"; return; }

  local -a block_lines block_top
  block_lines=()
  while IFS= read -r line; do block_lines+=("$line"); done < <(
    awk '/^## Repository layout/{f=1;next} f && /^```/{c++; if(c==2) exit; next} f && c==1' "$claude_md"
  )

  block_top=()
  for line in "${block_lines[@]}"; do
    [[ -z "${line// /}" ]] && continue
    token="$(awk '{print $1}' <<<"$line")"
    dir_token="${token%%<*}"
    # Gitignored paths (artifacts/, node_modules/) are absent on a fresh CI checkout but must still be
    # documented when present, so they are exempt from the existence requirement only.
    if [[ -n "$dir_token" && ! -e "$root/$dir_token" ]] \
      && ! (cd "$root" && git check-ignore -q "$dir_token" 2>/dev/null); then
      finding "$level" DC-14 "CLAUDE.md" 1 "layout block path '$token' does not exist"
    fi
    block_top+=("${token%%/*}")
  done

  local entry name found t
  for entry in "$root"/*/; do
    [[ -d "$entry" ]] || continue
    name="$(basename "$entry")"
    [[ "$name" == .* ]] && continue
    found=0
    for t in "${block_top[@]}"; do [[ "$t" == "$name" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding "$level" DC-14 "CLAUDE.md" 1 "top-level directory '$name/' is not mentioned in the layout block"
    fi
  done
  return 0
}

# check_dc15 ROOT — WARN unless --strict: doc 15 §5 recipe table == `just --summary` (run
# against ROOT, so a --fixtures case supplies its own justfile + doc file, immune to the real
# repo's justfile evolving over time).
check_dc15() {
  local root="$1" doc="$1/planning/15-team-workflow-and-ai-agent-operations.md" level
  level="$(level_for_strict_check)"
  [[ -f "$doc" ]] || { finding "$level" DC-15 "planning/15-team-workflow-and-ai-agent-operations.md" 1 "file missing"; return; }

  local -a doc_recipes real_recipes
  doc_recipes=()
  local row cell name
  while IFS= read -r row; do
    cell="$(md_table_cells "$row" | head -n1)"
    name="$(first_backticked "$cell")"
    [[ "$name" == just\ * ]] || continue
    name="${name#just }"
    name="$(awk '{print $1}' <<<"$name")"
    doc_recipes+=("$name")
  done < <(md_table_data_rows "$doc" 'Recipe')

  real_recipes=()
  local r
  while IFS= read -r r; do
    [[ -n "$r" ]] && real_recipes+=("$r")
  done < <(cd "$root" && just --summary 2>/dev/null | tr ' ' '\n')

  local found n
  for n in "${real_recipes[@]}"; do
    found=0
    for r in "${doc_recipes[@]}"; do [[ "$r" == "$n" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding "$level" DC-15 "planning/15-team-workflow-and-ai-agent-operations.md" 1 "recipe '$n' (just --summary) missing from the §5 catalog"
    fi
  done
  for n in "${doc_recipes[@]}"; do
    found=0
    for r in "${real_recipes[@]}"; do [[ "$r" == "$n" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding "$level" DC-15 "planning/15-team-workflow-and-ai-agent-operations.md" 1 "§5 catalog documents 'just $n', not a real recipe"
    fi
  done
  return 0
}
