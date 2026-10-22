#!/usr/bin/env bash
# Run the Dev build (app.aistylist.mobile.dev) on an Android emulator or phone. Used by `just dev`
# and `just android-run`; Linux and macOS alike.
#
#   apps/android/tools/device.sh run [--serial S] [--api-port N]
#       pick a device (S, else ANDROID_SERIAL, else a running emulator, else the one connected phone,
#       else boot the AVD), install the debug build on it and launch the app. A phone reaches the
#       host's API through `adb reverse tcp:N tcp:N` and a build pointed at localhost:N; an emulator
#       uses 10.0.2.2 (the build's default for port 3000). Default N: 3000.
#   apps/android/tools/device.sh boot [--no-wait]
#       create the AVD when missing, start it unless an emulator already runs, wait for the boot
#       (--no-wait: start it and return). Prints the emulator's adb serial on the last line.
#   apps/android/tools/device.sh avd [--recreate]
#       create the AVD (installs the emulator and its system image through sdk.sh emulator)
#   apps/android/tools/device.sh stop [serial]
#       shut down that emulator, or every running emulator (`adb emu kill`)
#   apps/android/tools/device.sh list    adb devices, one per line: <serial> <state>
#
# Env: AISTYLIST_AVD (default aistylist-dev), ANDROID_SYSTEM_IMAGE (see sdk.sh),
#      AISTYLIST_API_BASE_URL (an explicit base URL wins over the one chosen here),
#      AISTYLIST_EMULATOR_ARGS (extra `emulator` flags, e.g. "-no-window" or "-wipe-data"),
#      ANDROID_AVD_HOME (default ~/.android/avd), AISTYLIST_BOOT_TIMEOUT (seconds, default 300).
# The emulator log goes to artifacts/dev/logs/emulator.log. On Linux an x86_64 emulator needs
# /dev/kvm; without a display (no DISPLAY / WAYLAND_DISPLAY) it starts with -no-window.
# bash 3.2-compatible (macOS /bin/bash).
set -euo pipefail

TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TOOLS/../../.." && pwd)"
APP_ID="app.aistylist.mobile.dev"
AVD="${AISTYLIST_AVD:-aistylist-dev}"
AVD_HOME="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
LOG_DIR="$REPO_ROOT/artifacts/dev/logs"
BOOT_TIMEOUT="${AISTYLIST_BOOT_TIMEOUT:-300}"

say() { printf '==> %s\n' "$*" >&2; }
die() {
  printf 'android: %s\n' "$*" >&2
  exit 1
}

sdk_dir() { "$TOOLS/sdk.sh" dir; }
adb_bin() {
  local adb
  adb="$(sdk_dir)/platform-tools/adb"
  [[ -x "$adb" ]] || die "adb not found at $adb (run: just android-sdk install)"
  printf '%s' "$adb"
}

# adb devices, one `<serial> <state>` per line (state: device, offline, unauthorized, ...).
list_devices() {
  "$(adb_bin)" devices | awk 'NR > 1 && NF >= 2 { print $1, $2 }'
}

# The device to use: $1 (an explicit serial), else ANDROID_SERIAL, else the first running emulator,
# else the first connected phone. Prints nothing when no device is online. Reads `list_devices`
# lines on stdin so tests can feed it.
choose_serial() {
  local explicit="$1" serial state emulator="" phone=""
  if [[ -n "$explicit" ]]; then
    printf '%s\n' "$explicit"
    return 0
  fi
  while read -r serial state; do
    [[ "$state" == "device" ]] || continue
    case "$serial" in
      emulator-*) [[ -n "$emulator" ]] || emulator="$serial" ;;
      *) [[ -n "$phone" ]] || phone="$serial" ;;
    esac
  done
  if [[ -n "$emulator" ]]; then
    printf '%s\n' "$emulator"
  elif [[ -n "$phone" ]]; then
    printf '%s\n' "$phone"
  fi
}

# The API base URL a device of serial $1 uses for host port $2, or empty for the build default
# (an emulator and port 3000). An exported AISTYLIST_API_BASE_URL always wins.
api_base_url_for() {
  local serial="$1" port="$2"
  if [[ -n "${AISTYLIST_API_BASE_URL:-}" ]]; then
    printf '%s\n' "$AISTYLIST_API_BASE_URL"
  elif [[ "$serial" != emulator-* ]]; then
    printf 'http://localhost:%s\n' "$port"
  elif [[ "$port" != "3000" ]]; then
    printf 'http://10.0.2.2:%s\n' "$port"
  fi
}

# --- AVD --------------------------------------------------------------------------------------

avd_exists() { [[ -f "$AVD_HOME/$AVD.ini" ]]; }

# Set key $2 to value $3 in ini file $1 (replacing any earlier line for that key).
ini_set() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  awk -v key="$key" -F= '$1 != key' "$file" >"$tmp"
  printf '%s=%s\n' "$key" "$value" >>"$tmp"
  mv "$tmp" "$file"
}

