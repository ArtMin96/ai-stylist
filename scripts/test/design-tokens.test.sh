#!/usr/bin/env bash
# Suite for the design-token generator (tools/codegen/gen-tokens.mjs, Linear AI-189):
# the DESIGN.md frontmatter parser, our rules TK-01..TK-11 (the repository DESIGN.md passes them;
# every tools/codegen/tokens/fixtures/TK-NN case fails on its own rule only), the pinned design.md
# lint hook TK-12 (against a shell stub; the real CLI never runs here), the in-memory DTCG 2025.10
# model and resolver, the Swift and Kotlin emitters, the component-contract checker CC-01..CC-19
# (icon sets included) with the SVG path compiler, the golden parity test (both read back into
# one name -> value table, the icon glyph table included) and the CLI with its output directories.
# TOKENS_REPO_ROOT=<checkout> runs the repository tests against another checkout's DESIGN.md and
# .impeccable/components (a worktree whose inputs are not integrated yet).
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
