#!/usr/bin/env bash
# `just generate [--check]` — runs every code generator (planning/06 §1, brief §3; DEC-87 tokens).
#   gen-kernel.mjs ts  shared-kernel registries (packages/shared-kernel/registry/*.json, OQ-15)
#                      -> packages/shared-kernel/src/gen (TS data behind the hand-written registries)
#   gen-tokens.mjs DESIGN.md frontmatter (the design-token master) -> Swift + Kotlin token code in
#                  the app design systems ($TOKENS_SWIFT_DIR, $TOKENS_KOTLIN_DIR below), plus the
#                  component API surface from the approved .impeccable/components/*.yaml contracts
#                  (ComponentAPI.swift, ComponentApi.kt in the same dirs); node only, so it runs in
#                  every lane, NATIVE_LANES=none included
#   gen-ts.sh      OpenAPI bundle, hey-api TS client, event + worker-contract TS types
#                                                                     -> packages/contracts/gen
#   gen-swift.sh   swift-openapi-generator Swift client + AIStylistKernel registry target
#                                                                     -> packages/contracts/gen/swift-client
#   gen-kotlin.sh  openapi-generator Kotlin client + analytics taxonomy + kernel registries
#                                                                     -> packages/contracts/gen/kotlin-client
#   gen-python.sh  datamodel-code-generator Pydantic event + worker-contract models, gen-kernel.mjs
#                  python (forbidden log keys, log-redaction shapes) -> workers/ml/generated (if present)
# The registry emitter runs first (it validates the registries against their JSON Schemas and fails
# loudly); gen-ts.sh then writes gen/openapi.bundle.json, which the Swift and Kotlin generators read.
# Toolchains: node (all), java (gen-kotlin.sh; mise pin), swift on PATH or Docker swift:6.4 (gen-swift.sh).
# The two native generators run through scripts/native-lane.sh (lanes ios / android): NATIVE_LANES=none
# skips them with a notice (pr-gate's `just ci-parity --core`; the contracts job runs them); with no
# swift/docker the Swift client is SKIPPED with a notice locally and FAILS when CI=true or NATIVE_STRICT=1.
# --check: regenerate, compare with the committed outputs, restore them, and exit 1 listing stale files.
# Any failing generator fails the run in both modes: it is named on stderr ("generate: generator
# <name> failed") and the remaining generators do not run; --check restores the committed outputs first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/tools/codegen"
CHECK=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "generate.sh: unknown argument '$arg'" >&2; exit 2 ;;
  esac
done

# Design-token output (DEC-87): the app-internal design-system packages, never root packages/.
TOKENS_SWIFT_DIR=apps/ios/Packages/DesignSystem/Sources/DesignTokens/generated
TOKENS_KOTLIN_DIR=apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/generated
# Generated output roots (relative to repo root). A missing one is reported as stale by --check.
OUTPUT_DIRS=(packages/shared-kernel/src/gen "$TOKENS_SWIFT_DIR" "$TOKENS_KOTLIN_DIR" packages/contracts/gen)
# Tool caches that may appear inside output dirs and are never generated or committed.
# (.build, .swiftpm, Package.resolved: a local `swift build` inside gen/swift-client leaves them.)
DIFF_EXCLUDES=(-x __pycache__ -x '*.pyc' -x .pytest_cache -x .ruff_cache -x .mypy_cache -x .build -x .swiftpm -x Package.resolved)
if [[ -x "$HERE/gen-python.sh" ]]; then
  OUTPUT_DIRS+=(workers/ml/generated)
fi

# Run one generator; on failure name it on stderr and return non-zero. The status is checked
# explicitly because `set -e` does not apply inside a function called from `if ! ...` (the --check
# path below), so a bare failing step there would be ignored and the next generator would run.
run_step() {
  local name="$1" rc=0
  shift
  "$@" || rc=$?
  if [[ $rc -ne 0 ]]; then
    echo "generate: generator $name failed (exit $rc)" >&2
    return "$rc"
  fi
}

# Every step returns on the first failure, in both modes (plain and --check).
run_generators() {
  run_step gen-kernel.mjs node "$HERE/gen-kernel.mjs" ts "$ROOT/packages/shared-kernel/src/gen" || return
  run_step gen-tokens.mjs node "$HERE/gen-tokens.mjs" --input "$ROOT/DESIGN.md" \
    --components "$ROOT/.impeccable/components" \
    --swift-out "$ROOT/$TOKENS_SWIFT_DIR" --kotlin-out "$ROOT/$TOKENS_KOTLIN_DIR" || return
  # gen-ts.sh writes gen/openapi.bundle.json, which the Swift and Kotlin generators read.
  run_step gen-ts.sh "$HERE/gen-ts.sh" || return
  run_step gen-swift.sh "$ROOT/scripts/native-lane.sh" ios swift "$HERE/gen-swift.sh" || return
  run_step gen-kotlin.sh "$ROOT/scripts/native-lane.sh" android none "$HERE/gen-kotlin.sh" || return
  if [[ -x "$HERE/gen-python.sh" ]]; then
    run_step gen-python.sh "$HERE/gen-python.sh" || return
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

# Put the snapshot back (also after a failed generator, so --check never mutates the working tree).
restore_outputs() {
  local dir
  for dir in "${OUTPUT_DIRS[@]}"; do
    rm -rf "${ROOT:?}/$dir"
    if [[ -d "$SNAP/$dir" ]]; then
      mkdir -p "$ROOT/$dir"
      cp -a "$SNAP/$dir/." "$ROOT/$dir/"
    fi
  done
}

LOG="$SNAP/generate.log"
if ! run_generators >"$LOG" 2>&1; then
  cat "$LOG" >&2
  failed="$(sed -n 's/^generate: generator \([^ ]*\) failed.*/\1/p' "$LOG" | tail -n 1)"
  echo "generate --check: generator ${failed:-?} failed (see output above); outputs restored" >&2
  restore_outputs
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
restore_outputs

if [[ ${#stale[@]} -gt 0 ]]; then
  echo "generate --check: generated output is stale. Run \`just generate\` and commit:" >&2
  printf '  %s\n' "${stale[@]}" >&2
  exit 1
fi
echo "generate --check: generated output is up to date (${OUTPUT_DIRS[*]})"
