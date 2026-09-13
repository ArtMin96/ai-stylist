#!/usr/bin/env bash
# Shared checks and helpers for the secrets-management scripts (sops + age, planning/15 §6):
# secrets-sync.sh, secrets-edit.sh, secrets-updatekeys.sh, and the onboarding scripts built on top
# of this file. Sourced, not executed. Every function prints an actionable message and returns 1 on
# failure; none of them ever prints a secret value. All of it is bash 3.2-clean (macOS default
# /bin/bash): no associative arrays, no mapfile, no ${var,,}, no grep -P; awk avoids ERE intervals
# (macOS's bwk awk only gained them in 2019) in favour of an explicit length() test.

SECRETS_DOC="docs/SERVICES-SETUP.md §2"

# Tool indirection: callers that run without mise on PATH (doctor via secrets_tool) can point these
# at absolute paths. Every other function below calls the tool through these, never the bare name.
SECRETS_SOPS="${SECRETS_SOPS:-sops}"
SECRETS_AGE_KEYGEN="${SECRETS_AGE_KEYGEN:-age-keygen}"

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

# A usable path for binary <name>: `command -v` when the result is not a mise shim (shims are
# cwd-bound and useless once resolved outside the repo); otherwise `mise which <name>` (needs cwd to
# be the repo); otherwise the bare name, when `command -v` at least found a shim to fall back to.
# Returns 1 with a message on stderr when none of those resolve anything.
secrets_tool() {
    local name="$1" mise_bin cmd_path mise_path
    mise_bin="${MISE_BIN:-$HOME/.local/bin/mise}"
    cmd_path="$(command -v "$name" 2>/dev/null || true)"
    if [[ -n "$cmd_path" && "$cmd_path" != */mise/shims/* ]]; then
        printf '%s\n' "$cmd_path"
        return 0
    fi
    if [[ -x "$mise_bin" ]]; then
        mise_path="$("$mise_bin" which "$name" 2>/dev/null || true)"
        if [[ -n "$mise_path" ]]; then
            printf '%s\n' "$mise_path"
            return 0
        fi
    fi
    if [[ -n "$cmd_path" ]]; then
        printf '%s\n' "$name"
        return 0
    fi
    echo "error: '$name' is not on PATH and mise could not resolve it — run 'just bootstrap'" >&2
    return 1
}

# The bare age1... recipients (no leading '- ', one per line) of the .sops.yaml creation_rules block
# whose path_regex matches ENC_FILE. Takes an optional [env] to select first; otherwise uses whatever
# secrets_select_env already set. Prints nothing when no rule matches or the rule lists no recipient.
# shellcheck disable=SC2120 # some callers rely on ENV_NAME already being selected and pass nothing
secrets_rule_recipients() {
    if [[ $# -gt 0 ]]; then
        secrets_select_env "$1" || return 1
    fi
    awk -v file="$ENC_FILE" '
        /^[[:space:]]*-[[:space:]]*path_regex:/ {
            regex = $0; sub(/^[^:]*:[[:space:]]*/, "", regex); gsub(/["\x27]/, "", regex)
            gsub(/\\\./, ".", regex)
            in_rule = (file ~ regex)
            next
        }
        # age public keys are exactly 62 chars ("age1" + 58 bech32 chars); a length test instead of
        # an ERE interval ({58}) because macOS awk (bwk awk) only gained intervals in 2019.
        in_rule && /^[[:space:]]*-[[:space:]]*age1[0-9a-z]+[[:space:]]*$/ {
            key = $0; sub(/^[[:space:]]*-[[:space:]]*/, "", key); sub(/[[:space:]]*$/, "", key)
            if (length(key) == 62) print key
        }
    ' .sops.yaml
}

# Count the age recipients configured for ENC_FILE in .sops.yaml. Placeholders and
# '# ADD RECIPIENTS' comments do not count. `wc -l` is trimmed because BSD wc pads its count with
# leading spaces even when reading from a pipe.
secrets_recipient_count() {
    # shellcheck disable=SC2119
    secrets_rule_recipients | wc -l | awk '{print $1}'
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

# Returns 0 when <pub> is one of secrets_rule_recipients for the currently selected environment.
secrets_recipient_listed() {
    # shellcheck disable=SC2119
    secrets_rule_recipients | grep -Fxq -- "$1"
}

# Returns 0 when <s> is a syntactically plausible age recipient: "age1" followed by exactly 58
# [0-9a-z] characters (length 62 exactly) — the same charset test secrets_rule_recipients uses, not
# the full bech32 alphabet, so the two stay consistent with each other.
secrets_is_age_recipient() {
    local candidate="$1" rest
    [[ "$candidate" == age1* ]] || return 1
    [[ ${#candidate} -eq 62 ]] || return 1
    rest="${candidate#age1}"
    case "$rest" in
        *[!0-9a-z]*) return 1 ;;
    esac
    return 0
}

# Insert a new recipient (and its label comment) directly under the '# ADD RECIPIENTS' marker of the
# .sops.yaml rule matching ENC_FILE, at that marker's indentation. No-op (returns 0) when <pub> is
# already listed. Returns 1 ("no '# ADD RECIPIENTS' marker in the rule for <file>") when the matching
# rule has no such marker to anchor on. <label> is sanitised to [A-Za-z0-9 ._-], collapsed to one
# line and capped at 40 chars so it can never break the YAML or smuggle a control character in.
# Atomic: awk writes into a mode-700 mktemp directory, then `command mv` replaces .sops.yaml — never
# a sed -i, never a partial file visible to a concurrent reader.
secrets_add_recipient() {
    local pub="$1" label="$2" tmp_dir tmp_file

    secrets_recipient_listed "$pub" && return 0

    label="$(printf '%s' "$label" | tr '\n\r\t' ' ')"
    label="$(printf '%s' "$label" | LC_ALL=C sed -E 's/[^A-Za-z0-9 ._-]//g; s/  +/ /g; s/^ +//; s/ +$//')"
    label="${label:0:40}"

    tmp_dir="$(mktemp -d)"
    chmod 700 "$tmp_dir"
    tmp_file="$tmp_dir/sops.yaml"

    if ! awk -v file="$ENC_FILE" -v pub="$pub" -v label="$label" '
        /^[[:space:]]*-[[:space:]]*path_regex:/ {
            regex = $0; sub(/^[^:]*:[[:space:]]*/, "", regex); gsub(/["\x27]/, "", regex)
            gsub(/\\\./, ".", regex)
            in_rule = (file ~ regex)
            print
            next
        }
        {
            print
            if (in_rule && !inserted && $0 ~ /^[[:space:]]*#[[:space:]]*ADD RECIPIENTS/) {
                indent = $0; sub(/[^[:space:]].*$/, "", indent)
                print indent "# developer: " label
                print indent "- " pub
                inserted = 1
            }
        }
        END { if (!inserted) exit 1 }
    ' .sops.yaml > "$tmp_file"; then
        command rm -rf "$tmp_dir"
        echo "error: no '# ADD RECIPIENTS' marker in the rule for $ENC_FILE" >&2
        return 1
    fi

    command mv "$tmp_file" .sops.yaml
    command rm -rf "$tmp_dir"
}

# Make the repo's node_modules visible inside a throwaway worktree. The commit-msg hook runs
# `pnpm exec commitlint` from the commit's cwd (.pre-commit-config.yaml), so a worktree without
# node_modules fails every commit; a symlink keeps the hooks running for real instead of being
# bypassed. node_modules is gitignored, so nothing can be staged through it. No-op when the repo has
# no node_modules (hooks not installed yet) or the worktree already has one.
secrets_link_node_modules() {
    local worktree="$1" root
    root="$(secrets_root)"
    if [[ -d "$root/node_modules" && ! -e "$worktree/node_modules" ]]; then
        ln -s "$root/node_modules" "$worktree/node_modules"
    fi
}

# The identity file sops would use: $SOPS_AGE_KEY_FILE when set, else the default keys file
# (https://getsops.io/docs/usage/identities/age/). Never checks whether the file exists.
secrets_identity_file() {
    if [[ -n "${SOPS_AGE_KEY_FILE:-}" ]]; then
        printf '%s\n' "$SOPS_AGE_KEY_FILE"
    else
        printf '%s\n' "${XDG_CONFIG_HOME:-$HOME/.config}/sops/age/keys.txt"
    fi
}

# Returns 0 when the age private key is passed as environment material ($SOPS_AGE_KEY) rather than a
# file on disk.
secrets_identity_from_env() {
    [[ -n "${SOPS_AGE_KEY:-}" ]]
}

# The path of the marker file that records the identity's backup date: secrets_identity_file with a
# '.backed-up' suffix.
secrets_backup_marker() {
    printf '%s.backed-up\n' "$(secrets_identity_file)"
}

# sops finds an age identity via SOPS_AGE_KEY, SOPS_AGE_KEY_FILE, or the default keys file
# (https://getsops.io/docs/usage/identities/age/, checked 2026-09-10). Same order here.
secrets_require_identity() {
    if [[ -n "${SOPS_AGE_KEY:-}" ]]; then
        return 0
    elif [[ -n "${SOPS_AGE_KEY_FILE:-}" ]]; then
        [[ -f "$SOPS_AGE_KEY_FILE" ]] && return 0
        echo "error: SOPS_AGE_KEY_FILE=$SOPS_AGE_KEY_FILE does not exist" >&2
        return 1
    fi
    local default_file
    default_file="$(secrets_identity_file)"
    [[ -f "$default_file" ]] && return 0
    echo "error: no age private key found (checked \$SOPS_AGE_KEY, \$SOPS_AGE_KEY_FILE, $default_file) — follow $SECRETS_DOC" >&2
    echo "  local: 'mkdir -p ~/.config/sops/age && age-keygen -o ~/.config/sops/age/keys.txt'; CI: export the SOPS_AGE_KEY repository secret" >&2
    return 1
}

# The age1... public key for identity file <file>. Never prints anything but the recipient.
secrets_public_key() {
    "$SECRETS_AGE_KEYGEN" -y "$1"
}

# Returns 0 when ENC_FILE (or [env], if given) decrypts with whatever identity is available to this
# process right now. Output is always discarded — this is a yes/no check, never a place a value could
# leak to the terminal.
secrets_can_decrypt() {
    if [[ $# -gt 0 ]]; then
        secrets_select_env "$1" || return 1
    fi
    "$SECRETS_SOPS" --decrypt --input-type yaml --output-type dotenv "$ENC_FILE" >/dev/null 2>&1
}

# A git-branch-safe slug of <string>: lowercased (tr, not ${var,,} — bash 3.2 has no case-conversion
# expansion), every run of non-[a-z0-9] characters collapsed to a single '-', trimmed of leading and
# trailing '-', capped at 40 chars. Prints "developer" when that leaves nothing.
secrets_slug() {
    local input="$1" slug
    slug="$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]' | LC_ALL=C sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
    slug="${slug:0:40}"
    slug="$(printf '%s' "$slug" | sed -E 's/-+$//')"
    if [[ -z "$slug" ]]; then
        printf 'developer\n'
    else
        printf '%s\n' "$slug"
    fi
}

# The repo's default branch name (no "origin/" prefix), read from the local remote-tracking ref —
# never the network. Prints "main" when that ref does not exist (e.g. a fixture with no fetch yet).
secrets_default_branch() {
    local ref
    if ref="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)"; then
        printf '%s\n' "${ref#origin/}"
    else
        printf 'main\n'
    fi
}

# A GitHub compare URL (.../compare/<base>...<head>?expand=1) for the "origin" remote, accepting
# https://github.com/O/R[.git], git@github.com:O/R[.git], and ssh://git@github.com/O/R[.git].
# Returns 1 and prints nothing when origin is missing or is not a github.com remote.
secrets_github_compare_url() {
    local base="$1" head="$2" url owner_repo
    url="$(git remote get-url origin 2>/dev/null)" || return 1
    case "$url" in
        https://github.com/*)    owner_repo="${url#https://github.com/}" ;;
        git@github.com:*)        owner_repo="${url#git@github.com:}" ;;
        ssh://git@github.com/*)  owner_repo="${url#ssh://git@github.com/}" ;;
        *) return 1 ;;
    esac
    owner_repo="${owner_repo%.git}"
    printf 'https://github.com/%s/compare/%s...%s?expand=1\n' "$owner_repo" "$base" "$head"
}
