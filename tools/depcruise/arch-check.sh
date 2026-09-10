#!/usr/bin/env bash
# `just arch-check [--fixtures]` — dependency-cruiser boundary gate (planning/04 §4.3, brief §5).
#   (no flag)   cruise the real tree; exit non-zero on any violation. Also fails on a banned
#               utils/ | helpers/ | common/ directory even when it has no imports (04 §4.4).
#   --fixtures  run tools/depcruise/check-fixtures.sh: every fixture must fail on its named rule.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/tools/depcruise"
cd "$ROOT"

case "${1:-}" in
  --fixtures) exec "$HERE/check-fixtures.sh" ;;
  '') ;;
  *) echo "arch-check: unknown argument '$1' (use --fixtures)" >&2; exit 2 ;;
esac

# prototype/ is never a cruise source: it is only ever a (forbidden) import target.
SCOPE=(apps packages tools/codegen)
echo "==> depcruise --config tools/depcruise/rules.cjs ${SCOPE[*]}"
pnpm exec depcruise --config tools/depcruise/rules.cjs "${SCOPE[@]}"

echo "==> no-utils-dirs (directory scan)"
banned="$(find apps packages workers -type d \( -name utils -o -name helpers -o -name common \) \
  -not -path '*/node_modules/*' -not -path '*/.venv/*' -not -path '*/dist/*' -not -path '*/gen/*' \
  -not -path '*/generated/*' -not -path '*/.expo/*' -not -path '*/android/*' -not -path '*/ios/*' \
  2>/dev/null || true)"
if [[ -n "$banned" ]]; then
  echo "error no-utils-dirs: banned directory (04 §4.4 — keep helpers with the concept they serve):" >&2
  echo "$banned" >&2
  exit 1
fi
echo "arch-check: ok"
