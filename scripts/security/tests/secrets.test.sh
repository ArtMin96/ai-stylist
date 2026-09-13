#!/usr/bin/env bash
# Black-box regression suite for the sops + age scripts (secrets-sync.sh, secrets-edit.sh,
# secrets-updatekeys.sh, secrets-onboard.sh, secrets-approve.sh, secrets-backup-done.sh, and the
# secrets-doctor.sh fragment) and the secrets/ ignore policy (planning/15 §6, P02 T02/T12; plan
# s2-automated-secrets-onboarding).
# Usage: scripts/security/tests/secrets.test.sh   (run by `just test secrets` and `just test`)
# Every fixture is synthetic: throwaway age identities are generated per run inside a private temp
# dir and deleted on exit; nothing here reads the developer's keys file or the real secrets/ files.
# The merge/atomicity tests stub `sops` to pin the contract our scripts rely on; the round-trip,
# onboarding and approve tests run the real, mise-pinned `sops` + `age` so encryption, decryption,
# and re-wrapping are proven with the actual tools (CI installs them through .github/actions/setup).
# secrets-onboard.sh/secrets-approve.sh/secrets-backup-done.sh do not exist before wave 3: every test
# that runs one is written so a missing script fails that one test cleanly (never aborts the suite).
# secrets-doctor.sh is a sourced fragment with no top-level side effects (decision 5); it is probed
# directly with stubbed ok/fail/warnc rather than run through the untestable scripts/doctor.sh.
# shellcheck disable=SC2030,SC2031 # probe_doctor_checks deliberately scopes HOME/PATH/etc. to its
# own subshell; shellcheck's flat, whole-file flow analysis otherwise flags every unrelated PATH=
# assignment later in this file.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-secrets-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

failures=0

run_test() {
    local name="$1"
    shift
    if "$@"; then
        echo "PASS  $name"
    else
        echo "FAIL  $name" >&2
        failures=$((failures + 1))
    fi
}

file_mode() {
    if stat -c '%a' "$1" >/dev/null 2>&1; then
        stat -c '%a' "$1"
    else
        stat -f '%Lp' "$1"
    fi
}

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

# A copy of the scripts under test plus a minimal repo layout. bin/ is prepended to PATH by the
# tests that stub sops; bin/file-mode exposes file_mode() to those stubs (single definition above).
# The wave-3 scripts do not exist yet: each copy is guarded so a missing one cannot abort this
# fixture (shared by every test, including the 7 pre-existing ones) under `set -e`.
fixture_repo() {
    local fixture="$1"
    mkdir -p "$fixture/scripts/security" "$fixture/secrets" "$fixture/bin" "$fixture/home"
    cp "$ROOT/scripts/security/secrets-lib.sh" "$fixture/scripts/security/"
    cp "$ROOT/scripts/security/secrets-sync.sh" "$fixture/scripts/security/"
    cp "$ROOT/scripts/security/secrets-edit.sh" "$fixture/scripts/security/"
    cp "$ROOT/scripts/security/secrets-updatekeys.sh" "$fixture/scripts/security/"
    [[ -f "$ROOT/scripts/lib.sh" ]] && cp "$ROOT/scripts/lib.sh" "$fixture/scripts/"
    [[ -f "$ROOT/scripts/security/secrets-onboard.sh" ]] && cp "$ROOT/scripts/security/secrets-onboard.sh" "$fixture/scripts/security/"
    [[ -f "$ROOT/scripts/security/secrets-approve.sh" ]] && cp "$ROOT/scripts/security/secrets-approve.sh" "$fixture/scripts/security/"
    [[ -f "$ROOT/scripts/security/secrets-backup-done.sh" ]] && cp "$ROOT/scripts/security/secrets-backup-done.sh" "$fixture/scripts/security/"
    [[ -f "$ROOT/scripts/security/secrets-doctor.sh" ]] && cp "$ROOT/scripts/security/secrets-doctor.sh" "$fixture/scripts/security/"
    for script in secrets-onboard.sh secrets-approve.sh secrets-backup-done.sh; do
        [[ -f "$fixture/scripts/security/$script" ]] && chmod +x "$fixture/scripts/security/$script"
    done

    printf 'BASE=\n' > "$fixture/.env.example"
    printf 'encrypted fixture\n' > "$fixture/secrets/dev.enc.yaml"
    write_sops_config "$fixture" "age1$(printf '%058d' 0 | tr '0' 'q')"

    printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/bin/age"
    chmod +x "$fixture/bin/age"
    {
        echo '#!/usr/bin/env bash'
        declare -f file_mode
        cat <<'CALL'
file_mode "$1"
CALL
    } > "$fixture/bin/file-mode"
    chmod +x "$fixture/bin/file-mode"
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

# Turns an already-populated fixture (from fixture_repo) into a git repository with a bare "remote"
# at <dir>.git, so the onboard/approve push+fetch flow is exercised without a real GitHub remote.
# bin/ and home/ are this fixture's own scaffolding (tool stubs, a fake $HOME); ignoring them keeps
# `git status --porcelain` stable regardless of what a tool symlink or a generated identity adds
# there. core.hooksPath points at an empty directory: fixtures must never run the developer's prek
# hooks.
fixture_git_repo() {
    local fixture="$1"
    printf '/home/\n/bin/\n/node_modules\n' > "$fixture/.gitignore"
    git -C "$fixture" init -q -b main
    git -C "$fixture" config user.name "Synthetic Developer"
    git -C "$fixture" config user.email "synthetic-dev@example.invalid"
    # The real repo's commit-msg hook runs `pnpm exec commitlint` from the commit's cwd, so it needs
    # the checkout's node_modules. Model that: every commit must see node_modules/.hook-marker where
    # it runs, which a throwaway worktree only has if the script links the repo's node_modules in.
    mkdir -p "$fixture/hooks" "$fixture/node_modules"
    : > "$fixture/node_modules/.hook-marker"
    cat > "$fixture/hooks/commit-msg" <<'HOOK'
#!/usr/bin/env bash
[[ -e node_modules/.hook-marker ]] || { echo "commit-msg hook: node_modules missing in $PWD" >&2; exit 1; }
HOOK
    chmod +x "$fixture/hooks/commit-msg"
    git -C "$fixture" config core.hooksPath "$fixture/hooks"
    git -C "$fixture" config commit.gpgsign false
    git -C "$fixture" add -A
    git -C "$fixture" commit -q -m "chore: fixture baseline"
    git init -q --bare "$fixture.git"
    git -C "$fixture" remote add origin "$fixture.git"
    git -C "$fixture" push -q -u origin main
}

# Creates <branch> at <fixture>'s current main tip, on a throwaway worktree the caller populates and
# commits itself (paired with remove_synthetic_branch_worktree). Lets the approve tests build a
# synthetic onboarding branch without running secrets-onboard.sh (wave 3, not this task's concern).
new_synthetic_branch_worktree() {
    local fixture="$1" branch="$2" wt
    wt="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-secrets-wt.XXXXXX")" || return 1
    if ! git -C "$fixture" worktree add --quiet -b "$branch" "$wt" main >/dev/null 2>&1; then
        command rm -rf "$wt"
        return 1
    fi
    ln -s "$fixture/node_modules" "$wt/node_modules"
    printf '%s\n' "$wt"
}

