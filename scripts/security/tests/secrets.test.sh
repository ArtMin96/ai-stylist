#!/usr/bin/env bash
# Black-box regression suite for the sops + age scripts (secrets-sync.sh, secrets-edit.sh,
# secrets-updatekeys.sh) and the secrets/ ignore policy (planning/15 §6, P02 T02/T12).
# Usage: scripts/security/tests/secrets.test.sh   (run by `just test secrets` and `just test`)
# Every fixture is synthetic: throwaway age identities are generated per run inside a private temp
# dir and deleted on exit; nothing here reads the developer's keys file or the real secrets/ files.
# The merge/atomicity tests stub `sops` to pin the contract our scripts rely on; the round-trip test
# runs the real, mise-pinned `sops` + `age` so encryption, decryption, and re-wrapping are proven
# with the actual tools (CI installs them through .github/actions/setup).
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
fixture_repo() {
    local fixture="$1"
    mkdir -p "$fixture/scripts/security" "$fixture/secrets" "$fixture/bin" "$fixture/home"
    cp "$ROOT/scripts/security/secrets-lib.sh" "$fixture/scripts/security/"
    cp "$ROOT/scripts/security/secrets-sync.sh" "$fixture/scripts/security/"
    cp "$ROOT/scripts/security/secrets-edit.sh" "$fixture/scripts/security/"
    cp "$ROOT/scripts/security/secrets-updatekeys.sh" "$fixture/scripts/security/"

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

# .sops.yaml with one dev rule listing the given recipients.
write_sops_config() {
    local fixture="$1"
    shift
    {
        printf 'creation_rules:\n  - path_regex: secrets/dev\\.enc\\.yaml$\n    key_groups:\n      - age:\n'
        for recipient in "$@"; do printf '          - %s\n' "$recipient"; done
    } > "$fixture/.sops.yaml"
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

run_test "plaintext secrets ignored; encrypted files and README committable" test_ignore_policy
run_test "staging secrets refused on a workstation" test_non_dev_refusal
run_test "sync replaces, adds, skips empty values, preserves local lines, and writes mode 0600" test_sync_merge
run_test "sync accepts a first encrypted file whose shared values are all empty" test_sync_all_empty
run_test "failed first encryption leaves no target or temporary plaintext" test_encrypt_failure_is_atomic
run_test "updatekeys refuses a missing environment file before calling sops" test_updatekeys_refuses_missing_file
run_test "real sops+age: create, set, sync, add recipient, remove recipient, deny removed identity" test_real_roundtrip_and_rekey

if [[ $failures -ne 0 ]]; then
    echo "secrets tests: $failures failed" >&2
    exit 1
fi
echo "secrets tests: all passed"
