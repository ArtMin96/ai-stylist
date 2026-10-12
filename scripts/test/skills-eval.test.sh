#!/usr/bin/env bash
# Free suite for tools/skills-eval (`just skills-eval`): the generated plugin and cases, the
# argument defaults, the scoreboard (hashes, skip and --force, the budget, the verdicts, what may
# be stored), the runner launch (arguments, pinned effort) and the summary statistics.
# The tool runs on throwaway git checkouts with synthetic skills, and `claude` is a stub on a
# scratch PATH (tools/skills-eval/tests/claude-stub.mjs): no model is called, nothing is spent.
# One test generates this repository's own skills into a temporary directory (nothing is run).
# Usage: scripts/test/skills-eval.test.sh
# Needs the mise-pinned Node (node:test, no node_modules), git, tar and bash. Runs on Linux and
# macOS alike. Exit: 0 every test passed, 1 a test failed or node is missing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL  skills-eval: node not found (mise install; the justfile puts the mise shims on PATH)" >&2
  exit 1
fi
exec node --test --test-reporter=spec tools/skills-eval/tests/*.test.mjs
