#!/usr/bin/env bash
# just ci-contracts-breaking <base-sha> — oasdiff breaking-change check of the bundled OpenAPI
# contract, base ref vs the working tree (pr-gate.yml, pull requests only). Needs the base commit
# in the local clone (checkout with fetch-depth: 0). Skips with a notice while the bundle or
# oasdiff is absent, or when the base ref has no bundle to diff against.
# Usage: scripts/ci/contracts-breaking.sh <base-sha>
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
cd "$REPO_ROOT"

base="${1:-}"
[[ -n "$base" ]] || die "usage: scripts/ci/contracts-breaking.sh <base-sha>"

# Written by tools/codegen/gen-ts.sh (just generate) and committed.
bundle=packages/contracts/gen/openapi.bundle.json
if [[ ! -f "$bundle" ]]; then
  echo "::notice::$bundle absent - oasdiff skipped (T04 not landed)"
  exit 0
fi
if ! have oasdiff; then
  echo "::warning::oasdiff not on PATH - pin it in mise.toml (T04)"
  exit 0
fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if ! git show "$base:$bundle" >"$tmp/base.bundle.json" 2>/dev/null; then
  echo "::notice::no bundle on base ref - nothing to diff"
  exit 0
fi
# Verified: `oasdiff breaking <base> <revision> --fail-on ERR` (docs/BREAKING-CHANGES.md)
oasdiff breaking "$tmp/base.bundle.json" "$bundle" --fail-on ERR
