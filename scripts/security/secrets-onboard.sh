#!/usr/bin/env bash
# Generate (or reuse) the developer's age identity and add its public key to the dev rule of
# .sops.yaml (sops + age onboarding, planning/15 §6, docs/SERVICES-SETUP.md §2). Invoked by
# `just bootstrap` via `mise_exec` so sops/age are on PATH without shell activation.
#
# Idempotent: once the developer's recipient is listed, re-running regenerates nothing and creates
# no second branch or commit. The developer's checked-out branch and working tree are never
# touched — the .sops.yaml change is made and committed on a throwaway `git worktree`, pushed, and
# the worktree is always removed on exit. Never prints private key material. Never bypasses a git
# hook: a refused commit, or a push that cannot reach the remote, degrades to printed manual
# commands instead of `--no-verify`/`--force`. No-op under CI or when SOPS_AGE_KEY is already set —
# there is nothing to onboard on a machine that only ever gets a key from the environment.
# Usage: scripts/security/secrets-onboard.sh   (no args; exits 0 except when sops/age are missing)
set -euo pipefail

# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/secrets-lib.sh"
ROOT="$(secrets_root)"
cd "$ROOT"

# The mode of <path> as an octal string: GNU stat, then BSD stat (macOS has no `stat -c`).
onboard_file_mode() {
    if stat -c '%a' "$1" >/dev/null 2>&1; then
        stat -c '%a' "$1"
    else
        stat -f '%Lp' "$1"
    fi
}

# The manual recipe printed whenever the automated commit could not be made, so onboarding can
# still be finished by hand without ever forcing a hook or a push.
print_manual_onboard_recipe() {
    echo "  git worktree add -b $branch <scratch-dir> $base"
    echo "  cd <scratch-dir>"
    echo "  # under the '# ADD RECIPIENTS' marker in the $ENV_NAME rule of .sops.yaml, add:"
    echo "  #   # developer: $label"
    echo "  #   - $pub"
    echo "  git add .sops.yaml && git commit -m \"chore(secrets): add age recipient for $label\""
    echo "  git push -u origin $branch"
    echo "  git worktree remove <scratch-dir>"
}

secrets_select_env dev
secrets_require_tools

if [[ -n "${CI:-}" ]] || secrets_identity_from_env; then
    echo "skipping onboarding (CI or SOPS_AGE_KEY is set)"
    exit 0
fi

path="$(secrets_identity_file)"
if [[ -f "$path" ]]; then
    echo "age identity present at $path"
else
    mkdir -p "$(dirname "$path")"
    chmod 700 "$(dirname "$path")"
    # stdout+stderr discarded: age-keygen also echoes the public key on generation, and neither
    # stream may ever reach the terminal for a private-key operation.
    "$SECRETS_AGE_KEYGEN" -o "$path" >/dev/null 2>&1
    echo "generated a new age identity at $path (the private key is never printed)"
fi
mode_before="$(onboard_file_mode "$path")"
chmod 600 "$path"
[[ "$mode_before" == "600" ]] || echo "fixed $path mode from $mode_before to 600"

pub="$(secrets_public_key "$path")"

label="$(git config user.name 2>/dev/null || true)"
git_email="$(git config user.email 2>/dev/null || true)"
if [[ -z "$label" || -z "$git_email" ]]; then
    echo "git identity is not configured, so the onboarding commit cannot be made — set it, then re-run 'just bootstrap':"
    echo "  git config --global user.name \"Your Name\""
    echo "  git config --global user.email \"you@example.com\""
    echo "  (your age identity is ready at $path; nothing else is needed)"
    exit 0
fi
branch="onboard/$(secrets_slug "$label")"

if secrets_recipient_listed "$pub"; then
    echo "your age recipient is already listed in .sops.yaml ($ENV_NAME) — nothing to do"
elif ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "not inside a git work tree — add your recipient to .sops.yaml manually:"
    echo "  under the '# ADD RECIPIENTS' marker in the $ENV_NAME rule, add:"
    echo "    # developer: $label"
    echo "    - $pub"
else
    default_branch="$(secrets_default_branch)"
    base="origin/$default_branch"
    git rev-parse --verify --quiet "$base" >/dev/null 2>&1 || base="HEAD"

    wt="$(mktemp -d)"
    cleanup_onboard_worktree() {
        git worktree remove --force "$wt" >/dev/null 2>&1 || true
        git worktree prune >/dev/null 2>&1 || true
        command rm -rf "$wt"
    }
    trap cleanup_onboard_worktree EXIT

    if git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null 2>&1; then
        git worktree add --quiet "$wt" "$branch"
    else
        git worktree add --quiet -b "$branch" "$wt" "$base"
    fi
    secrets_link_node_modules "$wt"

    if (cd "$wt" && secrets_recipient_listed "$pub"); then
        : # already added and committed on this branch by an earlier, interrupted run
    else
        if ! (cd "$wt" && secrets_add_recipient "$pub" "$label"); then
            echo "could not add your recipient to .sops.yaml on branch $branch — finish it yourself:"
            print_manual_onboard_recipe
            exit 0
        fi
        git -C "$wt" add .sops.yaml
        if [[ "$(git -C "$wt" diff --cached --name-only)" != ".sops.yaml" ]]; then
            echo "could not stage .sops.yaml alone on branch $branch — finish it yourself:"
            print_manual_onboard_recipe
            exit 0
        fi
        if ! git -C "$wt" commit --quiet -m "chore(secrets): add age recipient for $label"; then
            echo "could not commit .sops.yaml (git refused the commit; see the message above) — run these commands manually:"
            print_manual_onboard_recipe
            exit 0
        fi
        echo "added your recipient to the dev rule of .sops.yaml on branch $branch"
    fi

    if git -C "$wt" push --quiet --set-upstream origin "$branch"; then
        echo "pushed $branch — open the pull request:"
        if url="$(secrets_github_compare_url "$default_branch" "$branch")"; then
            echo "$url"
        else
            echo "open a pull request for it on your git host"
        fi
    else
        echo "could not push $branch (no remote access?) — run this when you have access:"
        echo "  git push -u origin $branch"
        exit 0
    fi
fi

if secrets_can_decrypt "$ENV_NAME"; then
    "$ROOT/scripts/security/secrets-sync.sh" "$ENV_NAME"
else
    echo "waiting for approval: an approver must run  just secrets-approve $branch"
fi

if [[ ! -f "$(secrets_backup_marker)" ]]; then
    echo "back up $path in the team password manager, then run: just secrets-backup-done"
fi
