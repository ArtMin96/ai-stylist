#!/usr/bin/env bash
# `just repo-setup`: the GitHub side of this repository as commands, for the day the code moves to
# another repository or account (docs/NEW-REPO-SETUP.md; guide: tools/github/README.md).
#
#   just repo-setup                      three read-only checks, in this order, then the apply
#                                        commands that are needed (also: just repo-setup check)
#   just repo-setup name [--apply] [--from OWNER/REPO]
#                                        the repository's own name in tracked files (scripts/repo-name.sh)
#   just repo-setup secrets [--apply [--replace]] [--offline]
#                                        Actions secrets and variables from secrets/dev.enc.yaml
#                                        (scripts/security/github-secrets.sh, tools/github/actions-secrets.txt)
#   just repo-setup settings [--apply] [--offline]
#                                        Actions permissions, protection of main, secret scanning,
#                                        labels (tools/github/repo-settings.mjs, repo-settings.json)
#
# The repository is always the one `origin` points at; there is no flag to name another one.
# Nothing changes without --apply, each --apply is safe to run twice, and each is owner-run: it
# refuses inside an AI agent session. `secrets` and `settings` need the GitHub CLI with a login that
# has admin rights; `name` needs no network. No wizard: every subcommand takes flags only.
# Exit codes: 0 nothing to do · 1 something to do, refused or failed · 2 wrong usage.
set -euo pipefail

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=scripts/github-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/github-lib.sh"
cd "$REPO_ROOT"

usage() {
    echo "usage: just repo-setup                                       (three read-only checks, then the apply commands that are needed)"
    echo "       just repo-setup name [--apply] [--from OWNER/REPO]    (the repository's name in tracked files)"
    echo "       just repo-setup secrets [--apply [--replace]]         (Actions secrets and variables from secrets/dev.enc.yaml)"
    echo "       just repo-setup settings [--apply]                    (Actions permissions, protection of main, secret scanning, labels)"
    echo "  nothing changes without --apply; the repository is the one origin points at"
}

run_name() { bash scripts/repo-name.sh "$@"; }

run_secrets() { bash scripts/security/github-secrets.sh "$@"; }

# The settings tool is Node (built-ins only). It gets the repository from here, so the origin
# parsing lives in one place (scripts/github-lib.sh).
run_settings() {
    local slug arg offline=0
    if ! command -v node >/dev/null 2>&1; then
        echo "error: node not found (mise.toml pins it: 'mise install', or run this through 'just repo-setup', which puts the mise shims on PATH)" >&2
        return 1
    fi
    for arg in "$@"; do
        if [[ "$arg" == --offline ]]; then offline=1; fi
    done
    if [[ $offline -eq 1 ]]; then
        node tools/github/repo-settings.mjs "$@"
        return
    fi
    slug="$(github_origin_slug)" || {
        echo "error: origin is missing or is not a github.com remote" >&2
        echo "  check: $GITHUB_ORIGIN_FIX" >&2
        return 1
    }
    github_require_cli || return 1
    node tools/github/repo-settings.mjs --repo "$slug" "$@"
}

# One line of the closing summary. $1 = exit code of the check, $2 = what it checked,
# $3 = the command that closes the difference.
summary_line() {
    case "$1" in
        0) printf '  %-8s %s\n' ok "$2" ;;
        1) printf '  %-8s %s\n' "to do" "$3" ;;
        3) printf '  %-8s %s: it could not tell (see its line above)\n' skipped "$2" ;;
        4) printf '  %-8s %s: gh is not ready (the fix is printed above)\n' skipped "$2" ;;
        *) printf '  %-8s %s: see its output above\n' failed "$2" ;;
    esac
}

check_all() {
    local slug rc_name=0 rc_secrets=0 rc_settings=0
    slug="$(github_origin_slug)" || {
        echo "error: origin is missing or is not a github.com remote" >&2
        echo "  check: $GITHUB_ORIGIN_FIX" >&2
        exit 1
    }
    log "repo-setup: checking $slug, the repository origin points at; nothing is changed"

    heading "1/3 repository name in tracked files"
    run_name --check || rc_name=$?

    if github_require_cli; then
        heading "2/3 Actions secrets and variables"
        run_secrets --check || rc_secrets=$?
        heading "3/3 repository settings"
        run_settings --check || rc_settings=$?
    else
        rc_secrets=4; rc_settings=4
    fi

    heading "repo-setup: $slug"
    summary_line "$rc_name" "repository name in tracked files" \
        "just repo-setup name --apply       (rewrites the lines listed under 1/3; then commit them)"
    summary_line "$rc_secrets" "Actions secrets and variables" \
        "just repo-setup secrets --apply    (sets what 2/3 marks 'missing' from secrets/dev.enc.yaml; its other lines say what only you can do)"
    summary_line "$rc_settings" "repository settings" \
        "just repo-setup settings --apply   (sends what 3/3 marks 'change' or 'create'; 'unavailable' lines need another plan or a public repository)"
    if [[ $((rc_name + rc_secrets + rc_settings)) -eq 0 ]]; then
        echo "  nothing to do: tracked files, Actions secrets and variables, and repository settings match"
        return 0
    fi
    echo "  run the 'to do' commands yourself, in this order, each in a terminal no AI agent is attached to; then run 'just repo-setup' again"
    return 1
}

case "${1:-check}" in
    check)
        if [[ $# -gt 1 ]]; then usage >&2; exit 2; fi
        check_all
        ;;
    name) shift; run_name "$@" ;;
    secrets) shift; run_secrets "$@" ;;
    settings) shift; run_settings "$@" ;;
    -h | --help | help) usage ;;
    --apply)
        echo "repo-setup: --apply needs a subcommand: run name, secrets and settings one at a time, in that order" >&2
        usage >&2
        exit 2
        ;;
    *)
        echo "repo-setup: unknown subcommand '$1'" >&2
        usage >&2
        exit 2
        ;;
esac
