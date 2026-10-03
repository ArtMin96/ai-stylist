#!/usr/bin/env bash
# Copy values from the gitignored .env into secrets/<env>.enc.yaml through sops, with no editor and
# no retyping: the reverse of secrets-sync.sh (planning/15 §6).
# Usage: scripts/security/secrets-push.sh [dev] [--apply] [--replace] [--prune [--prune-values]]
#        scripts/security/secrets-push.sh [dev] --set KEY
#
# Without --apply (or with --dry-run): a plan by key name; nothing is written. The other flags
# decide what the plan covers, and --apply then writes exactly that plan.
#   add      the name is declared in .env.example but missing from the shared file
#   fill     the shared value is empty and .env has one
#   differs  .env and the shared file hold different values; shown as "replace" with --replace
#   stale    the shared file has a name .env.example no longer declares, shown with whether it is
#            empty or holds a value, and as "remove" once the flags given cover it
# --apply         adds and fills. A missing name is created even when .env has no value for it
#                 (empty value), so the shared file mirrors .env.example (secrets/README.md). A
#                 shared value that is already set is never changed by --apply alone: a differing
#                 one is left alone and named, with the two ways on (`just secrets-sync` when the
#                 shared value is the newer one, --replace when the one in .env is).
# --replace       also overwrites each differing shared value with the one in .env. It is a flag
#                 of its own because a machine that has not synced since a credential was rotated
#                 elsewhere still holds the old one, and pushing that back hands every other
#                 machine a dead or exposed credential at its next sync.
# --prune         also removes the stale names whose value is empty.
# --prune-values  with --prune only: also removes the stale names that hold a value, and the value
#                 with them. Two flags, so that a .env.example that lost keys (a truncated file, a
#                 bad merge) cannot cost a shared value by itself.
# --set KEY       stores one value that is not in .env: typed at a hidden prompt, or the first line
#                 of standard input when that is not a terminal. It writes at once, replaces the
#                 value KEY has, and takes no other flag. The value is never an argument.
#
# Refused, with nothing written:
#   - a .env.example that is missing or declares no keys: every shared key would look stale;
#   - staging and prod: no production credential belongs on a workstation (planning/15 §6); a
#     deployer sets those through secrets-edit.sh. dev only;
#   - an argument that is not listed above. It is never echoed: `--set KEY VALUE` and
#     `--set KEY=VALUE` are the natural wrong guesses, and both carry a value.
# Never pushed: a key tagged [machine-local] in .env.example, a key with no value in .env (the
# shared value stays as it is), a name .env.example does not declare.
#
# Which .env values are pushed. A value is read by env_file_value (scripts/lib.sh): what follows
# KEY=, minus `export`, a trailing CR, trailing whitespace and one pair of matching quotes.
# secrets-sync.sh writes every value back as a bare KEY=value line, never quoted. So a value is
# pushed only when that bare line gives the same value back (env_file_value_kind says `plain`): an
# unquoted value, or a quoted one that did not need its quotes, which is pushed without them. Any
# other form stops the run and is named by key, because the text on the line is not the value the
# application reads, or would not be after one sync:
#   - a `#` at the start of the value or after whitespace (`KEY=value # note`): dotenv reads it as
#     a comment, and reads it so again once the quotes around it are gone;
#   - a quote that does not close at the end of the line (`KEY="value" # note`, an unclosed
#     quote), or quotes inside quotes;
#   - whitespace at the start of the value, or at either end inside its quotes;
#   - a backslash inside double quotes (a parser may expand an escape such as \n there, and the
#     bare line written back is not quoted);
#   - a control character (a tab counts).
#
# Values are compared with the decrypted shared values inside one awk process and handed to
# `sops set --value-stdin` through a pipe. A value is never printed, never a command argument (so
# never in a process list) and never written to a file in plaintext; that also rules out
# here-strings and here-documents for values, which bash 3.2 backs with a temp file. sops's own
# output is discarded on every call, the decrypt included: sops can format a value into an error.
# Output is key names and counts only, like secrets-sync.sh.
#
# Every write goes to a copy of the shared file (ciphertext) in a mode-700 directory beside it,
# secrets/.push.XXXXXX/, and the copy replaces the file only after every step succeeded, by a
# rename inside one filesystem: the file is at every moment either the old one or the new one.
# (Where TMPDIR is a filesystem of its own, a copy staged there is moved by a copy plus an unlink.)
# The staging path is gitignored (`secrets/*`) and inside the gitleaks allowlist for *.enc.yaml. It
# is removed on every exit, SIGINT, SIGTERM and SIGHUP included; what a killed run (SIGKILL, power
# loss) left behind is removed by the next write.
# Never commits. Exit codes: 0 ok · 1 refused or failed · 2 wrong usage.
set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"
# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/secrets-lib.sh"
ROOT="$(secrets_root)"
cd "$ROOT"

