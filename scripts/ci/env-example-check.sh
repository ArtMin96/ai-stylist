#!/usr/bin/env bash
# just ci-env-example-check — every env key the API source reads is declared in .env.example
# (pr-gate.yml; NFR: .env.example is exhaustive, zero values). Keys are the upper-case names
# referenced as process.env.FOO, process.env['FOO'] or env.FOO under apps/api/src.
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
cd "$REPO_ROOT"

src=apps/api/src
if [[ ! -d "$src" ]]; then
  echo "::notice::$src does not exist yet - nothing to check"
  exit 0
fi
referenced="$(grep -rhoE "(process\.env|\benv)(\.[A-Z][A-Z0-9_]*|\[['\"][A-Z][A-Z0-9_]*['\"]\])" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' "$src" \
  | sed -E "s/^(process\.env|env)//; s/^\.//; s/^\[['\"]//; s/['\"]\]$//" \
  | sort -u || true)"
if [[ -z "$referenced" ]]; then
  echo "No env keys referenced under $src."
  exit 0
fi
if [[ ! -f .env.example ]]; then
  echo "::error::.env.example is missing but $src references env keys:"
  echo "$referenced"
  exit 1
fi
declared="$(grep -oE '^[A-Z][A-Z0-9_]*=' .env.example | sed 's/=$//' | sort -u)"
missing="$(comm -23 <(echo "$referenced") <(echo "$declared") || true)"
if [[ -n "$missing" ]]; then
  echo "::error::.env.example is missing keys referenced under $src (NFR: .env.example must be exhaustive, zero values):"
  while IFS= read -r key; do printf '  - %s\n' "$key"; done <<<"$missing"
  echo "Add each key as 'KEY=' (no value) to .env.example."
  exit 1
fi
echo "All $(echo "$referenced" | wc -l | tr -d ' ') referenced keys are declared in .env.example."
