#!/usr/bin/env bash
# Shared checks for secrets-sync.sh / secrets-edit.sh (sops + age, planning/15 §6).
# Sourced, not executed. Every function prints an actionable message and returns 1 on failure;
# none of them ever prints a secret value.

SECRETS_DOC="docs/SERVICES-SETUP.md §2"

secrets_root() {
    cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

# Validate the environment name and set ENV_NAME / ENC_FILE.
secrets_select_env() {
    ENV_NAME="${1:-dev}"
    case "$ENV_NAME" in
        dev|staging|prod) ;;
        *) echo "error: unknown environment '$ENV_NAME' (use dev|staging|prod)" >&2; return 1 ;;
    esac
    ENC_FILE="secrets/$ENV_NAME.enc.yaml"
}

secrets_require_tools() {
    local missing=0
    for tool in sops age; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            echo "error: '$tool' is not on PATH; it is pinned in mise.toml -> run 'mise install' (or 'just bootstrap')" >&2
            missing=1
        fi
    done
    return $missing
}

# Count the age recipients configured for ENC_FILE in .sops.yaml (the creation_rules block whose
# path_regex names this file). Placeholders and '# ADD RECIPIENTS' comments do not count.
secrets_recipient_count() {
    awk -v file="$ENC_FILE" '
        /^[[:space:]]*-[[:space:]]*path_regex:/ {
            regex = $0; sub(/^[^:]*:[[:space:]]*/, "", regex); gsub(/["\x27]/, "", regex)
            gsub(/\\\./, ".", regex)
            in_rule = (file ~ regex)
            next
        }
        in_rule && /^[[:space:]]*-[[:space:]]*age1[0-9a-z]{58}[[:space:]]*$/ { n++ }
        END { print n + 0 }
    ' .sops.yaml
}

secrets_require_recipients() {
    local n
    n="$(secrets_recipient_count)"
    if [[ "$n" -eq 0 ]]; then
        echo "error: no age recipients in .sops.yaml for $ENC_FILE — follow $SECRETS_DOC" >&2
        echo "  (generate a key with 'age-keygen -o ~/.config/sops/age/keys.txt', put its 'age1...' public key under the '# ADD RECIPIENTS' line for $ENV_NAME, then re-run)" >&2
        return 1
    fi
}

# sops finds an age identity via SOPS_AGE_KEY, SOPS_AGE_KEY_FILE, or the default keys file
# (https://getsops.io/docs/usage/identities/age/, checked 2026-09-10). Same order here.
secrets_require_identity() {
    local default_file="${XDG_CONFIG_HOME:-$HOME/.config}/sops/age/keys.txt"
    if [[ -n "${SOPS_AGE_KEY:-}" ]]; then
        return 0
    elif [[ -n "${SOPS_AGE_KEY_FILE:-}" ]]; then
        [[ -f "$SOPS_AGE_KEY_FILE" ]] && return 0
        echo "error: SOPS_AGE_KEY_FILE=$SOPS_AGE_KEY_FILE does not exist" >&2
        return 1
    elif [[ -f "$default_file" ]]; then
        return 0
    fi
    echo "error: no age private key found (checked \$SOPS_AGE_KEY, \$SOPS_AGE_KEY_FILE, $default_file) — follow $SECRETS_DOC" >&2
    echo "  local: 'mkdir -p ~/.config/sops/age && age-keygen -o ~/.config/sops/age/keys.txt'; CI: export the SOPS_AGE_KEY repository secret" >&2
    return 1
}
