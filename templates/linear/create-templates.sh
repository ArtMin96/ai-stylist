#!/usr/bin/env bash
# Create (or update) the AI Stylist issue templates in Linear from templates/linear/*.md.
#
# Source of truth is this directory; Linear holds a copy. Re-run with --update to re-sync.
#
# Requirements: bash 3.2+, curl, jq. LINEAR_API_KEY must be in the environment
# (personal API key from Linear → Settings → Security & access → Personal API keys).
# Never put the key in a file inside this repo.
#
# Usage:
#   templates/linear/create-templates.sh [--team "AI Stylist"] [--update] [--dry-run] [--only 01]
#   Key: LINEAR_API_KEY env, else ~/.config/ai-stylist/linear-api-key (0600, outside the repo).
#
# Verification status (2026-09-11, against the public schema at
# https://raw.githubusercontent.com/linear/linear/master/packages/sdk/src/schema.graphql):
#   VERIFIED   mutation templateCreate(input: TemplateCreateInput!) → TemplatePayload { success template { id name } }
#              TemplateCreateInput { name: String!, type: String!, templateData: JSON!, teamId, description, sortOrder }
#   VERIFIED   mutation templateUpdate(id: String!, input: TemplateUpdateInput!)
#   VERIFIED   queries teams(filter: {name: {eq}}), issueLabels(filter: {name: {eq}}), templates
#   VERIFIED   templateData keys {description, labelIds, priority}: all 8 templates created 2026-09-11
#              and read back via the Linear MCP get_template with body, label and priority intact.
# shellcheck disable=SC2016  # GraphQL variables ($name, $input) are meant to stay literal
set -euo pipefail

API_URL="https://api.linear.app/graphql"
TEAM_NAME="AI Stylist"
UPDATE=0
DRY_RUN=0
ONLY=""
HERE="$(cd "$(dirname "$0")" && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --team) TEAM_NAME="$2"; shift 2 ;;
    --update) UPDATE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --only) ONLY="$2"; shift 2 ;;   # file-name prefix, e.g. --only 01
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# Key source: the environment, else a 0600 file outside the repo (default ~/.config/ai-stylist/linear-api-key).
LINEAR_API_KEY_FILE="${LINEAR_API_KEY_FILE:-$HOME/.config/ai-stylist/linear-api-key}"
if [ -z "${LINEAR_API_KEY:-}" ] && [ -r "$LINEAR_API_KEY_FILE" ]; then
  LINEAR_API_KEY="$(tr -d '[:space:]' < "$LINEAR_API_KEY_FILE")"
fi
if [ -z "${LINEAR_API_KEY:-}" ]; then
  echo "LINEAR_API_KEY is not set and $LINEAR_API_KEY_FILE is not readable." >&2
  echo "Create a personal API key in Linear (Settings > Security & access > Personal API keys) and store it:" >&2
  echo "  mkdir -p ~/.config/ai-stylist && chmod 700 ~/.config/ai-stylist" >&2
  echo "  printf '%s' '<key>' > ~/.config/ai-stylist/linear-api-key && chmod 600 ~/.config/ai-stylist/linear-api-key" >&2
  exit 1
fi
for tool in curl jq; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing dependency: $tool" >&2; exit 1; }
done

# gql <query> <variables-json>  → prints the JSON response; fails on GraphQL errors.
gql() {
  local payload response
  payload="$(jq -cn --arg q "$1" --argjson v "$2" '{query: $q, variables: $v}')"
  response="$(curl -sS -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: ${LINEAR_API_KEY}" \
    --data "$payload")"
  if [ "$(printf '%s' "$response" | jq -r '.errors // empty | length')" != "" ]; then
    echo "GraphQL error: $(printf '%s' "$response" | jq -c '.errors')" >&2
    return 1
  fi
  printf '%s' "$response"
}

