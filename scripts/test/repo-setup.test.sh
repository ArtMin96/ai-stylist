#!/usr/bin/env bash
# Black-box suite for `just repo-setup` (scripts/repo-setup.sh): the repository's name in tracked
# files (scripts/repo-name.sh), the Actions secrets and variables (scripts/security/github-secrets.sh
# with tools/github/actions-secrets.txt), the repository settings (tools/github/repo-settings.mjs
# with repo-settings.json), and the two `just doctor` lines of scripts/github-lib.sh.
# Usage: scripts/test/repo-setup.test.sh   (run by `just test tooling` and `just test`)
#
# Nothing here reaches GitHub or reads a real secret. Every case runs in a throwaway git checkout
# whose origin is a made-up repository, with copies of the scripts under test and of the real
# manifest, settings file, workflows, renovate.json and .env.example (so the committed data files
# are checked against the committed workflows on every run). `gh` is a stub that keeps its state in
# a JSON file (tools/github/tests/gh-stub.mjs); sops and age are the real, mise-pinned tools with a
# throwaway identity and synthetic values. The commands run with the recording wrappers of
# scripts/test/recording.sh as their entire PATH, so every argument list sops, gh and the rest
# receive is on record, and no value may appear in any of them, in a file or in an environment.
# Needs node, sops and age (mise) and git. Runs on Linux and macOS alike.
# shellcheck disable=SC2016 # fixture text holds literal backticks and ${{ ... }}: nothing to expand
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-repo-setup-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

# resolve_tool, because, sops_dev_fixture, record_wrappers, record_clean.
# shellcheck source=scripts/test/recording.sh
source "$ROOT/scripts/test/recording.sh"

if ! NODE="$(resolve_tool node)"; then
    echo "FAIL  repo-setup: node not found (mise install; the justfile puts the mise shims on PATH)" >&2
    exit 1
fi

OLD='OldOwner/old-repo'
NEW='NewOwner/new-repo'
# Every external command the scripts under test run. `gh` is the stub; the wrappers are the whole
# PATH, so a command missing here cannot run and the list cannot fall behind the scripts.
WRAPPED="git sops node awk tr find sort tail mktemp cat rm uname dirname wc"

failures=0
OUT=''
RC=0

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

has() { [[ "$OUT" == *"$1"* ]] || because "expected the output to contain: $1"$'\n'"  output: $OUT"; }
lacks() { [[ "$OUT" != *"$1"* ]] || because "expected the output not to contain: $1"; }
exits() { [[ $RC -eq $1 ]] || because "exit code $RC, expected $1"$'\n'"  output: $OUT"; }

# --- fixture --------------------------------------------------------------------------------------

# fixture <dir> [empty-cli-key]: a git checkout whose origin is github.com/$NEW and whose tracked
# files still name $OLD, the scripts under test, the real data files, an encrypted dev file with
# synthetic values, the gh stub and the recording wrappers.
fixture() {
    local fx="$1" upload='synthetic-upload-key'
    if [[ "${2:-}" == empty-cli-key ]]; then upload='""'; fi
    mkdir -p "$fx/scripts/security" "$fx/tools/github" "$fx/tools/observability" "$fx/.github/workflows" \
        "$fx/.github/actions/setup" "$fx/docs" "$fx/planning" "$fx/.claude/plans" "$fx/secrets" "$fx/bin" "$fx/home" "$fx/gh"
    cp "$ROOT/scripts/lib.sh" "$ROOT/scripts/github-lib.sh" "$ROOT/scripts/repo-setup.sh" "$ROOT/scripts/repo-name.sh" "$fx/scripts/"
    cp "$ROOT/scripts/security/secrets-lib.sh" "$ROOT/scripts/security/github-secrets.sh" "$fx/scripts/security/"
    cp "$ROOT/tools/github/"*.mjs "$ROOT/tools/github/"*.json "$ROOT/tools/github/"*.txt "$fx/tools/github/"
    cp "$ROOT/tools/observability/compare.mjs" "$fx/tools/observability/"
    cp "$ROOT/.github/workflows/"*.yml "$fx/.github/workflows/"
    cp "$ROOT/.github/actions/setup/action.yml" "$fx/.github/actions/setup/"
    cp "$ROOT/renovate.json" "$ROOT/.env.example" "$fx/"

    printf '%s\n' \
        '# Fixture' \
        "git clone https://github.com/$OLD.git" \
        'cd old-repo' \
        "Uses https://github.com/apple/swift-openapi-runtime and https://github.com/$OLD-extra too." \
        'Schema: https://raw.githubusercontent.com/OldOwner/soloist/main/solo.schema.json' \
        > "$fx/README.md"
    printf '%s\n' \
        "git clone https://github.com/$OLD.git && cd old-repo" \
        'The repository is `https://github.com/oldowner/OLD-REPO` under a personal account.' \
        "Over ssh: git@github.com:$OLD.git" \
        "It lives at https://github.com/$OLD." \
        'cd old-repo-tools' \
        > "$fx/docs/setup.md"
    # No newline at the end of this one: a rewrite must not add it.
    printf '{"runbook_url": "https://github.com/%s/blob/main/docs/runbooks/01.md"}' "$OLD" > "$fx/docs/alert.json"
    printf "const RUNBOOK_URL_PREFIX = 'https://github.com/%s/blob/main/';\n" "$OLD" > "$fx/tools/observability/check.mjs"
    printf '[PR #12](https://github.com/%s/pull/12)\n' "$OLD" > "$fx/planning/PROGRESS.md"
    printf 'origin is https://github.com/%s.git\n' "$OLD" > "$fx/.claude/plans/old.md"

    # The dev file as "KEY value" pairs (printf repeats its format for each pair): the three values
    # the manifest sends, the dev token and the four never-keys that must stay off GitHub, and two
    # optional keys without a value.
    printf '%s: %s\n' \
        POSTHOG_CLI_API_KEY "$upload" \
        POSTHOG_CLI_PROJECT_ID synthetic-project-id \
        POSTHOG_CLI_HOST synthetic-app-host \
        OTEL_EXPORTER_OTLP_ENDPOINT synthetic-otlp-endpoint \
        OTEL_EXPORTER_OTLP_HEADERS synthetic-dev-token-header \
        POSTHOG_API_KEY synthetic-project-key \
        POSTHOG_HOST synthetic-ingest-host \
        POSTHOG_SYNC_API_KEY synthetic-sync-key \
        GRAFANA_SERVICE_ACCOUNT_TOKEN synthetic-admin-token \
        TURBO_TOKEN '""' \
        TURBO_TEAM '""' \
        > "$fx/secrets/dev.plain.yaml"
    sops_dev_fixture "$fx" || return 1

    printf '/home/\n/bin/\n/gh/\n/rec/\n/tmp/\n/secrets/\n/record.txt\n' > "$fx/.gitignore"
    git -C "$fx" init -q -b main
    git -C "$fx" config user.name "Synthetic Developer"
    git -C "$fx" config user.email "synthetic-dev@example.invalid"
    git -C "$fx" config commit.gpgsign false
    git -C "$fx" config core.hooksPath "$fx/.git/no-hooks"
    git -C "$fx" add -A
    git -C "$fx" commit -q -m "chore: fixture baseline"
    git -C "$fx" remote add origin "https://github.com/$NEW.git"

    printf '#!%s\nexec %q %q "$@"\n' "$(command -v bash)" "$NODE" "$ROOT/tools/github/tests/gh-stub.mjs" > "$fx/bin/gh"
    chmod +x "$fx/bin/gh"
    record_wrappers "$fx" "$WRAPPED gh=$fx/bin/gh" age || return 1
    gh_state "$fx"
}