create_avd() {
  local image bin profile config
  say "installing the emulator and its system image (first run only; about 1.5 GB)"
  image="$("$TOOLS/sdk.sh" emulator | tail -n 1)"
  bin="$("$TOOLS/sdk.sh" bin)"
  # A recent phone profile; avdmanager ships pixel_8 since cmdline-tools 12, the others as fallbacks.
  profile="$("$bin/avdmanager" list device -c 2>/dev/null | command grep -m 1 -x -E 'pixel_8|pixel_7|pixel_6|pixel' || true)"
  say "creating AVD $AVD ($image${profile:+, $profile})"
  mkdir -p "$AVD_HOME"
  # `echo no`: no custom hardware profile.
  echo no | ANDROID_AVD_HOME="$AVD_HOME" "$bin/avdmanager" --silent create avd --force \
    --name "$AVD" --package "$image" ${profile:+--device "$profile"} >/dev/null
  config="$AVD_HOME/$AVD.avd/config.ini"
  [[ -f "$config" ]] || die "avdmanager did not create $config"
  ini_set "$config" hw.keyboard yes       # type with the host keyboard
  ini_set "$config" hw.gpu.enabled yes
  ini_set "$config" hw.gpu.mode auto
  ini_set "$config" disk.dataPartition.size 6G
}

cmd_avd() {
  case "${1:-}" in
    --recreate) create_avd ;;
    "") if avd_exists; then say "AVD $AVD exists ($AVD_HOME)"; else create_avd; fi ;;
    *) die "avd: unknown argument '$1' (use --recreate)" ;;
  esac
}

# --- boot -------------------------------------------------------------------------------------

# Linux x86_64 emulators need KVM; say exactly how to get it.
check_acceleration() {
  [[ "$(uname -s)" == "Linux" ]] || return 0
  case "$(uname -m)" in arm64 | aarch64) return 0 ;; esac
  if [[ ! -e /dev/kvm ]]; then
    die "/dev/kvm is missing: enable virtualization (VT-x/AMD-V) in the firmware settings; the x86_64 emulator cannot run without it"
  fi
  if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
    die "no access to /dev/kvm: run 'sudo usermod -aG kvm $(id -un)', then log out and back in"
  fi
}

# An adb console port no running emulator uses (emulators take even ports 5554-5584).
free_emulator_port() {
  local port taken
  taken="$(list_devices | awk '{ print $1 }')"
  for port in 5554 5556 5558 5560 5562 5564 5566 5568 5570 5572 5574 5576 5578 5580 5582 5584; do
    case "$taken" in *"emulator-$port"*) continue ;; esac
    printf '%s\n' "$port"
    return 0
  done
  die "no free emulator port (16 emulators running?)"
}

wait_for_boot() {
  local serial="$1" adb deadline
  adb="$(adb_bin)"
  deadline=$((SECONDS + BOOT_TIMEOUT))
  say "waiting for $serial to boot (up to ${BOOT_TIMEOUT}s)"
  until [[ "$("$adb" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
    if ((SECONDS >= deadline)); then
      die "$serial did not finish booting in ${BOOT_TIMEOUT}s (log: ${LOG_DIR#"$REPO_ROOT"/}/emulator.log)"
    fi
    sleep 2
  done
  # Unlock the screen so the launched app is visible.
  "$adb" -s "$serial" shell input keyevent 82 >/dev/null 2>&1 || true
}

# Whether an emulator process for this AVD runs (it may not have reached adb yet).
avd_process_running() { pgrep -f -- "-avd $AVD( |$)" >/dev/null 2>&1; }

# The AVD name of emulator $1 (`adb emu avd name`), or nothing when it does not answer.
emulator_avd_name() { "$(adb_bin)" -s "$1" emu avd name 2>/dev/null | head -n 1 | tr -d '\r'; }

# The serial of the emulator running this AVD ($AVD), in any state, or nothing. Another AVD's
# emulator (another agent's, for example) is never reused.
listed_emulator() {
  local serial state
  while read -r serial state; do
    [[ "$serial" == emulator-* ]] || continue
    if [[ "$(emulator_avd_name "$serial")" == "$AVD" ]]; then
      printf '%s\n' "$serial"
      return 0
    fi
  done < <(list_devices)
}

cmd_boot() {
  local wait=1 running port serial emulator args deadline
  case "${1:-}" in
    --no-wait) wait=0 ;;
    "") ;;
    *) die "boot: unknown argument '$1' (use --no-wait)" ;;
  esac
  running="$(listed_emulator)"
  if [[ -z "$running" ]] && avd_process_running; then
    # Started a moment ago (for example by `just dev`'s early boot): wait until adb sees it rather
    # than starting the same AVD twice, which the emulator refuses.
    deadline=$((SECONDS + 60))
    until running="$(listed_emulator)" && [[ -n "$running" ]]; do
      ((SECONDS < deadline)) || die "emulator $AVD runs but adb does not list it (log: ${LOG_DIR#"$REPO_ROOT"/}/emulator.log)"
      sleep 1
    done
  fi
  if [[ -n "$running" ]]; then
    say "emulator $running is already running"
    ((wait == 0)) || wait_for_boot "$running"
    printf '%s\n' "$running"
    return 0
  fi
  check_acceleration
  avd_exists || create_avd
  emulator="$(sdk_dir)/emulator/emulator"
  [[ -x "$emulator" ]] || "$TOOLS/sdk.sh" emulator >/dev/null
  port="$(free_emulator_port)"
  serial="emulator-$port"
  args=(-avd "$AVD" -port "$port" -no-boot-anim -netdelay none -netspeed full)
  if [[ "$(uname -s)" == "Linux" && -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
    say "no display: starting the emulator with -no-window"
    args+=(-no-window)
  fi
  # shellcheck disable=SC2206 # word splitting of the user's extra flags is intended
  [[ -z "${AISTYLIST_EMULATOR_ARGS:-}" ]] || args+=(${AISTYLIST_EMULATOR_ARGS})
  mkdir -p "$LOG_DIR"
  say "starting emulator $AVD as $serial (log: ${LOG_DIR#"$REPO_ROOT"/}/emulator.log)"
  # Its own process group (set -m) and nohup: Ctrl-C in the terminal that started it, or that
  # terminal closing, does not stop the emulator. `device.sh stop` or `just dev down` does.
  set -m
  ANDROID_AVD_HOME="$AVD_HOME" nohup "$emulator" "${args[@]}" >>"$LOG_DIR/emulator.log" 2>&1 </dev/null &
  set +m
  ((wait == 0)) || wait_for_boot "$serial"
  printf '%s\n' "$serial"
}

cmd_stop() {
  local only="${1:-}" adb serial state stopped=0
  adb="$(adb_bin)"
  while read -r serial state; do
    [[ -z "$only" || "$serial" == "$only" ]] || continue
    case "$serial" in
      emulator-*)
        "$adb" -s "$serial" emu kill >/dev/null 2>&1 || true
        say "stopped $serial ($state)"
        stopped=1
        ;;
    esac
  done < <(list_devices)
  ((stopped)) || say "no emulator running${only:+ as $only}"
}

