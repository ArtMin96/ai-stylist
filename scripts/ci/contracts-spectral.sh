#!/usr/bin/env bash
# just ci-contracts-spectral — Spectral lint of the per-module OpenAPI sources (pr-gate.yml).
# Skips with a notice until packages/contracts/openapi exists and Spectral is installed, so the
# gate turns on by itself once the contracts toolchain lands (T04).
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
cd "$REPO_ROOT"

if [[ ! -d packages/contracts/openapi ]]; then
  echo "::notice::packages/contracts/openapi absent - spectral skipped (T04 not landed)"
  exit 0
fi
if ! have spectral && ! pnpm exec spectral --version >/dev/null 2>&1; then
  echo "::warning::spectral not installed - add it to the contracts toolchain (T04)"
  exit 0
fi
ruleset=packages/contracts/.spectral.yaml
[[ -f "$ruleset" ]] || ruleset=.spectral.yaml
if [[ -f "$ruleset" ]]; then
  pnpm exec spectral lint --ruleset "$ruleset" "packages/contracts/openapi/**/*.yaml"
else
  pnpm exec spectral lint "packages/contracts/openapi/**/*.yaml"
fi