# Cleans up a worktree created by new_synthetic_branch_worktree.
remove_synthetic_branch_worktree() {
    local fixture="$1" wt="$2"
    git -C "$fixture" worktree remove --force "$wt" >/dev/null 2>&1
    git -C "$fixture" worktree prune >/dev/null 2>&1
    command rm -rf "$wt"
}

# A syntactically valid (never a real keypair) age1 recipient: "age1" + 58 repeats of <fill>
# (default "q"), the same length secrets_is_age_recipient checks. Only for gate tests that need a
# line the regex accepts, not a working keypair.
synthetic_age_recipient() {
    local fill="${1:-q}"
    printf 'age1%s\n' "$(printf '%058d' 0 | tr '0' "$fill")"
}

# Sources secrets-doctor.sh (the sourced fragment, decision 5) inside <fixture> with stub
# ok/fail/warnc that each append "<tag>|<arg1>|<arg2>" to <record>, then calls
# secrets_doctor_checks(). Lets the fragment be probed without running the untestable
# scripts/doctor.sh (mise, docker, pnpm). CI and SOPS_AGE_KEY are neutralised so the outcome is
# deterministic regardless of the ambient shell (portability.yml runs this suite with CI=true).
# shellcheck disable=SC2329 # ok/fail/warnc are invoked indirectly by the sourced secrets-doctor.sh
probe_doctor_checks() {
    local fixture="$1" record="$2"
    (
        cd "$fixture" || exit 1
        export HOME="$fixture/home"
        export XDG_CONFIG_HOME="$fixture/home/.config"
        export PATH="$fixture/bin:$PATH"
        export CI=""
        export SOPS_AGE_KEY=""
        export SOPS_AGE_KEY_FILE=""
        ok()    { printf 'ok|%s\n' "$1" >> "$record"; }
        fail()  { printf 'fail|%s|%s\n' "$1" "${2:-}" >> "$record"; }
        warnc() { printf 'warnc|%s|%s\n' "$1" "${2:-}" >> "$record"; }
        # shellcheck disable=SC1091
        . scripts/security/secrets-lib.sh
        secrets_select_env dev
        # shellcheck disable=SC1091
        . scripts/security/secrets-doctor.sh
        secrets_doctor_checks
    )
}

test_ignore_policy() {
    git -C "$ROOT" check-ignore --no-index -q secrets/plain.yaml || return 1
    git -C "$ROOT" check-ignore --no-index -q secrets/dev.dec.yaml || return 1
    ! git -C "$ROOT" check-ignore --no-index -q secrets/dev.enc.yaml || return 1
    ! git -C "$ROOT" check-ignore --no-index -q secrets/README.md
}

test_non_dev_refusal() {
    local output rc
    set +e
    output="$(cd "$ROOT" && CI='' scripts/security/secrets-sync.sh staging 2>&1)"
    rc=$?
    set -e

    [[ $rc -eq 1 ]] || return 1
    [[ "$output" == *"refusing to write staging secrets into .env on a workstation"* ]]
}