# usage_error <message> [<second line>]
usage_error() {
    echo "secrets-push: $1" >&2
    if [[ -n "${2:-}" ]]; then echo "  $2" >&2; fi
    echo "usage: just secrets-push [dev] [--apply] [--replace] [--prune [--prune-values]]   (no --apply = dry run: lists key names, writes nothing)" >&2
    echo "       just secrets-push [dev] --set KEY   (one value, typed at a hidden prompt or read from standard input; never an argument)" >&2
    exit 2
}

# For an argument this script does not recognise. It is never echoed (see the header).
NOT_SHOWN="the argument is not shown: it could be a value (if it was one, remove that command from your shell history)"

env_arg=""; apply=0; replace=0; prune=0; prune_values=0; dry_run=0; set_mode=0; set_key=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply) apply=1 ;;
        --dry-run) dry_run=1 ;;
        --replace) replace=1 ;;
        --prune) prune=1 ;;
        --prune-values) prune_values=1 ;;
        --set)
            [[ $# -ge 2 ]] || usage_error "--set needs a key name"
            set_mode=1; set_key="$2"
            shift
            ;;
        dev | staging | prod)
            [[ -z "$env_arg" ]] || usage_error "more than one environment name"
            env_arg="$1"
            ;;
        -*) usage_error "unknown flag" "$NOT_SHOWN" ;;
        *) usage_error "unexpected argument (the only one that is not a flag is the environment, dev)" "$NOT_SHOWN" ;;
    esac
    shift
done
env_arg="${env_arg:-dev}"
if [[ $apply -eq 1 && $dry_run -eq 1 ]]; then
    usage_error "--apply and --dry-run exclude each other"
fi
if [[ $prune_values -eq 1 && $prune -eq 0 ]]; then
    usage_error "--prune-values only adds to --prune: give both to remove a stale name that holds a value"
fi
if [[ $set_mode -eq 1 && $((apply + dry_run + replace + prune + prune_values)) -gt 0 ]]; then
    usage_error "--set KEY takes no other flag (it writes that one key)"
fi
if [[ $set_mode -eq 1 ]]; then
    # A glob test, not `=~`: bash 3.2 and later versions disagree on how a regex literal is quoted.
    case "$set_key" in
        '' | [!A-Za-z_]* | *[!A-Za-z0-9_]*) usage_error "--set needs a key name such as GRAFANA_URL, and only the name: the value is typed or piped in" "$NOT_SHOWN" ;;
    esac
fi

secrets_select_env "$env_arg"
if [[ "$ENV_NAME" != "dev" ]]; then
    echo "error: refusing to push a workstation .env into $ENC_FILE (planning/15 §6: no prod credentials on workstations)." >&2
    echo "  $ENV_NAME values are set by a deployer through 'just secrets-edit $ENV_NAME'" >&2
    exit 1
fi

secrets_require_tools
secrets_require_recipients
if [[ ! -f "$ENC_FILE" ]]; then
    echo "error: $ENC_FILE does not exist yet — create it with 'just secrets-edit $ENV_NAME' (see $SECRETS_DOC)" >&2
    exit 1
fi
secrets_require_identity