# --- run --------------------------------------------------------------------------------------

cmd_run() {
  local explicit="${ANDROID_SERIAL:-}" port=3000 serial adb url component state
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --serial)
        [[ $# -ge 2 ]] || die "run: --serial needs a value"
        explicit="$2"
        shift 2
        ;;
      --api-port)
        [[ $# -ge 2 ]] || die "run: --api-port needs a value"
        port="$2"
        shift 2
        ;;
      *) die "run: unknown argument '$1' (use --serial S, --api-port N)" ;;
    esac
  done
  adb="$(adb_bin)"
  "$adb" start-server >/dev/null 2>&1 || true
  while read -r serial state; do
    case "$state" in
      unauthorized) printf 'android: %s is unauthorized: accept the USB debugging prompt on the phone\n' "$serial" >&2 ;;
      offline) [[ "$serial" == emulator-* ]] || printf 'android: %s is offline (replug it, or restart adb: adb kill-server)\n' "$serial" >&2 ;;
    esac
  done < <(list_devices)
  serial="$(list_devices | choose_serial "$explicit")"
  if [[ -z "$serial" ]]; then
    serial="$(cmd_boot | tail -n 1)"
  elif [[ "$serial" == emulator-* ]]; then
    wait_for_boot "$serial"
  fi
  say "using $serial"

  url="$(api_base_url_for "$serial" "$port")"
  if [[ "$serial" != emulator-* ]]; then
    "$adb" -s "$serial" reverse "tcp:$port" "tcp:$port" >/dev/null \
      || die "adb reverse tcp:$port failed on $serial"
    say "phone: adb reverse tcp:$port -> this machine's API"
  fi
  say "installing the debug build${url:+ (API_BASE_URL $url)}"
  if [[ -n "$url" ]]; then
    ANDROID_SERIAL="$serial" AISTYLIST_API_BASE_URL="$url" "$TOOLS/gradle.sh" :app:installDebug
  else
    ANDROID_SERIAL="$serial" "$TOOLS/gradle.sh" :app:installDebug
  fi
  component="$("$adb" -s "$serial" shell cmd package resolve-activity --brief \
    -c android.intent.category.LAUNCHER "$APP_ID" 2>/dev/null | tr -d '\r' | tail -n 1)"
  [[ "$component" == */* ]] || die "no launcher activity for $APP_ID on $serial (did the install succeed?)"
  # -S: stop a running copy first, so a re-run always shows the fresh build.
  "$adb" -s "$serial" shell am start -S -n "$component" >/dev/null
  say "launched $APP_ID on $serial"
}

# Sourced by scripts/test/dev.test.sh: define the functions, run no command.
[[ "${BASH_SOURCE[0]}" == "$0" ]] || return 0

cmd="${1:-}"
[[ $# -eq 0 ]] || shift
case "$cmd" in
  run) cmd_run "$@" ;;
  boot) cmd_boot "$@" ;;
  avd) cmd_avd "$@" ;;
  stop) cmd_stop "${1:-}" ;;
  list) list_devices ;;
  -h | --help | "") sed -n '2,27p' "$0" ;;
  *) die "unknown command '$cmd' (run|boot|avd|stop|list)" ;;
esac