test_sync_merge() {
    local fixture="$TEST_ROOT/sync" output
    fixture_repo "$fixture"
    printf '%s\n' \
        '# personal comment' \
        'UNRELATED=personal-value' \
        'export REPLACE=old-local-value' \
        'EMPTY=keep-local-value' > "$fixture/.env"
    cat > "$fixture/bin/sops" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' \
    'REPLACE=synthetic-replacement-value' \
    'ADDED=synthetic-added-value' \
    'EMPTY='
STUB
    chmod +x "$fixture/bin/sops"

    output="$(cd "$fixture" && HOME="$fixture/home" PATH="$fixture/bin:$PATH" \
        SOPS_AGE_KEY=synthetic-test-identity scripts/security/secrets-sync.sh dev 2>&1)" || return 1

    grep -Fxq '# personal comment' "$fixture/.env" || return 1
    grep -Fxq 'UNRELATED=personal-value' "$fixture/.env" || return 1
    grep -Fxq 'export REPLACE=synthetic-replacement-value' "$fixture/.env" || return 1
    grep -Fxq 'ADDED=synthetic-added-value' "$fixture/.env" || return 1
    grep -Fxq 'EMPTY=keep-local-value' "$fixture/.env" || return 1
    [[ "$(file_mode "$fixture/.env")" == "600" ]] || return 1
    [[ "$output" == *"replaced REPLACE"* ]] || return 1
    [[ "$output" == *"added ADDED"* ]] || return 1
    [[ "$output" != *"synthetic-replacement-value"* ]] || return 1
    [[ "$output" != *"synthetic-added-value"* ]]
}

test_sync_all_empty() {
    local fixture="$TEST_ROOT/sync-all-empty" output
    fixture_repo "$fixture"
    cat > "$fixture/bin/sops" <<'STUB'
#!/usr/bin/env bash
printf 'BASE=\n'
STUB
    chmod +x "$fixture/bin/sops"

    output="$(cd "$fixture" && HOME="$fixture/home" PATH="$fixture/bin:$PATH" \
        SOPS_AGE_KEY=synthetic-test-identity scripts/security/secrets-sync.sh dev 2>&1)" || return 1

    grep -Fxq 'BASE=' "$fixture/.env" || return 1
    [[ "$(file_mode "$fixture/.env")" == "600" ]] || return 1
    [[ "$output" == *"0 replaced, 0 added, 1 skipped"* ]]
}

test_encrypt_failure_is_atomic() {
    local fixture="$TEST_ROOT/encrypt-failure" output rc script_tmp script_tmp_mode
    fixture_repo "$fixture"
    printf 'ONE=\nTWO=\n' > "$fixture/.env.example"
    rm "$fixture/secrets/dev.enc.yaml"
    cat > "$fixture/bin/sops" <<'STUB'
#!/usr/bin/env bash
template="${@: -1}"
script_tmp="$(dirname "$template")"
printf '%s\n' "$script_tmp" > "$TEST_TEMP_RECORD"
file-mode "$script_tmp" >> "$TEST_TEMP_RECORD"
printf 'synthetic partial ciphertext\n'
exit 42
STUB
    chmod +x "$fixture/bin/sops"

    set +e
    output="$(cd "$fixture" && HOME="$fixture/home" PATH="$fixture/bin:$PATH" \
        TEST_TEMP_RECORD="$fixture/temp-record" SOPS_AGE_KEY=synthetic-test-identity \
        scripts/security/secrets-edit.sh dev 2>&1)"
    rc=$?
    set -e

    [[ $rc -eq 42 ]] || return 1
    [[ ! -e "$fixture/secrets/dev.enc.yaml" ]] || return 1
    script_tmp="$(sed -n '1p' "$fixture/temp-record")"
    script_tmp_mode="$(sed -n '2p' "$fixture/temp-record")"
    [[ "$script_tmp_mode" == "700" ]] || return 1
    [[ ! -e "$script_tmp" ]] || return 1
    [[ "$output" != *"synthetic partial ciphertext"* ]]
}

test_updatekeys_refuses_missing_file() {
    local fixture="$TEST_ROOT/updatekeys-missing" output rc
    fixture_repo "$fixture"
    rm "$fixture/secrets/dev.enc.yaml"
    printf '#!/usr/bin/env bash\necho "sops must not run" >&2\nexit 99\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"

    set +e
    output="$(cd "$fixture" && HOME="$fixture/home" PATH="$fixture/bin:$PATH" \
        SOPS_AGE_KEY=synthetic-test-identity scripts/security/secrets-updatekeys.sh dev 2>&1)"
    rc=$?
    set -e

    [[ $rc -eq 1 ]] || return 1
    [[ "$output" == *"secrets/dev.enc.yaml does not exist"* ]] || return 1
    [[ "$output" != *"sops must not run"* ]]
}