# The floor under every comparison below: without declared keys every shared key would look stale.
if [[ ! -f .env.example ]]; then
    echo "error: .env.example not found — it is the key list the shared file mirrors; nothing written" >&2
    exit 1
fi
declared="$(secrets_example_keys)"
if [[ -z "$declared" ]]; then
    echo "error: .env.example declares no keys (a truncated file, or a merge in progress?) — refusing to run: every key of $ENC_FILE would look stale" >&2
    echo "  restore .env.example first ('git diff .env.example' shows what changed); nothing written" >&2
    exit 1
fi
machine_local="$(secrets_machine_local_keys)"

# --- the staging copy every sops write goes to ----------------------------------------------------

stage=""
work=""
cleanup() {
    if [[ -n "$stage" ]]; then rm -rf "$stage"; fi
}
# bash runs the EXIT trap as well when SIGINT, SIGTERM or SIGHUP ends the script (the suite sends
# SIGTERM in the middle of a write). No trap on the signals themselves, as in secrets-sync.sh and
# secrets-edit.sh: bash defers a trapped signal until the command in the foreground completes.
trap cleanup EXIT

work_begin() {
    local dir
    dir="$(dirname "$ENC_FILE")"
    # What a killed run left behind (ciphertext only; the glob stays a literal when nothing matches).
    rm -rf "$dir"/.push.*
    stage="$(mktemp -d "$dir/.push.XXXXXX")"
    chmod 700 "$stage"
    work="$stage/$(basename "$ENC_FILE")"
    cp "$ENC_FILE" "$work"
}

# stdin: a JSON value. Sets top-level key $1 in the copy, creating the name when it is absent.
sops_set() {
    "$SECRETS_SOPS" set --idempotent --value-stdin "$work" "[\"$1\"]" >/dev/null 2>&1
}

sops_unset() {
    "$SECRETS_SOPS" unset --idempotent "$work" "[\"$1\"]" >/dev/null 2>&1
}

write_failed() {
    echo "error: sops could not write $1 (its output is hidden so that no value can leak); $ENC_FILE is unchanged" >&2
    echo "  check that the file still decrypts with 'just doctor', or edit it with 'just secrets-edit $ENV_NAME'" >&2
    exit 1
}

print_next_steps() {
    echo "  next: review 'git diff $ENC_FILE' (key names and sops metadata only), commit it through a pull request;"
    echo "        every other machine then runs: just secrets-sync"
}

# --- --set KEY: one value from a hidden prompt or standard input ---------------------------------

if [[ $set_mode -eq 1 ]]; then
    if ! secrets_list_has "$declared" "$set_key"; then
        echo "error: $set_key is not a key in .env.example — add it there first (the shared file mirrors .env.example)" >&2
        exit 1
    fi
    if secrets_list_has "$machine_local" "$set_key"; then
        echo "error: $set_key is tagged [machine-local] in .env.example: every machine keeps its own value, so it is never shared" >&2
        exit 1
    fi

    value=""
    if [[ -t 0 ]]; then
        IFS= read -rs -p "value for $set_key (hidden, one line): " value || true
        printf '\n' >&2
    else
        IFS= read -r value || true
    fi
    value="${value%$'\r'}"
    if [[ -z "$value" ]]; then
        echo "error: no value given for $set_key — nothing written" >&2
        exit 1
    fi
    case "$value" in
        *[[:cntrl:]]*)
            unset value
            echo "error: the value for $set_key contains a control character — nothing written (set it with 'just secrets-edit $ENV_NAME')" >&2
            exit 1
            ;;
    esac

    existed=0
    if secrets_shared_key_states | awk -v key="$set_key" '$1 == key { found = 1 } END { exit !found }'; then
        existed=1
    fi
    work_begin
    # printf is a bash builtin: the value goes into the pipe without ever being a process argument.
    printf '%s' "$value" | secrets_json_string | sops_set "$set_key" || write_failed "$set_key"
    unset value
    if cmp -s "$work" "$ENC_FILE"; then
        echo "  unchanged $set_key"
        echo "secrets-push: $ENC_FILE already holds that value for $set_key — nothing written"
        exit 0
    fi
    mv "$work" "$ENC_FILE"
    if [[ $existed -eq 1 ]]; then echo "  set $set_key"; else echo "  added $set_key"; fi
    echo "secrets-push: wrote $ENC_FILE — 1 key set from $([[ -t 0 ]] && echo 'the prompt' || echo 'standard input')"
    echo "  this machine's .env does not have it yet: just secrets-sync"
    print_next_steps
    exit 0
