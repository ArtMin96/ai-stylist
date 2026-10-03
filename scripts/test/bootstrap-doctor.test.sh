#!/usr/bin/env bash
# Black-box regression suite for the machine-setup helpers that bootstrap.sh and doctor.sh share
# (scripts/lib.sh: Xcode detection, the managed mise + direnv block in the shell rc file, the .env
# readers behind doctor's observability-key lines, bootstrap's .env defaults for DATABASE_URL and
# APP_ENV, doctor's APP_ENV and local Postgres container checks, the compose project name and the
# APP_ENV that `just dev-api` / `just dev-workers` use) and for the Xcode guard of the apps/ios
# recipes (apps/ios/scripts/lib.sh via xcode.sh doctor).
# Usage: scripts/test/bootstrap-doctor.test.sh   (run by `just test tooling` and `just test`)
# Runs on Linux and macOS alike: xcodebuild, plutil, uname and docker are stubs on PATH, Xcode
# bundles are fixture directories, every .env is a throwaway file, and HOME is a throwaway
# directory. Nothing reads or edits the real rc files, the real .env, the real Xcode, /Applications
# or a real container. Needs just (mise) for the two cases that read the justfile.
# shellcheck disable=SC2030,SC2031 # each probe deliberately scopes PATH/HOME/MISE_BIN to its own
# subshell; shellcheck's whole-file flow analysis otherwise flags every later use of them.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-bootstrap-tests.XXXXXX")"
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

# stub <dir> <name> <bash body>: an executable <dir>/<name> running <body>.
stub() {
  mkdir -p "$1"
  printf '#!/usr/bin/env bash\n%s\n' "$3" >"$1/$2"
  chmod +x "$1/$2"
}

expect_eq() {
  if [[ "$1" != "$2" ]]; then
    printf '  expected: %s\n  actual:   %s\n' "$2" "$1" >&2
    return 1
  fi
}

expect_contains() {
  if [[ "$1" != *"$2"* ]]; then
    printf '  expected output to contain: %s\n  output: %s\n' "$2" "$1" >&2
    return 1
  fi
}

expect_not_contains() {
  if [[ "$1" == *"$2"* ]]; then
    printf '  expected output not to contain: %s\n  output: %s\n' "$2" "$1" >&2
    return 1
  fi
}

CLT_ERROR="xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance"

# --- Xcode detection (scripts/lib.sh darwin_xcode_state) ------------------------------------------

# xcode_state <active version, or "" when xcodebuild cannot run> [<bundle name>:<version>...]
# Prints darwin_xcode_state 27.0 with the fixture Applications dir shown as <apps>.
xcode_state() {
  local dir active="$1" entry
  dir="$(mktemp -d "$TEST_ROOT/xcode.XXXXXX")"
  shift
  mkdir -p "$dir/Applications"
  if [[ -n "$active" ]]; then
    stub "$dir/bin" xcodebuild "printf 'Xcode %s\nBuild version 27A266a\n' '$active'"
  else
    stub "$dir/bin" xcodebuild "echo \"$CLT_ERROR\" >&2; exit 1"
  fi
  # plutil -extract CFBundleShortVersionString raw -o - <plist>: the fixture keeps the version next to it.
  # shellcheck disable=SC2016  # the stub body expands when the stub runs, not here
  stub "$dir/bin" plutil 'for last; do :; done; cat "$last.version"'
  for entry in "$@"; do
    mkdir -p "$dir/Applications/${entry%%:*}/Contents"
    : >"$dir/Applications/${entry%%:*}/Contents/Info.plist"
    echo "${entry#*:}" >"$dir/Applications/${entry%%:*}/Contents/Info.plist.version"
  done
  (
    PATH="$dir/bin:$PATH"
    export XCODES_DIRECTORY="$dir/Applications"
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    darwin_xcode_state 27.0
  ) | sed "s#$dir/Applications#<apps>#"
}

test_xcode_installed_but_command_line_tools_selected() {
  expect_eq "$(xcode_state "" Xcode.app:27.0)" "unselected <apps>/Xcode.app"
}

test_xcode_pinned_version_active() {
  expect_eq "$(xcode_state 27.0 Xcode.app:27.0)" "ok"
}

test_xcode_other_version_active_pinned_installed() {
  expect_eq "$(xcode_state 26.4 Xcode.app:26.4 Xcode-27.0.app:27.0)" "unselected <apps>/Xcode-27.0.app"
}

test_xcode_other_version_active_pinned_missing() {
  expect_eq "$(xcode_state 26.4 Xcode.app:26.4)" "other 26.4"
}

test_xcode_missing() {
  expect_eq "$(xcode_state "" Xcode_26.4.app:26.4)" "missing"
}

test_xcode_missing_empty_applications() {
  expect_eq "$(xcode_state "")" "missing"
}

# --- apps/ios recipes: xcodebuild present but unusable -----------------------------------------

