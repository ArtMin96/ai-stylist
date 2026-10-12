#!/usr/bin/env bash
# `just clone-check [--fixtures]`: the copy/paste gate (NFR-TEAM-040, DEC-83). jscpd reads
# tools/jscpd/jscpd.json: the formats, the ignore list and `threshold`, the highest share of
# duplicated lines the gate accepts (tools/jscpd/README.md: how it is set, why it only goes down).
#   (no flag)   scan the hand-written sources under SCOPE; the JSON report lands in
#               artifacts/clone-check/jscpd-report.json (gitignored).
#   --fixtures  run check-fixtures.sh: every case must fail on its format, `_clean` must pass.
# Usage: tools/jscpd/clone-check.sh [--fixtures]
# Exit: 0 within the threshold; 1 above it, a failed fixture case, or jscpd not installed;
#       2 misuse.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/tools/jscpd"
JSCPD="$ROOT/node_modules/.bin/jscpd"
cd "$ROOT"

case "${1:-}" in
  --fixtures | '') ;;
  *) echo "clone-check: unknown argument '$1' (use --fixtures)" >&2; exit 2 ;;
esac

if [[ ! -x "$JSCPD" ]]; then
  echo "clone-check: node_modules/.bin/jscpd not found: dependencies are not installed in this checkout (pnpm install)" >&2
  exit 1
fi

if [[ "${1:-}" == "--fixtures" ]]; then
  exec bash "$HERE/check-fixtures.sh"
fi

# Roots are relative to the repo root (the `cd` above): jscpd matches the `**/` ignore globs of
# jscpd.json against paths relative to the working directory, so the result does not depend on
# where the checkout lives. prototype/ and planning/ are outside every root.
SCOPE=(apps packages workers scripts tools)
echo "==> jscpd --config tools/jscpd/jscpd.json ${SCOPE[*]}"
rc=0
"$JSCPD" --config tools/jscpd/jscpd.json "${SCOPE[@]}" || rc=$?
if [[ $rc -ne 0 ]]; then
  echo "clone-check: jscpd exited $rc. If it reported too many duplicates: reuse or extract the shared code." >&2
  echo "clone-check: the threshold in tools/jscpd/jscpd.json never goes up (tools/jscpd/README.md)." >&2
  exit 1
fi
echo "clone-check: ok (report: artifacts/clone-check/jscpd-report.json)"