fi

# --- plan: compare .env with the decrypted shared file, names only out ----------------------------

if [[ ! -f .env ]]; then
    echo "error: .env not found — there is nothing to push (create it with 'just bootstrap' or 'just secrets-sync')" >&2
    exit 1
fi

# stdin: key names. stdout: KEY=value lines, each value read from .env the way dotenv does. Only
# ever piped into push_plan's awk.
local_pairs() {
    local key
    while IFS= read -r key; do
        [[ -n "$key" ]] || continue
        printf '%s=%s\n' "$key" "$(env_file_value "$key" .env)"
    done
}

# stdin: key names. stdout: "KEY <kind>" lines (env_file_value_kind: a word, never the value).
local_kinds() {
    local key
    while IFS= read -r key; do
        [[ -n "$key" ]] || continue
        printf '%s %s\n' "$key" "$(env_file_value_kind "$key" .env)"
    done
}

# One "<action> <KEY>" line per declared key, then one per name the shared file has and
# .env.example does not. The decrypted shared values (stdin), the .env values, their kinds and the
# machine-local names meet inside this one awk process, which prints names only. Actions: add,
# add-empty, fill, replace, same (equal values), keep (nothing in .env), hold (machine-local with a
# local value), invalid (followed by the reason: the kind of a .env value that is not `plain`),
# stale (the stale name is empty), stale-set (it holds a value). A machine-local key is never
# pushed, so its value is never judged. sops's stderr is discarded: it can carry a value.
push_plan() {
    "$SECRETS_SOPS" --decrypt --input-type yaml --output-type dotenv "$ENC_FILE" 2>/dev/null | LC_ALL=C awk '
        src == "shared" {
            if ($0 !~ /^[A-Za-z_][A-Za-z0-9_]*=/) next
            eq = index($0, "="); key = substr($0, 1, eq - 1)
            if (!(key in in_shared)) shared_order[++n_shared] = key
            in_shared[key] = 1; shared[key] = substr($0, eq + 1)
            next
        }
        src == "mlocal" { if ($0 != "") mlocal[$0] = 1; next }
        src == "kind" { kind[$1] = $2; next }
        src == "local" {
            eq = index($0, "="); key = substr($0, 1, eq - 1)
            declared[key] = 1; order[++n_declared] = key; value[key] = substr($0, eq + 1)
            next
        }
        END {
            for (i = 1; i <= n_declared; i++) {
                key = order[i]; val = value[key]
                if (key in mlocal) {
                    if (!(key in in_shared)) print "add-empty", key
                    else if (val != "") print "hold", key
                    else print "keep", key
                } else if (val ~ /[[:cntrl:]]/) print "invalid", key, "control"
                else if (val != "" && kind[key] != "plain") print "invalid", key, (kind[key] == "" ? "unknown" : kind[key])
                else if (!(key in in_shared)) print (val == "" ? "add-empty" : "add"), key
                else if (val == "") print "keep", key
                else if (shared[key] == val) print "same", key
                else print (shared[key] == "" ? "fill" : "replace"), key
            }
            for (i = 1; i <= n_shared; i++) {
                key = shared_order[i]
                if (!(key in declared)) print (shared[key] == "" ? "stale" : "stale-set"), key
            }
        }
    ' src=shared - src=kind <(printf '%s\n' "$declared" | local_kinds) src=local <(printf '%s\n' "$declared" | local_pairs) src=mlocal <(printf '%s\n' "$machine_local")
}

if ! plan="$(push_plan)"; then
    echo "error: could not read $ENC_FILE with your identity (sops's output is hidden so that no value can leak) — 'just doctor' names what is missing" >&2
    exit 1
