#!/usr/bin/env bash
# Suite for the Swift and Kotlin emitters of the shared-kernel generator (tools/codegen/gen-kernel.mjs,
# tools/codegen/kernel/emit-{swift,kotlin}.mjs; Linear AI-88): over the committed registries, the seven
# files per language and their banners, the error codes, measurement definitions, starting shapes and
# entitlement levels read back from both outputs and compared with the JSON, and the guard that fails
# a run when two registry values map to one identifier. No gate compiles the kernel output yet.
# Usage: scripts/test/kernel-emitters.test.sh   (run by `just test tooling` and `just test`)
# Needs the mise-pinned Node and the workspace install (the registries resolve through the package
# export @ai-stylist/shared-kernel/registry/*). Runs on Linux and macOS alike. Exit: 0 every test
# passed, 1 a test failed or node is missing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "FAIL  kernel-emitters: node not found (mise install; the justfile puts the mise shims on PATH)" >&2
  exit 1
fi
exec node --test --test-reporter=spec tools/codegen/kernel/tests/*.test.mjs