# The stub's state: a public repository under a personal account that nobody configured yet.
gh_state() {
    local fx="$1"
    cat > "$fx/gh/state.json" <<STATE
{
  "slug": "$NEW",
  "login": true,
  "secrets": {},
  "variables": {},
  "repo": {
    "full_name": "$NEW",
    "private": false,
    "default_branch": "main",
    "owner": { "login": "NewOwner", "type": "User" },
    "permissions": { "admin": true },
    "security_and_analysis": {
      "secret_scanning": { "status": "disabled" },
      "secret_scanning_push_protection": { "status": "disabled" },
      "dependabot_security_updates": { "status": "disabled" }
    }
  },
  "actions_permissions": { "enabled": true, "allowed_actions": "all" },
  "actions_workflow": { "default_workflow_permissions": "write", "can_approve_pull_request_reviews": true },
  "protection": null,
  "protection_blocked": false,
  "labels": [{ "name": "bug", "color": "d73a4a", "description": "" }],
  "rulesets": []
}
STATE
    rm -f "$fx/gh/state.json.log"
}

# state_edit <fixture> '<statements on s>': changes the stub's state the way a human would in the
# GitHub UI. state_get <fixture> '<expression on s>': prints one thing the stub holds.
state_edit() {
    "$NODE" -e 'const fs = require("node:fs"); const file = process.argv[1]; const s = JSON.parse(fs.readFileSync(file, "utf8")); new Function("s", process.argv[2])(s); fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");' "$1/gh/state.json" "$2"
}
state_get() {
    "$NODE" -e 'const fs = require("node:fs"); const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); const v = new Function("s", "return " + process.argv[2])(s); process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));' "$1/gh/state.json" "$2"
}

# The writes the stub received so far (one line each; empty when there were none).
writes() { if [[ -f "$1/gh/state.json.log" ]]; then cat "$1/gh/state.json.log"; fi; }
write_count() { writes "$1" | awk 'END { print NR }'; }

# setup <fixture> <args...>: scripts/repo-setup.sh in <fixture>, the way the owner runs it (no agent
# session; SETUP_SESSION=agent runs it the way an AI agent's shell would), with the recording
# wrappers as the entire PATH. Sets OUT (stdout + stderr) and RC.
setup() {
    local fx="$1" session=(-u CLAUDECODE)
    shift
    if [[ "${SETUP_SESSION:-}" == agent ]]; then session=(CLAUDECODE=1); fi
    OUT="$(cd "$fx" && env "${session[@]}" CI="" SOPS_AGE_KEY="" SOPS_AGE_KEY_FILE="" NO_COLOR=1 HOME="$fx/home" \
        XDG_CONFIG_HOME="$fx/home/.config" TMPDIR="$fx/tmp" RECORD_FILE="$fx/record.txt" GH_STUB_STATE="$fx/gh/state.json" \
        PATH="$fx/rec" "$fx/rec/bash" scripts/repo-setup.sh "$@" 2>&1)" && RC=0 || RC=$?
}

unchanged_tree() { [[ -z "$(git -C "$1" status --porcelain)" ]] || because "tracked files changed: $(git -C "$1" status --porcelain | tr '\n' ' ')"; }

# --- name: the repository's own name in tracked files ----------------------------------------------

test_name_report_lists_only_this_repository() {
    local fx="$TEST_ROOT/name-report"
    fixture "$fx" || return 1
    setup "$fx" name
    exits 1 || return 1
    has "origin points at $NEW; these tracked lines name $OLD" || return 1
    has "README.md:2: git clone https://github.com/$OLD.git" || return 1
    has "README.md:3: cd old-repo" || return 1
    has "docs/setup.md:1: git clone https://github.com/$OLD.git && cd old-repo" || return 1
    has 'docs/setup.md:2: The repository is `https://github.com/oldowner/OLD-REPO`' || return 1
    has "docs/setup.md:3: Over ssh: git@github.com:$OLD.git" || return 1
    has "docs/setup.md:4: It lives at https://github.com/$OLD." || return 1
    has "docs/alert.json:1:" || return 1
    has "tools/observability/check.mjs:1: const RUNBOOK_URL_PREFIX" || return 1
    # Third-party repositories, another repository of the same owner and a longer name are not it.
    lacks "swift-openapi-runtime" || return 1
    lacks "soloist" || return 1
    lacks "old-repo-tools" || return 1
    lacks "README.md:4" || return 1
    # History keeps the old name, and the report says which paths and why.
    has "left alone on purpose (tools/github/name-keep.txt):" || return 1
    has "planning/PROGRESS.md: 1 line(s): history" || return 1
    has ".claude/plans/: 1 line(s): history" || return 1
    lacks "planning/PROGRESS.md:1" || return 1
    has "8 line(s) in 4 file(s) to re-point" || return 1
    has "to rewrite them: just repo-setup name --apply" || return 1
    unchanged_tree "$fx" || return 1
    # --check is the same report; the one-line form is what just doctor shows.
    setup "$fx" name --check
    exits 1 || return 1
    OUT="$(cd "$fx" && bash scripts/repo-name.sh --check --quiet 2>&1)" && RC=0 || RC=$?
    exits 1 || return 1
    [[ "$OUT" == "8 tracked line(s) in 4 file(s) name $OLD, but origin points at $NEW" ]] || because "one-line report: $OUT"
}

test_name_apply_rewrites_and_is_idempotent() {
    local fx="$TEST_ROOT/name-apply" expected after
    fixture "$fx" || return 1
    setup "$fx" name --apply
    exits 0 || return 1
    has "rewrote 8 line(s) in 4 file(s)" || return 1
    has "just observability-sync all --check" || return 1
    expected="$(printf '%s\n' '# Fixture' "git clone https://github.com/$NEW.git" 'cd new-repo' \
        "Uses https://github.com/apple/swift-openapi-runtime and https://github.com/$OLD-extra too." \
        'Schema: https://raw.githubusercontent.com/OldOwner/soloist/main/solo.schema.json')"
    [[ "$(cat "$fx/README.md")" == "$expected" ]] || because "README.md is not as expected" || return 1
    expected="$(printf '%s\n' "git clone https://github.com/$NEW.git && cd new-repo" \
        "The repository is \`https://github.com/$NEW\` under a personal account." \
        "Over ssh: git@github.com:$NEW.git" "It lives at https://github.com/$NEW." 'cd old-repo-tools')"
    [[ "$(cat "$fx/docs/setup.md")" == "$expected" ]] || because "docs/setup.md is not as expected" || return 1
    [[ "$(cat "$fx/tools/observability/check.mjs")" == "const RUNBOOK_URL_PREFIX = 'https://github.com/$NEW/blob/main/';" ]] || return 1
    [[ "$(cat "$fx/docs/alert.json")" == "{\"runbook_url\": \"https://github.com/$NEW/blob/main/docs/runbooks/01.md\"}" ]] || return 1
    [[ -n "$(tail -c 1 "$fx/docs/alert.json")" ]] || because "a final newline was added to docs/alert.json" || return 1
    # The kept paths still hold the old name.
    git -C "$fx" diff --quiet -- planning .claude || because "a kept path was rewritten" || return 1
    [[ "$(git -C "$fx" diff --name-only | tr '\n' ' ')" == "README.md docs/alert.json docs/setup.md tools/observability/check.mjs " ]] || return 1
    # A second run, and the report, find nothing.
    after="$(git -C "$fx" diff)"
    setup "$fx" name --apply
    exits 0 || return 1
    has "nothing to re-point" || return 1
    [[ "$(git -C "$fx" diff)" == "$after" ]] || because "the second --apply changed a file" || return 1
    setup "$fx" name
    exits 0 || return 1
    [[ -z "$(ls -A "$fx/tmp")" ]] || because "something is left in TMPDIR"
}

