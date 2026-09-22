#!/usr/bin/env bash
# Run one native-app gate step (apps/ios, apps/android) from an aggregate recipe (`just lint`,
# `just format`, `just test`, `just arch-check`, `just ci-parity`), or say loudly why it did not run.
#
#   scripts/native-lane.sh <ios|android> <swift|xcode|android|none> <command...>
#
# Lane selection: NATIVE_LANES (space- or comma-separated subset of "ios android"; "none" = neither;
#   unset = both). `just ci-parity --core` sets it to "none": the native lanes then run in
#   .github/workflows/ios.yml and android.yml instead of the pr-gate parity job.
# Toolchain per step:
#   swift    a working `swift` on PATH, else Docker (image swift:6.4; Arch's mise swift cannot run)
#   xcode    macOS + xcodebuild. On Linux the step is SKIPPED with a notice, always (Xcode cannot
#            exist there); the ios workflow's macOS job runs it.
#   android  JDK 21 on PATH + the SDK packages apps/android/tools/sdk.sh checks
#   none     nothing beyond bash
# Missing toolchain: FAIL when CI=true or NATIVE_STRICT=1 (`just ci-parity` sets it), otherwise a
# SKIPPED notice on stderr with the install hint. A skip is never silent.
# bash 3.2-clean (macOS /bin/bash).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -lt 3 ]]; then
  echo "usage: scripts/native-lane.sh <ios|android> <swift|xcode|android|none> <command...>" >&2
  exit 2
fi
lane="$1"
toolchain="$2"
shift 2
case "$lane" in
  ios | android) ;;
  *) echo "native-lane: unknown lane '$lane' (ios|android)" >&2; exit 2 ;;
esac

strict=0
if [[ "${CI:-}" == "true" || "${NATIVE_STRICT:-}" == "1" ]]; then
  strict=1
fi

lane_selected() {
  local lanes="${NATIVE_LANES-ios android}" l
  for l in ${lanes//,/ }; do
    [[ "$l" == "$1" ]] && return 0
  done
  return 1
}

if ! lane_selected "$lane"; then
  echo "native-lane: $lane lane not selected (NATIVE_LANES='${NATIVE_LANES-}'): not running: $*" >&2
  exit 0
fi

# Why the toolchain is missing, or empty when it is present.
missing=""
hint=""
case "$toolchain" in
  none) ;;
  swift)
    if ! { command -v swift >/dev/null 2>&1 && swift --version >/dev/null 2>&1; } \
      && ! command -v docker >/dev/null 2>&1; then
      missing="no working swift on PATH and no docker"
      hint="install Xcode (macOS) or Docker (Linux; image swift:6.4 is pulled on first use)"
    fi
    ;;
  xcode)
    if [[ "$(uname -s)" != "Darwin" ]]; then
      echo "native-lane: SKIPPED on $(uname -s): '$*' needs Xcode, which only runs on macOS." >&2
      echo "native-lane:   the ios workflow's macOS job (.github/workflows/ios.yml) runs it; on a Mac run it locally." >&2
      exit 0
    fi
    if ! command -v xcodebuild >/dev/null 2>&1; then
      missing="xcodebuild not found"
      hint="install the Xcode in apps/ios/.xcode-version and run \`just ios-doctor\`"
    fi
    ;;
  android)
    # Same JDK apps/android/tools/gradle.sh will use: $JAVA_HOME when set, else `java` on PATH.
    java_bin="java"
    if [[ -n "${JAVA_HOME:-}" ]]; then java_bin="$JAVA_HOME/bin/java"; fi
    java_major=""
    if command -v "$java_bin" >/dev/null 2>&1; then
      java_major="$("$java_bin" -XshowSettings:properties -version 2>&1 | sed -n 's/^ *java\.specification\.version = //p')"
    fi
    if [[ "$java_major" != "21" ]]; then
      missing="JDK 21 required, found '${java_major:-none}' (${JAVA_HOME:+JAVA_HOME=$JAVA_HOME, }java=$java_bin)"
      hint="run \`mise install\` (mise.toml pins Temurin 21); unset or fix a stale JAVA_HOME"
    elif ! "$REPO_ROOT/apps/android/tools/sdk.sh" check >/dev/null 2>&1; then
      missing="Android SDK incomplete"
      hint="run \`just android-sdk install\` (user-level, no sudo), then \`just doctor\`"
    fi
    ;;
  *) echo "native-lane: unknown toolchain '$toolchain' (swift|xcode|android|none)" >&2; exit 2 ;;
esac

if [[ -n "$missing" ]]; then
  if [[ $strict -eq 1 ]]; then
    echo "native-lane: FAIL: '$*' ($lane lane): $missing; $hint" >&2
    echo "native-lane:   (strict because CI=true or NATIVE_STRICT=1; NATIVE_LANES=none deselects the native lanes)" >&2
    exit 1
  fi
  echo "native-lane: SKIPPED: '$*' ($lane lane): $missing; $hint" >&2
  exit 0
fi

cd "$REPO_ROOT"
exec "$@"
