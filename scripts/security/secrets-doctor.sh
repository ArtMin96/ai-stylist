#!/usr/bin/env bash
# Doctor's sops + age identity checks (plan s2-automated-secrets-onboarding, decision 5). Sourced by
# scripts/doctor.sh, never executed: this file has no top-level side effects, only defines
# secrets_doctor_checks() and its helper secrets_doctor_parity(). Assumes cwd is the repo root,
# scripts/lib.sh (ok/fail/warnc, env_file_value) and secrets-lib.sh are already sourced, and
# secrets_select_env has already picked an environment (doctor always checks dev). Reports through
# ok/fail/warnc only; writes no file and never prints key material or a value.

# Shared-file parity, by key name only and without decrypting anything (secrets_shared_key_states
# reads the plaintext key names; env_file_value only answers "is there a value"). Four warnings,
# each with the command to run next:
#   1. a key .env.example declares is missing from ENC_FILE          -> just secrets-push
#   2. ENC_FILE has a name .env.example no longer declares (stale)   -> just secrets-push
#   3. .env has a value where ENC_FILE has none: it exists only on this machine
#      (keys tagged [machine-local] in .env.example are meant to, and are left out)
#                                                                    -> just secrets-push
#   4. ENC_FILE has a value and .env has none: not synced yet        -> just secrets-sync
# Every secrets-push hint leads with the bare dry run and names the writing command after it: the
# plan is read before anything is written. No hint names --replace or --prune-values: whether a
# differing shared value is older than the one in .env, and whether a stale name's value can go,
# is decided by reading the plan, never by following a hint.
# Two different non-empty values cannot be told apart without decrypting; `just secrets-push`
# (a dry run) lists those as "differs". Warnings, not failures: none of them breaks this machine.
secrets_doctor_parity() {
    local declared machine_local shared key state line
    local missing="" stale="" only_here="" unsynced=""
    declared="$(secrets_example_keys)"
    machine_local="$(secrets_machine_local_keys)"
    shared="$(secrets_shared_key_states)"

    while IFS= read -r key; do
        [[ -n "$key" ]] || continue
        if secrets_list_has "$shared" "$key set"; then
            state="set"
        elif secrets_list_has "$shared" "$key empty"; then
            state="empty"
        else
            state="absent"
            missing="${missing:+$missing }$key"
        fi
        [[ -f .env ]] || continue
        if [[ -n "$(env_file_value "$key" .env)" ]]; then
            if [[ "$state" != "set" ]] && ! secrets_list_has "$machine_local" "$key"; then
                only_here="${only_here:+$only_here }$key"
            fi
        elif [[ "$state" == "set" ]]; then
            unsynced="${unsynced:+$unsynced }$key"
        fi
    done <<< "$declared"

    while IFS= read -r line; do
        key="${line%% *}"
        [[ -n "$key" ]] || continue
        secrets_list_has "$declared" "$key" || stale="${stale:+$stale }$key"
    done <<< "$shared"

    if [[ -z "$missing" && -z "$stale" ]]; then
        ok "$ENC_FILE has exactly the keys of .env.example"
    fi
    if [[ -n "$missing" ]]; then
        warnc "$ENC_FILE lacks key(s) that .env.example declares: $missing" \
            "just secrets-push   (a dry run: lists the key names it would add or fill; then write them with: just secrets-push --apply)"
    fi
    if [[ -n "$stale" ]]; then
        warnc "$ENC_FILE has stale key name(s) that .env.example no longer declares: $stale" \
            "just secrets-push   (a dry run: shows which stale names are empty and which hold a value; then remove the empty ones with: just secrets-push --apply --prune)"
    fi
    [[ -f .env ]] || return 0
    if [[ -z "$only_here" && -z "$unsynced" ]]; then
        ok ".env and $ENC_FILE have a value for the same keys"
    fi
    if [[ -n "$only_here" ]]; then
        warnc "value(s) that exist only on this machine (set in .env, empty or absent in $ENC_FILE): $only_here" \
            "just secrets-push   (a dry run: lists the key names; then write them with: just secrets-push --apply, and commit $ENC_FILE)"
    fi
    if [[ -n "$unsynced" ]]; then
        warnc "shared value(s) not in .env yet: $unsynced" "just secrets-sync"
    fi
}