# Real sops + age: first-file creation via secrets-edit, a value set through sops, decrypt + merge
# via secrets-sync, then re-wrap for a second identity (add), decrypt with it, remove the first
# identity, and prove the removed identity is denied. Every identity is throwaway and lives in the
# fixture only. Fails (does not skip) when sops/age are missing: they are pinned in mise.toml.
test_real_roundtrip_and_rekey() {
    local fixture="$TEST_ROOT/real" key_a key_b pub_a pub_b output rc
    if ! command -v sops >/dev/null 2>&1 || ! command -v age-keygen >/dev/null 2>&1; then
        echo "  sops/age-keygen not on PATH (mise.toml pins them; run 'mise install' / activate mise)" >&2
        return 1
    fi
    fixture_repo "$fixture"
    rm "$fixture/secrets/dev.enc.yaml" "$fixture/bin/age"
    # Every script below cds into the fixture, so give it real binaries on PATH, not cwd-bound shims.
    for tool in sops age age-keygen; do
        ln -s "$(resolve_tool "$tool")" "$fixture/bin/$tool" || return 1
    done
    key_a="$fixture/home/identity-a.txt"
    key_b="$fixture/home/identity-b.txt"
    age-keygen -o "$key_a" >/dev/null 2>&1 || return 1
    age-keygen -o "$key_b" >/dev/null 2>&1 || return 1
    pub_a="$(age-keygen -y "$key_a")"
    pub_b="$(age-keygen -y "$key_b")"
    write_sops_config "$fixture" "$pub_a"

    # 1. first run creates the encrypted file from .env.example and opens it; EDITOR=true = "no edit".
    output="$(cd "$fixture" && PATH="$fixture/bin:$PATH" HOME="$fixture/home" EDITOR=true SOPS_AGE_KEY_FILE="$key_a" \
        scripts/security/secrets-edit.sh dev 2>&1)" || return 1
    [[ "$output" == *"created secrets/dev.enc.yaml with 1 empty keys"* ]] || return 1
    grep -q '^sops:' "$fixture/secrets/dev.enc.yaml" || return 1
    grep -Fq "recipient: $pub_a" "$fixture/secrets/dev.enc.yaml" || return 1

    # 2. a shared value set through sops is ciphertext on disk, plaintext only in .env, never in output.
    (cd "$fixture" && PATH="$fixture/bin:$PATH" SOPS_AGE_KEY_FILE="$key_a" sops set secrets/dev.enc.yaml '["BASE"]' '"synthetic-shared-value"') || return 1
    ! grep -q 'synthetic-shared-value' "$fixture/secrets/dev.enc.yaml" || return 1
    output="$(cd "$fixture" && PATH="$fixture/bin:$PATH" HOME="$fixture/home" SOPS_AGE_KEY_FILE="$key_a" \
        scripts/security/secrets-sync.sh dev 2>&1)" || return 1
    grep -Fxq 'BASE=synthetic-shared-value' "$fixture/.env" || return 1
    [[ "$(file_mode "$fixture/.env")" == "600" ]] || return 1
    [[ "$output" == *"1 replaced, 0 added, 0 skipped"* ]] || return 1
    [[ "$output" != *"synthetic-shared-value"* ]] || return 1

    # 3. onboarding: add identity B to .sops.yaml, re-wrap, B can now decrypt.
    write_sops_config "$fixture" "$pub_a" "$pub_b"
    output="$(cd "$fixture" && PATH="$fixture/bin:$PATH" HOME="$fixture/home" SOPS_AGE_KEY_FILE="$key_a" \
        scripts/security/secrets-updatekeys.sh 2>&1)" || return 1
    [[ "$output" == *"re-wrapped for 2 dev recipient(s)"* ]] || return 1
    [[ "$output" != *"synthetic-shared-value"* ]] || return 1
    grep -Fq "recipient: $pub_b" "$fixture/secrets/dev.enc.yaml" || return 1
    rm "$fixture/.env"
    (cd "$fixture" && PATH="$fixture/bin:$PATH" HOME="$fixture/home" SOPS_AGE_KEY_FILE="$key_b" scripts/security/secrets-sync.sh dev >/dev/null 2>&1) || return 1
    grep -Fxq 'BASE=synthetic-shared-value' "$fixture/.env" || return 1

    # 4. access removal: drop identity A, re-wrap with B, A is denied.
    write_sops_config "$fixture" "$pub_b"
    (cd "$fixture" && PATH="$fixture/bin:$PATH" HOME="$fixture/home" SOPS_AGE_KEY_FILE="$key_b" scripts/security/secrets-updatekeys.sh dev >/dev/null 2>&1) || return 1
    ! grep -Fq "recipient: $pub_a" "$fixture/secrets/dev.enc.yaml" || return 1
    set +e
    (cd "$fixture" && PATH="$fixture/bin:$PATH" HOME="$fixture/home" SOPS_AGE_KEY_FILE="$key_a" scripts/security/secrets-sync.sh dev >/dev/null 2>&1)
    rc=$?
    set -e
    [[ $rc -ne 0 ]]
}

# --- secrets-onboard.sh (C1, C2, C3, C4, C5, C6, C7, C8) ------------------------------------------

test_onboard_generates_identity_mode_600() {
    local fixture="$TEST_ROOT/onboard-generate" output path age_keygen
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    path="$fixture/home/.config/sops/age/keys.txt"

    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-onboard.sh 2>&1)" || return 1

    [[ -f "$path" ]] || return 1
    [[ "$(file_mode "$path")" == "600" ]] || return 1
    [[ "$(file_mode "$(dirname "$path")")" == "700" ]] || return 1
    [[ "$output" != *"AGE-SECRET-KEY-1"* ]] || return 1
    [[ "$output" == *"generated a new age identity at $path"* ]]
}

test_onboard_never_overwrites_existing_key() {
    local fixture="$TEST_ROOT/onboard-no-overwrite" output path age_keygen
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    path="$fixture/home/.config/sops/age/keys.txt"

    (cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-onboard.sh >/dev/null 2>&1) || return 1
    [[ -f "$path" ]] || return 1
    cp "$path" "$fixture/first-key.txt"

    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-onboard.sh 2>&1)" || return 1

    cmp -s "$fixture/first-key.txt" "$path" || return 1
    [[ "$output" == *"age identity present at $path"* ]]
}

