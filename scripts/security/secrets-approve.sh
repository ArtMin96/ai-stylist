#!/usr/bin/env bash
# Approve a developer's onboarding branch (planning/15 §6, plan s2-automated-secrets-onboarding T5).
# Usage: scripts/security/secrets-approve.sh <branch>
# Fetches <branch>, then — BEFORE running sops or writing anything — gates it: versus its merge base
# with the default branch, the branch must touch no file other than .sops.yaml, remove no line from
# it, and add only `# developer: <label>` comments or bare `- age1...` recipients. Only once that
# gate passes does this script check out the branch in a temporary git worktree and run the
# worktree's own secrets-updatekeys.sh over every existing secrets/*.enc.yaml, so the code it runs is
# proven identical to the trusted base commit before it ever executes. Needs an identity that can
# decrypt today (the approver re-wraps, a recipient alone cannot); never bypasses commit hooks.
# Exit codes: 0 ok · 1 refused / no identity · 2 wrong usage.
set -euo pipefail

# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/secrets-lib.sh"
ROOT="$(secrets_root)"
cd "$ROOT"

if [[ $# -ne 1 || "$1" == -* ]]; then
    echo "usage: secrets-approve.sh <branch>" >&2
    exit 2
fi
branch="$1"
if ! git check-ref-format --branch "$branch" >/dev/null 2>&1; then
    echo "error: '$branch' is not a valid branch name" >&2
    exit 2
fi

secrets_require_tools
secrets_require_identity

if ! git fetch --quiet origin "$branch"; then
    echo "error: could not fetch '$branch' from origin" >&2
    exit 1
fi
head="$(git rev-parse FETCH_HEAD)"
default_branch="$(secrets_default_branch)"
base="$(git merge-base "origin/$default_branch" "$head")" || {
    echo "error: could not compute the merge base of '$branch' with origin/$default_branch" >&2
    exit 1
}

# --- diff gate: runs before anything is executed or written (decision 7) --------------------------

changed_files="$(git diff --name-only "$base" "$head")"
if [[ "$changed_files" != ".sops.yaml" ]]; then
    echo "refusing: $branch changes files other than .sops.yaml:" >&2
    printf '%s\n' "$changed_files" | sed 's/^/  /' >&2
    exit 1
fi

removed_count=0
added_recipients=0
bad_line=""
while IFS= read -r line; do
    case "$line" in
        '--- '*|'+++ '*) continue ;;
        '-'*)
            removed_count=$((removed_count + 1))
            ;;
        '+'*)
            content="${line#+}"
            trimmed="$(printf '%s' "$content" | LC_ALL=C sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
            case "$trimmed" in
                '# developer: '*)
                    label="${trimmed#\# developer: }"
                    clean="$(printf '%s' "$label" | LC_ALL=C sed -E 's/[^A-Za-z0-9 ._-]//g')"
                    [[ -n "$label" && "$clean" == "$label" ]] || bad_line="$line"
                    ;;
                '- '*)
                    key="${trimmed#- }"
                    if secrets_is_age_recipient "$key"; then
                        added_recipients=$((added_recipients + 1))
                    else
                        bad_line="$line"
                    fi
                    ;;
                *)
                    bad_line="$line"
                    ;;
            esac
            ;;
    esac
done < <(git diff "$base" "$head" -- .sops.yaml)

if [[ "$removed_count" -gt 0 ]]; then
    echo "refusing: $branch removes $removed_count line(s) from .sops.yaml (this tool only adds recipients)" >&2
    exit 1
fi
if [[ -n "$bad_line" ]]; then
    echo "refusing: $branch adds a line that is not a '# developer:' comment or an 'age1...' recipient" >&2
    echo "  $bad_line" >&2
    exit 1
fi
if [[ "$added_recipients" -eq 0 ]]; then
    echo "refusing: $branch adds no age recipient to .sops.yaml" >&2
    exit 1
fi

# --- gate passed: re-wrap in a temporary, detached worktree ----------------------------------------

wt=""
cleanup() {
    if [[ -n "$wt" ]]; then
        git worktree remove --force "$wt" >/dev/null 2>&1 || true
        git worktree prune >/dev/null 2>&1 || true
        command rm -rf "$wt"
    fi
}
trap cleanup EXIT

wt="$(mktemp -d)"
git worktree add --detach --quiet "$wt" "$head"
secrets_link_node_modules "$wt"

(cd "$wt" && "$wt/scripts/security/secrets-updatekeys.sh")

staged="$(git -C "$wt" add -- 'secrets/*.enc.yaml' && git -C "$wt" diff --cached --name-only)"
if [[ -z "$staged" ]]; then
    echo "secrets-approve: $branch is already re-wrapped — nothing to commit"
else
    while IFS= read -r staged_file; do
        case "$staged_file" in
            secrets/*.enc.yaml) ;;
            *) echo "error: secrets-approve staged an unexpected path: $staged_file" >&2; exit 1 ;;
        esac
    done <<< "$staged"
    n="$(printf '%s\n' "$staged" | wc -l | awk '{print $1}')"
    git -C "$wt" commit -q -m "chore(secrets): re-wrap secrets for the updated recipient list"
    git -C "$wt" push origin HEAD:refs/heads/"$branch"
    echo "secrets-approve: re-wrapped $n file(s) for the new recipient list and pushed $branch"
fi

if url="$(secrets_github_compare_url "$default_branch" "$branch")"; then
    echo "$url"
else
    echo "open a pull request for it on your git host"
fi
