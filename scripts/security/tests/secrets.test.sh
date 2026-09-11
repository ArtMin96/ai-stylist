#!/usr/bin/env bash
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

fixture_repo() {
    local fixture="$1"
    mkdir -p "$fixture/scripts/security" "$fixture/secrets" "$fixture/bin" "$fixture/home"
    cp "$ROOT/scripts/security/secrets-lib.sh" "$fixture/scripts/security/"
    cp "$ROOT/scripts/security/secrets-sync.sh" "$fixture/scripts/security/"
    cp "$ROOT/scripts/security/secrets-edit.sh" "$fixture/scripts/security/"

    printf 'BASE=\n' > "$fixture/.env.example"
    printf 'encrypted fixture\n' > "$fixture/secrets/dev.enc.yaml"
    printf 'creation_rules:\n  - path_regex: secrets/dev\\.enc\\.yaml$\n    key_groups:\n      - age:\n          - age1%s\n' \
        "$(printf '%058d' 0 | tr '0' 'q')" > "$fixture/.sops.yaml"

    printf '#!/usr/bin/env bash\nexit 0\n' > "$fixture/bin/age"
    chmod +x "$fixture/bin/age"
}

file_mode() {
    if stat -c '%a' "$1" >/dev/null 2>&1; then
        stat -c '%a' "$1"
    else
        stat -f '%Lp' "$1"
    fi
}

test_ignore_policy() {
    git -C "$ROOT" check-ignore --no-index -q secrets/plain.yaml || return 1
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
if stat -c '%a' "$script_tmp" >/dev/null 2>&1; then
    stat -c '%a' "$script_tmp" >> "$TEST_TEMP_RECORD"
else
    stat -f '%Lp' "$script_tmp" >> "$TEST_TEMP_RECORD"
fi
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

run_test "plaintext secrets ignored; encrypted files and README committable" test_ignore_policy
run_test "staging secrets refused on a workstation" test_non_dev_refusal
run_test "sync replaces, adds, skips empty values, preserves local lines, and writes mode 0600" test_sync_merge
run_test "failed first encryption leaves no target or temporary plaintext" test_encrypt_failure_is_atomic

if [[ $failures -ne 0 ]]; then
    echo "secrets tests: $failures failed" >&2
    exit 1
fi
echo "secrets tests: all passed"
