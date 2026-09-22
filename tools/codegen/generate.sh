#!/usr/bin/env bash
# `just generate [--check]` — runs every contract generator (planning/06 §1, brief §3).
#   gen-ts.sh      OpenAPI bundle, hey-api TS client, event TS types  -> packages/contracts/gen
#   gen-swift.sh   swift-openapi-generator Swift client (SwiftPM pkg)  -> packages/contracts/gen/swift-client
#   gen-kotlin.sh  openapi-generator Kotlin client + analytics taxonomy -> packages/contracts/gen/kotlin-client
#   gen-python.sh  datamodel-code-generator Pydantic models           -> workers/ml/generated (if present)
# gen-ts.sh runs first: it writes gen/openapi.bundle.json, which the Swift and Kotlin generators read.
# Toolchains: node (all), java (gen-kotlin.sh; mise pin), swift on PATH or Docker swift:6.4 (gen-swift.sh).
# The two native generators run through scripts/native-lane.sh (lanes ios / android): NATIVE_LANES=none
# skips them with a notice (pr-gate's `just ci-parity --core`; the contracts job runs them); with no
# swift/docker the Swift client is SKIPPED with a notice locally and FAILS when CI=true or NATIVE_STRICT=1.
# --check: regenerate, compare with the committed outputs, restore them, and exit 1 listing stale files.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/tools/codegen"
CHECK=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "generate.sh: unknown argument '$arg'" >&2; exit 2 ;;
  esac
done

# Generated output roots (relative to repo root). Missing ones are skipped.
OUTPUT_DIRS=(packages/contracts/gen)
# Tool caches that may appear inside output dirs and are never generated or committed.
# (.build, .swiftpm, Package.resolved: a local `swift build` inside gen/swift-client leaves them.)
DIFF_EXCLUDES=(-x __pycache__ -x '*.pyc' -x .pytest_cache -x .ruff_cache -x .mypy_cache -x .build -x .swiftpm -x Package.resolved)
if [[ -x "$HERE/gen-python.sh" ]]; then
  OUTPUT_DIRS+=(workers/ml/generated)
fi

run_generators() {
  "$HERE/gen-ts.sh"            # writes gen/openapi.bundle.json, which the two below read
  "$ROOT/scripts/native-lane.sh" ios swift "$HERE/gen-swift.sh"
  "$ROOT/scripts/native-lane.sh" android none "$HERE/gen-kotlin.sh"
  if [[ -x "$HERE/gen-python.sh" ]]; then
    "$HERE/gen-python.sh"
  fi
}

if [[ $CHECK -eq 0 ]]; then
  run_generators
  echo "generate: done"
  exit 0
fi

# --check: snapshot committed outputs, regenerate, diff, restore.
SNAP="$(mktemp -d)"
trap 'rm -rf "$SNAP"' EXIT
for dir in "${OUTPUT_DIRS[@]}"; do
  if [[ -d "$ROOT/$dir" ]]; then
    mkdir -p "$SNAP/$dir"
    cp -a "$ROOT/$dir/." "$SNAP/$dir/"
  fi
done

LOG="$SNAP/generate.log"
if ! run_generators >"$LOG" 2>&1; then
  cat "$LOG" >&2
  echo "generate --check: a generator failed (see output above)" >&2
  exit 1
fi
# A skipped generator is never silent: repeat native-lane's notice outside the captured log.
grep -hE '^native-lane: ' "$LOG" >&2 || true

stale=()
for dir in "${OUTPUT_DIRS[@]}"; do
  if [[ ! -d "$SNAP/$dir" ]]; then
    stale+=("$dir/ (missing: not generated yet)")
    continue
  fi
  while IFS= read -r line; do
    stale+=("$line")
  done < <(cd "$ROOT" && diff -rq "${DIFF_EXCLUDES[@]}" "$SNAP/$dir" "$dir" \
    | sed -E "s#^Files $SNAP/([^ ]+) and ([^ ]+) differ\$#\\2 (stale)#; s#^Only in $SNAP/([^:]+): (.*)\$#\\1/\\2 (removed by generator)#; s#^Only in ([^:]+): (.*)\$#\\1/\\2 (not committed)#")
done

# Restore the committed state so --check never mutates the working tree.
for dir in "${OUTPUT_DIRS[@]}"; do
  rm -rf "${ROOT:?}/$dir"
  if [[ -d "$SNAP/$dir" ]]; then
    mkdir -p "$ROOT/$dir"
    cp -a "$SNAP/$dir/." "$ROOT/$dir/"
  fi
done

if [[ ${#stale[@]} -gt 0 ]]; then
  echo "generate --check: generated output is stale. Run \`just generate\` and commit:" >&2
  printf '  %s\n' "${stale[@]}" >&2
  exit 1
fi
echo "generate --check: generated output is up to date (${OUTPUT_DIRS[*]})"
