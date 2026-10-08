#!/usr/bin/env bash
# just dev — run the whole app locally with one command: dependencies, database, API, workers and
# the native apps this machine can run (planning/15 §5).
#
#   just dev [up] [backend|android|ios|all ...] [options]
#   just dev down [--keep-db] [--keep-devices]
#   just dev status
#   just dev logs [api|workers|emulator ...]
#
# What `up` runs (all = backend + android, plus ios on macOS; android or ios alone still start the
# backend unless --no-backend, since the apps call it):
#   backend  Postgres from docker-compose.yml (Docker Engine on Linux, OrbStack on macOS), the
#            migrations, then `just dev-api` (:3000, or API_PORT) and `just dev-workers` (pg-boss jobs +
#            segmentation worker on :8001) in the background, logs in artifacts/dev/logs/
#   android  the Dev build on a running emulator, else the connected phone, else the AVD it creates
#            and boots (apps/android/tools/device.sh run); Linux and macOS
#   ios      the Dev build on an iPhone simulator (apps/ios/scripts/xcode.sh run); macOS only
# Options for up:
#   -d, --detach         start everything and return (default: follow the API and worker logs until
#                        Ctrl-C, which stops the API and workers this run started)
#   --seed               load the synthetic seed data after the migrations (adds rows on every run)
#   --no-workers         API only: no pg-boss jobs process and no segmentation worker
#   --no-backend         launch the apps only (an API that is already running is used as it is)
#   --no-setup           skip the dependency and toolchain checks (a fast re-run)
#   --android-serial S   the adb device for android (default: see above)
#   --ios-simulator UDID the simulator for ios (default: first iPhone on the newest iOS 26+ runtime)
#   -y, --yes            answer yes to every setup question (bootstrap --system: OrbStack, Docker Engine, Xcode)
#   -n, --dry-run        print the plan for this machine and change nothing
# down stops what `up` started: the API and workers, the emulator or simulator it booted, and the
# Postgres container (`docker compose stop`; the data volume is kept). --keep-db / --keep-devices
# leave those running.
#
# Setup does only what is missing or stale: ./scripts/bootstrap.sh when mise is absent; `mise install`
# for new pins; `pnpm install` / `uv sync` when a lockfile is newer than the last install; .env from
# .env.example with the local DATABASE_URL and APP_ENV; the container runtime; the Android SDK
# packages; Xcode through ./scripts/bootstrap.sh --system (asks first). A running API or worker is
# reused, never started twice. Also runs before `just` exists: ./scripts/dev.sh.
# bash 3.2-compatible (macOS /bin/bash).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$REPO_ROOT"

STATE_DIR="$REPO_ROOT/artifacts/dev"
LOG_DIR="$STATE_DIR/logs"
WORKER_PORT=8001
ANDROID_TOOL="apps/android/tools/device.sh"
IOS_TOOL="apps/ios/scripts/xcode.sh"
# docker compose outside a recipe: the same project name the justfile exports (scripts/lib.sh).
COMPOSE_PROJECT_NAME="$(compose_project_name)"
export COMPOSE_PROJECT_NAME

usage() { sed -n '2,38p' "$0"; }

# --- options ----------------------------------------------------------------------------------

DETACH=0
SEED=0
WORKERS=1
BACKEND=1
SETUP=1
YES=0
DRY_RUN=0
ANDROID_SERIAL_OPT=""
IOS_SIMULATOR_OPT=""
WANT_ANDROID=0
WANT_IOS=0
EXPLICIT_IOS=0

# Services this run started (stopped again by Ctrl-C in the foreground); results for the summary.
STARTED=()
RESULTS=()
FAILED=0

