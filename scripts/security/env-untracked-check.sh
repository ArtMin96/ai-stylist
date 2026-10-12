#!/usr/bin/env bash
# Fails when the .env in the root of the repository is tracked or staged. `just security-scan` runs
# it before the working-tree gitleaks scan: that scan allow-lists the repo-root .env
# (tools/security/gitleaks-worktree.toml, DEC-77) and the history scan reads commits only, so a .env
# that was force-added to the index and is not committed yet is the one case neither scan sees.
# Without the pre-commit hook nothing else reports it before the commit, and the repository is
# public.
# Usage: scripts/security/env-untracked-check.sh [repo-dir]
#   repo-dir  root of the git repository to check (default: this checkout; the test suite passes a
#             throwaway repository)
# Exit codes: 0 .env is not in the index; 1 .env is tracked or staged, or git could not tell (the
# check fails closed); 2 usage.
# Proven by scripts/security/tests/secrets.test.sh (`just test secrets`).
set -euo pipefail
# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../lib.sh"

if [[ $# -gt 1 ]]; then
    echo "usage: scripts/security/env-untracked-check.sh [repo-dir]" >&2
    exit 2
fi
repo="${1:-$REPO_ROOT}"

# `git ls-files --error-unmatch` exits 0 when the path is in the index (committed, or staged only),
# 1 when it is not, and 128 when git cannot read the repository.
rc=0
git -C "$repo" ls-files --error-unmatch .env >/dev/null 2>&1 || rc=$?
case "$rc" in
    1) ;;
    0) die "env-untracked-check: the repo-root .env is tracked or staged. It holds real keys and must never be committed: run 'git rm --cached .env' (the file stays on disk), and rotate every key in it if a commit that contains it was pushed." ;;
    *) die "env-untracked-check: git could not say whether the repo-root .env is tracked (git ls-files exited $rc)." ;;
esac
