#!/usr/bin/env bash
# just ci-contracts-breaking <base-sha> — breaking-change checks of the contracts, base ref vs the
# working tree (pr-gate.yml, pull requests only; planning/06 §4 and §9). Needs the base commit in
# the local clone (checkout with fetch-depth: 0). Two checks, both always run:
#   1. Event and worker schemas: packages/contracts/scripts/events-breaking.mjs compares every
#      packages/contracts/events/*.json and packages/contracts/workers/<service>/*.json schema
#      version on the base with the working tree (Node built-ins only).
#   2. OpenAPI: oasdiff on the bundled contract, failing on WARN as well as ERR findings (the same
#      threshold as the contracts lint's OASDIFF_BASE step). Skips with a notice while the bundle or
#      oasdiff is absent, or when the base ref has no bundle to diff against.
# Usage: scripts/ci/contracts-breaking.sh <base-sha>
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
cd "$REPO_ROOT"

base="${1:-}"
[[ -n "$base" ]] || die "usage: scripts/ci/contracts-breaking.sh <base-sha>"

rc=0
node packages/contracts/scripts/events-breaking.mjs --base-ref "$base" || rc=1

oasdiff_check() {
  # Written by tools/codegen/gen-ts.sh (just generate) and committed.
  local bundle=packages/contracts/gen/openapi.bundle.json tmp
  if [[ ! -f "$bundle" ]]; then
    echo "::notice::$bundle absent - oasdiff skipped (T04 not landed)"
    return 0
  fi
  if ! have oasdiff; then
    echo "::warning::oasdiff not on PATH - pin it in mise.toml (T04)"
    return 0
  fi
  tmp="$(mktemp -d)"
  if ! git show "$base:$bundle" >"$tmp/base.bundle.json" 2>/dev/null; then
    echo "::notice::no bundle on base ref - nothing to diff"
    rm -rf "$tmp"
    return 0
  fi
  # Verified: `oasdiff breaking <base> <revision> --fail-on WARN` (docs/BREAKING-CHANGES.md)
  local status=0
  oasdiff breaking "$tmp/base.bundle.json" "$bundle" --fail-on WARN || status=$?
  rm -rf "$tmp"
  return "$status"
}
oasdiff_check || rc=1

exit "$rc"
