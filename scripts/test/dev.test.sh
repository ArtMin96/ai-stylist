#!/usr/bin/env bash
# `just dev` (scripts/dev.sh) and the per-platform run tools it drives, without a device, Docker or
# network: the plan per OS (a stub `uname` plays Linux and macOS), the target rules, the API port
# precedence, live prefixed log following, stopping a whole process group, and, from
# apps/android/tools, which device is used, which API URL it gets, and the system-image fallback.
# Usage: scripts/test/dev.test.sh   (run by `just test tooling` and `just test`). Linux and macOS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-dev-tests.XXXXXX")"
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

expect_eq() {
  if [[ "$1" != "$2" ]]; then
    printf '  expected: %s\n  actual:   %s\n' "$2" "$1" >&2
    return 1
  fi
}

expect_contains() {
  if [[ "$1" != *"$2"* ]]; then
    printf '  expected to contain: %s\n  in: %s\n' "$2" "$1" >&2
    return 1
  fi
}

expect_not_contains() {
  if [[ "$1" == *"$2"* ]]; then
    printf '  expected not to contain: %s\n  in: %s\n' "$2" "$1" >&2
    return 1
  fi
}

# A `uname` that reports OS $1 and machine $2, first on PATH in directory $3.
stub_uname() {
  mkdir -p "$3"
  cat >"$3/uname" <<EOF
#!/bin/sh
case "\$1" in -m) echo $2 ;; *) echo $1 ;; esac
EOF
  chmod +x "$3/uname"
}
stub_uname Linux x86_64 "$TEST_ROOT/linux"
stub_uname Darwin arm64 "$TEST_ROOT/darwin"

# dev.sh with the OS of stub dir $1, no colour; prints stdout and stderr, then `exit=<code>`.
dev_on() {
  local os="$1" rc=0 out
  shift
  out="$(PATH="$TEST_ROOT/$os:$PATH" NO_COLOR=1 bash "$ROOT/scripts/dev.sh" "$@" 2>&1)" || rc=$?
  printf '%s\nexit=%s\n' "$out" "$rc"
}

test_linux_plan_runs_android_not_ios() {
  local out
  out="$(dev_on linux --dry-run)"
  expect_contains "$out" "just dev on Linux (x86_64)" \
    && expect_contains "$out" "container runtime: Docker Engine" \
    && expect_contains "$out" "android   Dev build" \
    && expect_contains "$out" "ios       not on Linux" \
    && expect_contains "$out" "exit=0"
}

test_macos_plan_runs_both_apps_on_orbstack() {
  local out
  out="$(dev_on darwin --dry-run)"
  expect_contains "$out" "just dev on Darwin (arm64)" \
    && expect_contains "$out" "container runtime: OrbStack" \
    && expect_not_contains "$out" "Docker Engine" \
    && expect_contains "$out" "android   Dev build" \
    && expect_contains "$out" "ios       Dev build -> iPhone simulator" \
    && expect_contains "$out" "exit=0"
}

test_ios_alone_on_linux_is_refused() {
  local out
  out="$(dev_on linux ios --dry-run)"
  expect_contains "$out" "ios needs macOS with Xcode" && expect_contains "$out" "exit=1"
}

test_targets_and_options_shape_the_plan() {
  local out
  out="$(dev_on darwin backend --no-workers --seed -d --dry-run)"
  expect_contains "$out" "-> migrations -> seed data" \
    && expect_contains "$out" "workers skipped (--no-workers)" \
    && expect_not_contains "$out" "android   Dev build" \
    && expect_contains "$out" "then      return; stop with: just dev down" || return 1
  out="$(dev_on darwin ios --no-backend --no-setup --ios-simulator ABC --dry-run)"
  expect_contains "$out" "backend   skipped (--no-backend)" \
    && expect_contains "$out" "setup     skipped (--no-setup)" \
    && expect_contains "$out" "iPhone simulator ABC"
}

test_bad_arguments_fail() {
  local out
  out="$(dev_on linux --bogus)"
  expect_contains "$out" "unknown argument '--bogus'" && expect_contains "$out" "exit=2" || return 1
  out="$(dev_on linux backend --no-backend --dry-run)"
  expect_contains "$out" "nothing to do" && expect_contains "$out" "exit=1" || return 1
  out="$(dev_on linux --android-serial)"
  expect_contains "$out" "--android-serial needs a value" && expect_contains "$out" "exit=1"
}

test_dry_run_changes_nothing() {
  local before after
  before="$(cd "$ROOT" && git status --porcelain --ignored -- .env artifacts/dev 2>/dev/null || true)"
  dev_on linux --dry-run >/dev/null
  after="$(cd "$ROOT" && git status --porcelain --ignored -- .env artifacts/dev 2>/dev/null || true)"
  expect_eq "$after" "$before"
}

