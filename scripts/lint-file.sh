#!/usr/bin/env bash
# just lint-file <path> — single-file lint dispatch by extension, for the PostToolUse hook
# (scripts/hooks/*.sh) so one edit pays for one file's lint, not a whole-repo `just lint` turbo
# run. Prints nothing when clean. Dispatch mirrors `just lint`'s tool choice per file type.
# Usage: scripts/lint-file.sh <path>
# Exit: whatever the underlying linter returns; 0 (silently) for extensions with no linter here.
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$REPO_ROOT"

if [[ $# -ne 1 ]]; then
  echo "usage: just lint-file <path>" >&2
  exit 2
fi
path="$1"

case "$path" in
  *.ts | *.tsx | *.mjs | *.cjs)
    pnpm exec eslint --max-warnings=0 "$path"
    ;;
  *.py)
    uv run --project workers ruff check "$path"
    ;;
  *.sh)
    shellcheck -s bash -x -P SCRIPTDIR "$path"
    ;;
  *)
    exit 0
    ;;
esac