parse_up_args() {
  local any_target=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      all) any_target=1; WANT_ANDROID=1; WANT_IOS=1 ;;
      backend) any_target=1 ;;
      android) any_target=1; WANT_ANDROID=1 ;;
      ios) any_target=1; WANT_IOS=1; EXPLICIT_IOS=1 ;;
      -d | --detach) DETACH=1 ;;
      --seed) SEED=1 ;;
      --no-workers) WORKERS=0 ;;
      --no-backend) BACKEND=0 ;;
      --no-setup) SETUP=0 ;;
      -y | --yes) YES=1 ;;
      -n | --dry-run) DRY_RUN=1 ;;
      --android-serial)
        [[ $# -ge 2 ]] || die "--android-serial needs a value"
        ANDROID_SERIAL_OPT="$2"
        shift
        ;;
      --ios-simulator)
        [[ $# -ge 2 ]] || die "--ios-simulator needs a value"
        IOS_SIMULATOR_OPT="$2"
        shift
        ;;
      -h | --help) usage; exit 0 ;;
      *) error "unknown argument '$1'"; usage >&2; exit 2 ;;
    esac
    shift
  done
  if ((any_target == 0)); then
    WANT_ANDROID=1
    WANT_IOS=1
  fi
  if ((WANT_IOS)) && ! os_is_darwin; then
    if ((EXPLICIT_IOS)); then
      die "ios needs macOS with Xcode (this is $OS_NAME). Here you can run: just dev android"
    fi
    WANT_IOS=0
  fi
  if ((BACKEND == 0 && WANT_ANDROID == 0 && WANT_IOS == 0)); then
    die "nothing to do: --no-backend with no app target"
  fi
}

# --- small helpers ----------------------------------------------------------------------------

rel() { printf '%s' "${1#"$REPO_ROOT"/}"; }

# Ask $1; yes with --yes, no without a terminal to ask on.
confirm() {
  local answer
  if ((YES)); then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    warn "$1 (no terminal to ask on: re-run with --yes to agree)"
    return 1
  fi
  read -r -p "$1 [Y/n] " answer || return 1
  case "$answer" in "" | [Yy] | [Yy][Ee][Ss]) return 0 ;; *) return 1 ;; esac
}

# The port the API listens on, as apps/api/src/config.ts picks it: API_PORT, else PORT, else
# 3000, each from the environment first, then from .env (Node's --env-file never overrides).
api_port() {
  local port="${API_PORT:-}"
  [[ -n "$port" ]] || port="$(env_file_value API_PORT)"
  [[ -n "$port" ]] || port="${PORT:-}"
  [[ -n "$port" ]] || port="$(env_file_value PORT)"
  printf '%s\n' "${port:-3000}"
}

# HTTP status of GET $1, or 000 when nothing answers.
http_code() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$1" 2>/dev/null || true
}
http_up() { [[ "$(http_code "$1")" != "000" ]]; }

# Whether something accepts TCP connections on localhost:$1.
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

