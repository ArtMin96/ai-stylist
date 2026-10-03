#!/usr/bin/env bash
# Shared helpers for the scripts that act on "the repository `origin` points at": `just repo-setup`
# (scripts/repo-setup.sh, scripts/repo-name.sh, scripts/security/github-secrets.sh), the onboarding
# compare URL (scripts/security/secrets-lib.sh) and two lines of `just doctor`.
# Sourced, not executed, and without top-level side effects. The doctor_* functions at the end need
# scripts/lib.sh (ok / warnc / note); nothing else here does. Bash 3.2-clean.
# Nothing in this file prints a remote URL: an https remote can carry a token in its user part.

# OWNER/REPO for a github.com remote URL $1: https://github.com/O/R[.git] (a user part before the
# host is allowed and dropped), git@github.com:O/R[.git] and ssh://git@github.com/O/R[.git].
# Returns 1 and prints nothing for any other host or a path that is not exactly owner/repo.
github_slug_from_url() {
    local slug
    case "$1" in
        https://github.com/*)    slug="${1#https://github.com/}" ;;
        https://*@github.com/*)  slug="${1#https://*@github.com/}" ;;
        git@github.com:*)        slug="${1#git@github.com:}" ;;
        ssh://git@github.com/*)  slug="${1#ssh://git@github.com/}" ;;
        *) return 1 ;;
    esac
    slug="${slug%/}"
    slug="${slug%.git}"
    case "$slug" in
        */*/* | /* | */ | *[!A-Za-z0-9._/-]*) return 1 ;;
        */*) printf '%s\n' "$slug" ;;
        *) return 1 ;;
    esac
}

# OWNER/REPO of the remote named $1 (default origin), read from the local git config: no network.
# Returns 1 when the remote is missing or is not a github.com remote.
github_origin_slug() {
    local url
    url="$(git remote get-url "${1:-origin}" 2>/dev/null)" || return 1
    github_slug_from_url "$url"
}

# The fix printed when `origin` cannot be read as a GitHub repository (used by the sourcing scripts).
# shellcheck disable=SC2034
GITHUB_ORIGIN_FIX="git remote -v   (origin must be https://github.com/<owner>/<repo>.git or git@github.com:<owner>/<repo>.git; set it with: git remote set-url origin <url>)"

# gh is not pinned in mise.toml (a single-writer file), so the scripts check for it themselves.
GITHUB_CLI_INSTALL_FIX="mise use --global gh@latest   (then: gh auth login)"
GITHUB_CLI_LOGIN_FIX="gh auth login   (host github.com; the account needs admin rights on the repository)"

# Whether the GitHub CLI can be used, without any network call: missing | logged-out | ok.
# `gh auth token` only reads the stored login (or GH_TOKEN); its output is discarded.
github_cli_state() {
    if ! command -v gh >/dev/null 2>&1; then
        echo missing
    elif ! gh auth token --hostname github.com >/dev/null 2>&1; then
        echo logged-out
    else
        echo ok
    fi
}

# Returns 0 when gh is installed and has a login for github.com; otherwise prints what is missing
# and the exact command that fixes it, and returns 1.
github_require_cli() {
    case "$(github_cli_state)" in
        ok) return 0 ;;
        missing)
            echo "error: the GitHub CLI (gh) is not installed" >&2
            echo "  fix: $GITHUB_CLI_INSTALL_FIX" >&2
            ;;
        *)
            echo "error: gh has no login for github.com" >&2
            echo "  fix: $GITHUB_CLI_LOGIN_FIX" >&2
            ;;
    esac
    return 1
}

# Every --apply mode of `just repo-setup` is owner-run: it rewrites human-only files, or changes the
# repository's secrets, variables or settings on GitHub. Claude Code exports CLAUDECODE in every
# shell it starts, so an agent session is refused here; the report modes stay open to it.
# $1 = the command as the owner types it. This is a seatbelt, not the control: the deny rule for
# agents belongs in scripts/hooks/guard-bash.sh (human-applied).
github_owner_only() {
    if [[ -n "${CLAUDECODE:-}" ]]; then
        echo "error: '$1' is owner-run: this shell belongs to an AI agent session (CLAUDECODE is set), so nothing was changed" >&2
        echo "  run it yourself in a terminal no agent is attached to; without --apply the same command only reports" >&2
        return 1
    fi
}

# --- just doctor ---------------------------------------------------------------------------------

# Doctor: do tracked files name the repository origin points at? Runs scripts/repo-name.sh in its
# one-line report mode, which reads the local git config and tracked files only (no network) and
# changes nothing. A mismatch is a warning: nothing on this machine breaks, but clone commands and
# every runbook link in Grafana still point at the old repository.
doctor_repo_name() {
    local out rc=0
    out="$(bash "$(dirname "${BASH_SOURCE[0]}")/repo-name.sh" --check --quiet 2>&1)" || rc=$?
    case "$rc" in
        0) ok "$out" ;;
        1) warnc "$out" "just repo-setup name   (lists the lines, changes nothing; then rewrite them with: just repo-setup name --apply)" ;;
        *) note "repository name in tracked files not checked: $out" ;;
    esac
}

# Doctor: the GitHub CLI that `just repo-setup` drives. Offline (github_cli_state). Skipped in CI,
# where no recipe needs a gh login. The GitHub side itself (Actions secrets and variables, branch
# protection, labels) needs the network and admin rights, so doctor names the command instead of
# running it.
doctor_github_cli() {
    [[ -z "${CI:-}" ]] || return 0
    case "$(github_cli_state)" in
        ok)
            ok "gh present with a login for github.com"
            note "GitHub side (Actions secrets and variables, branch protection, labels) is not checked here, it needs the network: just repo-setup"
            ;;
        missing)
            warnc "gh (GitHub CLI) not installed: just repo-setup cannot check this repository's Actions secrets, variables and settings" "$GITHUB_CLI_INSTALL_FIX"
            ;;
        *)
            warnc "gh has no login for github.com: just repo-setup cannot check this repository's Actions secrets, variables and settings" "$GITHUB_CLI_LOGIN_FIX"
            ;;
    esac
}
