#!/usr/bin/env bash
# Black-box suite for tools/observability/sync.mjs (`just observability-sync`): call order, token
# substitution, idempotence, --dry-run, --prune, every tools/observability/fixtures case failing
# --check, and no secret value in any output. The tool runs against local Grafana and PostHog stubs
# (tools/observability/tests/stubs.mjs) with synthetic keys; nothing reaches a real service.
# Usage: scripts/test/observability-sync.test.sh   (run by `just test tooling` and `just test`)
# Needs only the mise-pinned Node (node:test, no node_modules), so it runs in a fresh worktree.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL  observability-sync: node not found (mise install; the justfile puts the mise shims on PATH)" >&2
  exit 1
fi
exec node --test --test-reporter=spec tools/observability/tests/sync.test.mjs