pid_file() { printf '%s/%s.pid' "$STATE_DIR" "$1"; }
pid_alive() {
  local pid
  [[ -f "$(pid_file "$1")" ]] || return 1
  pid="$(cat "$(pid_file "$1")")"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

result_ok() { RESULTS+=("${C_GREEN}✔${C_RESET} $*"); }
result_fail() {
  RESULTS+=("${C_RED}✘${C_RESET} $*")
  FAILED=1
}

# --- plan -------------------------------------------------------------------------------------

print_plan() {
  local port runtime
  port="$(api_port)"
  if os_is_darwin; then runtime="OrbStack"; else runtime="Docker Engine"; fi
  heading "just dev on $OS_NAME ($(uname -m))"
  if ((SETUP)); then
    info "setup     mise + pinned tools, pnpm/uv dependencies when their lockfiles changed, .env"
    ((BACKEND == 0)) || info "          container runtime: $runtime"
    ((WANT_ANDROID == 0)) || info "          Android SDK packages (user-level); emulator + system image when no device is online"
    ((WANT_IOS == 0)) || info "          Xcode pinned in apps/ios/.xcode-version (bootstrap --system sets it up, after asking)"
  else
    info "setup     skipped (--no-setup)"
  fi
  if ((BACKEND)); then
    info "backend   Postgres (docker compose, project $COMPOSE_PROJECT_NAME) -> migrations$( ((SEED)) && printf ' -> seed data')"
    info "          API http://localhost:$port (just dev-api)"
    if ((WORKERS)); then
      info "          jobs + segmentation worker http://localhost:$WORKER_PORT (just dev-workers)"
    else
      info "          workers skipped (--no-workers)"
    fi
  else
    info "backend   skipped (--no-backend)"
  fi
  if ((WANT_ANDROID)); then
    info "android   Dev build -> ${ANDROID_SERIAL_OPT:-a running emulator, else the connected phone, else the AVD it boots}"
  fi
  if ((WANT_IOS)); then
    info "ios       Dev build -> iPhone simulator ${IOS_SIMULATOR_OPT:-(first iPhone on the newest iOS 26+ runtime)}"
  elif ! os_is_darwin; then
    info "ios       not on $OS_NAME (needs macOS with Xcode)"
  fi
  if ((DETACH)); then
    info "then      return; stop with: just dev down"
  else
    info "then      follow the API and worker logs; Ctrl-C stops them (just dev down stops everything)"
  fi
}

# --- setup ------------------------------------------------------------------------------------

ensure_mise() {
  if [[ ! -x "$MISE_BIN" ]]; then
    log "first run: ./scripts/bootstrap.sh (mise, pinned tools, dependencies, git hooks, .env)"
    if ! "$REPO_ROOT/scripts/bootstrap.sh"; then
      warn "bootstrap finished with a doctor failure above; continuing (just doctor shows it again)"
    fi
    [[ -x "$MISE_BIN" ]] || die "bootstrap did not install mise at $MISE_BIN"
    return 0
  fi
  log "pinned tools (mise install)"
  if ! "$MISE_BIN" install --yes >/dev/null 2>&1; then
    "$MISE_BIN" install --yes || die "mise install failed (see above)"
  fi
}

# Run $2... when lockfile $1 is newer than the stamp of its last successful run (or none exists).
when_lockfile_changed() {
  local lock="$1" name="$2" stamp
  shift 2
  stamp="$STATE_DIR/stamps/$name"
  if [[ -f "$stamp" && ! "$lock" -nt "$stamp" ]]; then
    return 0
  fi
  log "$name ($lock is newer than the last install)"
  "$@" || die "$name failed (see above)"
  mkdir -p "$(dirname "$stamp")"
  touch "$stamp"
}

ensure_dependencies() {
  if [[ ! -d node_modules ]]; then rm -f "$STATE_DIR/stamps/pnpm-install"; fi
  when_lockfile_changed pnpm-lock.yaml pnpm-install \
    mise_exec pnpm install --frozen-lockfile --config.confirm-modules-purge=false
  if ((BACKEND && WORKERS)); then
    if [[ ! -d workers/.venv ]]; then rm -f "$STATE_DIR/stamps/uv-sync"; fi
    when_lockfile_changed workers/uv.lock uv-sync mise_exec uv sync --frozen --project workers
  fi
}

ensure_env_file() {
  if [[ ! -f .env ]]; then
    cp .env.example .env
    info "created .env from .env.example (shared values come from: just secrets-sync)"
  fi
  env_file_fill_local_defaults
}

docker_permission_denied() { docker info 2>&1 | command grep -qi "permission denied"; }

wait_for_docker() {
  local deadline=$((SECONDS + 60))
  until docker info >/dev/null 2>&1; do
    if docker_permission_denied; then
      die "your user cannot use the Docker socket yet: log out and back in (bootstrap --system added you to the docker group), then run just dev again"
    fi
    ((SECONDS < deadline)) || return 1
    sleep 2
  done
}

# Docker Engine on Linux, OrbStack on macOS (the split bootstrap.sh --system makes).
ensure_container_runtime() {
  if have docker && docker info >/dev/null 2>&1; then
    if os_is_darwin && [[ "$(darwin_docker_runtime)" != "orbstack" ]]; then
      warn "docker runs through $(darwin_docker_runtime), but this repo uses OrbStack on macOS (./scripts/bootstrap.sh --system installs it)"
    fi
    return 0
  fi
  if os_is_darwin; then
    if [[ -d /Applications/OrbStack.app ]]; then
      log "starting OrbStack"
      setup_orbstack || die "OrbStack did not start (see above; try: orb start)"
      return 0
    fi
    confirm "OrbStack (the macOS container runtime for Postgres) is not installed. Run ./scripts/bootstrap.sh --system now (Homebrew, OrbStack, Xcode, Android SDK)?" \
      || die "no container runtime: run ./scripts/bootstrap.sh --system"
    "$REPO_ROOT/scripts/bootstrap.sh" --system || warn "bootstrap --system reported a problem (see above)"
    have docker || export PATH="$HOME/.orbstack/bin:$PATH"
  elif ! have docker; then
    confirm "Docker Engine is not installed. Run ./scripts/bootstrap.sh --system now (sudo: Docker Engine, udev rules, Android SDK)?" \
      || die "no Docker Engine: run ./scripts/bootstrap.sh --system"
    "$REPO_ROOT/scripts/bootstrap.sh" --system || warn "bootstrap --system reported a problem (see above)"
  elif docker_permission_denied; then
    die "your user cannot use the Docker socket: log out and back in after bootstrap --system added you to the docker group (or run: sudo usermod -aG docker $(id -un), then log in again)"
  else
    log "starting the Docker service (sudo systemctl start docker)"
    sudo systemctl start docker || die "could not start Docker (sudo systemctl start docker)"
  fi
  wait_for_docker || die "docker is still not reachable (docker info); run: just doctor"
}

# 0 when the Android toolchain is ready (installing the SDK packages when they are missing).
ensure_android_toolchain() {
  if mise_exec apps/android/tools/sdk.sh check >/dev/null 2>&1; then
    return 0
  fi
  log "Android SDK packages missing: installing them (user-level, no sudo)"
  mise_exec apps/android/tools/sdk.sh install
}

# 0 when Xcode is ready; offers bootstrap --system (pinned Xcode, simulator runtime) when not.
ensure_ios_toolchain() {
  if mise_exec "$IOS_TOOL" doctor >/dev/null 2>&1; then
    return 0
  fi
  mise_exec "$IOS_TOOL" doctor || true
  confirm "Xcode is not ready for apps/ios. Run ./scripts/bootstrap.sh --system now (Apple ID, about 10 GB, sudo)?" || return 1
  "$REPO_ROOT/scripts/bootstrap.sh" --system || warn "bootstrap --system reported a problem (see above)"
  mise_exec "$IOS_TOOL" doctor >/dev/null 2>&1
}

run_setup() {
  heading "Setup"
  ensure_mise
  ensure_dependencies
  ensure_env_file
  ((BACKEND == 0)) || ensure_container_runtime
  if ((WANT_ANDROID)) && ! ensure_android_toolchain; then
    result_fail "android: SDK setup failed (run: just android-sdk install)"
    WANT_ANDROID=0
  fi
  if ((WANT_IOS)) && ! ensure_ios_toolchain; then
    result_fail "ios: Xcode is not ready (run: ./scripts/bootstrap.sh --system, then just ios-doctor)"
    WANT_IOS=0
  fi
}

# --- backend ----------------------------------------------------------------------------------

# Start "$@" through mise in the background as service $1 (own process group, nohup, log file),
# unless its health URL $2 already answers. Records it in STARTED.
start_service() {
  local name="$1" url="$2" port pid
  shift 2
  port="${url#http://localhost:}"
  port="${port%%/*}"
  if http_up "$url"; then
    if pid_alive "$name"; then
      info "$name already running (started by just dev, pid $(cat "$(pid_file "$name")"))"
    else
      info "$name already answers on :$port (started elsewhere; using it)"
    fi
    return 0
  fi
  if port_busy "$port"; then
    die "port $port is taken by another program, so $name cannot start (see: lsof -i :$port)"
  fi
  mkdir -p "$LOG_DIR"
  printf '\n=== %s: just dev started %s ===\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$name" >>"$LOG_DIR/$name.log"
  # Own process group (set -m): Ctrl-C in this terminal reaches only what is in the foreground, and
  # `kill -- -<pid>` stops the recipe with every process it started (tsx watch, uvicorn --reload).
  set -m
  # nohup runs a program, not a shell function, so mise is called here, not through mise_exec.
  nohup "$MISE_BIN" exec -- "$@" >>"$LOG_DIR/$name.log" 2>&1 </dev/null &
  pid=$!
  set +m
  printf '%s\n' "$pid" >"$(pid_file "$name")"
  STARTED+=("$name")
  info "$name starting (pid $pid, log $(rel "$LOG_DIR/$name.log"))"
}

# Wait until service $1's URL $2 answers; on timeout or exit, show its log tail and fail.
wait_service() {
  local name="$1" url="$2" deadline code
  deadline=$((SECONDS + ${AISTYLIST_DEV_TIMEOUT:-180}))
  while :; do
    code="$(http_code "$url")"
    if [[ "$code" != "000" ]]; then
      if [[ "$code" == 2* ]]; then
        result_ok "$name: $url ($code)"
      else
        result_ok "$name: $url answers $code (check its log: $(rel "$LOG_DIR/$name.log"))"
      fi
      return 0
    fi
    if [[ -f "$(pid_file "$name")" ]] && ! pid_alive "$name"; then
      error "$name exited; last lines of $(rel "$LOG_DIR/$name.log"):"
      tail -n 30 "$LOG_DIR/$name.log" >&2 || true
      return 1
    fi
    if ((SECONDS >= deadline)); then
      error "$name did not answer on $url in time; last lines of $(rel "$LOG_DIR/$name.log"):"
      tail -n 30 "$LOG_DIR/$name.log" >&2 || true
      return 1
    fi
    sleep 1
  done
}

run_backend() {
  local port
  port="$(api_port)"
  heading "Backend"
  log "Postgres (docker compose, project $COMPOSE_PROJECT_NAME)"
  if ! docker compose up -d --wait postgres; then
    die "Postgres did not start; run: just doctor (it explains a container owned by another checkout or a taken port 5432)"
  fi
  log "migrations (just db-migrate)"
  mise_exec just db-migrate || die "migrations failed (see above)"
  if ((SEED)); then
    log "seed data (just db-seed)"
    mise_exec just db-seed || die "seeding failed (see above)"
  fi
  log "API and workers"
  start_service api "http://localhost:$port/v1/health" just dev-api
  if ((WORKERS)); then
    start_service workers "http://localhost:$WORKER_PORT/health" just dev-workers
  fi
}

wait_backend() {
  local port
  port="$(api_port)"
  wait_service api "http://localhost:$port/v1/health" || {
    stop_started
    die "the API did not start"
  }
  if ((WORKERS)); then
    wait_service workers "http://localhost:$WORKER_PORT/health" || {
      stop_started
      die "the workers did not start"
    }
  fi
}

# --- apps -------------------------------------------------------------------------------------

EARLY_BOOT_PID=""

# With no device and no emulator at all, start the emulator now so it boots while the backend starts
# and Gradle builds; device.sh run waits for it later. Only an emulator started here is recorded for
# `just dev down`, so one you started yourself is never stopped by it.
start_emulator_early() {
  ((WANT_ANDROID)) || return 0
  [[ -z "$ANDROID_SERIAL_OPT" && -z "${ANDROID_SERIAL:-}" ]] || return 0
  if mise_exec "$ANDROID_TOOL" list 2>/dev/null | command grep -q -e '^emulator-' -e ' device$'; then
    return 0
  fi
  mkdir -p "$LOG_DIR"
  log "starting the Android emulator in the background (it boots while the rest starts)"
  (mise_exec "$ANDROID_TOOL" boot --no-wait >"$STATE_DIR/emulator.boot" 2>>"$LOG_DIR/emulator.log") &
  EARLY_BOOT_PID=$!
}

run_android() {
  local args=(run --api-port "$(api_port)") serial
  heading "Android"
  if [[ -n "$EARLY_BOOT_PID" ]]; then
    info "waiting for the emulator to start (a first run creates the AVD and downloads its system image, about 1.5 GB; log: $(rel "$LOG_DIR/emulator.log"))"
    if wait "$EARLY_BOOT_PID"; then
      serial="$(tail -n 1 "$STATE_DIR/emulator.boot" 2>/dev/null || true)"
      [[ "$serial" != emulator-* ]] || printf '%s\n' "$serial" >"$STATE_DIR/emulator.serial"
    else
      warn "the early emulator start failed (log: $(rel "$LOG_DIR/emulator.log")); device.sh run retries it"
    fi
  fi
  [[ -z "$ANDROID_SERIAL_OPT" ]] || args+=(--serial "$ANDROID_SERIAL_OPT")
  if mise_exec "$ANDROID_TOOL" "${args[@]}"; then
    result_ok "android: Dev app launched ($(mise_exec "$ANDROID_TOOL" list 2>/dev/null | awk '$2 == "device" { printf "%s ", $1 }'))"
  else
    result_fail "android: build, install or launch failed (see above; re-run: just dev android --no-setup)"
  fi
}

run_ios() {
  local booted_before udid
  heading "iOS"
  booted_before="$(xcrun simctl list devices booted 2>/dev/null | command grep -c '(Booted)' || true)"
  local port
  port="$(api_port)"
  if [[ -n "$IOS_SIMULATOR_OPT" ]]; then export IOS_SIMULATOR_ID="$IOS_SIMULATOR_OPT"; fi
  if [[ "$port" != "3000" ]]; then export AISTYLIST_API_BASE_URL="http://localhost:$port"; fi
  if mise_exec "$IOS_TOOL" run | tee "$STATE_DIR/ios.run"; then
    udid="$(awk '/^ios-run: launched/ { print $NF }' "$STATE_DIR/ios.run")"
    if [[ "${booted_before:-0}" == "0" && -n "$udid" ]]; then printf '%s\n' "$udid" >"$STATE_DIR/simulator.udid"; fi
    result_ok "ios: Dev app launched on simulator ${udid:-?}"
  else
    result_fail "ios: build, install or launch failed (see above; re-run: just dev ios --no-setup)"
  fi
}

# --- stop / follow ----------------------------------------------------------------------------

# Process ids of every descendant of $1 (children first found with pgrep -P, which macOS and
# Linux both have), collected before anything is signalled: once a parent exits, its children are
# re-parented and cannot be found from it any more.
descendants() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do
    printf '%s\n' "$child"
    descendants "$child"
  done
}

