#!/usr/bin/env bash
# Black-box regression suite for the sops + age scripts (secrets-sync.sh, secrets-push.sh,
# secrets-edit.sh, secrets-updatekeys.sh, secrets-onboard.sh, secrets-approve.sh,
# secrets-backup-done.sh, and the secrets-doctor.sh fragment) and the secrets/ ignore policy
# (planning/15 §6, P02 T02/T12; plan s2-automated-secrets-onboarding).
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

# resolve_tool, because, and the recording wrappers (record_wrappers, record_clean) that
# scripts/test/repo-setup.test.sh uses as well.
# shellcheck source=scripts/test/recording.sh
source "$ROOT/scripts/test/recording.sh"

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
    # secrets-lib.sh sources it (the origin -> OWNER/REPO parsing).
    cp "$ROOT/scripts/github-lib.sh" "$fixture/scripts/"
    [[ -f "$ROOT/scripts/security/secrets-onboard.sh" ]] && cp "$ROOT/scripts/security/secrets-onboard.sh" "$fixture/scripts/security/"
    [[ -f "$ROOT/scripts/security/secrets-approve.sh" ]] && cp "$ROOT/scripts/security/secrets-approve.sh" "$fixture/scripts/security/"
    [[ -f "$ROOT/scripts/security/secrets-backup-done.sh" ]] && cp "$ROOT/scripts/security/secrets-backup-done.sh" "$fixture/scripts/security/"
    [[ -f "$ROOT/scripts/security/secrets-doctor.sh" ]] && cp "$ROOT/scripts/security/secrets-doctor.sh" "$fixture/scripts/security/"
    [[ -f "$ROOT/scripts/security/secrets-push.sh" ]] && cp "$ROOT/scripts/security/secrets-push.sh" "$fixture/scripts/security/"
    for script in secrets-onboard.sh secrets-approve.sh secrets-backup-done.sh secrets-push.sh; do
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
# scripts/doctor.sh (mise, docker, pnpm). scripts/lib.sh is sourced first, as doctor.sh does (the
# parity checks read .env through its env_file_value); the stubs then replace its ok/fail/warnc.
# CI and SOPS_AGE_KEY are neutralised so the outcome is deterministic regardless of the ambient
# shell (portability.yml runs this suite with CI=true).
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
        # shellcheck disable=SC1091
        . scripts/lib.sh
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
        SECRETS_ONBOARD_STATUS_FILE="$fixture/onboard.status" PATH="$fixture/bin:$PATH" \
        scripts/security/secrets-onboard.sh 2>&1)" || return 1

    [[ "$(cat "$fixture/onboard.status")" == "skipped" ]] || return 1
    [[ ! -e "$path" ]] || return 1
    [[ "$output" == *"skipping onboarding (CI or SOPS_AGE_KEY is set)"* ]] || return 1
    branches="$(git -C "$fixture.git" for-each-ref --format='%(refname)' refs/heads/onboard/)"
    [[ -z "$branches" ]]
}

# bootstrap.sh picks its closing "Secrets:" hint from SECRETS_ONBOARD_STATUS_FILE: "pushed" only when
# an onboarding branch was actually pushed (a PR to open), "synced" only when secrets-sync ran.
test_onboard_status_file_reports_pushed() {
    local fixture="$TEST_ROOT/onboard-status-pushed" status age_keygen
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    age_keygen="$(resolve_tool age-keygen)" || return 1
    ln -s "$age_keygen" "$fixture/bin/age-keygen" || return 1
    status="$TEST_ROOT/onboard-status-pushed.status"

    (cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        SECRETS_ONBOARD_STATUS_FILE="$status" PATH="$fixture/bin:$PATH" \
        scripts/security/secrets-onboard.sh >/dev/null 2>&1) || return 1

    grep -Fxq pushed "$status" || return 1
    ! grep -Fxq synced "$status"
}