fi

names_for() {
    printf '%s\n' "$plan" | awk -v action="$1" '$1 == action { print $2 }'
}
# The names with <action> on one line, separated by spaces.
names_line() {
    local names
    names="$(names_for "$1" | tr '\n' ' ')"
    printf '%s' "${names% }"
}
count_of() {
    printf '%s\n' "$plan" | awk -v action="$1" '$1 == action { n++ } END { print n + 0 }'
}
# print_keys <action> <label> [note]: one "  <label> KEY   (note)" line per key with that action.
print_keys() {
    local key
    for key in $(names_for "$1"); do
        printf '  %-8s %s%s\n' "$2" "$key" "${3:+   ($3)}"
    done
}
# One "  invalid KEY   (reason)" line per .env value that is not written the way it is read.
print_invalid() {
    local key kind why
    printf '%s\n' "$plan" | awk '$1 == "invalid" { print $2, $3 }' | while read -r key kind; do
        case "$kind" in
            comment) why="a '#' at the start of the value or after whitespace: dotenv reads it as a comment" ;;
            quote) why="a quote that does not close at the end of the line (text or a comment follows it), or quotes inside the quotes" ;;
            padding) why="whitespace at the start of the value, or at either end inside its quotes" ;;
            escape) why="a backslash inside double quotes: a parser may expand it there, and the bare line secrets-sync writes is not quoted" ;;
            control) why="a control character; a tab counts" ;;
            *) why="its form could not be determined" ;;
        esac
        printf '  %-8s %s   (%s)\n' invalid "$key" "$why"
    done
}

n_invalid="$(count_of invalid)"
if [[ "$n_invalid" -gt 0 ]]; then
    echo "error: $n_invalid .env value(s) are not written the way dotenv reads them, or the way 'just secrets-sync' would write them back — nothing written:" >&2
    print_invalid >&2
    echo "  fix the line(s) in .env: a comment goes on its own line, quotes go around the whole value with nothing after them" >&2
    exit 1
fi

n_add="$(count_of add)"; n_add_empty="$(count_of add-empty)"; n_fill="$(count_of fill)"
n_replace="$(count_of replace)"; n_same="$(count_of same)"; n_keep="$(count_of keep)"; n_hold="$(count_of hold)"
n_stale_empty="$(count_of stale)"; n_stale_set="$(count_of stale-set)"
n_stale=$((n_stale_empty + n_stale_set))

# What the flags given cover. --prune-values never comes without --prune (checked above).
n_replaced=0; n_removed=0; flags=""
if [[ $replace -eq 1 ]]; then n_replaced="$n_replace"; flags="$flags --replace"; fi
if [[ $prune -eq 1 ]]; then n_removed="$n_stale_empty"; flags="$flags --prune"; fi
if [[ $prune_values -eq 1 ]]; then n_removed="$n_stale"; flags="$flags --prune-values"; fi
n_writes=$((n_add + n_add_empty + n_fill + n_replaced + n_removed))

held="$(names_line hold)"

# What these flags leave alone, by key name, each with the command that deals with it.
print_left_alone() {
    local also=""
    if [[ $replace -eq 0 && "$n_replace" -gt 0 ]]; then
        echo "  $n_replace differing value(s) left alone: $(names_line replace)"
        echo "    if the shared value is the newer one (rotated on another machine): just secrets-sync"
        echo "    if the value in .env is the newer one: just secrets-push $ENV_NAME --apply --replace"
    fi
    if [[ $prune -eq 0 && "$n_stale" -gt 0 ]]; then
        if [[ "$n_stale_set" -gt 0 ]]; then also="; add --prune-values for the $n_stale_set holding a value"; fi
        echo "  $n_stale stale name(s) left (remove with: just secrets-push $ENV_NAME --apply --prune$also)"
    elif [[ $prune_values -eq 0 && "$n_stale_set" -gt 0 ]]; then
        echo "  $n_stale_set stale name(s) left because they hold a value: $(names_line stale-set)"
        echo "    to delete the name(s) together with the value(s): just secrets-push $ENV_NAME --apply --prune --prune-values"
    fi
}

