#!/usr/bin/env bash
# Moves the capture camera's test frames onto the device and its results off it (capture brief §11).
# The Dev build's debug harness reads frames from, and writes results to, its external files folder,
# which plain `adb push` / `adb pull` reach without `run-as`.
#
#   apps/android/tools/capture-frames.sh push [frames-root]
#       copy frames-root (default <repo>/artifacts/capture-camera/frames, the `just capture-frames`
#       output) to /sdcard/Android/data/app.aistylist.mobile.dev/files/capture-frames on the device,
#       replacing what is there, and grant the camera permission so frame runs never stop on the
#       system dialog. The Dev build must be installed (it owns that folder).
#   apps/android/tools/capture-frames.sh pull [out-dir]
#       copy capture-results.jsonl, capture-results.done (sweep finished) and capture-probe.json
#       (which detector the harness used) to out-dir (default <repo>/artifacts/capture-camera/android).
#   apps/android/tools/capture-frames.sh sweep [out-dir] [set-id-prefix] [extra am-start args...]
#       remove old results, launch the sweep (`-e captureSweep 1`, every set or those whose id starts
#       with the prefix), wait for capture-results.done (up to CAPTURE_SWEEP_TIMEOUT seconds, default
#       1800), then pull as above. Extra args go to `am start`, e.g. `-e captureBoxes stored`.
#   apps/android/tools/capture-frames.sh path
#       print the device folder.
#
# Env: ANDROID_SERIAL picks the device when several are online. Launch the harness with
#   adb shell am start -S -n app.aistylist.mobile.dev/app.aistylist.app.MainActivity \
#     -e captureFrameSet <set id> | -e captureSweep 1 [-e captureScreenReader 1]
# bash 3.2-compatible (macOS /bin/bash).
set -euo pipefail

TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TOOLS/../../.." && pwd)"
APP_ID="app.aistylist.mobile.dev"
DEVICE_DIR="/sdcard/Android/data/$APP_ID/files"
FRAMES_DIR="$DEVICE_DIR/capture-frames"

die() {
  printf 'capture-frames: %s\n' "$*" >&2
  exit 1
}

adb_bin() {
  local adb
  adb="$("$TOOLS/sdk.sh" dir)/platform-tools/adb"
  [[ -x "$adb" ]] || die "adb not found at $adb (run: just android-sdk install)"
  printf '%s' "$adb"
}

push() {
  local root="${1:-$REPO_ROOT/artifacts/capture-camera/frames}" adb
  [[ -f "$root/index.json" ]] || die "no index.json in $root (run: just capture-frames)"
  adb="$(adb_bin)"
  "$adb" shell pm path "$APP_ID" >/dev/null 2>&1 || die "$APP_ID is not installed (run: just android-run)"
  "$adb" shell rm -rf "$FRAMES_DIR"
  "$adb" shell mkdir -p "$FRAMES_DIR"
  "$adb" push "$root/." "$FRAMES_DIR/" >/dev/null 2>&1
  # Frame runs never wait on the system dialog; the permission screen is tested with `pm revoke`.
  "$adb" shell pm grant "$APP_ID" android.permission.CAMERA
  printf 'pushed %s -> %s (camera permission granted)\n' "$root" "$FRAMES_DIR"
}

pull() {
  local out="${1:-$REPO_ROOT/artifacts/capture-camera/android}" adb name pulled=0
  adb="$(adb_bin)"
  mkdir -p "$out"
  for name in capture-results.jsonl capture-results.done capture-probe.json; do
    if "$adb" shell test -f "$DEVICE_DIR/$name"; then
      "$adb" pull "$DEVICE_DIR/$name" "$out/$name" >/dev/null
      pulled=$((pulled + 1))
    fi
  done
  [[ "$pulled" -gt 0 ]] || die "no results on the device in $DEVICE_DIR"
  printf 'pulled %d file(s) to %s\n' "$pulled" "$out"
}

sweep() {
  local out="${1:-}" prefix="${2:-}" adb waited=0 timeout="${CAPTURE_SWEEP_TIMEOUT:-1800}"
  shift 2 || shift $#
  adb="$(adb_bin)"
  "$adb" shell rm -f "$DEVICE_DIR/capture-results.jsonl" "$DEVICE_DIR/capture-results.done"
  local args=(-S -n "$APP_ID/app.aistylist.app.MainActivity" -e captureSweep 1)
  [[ -z "$prefix" ]] || args+=(-e captureSweepFilter "$prefix")
  "$adb" shell am start "${args[@]}" "$@" >/dev/null
  until "$adb" shell test -f "$DEVICE_DIR/capture-results.done"; do
    [[ "$waited" -lt "$timeout" ]] || die "the sweep did not finish within ${timeout}s"
    sleep 2
    waited=$((waited + 2))
  done
  pull "$out"
}

case "${1:-}" in
  push) push "${2:-}" ;;
  sweep)
    shift
    sweep "$@"
    ;;
  pull) pull "${2:-}" ;;
  path) printf '%s\n' "$FRAMES_DIR" ;;
  *) die "usage: capture-frames.sh push [frames-root] | pull [out-dir] | sweep [out-dir] [prefix] [am-start args] | path" ;;
esac