# api_port as apps/api/src/config.ts picks the port: API_PORT, else PORT, else 3000; the
# environment before .env for each.
test_api_port_precedence() {
  (
    # shellcheck source=scripts/dev.sh
    MISE_BIN=/bin/true source "$ROOT/scripts/dev.sh"
    cd "$TEST_ROOT" && mkdir -p port && cd port
    unset API_PORT PORT
    : >.env
    expect_eq "$(api_port)" 3000 || exit 1
    printf 'PORT=4000\n' >.env
    expect_eq "$(api_port)" 4000 || exit 1
    expect_eq "$(PORT=4100 api_port)" 4100 || exit 1
    printf 'PORT=4000\nAPI_PORT=5000\n' >.env
    expect_eq "$(PORT=4100 api_port)" 5000 || exit 1
    expect_eq "$(API_PORT=5100 api_port)" 5100
  )
}

test_logs_stream_live_with_a_prefix_per_service() {
  local dir out
  dir="$TEST_ROOT/logs"
  mkdir -p "$dir"
  printf 'old\n' >"$dir/api.log"
  printf 'w-old\n' >"$dir/workers.log"
  # The follower runs in its own process group (set -m), so one signal ends tail and its read loop,
  # as Ctrl-C does in a terminal.
  set -m
  (
    # shellcheck source=scripts/dev.sh
    MISE_BIN=/bin/true source "$ROOT/scripts/dev.sh"
    LOG_DIR="$dir"
    FOLLOW_LINES=5 follow_logs api workers
  ) >"$dir/out" 2>&1 </dev/null &
  local follower=$!
  set +m
  sleep 1
  printf 'new\n' >>"$dir/api.log"
  printf 'w-new\n' >>"$dir/workers.log"
  sleep 2
  kill -TERM -- "-$follower" 2>/dev/null || true
  wait "$follower" 2>/dev/null || true
  out="$(cat "$dir/out")"
  expect_contains "$out" "[api] old" \
    && expect_contains "$out" "[workers] w-old" \
    && expect_contains "$out" "[api] new" \
    && expect_contains "$out" "[workers] w-new" \
    && expect_not_contains "$out" "==>"
}

# start_service + stop_service: the service runs in its own process group, and stopping it ends
# every process it started (as `just dev-api` starts tsx, which starts node).
test_stop_ends_the_whole_process_group() {
  local dir="$TEST_ROOT/svc" child
  mkdir -p "$dir"
  (
    # Set before sourcing: an assignment prefixed to `source` lasts only while it runs.
    MISE_BIN="$TEST_ROOT/linux/mise"
    # shellcheck source=scripts/dev.sh
    source "$ROOT/scripts/dev.sh"
    STATE_DIR="$dir"
    LOG_DIR="$dir/logs"
    # A free port nothing answers on, so start_service starts the command.
    start_service fake "http://localhost:59997/health" sh -c 'sleep 300 & echo "$!" > '"$dir"'/child; wait' >/dev/null
    sleep 1
    stop_service fake >/dev/null
  )
  if [[ ! -s "$dir/child" ]]; then
    echo "  the service never started (no $dir/child); log:" >&2
    cat "$dir/logs/fake.log" >&2 2>/dev/null || true
    return 1
  fi
  child="$(cat "$dir/child")"
  if kill -0 "$child" 2>/dev/null; then
    echo "  the service's child $child still runs" >&2
    kill "$child" 2>/dev/null || true
    return 1
  fi
  [[ ! -f "$dir/fake.pid" ]]
}
# mise stand-in for the service test: `mise exec -- cmd` runs cmd.
# shellcheck disable=SC2016 # the stub's own "$1" and "$@", expanded when it runs
printf '#!/bin/sh\n[ "$1" = exec ] && shift && [ "$1" = -- ] && shift\nexec "$@"\n' >"$TEST_ROOT/linux/mise"
chmod +x "$TEST_ROOT/linux/mise"

# --- apps/android/tools ------------------------------------------------------------------------

test_device_choice() {
  (
    # shellcheck source=apps/android/tools/device.sh
    source "$ROOT/apps/android/tools/device.sh"
    expect_eq "$(printf 'R58M device\nemulator-5556 device\n' | choose_serial '')" emulator-5556 || exit 1
    expect_eq "$(printf 'R58M device\n' | choose_serial '')" R58M || exit 1
    expect_eq "$(printf 'emulator-5554 offline\nR58M device\n' | choose_serial '')" R58M || exit 1
    expect_eq "$(printf 'R58M unauthorized\n' | choose_serial '')" "" || exit 1
    expect_eq "$(printf 'emulator-5554 device\n' | choose_serial R58M)" R58M
  )
}

test_explicit_serial_drains_the_device_list() {
  (
    # shellcheck source=apps/android/tools/device.sh
    source "$ROOT/apps/android/tools/device.sh"
    set -o pipefail
    # A list far bigger than a pipe buffer: returning without reading it would SIGPIPE the writer (141).
    seq 1 200000 | awk '{ print "emulator-" $1 " device" }' | choose_serial emulator-5554 >/dev/null
  )
}

