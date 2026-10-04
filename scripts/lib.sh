#!/usr/bin/env bash
# Shared helpers for scripts/*.sh (planning/15 §4). Source, do not execute.
#   source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# shellcheck disable=SC2034
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# mise: an explicit MISE_BIN wins; else the mise.run install location; else a mise already on PATH
# (an OS package such as /usr/bin/mise). With none of them present, MISE_BIN stays at the mise.run
# location, which is where bootstrap installs it.
if [[ -z "${MISE_BIN:-}" ]]; then
  MISE_BIN="$HOME/.local/bin/mise"
  if [[ ! -x "$MISE_BIN" ]]; then
    _lib_mise_on_path="$(command -v mise 2>/dev/null || true)"
    [[ "$_lib_mise_on_path" == /* && -x "$_lib_mise_on_path" ]] && MISE_BIN="$_lib_mise_on_path"
    unset _lib_mise_on_path
  fi
fi

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
else
  C_RESET=''; C_BOLD=''; C_DIM=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''
fi

log()      { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
info()     { printf '    %s\n' "$*"; }
warn()     { printf '%s!!%s  %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
error()    { printf '%sERROR%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
die()      { error "$@"; exit 1; }
heading()  { printf '\n%s%s%s\n' "$C_BOLD" "$*" "$C_RESET"; }

# Doctor-style check lines: one per check, ✔ / ✘ / ⚠ plus a fix hint.
DOCTOR_FAILURES=0
DOCTOR_WARNINGS=0
ok()       { printf '%s✔%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
fail()     { DOCTOR_FAILURES=$((DOCTOR_FAILURES + 1)); printf '%s✘%s %s\n' "$C_RED" "$C_RESET" "$1"; [[ -n "${2:-}" ]] && printf '    %sfix:%s %s\n' "$C_DIM" "$C_RESET" "$2"; return 0; }
warnc()    { DOCTOR_WARNINGS=$((DOCTOR_WARNINGS + 1)); printf '%s⚠%s %s\n' "$C_YELLOW" "$C_RESET" "$1"; [[ -n "${2:-}" ]] && printf '    %shint:%s %s\n' "$C_DIM" "$C_RESET" "$2"; return 0; }
# Informational doctor line: never counted as a failure or a warning.
note()     { printf '%sℹ%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }

have()     { command -v "$1" >/dev/null 2>&1; }

# --- dotenv files (.env) -------------------------------------------------------------------------

# The awk that both readers below start with, so they cannot disagree about what a line holds. For
# the key in `key` it keeps the last assignment of the file (as dotenv does), without an `export `
# prefix and a trailing CR. env_parse(), called from an END block, then strips trailing whitespace
# and one pair of matching quotes from `val` and leaves that quote character in `quote` ("" when
# the value was not quoted). `q` is a single quote.
# shellcheck disable=SC2016  # awk source: $0 is awk's own field reference, the shell must not expand it
ENV_FILE_READ_AWK='
    { line = $0; sub(/\r$/, "", line); sub(/^export[[:space:]]+/, "", line) }
    index(line, key "=") == 1 { val = substr(line, length(key) + 2) }
    function env_parse(    first) {
      sub(/[[:space:]]+$/, "", val)
      first = substr(val, 1, 1); quote = ""
      if (length(val) >= 2 && (first == "\"" || first == q) && substr(val, length(val), 1) == first) {
        quote = first; val = substr(val, 2, length(val) - 2)
      }
    }'

# The value of KEY $1 in dotenv file $2 (default .env): the last assignment wins, as in dotenv; an
# `export ` prefix, a trailing CR and one pair of matching quotes are stripped. Empty when the key
# or the file is absent.
env_file_value() {
  local file="${2:-.env}"
  [[ -f "$file" ]] || return 0
  awk -v key="$1" -v q="'" "$ENV_FILE_READ_AWK"'
    END { env_parse(); print val }' "$file"
}

# How the value of KEY $1 is written in dotenv file $2 (default .env): one word, never the value.
#   empty    no value (also: no such key, no such file)
#   plain    env_file_value returns it, and a bare KEY=value line would give the same value back
# Every other word names why the text on the line is not the value everywhere. dotenv parsers need
# not agree on these forms, and `just secrets-sync` writes a value back as a bare KEY=value line,
# without quotes, so the quotes that made such a value readable are gone after one round trip:
#   comment  a `#` at the start of the value or after whitespace: an inline comment when the value
#            is not quoted, and one again once the quotes around it are gone
#   quote    the value still starts with a quote character: the quote does not close at the end of
#            the line (text or a comment follows it), or the quotes hold quotes
#   padding  whitespace at the start of the value, or at either end inside its quotes
#   escape   a backslash inside double quotes: a parser may expand an escape such as \n there, and
#            the bare line written back is not quoted
#   control  a control character (a tab counts)
# `just secrets-push` copies `plain` values only (scripts/security/secrets-push.sh).
env_file_value_kind() {
  local file="${2:-.env}"
  if [[ ! -f "$file" ]]; then
    echo empty
    return 0
  fi
  LC_ALL=C awk -v key="$1" -v q="'" "$ENV_FILE_READ_AWK"'
    END {
      env_parse()
      first = substr(val, 1, 1)
      if (val == "") print "empty"
      else if (val ~ /[[:cntrl:]]/) print "control"
      else if (first == "\"" || first == q) print "quote"
      else if (val ~ /^[[:space:]]/ || val ~ /[[:space:]]$/) print "padding"
      else if (val ~ /^#/ || val ~ /[[:space:]]#/) print "comment"
      else if (quote == "\"" && index(val, "\\") > 0) print "escape"
      else print "plain"
    }' "$file"
}

# Whether each KEY in dotenv file $1 has a value, never the value itself: prints
# "KEY1 set, KEY2 empty, KEY3 absent" (absent = no KEY= line, or no file).
#   env_file_key_states .env OTEL_EXPORTER_OTLP_ENDPOINT OTEL_EXPORTER_OTLP_HEADERS
env_file_key_states() {
  local file="$1" key state out=""
  shift
  for key in "$@"; do
    if [[ ! -f "$file" ]] || ! command grep -qE "^(export[[:space:]]+)?${key}=" "$file"; then
      state='absent'
    elif [[ -n "$(env_file_value "$key" "$file")" ]]; then
      state='set'
    else
      state='empty'
    fi
    out="${out:+$out, }$key $state"
  done
  printf '%s\n' "$out"
}

# Give KEY $1 the value $2 in dotenv file $3 (default .env) when the key has no value there: the
# first KEY= line (an `export ` prefix allowed) becomes KEY=value in place, any later KEY= line is
# dropped, and a key the file lacks is appended. Returns 0 after writing. Returns 1 and leaves the
# file untouched when the key already has a value (hand-set or synced) or the file is missing.
# The file is rewritten through its path, so it keeps its mode (`just secrets-sync` makes .env 0600).
env_file_fill_empty() {
  local key="$1" value="$2" file="${3:-.env}" tmp
  [[ -f "$file" ]] || return 1
  [[ -z "$(env_file_value "$key" "$file")" ]] || return 1
  tmp="$(mktemp)"
  # The value travels through the environment: `awk -v` would expand backslash escapes in it.
  if ! ENV_FILE_FILL_VALUE="$value" awk -v key="$key" '
    { line = $0; sub(/^export[[:space:]]+/, "", line) }
    index(line, key "=") == 1 { if (!done) print key "=" ENVIRON["ENV_FILE_FILL_VALUE"]; done = 1; next }
    { print }
    END { if (!done) print key "=" ENVIRON["ENV_FILE_FILL_VALUE"] }' "$file" >"$tmp"; then
    rm -f "$tmp"
    error "could not rewrite $file to set $key"
    return 1
  fi
  cat "$tmp" >"$file"
  rm -f "$tmp"
}

# APP_ENV on a developer machine. The API's config defaults an empty APP_ENV to this name, but
# telemetry start-up reads the raw environment, so an empty value leaves the resource attribute
# deployment.environment.name off every span, metric and log. The Grafana dashboard filters by that
# label and the DLQ alert groups by it and names the environment with it. Bootstrap, doctor and the
# dev recipes all use this one name.
APP_ENV_LOCAL='local'

# The .env step of bootstrap.sh for dotenv file $1 (default .env): the two keys a developer machine
# cannot leave empty are filled, each only when it is empty. A value that is already there
# (hand-set or synced) is never touched, and `just secrets-sync` skips keys whose shared value is
# empty, so it does not blank either one again.
#   DATABASE_URL  the docker-compose Postgres documented in .env.example (.env.example keeps every
#                 value empty, but the API cannot reach a database without one), on the host port
#                 compose resolves: POSTGRES_HOST_PORT from the environment, else from the file,
#                 else 5432
#   APP_ENV       APP_ENV_LOCAL
env_file_fill_local_defaults() {
  local file="${1:-.env}" pg_port
  if [[ -n "${POSTGRES_HOST_PORT+set}" ]]; then pg_port="$POSTGRES_HOST_PORT"; else pg_port="$(env_file_value POSTGRES_HOST_PORT "$file")"; fi
  pg_port="${pg_port:-5432}"
  if env_file_fill_empty DATABASE_URL "postgres://ai_stylist:ai_stylist@localhost:${pg_port}/ai_stylist" "$file"; then
    info "DATABASE_URL was empty — set it to the local docker-compose Postgres (localhost:$pg_port)"
  fi
  if env_file_fill_empty APP_ENV "$APP_ENV_LOCAL" "$file"; then
    info "APP_ENV was empty — set it to $APP_ENV_LOCAL (telemetry reports it as deployment.environment.name)"
  fi
}

# The APP_ENV a local dev process starts with: the exported value when it is not empty, else the
# value in dotenv file $1 (default .env), else APP_ENV_LOCAL. `just dev-api` and `just dev-workers`
# put it on each process's command line (scripts/dev-app-env.sh). They cannot simply export
# `local` when nothing is exported: Node's --env-file-if-exists and uvicorn's --env-file never
# override an exported variable, so that would hide the value .env sets whenever direnv is not active.
local_app_env() {
  local value="${APP_ENV:-}"
  [[ -n "$value" ]] || value="$(env_file_value APP_ENV "${1:-.env}")"
  printf '%s\n' "${value:-$APP_ENV_LOCAL}"
}

# Doctor: APP_ENV in dotenv file $1 (default .env). Prints whether it is set, never its value.
doctor_app_env() {
  if [[ -n "$(env_file_value APP_ENV "${1:-.env}")" ]]; then
    ok "APP_ENV is set in .env (telemetry reports it as deployment.environment.name)"
  else
    warnc "APP_ENV is empty in .env: a process started outside just dev-api / just dev-workers then sends telemetry without deployment.environment.name, the label the Grafana dashboard filters by and the DLQ alert names its environment with" \
      "just bootstrap   (fills an empty APP_ENV with '$APP_ENV_LOCAL', never changes a value that is set); or write APP_ENV=$APP_ENV_LOCAL into .env"
  fi
}

# Run a tool through mise without requiring shell activation.
mise_exec() { "$MISE_BIN" exec -- "$@"; }

# --- portability (Linux + macOS; scripts stay bash 3.2-clean because macOS /bin/bash is 3.2) ----
OS_NAME="$(uname -s)"
os_is_darwin() { [[ "$OS_NAME" == "Darwin" ]]; }

# In-place sed that works with GNU sed (-i takes an optional suffix) and BSD sed (-i needs one).
#   sed_inplace 's/a/b/' file...
sed_inplace() {
  if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi
}

# Free space of the filesystem holding $1 (default: cwd) in whole GiB. POSIX `df -Pk` parses the
# same on both OSes; GNU-only `df -BG --output=avail` does not exist on macOS.
disk_free_gb() {
  df -Pk "${1:-.}" | awk 'NR == 2 { printf "%d\n", $4 / 1048576 }'
}

# Which Docker runtime provides `docker` on macOS: the active docker context first (a machine can
# have several installed), then installed apps. Prints desktop | orbstack | colima | none.
darwin_docker_runtime() {
  local ctx
  ctx="$(docker context show 2>/dev/null || true)"
  case "$ctx" in
    orbstack) echo orbstack; return ;;
    colima*) echo colima; return ;;
    desktop-linux) echo desktop; return ;;
  esac
  if [[ -d /Applications/OrbStack.app ]] || have orbctl; then echo orbstack
  elif [[ -d /Applications/Docker.app ]]; then echo desktop
  elif have colima; then echo colima
  else echo none
  fi
}

# --- local compose stack (docker-compose.yml: the Postgres that just dev-api / dev-workers start) --

# docker-compose.yml fixes the container name, so on one machine exactly one compose project can
# own that container. Compose names a project after the checkout directory by default, which made
# every second checkout or worktree stop with "container name already in use". The justfile
# therefore exports COMPOSE_PROJECT_NAME for every recipe, with this default
# (scripts/test/bootstrap-doctor.test.sh keeps the two in step); a COMPOSE_PROJECT_NAME that is
# already exported and not empty wins, there and here.
COMPOSE_PROJECT_DEFAULT='ai-stylist'
LOCAL_POSTGRES_CONTAINER='ai-stylist-postgres'

# The compose project this checkout's recipes use.
compose_project_name() { printf '%s\n' "${COMPOSE_PROJECT_NAME:-$COMPOSE_PROJECT_DEFAULT}"; }

# Who owns the local Postgres container, read with `docker container inspect` only (call it when
# the daemon is reachable). Prints one line:
#   absent           no container of that name
#   own <status>     it belongs to the compose project of compose_project_name
#   foreign <status>|<project>|<volume>|<working dir>
#                    it belongs to another compose project, or to none (<project> empty: it was not
#                    created by compose). <volume> is the named volume mounted at /var/lib/postgresql
#                    (empty when there is none), <working dir> the checkout it was started from.
#   unknown          the container exists but docker could not describe it
# <status> is docker's State.Status: running, exited, created, paused, restarting or dead.
local_postgres_state() {
  local row status project
  if ! docker container inspect "$LOCAL_POSTGRES_CONTAINER" >/dev/null 2>&1; then
    echo absent
    return 0
  fi
  if ! row="$(docker container inspect --format \
    '{{.State.Status}}|{{index .Config.Labels "com.docker.compose.project"}}|{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql"}}{{.Name}}{{end}}{{end}}|{{index .Config.Labels "com.docker.compose.project.working_dir"}}' \
    "$LOCAL_POSTGRES_CONTAINER" 2>/dev/null)" || [[ "$row" != *'|'*'|'*'|'* ]]; then
    echo unknown
    return 0
  fi
  IFS='|' read -r status project _ <<< "$row"
  if [[ -n "$project" && "$project" == "$(compose_project_name)" ]]; then
    echo "own $status"
  else
    echo "foreign $row"
  fi
}

# Doctor: the local Postgres container and the compose project that owns it. A container of
# another project (running or stopped) is the one case in which just dev-api and just dev-workers
# cannot start Postgres; the failure prints the commands that fix it and says what happens to the
# data. Nothing here stops, removes or creates anything.
doctor_local_postgres() {
  local c="$LOCAL_POSTGRES_CONTAINER" expected state status project volume workdir owner kept
  expected="$(compose_project_name)"
  state="$(local_postgres_state)"
  case "$state" in
    absent)
      note "local Postgres: no container $c yet (just dev-api creates it in compose project '$expected')"
      ;;
    own\ running)
      ok "local Postgres: container $c is running in compose project '$expected'"
      ;;
    own\ *)
      note "local Postgres: container $c (compose project '$expected') is ${state#own }: just dev-api starts it"
      ;;
    foreign\ *)
      IFS='|' read -r status project volume workdir <<< "${state#foreign }"
      if [[ -n "$project" ]]; then
        owner="belongs to compose project '$project'${workdir:+ (started from $workdir)}"
      else
        owner="was not created by docker compose"
      fi
      if [[ -n "$volume" ]]; then
        kept="its data stays in volume $volume, which nothing uses any more"
      else
        kept="any data volume it used is kept"
      fi
      fail "local Postgres: container $c ($status) $owner, but this checkout uses compose project '$expected': just dev-api and just dev-workers stop with \"container name already in use\"" \
        "run once:   docker stop $c && docker rm $c   (removes the container only; $kept)"
      info "     then:       just dev-api   (creates $c again in compose project '$expected', with a new and empty database)"
      info "     then:       just db-migrate && just db-seed   (second terminal: the schema and the synthetic seed data; rows that only the old database had are not copied)"
      if [[ -n "$volume" ]]; then
        info "     later:      docker volume rm $volume   (deletes the old database for good, once nothing in it is needed)"
      fi
      if [[ -n "$project" && "$project" == "$COMPOSE_PROJECT_DEFAULT" ]]; then
        info "     or instead: unset COMPOSE_PROJECT_NAME   ('$project' is the default project; your override '$expected' is what does not match)"
      elif [[ -n "$project" ]]; then
        info "     or instead: export COMPOSE_PROJECT_NAME=$project in your shell rc file   (keeps this container and its data; every checkout then uses that project)"
      fi
      ;;
    *)
      warnc "local Postgres: container $c exists, but docker container inspect could not describe it" "docker container inspect $c"
      ;;
  esac
}

# --- Xcode (macOS; apps/ios/.xcode-version pins the version) ---------------------------------------

# The installed Xcode bundle whose CFBundleShortVersionString is $1, searched as
# ${XCODES_DIRECTORY:-/Applications}/Xcode*.app: the App Store installs Xcode.app, xcodes installs
# Xcode-<version>.app (honouring the same XCODES_DIRECTORY), GitHub runners ship Xcode_<version>.app.
# Prints the path; returns 1 when no bundle matches.
darwin_xcode_app() {
  local app
  for app in "${XCODES_DIRECTORY:-/Applications}"/Xcode*.app; do
    [[ -f "$app/Contents/Info.plist" ]] || continue
    if [[ "$(plutil -extract CFBundleShortVersionString raw -o - "$app/Contents/Info.plist" 2>/dev/null)" == "$1" ]]; then
      printf '%s\n' "$app"
      return 0
    fi
  done
  return 1
}

# How the Xcode that xcodebuild runs compares with the pinned version $1. Prints one of:
#   ok                 xcodebuild runs the pinned version
#   unselected <app>   the pinned Xcode is installed at <app>, but xcodebuild does not run it: the
#                      Command Line Tools or another Xcode is selected, or its licence / first-launch
#                      setup is pending (/usr/bin/xcodebuild exists even with only the CLT)
#   other <version>    xcodebuild runs another version and the pinned one is not installed
#   missing            no usable Xcode and the pinned one is not installed
darwin_xcode_state() {
  local active app
  active="$(xcodebuild -version 2>/dev/null | awk 'NR == 1 { print $2 }' || true)"
  if [[ "$active" == "$1" ]]; then
    echo ok
  elif app="$(darwin_xcode_app "$1")"; then
    echo "unselected $app"
  elif [[ -n "$active" ]]; then
    echo "other $active"
  else
    echo missing
  fi
}

# --- shell activation (bootstrap writes it; doctor points at it) ----------------------------------
SHELL_RC_BEGIN='# >>> ai-stylist: mise + direnv (managed by scripts/bootstrap.sh) >>>'
SHELL_RC_END='# <<< ai-stylist <<<'

# The rc file an interactive shell of the user's login shell ($SHELL) reads: zsh ->
# ${ZDOTDIR:-$HOME}/.zshrc; bash -> ~/.bash_profile on macOS (Terminal opens login shells) and
# ~/.bashrc on Linux. Returns 1 for any other shell.
shell_rc_file() {
  case "$(basename "${SHELL:-}")" in
    zsh) printf '%s\n' "${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) if os_is_darwin; then printf '%s\n' "$HOME/.bash_profile"; else printf '%s\n' "$HOME/.bashrc"; fi ;;
    *) return 1 ;;
  esac
}

# Writes the managed block into rc file $1 for shell $2 (zsh | bash): activate mise, then hook
# direnv $3 (the version mise.toml pins). direnv is pinned only in this repo, so the hook runs it
# through `mise exec direnv@<version>`, which works from any directory; the hook it prints calls
# that binary by absolute path. Re-running replaces the block in place (one block, the user's
# lines untouched); writing through the path keeps a symlinked rc file a symlink.
shell_activation_write() {
  local rc="$1" shell="$2" direnv_version="$3" block tmp
  block="$(mktemp)"
  tmp="$(mktemp)"
  # shellcheck disable=SC2016  # the $(...) is for the rc file, expanded when the shell starts
  printf '%s\neval "$(%s activate %s)"\neval "$(%s exec direnv@%s -- direnv hook %s)"\n%s\n' \
    "$SHELL_RC_BEGIN" "$MISE_BIN" "$shell" "$MISE_BIN" "$direnv_version" "$shell" "$SHELL_RC_END" >"$block"
  [[ -f "$rc" ]] || : >"$rc"
  awk -v begin="$SHELL_RC_BEGIN" -v end="$SHELL_RC_END" -v block="$block" '
    function emit(  line) { while ((getline line < block) > 0) print line; close(block); done = 1 }
    $0 == begin { if (!done) emit(); skip = 1; next }
    skip { if ($0 == end) skip = 0; next }
    { print }
    END { if (!done) emit() }' "$rc" >"$tmp"
  cat "$tmp" >"$rc"
  rm -f "$block" "$tmp"
}
