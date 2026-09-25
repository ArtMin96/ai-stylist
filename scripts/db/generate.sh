#!/usr/bin/env bash
# just db-generate <name> — wraps `drizzle-kit generate --name <name>` for packages/db
# (planning/06 §7, expand-contract migrations). `--name` is drizzle-kit's documented flag for a
# custom migration file name (orm.drizzle.team/docs/pg/drizzle-kit-generate, checked 2026-09-13);
# packages/db already exposes the same invocation as its `migration:generate` script.
# Usage: scripts/db/generate.sh <name>
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
cd "$REPO_ROOT"

if [[ $# -ne 1 || -z "$1" || "$1" == -* ]]; then
  echo "usage: just db-generate <name>" >&2
  exit 2
fi
name="$1"

migrations_before="$(find packages/db/migrations -maxdepth 1 -name '*.sql' | LC_ALL=C sort)"
pnpm --filter @ai-stylist/db migration:generate --name "$name"
migrations_after="$(find packages/db/migrations -maxdepth 1 -name '*.sql' | LC_ALL=C sort)"

new_migration="$(comm -13 <(printf '%s\n' "$migrations_before") <(printf '%s\n' "$migrations_after") | head -n1)"
if [[ -n "$new_migration" ]]; then
  idx="$(basename "$new_migration" | cut -d_ -f1)"
  log "db-generate: add packages/db/migrations/down/$idx.sql before this migration ships — just db-rollback needs it (expand-contract convention)."
else
  warn "db-generate: no new migration file appeared under packages/db/migrations (no schema changes?) — skip the down file."
fi