# Stop service $1: TERM to its process group (start_service makes one with set -m) and to every
# process of its tree (in case it shares a group), then KILL whatever still runs after 15 s.
stop_service() {
  local name="$1" pid deadline tree p
  [[ -f "$(pid_file "$name")" ]] || return 0
  pid="$(cat "$(pid_file "$name")")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    tree="$pid $(descendants "$pid" | tr '\n' ' ')"
    kill -TERM -- "-$pid" 2>/dev/null || true
    # shellcheck disable=SC2086 # one pid per word
    kill -TERM $tree 2>/dev/null || true
    deadline=$((SECONDS + 15))
    while ((SECONDS < deadline)); do
      for p in $tree; do kill -0 "$p" 2>/dev/null && break; p=""; done
      [[ -n "$p" ]] || break
      sleep 1
    done
    kill -KILL -- "-$pid" 2>/dev/null || true
    # shellcheck disable=SC2086 # one pid per word
    kill -KILL $tree 2>/dev/null || true
    info "stopped $name (pid $pid)"
  fi
  rm -f "$(pid_file "$name")"
}

stop_started() {
  local name
  for name in ${STARTED[@]+"${STARTED[@]}"}; do stop_service "$name"; done
  STARTED=()
}

follow_logs() {
  local files=() name
  for name in "$@"; do
    [[ -f "$LOG_DIR/$name.log" ]] && files+=("$LOG_DIR/$name.log")
  done
  ((${#files[@]})) || die "no logs yet in $(rel "$LOG_DIR") (start with: just dev)"
  # One prefix per file; tail prints "==> file <==" whenever it switches between files (and
  # nothing for a single file). A shell read loop, not awk: mawk (Debian's awk) buffers a pipe and
  # would hold the lines back.
  local line prefix="$1"
  ((${#files[@]} > 1)) || prefix="$(basename "${files[0]}" .log)"
  tail -n "${FOLLOW_LINES:-0}" -F "${files[@]}" 2>/dev/null | while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      "==> "*" <==")
        prefix="${line#==> }"
        prefix="$(basename "${prefix% <==}" .log)"
        ;;
      "") ;; # tail's separator before a header
      *) printf '[%s] %s\n' "$prefix" "$line" ;;
    esac
  done
}

summary() {
  local port line pg_port
  port="$(api_port)"
  pg_port="${POSTGRES_HOST_PORT:-$(env_file_value POSTGRES_HOST_PORT)}"
  heading "AI Stylist"
  for line in ${RESULTS[@]+"${RESULTS[@]}"}; do printf '  %s\n' "$line"; done
  if ((BACKEND)); then
    info "Postgres   localhost:${pg_port:-5432} (compose project $COMPOSE_PROJECT_NAME)"
    info "API        http://localhost:$port  ·  http://localhost:$port/v1/version"
  fi
  info "Logs       $(rel "$LOG_DIR")/  (just dev logs)"
  info "Re-run     just dev android / just dev ios   (rebuilds and relaunches the app, reuses the backend)"
  if ((DETACH || BACKEND == 0)); then
    info "Stop       just dev down   (--keep-db keeps Postgres, --keep-devices keeps the emulator/simulator)"
  else
    info "Stop       Ctrl-C stops the API and workers; just dev down stops everything"
  fi
}

# --- commands ---------------------------------------------------------------------------------

cmd_up() {
  parse_up_args "$@"
  print_plan
  ((DRY_RUN == 0)) || exit 0
  mkdir -p "$STATE_DIR" "$LOG_DIR"
  if ((SETUP)); then
    run_setup
  else
    [[ -x "$MISE_BIN" ]] || die "mise not found at $MISE_BIN: run without --no-setup once"
  fi
  # Ctrl-C during the build steps stops what this run started.
  trap 'stop_started; exit 130' INT TERM
  start_emulator_early
  if ((BACKEND)); then
    run_backend
    wait_backend
  fi
  ((WANT_ANDROID == 0)) || run_android
  ((WANT_IOS == 0)) || run_ios
  summary
  if ((DETACH)); then
    trap - INT TERM
    exit "$FAILED"
  fi
  if ((BACKEND)); then
    local names=(api)
    ((WORKERS == 0)) || names+=(workers)
    log "following the ${names[*]} logs (Ctrl-C to stop)"
    follow_logs "${names[@]}" || true
  fi
  stop_started
  exit "$FAILED"
}

cmd_down() {
  local keep_db=0 keep_devices=0 serial udid
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --keep-db) keep_db=1 ;;
      --keep-devices) keep_devices=1 ;;
      *) die "down: unknown argument '$1' (use --keep-db, --keep-devices)" ;;
    esac
    shift
  done
  heading "Stopping"
  stop_service api
  stop_service workers
  if ((keep_devices == 0)); then
    if [[ -f "$STATE_DIR/emulator.serial" ]]; then
      serial="$(cat "$STATE_DIR/emulator.serial")"
      mise_exec "$ANDROID_TOOL" stop "$serial" || true
      rm -f "$STATE_DIR/emulator.serial"
    fi
    if [[ -f "$STATE_DIR/simulator.udid" ]] && os_is_darwin; then
      udid="$(cat "$STATE_DIR/simulator.udid")"
      if xcrun simctl shutdown "$udid" 2>/dev/null; then info "shut down simulator $udid"; fi
      rm -f "$STATE_DIR/simulator.udid"
    fi
  fi
  if ((keep_db == 0)) && have docker && docker info >/dev/null 2>&1; then
    if docker compose stop postgres >/dev/null 2>&1; then info "stopped Postgres (data kept in its volume)"; fi
  fi
  if http_up "http://localhost:$(api_port)/v1/health"; then
    note "an API still answers on :$(api_port); just dev did not start it"
  fi
}

