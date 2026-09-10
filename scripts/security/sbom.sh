#!/usr/bin/env bash
# Software bill of materials with syft (planning/15 §9, P02 T12). Writes SPDX 2.3 + CycloneDX
# JSON to artifacts/sbom/ (gitignored, never committed) with the same syft invocation, formats
# and file names as .github/workflows/nightly.yml so CI and local output agree.
# Usage: scripts/security/sbom.sh [out-dir]   (default artifacts/sbom)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:-$ROOT/artifacts/sbom}"
mkdir -p "$OUT"
cd "$ROOT"

# Excludes: build caches, the archived prototype, git internals, our own output, and the license
# fixture tree (hand-written packages that must not appear in the inventory).
syft scan dir:. --quiet \
    --exclude './node_modules/.cache' --exclude './**/node_modules/.cache' \
    --exclude './prototype' --exclude './.git' --exclude './artifacts' \
    --exclude './tools/security/fixtures' \
    -o "spdx-json=$OUT/sbom.spdx.json" -o "cyclonedx-json=$OUT/sbom.cdx.json"

count="$(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(s.packages.length)' "$OUT/sbom.spdx.json")"
echo "sbom: $count packages -> $OUT/sbom.spdx.json, $OUT/sbom.cdx.json (gitignored; nightly.yml uploads the same files as a CI artifact)"