test_onboard_adds_labelled_recipient_under_marker() {
    local fixture="$TEST_ROOT/onboard-recipient" path age_keygen pub marker_line count_before count_after
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    path="$fixture/home/.config/sops/age/keys.txt"
    count_before="$(grep -cE '^[[:space:]]*- age1[0-9a-z]+[[:space:]]*$' "$fixture/.sops.yaml")"

    (cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-onboard.sh >/dev/null 2>&1) || return 1

    pub="$("$age_keygen" -y "$path" 2>/dev/null)" || return 1
    # The developer's own tree stays untouched (see the sibling test); the insertion lands on the
    # pushed onboarding branch, so read .sops.yaml from the remote.
    git -C "$fixture.git" show "onboard/synthetic-developer:.sops.yaml" > "$fixture/pushed-sops.yaml" || return 1
    marker_line="$(grep -n '# ADD RECIPIENTS' "$fixture/pushed-sops.yaml" | head -1 | cut -d: -f1)"
    [[ -n "$marker_line" ]] || return 1
    [[ "$(sed -n "$((marker_line + 1))p" "$fixture/pushed-sops.yaml")" == "          # developer: Synthetic Developer" ]] || return 1
    [[ "$(sed -n "$((marker_line + 2))p" "$fixture/pushed-sops.yaml")" == "          - $pub" ]] || return 1

    count_after="$(grep -cE '^[[:space:]]*- age1[0-9a-z]+[[:space:]]*$' "$fixture/pushed-sops.yaml")"
    [[ $((count_before + 1)) -eq $count_after ]]
}

test_onboard_pushes_branch_and_leaves_tree_clean() {
    local fixture="$TEST_ROOT/onboard-push" path age_keygen pub branch status_before status_after current_branch remote_sops
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    path="$fixture/home/.config/sops/age/keys.txt"
    status_before="$(git -C "$fixture" status --porcelain)"

    (cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-onboard.sh >/dev/null 2>&1) || return 1

    status_after="$(git -C "$fixture" status --porcelain)"
    current_branch="$(git -C "$fixture" branch --show-current)"
    [[ "$status_after" == "$status_before" ]] || return 1
    [[ "$current_branch" == "main" ]] || return 1

    pub="$("$age_keygen" -y "$path" 2>/dev/null)" || return 1
    branch="onboard/synthetic-developer"
    git -C "$fixture.git" rev-parse --verify --quiet "refs/heads/$branch" >/dev/null || return 1
    remote_sops="$(git -C "$fixture.git" show "$branch:.sops.yaml")" || return 1
    [[ "$remote_sops" == *"$pub"* ]]
}

# A fresh machine often has no git user.name/user.email yet; onboarding must say so and stop
# before creating a branch, instead of failing inside the worktree commit.
test_onboard_requires_git_identity() {
    local fixture="$TEST_ROOT/onboard-no-identity" output age_keygen
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    git -C "$fixture" config --unset user.name
    git -C "$fixture" config --unset user.email

    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null PATH="$fixture/bin:$PATH" \
        scripts/security/secrets-onboard.sh 2>&1)" || return 1

    [[ "$output" == *"git identity is not configured"* ]] || return 1
    [[ "$output" == *"git config --global user.name"* ]] || return 1
    ! git -C "$fixture.git" rev-parse --verify --quiet "refs/heads/onboard/synthetic-developer" >/dev/null || return 1
    [[ "$output" != *"AGE-SECRET-KEY-1"* ]]
}

# Already green after T1: pins the URL format secrets-onboard.sh (T3) will print.
test_onboard_prints_compare_url_for_github_remote() {
    local fixture="$TEST_ROOT/onboard-compare-url" output
    mkdir -p "$fixture"
    git -C "$fixture" init -q -b main
    git -C "$fixture" remote add origin git@github.com:Owner/Repo.git

    # shellcheck disable=SC1091
    output="$(cd "$fixture" && . "$ROOT/scripts/security/secrets-lib.sh" && secrets_github_compare_url main onboard/x)" || return 1
    [[ "$output" == "https://github.com/Owner/Repo/compare/main...onboard/x?expand=1" ]]
}

test_onboard_push_failure_prints_manual_commands() {
    local fixture="$TEST_ROOT/onboard-push-fail" output branch age_keygen
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    git -C "$fixture" remote set-url origin "$TEST_ROOT/no-such-remote.git"
    branch="onboard/synthetic-developer"

    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-onboard.sh 2>&1)" || return 1

    [[ "$output" == *"could not push $branch (no remote access?)"* ]] || return 1
    [[ "$output" == *"git push -u origin $branch"* ]] || return 1
    git -C "$fixture" rev-parse --verify --quiet "refs/heads/$branch" >/dev/null
}

test_onboard_noop_when_recipient_already_listed() {
    local fixture="$TEST_ROOT/onboard-noop" output path age_keygen pub sops_before sops_after branches
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1

    mkdir -p "$fixture/home/.config/sops/age"
    path="$fixture/home/.config/sops/age/keys.txt"
    "$age_keygen" -o "$path" >/dev/null 2>&1 || return 1
    pub="$("$age_keygen" -y "$path" 2>/dev/null)" || return 1
    write_sops_config "$fixture" "$pub"
    git -C "$fixture" add .sops.yaml
    git -C "$fixture" commit -q -m "chore: pre-list synthetic recipient" || return 1
    sops_before="$(cat "$fixture/.sops.yaml")"

    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-onboard.sh 2>&1)" || return 1

    sops_after="$(cat "$fixture/.sops.yaml")"
    [[ "$sops_after" == "$sops_before" ]] || return 1
    [[ "$output" == *"your age recipient is already listed in .sops.yaml (dev) — nothing to do"* ]] || return 1
    branches="$(git -C "$fixture.git" for-each-ref --format='%(refname)' refs/heads/onboard/)"
    [[ -z "$branches" ]]
}

