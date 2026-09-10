#!/usr/bin/env bash
# Edit secrets/<env>.enc.yaml through sops (planning/15 §6, P02 T02).
# Usage: scripts/security/secrets-edit.sh [dev|staging|prod]
# First run for an environment: creates the file from the .env.example key list (every key,
# empty value) encrypted for the recipients in .sops.yaml, then opens it in $EDITOR like every
# later run. Save + quit re-encrypts; commit the encrypted file through a PR.
set -euo pipefail

# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/secrets-lib.sh"
ROOT="$(secrets_root)"
cd "$ROOT"

secrets_select_env "${1:-dev}"
secrets_require_tools
secrets_require_recipients

if [[ ! -f "$ENC_FILE" ]]; then
    tmp="$(mktemp -d)"
    chmod 700 "$tmp"
    trap 'rm -rf "$tmp"' EXIT
    {
        echo "# $ENV_NAME secrets. Keys mirror .env.example; leave a value empty to keep each developer's local .env value."
        grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.example | sed -E 's/=.*$/: ""/'
    } > "$tmp/template.yaml"
    # --filename-override picks the creation_rules entry (recipients) for the final path.
    # Encrypt to a temp file first so a failure never leaves an empty/plaintext $ENC_FILE behind.
    sops --encrypt --input-type yaml --output-type yaml --filename-override "$ENC_FILE" "$tmp/template.yaml" > "$tmp/encrypted.yaml"
    mv "$tmp/encrypted.yaml" "$ENC_FILE"
    echo "created $ENC_FILE with $(grep -c '^[A-Za-z_][A-Za-z0-9_]*: ' "$tmp/template.yaml") empty keys from .env.example (encrypted for the $ENV_NAME recipients in .sops.yaml)"
fi

secrets_require_identity
echo "opening $ENC_FILE in \${EDITOR:-vi} via sops; save and quit to re-encrypt"
# sops exits 200 when the editor closed without changes; that is not an error here.
sops "$ENC_FILE" || { rc=$?; [[ $rc -eq 200 ]] && echo "no changes to $ENC_FILE" || exit $rc; }
