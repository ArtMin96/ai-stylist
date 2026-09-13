#!/usr/bin/env bash
# Doctor's sops + age identity checks (plan s2-automated-secrets-onboarding, decision 5). Sourced by
# scripts/doctor.sh, never executed: this file has no top-level side effects, only defines
# secrets_doctor_checks(). Assumes cwd is the repo root, secrets-lib.sh is already sourced, and
# secrets_select_env has already picked an environment (doctor always checks dev). Reports through
# ok/fail/warnc (scripts/lib.sh) only; writes no file and never prints key material.

# Reports (a) the identity file and its mode, (b) whether its recipient is listed in the dev rule of
# .sops.yaml, (c) whether ENC_FILE decrypts with it, and (d) whether the backup marker is present —
# a warning only (decision 4/C10), never a failure. With $SOPS_AGE_KEY set (CI/deploy jobs) only (c)
# runs, since there is no key file to stat. In CI without $SOPS_AGE_KEY every check is skipped with
# one informational line so portability.yml's doctor summary stays meaningful.
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
}