test_boot_finds_only_its_own_avd() {
  (
    # shellcheck source=apps/android/tools/device.sh
    source "$ROOT/apps/android/tools/device.sh"
    AVD=aistylist-dev
    # Stubs for adb: another agent's emulator runs too.
    list_devices() { printf 'emulator-5570 device\nemulator-5554 device\n'; }
    emulator_avd_name() { case "$1" in emulator-5570) echo outlineprobe ;; emulator-5554) echo aistylist-dev ;; esac; }
    expect_eq "$(listed_emulator)" emulator-5554 || exit 1
    list_devices() { printf 'emulator-5570 device\n'; }
    expect_eq "$(listed_emulator)" ""
  )
}

test_api_url_per_device() {
  (
    # shellcheck source=apps/android/tools/device.sh
    source "$ROOT/apps/android/tools/device.sh"
    unset AISTYLIST_API_BASE_URL
    expect_eq "$(api_base_url_for emulator-5554 3000)" "" || exit 1
    expect_eq "$(api_base_url_for emulator-5554 3001)" "http://10.0.2.2:3001" || exit 1
    expect_eq "$(api_base_url_for R58M 3000)" "http://localhost:3000" || exit 1
    expect_eq "$(AISTYLIST_API_BASE_URL=http://10.0.0.5:3000 api_base_url_for R58M 3000)" "http://10.0.0.5:3000"
  )
}

test_newest_system_image_fallback() {
  local bin="$TEST_ROOT/sdkbin"
  mkdir -p "$bin"
  cat >"$bin/sdkmanager" <<'EOF'
#!/bin/sh
cat <<'LIST'
Installed packages:
  Path                 | Version | Description
  platform-tools       | 36.0.0  | Android SDK Platform-Tools
Available Packages:
  system-images;android-34;google_apis;x86_64       | 14 | Google APIs Intel x86_64 Atom System Image
  system-images;android-35;google_apis;x86_64       | 9  | Google APIs Intel x86_64 Atom System Image
  system-images;android-35;google_apis;arm64-v8a    | 9  | Google APIs ARM 64 v8a System Image
  system-images;android-35;google_apis_playstore;x86_64 | 9 | Google Play Intel x86_64 Atom System Image
LIST
EOF
  chmod +x "$bin/sdkmanager"
  # sdk.sh runs its mode on load, so its two functions are read from the file and defined here.
  (
    # shellcheck disable=SC2034 # read by the sdk.sh functions defined by the eval below
    sdk="$TEST_ROOT/sdk"
    eval "$(sed -n '/^listed_packages() {/,/^}/p;/^newest_google_apis_image() {/,/^}/p' "$ROOT/apps/android/tools/sdk.sh")"
    expect_eq "$(newest_google_apis_image "$bin/sdkmanager" x86_64)" "system-images;android-35;google_apis;x86_64" || exit 1
    expect_eq "$(newest_google_apis_image "$bin/sdkmanager" arm64-v8a)" "system-images;android-35;google_apis;arm64-v8a" || exit 1
    expect_eq "$(listed_packages "$bin/sdkmanager" | grep -c 'system-images')" 4
  )
}

run_test "linux: plan runs backend + android, not ios" test_linux_plan_runs_android_not_ios
run_test "macOS: plan runs both apps, with OrbStack (no Docker Engine)" test_macos_plan_runs_both_apps_on_orbstack
run_test "linux: 'just dev ios' is refused with the reason" test_ios_alone_on_linux_is_refused
run_test "targets and options shape the plan" test_targets_and_options_shape_the_plan
run_test "unknown or incomplete arguments fail" test_bad_arguments_fail
run_test "--dry-run writes nothing (.env, artifacts/dev)" test_dry_run_changes_nothing
run_test "API port: API_PORT, else PORT, else 3000; environment before .env" test_api_port_precedence
run_test "logs: live, one prefix per service, no tail headers" test_logs_stream_live_with_a_prefix_per_service
run_test "stop ends every process a service started" test_stop_ends_the_whole_process_group
run_test "android: emulator first, then a phone, never an unauthorized one; --serial wins" test_device_choice
run_test "android: an explicit serial still reads the device list (no SIGPIPE under pipefail)" test_explicit_serial_drains_the_device_list
run_test "android: boot reuses only an emulator of its own AVD, never another one" test_boot_finds_only_its_own_avd
run_test "android: API URL per device (emulator 10.0.2.2, phone localhost via adb reverse)" test_api_url_per_device
run_test "android: newest Google APIs image for the host CPU when the pinned one is missing" test_newest_system_image_fallback

if ((failures)); then
  echo "dev tests: $failures failed" >&2
  exit 1
fi
echo "dev tests: all passed"
