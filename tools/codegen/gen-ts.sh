#!/usr/bin/env bash
# TypeScript contract generators (planning/06 §1 steps 1, 2, 4):
#   OpenAPI (openapi/**.yaml) --redocly bundle--> gen/openapi.bundle.json
#   bundle --@hey-api/openapi-ts--> gen/ts-client/   (typed fetch client + types)
#   events/**.json --json-schema-to-typescript--> gen/events-ts/index.ts
# Deterministic: run twice, diff is empty. Called by generate.sh; do not call the tools directly.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PKG="$ROOT/packages/contracts"
cd "$PKG"

echo "==> redocly bundle -> gen/openapi.bundle.json"
mkdir -p gen
pnpm exec redocly bundle openapi/openapi.yaml --output gen/openapi.bundle.json --ext json >/dev/null

echo "==> @hey-api/openapi-ts -> gen/ts-client/"
pnpm exec openapi-ts --file openapi-ts.config.ts

echo "==> json-schema-to-typescript -> gen/events-ts/index.ts"
node "$ROOT/tools/codegen/gen-events-ts.mjs"

echo "==> prettier (normalise generated TypeScript)"
pnpm exec prettier --ignore-path /dev/null --log-level warn --write "gen/**/*.ts" gen/openapi.bundle.json
