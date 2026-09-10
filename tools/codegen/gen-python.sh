#!/usr/bin/env bash
# Generate Pydantic v2 models for the ML workers from the canonical event schemas.
#
#   packages/contracts/events/*.json  ──datamodel-codegen──▶  workers/ml/generated/ai_stylist_generated/events/
#
# Called by `just generate` (and `just generate --check`). Deterministic and idempotent:
# running it twice on unchanged schemas produces no diff. Never edit the output by hand.
#
# Usage:  tools/codegen/gen-python.sh [--check]
#   --check   generate into a temp dir and fail (exit 1) if the committed output differs.
# Env:
#   CONTRACTS_EVENTS_DIR  input directory (default: <repo>/packages/contracts/events)
#   UV                    uv binary (default: `uv` on PATH, else `mise exec -- uv`)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKERS_DIR="$REPO_ROOT/workers"
INPUT_DIR="${CONTRACTS_EVENTS_DIR:-$REPO_ROOT/packages/contracts/events}"
OUTPUT_DIR="$WORKERS_DIR/ml/generated/ai_stylist_generated/events"
# shellcheck disable=SC2016  # literal backticks in the generated-file banner
HEADER='# GENERATED — run `just generate` (tools/codegen/gen-python.sh). DO NOT EDIT BY HAND.'

check_only=false
for arg in "$@"; do
  case "$arg" in
    --check) check_only=true ;;
    -h | --help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "gen-python.sh: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ -n "${UV:-}" ]]; then
  uv_cmd=("$UV")
elif command -v uv >/dev/null 2>&1; then
  uv_cmd=(uv)
elif [[ -x "$HOME/.local/bin/mise" ]]; then
  uv_cmd=("$HOME/.local/bin/mise" exec -- uv)
else
  echo "gen-python.sh: uv not found (install via mise: mise.toml pins it)" >&2
  exit 1
fi
run() { "${uv_cmd[@]}" run --project "$WORKERS_DIR" --frozen "$@"; }

if [[ ! -d "$INPUT_DIR" ]]; then
  echo "gen-python.sh: notice: $INPUT_DIR does not exist yet (P02 T04 pending); nothing to generate."
  exit 0
fi
shopt -s nullglob
schemas=("$INPUT_DIR"/*.json)
if (( ${#schemas[@]} == 0 )); then
  echo "gen-python.sh: notice: no *.json schemas in $INPUT_DIR; nothing to generate."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
staged="$tmp/events"

# Only the top-level *.json files are schemas (subdirectories such as analytics/ hold
# instance data and TS-only registries); stage them so datamodel-codegen does not recurse.
mkdir -p "$tmp/input"
cp "${schemas[@]}" "$tmp/input/"

# One module per schema file; cross-file $refs become relative imports.
run datamodel-codegen \
  --input "$tmp/input" \
  --input-file-type jsonschema \
  --output "$staged" \
  --output-model-type pydantic_v2.BaseModel \
  --use-schema-description \
  --target-python-version 3.12 \
  --field-constraints \
  --use-annotated \
  --disable-timestamp \
  --formatters builtin \
  2> >(grep -v -e FutureWarning -e warn_deprecated >&2 || true)

# Banner on every file (the datamodel-codegen header with the source filename stays below it),
# then the workspace ruff config so the output is byte-stable regardless of generator defaults.
while IFS= read -r -d '' py; do
  printf '%s\n# Source: %s\n%s' "$HEADER" "${INPUT_DIR#"$REPO_ROOT"/}" "$(cat "$py")" > "$py.tmp"
  printf '\n' >> "$py.tmp"
  mv "$py.tmp" "$py"
done < <(find "$staged" -name '*.py' -print0 | sort -z)
run ruff format --quiet --no-cache --config "$WORKERS_DIR/pyproject.toml" "$staged"
run ruff check --quiet --no-cache --config "$WORKERS_DIR/pyproject.toml" --select I --fix "$staged"

if [[ -d "$OUTPUT_DIR" ]] && diff -r -q --exclude=__pycache__ "$OUTPUT_DIR" "$staged" >/dev/null 2>&1; then
  echo "gen-python.sh: up to date (${#schemas[@]} schemas → ${OUTPUT_DIR#"$REPO_ROOT"/})"
  exit 0
fi
if $check_only; then
  echo "gen-python.sh: committed output is stale — run \`just generate\`:" >&2
  diff -r -u --exclude=__pycache__ "$OUTPUT_DIR" "$staged" >&2 || true
  exit 1
fi
rm -rf "$OUTPUT_DIR"
mkdir -p "$(dirname "$OUTPUT_DIR")"
cp -R "$staged" "$OUTPUT_DIR"
echo "gen-python.sh: wrote ${#schemas[@]} schemas → ${OUTPUT_DIR#"$REPO_ROOT"/}"
