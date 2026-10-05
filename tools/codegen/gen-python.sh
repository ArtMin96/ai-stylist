#!/usr/bin/env bash
# Generate the Python package the ML workers import from the canonical contracts.
#
#   packages/contracts/events/*.json  ──datamodel-codegen──▶  workers/ml/generated/ai_stylist_generated/events/
#   packages/contracts/workers/<service>/*.json  ──datamodel-codegen──▶  .../ai_stylist_generated/<service>/
#   packages/shared-kernel/registry/{forbidden-log-keys,forbidden-log-keys.examples,log-redaction,correlation}.json
#   (+ the correlationId rule of packages/contracts/events/envelope.json)
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
WORKER_CONTRACTS_DIR="$REPO_ROOT/packages/contracts/workers"
OUTPUT_ROOT="$WORKERS_DIR/ml/generated/ai_stylist_generated"
# shellcheck disable=SC2016  # literal backticks in the generated-file banner
HEADER='# GENERATED — run `just generate` (tools/codegen/gen-python.sh). DO NOT EDIT BY HAND.'

check_only=false
for arg in "$@"; do
  case "$arg" in
    --check) check_only=true ;;
    -h | --help) sed -n '2,17p' "$0"; exit 0 ;;
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
worker_subpackages=()
summary=()

# codegen <schema dir> <subpackage> [datamodel-codegen flags...]
# One module per top-level *.json schema of <schema dir>; cross-file $refs become relative imports.
# Only top-level files are schemas (subdirectories such as events/analytics/ hold instance data and
# TS-only registries), so they are staged first and datamodel-codegen does not recurse.
codegen() {
  local src="$1" sub="$2"
  shift 2
  # The staging dir's name is printed in each generated `__init__.py` header (`filename:  input`).
  mkdir -p "$tmp/$sub/input"
  cp "$src"/*.json "$tmp/$sub/input/"
  run datamodel-codegen \
    --input "$tmp/$sub/input" \
    --input-file-type jsonschema \
    --output "$staged/$sub" \
    --output-model-type pydantic_v2.BaseModel \
    --use-schema-description \
    --target-python-version 3.14 \
    --field-constraints \
    --use-annotated \
    --disable-timestamp \
    --formatters builtin \
    "$@" \
    2> >(grep -v -e FutureWarning -e warn_deprecated >&2 || true)
}

# stamp <subpackage> <source label>: the banner on every file (the datamodel-codegen header with
# the source filename stays below it).
stamp() {
  local sub="$1" source="$2" py
  while IFS= read -r -d '' py; do
    printf '%s\n# Source: %s\n%s\n' "$HEADER" "$source" "$(cat "$py")" > "$py.tmp"
    mv "$py.tmp" "$py"
  done < <(find "$staged/$sub" -name '*.py' -print0 | sort -z)
}

# waive_long_lines <subpackage>: a file-level `# ruff: noqa: E501` under the banner of each file
# with a line ruff reports as too long (a schema description written as a docstring or string;
# ruff format does not wrap strings). Only where needed, so RUF100 never flags an unused waiver.
waive_long_lines() {
  local sub="$1" py
  while IFS= read -r -d '' py; do
    if [[ -n "$(run ruff check --quiet --no-cache --config "$WORKERS_DIR/pyproject.toml" \
      --select E501 --exit-zero --output-format concise "$py")" ]]; then
      { sed -n '1,2p' "$py"; printf '# ruff: noqa: E501\n'; sed '1,2d' "$py"; } > "$py.tmp"
      mv "$py.tmp" "$py"
    fi
  done < <(find "$staged/$sub" -name '*.py' -print0 | sort -z)
}

shopt -s nullglob

# ---- events/: Pydantic models from the event JSON Schemas ----------------------------------
schemas=()
if [[ -d "$INPUT_DIR" ]]; then
  schemas=("$INPUT_DIR"/*.json)
fi
if (( ${#schemas[@]} == 0 )); then
  echo "gen-python.sh: notice: no *.json schemas in $INPUT_DIR; events/ not generated."
else
  codegen "$INPUT_DIR" events
  stamp events "${INPUT_DIR#"$REPO_ROOT"/}"
  subpackages+=(events)
  summary+=("${#schemas[@]} event schemas")
fi

# ---- <service>/: Pydantic models of the internal API <-> worker HTTP contracts --------------
# StrEnum enums as in events/; `--use-default` keeps a required field's schema `default` as the
# Python default (`generated = True`, `masks = []`), so a reply the worker builds may omit them
# while the wire, and the TS type, always carry them. Unlike events/, these modules are not
# excluded from `ruff check`, so long schema descriptions get a per-file E501 waiver below.
for service_dir in "$WORKER_CONTRACTS_DIR"/*/; do
  service="$(basename "$service_dir")"
  case "$service" in
    events | kernel)
      echo "gen-python.sh: packages/contracts/workers/$service/ would shadow the generated $service/ subpackage" >&2
      exit 1
      ;;
  esac
  worker_schemas=("$service_dir"*.json)
  if (( ${#worker_schemas[@]} == 0 )); then
    continue
  fi
  codegen "${service_dir%/}" "$service" --use-default
  stamp "$service" "packages/contracts/workers/$service"
  subpackages+=("$service")
  worker_subpackages+=("$service")
  summary+=("${#worker_schemas[@]} $service worker schemas")
done

# ---- kernel/: shared-kernel registry constants (gen-kernel.mjs writes its own banner) -------
"${node_cmd[@]}" "$REPO_ROOT/tools/codegen/gen-kernel.mjs" python "$staged/kernel" >/dev/null
subpackages+=(kernel)
summary+=("kernel registries")

# The workspace ruff config makes the output byte-stable regardless of generator defaults.
run ruff format --quiet --no-cache --config "$WORKERS_DIR/pyproject.toml" "$staged"
run ruff check --quiet --no-cache --config "$WORKERS_DIR/pyproject.toml" --select I --fix "$staged"
for sub in ${worker_subpackages[@]+"${worker_subpackages[@]}"}; do
  waive_long_lines "$sub"
done

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
