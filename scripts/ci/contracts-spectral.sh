#!/usr/bin/env bash
# just ci-contracts-spectral — Spectral lint of the OpenAPI contract (pr-gate.yml). Runs the contracts
# package's lint:spectral, the same lint `just lint` runs through lint:openapi: redocly bundles
# packages/contracts/openapi, then spectral checks the bundle against .spectral.yaml and fails on
# warnings. It lints the bundle, not each source file: the module files are fragments that
# openapi.yaml pulls in by $ref, so alone they lack `servers` and the global tags.
# spectral is the package's devDependency @stoplight/spectral-cli. It resolves only inside the
# package, so `pnpm exec spectral` from the repo root never finds it; without `pnpm install` the
# lint fails rather than skips.
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
cd "$REPO_ROOT"

pnpm --filter @ai-stylist/contracts run lint:spectral