test_ios_doctor_names_the_fix_when_xcode_is_not_selected() {
  local bin="$TEST_ROOT/ios-clt/bin" out
  stub "$bin" uname 'echo Darwin'
  stub "$bin" xcodebuild "echo \"$CLT_ERROR\" >&2; exit 1"
  if out="$(PATH="$bin:$PATH" "$ROOT/apps/ios/scripts/xcode.sh" doctor 2>&1)"; then
    echo "  expected a non-zero exit, got 0: $out" >&2
    return 1
  fi
  expect_contains "$out" "command line tools instance" && expect_contains "$out" "scripts/bootstrap.sh --system"
}

# --- shell rc file (scripts/lib.sh shell_rc_file) ------------------------------------------------

# rc_file_for <SHELL> <OS_NAME> [ZDOTDIR]
rc_file_for() {
  (
    export SHELL="$1" HOME=/home/dev
    if [[ -n "${3:-}" ]]; then export ZDOTDIR="$3"; else unset ZDOTDIR; fi
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    OS_NAME="$2"
    shell_rc_file
  )
}

test_rc_file_zsh() {
  expect_eq "$(rc_file_for /bin/zsh Darwin)" "/home/dev/.zshrc" \
    && expect_eq "$(rc_file_for /usr/bin/zsh Linux /home/dev/.config/zsh)" "/home/dev/.config/zsh/.zshrc"
}

test_rc_file_bash() {
  expect_eq "$(rc_file_for /bin/bash Linux)" "/home/dev/.bashrc" \
    && expect_eq "$(rc_file_for /bin/bash Darwin)" "/home/dev/.bash_profile"
}

test_rc_file_unsupported_shell() {
  if rc_file_for /usr/bin/fish Linux >/dev/null; then
    echo "  expected fish to be reported as unsupported" >&2
    return 1
  fi
}

# --- managed mise + direnv block (scripts/lib.sh shell_activation_write) ---------------------------

# write_block <rc> <shell> <direnv version>
write_block() {
  (
    export MISE_BIN=/opt/mise/bin/mise HOME="$TEST_ROOT/home"
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    shell_activation_write "$@"
  )
}

# shellcheck disable=SC2016  # the expected rc lines contain literal $(...)
expected_block() {
  printf '%s\n' \
    '# >>> ai-stylist: mise + direnv (managed by scripts/bootstrap.sh) >>>' \
    "eval \"\$(/opt/mise/bin/mise activate $1)\"" \
    "eval \"\$(/opt/mise/bin/mise exec direnv@$2 -- direnv hook $1)\"" \
    '# <<< ai-stylist <<<'
}

test_block_created_in_missing_rc() {
  local rc="$TEST_ROOT/new/.zshrc"
  mkdir -p "$(dirname "$rc")"
  write_block "$rc" zsh 2.37.1
  expect_eq "$(cat "$rc")" "$(expected_block zsh 2.37.1)"
}

test_block_replaced_in_place_and_never_duplicated() {
  local rc="$TEST_ROOT/replace/.bashrc"
  mkdir -p "$(dirname "$rc")"
  printf 'export FOO=1\n' >"$rc"
  write_block "$rc" bash 2.37.1
  printf 'alias ll="ls -l"\n' >>"$rc"
  write_block "$rc" bash 2.38.0
  write_block "$rc" bash 2.38.0
  expect_eq "$(cat "$rc")" "$(printf 'export FOO=1\n%s\nalias ll="ls -l"' "$(expected_block bash 2.38.0)")"
}

test_block_keeps_a_symlinked_rc_a_symlink() {
  local dir="$TEST_ROOT/symlink"
  mkdir -p "$dir/dotfiles"
  printf 'export FOO=1\n' >"$dir/dotfiles/zshrc"
  ln -s "$dir/dotfiles/zshrc" "$dir/.zshrc"
  write_block "$dir/.zshrc" zsh 2.37.1
  if [[ ! -L "$dir/.zshrc" ]]; then
    echo "  $dir/.zshrc is no longer a symlink" >&2
    return 1
  fi
  expect_eq "$(cat "$dir/dotfiles/zshrc")" "$(printf 'export FOO=1\n%s' "$(expected_block zsh 2.37.1)")"
}

# --- .env readers (scripts/lib.sh env_file_value, env_file_key_states: doctor's observability lines)

# lib_call <function> <args...>: runs one scripts/lib.sh function in a subshell.
lib_call() {
  (
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    "$@"
  )
}

ENV_FIXTURE_SECRET='planted-secret-value-7f3a'

write_env_fixture() {
  local file="$TEST_ROOT/dotenv/.env"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' \
    '# comment' \
    "OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.example.test/$ENV_FIXTURE_SECRET" \
    'OTEL_EXPORTER_OTLP_HEADERS=' \
    "export POSTHOG_API_KEY=\"phc_$ENV_FIXTURE_SECRET\"" \
    "POSTHOG_HOST='https://eu.i.posthog.example'" \
    "GRAFANA_URL=first" \
    "GRAFANA_URL=$ENV_FIXTURE_SECRET" \
    >"$file"
  printf 'POSTHOG_CLI_HOST=https://eu.posthog.example\r\n' >>"$file"
  printf '%s\n' "$file"
}