# file → template name → label name. One line per template, tab-free, '|'-separated.
MANIFEST='
01-feature.md|1 · Feature|type:feature|User-facing capability (thin end-to-end slice)
02-bug.md|2 · Bug|type:bug|Defect; regression test must fail before the fix
03-improvement.md|3 · Improvement / Tech debt|type:improvement|Refactor, perf, DX; no user-visible behaviour change
04-spike.md|4 · Spike / Research|type:spike|Time-boxed question; output is a doc/ADR, no production code
05-contract-change.md|5 · Contract change|type:contract|OpenAPI / event schema / shared-kernel registry; producer before consumer
06-migration.md|6 · Migration|type:migration|DB schema change: expand–contract, down file, Testcontainers + scratch database
07-security-review.md|7 · Security / privacy review|type:security|Auth, consent, deletion, webhooks; security-privacy-review skill
08-chore.md|8 · Chore / Ops|type:chore|Accounts, CI, tooling; human-only steps and secret names
'

echo "→ Resolving team '${TEAM_NAME}'"
TEAM_ID="$(gql 'query($name: String!) { teams(filter: {name: {eq: $name}}) { nodes { id name key } } }' \
  "$(jq -cn --arg name "$TEAM_NAME" '{name: $name}')" | jq -r '.data.teams.nodes[0].id // empty')"
if [ -z "$TEAM_ID" ]; then
  echo "team '${TEAM_NAME}' not found. Teams visible to this key:" >&2
  gql '{ teams { nodes { id name key } } }' '{}' | jq -r '.data.teams.nodes[] | "  \(.name) (\(.key)) \(.id)"' >&2
  exit 1
fi
echo "  team id: ${TEAM_ID}"

EXISTING="$(gql '{ templates { id name type team { id } } }' '{}')"

build_template_data() { # <markdown-file> <label-id>
  jq -Rs --arg label "$2" '{description: ., labelIds: (if $label == "" then [] else [$label] end), priority: 0}' "$1"
}

printf '%s\n' "$MANIFEST" | sed '/^$/d' | while IFS='|' read -r file name label desc; do
  if [ -n "${ONLY:-}" ]; then case "$file" in "$ONLY"*) ;; *) continue ;; esac; fi
  path="${HERE}/${file}"
  [ -f "$path" ] || { echo "  ! missing ${path}" >&2; exit 1; }

  label_id="$(gql 'query($name: String!) { issueLabels(filter: {name: {eq: $name}}) { nodes { id } } }' \
    "$(jq -cn --arg name "$label" '{name: $name}')" | jq -r '.data.issueLabels.nodes[0].id // empty')"
  [ -n "$label_id" ] || echo "  ! label '${label}' not found; template '${name}' will have no default label" >&2

  data="$(build_template_data "$path" "$label_id")"
  existing_id="$(printf '%s' "$EXISTING" | jq -r --arg n "$name" --arg t "$TEAM_ID" \
    '.data.templates[] | select(.name == $n and .type == "issue" and (.team.id // "") == $t) | .id' | head -n1)"

  if [ -n "$existing_id" ] && [ "$UPDATE" -eq 0 ]; then
    echo "  = exists, skipping (use --update): ${name} (${existing_id})"; continue
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  ~ dry-run ${existing_id:+update}${existing_id:-create}: ${name} ← ${file} (label ${label}=${label_id:-none}, $(wc -l < "$path") lines)"
    continue
  fi

  if [ -n "$existing_id" ]; then
    vars="$(jq -cn --arg id "$existing_id" --arg name "$name" --arg desc "$desc" --argjson data "$data" \
      '{id: $id, input: {name: $name, description: $desc, templateData: $data}}')"
    gql 'mutation($id: String!, $input: TemplateUpdateInput!) { templateUpdate(id: $id, input: $input) { success template { id name } } }' "$vars" \
      | jq -r '"  ↻ updated: \(.data.templateUpdate.template.name) (\(.data.templateUpdate.template.id))"'
  else
    sort_order="${file%%-*}"
    vars="$(jq -cn --arg team "$TEAM_ID" --arg name "$name" --arg desc "$desc" --argjson sort "$((10#$sort_order))" --argjson data "$data" \
      '{input: {teamId: $team, type: "issue", name: $name, description: $desc, sortOrder: $sort, templateData: $data}}')"
    gql 'mutation($input: TemplateCreateInput!) { templateCreate(input: $input) { success template { id name } } }' "$vars" \
      | jq -r '"  + created: \(.data.templateCreate.template.name) (\(.data.templateCreate.template.id))"'
  fi
done

echo "→ Done. Verify in Linear: Settings → Teams → ${TEAM_NAME} → Templates."