test_name_owner_change_keeps_the_clone_directory() {
    local fx="$TEST_ROOT/name-owner"
    fixture "$fx" || return 1
    git -C "$fx" remote set-url origin "git@github.com:OtherOwner/old-repo.git"
    setup "$fx" name --apply
    exits 0 || return 1
    grep -Fxq 'git clone https://github.com/OtherOwner/old-repo.git' "$fx/README.md" || return 1
    grep -Fxq 'cd old-repo' "$fx/README.md" || because "the clone directory changed although the repository name did not" || return 1
    grep -Fxq 'git clone https://github.com/OtherOwner/old-repo.git && cd old-repo' "$fx/docs/setup.md"
}

test_name_says_when_it_cannot_tell() {
    local fx="$TEST_ROOT/name-cannot-tell" real="$TEST_ROOT/name-real-constant"
    fixture "$fx" || return 1
    # The name tracked files use is not readable, and none was given.
    printf 'const SOMETHING_ELSE = 1;\n' > "$fx/tools/observability/check.mjs"
    setup "$fx" name
    exits 3 || return 1
    has "just repo-setup name --from <owner>/<repo>" || return 1
    # --from names it: the lines are found without the constant.
    setup "$fx" name --from "$OLD"
    exits 1 || return 1
    has "7 line(s) in 3 file(s) to re-point" || return 1
    has "to rewrite them: just repo-setup name --from $OLD --apply" || return 1
    setup "$fx" name --from not-a-slug
    exits 2 || return 1
    setup "$fx" name --bogus
    exits 2 || return 1
    # No origin, and an origin that is not on github.com.
    git -C "$fx" remote set-url origin "https://gitlab.example/$NEW.git"
    setup "$fx" name
    exits 3 || return 1
    has "not a github.com remote" || return 1
    git -C "$fx" remote remove origin
    setup "$fx" name
    exits 3 || return 1
    # The committed tools/observability/check.mjs still has the line this reads the name from.
    mkdir -p "$real/tools/observability" "$real/tools/github"
    cp "$ROOT/tools/observability/check.mjs" "$real/tools/observability/"
    cp "$ROOT/tools/github/name-keep.txt" "$real/tools/github/"
    cp -R "$fx/scripts" "$real/scripts"
    git -C "$real" init -q -b main
    git -C "$real" add -A
    git -C "$real" remote add origin "https://github.com/$NEW.git"
    OUT="$(cd "$real" && bash scripts/repo-name.sh --check 2>&1)" && RC=0 || RC=$?
    exits 1 || return 1
    has "tools/observability/check.mjs:" || return 1
    has "const RUNBOOK_URL_PREFIX = 'https://github.com/" || return 1
    has "1 line(s) in 1 file(s) to re-point"
}

test_name_apply_is_refused_in_an_agent_session() {
    local fx="$TEST_ROOT/name-agent"
    fixture "$fx" || return 1
    SETUP_SESSION=agent setup "$fx" name --apply
    exits 1 || return 1
    has "'just repo-setup name --apply' is owner-run" || return 1
    unchanged_tree "$fx" || return 1
    # The report stays open to an agent session.
    SETUP_SESSION=agent setup "$fx" name
    exits 1 || return 1
    has "8 line(s) in 4 file(s) to re-point"
}

