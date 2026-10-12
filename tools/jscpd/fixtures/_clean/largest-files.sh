#!/usr/bin/env bash
# Clone-check fixture (tools/jscpd/README.md): unrelated to every other `_clean` file.
# Usage: largest-files.sh <dir> [count]
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: largest-files.sh <dir> [count]" >&2
  exit 2
fi
dir="$1"
count="${2:-5}"

find "$dir" -type f -exec wc -c {} + | grep -v ' total$' | sort -rn | head -n "$count"