test_env_file_value_reads_like_dotenv() {
  local file
  file="$(write_env_fixture)"
  expect_eq "$(lib_call env_file_value POSTHOG_API_KEY "$file")" "phc_$ENV_FIXTURE_SECRET" \
    && expect_eq "$(lib_call env_file_value POSTHOG_HOST "$file")" "https://eu.i.posthog.example" \
    && expect_eq "$(lib_call env_file_value GRAFANA_URL "$file")" "$ENV_FIXTURE_SECRET" \
    && expect_eq "$(lib_call env_file_value POSTHOG_CLI_HOST "$file")" "https://eu.posthog.example" \
    && expect_eq "$(lib_call env_file_value OTEL_EXPORTER_OTLP_HEADERS "$file")" "" \
    && expect_eq "$(lib_call env_file_value NOT_THERE "$file")" "" \
    && expect_eq "$(lib_call env_file_value POSTHOG_HOST "$TEST_ROOT/dotenv/missing.env")" ""
}

# One key per form env_file_value_kind tells apart. `just secrets-push` pushes `plain` values only.
test_env_file_value_kind_names_the_form_never_the_value() {
  local file="$TEST_ROOT/dotenv-kind/.env" out="" key
  mkdir -p "$(dirname "$file")"
  printf '%s\n' \
    "PLAIN=$ENV_FIXTURE_SECRET" \
    "PLAIN_SPACED=Authorization=Basic $ENV_FIXTURE_SECRET" \
    "export DOUBLE=\"$ENV_FIXTURE_SECRET with spaces\"" \
    "SINGLE='$ENV_FIXTURE_SECRET\\literal'" \
    "BACKSLASH=$ENV_FIXTURE_SECRET\\nliteral" \
    'EMPTY=' \
    'EMPTY_QUOTED=""' \
    "COMMENT=$ENV_FIXTURE_SECRET # note" \
    "COMMENT_FIRST=#$ENV_FIXTURE_SECRET" \
    "COMMENT_QUOTED=\"$ENV_FIXTURE_SECRET # inside the quotes\"" \
    "AFTER_QUOTE=\"$ENV_FIXTURE_SECRET\" # note" \
    "NESTED=\"'$ENV_FIXTURE_SECRET'\"" \
    "PADDED=\" $ENV_FIXTURE_SECRET \"" \
    "LEADING= $ENV_FIXTURE_SECRET" \
    "ESCAPE=\"$ENV_FIXTURE_SECRET\\nline\"" \
    >"$file"
  printf 'TAB=%s\tx\n' "$ENV_FIXTURE_SECRET" >>"$file"
  printf 'CRLF=%s\r\n' "$ENV_FIXTURE_SECRET" >>"$file"
  for key in PLAIN PLAIN_SPACED DOUBLE SINGLE BACKSLASH CRLF EMPTY EMPTY_QUOTED NOT_THERE \
    COMMENT COMMENT_FIRST COMMENT_QUOTED AFTER_QUOTE NESTED PADDED LEADING ESCAPE TAB; do
    out="$out$key=$(lib_call env_file_value_kind "$key" "$file") "
  done
  expect_eq "$out" "PLAIN=plain PLAIN_SPACED=plain DOUBLE=plain SINGLE=plain BACKSLASH=plain CRLF=plain EMPTY=empty EMPTY_QUOTED=empty NOT_THERE=empty COMMENT=comment COMMENT_FIRST=comment COMMENT_QUOTED=comment AFTER_QUOTE=quote NESTED=quote PADDED=padding LEADING=padding ESCAPE=escape TAB=control " \
    || return 1
  expect_not_contains "$out" "$ENV_FIXTURE_SECRET" || return 1
  expect_eq "$(lib_call env_file_value_kind PLAIN "$TEST_ROOT/dotenv-kind/missing.env")" "empty" || return 1
  # The value reader is the same parser: what it returned before is what it returns now.
  expect_eq "$(lib_call env_file_value DOUBLE "$file")" "$ENV_FIXTURE_SECRET with spaces" \
    && expect_eq "$(lib_call env_file_value AFTER_QUOTE "$file")" "\"$ENV_FIXTURE_SECRET\" # note" \
    && expect_eq "$(lib_call env_file_value LEADING "$file")" " $ENV_FIXTURE_SECRET"
}

test_env_file_key_states_names_state_never_value() {
  local file out
  file="$(write_env_fixture)"
  out="$(lib_call env_file_key_states "$file" OTEL_EXPORTER_OTLP_ENDPOINT OTEL_EXPORTER_OTLP_HEADERS \
    POSTHOG_API_KEY POSTHOG_SYNC_API_KEY GRAFANA_URL POSTHOG_CLI_HOST)"
  expect_eq "$out" "OTEL_EXPORTER_OTLP_ENDPOINT set, OTEL_EXPORTER_OTLP_HEADERS empty, POSTHOG_API_KEY set, POSTHOG_SYNC_API_KEY absent, GRAFANA_URL set, POSTHOG_CLI_HOST set" \
    || return 1
  if [[ "$out" == *"$ENV_FIXTURE_SECRET"* || "$out" == *phc_* || "$out" == *https:* ]]; then
    echo "  a value leaked into: $out" >&2
    return 1
  fi
}

test_env_file_key_states_without_file() {
  expect_eq "$(lib_call env_file_key_states "$TEST_ROOT/dotenv/missing.env" POSTHOG_API_KEY POSTHOG_HOST)" \
    "POSTHOG_API_KEY absent, POSTHOG_HOST absent"
}

