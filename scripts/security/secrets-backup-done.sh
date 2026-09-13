#!/usr/bin/env bash
# Record that the resolved age identity has been backed up in the team password manager
# (planning/15 §6, plan s2-automated-secrets-onboarding T5). Usage: scripts/security/secrets-backup-done.sh
# Writes today's UTC date (nothing else) into the marker file secrets_backup_marker names, mode 600.
# `just doctor` checks that marker and stops warning once it exists; this script writes no key
# material, ever. Idempotent: re-running rewrites the date.
set -euo pipefail

# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/secrets-lib.sh"
ROOT="$(secrets_root)"
cd "$ROOT"

path="$(secrets_identity_file)"

if secrets_identity_from_env; then
    echo "error: SOPS_AGE_KEY holds the identity in the environment, not a file — nothing to record" >&2
    exit 1
fi
if [[ ! -f "$path" ]]; then
    echo "error: no age identity at $path — run 'just bootstrap' first" >&2
    exit 1
fi

marker="$(secrets_backup_marker)"
today="$(date -u +%Y-%m-%d)"
printf '%s\n' "$today" > "$marker"
chmod 600 "$marker"

echo "recorded $marker ($today) — 'just doctor' will stop warning"
