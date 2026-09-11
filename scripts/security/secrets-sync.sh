#!/usr/bin/env bash
# Decrypt secrets/<env>.enc.yaml (sops + age) and merge its keys into the gitignored .env
# (planning/15 §6, P02 T02). Usage: scripts/security/secrets-sync.sh [dev|staging|prod] [--i-know-this-is-not-dev]
#
# Merge semantics (docs/SERVICES-SETUP.md §2, secrets/README.md):
#   - every KEY with a non-empty value in the decrypted file replaces the `KEY=...` line in .env
#     (or is appended when absent); keys whose shared value is empty leave .env untouched;
#   - every other .env line (personal overrides, comments) is kept verbatim;
#   - values are never printed; only key names and counts are.
# staging/prod refuse to run outside CI unless --i-know-this-is-not-dev is passed.
set -euo pipefail

# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/secrets-lib.sh"
ROOT="$(secrets_root)"
cd "$ROOT"

env_arg="dev"; force=0
for arg in "$@"; do
    case "$arg" in
        --i-know-this-is-not-dev) force=1 ;;
        -*) echo "secrets-sync: unknown flag '$arg' (use [dev|staging|prod] [--i-know-this-is-not-dev])" >&2; exit 2 ;;
        *) env_arg="$arg" ;;
    esac
done
secrets_select_env "$env_arg"

if [[ "$ENV_NAME" != "dev" && "${CI:-}" != "true" && $force -ne 1 ]]; then
    echo "error: refusing to write $ENV_NAME secrets into .env on a workstation (planning/15 §6: no prod credentials on workstations)." >&2
    echo "  CI deploy jobs set CI=true; if you really need this locally, re-run with --i-know-this-is-not-dev" >&2
    exit 1
fi

secrets_require_tools
secrets_require_recipients
if [[ ! -f "$ENC_FILE" ]]; then
    echo "error: $ENC_FILE does not exist yet — create it with 'just secrets-edit $ENV_NAME' (see $SECRETS_DOC)" >&2
    exit 1
fi
secrets_require_identity

tmp="$(mktemp -d)"
chmod 700 "$tmp"
trap 'rm -rf "$tmp"' EXIT

# dotenv output turns the flat YAML map into KEY=value lines and drops the sops metadata.
sops --decrypt --input-type yaml --output-type dotenv "$ENC_FILE" > "$tmp/decrypted.env"

if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "created .env from .env.example (it did not exist)"
fi

# Merge with awk: first pass reads the decrypted pairs, second pass rewrites .env in place order.
awk -v report="$tmp/report.txt" '
    FNR == NR {
        if ($0 !~ /^[A-Za-z_][A-Za-z0-9_]*=/) next
        eq = index($0, "="); key = substr($0, 1, eq - 1); val = substr($0, eq + 1)
        if (val == "" || val == "\"\"" || val == "\x27\x27") { skipped[key] = 1; next }
        value[key] = val; order[++n] = key
        next
    }
    {
        line = $0
        if (match(line, /^(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*=/)) {
            prefix = substr(line, RSTART, RLENGTH); key = prefix
            sub(/^export[[:space:]]+/, "", key); sub(/=$/, "", key)
            if (key in value) {
                print prefix value[key]; replaced[key] = 1; delete value[key]
                next
            }
        }
        print line
    }
    END {
        for (i = 1; i <= n; i++) {
            key = order[i]
            if (key in value) { print key "=" value[key]; added[key] = 1 }
        }
        for (k in replaced) print "replaced " k > report
        for (k in added) print "added " k > report
        for (k in skipped) print "skipped " k > report
    }
' "$tmp/decrypted.env" .env > "$tmp/merged.env"

chmod 600 "$tmp/merged.env"
mv "$tmp/merged.env" .env

n_replaced=0 n_added=0 n_skipped=0
if [[ -f "$tmp/report.txt" ]]; then
    awk '$1 != "skipped"' "$tmp/report.txt" | sort | while read -r action key; do echo "  $action $key"; done
    n_replaced=$(grep -c '^replaced ' "$tmp/report.txt" || true)
    n_added=$(grep -c '^added ' "$tmp/report.txt" || true)
    n_skipped=$(grep -c '^skipped ' "$tmp/report.txt" || true)
fi
echo "secrets-sync: merged $ENC_FILE into .env — $n_replaced replaced, $n_added added, $n_skipped skipped (empty in the shared file), other lines untouched"