# --- dry run -----------------------------------------------------------------------------------

if [[ $apply -eq 0 ]]; then
    echo "secrets-push: dry run for $ENC_FILE — nothing is written without --apply"
    print_keys add add "new name, value from .env"
    print_keys add-empty add "new name, empty value"
    print_keys fill fill "the shared value is empty"
    if [[ $replace -eq 1 ]]; then
        print_keys replace replace "the shared value differs; .env wins"
        differing="$n_replace to replace"
    else
        print_keys replace differs "the shared value differs; left alone without --replace"
        differing="$n_replace differing (left alone)"
    fi
    if [[ $prune -eq 1 ]]; then
        print_keys stale remove "not in .env.example; empty"
    else
        print_keys stale stale "not in .env.example; empty; removed only with --prune"
    fi
    if [[ $prune_values -eq 1 ]]; then
        print_keys stale-set remove "not in .env.example; HOLDS A VALUE, deleted with the name"
    else
        print_keys stale-set stale "not in .env.example; holds a value; removed only with --prune --prune-values"
    fi
    if [[ -n "$held" ]]; then
        echo "  held back, tagged [machine-local] in .env.example: $held"
    fi
    stale="$n_stale stale"
    if [[ "$n_stale_set" -gt 0 ]]; then stale="$stale ($n_stale_set with a value)"; fi
    echo "secrets-push: $((n_add + n_add_empty)) to add, $n_fill to fill, $differing, $stale; $n_same already equal, $n_keep with no value in .env, $n_hold held back"
    if [[ "$n_replaced" -gt 0 ]]; then
        echo "  replace overwrites the shared value with the one in .env: if the shared one is newer, run 'just secrets-sync' instead"
    fi
    print_left_alone
    if [[ $n_writes -gt 0 ]]; then
        echo "  to write it: just secrets-push $ENV_NAME --apply$flags"
    elif [[ $replace -eq 0 && "$n_replace" -gt 0 ]]; then
        echo "  nothing to write: there is nothing to add or fill"
    else
        echo "  nothing to write: $ENC_FILE already holds every value .env has"
    fi
    exit 0
fi

# --- apply -------------------------------------------------------------------------------------

if [[ $n_writes -eq 0 ]]; then
    if [[ $replace -eq 0 && "$n_replace" -gt 0 ]]; then
        echo "secrets-push: nothing to push — there is nothing to add or fill in $ENC_FILE"
    else
        echo "secrets-push: nothing to push — $ENC_FILE already holds every value .env has"
    fi
    print_left_alone
    exit 0
fi

work_begin
for key in $(names_for add-empty); do
    printf '""' | sops_set "$key" || write_failed "$key"
done
actions="add fill"
if [[ $replace -eq 1 ]]; then actions="add fill replace"; fi
for action in $actions; do
    for key in $(names_for "$action"); do
        env_file_value "$key" .env | secrets_json_string | sops_set "$key" || write_failed "$key"
    done
done
actions=""
if [[ $prune -eq 1 ]]; then actions="stale"; fi
if [[ $prune_values -eq 1 ]]; then actions="stale stale-set"; fi
for action in $actions; do
    for key in $(names_for "$action"); do
        sops_unset "$key" || write_failed "$key"
    done
done
# A rename inside secrets/: the file is the old one until this returns, the new one after.
mv "$work" "$ENC_FILE"

print_keys add added
print_keys add-empty added "name only, empty value"
print_keys fill filled
if [[ $replace -eq 1 ]]; then print_keys replace replaced; fi
for action in $actions; do
    print_keys "$action" removed
done
if [[ -n "$held" ]]; then
    echo "  held back, tagged [machine-local] in .env.example: $held"
fi
echo "secrets-push: wrote $ENC_FILE — $((n_add + n_add_empty)) added, $n_fill filled, $n_replaced replaced, $n_removed removed; other keys untouched"
print_left_alone
print_next_steps
