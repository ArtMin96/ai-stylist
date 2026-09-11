#!/usr/bin/env bash
# Re-wrap secrets/<env>.enc.yaml for the current recipient list in .sops.yaml (sops updatekeys).
# This is the `just` helper planning/15 §6 names for onboarding and access removal: edit .sops.yaml,
# run this, commit .sops.yaml together with the re-wrapped files through a PR.
# Usage: scripts/security/secrets-updatekeys.sh [dev|staging|prod ...]   (no argument = every existing file)
# Needs an identity that can decrypt the files today (SOPS_AGE_KEY, SOPS_AGE_KEY_FILE, or the default
# keys file); a recipient alone cannot re-wrap. Only the per-file data key is re-wrapped: values are
# never decrypted to disk and never printed.
set -euo pipefail

# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/secrets-lib.sh"
ROOT="$(secrets_root)"
cd "$ROOT"

secrets_require_tools
secrets_require_identity

files=""
if [[ $# -eq 0 ]]; then
    for f in secrets/*.enc.yaml; do
        [[ -f "$f" ]] && files="$files $f"
    done
    if [[ -z "$files" ]]; then
        echo "error: no secrets/*.enc.yaml to re-wrap — create one with 'just secrets-edit <env>' (see $SECRETS_DOC)" >&2
        exit 1
    fi
else
    for env_arg in "$@"; do
        secrets_select_env "$env_arg"
        if [[ ! -f "$ENC_FILE" ]]; then
            echo "error: $ENC_FILE does not exist — create it with 'just secrets-edit $ENV_NAME' (see $SECRETS_DOC)" >&2
            exit 1
        fi
        files="$files $ENC_FILE"
    done
fi

for f in $files; do
    env_name="$(basename "$f" .enc.yaml)"
    secrets_select_env "$env_name"
    secrets_require_recipients
    # -y: non-interactive. sops prints only the recipient diff (public keys), never a value.
    sops updatekeys -y "$f"
    echo "secrets-updatekeys: $f re-wrapped for $(secrets_recipient_count) $ENV_NAME recipient(s) in .sops.yaml"
done
echo "commit .sops.yaml together with the re-wrapped file(s); every holder of a listed identity can now decrypt"
