#!/usr/bin/env bash
# The capture camera's simulator test loop: `just capture-sim-ios`, `just capture-sim-android`,
# `just capture-sim` (both). Capture brief §0 finish line, §11, §12; tools/capture-frames/README.md
# "Simulator runs". One run:
#   1. builds the frames (`just capture-frames`, unchanged inputs reuse the last output);
#   2. per platform: builds and installs the Dev app, plays every frame set in a sweep on the
#      harness's virtual clock, plays a few locked sets again with the screen-reader flag, and pulls
#      the results logs;
#   3. runs every Maestro flow in e2e/capture/ in light and in dark, keeping its screenshots;
#   4. scores the logs (capture-score.mjs) and writes summary.md and the scoreboard row
#      (capture-report.mjs).
# Output: artifacts/capture-camera/runs/<yyyy-mm-dd-hhmm>/ (raw/, results/, maestro/, screenshots/,
# summary.md) and artifacts/capture-camera/scoreboard.md. All gitignored.
# Usage: capture-sim.sh ios|android|all
# Env: IOS_SIMULATOR_ID (default: the iPhone 18 Pro on the newest iOS runtime), ANDROID_SERIAL,
#      CAPTURE_SWEEP_TIMEOUT (seconds per sweep, default 1800).
# Exit: 0 every platform met the finish line; 1 a case, flow or step failed; 2 misuse.
# macOS for iOS; bash 3.2-compatible.
set -euo pipefail
# shellcheck source=../../scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/../../scripts/lib.sh"

APP_ID="app.aistylist.mobile.dev"
TOOL_DIR="$REPO_ROOT/tools/capture-frames"
OUT_DIR="$REPO_ROOT/artifacts/capture-camera"
FRAMES_DIR="$OUT_DIR/frames"
FLOWS_DIR="$REPO_ROOT/e2e/capture"
ANDROID_FRAMES="$REPO_ROOT/apps/android/tools/capture-frames.sh"
SWEEP_TIMEOUT="${CAPTURE_SWEEP_TIMEOUT:-1800}"
# Locked sets played again with the screen-reader flag: "Take photo anyway" must show at once (C25).
READER_SETS="top-flat-01-jitter top-flat-01-cut-top top-flat-empty top-worn-shoulders-cut"
# The photo the import flow picks (C21): a too-dark frame, so the tips screen shows.
IMPORT_PHOTO="top/top-flat-01-too-dark/frame.png"
# The symbol-uploading keys never reach an iOS build here (.claude/rules/design-system.md inv. 10).
NO_UPLOAD=(env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID)

export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

new_run_dir() {
  local base dir n=2
  base="$OUT_DIR/runs/$(date +%Y-%m-%d-%H%M)"
  dir="$base"
  while [[ -e "$dir" ]]; do
    dir="$base-$n"
    n=$((n + 1))
  done
  mkdir -p "$dir"
  printf '%s\n' "$dir"
}

# Waits until command "$@" succeeds, polling every 2 s, for at most SWEEP_TIMEOUT seconds.
wait_for() {
  local what="$1" waited=0
  shift
  until "$@" 2>/dev/null; do
    [[ "$waited" -lt "$SWEEP_TIMEOUT" ]] || die "capture-sim: $what did not finish within ${SWEEP_TIMEOUT}s"
    sleep 2
    waited=$((waited + 2))
  done
}

# Puts the import flow's photo in platform $1's photo library, as the newest photo.
add_photo() {
  local adb target
  case "$1" in
    ios) xcrun simctl addmedia "$IOS_UDID" "$FRAMES_DIR/$IMPORT_PHOTO" ;;
    android)
      adb="$(android_adb)"
      target="/sdcard/Pictures/capture-import-$(date +%s).png"
      "$adb" push "$FRAMES_DIR/$IMPORT_PHOTO" "$target" >/dev/null
      "$adb" shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://$target" >/dev/null
      ;;
  esac
}

# Android only, before each flow: close any system screen a failed flow left open (the photo picker
# survives Maestro's app stop), and push the frames again when a flow's clearState wiped the app's
# external files, which hold them (on iOS they stay on the Mac).
android_before_flow() {
  local adb
  adb="$(android_adb)"
  "$adb" shell input keyevent KEYCODE_BACK
  "$adb" shell input keyevent KEYCODE_BACK
  "$adb" shell am force-stop "$APP_ID"
  if ! "$adb" shell test -f "$("$ANDROID_FRAMES" path)/index.json"; then
    "$ANDROID_FRAMES" push "$FRAMES_DIR" >/dev/null
  fi
}