test_onboard_status_file_reports_synced_without_push() {
    local fixture="$TEST_ROOT/onboard-status-synced" status path age_keygen pub branches
    fixture_repo "$fixture"
    fixture_git_repo "$fixture"
    # A decrypt that succeeds: the recipient is already approved, so onboarding syncs .env directly.
    printf '#!/usr/bin/env bash\nprintf "BASE=\\n"\n' > "$fixture/bin/sops"
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
    status="$TEST_ROOT/onboard-status-synced.status"

    (cd "$fixture" && CI="" SOPS_AGE_KEY="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        SECRETS_ONBOARD_STATUS_FILE="$status" PATH="$fixture/bin:$PATH" \
        scripts/security/secrets-onboard.sh >/dev/null 2>&1) || return 1

    grep -Fxq synced "$status" || return 1
    ! grep -Fxq pushed "$status" || return 1
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

# --- age identity path (secrets-lib.sh pins SOPS_AGE_KEY_FILE) ------------------------------------

# sops documents a different default keys file per OS (Linux: ${XDG_CONFIG_HOME:-~/.config}/sops/age/keys.txt;
# macOS: ~/Library/Application Support/sops/age/keys.txt unless XDG_CONFIG_HOME is set), while the
# scripts create and check ${XDG_CONFIG_HOME:-~/.config}/sops/age/keys.txt everywhere. The library
# therefore exports SOPS_AGE_KEY_FILE for that file when it exists, so sops reads the file the
# scripts use. Each case sources the library in an otherwise empty environment and reads the
# variable back from a child process. The keys files here are placeholders, never key material.
test_lib_pins_identity_file() {
    local home="$TEST_ROOT/identity-home" empty_home="$TEST_ROOT/identity-home-empty"
    local lib="$ROOT/scripts/security/secrets-lib.sh" out
    mkdir -p "$home/.config/sops/age" "$home/xdg/sops/age" "$empty_home"
    printf 'synthetic-not-a-real-key\n' > "$home/.config/sops/age/keys.txt"
    printf 'synthetic-not-a-real-key\n' > "$home/xdg/sops/age/keys.txt"

    # shellcheck disable=SC2016 # $1 is expanded by the inner bash
    out="$(env -i PATH="$PATH" HOME="$home" bash -c '. "$1"; env' _ "$lib" | grep '^SOPS_AGE_KEY_FILE=')" || return 1
    [[ "$out" == "SOPS_AGE_KEY_FILE=$home/.config/sops/age/keys.txt" ]] || return 1

    # shellcheck disable=SC2016
    out="$(env -i PATH="$PATH" HOME="$home" XDG_CONFIG_HOME="$home/xdg" bash -c '. "$1"; env' _ "$lib" | grep '^SOPS_AGE_KEY_FILE=')" || return 1
    [[ "$out" == "SOPS_AGE_KEY_FILE=$home/xdg/sops/age/keys.txt" ]] || return 1

    # An explicit file is left alone.
    # shellcheck disable=SC2016
    out="$(env -i PATH="$PATH" HOME="$home" SOPS_AGE_KEY_FILE="$home/elsewhere.txt" bash -c '. "$1"; env' _ "$lib" | grep '^SOPS_AGE_KEY_FILE=')" || return 1
    [[ "$out" == "SOPS_AGE_KEY_FILE=$home/elsewhere.txt" ]] || return 1

    # Key material in the environment (CI): nothing is exported.
    # shellcheck disable=SC2016
    out="$(env -i PATH="$PATH" HOME="$home" SOPS_AGE_KEY=synthetic-test-identity bash -c '. "$1"; env' _ "$lib" | grep -c '^SOPS_AGE_KEY_FILE=' || true)"
    [[ "$out" == "0" ]] || return 1

    # No keys file at the default path: nothing is exported either. sops fails on a
    # SOPS_AGE_KEY_FILE it cannot open, so its own lookup must stay untouched.
    # shellcheck disable=SC2016
    out="$(env -i PATH="$PATH" HOME="$empty_home" bash -c '. "$1"; env' _ "$lib" | grep -c '^SOPS_AGE_KEY_FILE=' || true)"
    [[ "$out" == "0" ]]
}

# End to end with the real sops: an identity at the default path, with HOME as the only hint
# (no XDG_CONFIG_HOME, SOPS_AGE_KEY_FILE or SOPS_AGE_KEY), decrypts. On Linux this passes with or
# without the pin (sops's own default is the same file); on macOS it is the proof that the pin
# works (portability.yml's macos-26 leg runs this suite).
test_default_identity_path_decrypts() {
    local fixture="$TEST_ROOT/identity-default" path pub
    if ! command -v sops >/dev/null 2>&1 || ! command -v age-keygen >/dev/null 2>&1; then
        echo "  sops/age-keygen not on PATH (mise.toml pins them; run 'mise install' / activate mise)" >&2
        return 1
    fi
    fixture_repo "$fixture"
    rm "$fixture/secrets/dev.enc.yaml" "$fixture/bin/age"
    for tool in sops age age-keygen; do
        ln -s "$(resolve_tool "$tool")" "$fixture/bin/$tool" || return 1
    done
    path="$fixture/home/.config/sops/age/keys.txt"
    mkdir -p "$(dirname "$path")"
    age-keygen -o "$path" >/dev/null 2>&1 || return 1
    pub="$(age-keygen -y "$path")"
    write_sops_config "$fixture" "$pub"
    printf 'BASE: synthetic-default-path-value\n' > "$fixture/secrets/dev.plain.yaml"
    (cd "$fixture" && PATH="$fixture/bin:$PATH" \
        sops --encrypt --input-type yaml --output-type yaml --filename-override secrets/dev.enc.yaml secrets/dev.plain.yaml \
        > secrets/dev.enc.yaml.tmp) || return 1
    mv "$fixture/secrets/dev.enc.yaml.tmp" "$fixture/secrets/dev.enc.yaml"
    command rm -f "$fixture/secrets/dev.plain.yaml"

    (cd "$fixture" && env -u XDG_CONFIG_HOME -u SOPS_AGE_KEY_FILE -u SOPS_AGE_KEY CI="" HOME="$fixture/home" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-sync.sh dev >/dev/null 2>&1) || return 1
    grep -Fxq 'BASE=synthetic-default-path-value' "$fixture/.env"
}

# --- secrets-push.sh and doctor's parity checks (real sops + age, synthetic values only) ----------

# Every secret value in the push fixtures carries the marker "synthetic-", so one pattern proves a
# command printed no value. Key names, file names and the fixture path never contain it.
has_no_value() {
    [[ "$1" != *synthetic-* ]]
}

# A fixture for the push and parity tests: real sops, age and age-keygen in bin/, a throwaway
# identity at the default path (home/.config/sops/age/keys.txt) that is the only dev recipient, a
# seven-key .env.example (one key tagged [machine-local]), a .env, and a secrets/dev.enc.yaml
# encrypted from a plain YAML that is removed again. One key per case secrets-push.sh tells apart:
#   SAME          equal on both sides          -> untouched
#   CHANGED       different                    -> left alone; replaced with --replace only (.env
#                                                 wins; quotes and `export` stripped)
#   EMPTY_SHARED  empty in the shared file     -> fill
#   MISSING       name not in the shared file  -> add, with a value that needs JSON escaping
#   MISSING_EMPTY name missing, no local value -> add, empty
#   LOCAL_EMPTY   no local value               -> the shared value survives
#   LOCAL_ONLY    tagged [machine-local]       -> never pushed
#   STALE_ONE     only in the shared file, empty          -> removed with --prune only
#   STALE_TWO     only in the shared file, holds a value  -> removed with --prune --prune-values only
#   UNDECLARED    only in .env                 -> never pushed
push_fixture() {
    local fixture="$1"
    fixture_repo "$fixture"
    rm "$fixture/secrets/dev.enc.yaml"

    cat > "$fixture/.env.example" <<'EXAMPLE'
# Synthetic key catalogue for the push tests.
# Equal in .env and in the shared file.
SAME=
# Different in .env.
CHANGED=
# Empty in the shared file, set in .env.
EMPTY_SHARED=
# Not in the shared file, set in .env.
MISSING=
# Not in the shared file, empty in .env.
MISSING_EMPTY=
# Set in the shared file, empty in .env.
LOCAL_EMPTY=
# Set in .env, never shared.
# [machine-local] a per-machine value.
LOCAL_ONLY=
EXAMPLE
    cat > "$fixture/.env" <<'DOTENV'
# personal comment
SAME=synthetic-same-value
export CHANGED="synthetic-new-value"
EMPTY_SHARED=synthetic-fill-value
MISSING=synthetic-missing "quoted" back\slash value
MISSING_EMPTY=
LOCAL_EMPTY=
LOCAL_ONLY=synthetic-machine-local-value
UNDECLARED=synthetic-undeclared-value
DOTENV
    cat > "$fixture/secrets/dev.plain.yaml" <<'PLAIN'
# A leading comment, like the one secrets-edit.sh writes: sops encrypts it into a #ENC[...] line.
SAME: synthetic-same-value
CHANGED: synthetic-old-value
EMPTY_SHARED: ""
LOCAL_EMPTY: synthetic-shared-only-value
LOCAL_ONLY: ""
STALE_ONE: ""
STALE_TWO: synthetic-stale-value
PLAIN
    # Real tools in bin/, the throwaway identity, .sops.yaml, and the encrypted file
    # (scripts/test/recording.sh).
    sops_dev_fixture "$fixture"
}

# The [machine-local] tag of .env.example: only a comment line that starts with it counts, it covers
# every KEY= line directly below its comment block, and a new comment block or a blank line ends it.
test_machine_local_tag_rules() {
    local fixture="$TEST_ROOT/machine-local" out
    mkdir -p "$fixture"
    cat > "$fixture/.env.example" <<'EXAMPLE'
# A header that only mentions the tag "[machine-local]" in the middle of a line.
# ---

# A plain key.
PLAIN=
# A tagged key.
# [machine-local] with a reason after the tag.
TAGGED=
# The tag covers every key directly below its comment block.
# [machine-local]
GROUP_ONE=
GROUP_TWO=
# A new comment block ends it.
AFTER_GROUP=
# [machine-local] a blank line ends it too.

AFTER_BLANK=
EXAMPLE
    # shellcheck disable=SC1091
    out="$(cd "$fixture" && . "$ROOT/scripts/security/secrets-lib.sh" && secrets_machine_local_keys | tr '\n' ' ')" || return 1
    [[ "$out" == "TAGGED GROUP_ONE GROUP_TWO " ]] || return 1
    # shellcheck disable=SC1091
    out="$(cd "$fixture" && . "$ROOT/scripts/security/secrets-lib.sh" && secrets_example_keys | tr '\n' ' ')" || return 1
    [[ "$out" == "PLAIN TAGGED GROUP_ONE GROUP_TWO AFTER_GROUP AFTER_BLANK " ]]
}

# Runs secrets-push.sh in <fixture>; further arguments go to the script. The identity is found the
# way a workstation finds it: no SOPS_AGE_KEY, no SOPS_AGE_KEY_FILE, the default keys file.
run_push() {
    local fixture="$1"
    shift
    (cd "$fixture" && CI="" SOPS_AGE_KEY="" SOPS_AGE_KEY_FILE="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-push.sh "$@")
}

# The decrypted KEY=value lines of <fixture>'s shared dev file, for assertions only.
push_decrypt() {
    (cd "$1" && HOME="$1/home" SOPS_AGE_KEY="" SOPS_AGE_KEY_FILE="$1/home/.config/sops/age/keys.txt" PATH="$1/bin:$PATH" \
        sops --decrypt --input-type yaml --output-type dotenv secrets/dev.enc.yaml)
}

test_push_dry_run_lists_names_and_writes_nothing() {
    local fixture="$TEST_ROOT/push-dry" output
    push_fixture "$fixture" || return 1
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/before.enc.yaml"

    output="$(run_push "$fixture" 2>&1)" || return 1
    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml" || return 1
    [[ "$output" == *"dry run for secrets/dev.enc.yaml"* ]] || return 1
    grep -Eq '^  add +MISSING +\(new name, value from \.env\)$' <<< "$output" || return 1
    grep -Eq '^  add +MISSING_EMPTY +\(new name, empty value\)$' <<< "$output" || return 1
    grep -Eq '^  fill +EMPTY_SHARED ' <<< "$output" || return 1
    # A differing value is "differs" in a bare plan: --apply alone would leave it alone.
    grep -Eq '^  differs +CHANGED ' <<< "$output" || return 1
    grep -Eq '^  stale +STALE_ONE ' <<< "$output" || return 1
    grep -Eq '^  stale +STALE_TWO ' <<< "$output" || return 1
    grep -Fxq '  held back, tagged [machine-local] in .env.example: LOCAL_ONLY' <<< "$output" || return 1
    [[ "$output" == *"2 to add, 1 to fill, 1 differing (left alone), 2 stale (1 with a value); 1 already equal, 1 with no value in .env, 1 held back"* ]] || return 1
    [[ "$output" == *"to write it: just secrets-push dev --apply"* ]] || return 1
    ! grep -Eq ' (SAME|LOCAL_EMPTY|UNDECLARED)( |$)' <<< "$output" || return 1
    has_no_value "$output" || return 1

    # --dry-run is the same mode spelled out; --replace and --prune alone are still dry runs.
    output="$(run_push "$fixture" dev --dry-run 2>&1)" || return 1
    [[ "$output" == *"dry run for secrets/dev.enc.yaml"* ]] || return 1
    output="$(run_push "$fixture" dev --dry-run --replace 2>&1)" || return 1
    grep -Eq '^  replace +CHANGED ' <<< "$output" || return 1
    [[ "$output" == *"2 to add, 1 to fill, 1 to replace, 2 stale (1 with a value); 1 already equal, 1 with no value in .env, 1 held back"* ]] || return 1
    [[ "$output" == *"to write it: just secrets-push dev --apply --replace"* ]] || return 1
    has_no_value "$output" || return 1
    output="$(run_push "$fixture" --prune 2>&1)" || return 1
    grep -Eq '^  remove +STALE_ONE ' <<< "$output" || return 1
    [[ "$output" == *"to write it: just secrets-push dev --apply --prune"* ]] || return 1
    has_no_value "$output" || return 1
    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml"
}

test_push_apply_adds_fills_replaces_and_keeps_the_rest() {
    local fixture="$TEST_ROOT/push-apply" output dec same_before local_empty_before
    push_fixture "$fixture" || return 1
    same_before="$(grep '^SAME:' "$fixture/secrets/dev.enc.yaml")"
    local_empty_before="$(grep '^LOCAL_EMPTY:' "$fixture/secrets/dev.enc.yaml")"

    # --replace is what makes --apply overwrite the differing CHANGED; without it that key is left
    # alone (test_push_apply_leaves_a_differing_value_alone_without_replace).
    output="$(run_push "$fixture" --apply --replace 2>&1)" || return 1
    dec="$(push_decrypt "$fixture")" || return 1

    grep -Fxq 'MISSING=synthetic-missing "quoted" back\slash value' <<< "$dec" || return 1
    grep -Fxq 'MISSING_EMPTY=' <<< "$dec" || return 1
    grep -Fxq 'EMPTY_SHARED=synthetic-fill-value' <<< "$dec" || return 1
    grep -Fxq 'CHANGED=synthetic-new-value' <<< "$dec" || return 1
    grep -Fxq 'SAME=synthetic-same-value' <<< "$dec" || return 1
    grep -Fxq 'LOCAL_EMPTY=synthetic-shared-only-value' <<< "$dec" || return 1
    grep -Fxq 'LOCAL_ONLY=' <<< "$dec" || return 1
    ! grep -q '^UNDECLARED=' <<< "$dec" || return 1
    # Stale names stay without --prune.
    grep -Fxq 'STALE_ONE=' <<< "$dec" || return 1
    grep -Fxq 'STALE_TWO=synthetic-stale-value' <<< "$dec" || return 1

    # Ciphertext only on disk, and a value that was not pushed keeps its ciphertext, so the diff a
    # reviewer sees names the changed keys only. The encrypted comment line survives too.
    ! grep -q 'synthetic-' "$fixture/secrets/dev.enc.yaml" || return 1
    [[ "$(sed -n '1p' "$fixture/secrets/dev.enc.yaml")" == '#ENC['* ]] || return 1
    [[ "$(grep '^SAME:' "$fixture/secrets/dev.enc.yaml")" == "$same_before" ]] || return 1
    [[ "$(grep '^LOCAL_EMPTY:' "$fixture/secrets/dev.enc.yaml")" == "$local_empty_before" ]] || return 1

    grep -Eq '^  added +MISSING$' <<< "$output" || return 1
    grep -Eq '^  added +MISSING_EMPTY +\(name only, empty value\)$' <<< "$output" || return 1
    grep -Eq '^  filled +EMPTY_SHARED$' <<< "$output" || return 1
    grep -Eq '^  replaced +CHANGED$' <<< "$output" || return 1
    [[ "$output" == *"wrote secrets/dev.enc.yaml — 2 added, 1 filled, 1 replaced, 0 removed"* ]] || return 1
    [[ "$output" == *"2 stale name(s) left"* ]] || return 1
    has_no_value "$output"
}

test_push_second_apply_changes_nothing() {
    local fixture="$TEST_ROOT/push-again" output
    push_fixture "$fixture" || return 1
    run_push "$fixture" --apply --replace >/dev/null 2>&1 || return 1
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/after-first.enc.yaml"

    output="$(run_push "$fixture" --apply --replace 2>&1)" || return 1
    cmp -s "$fixture/after-first.enc.yaml" "$fixture/secrets/dev.enc.yaml" || return 1
    [[ "$output" == *"nothing to push"* ]] || return 1
    has_no_value "$output"
}

test_push_prune_removes_stale_names_only_with_the_flag() {
    local fixture="$TEST_ROOT/push-prune" output dec
    push_fixture "$fixture" || return 1

    run_push "$fixture" --apply --replace >/dev/null 2>&1 || return 1
    grep -q '^STALE_ONE:' "$fixture/secrets/dev.enc.yaml" || return 1
    grep -q '^STALE_TWO:' "$fixture/secrets/dev.enc.yaml" || return 1

    # Both names go in one run only with both flags: STALE_TWO holds a value
    # (test_push_prune_needs_a_second_flag_for_a_stale_value covers --prune alone).
    output="$(run_push "$fixture" --apply --prune --prune-values 2>&1)" || return 1
    ! grep -q '^STALE_' "$fixture/secrets/dev.enc.yaml" || return 1
    grep -Eq '^  removed +STALE_ONE$' <<< "$output" || return 1
    grep -Eq '^  removed +STALE_TWO$' <<< "$output" || return 1
    [[ "$output" == *"0 added, 0 filled, 0 replaced, 2 removed"* ]] || return 1
    has_no_value "$output" || return 1

    # Every declared key is still there, with its value.
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'SAME=synthetic-same-value' <<< "$dec" || return 1
    grep -Fxq 'CHANGED=synthetic-new-value' <<< "$dec" || return 1
    grep -Fxq 'LOCAL_EMPTY=synthetic-shared-only-value' <<< "$dec" || return 1
    [[ "$(grep -c '=' <<< "$dec")" == "7" ]]
}

test_push_refuses_protected_environments_and_bad_usage() {
    local fixture="$TEST_ROOT/push-refuse" output rc env_name
    fixture_repo "$fixture"
    printf '#!/usr/bin/env bash\necho "sops must not run" >&2\nexit 99\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    printf 'BASE=synthetic-local-value\n' > "$fixture/.env"

    for env_name in staging prod; do
        set +e
        output="$(run_push "$fixture" "$env_name" --apply 2>&1)"
        rc=$?
        set -e
        [[ $rc -eq 1 ]] || return 1
        [[ "$output" == *"refusing to push a workstation .env into secrets/$env_name.enc.yaml"* ]] || return 1
        [[ "$output" != *"sops must not run"* ]] || return 1

        set +e
        output="$(printf 'synthetic-stdin-value\n' | run_push "$fixture" "$env_name" --set BASE 2>&1)"
        rc=$?
        set -e
        [[ $rc -eq 1 ]] || return 1
        [[ "$output" == *"refusing to push a workstation .env into secrets/$env_name.enc.yaml"* ]] || return 1
        has_no_value "$output" || return 1
    done

    # An environment name the script does not know is wrong usage, and like every argument it does
    # not recognise it is not echoed (test_push_never_echoes_an_argument_it_does_not_recognise).
    set +e
    output="$(run_push "$fixture" qa 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 2 && "$output" == *"unexpected argument"* && "$output" != *qa* ]] || return 1

    set +e
    output="$(run_push "$fixture" --apply --dry-run 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 2 && "$output" == *"--apply and --dry-run exclude each other"* ]] || return 1

    set +e
    output="$(run_push "$fixture" --set BASE --apply 2>&1 </dev/null)"
    rc=$?
    set -e
    [[ $rc -eq 2 && "$output" == *"--set KEY takes no other flag"* ]] || return 1

    set +e
    output="$(run_push "$fixture" --set 'not-a-key' 2>&1 </dev/null)"
    rc=$?
    set -e
    [[ $rc -eq 2 && "$output" == *"--set needs a key name"* ]] || return 1

    set +e
    output="$(run_push "$fixture" --force 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 2 && "$output" == *"unknown flag"* && "$output" != *"--force"* ]] || return 1
    [[ "$output" != *"sops must not run"* ]]
}

# A failed decrypt must stop the run: without the shared values every local value would look new.
test_push_stops_without_a_decrypting_identity_or_an_env_file() {
    local fixture="$TEST_ROOT/push-no-decrypt" output rc path
    push_fixture "$fixture" || return 1
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/before.enc.yaml"
    path="$fixture/home/.config/sops/age/keys.txt"

    mv "$fixture/.env" "$fixture/env.saved"
    set +e
    output="$(run_push "$fixture" --apply 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *".env not found"* ]] || return 1
    mv "$fixture/env.saved" "$fixture/.env"

    # An identity that is not a recipient of the file.
    rm "$path"
    age-keygen -o "$path" >/dev/null 2>&1 || return 1
    set +e
    output="$(run_push "$fixture" --apply --prune 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *"could not read secrets/dev.enc.yaml with your identity"* ]] || return 1
    has_no_value "$output" || return 1
    set +e
    output="$(printf 'synthetic-stdin-value\n' | run_push "$fixture" --set MISSING 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *"sops could not write MISSING"* ]] || return 1
    has_no_value "$output" || return 1

    # No identity at all.
    rm "$path"
    set +e
    output="$(run_push "$fixture" 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *"no age private key found"* ]] || return 1

    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml"
}

test_push_set_stores_one_value_from_stdin() {
    local fixture="$TEST_ROOT/push-set" output dec rc
    push_fixture "$fixture" || return 1

    # A name the shared file does not have yet.
    output="$(printf 'synthetic-stdin-value\n' | run_push "$fixture" --set MISSING 2>&1)" || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'MISSING=synthetic-stdin-value' <<< "$dec" || return 1
    grep -Eq '^  added MISSING$' <<< "$output" || return 1
    has_no_value "$output" || return 1
    # Nothing else moved: --set is one key, not a push of .env.
    grep -Fxq 'CHANGED=synthetic-old-value' <<< "$dec" || return 1
    grep -Fxq 'EMPTY_SHARED=' <<< "$dec" || return 1
    grep -Fxq 'STALE_TWO=synthetic-stale-value' <<< "$dec" || return 1

    # An existing name (rotation); no trailing newline on stdin.
    output="$(printf 'synthetic-rotated-value' | run_push "$fixture" --set CHANGED 2>&1)" || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'CHANGED=synthetic-rotated-value' <<< "$dec" || return 1
    grep -Eq '^  set CHANGED$' <<< "$output" || return 1
    has_no_value "$output" || return 1

    # The same value again leaves the file byte-identical.
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/after-set.enc.yaml"
    output="$(printf 'synthetic-rotated-value\n' | run_push "$fixture" --set CHANGED 2>&1)" || return 1
    cmp -s "$fixture/after-set.enc.yaml" "$fixture/secrets/dev.enc.yaml" || return 1
    grep -Eq '^  unchanged CHANGED$' <<< "$output" || return 1

    # Refused: a machine-local key, a name .env.example does not declare, an empty value, a control
    # character. None of them writes or echoes the value.
    set +e
    output="$(printf 'synthetic-refused-value\n' | run_push "$fixture" --set LOCAL_ONLY 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *"LOCAL_ONLY is tagged [machine-local]"* ]] || return 1
    has_no_value "$output" || return 1

    set +e
    output="$(printf 'synthetic-refused-value\n' | run_push "$fixture" --set UNDECLARED 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *"UNDECLARED is not a key in .env.example"* ]] || return 1
    has_no_value "$output" || return 1

    set +e
    output="$(run_push "$fixture" --set SAME 2>&1 </dev/null)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *"no value given for SAME"* ]] || return 1

    set +e
    output="$(printf 'synthetic-tab\tvalue\n' | run_push "$fixture" --set SAME 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *"contains a control character"* ]] || return 1
    has_no_value "$output" || return 1

    cmp -s "$fixture/after-set.enc.yaml" "$fixture/secrets/dev.enc.yaml"
}

# Every external command secrets-push.sh runs, sops included. run_push_recorded makes the wrappers
# below the whole PATH, so a command missing from this list cannot run at all: the list cannot fall
# behind the script without a test failing.
PUSH_WRAPPED_COMMANDS="sops awk mktemp chmod basename dirname cp cmp mv rm tr wc uname"

# Recording wrappers in <fixture>/rec, one per command above, plus plain links for bash and age,
# which the script only looks up (record_wrappers, scripts/test/recording.sh: each wrapper appends
# its argument list, an ON-DISK line and an IN-ENV line to $RECORD_FILE, then runs the real command).
push_record_wrappers() {
    RECORD_WRAPPER_EXTRA=push_sops_failures record_wrappers "$1" "$PUSH_WRAPPED_COMMANDS" age
}

# The extra lines of the sops wrapper. PUSH_SOPS_FAIL makes it fail the way the real one can, with
# text on stderr that carries the value marker: `decrypt` fails every decrypt, `set:<n>` the n-th
# `sops set` of the record, `hang` turns `sops set` into a 30 s wait (its PID goes to
# $RECORD_FILE.hang).
push_sops_failures() {
    local grep_path sleep_path
    [[ "$1" == sops ]] || return 0
    grep_path="$(command -v grep)" || return 1
    sleep_path="$(command -v sleep)" || return 1
    cat <<WRAPPER
case "\${PUSH_SOPS_FAIL:-}" in
    decrypt) if [[ " \$* " == *" --decrypt "* ]]; then echo 'sops: synthetic-text-in-an-error' >&2; exit 1; fi ;;
    set:*) if [[ "\${1:-}" == set && "\$PUSH_SOPS_FAIL" == "set:\$('$grep_path' -c '^sops set ' "\$RECORD_FILE")" ]]; then echo 'sops: synthetic-text-in-an-error' >&2; exit 1; fi ;;
    hang) if [[ "\${1:-}" == set ]]; then echo "\$\$" > "\$RECORD_FILE.hang"; exec '$sleep_path' 30; fi ;;
esac
WRAPPER
}