test_onboard_skips_in_ci() {
    local fixture="$TEST_ROOT/onboard-ci" output path age_keygen branches
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    path="$fixture/home/.config/sops/age/keys.txt"

    output="$(cd "$fixture" && CI=true SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-onboard.sh 2>&1)" || return 1

    [[ ! -e "$path" ]] || return 1
    [[ "$output" == *"skipping onboarding (CI or SOPS_AGE_KEY is set)"* ]] || return 1
    branches="$(git -C "$fixture.git" for-each-ref --format='%(refname)' refs/heads/onboard/)"
    [[ -z "$branches" ]]
}

# --- secrets-backup-done.sh (C11) -----------------------------------------------------------------

test_backup_done_writes_dated_marker() {
    local fixture="$TEST_ROOT/backup-done" output path marker today content
    fixture_repo "$fixture"
    mkdir -p "$fixture/home/.config/sops/age"
    path="$fixture/home/.config/sops/age/keys.txt"
    printf 'synthetic-not-a-real-key\n' > "$path"
    chmod 600 "$path"
    marker="$path.backed-up"
    today="$(date -u +%Y-%m-%d)"

    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-backup-done.sh 2>&1)" || return 1

    [[ -f "$marker" ]] || return 1
    [[ "$(file_mode "$marker")" == "600" ]] || return 1
    content="$(cat "$marker")"
    [[ "$content" == "$today" ]] || return 1
    [[ "$content" != *"synthetic-not-a-real-key"* ]] || return 1
    [[ "$output" == *"recorded $marker ($today) — 'just doctor' will stop warning"* ]]
}

# --- secrets-doctor.sh fragment (C10) --------------------------------------------------------------

test_doctor_checks_report_expected_outcomes() {
    local fixture="$TEST_ROOT/doctor-checks" age_keygen sops_bin path record_a record_b record_c pub_c

    fixture_repo "$fixture"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    sops_bin="$(resolve_tool sops)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    ln -s "$sops_bin" "$fixture/bin/sops" || return 1
    path="$fixture/home/.config/sops/age/keys.txt"

    # (a) no identity at all.
    record_a="$fixture/record-a.txt"
    : > "$record_a"
    probe_doctor_checks "$fixture" "$record_a" || return 1
    grep -F "fail|no age identity at $path|" "$record_a" | grep -q "just bootstrap" || return 1
    grep -F "fail|no age identity at $path|" "$record_a" | grep -q "generates one and opens the onboarding PR" || return 1

    # (b) identity present but not listed in the dev rule.
    mkdir -p "$(dirname "$path")"
    "$age_keygen" -o "$path" >/dev/null 2>&1 || return 1
    record_b="$fixture/record-b.txt"
    : > "$record_b"
    probe_doctor_checks "$fixture" "$record_b" || return 1
    grep -F "fail|your age recipient is not listed in the dev rule of .sops.yaml|" "$record_b" | grep -q "secrets-approve" || return 1

    # (c) listed + decryptable + no backup marker.
    pub_c="$("$age_keygen" -y "$path" 2>/dev/null)" || return 1
    write_sops_config "$fixture" "$pub_c"
    printf 'BASE: ""\n' > "$fixture/secrets/dev.plain.yaml"
    (cd "$fixture" && HOME="$fixture/home" SOPS_AGE_KEY="" PATH="$fixture/bin:$PATH" \
        sops --encrypt --input-type yaml --output-type yaml --filename-override secrets/dev.enc.yaml secrets/dev.plain.yaml \
        > secrets/dev.enc.yaml.tmp) || return 1
    mv "$fixture/secrets/dev.enc.yaml.tmp" "$fixture/secrets/dev.enc.yaml"
    command rm -f "$fixture/secrets/dev.plain.yaml"

    record_c="$fixture/record-c.txt"
    : > "$record_c"
    probe_doctor_checks "$fixture" "$record_c" || return 1
    grep -Fxq "ok|age identity present ($path, mode 600)" "$record_c" || return 1
    grep -Fxq "ok|age recipient listed in .sops.yaml (dev)" "$record_c" || return 1
    grep -Fxq "ok|secrets/dev.enc.yaml decrypts with your identity" "$record_c" || return 1
    grep -F "warnc|age identity not recorded as backed up|" "$record_c" | grep -q "secrets-backup-done"
}

# --- secrets-approve.sh (C12, C13, C14) ------------------------------------------------------------