# The same command over this checkout's own files: every tracked text file that mentions github.com
# at all is copied, at its path, into a checkout whose origin is the made-up repository. Whatever
# this repository is called today, the report must find its name, --apply must rewrite exactly the
# reported lines, and the many third-party links in those files must come through untouched.
test_name_rewrites_this_checkouts_own_files() {
    local fx="$TEST_ROOT/name-this-checkout" file slug counts lines files
    mkdir -p "$fx/scripts" "$fx/tools/github"
    while IFS= read -r -d '' file; do
        mkdir -p "$fx/$(dirname "$file")"
        cp "$ROOT/$file" "$fx/$file"
    done < <(git -C "$ROOT" grep -z -l -I -F 'github.com' -- . ':(exclude)pnpm-lock.yaml' ':(exclude)workers/uv.lock' 2>/dev/null || true)
    cp "$ROOT/scripts/lib.sh" "$ROOT/scripts/github-lib.sh" "$ROOT/scripts/repo-name.sh" "$fx/scripts/"
    cp "$ROOT/tools/github/name-keep.txt" "$fx/tools/github/"
    git -C "$fx" init -q -b main
    git -C "$fx" config user.name "Synthetic Developer"
    git -C "$fx" config user.email "synthetic-dev@example.invalid"
    git -C "$fx" config commit.gpgsign false
    git -C "$fx" config core.hooksPath "$fx/.git/no-hooks"
    git -C "$fx" add -A
    git -C "$fx" commit -q -m "chore: fixture baseline"
    git -C "$fx" remote add origin "https://github.com/$NEW.git"

    OUT="$(cd "$fx" && env -u CLAUDECODE bash scripts/repo-name.sh --check 2>&1)" && RC=0 || RC=$?
    exits 1 || return 1
    has "tools/observability/check.mjs:" || return 1
    slug="${OUT#*these tracked lines name }"
    slug="${slug%% *}"
    counts="$(sed -n 's/^repo-setup name: \([0-9][0-9]*\) line(s) in \([0-9][0-9]*\) file(s) to re-point$/\1 \2/p' <<< "$OUT")"
    lines="${counts% *}"
    files="${counts#* }"
    [[ "$slug" == */* && "$lines" -ge 1 && "$files" -ge 1 ]] || because "could not read the report: $OUT" || return 1

    OUT="$(cd "$fx" && env -u CLAUDECODE bash scripts/repo-name.sh --apply 2>&1)" && RC=0 || RC=$?
    exits 0 || return 1
    # Exactly the reported lines changed, in exactly the reported files.
    [[ "$(git -C "$fx" diff --numstat | awk '{ added += $1; removed += $2 } END { print added, removed }')" == "$lines $lines" ]] \
        || because "the diff is not $lines changed line(s): $(git -C "$fx" diff --shortstat)" || return 1
    [[ "$(git -C "$fx" diff --name-only | awk 'END { print NR }')" == "$files" ]] || return 1
    # Every removed line named this repository (or was the clone directory); nothing else was touched.
    ! git -C "$fx" diff -U0 | grep '^-[^-]' | grep -v -i -F -e "github.com/$slug" -e "github.com:$slug" | grep -v -E '^-[[:space:]]*cd ' \
        || because "a line that does not name $slug was rewritten" || return 1
    # Outside the kept paths the old name is gone; the kept paths and solo.yml are as they were.
    ! git -C "$fx" grep -q -I -i -F -e "github.com/$slug" -e "github.com:$slug" -- . ':(exclude)planning/PROGRESS.md' ':(exclude).claude/plans' ':(exclude)planning/research' \
        || because "a tracked line still names $slug" || return 1
    git -C "$fx" diff --quiet -- planning .claude solo.yml || because "a kept path or solo.yml was rewritten" || return 1
    # Every rewritten JSON file still parses.
    while IFS= read -r file; do
        "$NODE" -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$fx/$file" || because "$file no longer parses" || return 1
    done < <(git -C "$fx" diff --name-only -- '*.json')
    echo "      this checkout: $lines line(s) in $files file(s) name $slug"
}

# --- just doctor (scripts/github-lib.sh) ------------------------------------------------------------

# doctor_lines <fixture> <function> [PATH]: one doctor function, then "failures=N warnings=N".
doctor_lines() {
    (
        cd "$1" || exit 1
        export NO_COLOR=1 GH_STUB_STATE="$1/gh/state.json"
        # shellcheck source=scripts/lib.sh
        source scripts/lib.sh
        # shellcheck source=scripts/github-lib.sh
        source scripts/github-lib.sh
        if [[ -n "${3:-}" ]]; then PATH="$3"; fi
        "$2" 2>&1
        echo "failures=$DOCTOR_FAILURES warnings=$DOCTOR_WARNINGS"
    )
}

test_doctor_warns_about_the_name_with_the_fix() {
    local fx="$TEST_ROOT/doctor-name"
    fixture "$fx" || return 1
    OUT="$(doctor_lines "$fx" doctor_repo_name)"
    has "8 tracked line(s) in 4 file(s) name $OLD, but origin points at $NEW" || return 1
    has "hint: just repo-setup name   (lists the lines, changes nothing; then rewrite them with: just repo-setup name --apply)" || return 1
    has "failures=0 warnings=1" || return 1
    unchanged_tree "$fx" || return 1
    # Once origin and the files agree, it is a plain ok line.
    git -C "$fx" remote set-url origin "https://github.com/$OLD.git"
    OUT="$(doctor_lines "$fx" doctor_repo_name)"
    has "tracked files name the repository origin points at ($OLD)" || return 1
    has "failures=0 warnings=0" || return 1
    # Without a GitHub origin it is a note, never a failure.
    git -C "$fx" remote remove origin
    OUT="$(doctor_lines "$fx" doctor_repo_name)"
    has "repository name in tracked files not checked:" || return 1
    has "failures=0 warnings=0"
}

test_doctor_reports_the_github_cli_offline() {
    local fx="$TEST_ROOT/doctor-gh" empty="$TEST_ROOT/doctor-gh/empty-path"
    fixture "$fx" || return 1
    mkdir -p "$empty"
    OUT="$(CI="" doctor_lines "$fx" doctor_github_cli "$fx/bin")"
    has "gh present with a login for github.com" || return 1
    has "is not checked here, it needs the network: just repo-setup" || return 1
    has "failures=0 warnings=0" || return 1
    state_edit "$fx" 's.login = false'
    OUT="$(CI="" doctor_lines "$fx" doctor_github_cli "$fx/bin")"
    has "gh has no login for github.com" || return 1
    has "hint: gh auth login" || return 1
    has "failures=0 warnings=1" || return 1
    OUT="$(CI="" doctor_lines "$fx" doctor_github_cli "$empty")"
    has "gh (GitHub CLI) not installed" || return 1
    has "hint: mise use --global gh@latest" || return 1
    has "failures=0 warnings=1" || return 1
    # CI needs no gh login: nothing is printed there.
    OUT="$(CI=true doctor_lines "$fx" doctor_github_cli "$empty")"
    [[ "$OUT" == "failures=0 warnings=0" ]] || because "doctor printed a gh line in CI: $OUT" || return 1
    # The stub was only ever asked for the stored login: doctor makes no network call.
    [[ ! -e "$fx/gh/state.json.log" ]] || because "doctor made gh write something" || return 1
    grep -qE '^[[:space:]]*doctor_repo_name$' "$ROOT/scripts/doctor.sh" || because "doctor.sh does not call doctor_repo_name" || return 1
    grep -qE '^[[:space:]]*doctor_github_cli$' "$ROOT/scripts/doctor.sh" || because "doctor.sh does not call doctor_github_cli"
}

# --- secrets: Actions secrets and variables ---------------------------------------------------------

test_manifest_matches_the_workflows() {
    local fx="$TEST_ROOT/manifest"
    fixture "$fx" || return 1
    # The committed manifest against the committed workflows and .env.example.
    setup "$fx" secrets --offline
    exits 0 || return 1
    has "tools/github/actions-secrets.txt matches .env.example and the workflows" || return 1
    ! grep -q '^gh ' "$fx/record.txt" || because "--offline called gh" || return 1
    ! grep -q '^sops ' "$fx/record.txt" || because "--offline called sops" || return 1
    # A workflow that reads a name the manifest lacks, and one that reads a forbidden name.
    printf 'jobs:\n  x:\n    env:\n      A: ${{ secrets.NEW_UNDECLARED }}\n      B: ${{ vars.NEW_VARIABLE }}\n      C: ${{ secrets.POSTHOG_SYNC_API_KEY }}\n      # D: ${{ secrets.ONLY_IN_A_COMMENT }}\n      E: ${{ needs.secrets.result }}\n' \
        > "$fx/.github/workflows/extra.yml"
    setup "$fx" secrets
    exits 1 || return 1
    has "a workflow reads NEW_UNDECLARED as a secret, and tools/github/actions-secrets.txt has no 'secret NEW_UNDECLARED' entry" || return 1
    has "a workflow reads NEW_VARIABLE as a variable" || return 1
    has "a workflow reads POSTHOG_SYNC_API_KEY as a secret, which must never be in GitHub" || return 1
    lacks "ONLY_IN_A_COMMENT" || return 1
    lacks "reads result" || return 1
    has "3 problem(s) in the manifest, nothing sent" || return 1
    ! grep -q '^gh ' "$fx/record.txt" || because "a broken manifest still reached gh" || return 1
    rm "$fx/.github/workflows/extra.yml"
    # Entries that would send what must never be sent, or that name nothing shareable.
    printf '%s\n' \
        'secret A_ONE dev:GRAFANA_SERVICE_ACCOUNT_TOKEN optional unread' \
        'secret A_TWO dev:OTEL_EXPORTER_OTLP_HEADERS optional unread' \
        'secret A_THREE dev:DATABASE_URL optional unread' \
        'secret A_FOUR dev:NOT_A_KEY optional unread' \
        'secret POSTHOG_API_KEY manual optional unread' \
        'secret A_SIX manual optional' \
        'variable A_SEVEN manual sometimes' \
        >> "$fx/tools/github/actions-secrets.txt"
    setup "$fx" secrets --offline
    exits 1 || return 1
    has "A_ONE: its SOURCE GRAFANA_SERVICE_ACCOUNT_TOKEN must never be sent to GitHub" || return 1
    has "A_TWO: its SOURCE OTEL_EXPORTER_OTLP_HEADERS must never be sent to GitHub" || return 1
    has "A_THREE: its SOURCE DATABASE_URL is tagged [machine-local]" || return 1
    has "A_FOUR: its SOURCE NOT_A_KEY is not a key of .env.example" || return 1
    has "POSTHOG_API_KEY: is on the never list" || return 1
    has "A_SIX: no workflow reads this secret" || return 1
    has "A_SEVEN: the fourth field must be required or optional"
}

test_secrets_report_compares_names_and_sends_nothing() {
    local fx="$TEST_ROOT/secrets-report"
    fixture "$fx" || return 1
    setup "$fx" secrets
    exits 1 || return 1
    has "repo-setup secrets: $NEW (the repository origin points at) — report only" || return 1
    [[ "$(grep -c '^  missing ' <<< "$OUT")" == "4" ]] || because "expected 4 missing lines" || return 1
    has "missing   secret   POSTHOG_CLI_API_KEY          --apply sets it from secrets/dev.enc.yaml (POSTHOG_CLI_API_KEY)" || return 1
    has "missing   variable POSTHOG_CLI_PROJECT_ID" || return 1
    has "missing   variable POSTHOG_CLI_HOST" || return 1
    has "missing   secret   SOPS_AGE_KEY                 set by hand, never by this command" || return 1
    has "skipped   secret   OTEL_EXPORTER_OTLP_HEADERS   optional; set by hand when needed" || return 1
    has "waiting   secret   OTEL_EXPORTER_OTLP_ENDPOINT  sent once OTEL_EXPORTER_OTLP_HEADERS exists on GitHub" || return 1
    has "skipped   secret   TURBO_TOKEN                  optional; secrets/dev.enc.yaml holds no value for TURBO_TOKEN" || return 1
    has "3 to set from secrets/dev.enc.yaml, 1 that need you first, 0 forbidden" || return 1
    has "to set them: just repo-setup secrets --apply" || return 1
    lacks "synthetic-" || return 1
    # Names only: two list calls, nothing set, nothing decrypted.
    grep -Fxq "gh secret list --repo $NEW --json name --jq .[].name" "$fx/record.txt" || return 1
    grep -Fxq "gh variable list --repo $NEW --json name --jq .[].name" "$fx/record.txt" || return 1
    [[ "$(write_count "$fx")" == "0" ]] || because "the report made gh write" || return 1
    ! grep -q '^sops ' "$fx/record.txt" || because "the report ran sops" || return 1
    record_clean "$fx"
}

test_secrets_apply_pipes_values_and_is_idempotent() {
    local fx="$TEST_ROOT/secrets-apply" before
    fixture "$fx" || return 1
    setup "$fx" secrets --apply
    # The CI age identity is the owner's to set by hand: still missing, so the run says so.
    exits 1 || return 1
    has "set       secret   POSTHOG_CLI_API_KEY" || return 1
    has "set       variable POSTHOG_CLI_PROJECT_ID" || return 1
    has "set       variable POSTHOG_CLI_HOST" || return 1
    has "3 set, 0 replaced" || return 1
    has "1 still missing" || return 1
    lacks "synthetic-" || return 1
    # Exactly the three names arrived, each with the value of the dev file.
    [[ "$(state_get "$fx" 'Object.keys(s.secrets).join(" ")')" == "POSTHOG_CLI_API_KEY" ]] || because "secrets on the stub: $(state_get "$fx" 'Object.keys(s.secrets).join(" ")')" || return 1
    [[ "$(state_get "$fx" 'Object.keys(s.variables).sort().join(" ")')" == "POSTHOG_CLI_HOST POSTHOG_CLI_PROJECT_ID" ]] || return 1
    # JSON.stringify shows a stray newline as \n: the stub keeps its standard input byte for byte.
    [[ "$(state_get "$fx" 'JSON.stringify(s.secrets.POSTHOG_CLI_API_KEY)')" == '"synthetic-upload-key"' ]] || because "the secret did not arrive byte for byte" || return 1
    [[ "$(state_get "$fx" 'JSON.stringify(s.variables.POSTHOG_CLI_PROJECT_ID)')" == '"synthetic-project-id"' ]] || return 1
    [[ "$(state_get "$fx" 'JSON.stringify(s.variables.POSTHOG_CLI_HOST)')" == '"synthetic-app-host"' ]] || return 1
    # The value went sops -> gh on standard input: these are the complete argument lists.
    grep -Fxq 'sops --decrypt --extract ["POSTHOG_CLI_API_KEY"] secrets/dev.enc.yaml' "$fx/record.txt" || return 1
    grep -Fxq "gh secret set POSTHOG_CLI_API_KEY --repo $NEW" "$fx/record.txt" || return 1
    grep -Fxq "gh variable set POSTHOG_CLI_HOST --repo $NEW" "$fx/record.txt" || return 1
    ! grep -Eq '^gh .*--body' "$fx/record.txt" || because "a value was passed with --body" || return 1
    # The owner sets the two by-hand secrets; the endpoint that waited for the token now follows.
    state_edit "$fx" 's.secrets.SOPS_AGE_KEY = "by-hand"; s.secrets.OTEL_EXPORTER_OTLP_HEADERS = "by-hand"'
    setup "$fx" secrets --apply
    exits 0 || return 1
    has "set       secret   OTEL_EXPORTER_OTLP_ENDPOINT" || return 1
    has "1 set, 0 replaced" || return 1
    [[ "$(state_get "$fx" 'JSON.stringify(s.secrets.OTEL_EXPORTER_OTLP_ENDPOINT)')" == '"synthetic-otlp-endpoint"' ]] || return 1
    # The by-hand token was never touched: the dev file's value for that key stays off GitHub.
    [[ "$(state_get "$fx" 's.secrets.OTEL_EXPORTER_OTLP_HEADERS')" == "by-hand" ]] || because "the dev token reached GitHub" || return 1
    # A third run sends nothing; the report is clean.
    before="$(write_count "$fx")"
    setup "$fx" secrets --apply
    exits 0 || return 1
    has "0 set, 0 replaced" || return 1
    [[ "$(write_count "$fx")" == "$before" ]] || because "a repeated --apply sent something" || return 1
    setup "$fx" secrets
    exits 0 || return 1
    has "GitHub has every name tools/github/actions-secrets.txt asks for" || return 1
    # --replace sends the four dev-sourced names again, and only those.
    setup "$fx" secrets --apply --replace
    exits 0 || return 1
    has "0 set, 4 replaced" || return 1
    [[ "$(write_count "$fx")" == "$((before + 4))" ]] || return 1
    [[ "$(state_get "$fx" 's.secrets.OTEL_EXPORTER_OTLP_HEADERS')" == "by-hand" ]] || return 1
    lacks "synthetic-" || return 1
    # Never sent, in any run: the names of the never list and anything the manifest does not name.
    [[ "$(state_get "$fx" 'Object.keys(s.secrets).sort().join(" ")')" == "OTEL_EXPORTER_OTLP_ENDPOINT OTEL_EXPORTER_OTLP_HEADERS POSTHOG_CLI_API_KEY SOPS_AGE_KEY" ]] || return 1
    ! grep -Eq '^gh (secret|variable) set (POSTHOG_API_KEY|POSTHOG_HOST|POSTHOG_SYNC_API_KEY|GRAFANA_SERVICE_ACCOUNT_TOKEN)' "$fx/record.txt" || return 1
    ! grep -q '<<' "$fx/scripts/security/github-secrets.sh" || because "github-secrets.sh uses a here-string or here-document" || return 1
    record_clean "$fx"
}

test_secrets_forbidden_and_unlisted_names() {
    local fx="$TEST_ROOT/secrets-forbidden"
    fixture "$fx" || return 1
    state_edit "$fx" 's.secrets = { SOPS_AGE_KEY: "x", POSTHOG_CLI_API_KEY: "x", GRAFANA_SERVICE_ACCOUNT_TOKEN: "x", SOMETHING_OLD: "x" }; s.variables = { POSTHOG_CLI_PROJECT_ID: "1", POSTHOG_CLI_HOST: "h", POSTHOG_HOST: "h" }'
    setup "$fx" secrets
    exits 1 || return 1
    has "forbidden secret   GRAFANA_SERVICE_ACCOUNT_TOKEN must never be in GitHub; remove it with: gh secret delete GRAFANA_SERVICE_ACCOUNT_TOKEN --repo $NEW" || return 1
    has "forbidden variable POSTHOG_HOST" || return 1
    has "unlisted  secret   SOMETHING_OLD" || return 1
    has "0 to set from secrets/dev.enc.yaml, 0 that need you first, 2 forbidden" || return 1
    # --apply never deletes: the names are still there, and it still exits 1.
    setup "$fx" secrets --apply
    exits 1 || return 1
    has "2 forbidden" || return 1
    [[ "$(state_get "$fx" 's.secrets.GRAFANA_SERVICE_ACCOUNT_TOKEN')" == "x" ]] || return 1
    [[ "$(write_count "$fx")" == "0" ]]
}

test_secrets_without_a_shared_value() {
    local fx="$TEST_ROOT/secrets-no-value"
    fixture "$fx" empty-cli-key || return 1
    state_edit "$fx" 's.secrets.SOPS_AGE_KEY = "by-hand"'
    setup "$fx" secrets
    exits 1 || return 1
    has "missing   secret   POSTHOG_CLI_API_KEY          secrets/dev.enc.yaml holds no value for POSTHOG_CLI_API_KEY: store one first with 'just secrets-push --set POSTHOG_CLI_API_KEY'" || return 1
    has "2 to set from secrets/dev.enc.yaml, 1 that need you first" || return 1
    setup "$fx" secrets --apply
    exits 1 || return 1
    has "2 set, 0 replaced" || return 1
    [[ "$(state_get "$fx" '"POSTHOG_CLI_API_KEY" in s.secrets')" == "false" ]] || because "an empty value was sent" || return 1
    record_clean "$fx"
}

test_secrets_refusals_and_failures() {
    local fx="$TEST_ROOT/secrets-failures"
    fixture "$fx" || return 1
    # An AI agent session: refused before gh is touched.
    SETUP_SESSION=agent setup "$fx" secrets --apply
    exits 1 || return 1
    has "'just repo-setup secrets --apply' is owner-run" || return 1
    ! grep -q '^gh ' "$fx/record.txt" || because "an agent session reached gh" || return 1
    # A flag it does not know is never echoed (it could be a value).
    setup "$fx" secrets synthetic-positional-value
    exits 2 || return 1
    lacks "synthetic-" || return 1
    # gh fails on one send: its output (and sops's) stays hidden, and the run stops.
    state_edit "$fx" 's.fail_set = "POSTHOG_CLI_PROJECT_ID"'
    setup "$fx" secrets --apply
    exits 1 || return 1
    has "could not set the variable POSTHOG_CLI_PROJECT_ID on $NEW" || return 1
    has "gh auth status" || return 1
    lacks "synthetic-" || return 1
    [[ "$(state_get "$fx" 'Object.keys(s.variables).length')" == "0" ]] || return 1
    state_edit "$fx" 'delete s.fail_set; s.secrets = {}'
    rm -f "$fx/gh/state.json.log"
    # No identity that decrypts: nothing is sent at all.
    mv "$fx/home/.config/sops/age/keys.txt" "$fx/home/keys.away"
    setup "$fx" secrets --apply
    exits 1 || return 1
    has "no age private key found" || return 1
    [[ "$(write_count "$fx")" == "0" ]] || because "something was sent without a decrypting identity" || return 1
    mv "$fx/home/keys.away" "$fx/home/.config/sops/age/keys.txt"
    # The logged-in account cannot administer the repository.
    state_edit "$fx" 's.repo.permissions.admin = false'
    setup "$fx" secrets
    exits 1 || return 1
    has "GitHub did not list the Actions secrets and variables of $NEW" || return 1
    has "check: gh auth status ; gh repo view $NEW" || return 1
    # gh without a login, then no gh at all: each with the exact fix.
    state_edit "$fx" 's.login = false'
    setup "$fx" secrets
    exits 1 || return 1
    has "gh has no login for github.com" || return 1
    has "fix: gh auth login" || return 1
    rm "$fx/rec/gh"
    setup "$fx" secrets
    exits 1 || return 1
    has "the GitHub CLI (gh) is not installed" || return 1
    has "fix: mise use --global gh@latest" || return 1
    # Not a GitHub origin.
    git -C "$fx" remote set-url origin "https://gitlab.example/$NEW.git"
    setup "$fx" secrets
    exits 1 || return 1
    has "origin is missing or is not a github.com remote" || return 1
    record_clean "$fx"
}

# --- settings: the repository settings as code --------------------------------------------------------

test_settings_file_matches_the_workflows() {
    local fx="$TEST_ROOT/settings-file" gate="$TEST_ROOT/settings-file/.github/workflows/pr-gate.yml"
    fixture "$fx" || return 1
    # The committed settings file against the committed pr-gate.yml and renovate.json.
    setup "$fx" settings --offline
    exits 0 || return 1
    has "tools/github/repo-settings.json matches .github/workflows/pr-gate.yml (5 required checks) and renovate.json (6 labels)" || return 1
    ! grep -q '^gh ' "$fx/record.txt" || because "--offline called gh" || return 1
    # A renamed job and a new Renovate label are findings, and nothing is read from GitHub.
    awk '{ sub(/name: Gate · just ci-parity$/, "name: Gate · renamed"); print }' "$gate" > "$gate.new"
    mv "$gate.new" "$gate"
    awk '!done && sub(/"labels": \["dependencies"\]/, "\"labels\": [\"dependencies\", \"brand-new\"]") { done = 1 } { print }' "$fx/renovate.json" > "$fx/renovate.json.new"
    mv "$fx/renovate.json.new" "$fx/renovate.json"
    setup "$fx" settings
    exits 1 || return 1
    has "required check 'Gate · just ci-parity' is not the name of a job in .github/workflows/pr-gate.yml" || return 1
    has "job 'Gate · renamed' of .github/workflows/pr-gate.yml is not a required check" || return 1
    has "renovate.json uses the label 'brand-new', which is not declared" || return 1
    has "3 problem(s) in the file, nothing sent" || return 1
    ! grep -q '^gh api' "$fx/record.txt" || because "a broken settings file still reached the API"
}

test_settings_report_then_apply_on_a_public_repository() {
    local fx="$TEST_ROOT/settings-public" before
    fixture "$fx" || return 1
    setup "$fx" settings
    exits 1 || return 1
    has "repo-setup settings: $NEW (a public repository under a personal account)" || return 1
    has 'ok          Actions permissions: enabled=true, allowed_actions="all"' || return 1
    has 'change      Actions workflow token: default_workflow_permissions: "write" -> "read", can_approve_pull_request_reviews: true -> false' || return 1
    has "change      branch protection for main: not protected -> 5 required check(s) and the declared rules" || return 1
    has "change      secret scanning: disabled -> enabled" || return 1
    has "change      secret scanning push protection: disabled -> enabled" || return 1
    has "change      dependabot security updates: disabled -> enabled" || return 1
    has "create      label dependencies" || return 1
    has "create      label needs-deps-lock" || return 1
    has "11 to change, 0 not readable, 0 unavailable, 0 only you can do, 1 already as declared" || return 1
    has "to apply: just repo-setup settings --apply" || return 1
    [[ "$(write_count "$fx")" == "0" ]] || because "the report wrote to GitHub" || return 1
    ! grep -Eq '^gh api --method (PUT|PATCH|POST|DELETE)' "$fx/record.txt" || because "the report sent a write" || return 1

    setup "$fx" settings --apply
    exits 0 || return 1
    has "changed     branch protection for main" || return 1
    has "created     label security" || return 1
    has "11 changed, 0 failed" || return 1
    # What was sent: one call per difference, bodies on standard input, nothing deleted.
    [[ "$(write_count "$fx")" == "11" ]] || because "expected 11 writes, got $(write_count "$fx")" || return 1
    writes "$fx" | grep -Fq "PUT repos/$NEW/actions/permissions/workflow {\"default_workflow_permissions\":\"read\",\"can_approve_pull_request_reviews\":false}" || return 1
    ! writes "$fx" | grep -Fq "PUT repos/$NEW/actions/permissions {" || because "a setting that already matched was sent" || return 1
    writes "$fx" | grep -F "PUT repos/$NEW/branches/main/protection " > "$fx/gh/protection.txt" || return 1
    for check in 'Gate · just ci-parity' 'Gate · Contracts (generate --check, spectral, oasdiff)' 'Gate · Secret scan (PR diff)' 'Gate · Clone detection' 'Report · PR gate summary'; do
        grep -Fq "\"$check\"" "$fx/gh/protection.txt" || because "required check missing from the protection call: $check" || return 1
    done
    grep -Fq '"strict":true' "$fx/gh/protection.txt" || return 1
    grep -Fq '"enforce_admins":true' "$fx/gh/protection.txt" || return 1
    grep -Fq '"restrictions":null' "$fx/gh/protection.txt" || return 1
    writes "$fx" | grep -Fq "PATCH repos/$NEW {\"security_and_analysis\":{\"secret_scanning\":{\"status\":\"enabled\"}}}" || return 1
    writes "$fx" | grep -Fq "PATCH repos/$NEW {\"security_and_analysis\":{\"dependabot_security_updates\":{\"status\":\"enabled\"}}}" || return 1
    [[ "$(state_get "$fx" 's.repo.security_and_analysis.dependabot_security_updates.status')" == "enabled" ]] || return 1
    [[ "$(writes "$fx" | grep -c "^POST repos/$NEW/labels ")" == "6" ]] || return 1
    ! writes "$fx" | grep -q '^DELETE ' || return 1
    grep -Eq '^gh api --method PUT repos/[^ ]+/branches/main/protection -H .* --input -$' "$fx/record.txt" || because "the body was not sent on standard input" || return 1
    [[ "$(state_get "$fx" 's.labels.map((l) => l.name).join(" ")')" == "bug dependencies needs-adr android ios needs-deps-lock security" ]] || return 1

    # A second run sends nothing, and the report is clean.
    before="$(write_count "$fx")"
    setup "$fx" settings --apply
    exits 0 || return 1
    has "0 changed, 0 failed, 0 unavailable, 0 only you can do, 12 already as declared" || return 1
    [[ "$(write_count "$fx")" == "$before" ]] || because "a repeated --apply sent something" || return 1
    setup "$fx" settings
    exits 0 || return 1
    has "ok          branch protection for main: 5 required check(s)" || return 1
    # A check someone removed in the UI is a difference again.
    state_edit "$fx" 's.protection.required_status_checks.contexts.pop(); s.rulesets = [{ id: 1 }]'
    setup "$fx" settings
    exits 1 || return 1
    has "change      branch protection for main: required_status_checks:" || return 1
    has "note        rulesets: 1 ruleset(s) exist; this command manages classic branch protection only" || return 1
    record_clean "$fx"
}

test_settings_say_plainly_what_the_plan_lacks() {
    local fx="$TEST_ROOT/settings-private"
    fixture "$fx" || return 1
    # A private repository under a personal account on the free plan.
    state_edit "$fx" 's.repo.private = true; delete s.repo.security_and_analysis; s.protection_blocked = true'
    setup "$fx" settings
    exits 1 || return 1
    has "(a private repository under a personal account)" || return 1
    has 'unavailable branch protection for main: GitHub answered "Upgrade to GitHub Pro or make this repository public to enable this feature." (HTTP 403): protected branches are not offered for a private repository under a personal account' || return 1
    has "unavailable secret scanning: GitHub does not offer it for a private repository under a personal account" || return 1
    has "unavailable secret scanning push protection: GitHub does not offer it" || return 1
    # Each feature names its own reason: Secret Protection for scanning, the alerts for Dependabot.
    has "unavailable secret scanning: GitHub does not offer it for a private repository under a personal account (free on a public repository; a private one needs GitHub Secret Protection" || return 1
    has "unavailable dependabot security updates: GitHub does not offer it for a private repository under a personal account (it needs Dependabot alerts switched on first (Settings" || return 1
    has "7 to change, 0 not readable, 4 unavailable" || return 1
    has "unavailable = GitHub does not offer the setting for a private repository under a personal account: left alone, not a difference" || return 1
    # --apply sets the rest and never tries what is not offered; afterwards nothing is left to do.
    setup "$fx" settings --apply
    exits 0 || return 1
    has "7 changed, 0 failed, 4 unavailable" || return 1
    ! writes "$fx" | grep -q '/protection ' || because "branch protection was sent although the plan lacks it" || return 1
    ! writes "$fx" | grep -q '^PATCH ' || return 1
    setup "$fx" settings
    exits 0 || return 1
    has "0 to change, 0 not readable, 4 unavailable" || return 1
    # A public repository where GitHub takes the call and changes nothing: said, not hidden, and
    # Dependabot security updates name the alerts they need.
    gh_state "$fx"
    state_edit "$fx" 's.sticky = ["secret_scanning_push_protection", "dependabot_security_updates"]'
    setup "$fx" settings --apply
    exits 0 || return 1
    has "unavailable secret scanning push protection: GitHub took the call and changed nothing: not offered for a public repository under a personal account" || return 1
    lacks "push protection: GitHub took the call and changed nothing: not offered for a public repository under a personal account, or" || return 1
    has "unavailable dependabot security updates: GitHub took the call and changed nothing: not offered for a public repository under a personal account, or it needs Dependabot alerts switched on first (Settings" || return 1
    has "changed     secret scanning: disabled -> enabled"
}

test_settings_refusals_and_failures() {
    local fx="$TEST_ROOT/settings-failures"
    fixture "$fx" || return 1
    SETUP_SESSION=agent setup "$fx" settings --apply
    exits 1 || return 1
    has "'just repo-setup settings --apply' is owner-run" || return 1
    ! grep -q '^gh api' "$fx/record.txt" || because "an agent session reached the API" || return 1
    setup "$fx" settings --bogus
    exits 2 || return 1
    # The default branch is not the declared one: a step only the owner can do.
    state_edit "$fx" 's.repo.default_branch = "trunk"'
    setup "$fx" settings
    exits 1 || return 1
    has "manual      default branch: is trunk, not main; change it under Settings" || return 1
    has "1 only you can do" || return 1
    # No admin rights, and a repository the account cannot see.
    state_edit "$fx" 's.repo.default_branch = "main"; s.repo.permissions.admin = false'
    setup "$fx" settings --apply
    exits 1 || return 1
    has "the gh account has no admin rights on $NEW" || return 1
    [[ "$(write_count "$fx")" == "0" ]] || return 1
    state_edit "$fx" 's.repo = null'
    setup "$fx" settings
    exits 1 || return 1
    has "GitHub answered 404 for $NEW: the repository does not exist, or the logged-in account cannot see it" || return 1
    state_edit "$fx" 's.login = false'
    setup "$fx" settings
    exits 1 || return 1
    has "fix: gh auth login"
}

# --- the whole thing: just repo-setup ---------------------------------------------------------------

test_bare_run_checks_all_three_and_names_the_commands() {
    local fx="$TEST_ROOT/all" order
    fixture "$fx" || return 1
    setup "$fx"
    exits 1 || return 1
    has "repo-setup: checking $NEW, the repository origin points at; nothing is changed" || return 1
    order="$(grep -E '^(1/3|2/3|3/3) |^  to do ' <<< "$OUT" | awk '{ if ($1 == "to") print $5, $6; else print $1 }' | tr '\n' '|')"
    [[ "$order" == "1/3|2/3|3/3|name --apply|secrets --apply|settings --apply|" ]] \
        || because "sections or commands out of order: $order" || return 1
    has "run the 'to do' commands yourself, in this order" || return 1
    lacks "synthetic-" || return 1
    unchanged_tree "$fx" || return 1
    [[ "$(write_count "$fx")" == "0" ]] || because "the bare run wrote to GitHub" || return 1
    setup "$fx" check
    exits 1 || return 1
    # The three apply commands, in the order it names them, plus the two by-hand secrets.
    setup "$fx" name --apply
    exits 0 || return 1
    state_edit "$fx" 's.secrets.SOPS_AGE_KEY = "by-hand"'
    setup "$fx" secrets --apply
    exits 0 || return 1
    setup "$fx" settings --apply
    exits 0 || return 1
    setup "$fx"
    exits 0 || return 1
    [[ "$(grep -c '^  ok  ' <<< "$OUT")" -ge 3 ]] || return 1
    has "nothing to do: tracked files, Actions secrets and variables, and repository settings match" || return 1
    # Without a gh login the name check still runs; the other two are skipped with the fix.
    state_edit "$fx" 's.login = false'
    setup "$fx"
    exits 1 || return 1
    has "fix: gh auth login" || return 1
    has "ok       repository name in tracked files" || return 1
    has "skipped  Actions secrets and variables: gh is not ready" || return 1
    has "skipped  repository settings: gh is not ready" || return 1
    # Usage.
    setup "$fx" --apply
    exits 2 || return 1
    has "--apply needs a subcommand" || return 1
    setup "$fx" bogus
    exits 2 || return 1
    record_clean "$fx"
}

run_test "name: the report lists every line naming this repository's old name, and only those; kept paths are named with their reason; nothing is written" test_name_report_lists_only_this_repository
run_test "name --apply rewrites https, ssh, .git, mixed-case and sentence-final forms and the clone directory; third-party links, kept paths and a missing final newline stay; a second run changes nothing" test_name_apply_rewrites_and_is_idempotent
run_test "name --apply after an owner-only change leaves the clone directory alone" test_name_owner_change_keeps_the_clone_directory
run_test "name: exit 3 with the reason when it cannot tell (no recorded name, no github.com origin); --from names the old one; the committed check.mjs still has the line it reads" test_name_says_when_it_cannot_tell
run_test "name --apply is refused in an AI agent session; the report is not" test_name_apply_is_refused_in_an_agent_session
run_test "name --apply over this checkout's own files rewrites exactly the reported lines, keeps every third-party link, the kept paths and solo.yml, and leaves every JSON file valid" test_name_rewrites_this_checkouts_own_files
run_test "doctor: a stale repository name is a warning with the fix command, a match is ok, no GitHub origin is a note" test_doctor_warns_about_the_name_with_the_fix
run_test "doctor: gh missing or logged out is a warning with the exact fix, offline; nothing in CI; doctor.sh calls both checks" test_doctor_reports_the_github_cli_offline
run_test "secrets: the committed manifest covers every secret and variable the workflows read; an undeclared, forbidden, machine-local or unknown source is rejected offline" test_manifest_matches_the_workflows
run_test "secrets: the report compares names only (two list calls), exits 1 on drift, sends and decrypts nothing" test_secrets_report_compares_names_and_sends_nothing
run_test "secrets --apply pipes each value from sops into gh on standard input (never an argument, a file or the environment), honours after=, never sends a manual or never entry, and a repeat sends nothing; --replace re-sends" test_secrets_apply_pipes_values_and_is_idempotent
run_test "secrets: a forbidden name on GitHub is drift with the command that removes it; --apply never deletes" test_secrets_forbidden_and_unlisted_names
run_test "secrets: a required name without a shared value names the secrets-push command and is never sent empty" test_secrets_without_a_shared_value
run_test "secrets: refused in an agent session; an unknown argument is not echoed; a failed send, a missing identity, no admin rights, no login, no gh and a non-GitHub origin each stop with the fix" test_secrets_refusals_and_failures
run_test "settings: the committed file matches the pr-gate job names and renovate.json's labels; a renamed job or a new label is rejected offline" test_settings_file_matches_the_workflows
run_test "settings: the report sends only GETs; --apply sends one call per difference (five required checks, bodies on stdin), a repeat sends nothing, a removed check is a difference again" test_settings_report_then_apply_on_a_public_repository
run_test "settings: what a private repository on a personal plan lacks is reported as unavailable with GitHub's message, never sent, and not counted as a difference" test_settings_say_plainly_what_the_plan_lacks
run_test "settings: refused in an agent session; a wrong default branch, no admin rights, an invisible repository and no login each say what to do" test_settings_refusals_and_failures
run_test "just repo-setup: three checks in order, the apply commands in order, nothing written; clean after the three applies; gh not ready skips two with the fix" test_bare_run_checks_all_three_and_names_the_commands

if [[ $failures -ne 0 ]]; then
    echo "repo-setup tests: $failures failed" >&2
    exit 1
fi
echo "repo-setup tests: all passed"