# --- bootstrap's .env defaults (scripts/lib.sh env_file_fill_empty, env_file_fill_local_defaults) --

# throwaway_env <case> <line...>: writes the lines to a .env under TEST_ROOT and prints its path.
throwaway_env() {
  local dir="$TEST_ROOT/env-$1"
  shift
  mkdir -p "$dir"
  printf '%s\n' "$@" >"$dir/.env"
  printf '%s\n' "$dir/.env"
}

# The permission bits of a file as octal digits (GNU stat, else BSD stat).
file_mode() {
  if stat -c '%a' "$1" >/dev/null 2>&1; then stat -c '%a' "$1"; else stat -f '%Lp' "$1"; fi
}

test_fill_empty_sets_an_empty_key_in_place() {
  local file
  file="$(throwaway_env fill-in-place '# Runtime' 'APP_ENV=' 'LOG_LEVEL=debug' '' 'export API_PORT=' 'TAIL=1')"
  chmod 600 "$file"
  lib_call env_file_fill_empty APP_ENV local "$file" || return 1
  lib_call env_file_fill_empty API_PORT 3000 "$file" || return 1
  expect_eq "$(cat "$file")" "$(printf '%s\n' '# Runtime' 'APP_ENV=local' 'LOG_LEVEL=debug' '' 'API_PORT=3000' 'TAIL=1')" || return 1
  # Rewritten through its path: the mode `just secrets-sync` gives .env survives.
  expect_eq "$(file_mode "$file")" "600"
}

test_fill_empty_never_changes_a_value() {
  local file before filled=0
  file="$(throwaway_env fill-keep 'APP_ENV=staging' 'export LOG_LEVEL="warn"' "DATABASE_URL='postgres://elsewhere/db'" 'API_PORT=')"
  before="$(cat "$file")"
  if lib_call env_file_fill_empty APP_ENV local "$file"; then filled=1; fi
  if lib_call env_file_fill_empty LOG_LEVEL info "$file"; then filled=1; fi
  if lib_call env_file_fill_empty DATABASE_URL postgres://local/db "$file"; then filled=1; fi
  if lib_call env_file_fill_empty APP_ENV local "$TEST_ROOT/env-fill-keep/missing.env"; then filled=1; fi
  if ((filled)); then
    echo "  a key that already has a value, or a missing file, was reported as filled" >&2
    return 1
  fi
  expect_eq "$(cat "$file")" "$before" || return 1
  [[ ! -e "$TEST_ROOT/env-fill-keep/missing.env" ]] || return 1
  # The same call does fill the one key of that file that is empty, and only that line.
  lib_call env_file_fill_empty API_PORT 3000 "$file" || return 1
  expect_eq "$(cat "$file")" "${before%API_PORT=}API_PORT=3000"
}

test_fill_empty_appends_dedupes_and_writes_literally() {
  local file value='postgres://u:p@localhost:5433/db?a=1&b=\n'
  file="$(throwaway_env fill-append 'APP_ENV=old' 'KEEP=1' 'APP_ENV=')"
  lib_call env_file_fill_empty APP_ENV local "$file" || return 1
  lib_call env_file_fill_empty DATABASE_URL "$value" "$file" || return 1
  expect_eq "$(cat "$file")" "$(printf '%s\n' 'APP_ENV=local' 'KEEP=1' "DATABASE_URL=$value")" || return 1
  expect_eq "$(lib_call env_file_value DATABASE_URL "$file")" "$value"
}