test_approve_refuses_extra_files() {
    local fixture="$TEST_ROOT/approve-extra-files" age_keygen sops_bin identity pub branch wt output rc head_before head_after
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    sops_bin="$(resolve_tool sops)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    ln -s "$sops_bin" "$fixture/bin/sops" || return 1

    identity="$fixture/home/.config/sops/age/approver.txt"
    mkdir -p "$(dirname "$identity")"
    "$age_keygen" -o "$identity" >/dev/null 2>&1 || return 1
    pub="$("$age_keygen" -y "$identity" 2>/dev/null)" || return 1
    write_sops_config "$fixture" "$pub"
    git -C "$fixture" add .sops.yaml
    git -C "$fixture" commit -q -m "chore: approver recipient" || return 1
    git -C "$fixture" push -q origin main || return 1

    branch="onboard/extra-files-test"
    wt="$(new_synthetic_branch_worktree "$fixture" "$branch")" || return 1
    printf 'not part of an onboarding change\n' > "$wt/unrelated-file.txt"
    git -C "$wt" add -A
    git -C "$wt" commit -q -m "chore(secrets): synthetic branch with an unrelated file change" || return 1
    git -C "$wt" push --quiet origin "$branch" || return 1
    remove_synthetic_branch_worktree "$fixture" "$wt"
    head_before="$(git -C "$fixture.git" rev-parse "$branch")"

    set +e
    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" SOPS_AGE_KEY_FILE="$identity" scripts/security/secrets-approve.sh "$branch" 2>&1)"
    rc=$?
    set -e

    [[ $rc -eq 1 ]] || return 1
    [[ "$output" == *"refusing: $branch changes files other than .sops.yaml:"* ]] || return 1
    head_after="$(git -C "$fixture.git" rev-parse "$branch")"
    [[ "$head_after" == "$head_before" ]]
}

test_approve_refuses_recipient_removal() {
    local fixture="$TEST_ROOT/approve-removal" age_keygen sops_bin identity pub branch wt output rc head_before head_after
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    sops_bin="$(resolve_tool sops)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    ln -s "$sops_bin" "$fixture/bin/sops" || return 1

    identity="$fixture/home/.config/sops/age/approver.txt"
    mkdir -p "$(dirname "$identity")"
    "$age_keygen" -o "$identity" >/dev/null 2>&1 || return 1
    pub="$("$age_keygen" -y "$identity" 2>/dev/null)" || return 1
    write_sops_config "$fixture" "$pub" "$(synthetic_age_recipient z)"
    git -C "$fixture" add .sops.yaml
    git -C "$fixture" commit -q -m "chore: approver + placeholder recipient" || return 1
    git -C "$fixture" push -q origin main || return 1

    branch="onboard/removal-test"
    wt="$(new_synthetic_branch_worktree "$fixture" "$branch")" || return 1
    write_sops_config "$wt" "$pub"
    git -C "$wt" add -A
    git -C "$wt" commit -q -m "chore(secrets): synthetic branch that removes a recipient" || return 1
    git -C "$wt" push --quiet origin "$branch" || return 1
    remove_synthetic_branch_worktree "$fixture" "$wt"
    head_before="$(git -C "$fixture.git" rev-parse "$branch")"

    set +e
    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" SOPS_AGE_KEY_FILE="$identity" scripts/security/secrets-approve.sh "$branch" 2>&1)"
    rc=$?
    set -e

    [[ $rc -eq 1 ]] || return 1
    [[ "$output" == *"refusing: $branch removes"* ]] || return 1
    [[ "$output" == *"line(s) from .sops.yaml (this tool only adds recipients)"* ]] || return 1
    head_after="$(git -C "$fixture.git" rev-parse "$branch")"
    [[ "$head_after" == "$head_before" ]]
}

test_approve_rewraps_and_new_identity_decrypts() {
    local fixture="$TEST_ROOT/approve-rewrap" age_keygen sops_bin identity_a identity_b pub_a pub_b branch wt output status_before status_after current_branch dec_a dec_b
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    sops_bin="$(resolve_tool sops)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    ln -s "$sops_bin" "$fixture/bin/sops" || return 1

    identity_a="$fixture/home/.config/sops/age/identity-a.txt"
    identity_b="$fixture/home/.config/sops/age/identity-b.txt"
    mkdir -p "$(dirname "$identity_a")"
    "$age_keygen" -o "$identity_a" >/dev/null 2>&1 || return 1
    "$age_keygen" -o "$identity_b" >/dev/null 2>&1 || return 1
    pub_a="$("$age_keygen" -y "$identity_a" 2>/dev/null)" || return 1
    pub_b="$("$age_keygen" -y "$identity_b" 2>/dev/null)" || return 1

    write_sops_config "$fixture" "$pub_a"
    printf 'BASE: ""\n' > "$fixture/secrets/dev.plain.yaml"
    (cd "$fixture" && HOME="$fixture/home" SOPS_AGE_KEY="" PATH="$fixture/bin:$PATH" \
        sops --encrypt --input-type yaml --output-type yaml --filename-override secrets/dev.enc.yaml secrets/dev.plain.yaml \
        > secrets/dev.enc.yaml.tmp) || return 1
    mv "$fixture/secrets/dev.enc.yaml.tmp" "$fixture/secrets/dev.enc.yaml"
    command rm -f "$fixture/secrets/dev.plain.yaml"
    (cd "$fixture" && HOME="$fixture/home" SOPS_AGE_KEY="" PATH="$fixture/bin:$PATH" SOPS_AGE_KEY_FILE="$identity_a" \
        sops set secrets/dev.enc.yaml '["BASE"]' '"synthetic-shared-value"') || return 1
    git -C "$fixture" add .sops.yaml secrets/dev.enc.yaml
    git -C "$fixture" commit -q -m "chore: approver recipient + first dev secret" || return 1
    git -C "$fixture" push -q origin main || return 1

    branch="onboard/rewrap-test"
    wt="$(new_synthetic_branch_worktree "$fixture" "$branch")" || return 1
    (
        cd "$wt" || exit 1
        # shellcheck disable=SC1091
        . scripts/security/secrets-lib.sh
        secrets_select_env dev
        secrets_add_recipient "$pub_b" "Synthetic B"
    ) || return 1
    git -C "$wt" add .sops.yaml
    git -C "$wt" commit -q -m "chore(secrets): add age recipient for Synthetic B" || return 1
    git -C "$wt" push --quiet origin "$branch" || return 1
    remove_synthetic_branch_worktree "$fixture" "$wt"

    status_before="$(git -C "$fixture" status --porcelain)"
    output="$(cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" PATH="$fixture/bin:$PATH" \
        SOPS_AGE_KEY_FILE="$identity_a" scripts/security/secrets-approve.sh "$branch" 2>&1)" || return 1
    status_after="$(git -C "$fixture" status --porcelain)"
    current_branch="$(git -C "$fixture" branch --show-current)"

    [[ "$status_after" == "$status_before" ]] || return 1
    [[ "$current_branch" == "main" ]] || return 1
    [[ "$output" == *"secrets-approve: re-wrapped 1 file(s) for the new recipient list and pushed $branch"* ]] || return 1
    [[ "$output" != *"synthetic-shared-value"* ]] || return 1

    mkdir -p "$fixture/verify"
    git -C "$fixture.git" show "$branch:secrets/dev.enc.yaml" > "$fixture/verify/dev.enc.yaml" || return 1
    grep -Fq "recipient: $pub_b" "$fixture/verify/dev.enc.yaml" || return 1

    dec_b="$(HOME="$fixture/home" SOPS_AGE_KEY="" PATH="$fixture/bin:$PATH" SOPS_AGE_KEY_FILE="$identity_b" \
        sops --decrypt --input-type yaml --output-type dotenv "$fixture/verify/dev.enc.yaml")" || return 1
    [[ "$dec_b" == *"BASE=synthetic-shared-value"* ]] || return 1

    dec_a="$(HOME="$fixture/home" SOPS_AGE_KEY="" PATH="$fixture/bin:$PATH" SOPS_AGE_KEY_FILE="$identity_a" \
        sops --decrypt --input-type yaml --output-type dotenv "$fixture/verify/dev.enc.yaml")" || return 1
    [[ "$dec_a" == *"BASE=synthetic-shared-value"* ]]
}