# Reports (a) the identity file and its mode, (b) whether its recipient is listed in the dev rule of
# .sops.yaml, (c) whether ENC_FILE decrypts with it, (d) whether the backup marker is present —
# a warning only (decision 4/C10), never a failure — and (e) shared-file parity
# (secrets_doctor_parity). With $SOPS_AGE_KEY set (CI/deploy jobs) only (c) runs, since there is no
# key file to stat and no developer .env to compare. In CI without $SOPS_AGE_KEY every check is
# skipped with one informational line so portability.yml's doctor summary stays meaningful.
secrets_doctor_checks() {
    local identity_path mode pub only_decrypt=0

    if ! SECRETS_SOPS="$(secrets_tool sops)"; then
        fail "sops is not available to run doctor's secrets checks" "just bootstrap"
        SECRETS_SOPS=""
    fi
    if ! SECRETS_AGE_KEYGEN="$(secrets_tool age-keygen)"; then
        fail "age-keygen is not available to run doctor's secrets checks" "just bootstrap"
        SECRETS_AGE_KEYGEN=""
    fi

    if secrets_identity_from_env; then
        only_decrypt=1
    elif [[ -n "${CI:-}" ]]; then
        ok "secrets checks skipped (CI without SOPS_AGE_KEY)"
        return 0
    fi

    if [[ "$only_decrypt" -eq 0 ]]; then
        identity_path="$(secrets_identity_file)"
        if [[ ! -f "$identity_path" ]]; then
            fail "no age identity at $identity_path" "just bootstrap (generates one and opens the onboarding PR)"
        else
            if stat -c '%a' "$identity_path" >/dev/null 2>&1; then
                mode="$(stat -c '%a' "$identity_path")"
            else
                mode="$(stat -f '%Lp' "$identity_path")"
            fi
            if [[ "$mode" == "600" ]]; then
                ok "age identity present ($identity_path, mode 600)"
            else
                fail "age identity $identity_path has mode $mode, expected 600" "chmod 600 $identity_path"
            fi

            if [[ -n "$SECRETS_AGE_KEYGEN" ]] && pub="$(secrets_public_key "$identity_path" 2>/dev/null)" && [[ -n "$pub" ]]; then
                if secrets_recipient_listed "$pub"; then
                    ok "age recipient listed in .sops.yaml (dev)"
                else
                    fail "your age recipient is not listed in the dev rule of .sops.yaml" \
                        "open the onboarding PR printed by 'just bootstrap', then ask an approver to run 'just secrets-approve <branch>'"
                fi
            fi
        fi
    fi

    if [[ -n "$SECRETS_SOPS" ]]; then
        if [[ ! -f "$ENC_FILE" ]]; then
            warnc "$ENC_FILE does not exist yet" "just secrets-edit dev (or wait for an approver to create it)"
        elif secrets_can_decrypt; then
            ok "$ENC_FILE decrypts with your identity"
        else
            fail "$ENC_FILE does not decrypt with your identity" "ask an approver to run 'just secrets-approve <branch>'"
        fi
    fi

    if [[ "$only_decrypt" -eq 1 ]]; then
        return 0
    fi

    if [[ -f "$(secrets_backup_marker)" ]]; then
        ok "age identity backup recorded ($(cat "$(secrets_backup_marker)"))"
    else
        warnc "age identity not recorded as backed up" \
            "store $(secrets_identity_file) in the team password manager, then run: just secrets-backup-done"
    fi

    if [[ -f "$ENC_FILE" ]]; then
        secrets_doctor_parity
    fi
}
