#!/usr/bin/env bash
# `just repo-setup secrets [--apply [--replace]] [--offline]`: the GitHub Actions secrets and
# variables of the repository `origin` points at, set from secrets/dev.enc.yaml and driven by the
# manifest tools/github/actions-secrets.txt (docs/NEW-REPO-SETUP.md section 8; guide:
# tools/github/README.md).
#
# Without --apply (or with --check): a report by name, nothing is sent. It compares the names
# GitHub has with the names the manifest asks for and exits 1 on drift:
#   missing    the manifest asks for the name and GitHub does not have it
#   forbidden  GitHub has a name from the manifest's `never` list
# --apply    sends each missing name whose SOURCE is dev:KEY and whose KEY holds a value in
#            secrets/dev.enc.yaml. A name GitHub already has is left alone: a secret cannot be read
#            back, so there is nothing to compare, and a second run sends nothing.
# --replace  with --apply: also sends again every dev:KEY name GitHub already has (after a
#            credential was rotated). The value in secrets/dev.enc.yaml wins.
# --offline  only checks the manifest against .env.example and .github/workflows/**: no gh, no
#            network, nothing decrypted. The same check runs first in every other mode.
#
# Never sent, whatever the flags: a `manual` entry (the CI-only metrics token, the CI age
# identity), a name on the `never` list, a KEY on the `never-from-dev` list, and any key the
# manifest does not name. Nothing is ever deleted on GitHub: a forbidden name is reported with
# the command that removes it.
#
# Where a value travels: from sops's standard output into gh's standard input, through one pipe.
# It is never a command argument (so never in a process list), never in a shell variable or the
# environment, never printed and never in a file: this script holds no value at any point, and it
# uses no here-string or here-document (bash 3.2 backs those with a temp file). The output of sops
# and of `gh secret set` / `gh variable set` is discarded on every send, because sops can format a
# value into an error. Whether a key holds a value is read from the encrypted file's plaintext key
# names (secrets_shared_key_states), without decrypting. Output is names and counts only.
#
# --apply is owner-run: it refuses inside an AI agent session, and the repo's Bash guard
# (scripts/hooks/guard-bash.sh) refuses agents the gh commands it runs.
# Needs gh (not pinned in mise.toml: any version with `gh secret list --json`, 2.43 or later) with
# a login that has admin rights on the repository; --apply also needs sops, age and an identity
# that decrypts the dev file. Exit codes: 0 no drift · 1 drift, refused or failed · 2 wrong usage.
set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
# shellcheck source=scripts/github-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../github-lib.sh"
# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/secrets-lib.sh"
cd "$(secrets_root)"

MANIFEST='tools/github/actions-secrets.txt'

usage_error() {
    echo "repo-setup secrets: $1" >&2
    echo "usage: just repo-setup secrets [--apply [--replace]]   (no --apply = report only: compares names, sends nothing)" >&2
    echo "       just repo-setup secrets --offline                (checks the manifest against .env.example and the workflows; no network)" >&2
    exit 2
}

apply=0; check=0; replace=0; offline=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply) apply=1 ;;
        --check) check=1 ;;
        --replace) replace=1 ;;
        --offline) offline=1 ;;
        *) usage_error "unknown argument (a value is never an argument: it comes from secrets/dev.enc.yaml)" ;;
    esac
    shift
done
if [[ $apply -eq 1 && $check -eq 1 ]]; then usage_error "--apply and --check exclude each other"; fi
if [[ $offline -eq 1 && $((apply + replace)) -gt 0 ]]; then usage_error "--offline takes no other flag"; fi
if [[ $apply -eq 1 ]]; then github_owner_only "just repo-setup secrets --apply" || exit 1; fi

# --- the manifest --------------------------------------------------------------------------------

m_kind=(); m_name=(); m_source=(); m_need=(); m_after=(); m_unread=(); m_line=()
automatic=""; never=""; never_from_dev=""
problems=""
problem() { problems="${problems:+$problems$'\n'}$1"; }