# run_push with the recording wrappers as the entire PATH and <fixture>/tmp as TMPDIR.
run_push_recorded() {
    local fixture="$1"
    shift
    (cd "$fixture" && CI="" SOPS_AGE_KEY="" SOPS_AGE_KEY_FILE="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        TMPDIR="$fixture/tmp" RECORD_FILE="$fixture/record.txt" PATH="$fixture/rec" scripts/security/secrets-push.sh "$@")
}

# After run_push_recorded: no value was an argument of any command, in a file under tmp/ or secrets/
# while any command ran, or in a command's environment; and nothing is left in tmp/ or, beside the
# encrypted file, in secrets/ (record_clean, scripts/test/recording.sh).
push_record_clean() {
    record_clean "$1"
}

# Every external command the push runs goes through a recording wrapper
# (push_record_wrappers), on the paths that write and on the paths that refuse. Proves the three
# "never" rules of secrets-push.sh for all of them: no value on a command line (so none in a
# process list), none in a file under TMPDIR or secrets/ at the moment any command starts, none in
# a command's environment; and nothing left behind. The recorder is first shown to see each of the
# three. The paths that fail (a control character, a failed decrypt, a failed later write, SIGTERM)
# run under the same wrappers in the cases below.
# Not covered: the hidden prompt of --set. It needs a terminal; from the `read` on, the typed value
# and the piped one take the same code. And a file bash creates and unlinks without running a
# command (how bash 3.2 backs a here-string) is invisible to any wrapper: the script is grepped
# for `<<` instead.
test_push_keeps_values_off_command_lines_and_temp_files() {
    local fixture="$TEST_ROOT/push-leaks" output rc dec
    push_fixture "$fixture" || return 1
    push_record_wrappers "$fixture" || return 1

    # The recorder sees a value as an argument, in a file, and in the environment.
    (export RECORD_FILE="$fixture/probe.txt"; "$fixture/rec/basename" synthetic-probe-argument >/dev/null) || return 1
    grep -q '^basename synthetic-probe-argument$' "$fixture/probe.txt" || return 1
    ! grep -Eq '^(ON-DISK|IN-ENV) ' "$fixture/probe.txt" || return 1
    printf 'synthetic-probe-file\n' > "$fixture/tmp/probe"
    (export RECORD_FILE="$fixture/probe.txt"; "$fixture/rec/basename" probe >/dev/null) || return 1
    rm "$fixture/tmp/probe"
    grep -q '^ON-DISK basename$' "$fixture/probe.txt" || return 1
    (export RECORD_FILE="$fixture/probe.txt" PROBE=synthetic-probe-environment; "$fixture/rec/basename" probe >/dev/null) || return 1
    grep -q '^IN-ENV basename$' "$fixture/probe.txt" || return 1

    # The plan, with every flag.
    output="$(run_push_recorded "$fixture" --replace --prune --prune-values 2>&1)" || return 1
    has_no_value "$output" || return 1

    # Refused: the value given as an argument. It is on the script's own command line,
    # which the user typed; it must not reach the output or any command the script starts.
    set +e
    output="$(run_push_recorded "$fixture" --set MISSING synthetic-positional-value 2>&1 </dev/null)"
    rc=$?
    set -e
    [[ $rc -eq 2 ]] || return 1
    has_no_value "$output" || return 1

    # Refused: a .env value followed by an inline comment.
    cp "$fixture/.env" "$fixture/env.saved"
    printf 'SAME=synthetic-same-value # an inline note\n' >> "$fixture/.env"
    set +e
    output="$(run_push_recorded "$fixture" --apply 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 ]] || return 1
    has_no_value "$output" || return 1
    cp "$fixture/env.saved" "$fixture/.env"

    # Left alone: the differing value and the stale name that holds one.
    output="$(run_push_recorded "$fixture" --apply --prune 2>&1)" || return 1
    has_no_value "$output" || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'CHANGED=synthetic-old-value' <<< "$dec" || return 1
    grep -Fxq 'STALE_TWO=synthetic-stale-value' <<< "$dec" || return 1

    # Every kind of write: replace, remove a name that holds a value, then --set from standard input.
    output="$(run_push_recorded "$fixture" --apply --replace --prune --prune-values 2>&1)" || return 1
    has_no_value "$output" || return 1
    output="$(printf 'synthetic-stdin-value\n' | run_push_recorded "$fixture" --set MISSING_EMPTY 2>&1)" || return 1
    has_no_value "$output" || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'CHANGED=synthetic-new-value' <<< "$dec" || return 1
    grep -Fxq 'MISSING_EMPTY=synthetic-stdin-value' <<< "$dec" || return 1
    ! grep -q '^STALE_' <<< "$dec" || return 1

    grep -q '^sops set --idempotent --value-stdin ' "$fixture/record.txt" || return 1
    grep -q '^sops unset ' "$fixture/record.txt" || return 1
    grep -q '^mv secrets/\.push\.' "$fixture/record.txt" || return 1
    ! grep -q '<<' "$fixture/scripts/security/secrets-push.sh" || because "secrets-push.sh uses a here-string or here-document" || return 1
    push_record_clean "$fixture"
}

# A .env.example that declares nothing (truncated, a bad merge) makes every shared key
# look stale, so the run must stop before it compares anything.
test_push_refuses_an_env_example_without_keys() {
    local fixture="$TEST_ROOT/push-no-keys" output rc args
    push_fixture "$fixture" || return 1
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/before.enc.yaml"
    printf '# Synthetic key catalogue, truncated.\n' > "$fixture/.env.example"

    for args in "--apply --prune" "--prune" ""; do
        set +e
        # shellcheck disable=SC2086 # each case is a flag list: word splitting is the point
        output="$(run_push "$fixture" $args 2>&1)"
        rc=$?
        set -e
        cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml" \
            || because "with a keyless .env.example, 'secrets-push $args' rewrote the shared file: $(grep -c '^[A-Z_]*:' "$fixture/secrets/dev.enc.yaml") of $(grep -c '^[A-Z_]*:' "$fixture/before.enc.yaml") key names left" || return 1
        [[ $rc -eq 1 && "$output" == *".env.example declares no keys"* ]] \
            || because "'secrets-push $args' did not refuse a keyless .env.example (exit $rc)" || return 1
        has_no_value "$output" || return 1
    done

    rm "$fixture/.env.example"
    set +e
    output="$(run_push "$fixture" --apply --prune 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *".env.example not found"* ]] || return 1
    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml"
}

# --prune removes a stale name that is empty; one that holds a value needs
# --prune-values as well, so a .env.example that lost most of its keys cannot cost a value.
test_push_prune_needs_a_second_flag_for_a_stale_value() {
    local fixture="$TEST_ROOT/push-prune-values" truncated="$TEST_ROOT/push-truncated" output dec rc
    push_fixture "$truncated" || return 1
    printf '# Synthetic key catalogue, cut down to one key by a bad merge.\nSAME=\n' > "$truncated/.env.example"
    output="$(run_push "$truncated" --apply --prune 2>&1)" || return 1
    dec="$(push_decrypt "$truncated")" || return 1
    [[ "$(grep -c '=synthetic-' <<< "$dec")" == "4" ]] \
        || because "a truncated .env.example and --apply --prune left $(grep -c '=synthetic-' <<< "$dec") of 4 shared values" || return 1
    grep -Fxq 'CHANGED=synthetic-old-value' <<< "$dec" || return 1
    grep -Fxq 'LOCAL_EMPTY=synthetic-shared-only-value' <<< "$dec" || return 1
    grep -Fxq 'STALE_TWO=synthetic-stale-value' <<< "$dec" || return 1
    # The three stale names that were empty are gone; the three with a value are named.
    ! grep -Eq '^(EMPTY_SHARED|LOCAL_ONLY|STALE_ONE)=' <<< "$dec" || return 1
    [[ "$output" == *"3 stale name(s) left because they hold a value: CHANGED LOCAL_EMPTY STALE_TWO"* ]] || return 1
    has_no_value "$output" || return 1

    # The plan says which stale name is empty and which holds a value.
    push_fixture "$fixture" || return 1
    output="$(run_push "$fixture" 2>&1)" || return 1
    grep -Eq '^  stale +STALE_ONE +\(.*empty' <<< "$output" || return 1
    grep -Eq '^  stale +STALE_TWO +\(.*holds a value.*--prune --prune-values' <<< "$output" || return 1
    [[ "$output" == *"2 stale (1 with a value)"* ]] || return 1
    output="$(run_push "$fixture" --prune 2>&1)" || return 1
    grep -Eq '^  remove +STALE_ONE ' <<< "$output" || return 1
    grep -Eq '^  stale +STALE_TWO +\(.*holds a value' <<< "$output" || return 1
    has_no_value "$output" || return 1

    # --prune alone: the empty name goes, the one with a value stays and is named with its flag.
    output="$(run_push "$fixture" --apply --prune 2>&1)" || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    ! grep -q '^STALE_ONE=' <<< "$dec" || return 1
    grep -Fxq 'STALE_TWO=synthetic-stale-value' <<< "$dec" || return 1
    grep -Eq '^  removed +STALE_ONE$' <<< "$output" || return 1
    [[ "$output" == *"1 removed"* ]] || return 1
    [[ "$output" == *"1 stale name(s) left because they hold a value: STALE_TWO"* ]] || return 1
    [[ "$output" == *"just secrets-push dev --apply --prune --prune-values"* ]] || return 1
    has_no_value "$output" || return 1

    # --prune-values is the second opt-in, never the only one.
    set +e
    output="$(run_push "$fixture" --apply --prune-values 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 2 && "$output" == *"--prune-values only adds to --prune"* ]] || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'STALE_TWO=synthetic-stale-value' <<< "$dec" || return 1

    output="$(run_push "$fixture" --prune --prune-values 2>&1)" || return 1
    grep -Eq '^  remove +STALE_TWO +\(.*HOLDS A VALUE' <<< "$output" || return 1
    grep -q '^STALE_TWO:' "$fixture/secrets/dev.enc.yaml" || return 1
    output="$(run_push "$fixture" --apply --prune --prune-values 2>&1)" || return 1
    ! grep -q '^STALE_' "$fixture/secrets/dev.enc.yaml" || return 1
    grep -Eq '^  removed +STALE_TWO$' <<< "$output" || return 1
    has_no_value "$output"
}

# On a machine that has not synced since a credential was rotated elsewhere, .env holds
# the old value: a bare --apply must not push it back over the shared one.
test_push_apply_leaves_a_differing_value_alone_without_replace() {
    local fixture="$TEST_ROOT/push-no-replace" output dec
    push_fixture "$fixture" || return 1

    output="$(run_push "$fixture" --apply 2>&1)" || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'CHANGED=synthetic-old-value' <<< "$dec" \
        || because "a bare --apply overwrote the differing shared value of CHANGED with the one in .env" || return 1
    # It still adds and fills.
    grep -Fxq 'MISSING=synthetic-missing "quoted" back\slash value' <<< "$dec" || return 1
    grep -Fxq 'MISSING_EMPTY=' <<< "$dec" || return 1
    grep -Fxq 'EMPTY_SHARED=synthetic-fill-value' <<< "$dec" || return 1
    ! grep -q '^  replaced ' <<< "$output" || return 1
    [[ "$output" == *"2 added, 1 filled, 0 replaced, 0 removed"* ]] || return 1
    # The key it left alone is named, with both ways on.
    [[ "$output" == *"1 differing value(s) left alone: CHANGED"* ]] || return 1
    [[ "$output" == *"the newer one"*": just secrets-sync"* ]] || return 1
    [[ "$output" == *"the newer one"*": just secrets-push dev --apply --replace"* ]] || return 1
    has_no_value "$output" || return 1

    # Asked again it writes nothing and still names the key.
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/after-first.enc.yaml"
    output="$(run_push "$fixture" --apply 2>&1)" || return 1
    cmp -s "$fixture/after-first.enc.yaml" "$fixture/secrets/dev.enc.yaml" || return 1
    [[ "$output" == *"nothing to push"* && "$output" == *"left alone: CHANGED"* ]] || return 1

    # The plan says the same: "differs" without the flag, "replace" with it.
    output="$(run_push "$fixture" 2>&1)" || return 1
    grep -Eq '^  differs +CHANGED +\(.*--replace' <<< "$output" || return 1
    [[ "$output" == *"1 differing (left alone)"* && "$output" == *"nothing to write"* ]] || return 1
    output="$(run_push "$fixture" --replace 2>&1)" || return 1
    grep -Eq '^  replace +CHANGED ' <<< "$output" || return 1
    [[ "$output" == *"1 to replace"* && "$output" == *"to write it: just secrets-push dev --apply --replace"* ]] || return 1
    has_no_value "$output" || return 1
    cmp -s "$fixture/after-first.enc.yaml" "$fixture/secrets/dev.enc.yaml" || return 1

    output="$(run_push "$fixture" --apply --replace 2>&1)" || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'CHANGED=synthetic-new-value' <<< "$dec" || return 1
    grep -Eq '^  replaced +CHANGED$' <<< "$output" || return 1
    [[ "$output" == *"0 added, 0 filled, 1 replaced, 0 removed"* ]] || return 1
    has_no_value "$output"
}

# Doctor's side of the same rule: each parity hint starts with a dry run, never with --apply.
test_doctor_parity_hints_lead_with_the_dry_run() {
    local fixture="$TEST_ROOT/doctor-hints" record
    push_fixture "$fixture" || return 1
    record="$fixture/doctor-record.txt"
    : > "$record"
    probe_doctor_checks "$fixture" "$record" || return 1
    [[ "$(grep -c '^warnc|[^|]*|just secrets-push' "$record")" == "3" ]] || return 1
    ! grep -Eq '^warnc\|[^|]*\|just secrets-push( dev)?( --[a-z-]+)* --apply' "$record" \
        || because "$(grep -Ec '^warnc\|[^|]*\|just secrets-push( dev)?( --[a-z-]+)* --apply' "$record") doctor hint(s) lead with --apply" || return 1
    grep -Eq '^warnc\|secrets/dev\.enc\.yaml lacks key\(s\)[^|]*\|just secrets-push   \(a dry run' "$record" || return 1
    grep -Eq '^warnc\|secrets/dev\.enc\.yaml has stale key name\(s\)[^|]*\|just secrets-push   \(a dry run' "$record" || return 1
    grep -Eq '^warnc\|value\(s\) that exist only on this machine[^|]*\|just secrets-push   \(a dry run' "$record" || return 1
    ! grep -q 'synthetic-' "$record"
}

# The result is staged beside the target, so the last step is a rename inside one
# filesystem (a `mv` from TMPDIR is a copy plus an unlink wherever TMPDIR is another filesystem,
# and an interrupted copy leaves the target truncated or missing). The staging path is gitignored
# and inside the gitleaks allowlist for sops-encrypted files; a leftover of a killed run is swept.
test_push_stages_beside_the_target() {
    local fixture="$TEST_ROOT/push-stage" staged
    push_fixture "$fixture" || return 1
    push_record_wrappers "$fixture" || return 1
    mkdir "$fixture/secrets/.push.killed"
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/secrets/.push.killed/dev.enc.yaml"

    run_push_recorded "$fixture" --apply >/dev/null 2>&1 || return 1
    staged="$(awk '$1 == "mv" && $3 == "secrets/dev.enc.yaml" { print $2 }' "$fixture/record.txt")"
    case "$staged" in
        secrets/.push.*/dev.enc.yaml) ;;
        *) because "the final mv does not start beside the target: its source is under $([[ "$staged" == "$fixture/tmp/"* ]] && echo TMPDIR || echo "another directory")" || return 1 ;;
    esac
    git -C "$ROOT" check-ignore --no-index -q "$staged" || because "the staging path is not gitignored" || return 1
    grep -Fq "'''.*\.enc\.yaml\$'''" "$ROOT/.gitleaks.toml" || return 1
    grep -Eq '.*\.enc\.yaml$' <<< "$staged" || because "the staging path is outside the gitleaks allowlist for encrypted files" || return 1
    # No leftover, the killed run's included; nothing went through TMPDIR.
    ! grep -q "$fixture/tmp" "$fixture/record.txt" || return 1
    push_record_clean "$fixture"
}