test_approve_requires_decrypting_identity() {
    local fixture="$TEST_ROOT/approve-no-identity" sops_bin branch output rc
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    sops_bin="$(resolve_tool sops)" || return 1
    ln -s "$sops_bin" "$fixture/bin/sops" || return 1
    branch="onboard/no-identity-test"

    set +e
    output="$(cd "$fixture" && CI="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" PATH="$fixture/bin:$PATH" \
        SOPS_AGE_KEY="" SOPS_AGE_KEY_FILE="" scripts/security/secrets-approve.sh "$branch" 2>&1)"
    rc=$?
    set -e

    [[ $rc -eq 1 ]] || return 1
    [[ "$output" == *"no age private key found"* ]]
}

run_test "plaintext secrets ignored; encrypted files and README committable" test_ignore_policy
run_test "staging secrets refused on a workstation" test_non_dev_refusal
run_test "sync replaces, adds, skips empty values, preserves local lines, and writes mode 0600" test_sync_merge
run_test "sync accepts a first encrypted file whose shared values are all empty" test_sync_all_empty
run_test "failed first encryption leaves no target or temporary plaintext" test_encrypt_failure_is_atomic
run_test "updatekeys refuses a missing environment file before calling sops" test_updatekeys_refuses_missing_file
run_test "real sops+age: create, set, sync, add recipient, remove recipient, deny removed identity" test_real_roundtrip_and_rekey

run_test "onboard generates a mode-600 identity in a mode-700 dir and never prints the key" test_onboard_generates_identity_mode_600
run_test "onboard never overwrites an existing identity" test_onboard_never_overwrites_existing_key
run_test "onboard inserts the labelled recipient directly under the ADD RECIPIENTS marker" test_onboard_adds_labelled_recipient_under_marker
run_test "onboard stops with a hint when git has no user.name/user.email" test_onboard_requires_git_identity
run_test "onboard pushes the onboarding branch and leaves the developer's tree/branch untouched" test_onboard_pushes_branch_and_leaves_tree_clean
run_test "secrets_github_compare_url prints the compare URL for a github.com remote" test_onboard_prints_compare_url_for_github_remote
run_test "onboard prints the manual push command and keeps the local branch when push fails" test_onboard_push_failure_prints_manual_commands
run_test "onboard is a no-op once the recipient is already listed" test_onboard_noop_when_recipient_already_listed
run_test "onboard skips entirely under CI" test_onboard_skips_in_ci

run_test "secrets-backup-done writes a dated, mode-600 marker with no key material" test_backup_done_writes_dated_marker

run_test "doctor's secrets checks report the right outcome for no/unlisted/complete identities" test_doctor_checks_report_expected_outcomes

run_test "approve refuses a branch that touches files other than .sops.yaml" test_approve_refuses_extra_files
run_test "approve refuses a branch that removes a recipient" test_approve_refuses_recipient_removal
run_test "approve re-wraps secrets for the new recipient and pushes; the new identity decrypts" test_approve_rewraps_and_new_identity_decrypts
run_test "approve requires an identity that can decrypt today" test_approve_requires_decrypting_identity

if [[ $failures -ne 0 ]]; then
    echo "secrets tests: $failures failed" >&2
    exit 1
fi
echo "secrets tests: all passed"