manifest_load() {
    local line n=0 kind name source need flag after unread
    while IFS= read -r line || [[ -n "$line" ]]; do
        n=$((n + 1))
        line="${line%%#*}"
        set -f
        # shellcheck disable=SC2086  # split the entry into its fields; globbing is off
        set -- $line
        set +f
        [[ $# -gt 0 ]] || continue
        kind="$1"; name="${2:-}"
        case "$name" in
            '' | [!A-Za-z_]* | *[!A-Za-z0-9_]*)
                problem "$MANIFEST:$n: a '$kind' entry needs a name of letters, digits and underscores"
                continue
                ;;
        esac
        case "$kind" in
            automatic) automatic="$automatic"$'\n'"$name" ;;
            never) never="$never"$'\n'"$name" ;;
            never-from-dev) never_from_dev="$never_from_dev"$'\n'"$name" ;;
            secret | variable)
                source="${3:-}"; need="${4:-}"; after=""; unread=0
                case "$source" in
                    manual | dev:?*) ;;
                    *) problem "$MANIFEST:$n: $name: SOURCE must be dev:KEY or manual"; continue ;;
                esac
                case "$need" in
                    required | optional) ;;
                    *) problem "$MANIFEST:$n: $name: the fourth field must be required or optional"; continue ;;
                esac
                shift 4
                for flag in "$@"; do
                    case "$flag" in
                        after=?*) after="${flag#after=}" ;;
                        unread) unread=1 ;;
                        *) problem "$MANIFEST:$n: $name: unknown flag '$flag' (after=NAME or unread)" ;;
                    esac
                done
                m_kind+=("$kind"); m_name+=("$name"); m_source+=("$source"); m_need+=("$need")
                m_after+=("$after"); m_unread+=("$unread"); m_line+=("$n")
                ;;
            *) problem "$MANIFEST:$n: unknown entry kind '$kind' (secret, variable, automatic, never, never-from-dev)" ;;
        esac
    done < "$MANIFEST"
}