# An argument the script does not recognise is never echoed: `--set KEY VALUE` and
# `--set KEY=VALUE` are the natural wrong guesses, and either one carries a value.
test_push_never_echoes_an_argument_it_does_not_recognise() {
    local fixture="$TEST_ROOT/push-echo" output rc
    fixture_repo "$fixture"
    printf '#!/usr/bin/env bash\necho "sops must not run" >&2\nexit 99\n' > "$fixture/bin/sops"
    chmod +x "$fixture/bin/sops"
    printf 'BASE=synthetic-local-value\n' > "$fixture/.env"

    set +e
    output="$(run_push "$fixture" --set BASE synthetic-positional-value 2>&1 </dev/null)"
    rc=$?
    set -e
    has_no_value "$output" || because "'--set KEY VALUE' echoed the value" || return 1
    [[ $rc -eq 2 && "$output" == *"unexpected argument"* && "$output" == *"usage: just secrets-push"* ]] || return 1

    set +e
    output="$(run_push "$fixture" --set BASE=synthetic-inline-value 2>&1 </dev/null)"
    rc=$?
    set -e
    has_no_value "$output" || because "'--set KEY=VALUE' echoed the value" || return 1
    [[ $rc -eq 2 && "$output" == *"--set needs a key name"* ]] || return 1

    set +e
    output="$(run_push "$fixture" --set BASE -synthetic-dash-value 2>&1 </dev/null)"
    rc=$?
    set -e
    has_no_value "$output" || because "a value that starts with a dash was echoed as an unknown flag" || return 1
    [[ $rc -eq 2 && "$output" == *"unknown flag"* ]] || return 1

    set +e
    output="$(run_push "$fixture" synthetic-lone-value --apply 2>&1)"
    rc=$?
    set -e
    has_no_value "$output" || because "a lone positional argument was echoed" || return 1
    [[ $rc -eq 2 && "$output" == *"unexpected argument"* ]] || return 1

    set +e
    output="$(run_push "$fixture" dev staging 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 2 && "$output" == *"more than one environment"* ]] || return 1
    [[ "$output" != *"sops must not run"* ]]
}

