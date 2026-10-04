#!/usr/bin/env bash
# Shared harness for the shell suites that prove where a secret value travels: the sops + age
# fixture and the recording wrappers. Sourced by scripts/security/tests/secrets.test.sh
# (`just secrets-push`) and scripts/test/repo-setup.test.sh (`just repo-setup`); not a suite itself.
#
# Recording, the idea: the script under test runs with a PATH that holds nothing but one wrapper
# per external command. Each wrapper writes down what it was called with, then runs the real
# command. A command without a wrapper cannot run at all, so the list of wrapped commands cannot
# fall behind the script without a test failing. Every secret value in those suites' fixtures
# carries the marker "synthetic-", so one pattern proves a value never was a command argument, in a
# file under the fixture's tmp/ (TMPDIR) or secrets/, or in a command's environment.

# Absolute path of a tool that works from any directory. `command -v` may return a mise shim, which
# resolves the version from the current directory's mise config and fails outside the repo (the
# justfile puts the shims dir first on PATH).
resolve_tool() {
    local path
    path="$(command -v "$1")" || return 1
    if [[ "$path" == */mise/shims/* ]] && command -v mise >/dev/null 2>&1; then
        mise which "$1"
    else
        printf '%s\n' "$path"
    fi
}

# Explains a failed expectation on stderr (key names and counts only, never a value); returns 1.
because() {
    echo "  $*" >&2
    return 1
}

# .sops.yaml with one dev rule listing the given recipients, anchored on an '# ADD RECIPIENTS'
# marker line (secrets_add_recipient inserts directly below it) at the recipients' indentation.
write_sops_config() {
    local fixture="$1"
    shift
    {
        printf 'creation_rules:\n  - path_regex: secrets/dev\\.enc\\.yaml$\n    key_groups:\n      - age:\n'
        printf '          # ADD RECIPIENTS: synthetic marker for tests\n'
        for recipient in "$@"; do printf '          - %s\n' "$recipient"; done
    } > "$fixture/.sops.yaml"
}

# sops_dev_fixture <fixture>: the real, mise-pinned sops, age and age-keygen linked into
# <fixture>/bin, a throwaway identity at the default path (<fixture>/home/.config/sops/age/keys.txt)
# as the only dev recipient of <fixture>/.sops.yaml, and <fixture>/secrets/dev.plain.yaml (written
# by the caller, synthetic values only) encrypted into secrets/dev.enc.yaml. The plain file is
# removed again.
sops_dev_fixture() {
    local fixture="$1" tool path pub
    if ! command -v sops >/dev/null 2>&1 || ! command -v age-keygen >/dev/null 2>&1; then
        echo "  sops/age-keygen not on PATH (mise.toml pins them; run 'mise install' / activate mise)" >&2
        return 1
    fi
    mkdir -p "$fixture/bin" "$fixture/secrets"
    for tool in sops age age-keygen; do
        command rm -f "$fixture/bin/$tool"
        ln -s "$(resolve_tool "$tool")" "$fixture/bin/$tool" || return 1
    done
    path="$fixture/home/.config/sops/age/keys.txt"
    mkdir -p "$(dirname "$path")"
    age-keygen -o "$path" >/dev/null 2>&1 || return 1
    pub="$(age-keygen -y "$path")"
    write_sops_config "$fixture" "$pub"
    (cd "$fixture" && PATH="$fixture/bin:$PATH" HOME="$fixture/home" \
        sops --encrypt --input-type yaml --output-type yaml --filename-override secrets/dev.enc.yaml secrets/dev.plain.yaml \
        > secrets/dev.enc.yaml.tmp) || return 1
    mv "$fixture/secrets/dev.enc.yaml.tmp" "$fixture/secrets/dev.enc.yaml"
    command rm -f "$fixture/secrets/dev.plain.yaml"
}

# record_wrappers <fixture> "<commands>" ["<plain links>"]
# Creates <fixture>/rec with one recording wrapper per word of <commands>, plus <fixture>/tmp. A
# word is a command name (the real one is looked up now, with the suite's own PATH) or
# `name=/absolute/path` (the wrapper runs that executable: a stub). Each wrapper appends to
# $RECORD_FILE, then runs the real command:
#   <name> <arguments>   its argument list
#   ON-DISK <name>       at that moment a file under <fixture>/tmp or <fixture>/secrets holds a
#                        plaintext value
#   IN-ENV <name>        its environment holds a value
# <plain links> are commands the script only looks up or that need no record; `bash` is always
# linked (the scripts start through `env bash`). When $RECORD_WRAPPER_EXTRA names a function, it is
# called with each command name and its output goes into that wrapper, before the real command runs
# (the secrets suite makes `sops` fail on demand that way).
# A file that bash writes itself and removes with rm is seen by the rm wrapper before rm runs. What
# no wrapper can see is a file bash creates and unlinks without running a command, which is how
# bash 3.2 backs a here-string: the suites grep the script for `<<` instead.
record_wrappers() {
    local fixture="$1" commands="$2" links="${3:-}" entry name real bash_path grep_path
    bash_path="$(command -v bash)" || return 1
    grep_path="$(command -v grep)" || return 1
    mkdir -p "$fixture/rec" "$fixture/tmp"
    ln -s "$bash_path" "$fixture/rec/bash"
    for name in $links; do
        real="$(resolve_tool "$name")" || return 1
        ln -s "$real" "$fixture/rec/$name"
    done
    for entry in $commands; do
        case "$entry" in
            *=*) name="${entry%%=*}"; real="${entry#*=}" ;;
            *) name="$entry"; real="$(resolve_tool "$name")" || return 1 ;;
        esac
        {
            # The commands of one pipeline run at the same time and share the record: every entry is
            # one printf (one write) that starts with a newline, so it always begins its own line.
            cat <<WRAPPER
#!$bash_path
line='$name'; for arg in "\$@"; do line="\$line \$arg"; done
printf '\n%s\n' "\$line" >> "\$RECORD_FILE"
if '$grep_path' -rq 'synthetic-' '$fixture/tmp' '$fixture/secrets' 2>/dev/null; then printf '\nON-DISK %s\n' '$name' >> "\$RECORD_FILE"; fi
case "\$(export -p)" in *synthetic-*) printf '\nIN-ENV %s\n' '$name' >> "\$RECORD_FILE" ;; esac
WRAPPER
            if [[ -n "${RECORD_WRAPPER_EXTRA:-}" ]]; then
                "$RECORD_WRAPPER_EXTRA" "$name" || return 1
            fi
            cat <<WRAPPER
exec '$real' "\$@"
WRAPPER
        } > "$fixture/rec/$name"
        chmod +x "$fixture/rec/$name"
    done
}

# After a run under the wrappers, with <fixture>/record.txt as $RECORD_FILE: no value was an
# argument of any command, in a file under tmp/ or secrets/ while any command ran, or in a
# command's environment; and nothing is left in tmp/ or, beside the encrypted file, in secrets/.
record_clean() {
    local fixture="$1" record="$1/record.txt"
    [[ -s "$record" ]] || because "the wrappers recorded nothing" || return 1
    ! grep -q 'synthetic-' "$record" || because "a value was a command argument" || return 1
    ! grep -q '^ON-DISK ' "$record" \
        || because "a plaintext value was in a file under tmp/ or secrets/ when these ran: $(grep '^ON-DISK ' "$record" | cut -d' ' -f2 | sort -u | tr '\n' ' ')" || return 1
    ! grep -q '^IN-ENV ' "$record" \
        || because "a value was in the environment of: $(grep '^IN-ENV ' "$record" | cut -d' ' -f2 | sort -u | tr '\n' ' ')" || return 1
    [[ -z "$(ls -A "$fixture/tmp")" ]] || because "something is left in TMPDIR" || return 1
    [[ -z "$(find "$fixture/secrets" -mindepth 1 ! -name dev.enc.yaml)" ]] || because "something is left beside secrets/dev.enc.yaml" || return 1
}