cmd_status() {
  local port name state url
  port="$(api_port)"
  heading "just dev status"
  if have docker && docker info >/dev/null 2>&1; then
    state="$(local_postgres_state)"
    case "$state" in
      absent) state="no container yet (just dev creates it)" ;;
      own\ *) state="${state#own } (container $LOCAL_POSTGRES_CONTAINER, compose project $COMPOSE_PROJECT_NAME)" ;;
      *) state="container $LOCAL_POSTGRES_CONTAINER belongs to another checkout: run just doctor" ;;
    esac
    info "Postgres   $state"
  else
    info "Postgres   container runtime not reachable"
  fi
  for name in api workers; do
    if [[ "$name" == api ]]; then url="http://localhost:$port/v1/health"; else url="http://localhost:$WORKER_PORT/health"; fi
    if pid_alive "$name"; then state="running (pid $(cat "$(pid_file "$name")"))"; else state="not started by just dev"; fi
    info "$(printf '%-10s' "$name") $state; $url -> $(http_code "$url")"
  done
  if mise_exec apps/android/tools/sdk.sh check >/dev/null 2>&1; then
    info "Android    $(mise_exec "$ANDROID_TOOL" list 2>/dev/null | awk '{ printf "%s (%s) ", $1, $2 }')"
  fi
  if os_is_darwin && have xcrun; then
    info "iOS        $(xcrun simctl list devices booted 2>/dev/null | command grep '(Booted)' | sed 's/^ *//' | tr '\n' ' ')"
  fi
  info "Logs       $(rel "$LOG_DIR")/"
}

cmd_logs() {
  [[ $# -gt 0 ]] || set -- api workers
  FOLLOW_LINES=50 follow_logs "$@"
}

# Sourced by scripts/test/dev.test.sh: define the functions, run no command.
[[ "${BASH_SOURCE[0]}" == "$0" ]] || return 0

case "${1:-up}" in
  up) [[ $# -eq 0 ]] || shift; cmd_up "$@" ;;
  down) shift; cmd_down "$@" ;;
  status) shift; cmd_status "$@" ;;
  logs) shift; cmd_logs "$@" ;;
  -h | --help) usage ;;
  *) cmd_up "$@" ;;
esac