# dotenv reads `KEY=value # note` as "value", and secrets-sync.sh writes every value
# back as a bare KEY=value line. A value that would not come back the same is refused by key name.
test_push_refuses_values_dotenv_reads_differently() {
    local fixture="$TEST_ROOT/push-forms" output rc key dec
    push_fixture "$fixture" || return 1
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/before.enc.yaml"
    cat > "$fixture/.env" <<'DOTENV'
SAME=synthetic-same-value # an inline note
export CHANGED="synthetic-new-value" # a note after the closing quote
EMPTY_SHARED=" synthetic-padded-value "
MISSING="synthetic-escaped\nvalue"
MISSING_EMPTY=
LOCAL_EMPTY=
LOCAL_ONLY=synthetic-machine-local-value # machine-local: never pushed, so never judged
UNDECLARED=synthetic-undeclared-value # not a declared key
DOTENV

    set +e
    output="$(run_push "$fixture" 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 ]] || because "the plan accepted a .env value that is followed by an inline # comment (exit $rc)" || return 1
    for key in SAME CHANGED EMPTY_SHARED MISSING; do
        grep -Eq "^  invalid +$key +\(" <<< "$output" || because "$key is not named as invalid" || return 1
    done
    ! grep -Eq 'LOCAL_ONLY|UNDECLARED|MISSING_EMPTY|LOCAL_EMPTY' <<< "$output" || return 1
    [[ "$output" == *"4 .env value(s)"* && "$output" == *"nothing written"* ]] || return 1
    has_no_value "$output" || return 1

    set +e
    output="$(run_push "$fixture" --apply 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 ]] || return 1
    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml" || return 1
    has_no_value "$output" || return 1

    # Quotes around a value that reads the same on a bare line are dropped, the value is pushed, and
    # it comes back through secrets-sync on a machine that has no .env yet as the same value.
    cat > "$fixture/.env" <<'DOTENV'
SAME=synthetic-same-value
export CHANGED="synthetic-new-value"
EMPTY_SHARED='synthetic-single quoted\value with spaces'
MISSING="synthetic-double quoted value=with spaces"
DOTENV
    output="$(run_push "$fixture" --apply --replace 2>&1)" || return 1
    has_no_value "$output" || return 1
    dec="$(push_decrypt "$fixture")" || return 1
    grep -Fxq 'CHANGED=synthetic-new-value' <<< "$dec" || return 1
    grep -Fxq 'EMPTY_SHARED=synthetic-single quoted\value with spaces' <<< "$dec" || return 1
    grep -Fxq 'MISSING=synthetic-double quoted value=with spaces' <<< "$dec" || return 1
    rm "$fixture/.env"
    (cd "$fixture" && CI="" SOPS_AGE_KEY="" SOPS_AGE_KEY_FILE="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-sync.sh dev >/dev/null 2>&1) || return 1
    # shellcheck disable=SC1091
    [[ "$(cd "$fixture" && . scripts/lib.sh && env_file_value CHANGED .env)" == 'synthetic-new-value' ]] || return 1
    # shellcheck disable=SC1091
    [[ "$(cd "$fixture" && . scripts/lib.sh && env_file_value EMPTY_SHARED .env)" == 'synthetic-single quoted\value with spaces' ]] || return 1
    # shellcheck disable=SC1091
    [[ "$(cd "$fixture" && . scripts/lib.sh && env_file_value MISSING .env)" == 'synthetic-double quoted value=with spaces' ]] || return 1
    # The synced file is the plan's fixed point: nothing differs, nothing is invalid.
    output="$(run_push "$fixture" 2>&1)" || return 1
    [[ "$output" == *"0 to add, 0 to fill, 0 differing (left alone)"* ]]
}

# sops can format an offending value into its own error text, so none of it is shown.
test_push_hides_sops_output_when_the_decrypt_fails() {
    local fixture="$TEST_ROOT/push-decrypt-fails" output rc
    push_fixture "$fixture" || return 1
    push_record_wrappers "$fixture" || return 1
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/before.enc.yaml"

    set +e
    output="$(export PUSH_SOPS_FAIL=decrypt; run_push_recorded "$fixture" --apply 2>&1)"
    rc=$?
    set -e
    has_no_value "$output" || because "sops's own error text reached the terminal when the decrypt failed" || return 1
    [[ $rc -eq 1 && "$output" == *"could not read secrets/dev.enc.yaml with your identity"* ]] || return 1
    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml" || return 1
    push_record_clean "$fixture"
}

# The paths that fail part-way: a .env value with a control character, a
# sops failure on a later write of a multi-key apply, and a run that is terminated between writes.
# In all three the encrypted file is byte-identical afterwards and nothing is left behind.
test_push_failure_paths_leave_the_file_untouched() {
    local fixture="$TEST_ROOT/push-failures" output rc pid tries=0
    push_fixture "$fixture" || return 1
    push_record_wrappers "$fixture" || return 1
    cp "$fixture/secrets/dev.enc.yaml" "$fixture/before.enc.yaml"
    cp "$fixture/.env" "$fixture/env.saved"

    # A tab inside a value (the last assignment of a key wins).
    printf 'SAME=synthetic-tab\tvalue\n' >> "$fixture/.env"
    set +e
    output="$(run_push_recorded "$fixture" --apply 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 ]] || because "control character: exit $rc, not 1" || return 1
    grep -Eq '^  invalid +SAME( |$)' <<< "$output" || because "control character: SAME is not named as invalid" || return 1
    [[ "$output" == *"nothing written"* ]] || because "control character: the output does not say that nothing was written" || return 1
    has_no_value "$output" || because "control character: the output holds a value" || return 1
    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml" || because "control character: the encrypted file changed" || return 1
    push_record_clean "$fixture" || return 1
    cp "$fixture/env.saved" "$fixture/.env"

    # The second of the writes fails: the first one must not reach the real file.
    rm "$fixture/record.txt"
    set +e
    output="$(export PUSH_SOPS_FAIL=set:2; run_push_recorded "$fixture" --apply 2>&1)"
    rc=$?
    set -e
    [[ $rc -eq 1 && "$output" == *"sops could not write MISSING "*"secrets/dev.enc.yaml is unchanged"* ]] \
        || because "failed write: exit $rc, or no 'could not write MISSING … is unchanged' line" || return 1
    [[ "$(grep -c '^sops set ' "$fixture/record.txt")" == "2" ]] \
        || because "failed write: $(grep -c '^sops set ' "$fixture/record.txt") sops set calls, expected the run to stop at the 2nd" || return 1
    has_no_value "$output" || because "failed write: the output holds a value" || return 1
    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml" || because "failed write: the encrypted file changed" || return 1
    push_record_clean "$fixture" || return 1

    # SIGTERM while the first write is in progress. `exec` makes $! the script itself.
    rm "$fixture/record.txt"
    (cd "$fixture" && exec env CI="" SOPS_AGE_KEY="" SOPS_AGE_KEY_FILE="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        TMPDIR="$fixture/tmp" RECORD_FILE="$fixture/record.txt" PUSH_SOPS_FAIL=hang PATH="$fixture/rec" \
        scripts/security/secrets-push.sh --apply) >/dev/null 2>&1 &
    pid=$!
    while [[ ! -s "$fixture/record.txt.hang" && $tries -lt 150 ]]; do
        sleep 0.1
        tries=$((tries + 1))
    done
    if [[ ! -s "$fixture/record.txt.hang" ]]; then
        kill "$pid" 2>/dev/null || true
        because "the script never reached its first sops write"
        return 1
    fi
    rc=0
    kill -TERM "$pid"
    wait "$pid" 2>/dev/null || rc=$?
    kill "$(cat "$fixture/record.txt.hang")" 2>/dev/null || true
    rm "$fixture/record.txt.hang"
    [[ $rc -eq 143 ]] || because "SIGTERM: the script exited $rc, not 143" || return 1
    cmp -s "$fixture/before.enc.yaml" "$fixture/secrets/dev.enc.yaml" || because "SIGTERM: the encrypted file changed" || return 1
    push_record_clean "$fixture"
}

test_doctor_parity_reports_names_and_fix_commands() {
    local fixture="$TEST_ROOT/doctor-parity" record
    push_fixture "$fixture" || return 1

    record="$fixture/record-before.txt"
    : > "$record"
    probe_doctor_checks "$fixture" "$record" || return 1
    grep -F "warnc|secrets/dev.enc.yaml lacks key(s) that .env.example declares: MISSING MISSING_EMPTY|" "$record" \
        | grep -q "just secrets-push --apply" || return 1
    # The hint starts with the dry run that shows which stale name holds a value, then names the
    # command that removes the empty ones (test_doctor_parity_hints_lead_with_the_dry_run).
    grep -F "warnc|secrets/dev.enc.yaml has stale key name(s) that .env.example no longer declares: STALE_ONE STALE_TWO|just secrets-push   (a dry run" "$record" \
        | grep -q "just secrets-push --apply --prune" || return 1
    # Set locally, empty or absent in the shared file. The machine-local key and the undeclared one
    # are not in the list; neither is CHANGED (two non-empty values need a decrypt to compare).
    grep -F "warnc|value(s) that exist only on this machine (set in .env, empty or absent in secrets/dev.enc.yaml): EMPTY_SHARED MISSING|" "$record" \
        | grep -q "just secrets-push --apply" || return 1
    grep -Fxq "warnc|shared value(s) not in .env yet: LOCAL_EMPTY|just secrets-sync" "$record" || return 1
    ! grep -q 'synthetic-' "$record" || return 1

    # After the commands doctor's hints lead to, both sides agree. STALE_TWO holds a value, so the
    # plan (not the hint) says that removing it takes --prune-values as well.
    run_push "$fixture" --apply --prune --prune-values >/dev/null 2>&1 || return 1
    (cd "$fixture" && CI="" SOPS_AGE_KEY="" SOPS_AGE_KEY_FILE="" HOME="$fixture/home" XDG_CONFIG_HOME="$fixture/home/.config" \
        PATH="$fixture/bin:$PATH" scripts/security/secrets-sync.sh dev >/dev/null 2>&1) || return 1
    record="$fixture/record-after.txt"
    : > "$record"
    probe_doctor_checks "$fixture" "$record" || return 1
    grep -Fxq "ok|secrets/dev.enc.yaml has exactly the keys of .env.example" "$record" || return 1
    grep -Fxq "ok|.env and secrets/dev.enc.yaml have a value for the same keys" "$record" || return 1
    ! grep -Eq '^warnc\|.*(lacks key|stale key|only on this machine|not in \.env yet)' "$record" || return 1
    ! grep -q 'synthetic-' "$record"
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
run_test "onboard records 'pushed' (and not 'synced') in SECRETS_ONBOARD_STATUS_FILE after pushing a branch" test_onboard_status_file_reports_pushed
run_test "onboard records 'synced' (and not 'pushed') when the recipient is already approved" test_onboard_status_file_reports_synced_without_push

run_test "secrets-backup-done writes a dated, mode-600 marker with no key material" test_backup_done_writes_dated_marker

run_test "doctor's secrets checks report the right outcome for no/unlisted/complete identities" test_doctor_checks_report_expected_outcomes

run_test "approve refuses a branch that touches files other than .sops.yaml" test_approve_refuses_extra_files
run_test "approve refuses a branch that removes a recipient" test_approve_refuses_recipient_removal
run_test "approve re-wraps secrets for the new recipient and pushes; the new identity decrypts" test_approve_rewraps_and_new_identity_decrypts
run_test "approve requires an identity that can decrypt today" test_approve_requires_decrypting_identity

run_test "secrets-lib pins SOPS_AGE_KEY_FILE to the keys file the scripts use (not with SOPS_AGE_KEY, an explicit file, or no keys file)" test_lib_pins_identity_file
run_test "real sops: an identity at the default path decrypts with HOME as the only hint" test_default_identity_path_decrypts

run_test "the [machine-local] tag of .env.example covers the key(s) directly below its comment block, nothing else" test_machine_local_tag_rules
run_test "push: a bare run (and --dry-run, and --replace or --prune alone) lists key names and writes nothing" test_push_dry_run_lists_names_and_writes_nothing
run_test "push --apply --replace adds a missing key, fills an empty one, replaces a changed one; the rest keeps its ciphertext" test_push_apply_adds_fills_replaces_and_keeps_the_rest
run_test "push --apply --replace a second time leaves the shared file byte-identical" test_push_second_apply_changes_nothing
run_test "push removes stale key names only with --prune (--prune-values as well for the one that holds a value)" test_push_prune_removes_stale_names_only_with_the_flag
run_test "push refuses staging and prod before sops runs; wrong usage exits 2" test_push_refuses_protected_environments_and_bad_usage
run_test "push stops, shared file untouched, without .env, a decrypting identity or any identity" test_push_stops_without_a_decrypting_identity_or_an_env_file
run_test "push --set stores one value from stdin; machine-local, undeclared, empty and control-character values are refused" test_push_set_stores_one_value_from_stdin
run_test "push never puts a value on any command line, in a file under TMPDIR or secrets/, or in a command's environment, and leaves nothing behind" test_push_keeps_values_off_command_lines_and_temp_files
run_test "push refuses to run when .env.example declares no keys or is missing (every shared key would look stale)" test_push_refuses_an_env_example_without_keys
run_test "push --prune removes empty stale names; one that holds a value needs --prune-values, and the plan says which is which" test_push_prune_needs_a_second_flag_for_a_stale_value
run_test "push --apply leaves a differing shared value alone and names it with both next steps; --replace overwrites it" test_push_apply_leaves_a_differing_value_alone_without_replace
run_test "doctor's parity hints lead with the dry run, never with --apply" test_doctor_parity_hints_lead_with_the_dry_run
run_test "push stages its result beside the target (a rename, not a copy across filesystems), gitignored and gitleaks-allowlisted, and sweeps a killed run's leftover" test_push_stages_beside_the_target
run_test "push never echoes an argument it does not recognise (--set KEY VALUE, --set KEY=VALUE, a dash-led value)" test_push_never_echoes_an_argument_it_does_not_recognise
run_test "push refuses a .env value dotenv reads differently (inline comment, text after a quote, padding, escapes); plain quoted values round-trip through sync" test_push_refuses_values_dotenv_reads_differently
run_test "push hides sops's own output when the decrypt fails" test_push_hides_sops_output_when_the_decrypt_fails
run_test "push failure paths (control character in .env, sops failing on a later write, SIGTERM mid-write) leave the file byte-identical and nothing behind" test_push_failure_paths_leave_the_file_untouched
run_test "doctor's parity checks name missing, stale, only-here and unsynced keys with the fix command, never a value" test_doctor_parity_reports_names_and_fix_commands

if [[ $failures -ne 0 ]]; then
    echo "secrets tests: $failures failed" >&2
    exit 1
fi
echo "secrets tests: all passed"
