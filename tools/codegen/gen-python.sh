#!/usr/bin/env bash
# Generate the Python package the ML workers import from the canonical contracts.
#
#   packages/contracts/events/*.json  ──datamodel-codegen──▶  workers/ml/generated/ai_stylist_generated/events/
#   packages/shared-kernel/registry/{forbidden-log-keys,forbidden-log-keys.examples,log-redaction}.json
#                                     ──gen-kernel.mjs python──▶  workers/ml/generated/ai_stylist_generated/kernel/
#
# Called by `just generate` (and `just generate --check`). Deterministic and idempotent:
# running it twice on unchanged sources produces no diff. Never edit the output by hand.
#
# Usage:  tools/codegen/gen-python.sh [--check]
#   --check   generate into a temp dir and fail (exit 1) if the committed output differs.
# Env:
#   CONTRACTS_EVENTS_DIR  event schema directory (default: <repo>/packages/contracts/events)
#   UV                    uv binary (default: `uv` on PATH, else `mise exec -- uv`)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKERS_DIR="$REPO_ROOT/workers"
INPUT_DIR="${CONTRACTS_EVENTS_DIR:-$REPO_ROOT/packages/contracts/events}"
OUTPUT_ROOT="$WORKERS_DIR/ml/generated/ai_stylist_generated"
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

if command -v node >/dev/null 2>&1; then
  node_cmd=(node)
elif command -v mise >/dev/null 2>&1; then
  node_cmd=(mise exec -- node)
else
  echo "gen-python.sh: node not found (install via mise: mise.toml pins it)" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# Staging mirror of OUTPUT_ROOT: one subdirectory per generated subpackage.
staged="$tmp/out"
mkdir -p "$staged"
subpackages=()
summary=()

# ---- events/: Pydantic models from the event JSON Schemas ----------------------------------
shopt -s nullglob
schemas=()
if [[ -d "$INPUT_DIR" ]]; then
  schemas=("$INPUT_DIR"/*.json)
fi
if (( ${#schemas[@]} == 0 )); then
  echo "gen-python.sh: notice: no *.json schemas in $INPUT_DIR; events/ not generated."
else
  # Only the top-level *.json files are schemas (subdirectories such as analytics/ hold
  # instance data and TS-only registries); stage them so datamodel-codegen does not recurse.
  mkdir -p "$tmp/input"
  cp "${schemas[@]}" "$tmp/input/"

  # One module per schema file; cross-file $refs become relative imports.
  run datamodel-codegen \
    --input "$tmp/input" \
    --input-file-type jsonschema \
    --output "$staged/events" \
    --output-model-type pydantic_v2.BaseModel \
    --use-schema-description \
    --target-python-version 3.14 \
    --field-constraints \
    --use-annotated \
    --disable-timestamp \
    --formatters builtin \
    2> >(grep -v -e FutureWarning -e warn_deprecated >&2 || true)

  # Banner on every file (the datamodel-codegen header with the source filename stays below it).
  while IFS= read -r -d '' py; do
    printf '%s\n# Source: %s\n%s' "$HEADER" "${INPUT_DIR#"$REPO_ROOT"/}" "$(cat "$py")" > "$py.tmp"
    printf '\n' >> "$py.tmp"
    mv "$py.tmp" "$py"
  done < <(find "$staged/events" -name '*.py' -print0 | sort -z)
  subpackages+=(events)
  summary+=("${#schemas[@]} event schemas")
fi

# ---- kernel/: shared-kernel registry constants (gen-kernel.mjs writes its own banner) -------
"${node_cmd[@]}" "$REPO_ROOT/tools/codegen/gen-kernel.mjs" python "$staged/kernel" >/dev/null
subpackages+=(kernel)
summary+=("kernel registries")

# The workspace ruff config makes the output byte-stable regardless of generator defaults.
run ruff format --quiet --no-cache --config "$WORKERS_DIR/pyproject.toml" "$staged"
run ruff check --quiet --no-cache --config "$WORKERS_DIR/pyproject.toml" --select I --fix "$staged"

stale=()
for sub in "${subpackages[@]}"; do
  if ! { [[ -d "$OUTPUT_ROOT/$sub" ]] &&
    diff -r -q --exclude=__pycache__ "$OUTPUT_ROOT/$sub" "$staged/$sub" >/dev/null 2>&1; }; then
    stale+=("$sub")
  fi
done
label="$(printf '%s, ' "${summary[@]}")"
label="${label%, }"
if (( ${#stale[@]} == 0 )); then
  echo "gen-python.sh: up to date ($label → ${OUTPUT_ROOT#"$REPO_ROOT"/})"
  exit 0
fi
if $check_only; then
  echo "gen-python.sh: committed output is stale — run \`just generate\`:" >&2
  for sub in "${stale[@]}"; do
    diff -r -u -N --exclude=__pycache__ "$OUTPUT_ROOT/$sub" "$staged/$sub" >&2 || true
  done
  exit 1
fi
for sub in "${stale[@]}"; do
  rm -rf "${OUTPUT_ROOT:?}/$sub"
  mkdir -p "$OUTPUT_ROOT"
  cp -R "$staged/$sub" "$OUTPUT_ROOT/$sub"
done
echo "gen-python.sh: wrote ${stale[*]} → ${OUTPUT_ROOT#"$REPO_ROOT"/}"