# bootstrap_defaults <dotenv file> [exported POSTGRES_HOST_PORT]: the .env step of bootstrap.sh.
bootstrap_defaults() {
  (
    unset POSTGRES_HOST_PORT
    if [[ $# -ge 2 ]]; then export POSTGRES_HOST_PORT="$2"; fi
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    env_file_fill_local_defaults "$1"
  )
}

LOCAL_DATABASE_URL='postgres://ai_stylist:ai_stylist@localhost:5432/ai_stylist'

test_bootstrap_fills_database_url_and_app_env() {
  local file="$TEST_ROOT/env-bootstrap/.env" out changed
  mkdir -p "$(dirname "$file")"
  cp "$ROOT/.env.example" "$file"
  out="$(bootstrap_defaults "$file")" || return 1
  expect_eq "$(lib_call env_file_value DATABASE_URL "$file")" "$LOCAL_DATABASE_URL" || return 1
  expect_eq "$(lib_call env_file_value APP_ENV "$file")" "local" || return 1
  expect_contains "$out" "DATABASE_URL was empty" || return 1
  expect_contains "$out" "APP_ENV was empty" || return 1
  # Only those two lines differ from .env.example: every other key keeps its empty value.
  changed="$(diff "$ROOT/.env.example" "$file" | grep -c '^>' || true)"
  expect_eq "$changed" "2" || return 1
  # Idempotent: a second run says nothing and leaves the file byte-identical.
  cp "$file" "$file.first"
  out="$(bootstrap_defaults "$file")" || return 1
  expect_eq "$out" "" || return 1
  cmp -s "$file" "$file.first"
}

test_bootstrap_keeps_set_values_and_follows_the_host_port() {
  local file before
  file="$(throwaway_env bootstrap-keep 'APP_ENV=dev' 'DATABASE_URL=postgres://elsewhere/db' 'POSTGRES_HOST_PORT=5433')"
  before="$(cat "$file")"
  expect_eq "$(bootstrap_defaults "$file")" "" || return 1
  expect_eq "$(cat "$file")" "$before" || return 1
  # The host port compose resolves: POSTGRES_HOST_PORT from the environment, else from the file.
  file="$(throwaway_env bootstrap-port 'APP_ENV=' 'DATABASE_URL=' 'POSTGRES_HOST_PORT=5433')"
  bootstrap_defaults "$file" >/dev/null || return 1
  expect_eq "$(lib_call env_file_value DATABASE_URL "$file")" "${LOCAL_DATABASE_URL/5432/5433}" || return 1
  file="$(throwaway_env bootstrap-port-env 'DATABASE_URL=' 'POSTGRES_HOST_PORT=5433')"
  bootstrap_defaults "$file" 6000 >/dev/null || return 1
  expect_eq "$(lib_call env_file_value DATABASE_URL "$file")" "${LOCAL_DATABASE_URL/5432/6000}" || return 1
  # A key the file lacks altogether is appended.
  expect_eq "$(lib_call env_file_value APP_ENV "$file")" "local"
}

# --- APP_ENV: doctor's check and what the dev recipes pass (scripts/lib.sh, scripts/dev-app-env.sh)

# app_env_doctor <dotenv file>: doctor's APP_ENV line(s), then "failures=N warnings=N".
app_env_doctor() {
  (
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    doctor_app_env "$1" 2>&1
    echo "failures=$DOCTOR_FAILURES warnings=$DOCTOR_WARNINGS"
  )
}

test_doctor_reports_an_empty_app_env_with_the_fix() {
  local file out
  file="$(throwaway_env doctor-app-env-empty 'APP_ENV=' 'LOG_LEVEL=debug')"
  out="$(app_env_doctor "$file")"
  expect_contains "$out" "failures=0 warnings=1" || return 1
  expect_contains "$out" "APP_ENV is empty in .env" || return 1
  expect_contains "$out" "deployment.environment.name" || return 1
  expect_contains "$out" "just bootstrap" || return 1
  # The fix doctor names is bootstrap's .env step: after it the warning is gone.
  bootstrap_defaults "$file" >/dev/null || return 1
  out="$(app_env_doctor "$file")"
  expect_contains "$out" "failures=0 warnings=0" || return 1
  expect_contains "$out" "APP_ENV is set in .env"
}

test_doctor_app_env_prints_the_state_never_the_value() {
  local file out
  file="$(throwaway_env doctor-app-env-set "APP_ENV=$ENV_FIXTURE_SECRET")"
  out="$(app_env_doctor "$file")"
  expect_contains "$out" "failures=0 warnings=0" || return 1
  expect_contains "$out" "APP_ENV is set in .env" || return 1
  expect_not_contains "$out" "$ENV_FIXTURE_SECRET"
}

# app_env_for <exported APP_ENV, or "-" for none> <dotenv file>: the APP_ENV a dev process gets.
app_env_for() {
  (
    if [[ "$1" == "-" ]]; then unset APP_ENV; else export APP_ENV="$1"; fi
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    local_app_env "$2"
  )
}

test_local_app_env_is_exported_then_dotenv_then_local() {
  local set_file empty_file
  set_file="$(throwaway_env app-env-set 'APP_ENV=dev')"
  empty_file="$(throwaway_env app-env-empty 'APP_ENV=')"
  expect_eq "$(app_env_for staging "$set_file")" "staging" || return 1
  # Nothing exported (direnv not active): the .env value must survive, not be replaced by `local`.
  expect_eq "$(app_env_for - "$set_file")" "dev" || return 1
  expect_eq "$(app_env_for "" "$set_file")" "dev" || return 1
  # Empty everywhere, including the empty value direnv exports from an `APP_ENV=` line.
  expect_eq "$(app_env_for - "$empty_file")" "local" || return 1
  expect_eq "$(app_env_for "" "$empty_file")" "local" || return 1
  expect_eq "$(app_env_for - "$TEST_ROOT/env-app-env-set/missing.env")" "local"
}

test_dev_recipes_give_every_process_an_app_env() {
  local file api workers prefix
  file="$(throwaway_env recipe-app-env 'APP_ENV=dev')"
  expect_eq "$(env -u APP_ENV bash "$ROOT/scripts/dev-app-env.sh" "$file")" "dev" || return 1
  expect_eq "$(env APP_ENV=staging bash "$ROOT/scripts/dev-app-env.sh" "$file")" "staging" || return 1
  expect_eq "$(env -u APP_ENV bash "$ROOT/scripts/dev-app-env.sh" "$TEST_ROOT/env-recipe-app-env/missing.env")" "local" || return 1
  api="$(cd "$ROOT" && just --show dev-api)"
  workers="$(cd "$ROOT" && just --show dev-workers)"
  # shellcheck disable=SC2016 # the recipe's own text, not an expansion
  prefix='APP_ENV="$(bash scripts/dev-app-env.sh)" OTEL_SERVICE_NAME='
  expect_contains "$api" "${prefix}'api' pnpm --filter @ai-stylist/api dev" || return 1
  expect_contains "$workers" "${prefix}'jobs' pnpm --filter @ai-stylist/api run dev:jobs" || return 1
  expect_contains "$workers" "${prefix}'segmentation' uv run --project workers/ml/segmentation uvicorn"
}

# --- compose project + the local Postgres container (scripts/lib.sh, justfile) --------------------

# lib_var <NAME>: the value of one scripts/lib.sh variable.
lib_var() {
  (
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    printf '%s\n' "${!1}"
  )
}

# compose_project_for <exported COMPOSE_PROJECT_NAME, or "-" for none>: the project name as
# scripts/lib.sh (doctor) and the justfile (every recipe) resolve it: "<lib> <justfile>".
compose_project_for() {
  (
    if [[ "$1" == "-" ]]; then unset COMPOSE_PROJECT_NAME; else export COMPOSE_PROJECT_NAME="$1"; fi
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    printf '%s %s\n' "$(compose_project_name)" "$(cd "$ROOT" && just --evaluate COMPOSE_PROJECT_NAME)"
  )
}

test_compose_project_is_fixed_and_overridable() {
  local compose_name
  # Not derived from the checkout directory, so every checkout and worktree gets the same one.
  expect_eq "$(compose_project_for -)" "ai-stylist ai-stylist" || return 1
  expect_eq "$(compose_project_for "")" "ai-stylist ai-stylist" || return 1
  expect_eq "$(compose_project_for my-stack)" "my-stack my-stack" || return 1
  # docker-compose.yml is where the container name is fixed: scripts/lib.sh must name the same one.
  expect_eq "$(grep -E '^[[:space:]]+container_name:' "$ROOT/docker-compose.yml" | tr -d '[:space:]')" \
    "container_name:$(lib_var LOCAL_POSTGRES_CONTAINER)" || return 1
  # If docker-compose.yml ever gains a top-level `name:`, it must be the same project: a different
  # one would send a raw `docker compose` call and the recipes to two projects again.
  compose_name="$(grep -E '^name:' "$ROOT/docker-compose.yml" | tr -d '[:space:]' || true)"
  if [[ -n "$compose_name" ]]; then
    expect_eq "$compose_name" "name:$(lib_var COMPOSE_PROJECT_DEFAULT)"
  fi
}

# docker_stub <case> <row>: a `docker` that answers `docker container inspect` for the container
# ai-stylist-postgres the way the daemon answers scripts/lib.sh's --format template:
# "<status>|<compose project>|<data volume>|<compose working dir>". An empty <row> means the
# container does not exist. Every call is logged to <dir>/calls and anything but
# `container inspect` exits 64. Prints the stub's bin directory.
docker_stub() {
  local dir="$TEST_ROOT/docker-$1"
  mkdir -p "$dir"
  printf '%s' "$2" >"$dir/row"
  # shellcheck disable=SC2016  # the stub body expands when the stub runs, not here
  stub "$dir/bin" docker 'dir="$(cd "$(dirname "$0")/.." && pwd)"
printf "%s\n" "$*" >>"$dir/calls"
if [[ "${1:-} ${2:-}" != "container inspect" ]]; then
  echo "docker stub: unexpected call: $*" >&2
  exit 64
fi
for last; do :; done
if [[ "$last" != "ai-stylist-postgres" || ! -s "$dir/row" ]]; then
  echo "Error response from daemon: No such container: $last" >&2
  exit 1
fi
if [[ "$*" == *--format* ]]; then cat "$dir/row"; echo; fi'
  printf '%s\n' "$dir/bin"
}

# postgres_state <stub bin dir> [exported COMPOSE_PROJECT_NAME]: scripts/lib.sh local_postgres_state.
postgres_state() {
  (
    PATH="$1:$PATH"
    unset COMPOSE_PROJECT_NAME
    if [[ $# -ge 2 ]]; then export COMPOSE_PROJECT_NAME="$2"; fi
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    local_postgres_state
  )
}

# postgres_doctor <stub bin dir> [exported COMPOSE_PROJECT_NAME]: doctor's local Postgres lines,
# then "failures=N warnings=N".
postgres_doctor() {
  (
    PATH="$1:$PATH"
    unset COMPOSE_PROJECT_NAME
    if [[ $# -ge 2 ]]; then export COMPOSE_PROJECT_NAME="$2"; fi
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    doctor_local_postgres 2>&1
    echo "failures=$DOCTOR_FAILURES warnings=$DOCTOR_WARNINGS"
  )
}

FOREIGN_ROW='running|garderi-ai9|garderi-ai9_postgres-cluster|/home/dev/My Projects/garderi-ai9'

test_postgres_container_absent_is_not_a_failure() {
  local bin out
  bin="$(docker_stub absent '')"
  expect_eq "$(postgres_state "$bin")" "absent" || return 1
  out="$(postgres_doctor "$bin")"
  expect_contains "$out" "failures=0 warnings=0" || return 1
  expect_contains "$out" "no container ai-stylist-postgres yet" || return 1
  expect_contains "$out" "just dev-api creates it in compose project 'ai-stylist'"
}

test_postgres_container_of_this_project_is_ok() {
  local bin out
  bin="$(docker_stub own 'running|ai-stylist|ai-stylist_postgres-cluster|/home/dev/ai-stylist')"
  expect_eq "$(postgres_state "$bin")" "own running" || return 1
  out="$(postgres_doctor "$bin")"
  expect_contains "$out" "failures=0 warnings=0" || return 1
  expect_contains "$out" "container ai-stylist-postgres is running in compose project 'ai-stylist'" || return 1
  # Stopped is not a failure either: `just dev-api` starts it.
  bin="$(docker_stub own-stopped 'exited|ai-stylist|ai-stylist_postgres-cluster|/home/dev/ai-stylist')"
  expect_eq "$(postgres_state "$bin")" "own exited" || return 1
  out="$(postgres_doctor "$bin")"
  expect_contains "$out" "failures=0 warnings=0" || return 1
  expect_contains "$out" "is exited: just dev-api starts it"
}

test_postgres_container_of_another_project_fails_with_the_exact_fix() {
  local bin out
  bin="$(docker_stub foreign "$FOREIGN_ROW")"
  expect_eq "$(postgres_state "$bin")" "foreign $FOREIGN_ROW" || return 1
  out="$(postgres_doctor "$bin")"
  expect_contains "$out" "failures=1 warnings=0" || return 1
  expect_contains "$out" "container ai-stylist-postgres (running) belongs to compose project 'garderi-ai9' (started from /home/dev/My Projects/garderi-ai9)" || return 1
  expect_contains "$out" "this checkout uses compose project 'ai-stylist'" || return 1
  expect_contains "$out" "docker stop ai-stylist-postgres && docker rm ai-stylist-postgres" || return 1
  expect_contains "$out" "its data stays in volume garderi-ai9_postgres-cluster" || return 1
  expect_contains "$out" "just dev-api" || return 1
  expect_contains "$out" "just db-migrate && just db-seed" || return 1
  expect_contains "$out" "docker volume rm garderi-ai9_postgres-cluster" || return 1
  expect_contains "$out" "export COMPOSE_PROJECT_NAME=garderi-ai9" || return 1
  # A stopped container blocks the name just the same.
  bin="$(docker_stub foreign-stopped "exited|garderi|garderi_postgres-cluster|/home/dev/garderi")"
  out="$(postgres_doctor "$bin")"
  expect_contains "$out" "failures=1 warnings=0" || return 1
  expect_contains "$out" "container ai-stylist-postgres (exited) belongs to compose project 'garderi'"
}

test_postgres_container_follows_the_project_override() {
  local bin out
  # The alternative the failure offers: with that project exported, the container is this checkout's.
  bin="$(docker_stub override "$FOREIGN_ROW")"
  expect_eq "$(postgres_state "$bin" garderi-ai9)" "own running" || return 1
  out="$(postgres_doctor "$bin" garderi-ai9)"
  expect_contains "$out" "failures=0 warnings=0" || return 1
  expect_contains "$out" "is running in compose project 'garderi-ai9'" || return 1
  # An override that does not own the container fails too, and the way back is to drop it.
  bin="$(docker_stub override-foreign 'running|ai-stylist|ai-stylist_postgres-cluster|/home/dev/ai-stylist')"
  out="$(postgres_doctor "$bin" my-stack)"
  expect_contains "$out" "failures=1 warnings=0" || return 1
  expect_contains "$out" "this checkout uses compose project 'my-stack'" || return 1
  expect_contains "$out" "unset COMPOSE_PROJECT_NAME"
}

test_postgres_container_not_made_by_compose_fails_without_a_project_hint() {
  local bin out
  bin="$(docker_stub plain 'exited|||')"
  expect_eq "$(postgres_state "$bin")" "foreign exited|||" || return 1
  out="$(postgres_doctor "$bin")"
  expect_contains "$out" "failures=1 warnings=0" || return 1
  expect_contains "$out" "was not created by docker compose" || return 1
  expect_contains "$out" "docker stop ai-stylist-postgres && docker rm ai-stylist-postgres" || return 1
  expect_not_contains "$out" "COMPOSE_PROJECT_NAME=" || return 1
  expect_not_contains "$out" "docker volume rm"
}

test_postgres_container_docker_cannot_describe_is_a_warning() {
  local bin out
  # Anything but the four fields (an error text, a template docker rejects) is never read as "absent".
  bin="$(docker_stub unknown 'template parsing error')"
  expect_eq "$(postgres_state "$bin")" "unknown" || return 1
  out="$(postgres_doctor "$bin")"
  expect_contains "$out" "failures=0 warnings=1" || return 1
  expect_contains "$out" "docker container inspect ai-stylist-postgres"
}

test_postgres_check_only_inspects() {
  local bin
  bin="$(docker_stub read-only "$FOREIGN_ROW")"
  postgres_doctor "$bin" >/dev/null
  postgres_state "$bin" >/dev/null
  [[ -s "$bin/../calls" ]] || { echo "  the docker stub was never called" >&2; return 1; }
  if grep -qv '^container inspect ' "$bin/../calls"; then
    echo "  doctor ran something other than 'docker container inspect':" >&2
    grep -v '^container inspect ' "$bin/../calls" >&2
    return 1
  fi
}

# bootstrap.sh and doctor.sh are not run here (they install tools and read the real machine), so
# this only proves they call the steps the cases above cover.
test_bootstrap_and_doctor_call_the_covered_steps() {
  grep -qE '^env_file_fill_local_defaults$' "$ROOT/scripts/bootstrap.sh" || { echo "  bootstrap.sh does not call env_file_fill_local_defaults" >&2; return 1; }
  grep -qE '^[[:space:]]+doctor_app_env$' "$ROOT/scripts/doctor.sh" || { echo "  doctor.sh does not call doctor_app_env" >&2; return 1; }
  grep -qE '^[[:space:]]+doctor_local_postgres$' "$ROOT/scripts/doctor.sh" || { echo "  doctor.sh does not call doctor_local_postgres" >&2; return 1; }
}

run_test "xcode: installed, command line tools selected -> unselected" test_xcode_installed_but_command_line_tools_selected
run_test "xcode: pinned version active -> ok" test_xcode_pinned_version_active
run_test "xcode: other version active, pinned installed -> unselected" test_xcode_other_version_active_pinned_installed
run_test "xcode: other version active, pinned missing -> other" test_xcode_other_version_active_pinned_missing
run_test "xcode: only another version installed, none usable -> missing" test_xcode_missing
run_test "xcode: nothing installed -> missing" test_xcode_missing_empty_applications
run_test "ios-doctor: unusable xcodebuild prints the fix, not only Apple's error" test_ios_doctor_names_the_fix_when_xcode_is_not_selected
run_test "rc file: zsh (ZDOTDIR honoured)" test_rc_file_zsh
run_test "rc file: bash (Linux .bashrc, macOS .bash_profile)" test_rc_file_bash
run_test "rc file: unsupported shell" test_rc_file_unsupported_shell
run_test "rc block: created when the rc file is missing" test_block_created_in_missing_rc
run_test "rc block: replaced in place, never duplicated" test_block_replaced_in_place_and_never_duplicated
run_test "rc block: a symlinked rc file stays a symlink" test_block_keeps_a_symlinked_rc_a_symlink
run_test ".env: env_file_value reads like dotenv (export, quotes, CRLF, last wins, missing)" test_env_file_value_reads_like_dotenv
run_test ".env: env_file_value_kind names the form (plain, empty, comment, quote, padding, escape, control), never a value" test_env_file_value_kind_names_the_form_never_the_value
run_test ".env: env_file_key_states prints set/empty/absent, never a value" test_env_file_key_states_names_state_never_value
run_test ".env: env_file_key_states without a file -> absent" test_env_file_key_states_without_file
run_test ".env fill: an empty key is set in place, the file keeps its mode" test_fill_empty_sets_an_empty_key_in_place
run_test ".env fill: a key that has a value is never changed" test_fill_empty_never_changes_a_value
run_test ".env fill: a missing key is appended, duplicates collapse, the value is written literally" test_fill_empty_appends_dedupes_and_writes_literally
run_test "bootstrap .env: an empty DATABASE_URL and an empty APP_ENV are filled, nothing else, idempotent" test_bootstrap_fills_database_url_and_app_env
run_test "bootstrap .env: set values stay, DATABASE_URL follows POSTGRES_HOST_PORT" test_bootstrap_keeps_set_values_and_follows_the_host_port
run_test "doctor: an empty APP_ENV is a warning that names the fix, and the fix clears it" test_doctor_reports_an_empty_app_env_with_the_fix
run_test "doctor: APP_ENV is reported as set or empty, never its value" test_doctor_app_env_prints_the_state_never_the_value
run_test "dev APP_ENV: exported value, else the .env value, else local" test_local_app_env_is_exported_then_dotenv_then_local
run_test "just dev-api / dev-workers pass that APP_ENV to api, jobs and segmentation" test_dev_recipes_give_every_process_an_app_env
run_test "compose project: ai-stylist in scripts/lib.sh and the justfile, COMPOSE_PROJECT_NAME overrides both; container name as in docker-compose.yml" test_compose_project_is_fixed_and_overridable
run_test "doctor postgres: no container yet -> informational" test_postgres_container_absent_is_not_a_failure
run_test "doctor postgres: container of this compose project -> ok (running) or informational (stopped)" test_postgres_container_of_this_project_is_ok
run_test "doctor postgres: container of another compose project -> failure with the exact commands" test_postgres_container_of_another_project_fails_with_the_exact_fix
run_test "doctor postgres: COMPOSE_PROJECT_NAME decides which project is this checkout's" test_postgres_container_follows_the_project_override
run_test "doctor postgres: container not created by compose -> failure, no project hint" test_postgres_container_not_made_by_compose_fails_without_a_project_hint
run_test "doctor postgres: a container docker cannot describe -> warning, never read as absent" test_postgres_container_docker_cannot_describe_is_a_warning
run_test "doctor postgres: only ever runs docker container inspect" test_postgres_check_only_inspects
run_test "bootstrap.sh and doctor.sh call the steps covered above" test_bootstrap_and_doctor_call_the_covered_steps

if ((failures > 0)); then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "all tests passed"
