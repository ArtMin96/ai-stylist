#!/usr/bin/env bash
# Each local dev process reports its own OTel service.name (docs/observability/grafana.md: api, jobs,
# segmentation) although all three read the one repo-root .env, which `just secrets-sync` may fill
# with an OTEL_SERVICE_NAME. `just dev-api` / `just dev-workers` set the name on each command line;
# this suite proves that works:
#   1. Node's --env-file-if-exists (apps/api package scripts `dev`, `dev:jobs`) loads the file, but
#      a variable already in the environment wins;
#   2. uvicorn's --env-file (python-dotenv, the segmentation worker) behaves the same;
#   3. the recipes still set api / jobs / segmentation, and hand the worker the repo-root .env.
# Usage: scripts/test/dev-service-names.test.sh   (run by `just test tooling` and `just test`)
# Needs node, uv and just (mise) and the synced workers venv. Linux and macOS alike.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-dev-names-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

ENV_FILE="$TEST_ROOT/.env"
printf 'OTEL_SERVICE_NAME=from-dotenv\n' >"$ENV_FILE"

failures=0

run_test() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS  $name"
  else
    echo "FAIL  $name" >&2
    failures=$((failures + 1))
  fi
}

expect_eq() {
  if [[ "$1" != "$2" ]]; then
    printf '  expected: %s\n  actual:   %s\n' "$2" "$1" >&2
    return 1
  fi
}

expect_contains() {
  if [[ "$1" != *"$2"* ]]; then
    printf '  expected to contain: %s\n  in: %s\n' "$2" "$1" >&2
    return 1
  fi
}

# node_sees [NAME=value]: the OTEL_SERVICE_NAME a Node process started like the apps/api dev scripts
# sees, with this caller's own OTEL_SERVICE_NAME removed first.
node_sees() {
  env -u OTEL_SERVICE_NAME "$@" node --env-file-if-exists="$ENV_FILE" \
    -e 'process.stdout.write(process.env.OTEL_SERVICE_NAME ?? "")'
}

# uvicorn_sees [NAME=value]: the same for uvicorn: uvicorn.Config(env_file=...) is what
# `uvicorn --env-file` runs before it imports the app.
uvicorn_sees() {
  env -u OTEL_SERVICE_NAME "$@" \
    uv run --quiet --frozen --project "$ROOT/workers/ml/segmentation" python -c '
import os, sys
from uvicorn.config import Config
Config("ai_stylist_segmentation.main:app", env_file=sys.argv[1])
print(os.environ.get("OTEL_SERVICE_NAME", ""), end="")' "$ENV_FILE"
}

test_node_env_beats_env_file() {
  expect_eq "$(node_sees)" "from-dotenv" && expect_eq "$(node_sees OTEL_SERVICE_NAME=api)" "api"
}

test_uvicorn_env_beats_env_file() {
  expect_eq "$(uvicorn_sees)" "from-dotenv" \
    && expect_eq "$(uvicorn_sees OTEL_SERVICE_NAME=segmentation)" "segmentation"
}

test_recipes_name_each_process() {
  local api workers worker_env_file
  api="$(cd "$ROOT" && just --show dev-api)"
  workers="$(cd "$ROOT" && just --show dev-workers)"
  # shellcheck disable=SC2016 # the recipe's own text, not an expansion
  worker_env_file='if [[ -f .env ]]; then set -- --env-file .env "$@"; fi'
  expect_contains "$api" "OTEL_SERVICE_NAME='api' pnpm --filter @ai-stylist/api dev" \
    && expect_contains "$workers" "OTEL_SERVICE_NAME='jobs' pnpm --filter @ai-stylist/api run dev:jobs" \
    && expect_contains "$workers" "OTEL_SERVICE_NAME='segmentation' uv run --project workers/ml/segmentation uvicorn" \
    && expect_contains "$workers" "$worker_env_file"
}

run_test "node --env-file-if-exists: loads the file, an exported OTEL_SERVICE_NAME wins" test_node_env_beats_env_file
run_test "uvicorn --env-file: loads the file, an exported OTEL_SERVICE_NAME wins" test_uvicorn_env_beats_env_file
run_test "just dev-api / dev-workers name api, jobs and segmentation" test_recipes_name_each_process

if ((failures > 0)); then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "all tests passed"
