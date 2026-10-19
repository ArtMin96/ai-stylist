#!/usr/bin/env bash
# Suite for the design-token generator's front half (tools/codegen/gen-tokens.mjs, Linear AI-189):
# the DESIGN.md frontmatter parser, our rules TK-01..TK-11 (the repository DESIGN.md passes them;
# every tools/codegen/tokens/fixtures/TK-NN case fails on its own rule only), the pinned design.md
# lint hook TK-12 (against a shell stub; the real CLI never runs here), the in-memory DTCG 2025.10
# model and resolver, and the CLI.
# Usage: scripts/test/design-tokens.test.sh   (run by `just test tooling` and `just test`)
# Needs the mise-pinned Node and the root devDependency `yaml` (the workspace install). Runs on
# Linux and macOS alike. Exit: 0 every test passed, 1 a test failed or node is missing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL  design-tokens: node not found (mise install; the justfile puts the mise shims on PATH)" >&2
  exit 1
fi
exec node --test --test-reporter=spec tools/codegen/tokens/tests/*.test.mjs
