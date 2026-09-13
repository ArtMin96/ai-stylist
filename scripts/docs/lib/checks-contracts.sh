#!/usr/bin/env bash
# DC-01..DC-04: module contracts (docs/modules/*.md) and ADRs (docs/adr/*.md), checked against
# apps/api/src/modules/*, templates/module-contract.md, and docs/adr/README.md. Source, do not
# execute; depends on common.sh being sourced first.

# The 8 `##` headings templates/module-contract.md defines, in order (DC-02 "in order").
DOCS_CHECK_CONTRACT_HEADINGS=(
  "Public interface" "Owned data" "Invariants" "Events"
  "Dependencies (allowed)" "Forbidden dependencies" "Tests" "Extension points"
)
DOCS_CHECK_CONTRACT_STATUSES="skeleton draft ratified"

# check_dc01 ROOT — module <-> contract bijection.
check_dc01() {
  local root="$1" name found
  local -a code_names doc_names
  code_names=()
  local entry
  for entry in "$root"/apps/api/src/modules/*/; do
    [[ -d "$entry" ]] || continue
    code_names+=("$(basename "$entry")")
  done
  code_names+=("platform" "shared-kernel")

  doc_names=()
  while IFS= read -r name; do doc_names+=("$name"); done < <(module_names_from_docs "$root")

  for name in "${code_names[@]}"; do
    found=0
    for d in "${doc_names[@]}"; do [[ "$d" == "$name" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding ERROR DC-01 "docs/modules/$name.md" 1 "no module contract for '$name' (apps/api/src/modules or platform/shared-kernel)"
    fi
  done
  for name in "${doc_names[@]}"; do
    found=0
    for c in "${code_names[@]}"; do [[ "$c" == "$name" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding ERROR DC-01 "docs/modules/$name.md" 1 "contract has no matching module '$name' under apps/api/src/modules (or platform/shared-kernel)"
    fi
  done
  return 0
}

# check_dc02 ROOT — every docs/modules/*.md has the 8 template headings, in order.
check_dc02() {
  local root="$1" f rel heading line
  local -a present
  for f in $(list_md_files "$root/docs/modules"); do
    rel="docs/modules/$(basename "$f")"
    present=()
    for heading in "${DOCS_CHECK_CONTRACT_HEADINGS[@]}"; do
      if grep -qxF "## $heading" "$f"; then
        present+=("$heading")
      else
        finding ERROR DC-02 "$rel" 1 "missing required heading '## $heading'"
      fi
    done
    if [[ "${#present[@]}" -eq "${#DOCS_CHECK_CONTRACT_HEADINGS[@]}" ]]; then
      local order_ok=1 idx=0
      for heading in "${DOCS_CHECK_CONTRACT_HEADINGS[@]}"; do
        if [[ "${present[$idx]}" != "$heading" ]]; then order_ok=0; break; fi
        idx=$((idx + 1))
      done
      if [[ $order_ok -eq 0 ]]; then
        line="$(line_number_of_first_match "$f" '^## ')"
        finding ERROR DC-02 "$rel" "$line" "template headings present but out of order (expected: ${DOCS_CHECK_CONTRACT_HEADINGS[*]})"
      fi
    fi
  done
  return 0
}

# check_dc03 ROOT — Status enum + Last-updated date not older than the module's code.
check_dc03() {
  local root="$1" f rel name status_line status_word last_line last_date code_date line
  for f in $(list_md_files "$root/docs/modules"); do
    name="$(basename "$f" .md)"
    rel="docs/modules/$(basename "$f")"

    status_line="$(grep -nE '\*\*Status:\*\*' "$f" | head -n1 || true)"
    if [[ -z "$status_line" ]]; then
      finding ERROR DC-03 "$rel" 1 "missing '**Status:**' field"
    else
      line="${status_line%%:*}"
      status_word="$(sed -E 's/^[0-9]+:.*\*\*Status:\*\*[[:space:]]*//' <<<"$status_line" | awk '{print $1}')"
      if ! grep -qw "$status_word" <<<"$DOCS_CHECK_CONTRACT_STATUSES"; then
        finding ERROR DC-03 "$rel" "$line" "Status '$status_word' not one of: $DOCS_CHECK_CONTRACT_STATUSES"
      fi
    fi

    last_line="$(grep -nE '\*\*Last updated:\*\*' "$f" | head -n1 || true)"
    if [[ -z "$last_line" ]]; then
      finding ERROR DC-03 "$rel" 1 "missing '**Last updated:**' field"
      continue
    fi
    line="${last_line%%:*}"
    last_date="$(sed -E 's/^[0-9]+:.*\*\*Last updated:\*\*[[:space:]]*//' <<<"$last_line" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
    if [[ -z "$last_date" ]]; then
      finding ERROR DC-03 "$rel" "$line" "'Last updated' is not a YYYY-MM-DD date"
      continue
    fi

    code_date="$(git_or_mtime_date "$root" "apps/api/src/modules/$name/index.ts" "apps/api/src/modules/$name/internal/schema.ts")"
    if [[ -n "$code_date" && "$last_date" < "$code_date" ]]; then
      finding ERROR DC-03 "$rel" "$line" "Last updated ($last_date) predates the module's last code change ($code_date)"
    fi
  done
  return 0
}

# check_dc04 ROOT — docs/adr/NNNN-*.md <-> docs/adr/README.md index rows, both directions.
check_dc04() {
  local root="$1" adr_dir="$1/docs/adr" readme="$1/docs/adr/README.md" f base num found
  local -a adr_nums readme_nums
  adr_nums=()
  if [[ -d "$adr_dir" ]]; then
    while IFS= read -r f; do
      base="$(basename "$f")"
      [[ "$base" == "README.md" ]] && continue
      num="${base%%-*}"
      adr_nums+=("$num")
    done < <(list_md_files "$adr_dir")
  fi

  readme_nums=()
  if [[ -f "$readme" ]]; then
    while IFS= read -r num; do readme_nums+=("$num"); done < <(
      grep -oE '\[[0-9]{4}\]\([0-9]{4}-[a-z0-9-]+\.md\)' "$readme" | grep -oE '^\[[0-9]{4}' | tr -d '['
    )
  else
    finding ERROR DC-04 "docs/adr/README.md" 1 "index file missing"
    return
  fi

  for num in "${adr_nums[@]}"; do
    found=0
    for r in "${readme_nums[@]}"; do [[ "$r" == "$num" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding ERROR DC-04 "docs/adr/README.md" 1 "ADR $num has no index row in docs/adr/README.md"
    fi
  done
  for num in "${readme_nums[@]}"; do
    found=0
    for a in "${adr_nums[@]}"; do [[ "$a" == "$num" ]] && found=1 && break; done
    if [[ $found -eq 0 ]]; then
      finding ERROR DC-04 "docs/adr/README.md" 1 "index row references ADR $num, no such docs/adr/$num-*.md file"
    fi
  done
  return 0
}