# "secret NAME" / "variable NAME" for every secrets.NAME and vars.NAME a workflow or a composite
# action reads. Comment lines are skipped; `needs.secrets.result` (a job id) is not a reference.
workflow_refs() {
    [[ -d .github ]] || return 0
    # shellcheck disable=SC2016  # awk source
    { find .github/workflows .github/actions -type f \( -name '*.yml' -o -name '*.yaml' \) -exec awk '
        /^[[:space:]]*#/ { next }
        {
            line = $0
            while (match(line, /(secrets|vars)\.[A-Za-z_][A-Za-z0-9_]*/)) {
                pre = (RSTART == 1) ? "" : substr(line, RSTART - 1, 1)
                tok = substr(line, RSTART, RLENGTH)
                if (pre !~ /[A-Za-z0-9_.]/) {
                    kind = (tok ~ /^secrets\./) ? "secret" : "variable"
                    sub(/^[a-z]+\./, "", tok)
                    print kind, tok
                }
                line = substr(line, RSTART + RLENGTH)
            }
        }' {} + 2>/dev/null || true; } | sort -u
}

# Returns 0 when the manifest has a <kind $1> entry named $2.
has_entry() {
    local i=0
    while [[ $i -lt ${#m_name[@]} ]]; do
        if [[ "${m_kind[$i]}" == "$1" && "${m_name[$i]}" == "$2" ]]; then return 0; fi
        i=$((i + 1))
    done
    return 1
}

# Offline: the manifest against itself, .env.example and the workflows. Fills $problems.
manifest_validate() {
    local i=0 declared machine_local refs seen="" name kind key where ref old_ifs
    declared="$(secrets_example_keys)"
    machine_local="$(secrets_machine_local_keys)"
    refs="$(workflow_refs)"
    while [[ $i -lt ${#m_name[@]} ]]; do
        name="${m_name[$i]}"; kind="${m_kind[$i]}"; where="$MANIFEST:${m_line[$i]}: $name"
        if secrets_list_has "$seen" "$name"; then problem "$where: listed more than once"; fi
        seen="$seen"$'\n'"$name"
        if secrets_list_has "$never" "$name"; then problem "$where: is on the never list, so it cannot have a $kind entry"; fi
        if secrets_list_has "$automatic" "$name"; then problem "$where: GitHub provides it (automatic), so it cannot have a $kind entry"; fi
        case "${m_source[$i]}" in
            dev:*)
                key="${m_source[$i]#dev:}"
                if secrets_list_has "$never" "$key" || secrets_list_has "$never_from_dev" "$key"; then
                    problem "$where: its SOURCE $key must never be sent to GitHub (never / never-from-dev list)"
                elif ! secrets_list_has "$declared" "$key"; then
                    problem "$where: its SOURCE $key is not a key of .env.example"
                elif secrets_list_has "$machine_local" "$key"; then
                    problem "$where: its SOURCE $key is tagged [machine-local] in .env.example: every machine keeps its own value"
                fi
                ;;
        esac
        if [[ -n "${m_after[$i]}" ]] && ! has_entry secret "${m_after[$i]}" && ! has_entry variable "${m_after[$i]}"; then
            problem "$where: after=${m_after[$i]} names no secret or variable entry"
        fi
        if secrets_list_has "$refs" "$kind $name"; then
            if [[ "${m_unread[$i]}" -eq 1 ]]; then problem "$where: flagged unread, but a workflow reads it: drop the flag"; fi
        elif [[ "${m_unread[$i]}" -eq 0 ]]; then
            problem "$where: no workflow reads this $kind (flag it unread, or remove the entry)"
        fi
        i=$((i + 1))
    done
    old_ifs="$IFS"; IFS=$'\n'
    set -f
    for ref in $refs; do
        kind="${ref%% *}"; name="${ref#* }"
        if secrets_list_has "$never" "$name"; then
            problem ".github: a workflow reads $name as a $kind, which must never be in GitHub ($MANIFEST never list)"
        elif [[ "$kind" == secret ]] && secrets_list_has "$automatic" "$name"; then
            :
        elif ! has_entry "$kind" "$name"; then
            problem ".github: a workflow reads $name as a $kind, and $MANIFEST has no '$kind $name' entry"
        fi
    done
    set +f
    IFS="$old_ifs"
}

[[ -f "$MANIFEST" ]] || { echo "error: $MANIFEST not found" >&2; exit 1; }
[[ -f .env.example ]] || { echo "error: .env.example not found (the manifest's dev:KEY sources are checked against it)" >&2; exit 1; }
manifest_load
manifest_validate
if [[ -n "$problems" ]]; then
    printf '%s\n' "$problems" | awk '{ print "ERROR " $0 }' >&2
    echo "repo-setup secrets: $(printf '%s\n' "$problems" | awk 'END { print NR }') problem(s) in the manifest, nothing sent" >&2
    exit 1
fi
if [[ $offline -eq 1 ]]; then
    echo "repo-setup secrets --offline: $MANIFEST matches .env.example and the workflows (${#m_name[@]} secret and variable entries)"
    exit 0
fi

# --- what GitHub has, by name --------------------------------------------------------------------

REPO_SLUG="$(github_origin_slug)" || {
    echo "error: origin is missing or is not a github.com remote" >&2
    echo "  check: $GITHUB_ORIGIN_FIX" >&2
    exit 1
}
github_require_cli || exit 1

# The names of the repository's Actions secrets ($1 = secret) or variables ($1 = variable).
gh_names() { gh "$1" list --repo "$REPO_SLUG" --json name --jq '.[].name' 2>/dev/null; }

if ! gh_secrets="$(gh_names secret)" || ! gh_variables="$(gh_names variable)"; then
    echo "error: GitHub did not list the Actions secrets and variables of $REPO_SLUG" >&2
    echo "  the repository does not exist, the logged-in account has no admin rights on it, or the network is down" >&2
    echo "  check: gh auth status ; gh repo view $REPO_SLUG" >&2
    exit 1
fi

secrets_select_env dev
shared=""
if [[ -f "$ENC_FILE" ]]; then shared="$(secrets_shared_key_states)"; fi

# Returns 0 when GitHub has <kind $1> named $2.
on_github() {
    if [[ "$1" == secret ]]; then secrets_list_has "$gh_secrets" "$2"; else secrets_list_has "$gh_variables" "$2"; fi
}

# --- plan: one state per entry --------------------------------------------------------------------
#   present  GitHub has it                         send     missing; its dev key holds a value
#   resend   GitHub has it; --replace sends again  novalue  missing; its dev key is empty or absent
#   manual   missing; only the owner can set it    waiting  its after=NAME is not on GitHub yet

m_state=()
n_send=0; n_resend=0; n_present=0; n_optional=0; n_by_hand=0; n_no_value=0; n_waiting=0
i=0
while [[ $i -lt ${#m_name[@]} ]]; do
    kind="${m_kind[$i]}"; name="${m_name[$i]}"; source="${m_source[$i]}"; state=""
    has_value=0
    if [[ "$source" == dev:* ]] && secrets_list_has "$shared" "${source#dev:} set"; then has_value=1; fi
    if on_github "$kind" "$name"; then
        if [[ $replace -eq 1 && $has_value -eq 1 ]]; then state=resend; n_resend=$((n_resend + 1)); else state=present; n_present=$((n_present + 1)); fi
    elif [[ -n "${m_after[$i]}" ]] && ! on_github secret "${m_after[$i]}" && ! on_github variable "${m_after[$i]}"; then
        state=waiting
        if [[ "${m_need[$i]}" == required ]]; then n_waiting=$((n_waiting + 1)); else n_optional=$((n_optional + 1)); fi
    elif [[ "$source" == manual ]]; then
        state=manual
        if [[ "${m_need[$i]}" == required ]]; then n_by_hand=$((n_by_hand + 1)); else n_optional=$((n_optional + 1)); fi
    elif [[ $has_value -eq 1 ]]; then
        state=send; n_send=$((n_send + 1))
    else
        state=novalue
        if [[ "${m_need[$i]}" == required ]]; then n_no_value=$((n_no_value + 1)); else n_optional=$((n_optional + 1)); fi
    fi
    m_state+=("$state")
    i=$((i + 1))
done

# --- before the first send: the dev file must decrypt ----------------------------------------------

if [[ $apply -eq 1 && $((n_send + n_resend)) -gt 0 ]]; then
    secrets_require_tools
    secrets_require_recipients
    secrets_require_identity
    # shellcheck disable=SC2119  # the environment is already selected (dev)
    if ! secrets_can_decrypt; then
        echo "error: could not read $ENC_FILE with your identity (sops's output is hidden so that no value can leak) — 'just doctor' names what is missing; nothing was sent" >&2
        exit 1
    fi
fi

# The value of dev key $3 becomes <kind $1> $2 on GitHub. One pipe: sops writes the value (the
# bytes of the string, no newline after it: the suite pins that), and gh, called without --body,
# reads it on standard input.
send_value() {
    "$SECRETS_SOPS" --decrypt --extract "[\"$3\"]" "$ENC_FILE" 2>/dev/null \
        | gh "$1" set "$2" --repo "$REPO_SLUG" >/dev/null 2>&1
}

send_failed() {
    echo "error: could not set the $1 $2 on $REPO_SLUG (the output of sops and gh is hidden so that no value can leak)" >&2
    echo "  check: gh auth status ; gh api repos/$REPO_SLUG --jq .permissions.admin   (must print true) ; just doctor   (the dev file must decrypt)" >&2
    echo "  names already sent in this run stay set; run the command again once this is fixed" >&2
    exit 1
}

row() { printf '  %-9s %-8s %-28s %s\n' "$1" "$2" "$3" "${4:-}"; }

# --- report, and with --apply the sends -------------------------------------------------------------

if [[ $apply -eq 1 ]]; then
    echo "repo-setup secrets: $REPO_SLUG (the repository origin points at) — sending from $ENC_FILE"
else
    echo "repo-setup secrets: $REPO_SLUG (the repository origin points at) — report only, nothing is sent without --apply"
fi
i=0
while [[ $i -lt ${#m_name[@]} ]]; do
    kind="${m_kind[$i]}"; name="${m_name[$i]}"; key="${m_source[$i]#dev:}"; need="${m_need[$i]}"
    case "${m_state[$i]}" in
        present) row ok "$kind" "$name" ;;
        send)
            if [[ $apply -eq 1 ]]; then
                send_value "$kind" "$name" "$key" || send_failed "$kind" "$name"
                row set "$kind" "$name" "from $ENC_FILE ($key)"
            else
                row missing "$kind" "$name" "--apply sets it from $ENC_FILE ($key)"
            fi
            ;;
        resend)
            if [[ $apply -eq 1 ]]; then
                send_value "$kind" "$name" "$key" || send_failed "$kind" "$name"
                row replaced "$kind" "$name" "from $ENC_FILE ($key)"
            else
                row ok "$kind" "$name" "--apply --replace sends it again from $ENC_FILE ($key)"
            fi
            ;;
        novalue)
            if [[ "$need" == required ]]; then
                row missing "$kind" "$name" "$ENC_FILE holds no value for $key: store one first with 'just secrets-push --set $key'"
            else
                row skipped "$kind" "$name" "optional; $ENC_FILE holds no value for $key"
            fi
            ;;
        manual)
            if [[ "$need" == required ]]; then
                row missing "$kind" "$name" "set by hand, never by this command: see its entry in $MANIFEST"
            else
                row skipped "$kind" "$name" "optional; set by hand when needed: see its entry in $MANIFEST"
            fi
            ;;
        waiting) row waiting "$kind" "$name" "sent once ${m_after[$i]} exists on GitHub" ;;
    esac
    i=$((i + 1))
done

# Names GitHub has that must never be there, and names the manifest does not know.
n_forbidden=0
old_ifs="$IFS"; IFS=$'\n'
set -f
for name in $gh_secrets; do
    if secrets_list_has "$never" "$name"; then
        n_forbidden=$((n_forbidden + 1))
        row forbidden secret "$name" "must never be in GitHub; remove it with: gh secret delete $name --repo $REPO_SLUG"
    elif ! has_entry secret "$name"; then
        row unlisted secret "$name" "on GitHub, not in $MANIFEST (left alone)"
    fi
done
for name in $gh_variables; do
    if secrets_list_has "$never" "$name"; then
        n_forbidden=$((n_forbidden + 1))
        row forbidden variable "$name" "must never be in GitHub; remove it with: gh variable delete $name --repo $REPO_SLUG"
    elif ! has_entry variable "$name"; then
        row unlisted variable "$name" "on GitHub, not in $MANIFEST (left alone)"
    fi
done
set +f
IFS="$old_ifs"

by_hand=$((n_by_hand + n_no_value + n_waiting))
if [[ $apply -eq 1 ]]; then
    echo "repo-setup secrets: $n_send set, $n_resend replaced; $n_present already there, $n_optional optional not set; $by_hand still missing, $n_forbidden forbidden"
    if [[ $by_hand -gt 0 ]]; then echo "  still missing: the 'missing' and 'waiting' lines above say what each one needs"; fi
    if [[ $((by_hand + n_forbidden)) -gt 0 ]]; then exit 1; fi
    echo "  check: just repo-setup secrets   (a value cannot be read back; the next run of ios or android on main is the real test)"
    exit 0
fi

echo "repo-setup secrets: $n_send to set from $ENC_FILE, $by_hand that need you first, $n_forbidden forbidden; $((n_present + n_resend)) ok, $n_optional optional not set"
if [[ $n_send -gt 0 ]]; then echo "  to set them: just repo-setup secrets --apply"; fi
if [[ $((n_send + by_hand + n_forbidden)) -gt 0 ]]; then exit 1; fi
echo "  GitHub has every name $MANIFEST asks for"