# Runs every flow in e2e/capture/ on device $2 for platform $1 in the current theme $4, into run $3.
run_flows() {
  local platform="$1" device="$2" run="$3" theme="$4" flow name out code shot
  for flow in "$FLOWS_DIR"/*.yaml; do
    name="$(basename "$flow" .yaml)"
    out="$run/maestro/$platform/$theme/$name"
    rm -rf "$out"
    mkdir -p "$out" "$run/screenshots/$platform/$theme"
    [[ "$platform" != android ]] || android_before_flow
    [[ "$name" != import ]] || add_photo "$platform"
    log "$platform $theme: $name"
    code=0
    maestro --device "$device" test --test-output-dir "$out" -e "APP_ID=$APP_ID" "$flow" >"$out.log" 2>&1 || code=$?
    printf '%s\n' "$code" >"$out.status"
    [[ "$code" -eq 0 ]] || warn "$platform $theme: $name failed (exit $code): $out.log"
    while IFS= read -r shot; do
      cp "$shot" "$run/screenshots/$platform/$theme/$name-$(basename "$shot")"
    done < <(find "$out" -path '*/takeScreenshot/*.png' | sort)
    # Maestro copies the device's system log in logs/; it is not needed to judge a flow, and its
    # scene tokens trip the working-tree secret scan (`just security-scan`).
    find "$out" -type d -name logs -prune -exec rm -rf {} +
  done
}

score() {
  local platform="$1" run="$2"
  local reader="$run/raw/$platform/screen-reader.jsonl"
  node "$TOOL_DIR/capture-score.mjs" --platform "$platform" --frames "$FRAMES_DIR" \
    --results "$run/raw/$platform/sweep.jsonl" --screen-reader "$reader" --out "$run" || true
}

# --- iOS --------------------------------------------------------------------------------------

ios_udid() {
  if [[ -n "${IOS_SIMULATOR_ID:-}" ]]; then
    printf '%s\n' "$IOS_SIMULATOR_ID"
    return
  fi
  xcrun simctl list devices available -j | node -e '
    const devices = JSON.parse(require("node:fs").readFileSync(0, "utf8")).devices;
    const runtimes = Object.keys(devices).filter((r) => /iOS-\d+/.test(r))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const runtime of runtimes) {
      const phone = devices[runtime].find((d) => d.name === "iPhone 18 Pro");
      if (phone) { process.stdout.write(phone.udid); process.exit(0); }
    }
    process.exit(1);
  ' || die "capture-sim: no iPhone 18 Pro simulator; create one (Xcode > Settings > Components) or set IOS_SIMULATOR_ID"
}

ios_results() {
  printf '%s/Documents/%s\n' "$(xcrun simctl get_app_container "$1" "$APP_ID" data)" "$2"
}

# Launches the harness with "$@" and copies the finished sweep's log to $out.
ios_sweep() {
  local udid="$1" out="$2" done_file
  shift 2
  xcrun simctl launch --terminate-running-process "$udid" "$APP_ID" -captureSweep 1 -captureFramesDir "$FRAMES_DIR" "$@" >/dev/null
  done_file="$(ios_results "$udid" capture-results.done)"
  sleep 2
  wait_for "the iOS sweep ($*)" test -f "$done_file"
  cat "$(ios_results "$udid" capture-results.jsonl)" >>"$out"
}

run_ios() {
  local run="$1" raw="$1/raw/ios" set theme
  os_is_darwin || die "capture-sim-ios: macOS only (Xcode and the iOS Simulator)"
  have maestro || die "capture-sim-ios: maestro not found (mise install maestro)"
  heading "iOS"
  "${NO_UPLOAD[@]}" just ios-build --config dev
  IOS_UDID="$(ios_udid)"
  xcrun simctl boot "$IOS_UDID" 2>/dev/null || true
  xcrun simctl bootstatus "$IOS_UDID" -b >/dev/null
  xcrun simctl install "$IOS_UDID" "$REPO_ROOT/apps/ios/.build/DerivedData/Build/Products/Dev-iphonesimulator/AIStylist.app"
  mkdir -p "$raw"
  log "iOS sweep: every frame set on the virtual clock"
  : >"$raw/sweep.jsonl"
  ios_sweep "$IOS_UDID" "$raw/sweep.jsonl"
  : >"$raw/screen-reader.jsonl"
  for set in $READER_SETS; do
    log "iOS screen-reader sweep: $set"
    ios_sweep "$IOS_UDID" "$raw/screen-reader.jsonl" -captureFrameSet "$set" -captureScreenReader 1
  done
  xcrun simctl terminate "$IOS_UDID" "$APP_ID" 2>/dev/null || true
  for theme in light dark; do
    xcrun simctl ui "$IOS_UDID" appearance "$theme"
    run_flows ios "$IOS_UDID" "$run" "$theme"
  done
  xcrun simctl ui "$IOS_UDID" appearance light
  score ios "$run"
}

# --- Android ----------------------------------------------------------------------------------

android_adb() {
  printf '%s/platform-tools/adb\n' "$("$REPO_ROOT/apps/android/tools/sdk.sh" dir)"
}

run_android() {
  local run="$1" raw="$1/raw/android" adb serial set theme
  [[ -x "$ANDROID_FRAMES" && -d "$REPO_ROOT/apps/android/feature/capture-debug" ]] \
    || die "capture-sim-android: the Android capture harness is not merged on this branch (apps/android/feature/capture-debug and apps/android/tools/capture-frames.sh are missing). Nothing was run."
  have maestro || die "capture-sim-android: maestro not found (mise install maestro)"
  heading "Android"
  # Builds and installs the debug build; boots the AVD aistylist-dev when no device is online. No
  # Gradle build runs after this point: a build beside a sweep has wedged the emulator.
  just android-run
  adb="$(android_adb)"
  serial="${ANDROID_SERIAL:-$("$adb" devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')}"
  [[ -n "$serial" ]] || die "capture-sim-android: no device online after android-run"
  export ANDROID_SERIAL="$serial"
  "$ANDROID_FRAMES" push "$FRAMES_DIR"
  mkdir -p "$raw"
  log "Android sweep: every frame set, stored boxes and keypoints (the scored run)"
  "$ANDROID_FRAMES" sweep "$raw/stored" "" -e captureBoxes stored -e capturePose stored
  cp "$raw/stored/capture-results.jsonl" "$raw/sweep.jsonl"
  : >"$raw/screen-reader.jsonl"
  for set in $READER_SETS; do
    log "Android screen-reader sweep: $set"
    "$ANDROID_FRAMES" sweep "$raw/reader-$set" "$set" -e captureScreenReader 1
    cat "$raw/reader-$set/capture-results.jsonl" >>"$raw/screen-reader.jsonl"
  done
  log "Android sweep: live ML Kit detection and pose (information only)"
  if "$ANDROID_FRAMES" sweep "$raw/live" "" -e captureBoxes live -e capturePose live; then
    android_live_info "$run"
  fi
  "$adb" shell am force-stop "$APP_ID"
  for theme in light dark; do
    if [[ "$theme" == dark ]]; then "$adb" shell cmd uimode night yes; else "$adb" shell cmd uimode night no; fi
    run_flows android "$serial" "$run" "$theme"
  done
  "$adb" shell cmd uimode night no
  score android "$run"
}

# Scores the live ML Kit sweep apart and writes its numbers as a note for summary.md.
android_live_info() {
  local run="$1" scratch="$1/raw/android/live-score" line
  line="$(node "$TOOL_DIR/capture-score.mjs" --platform android --frames "$FRAMES_DIR" \
    --results "$run/raw/android/live/capture-results.jsonl" --out "$scratch" || true)"
  mkdir -p "$run/results"
  printf '### Live ML Kit sweep (information only)\n\nThe scored run uses stored boxes and keypoints. With live ML Kit object detection and pose on the emulator: %s Live detection quality is device-only.\n' \
    "${line#capture-score android: }" >"$run/results/android.info.md"
}

main() {
  local target="${1:-}" run platforms code=0
  case "$target" in
    ios) platforms=ios ;;
    android) platforms=android ;;
    all) platforms=ios,android ;;
    *)
      printf 'usage: capture-sim.sh ios|android|all\n' >&2
      exit 2
      ;;
  esac
  have node || die "capture-sim: node not found (mise install)"
  bash "$TOOL_DIR/capture-frames.sh"
  run="$(new_run_dir)"
  log "Run folder: $run"
  [[ "$target" == android ]] || run_ios "$run"
  [[ "$target" == ios ]] || run_android "$run"
  node "$TOOL_DIR/capture-report.mjs" --run "$run" --scoreboard "$OUT_DIR/scoreboard.md" \
    --commit "$(git -C "$REPO_ROOT" rev-parse --short HEAD)$(git -C "$REPO_ROOT" diff --quiet HEAD || printf '+dirty')" \
    --platforms "$platforms" || code=$?
  log "Summary: $run/summary.md · scoreboard: $OUT_DIR/scoreboard.md"
  exit "$code"
}

main "$@"
