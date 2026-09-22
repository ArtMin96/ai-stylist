#!/usr/bin/env bash
# Xcode-side iOS recipes. Everything except `doctor` needs macOS + Xcode and exits 1 with a clear
# message elsewhere.
#
#   xcode.sh doctor                       toolchain check (on Linux: reports what can run there)
#   xcode.sh project                      apps/ios/project.yml -> apps/ios/AIStylist.xcodeproj (XcodeGen)
#   xcode.sh build [--config dev|preview|prod]   unsigned simulator build (default dev)
#   xcode.sh test                         package unit tests through the AIStylist-Dev scheme on a simulator
#   xcode.sh e2e                          Prod simulator build + Maestro e2e/smoke.yaml (appId app.aistylist.mobile)
#
# Env: IOS_SIMULATOR_ID  simulator UDID to use (default: first available iPhone on the newest iOS runtime)
# Build state goes to apps/ios/.build/ (gitignored): DerivedData, SourcePackages, test.xcresult.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

PROJECT="$IOS_DIR/AIStylist.xcodeproj"
DERIVED_DATA="$IOS_BUILD_DIR/DerivedData"
SOURCE_PACKAGES="$IOS_BUILD_DIR/SourcePackages"
RESULT_BUNDLE="$IOS_BUILD_DIR/test.xcresult"
PINNED_XCODE="$(tr -d '[:space:]' <"$IOS_DIR/.xcode-version")"

usage() {
  sed -n '2,13p' "$0"
}

# Pipe xcodebuild output through xcbeautify when it is installed (GitHub renderer in CI).
beautify() {
  if command -v xcbeautify >/dev/null 2>&1; then
    if [[ "${CI:-}" == "true" ]]; then
      xcbeautify --renderer github-actions
    else
      xcbeautify
    fi
  else
    cat
  fi
}

run_xcodebuild() {
  xcodebuild \
    -project "$PROJECT" \
    -derivedDataPath "$DERIVED_DATA" \
    -clonedSourcePackagesDirPath "$SOURCE_PACKAGES" \
    "$@" | beautify
}

config_name() {
  case "$1" in
    dev) echo Dev ;;
    preview) echo Preview ;;
    prod) echo Prod ;;
    *) ios_die "ios-build: --config must be dev|preview|prod (got '$1')" ;;
  esac
}

# UDID of the first available iPhone on the newest iOS runtime (26+), or $IOS_SIMULATOR_ID.
pick_simulator() {
  if [[ -n "${IOS_SIMULATOR_ID:-}" ]]; then
    echo "$IOS_SIMULATOR_ID"
    return 0
  fi
  local udid
  udid="$(xcrun simctl list devices available | awk '
    /^-- iOS [0-9]+/ { split($3, v, "."); major = v[1] + 0; current = ""; next }
    /^-- / { major = 0; next }
    major >= 26 && current == "" && /iPhone/ {
      if (match($0, /\([0-9A-F]+-[0-9A-F]+-[0-9A-F]+-[0-9A-F]+-[0-9A-F]+\)/)) {
        current = substr($0, RSTART + 1, RLENGTH - 2); best = current
      }
    }
    END { print best }
  ')"
  if [[ -z "$udid" ]]; then
    ios_die "ios: no available iPhone simulator on iOS 26+. Install one: Xcode > Settings > Components (or set IOS_SIMULATOR_ID)."
  fi
  echo "$udid"
}

cmd_doctor() {
  if ! ios_is_macos; then
    echo "ios-doctor: $(uname -s): Xcode steps (ios-project, ios-build, ios-test, ios-e2e) are N/A here."
    if ios_has_swift; then
      echo "  swift: $(swift --version 2>&1 | head -n 1)"
    elif command -v docker >/dev/null 2>&1; then
      echo "  swift: none working on PATH; Docker fallback image $SWIFT_DOCKER_IMAGE will be used"
    else
      echo "  swift: MISSING (mise install swift, or install Docker)"
    fi
    if command -v swiftlint-static >/dev/null 2>&1 || command -v swiftlint >/dev/null 2>&1; then
      echo "  swiftlint: ok"
    else
      echo "  swiftlint: missing (mise install swiftlint); ios-lint will skip locally"
    fi
    return 0
  fi
  ios_require_macos ios-doctor
  local actual status=0
  actual="$(xcodebuild -version | awk 'NR == 1 { print $2 }')"
  if [[ "$actual" == "$PINNED_XCODE" ]]; then
    echo "  Xcode: $actual (pinned $PINNED_XCODE) ok"
  else
    echo "  Xcode: $actual, but apps/ios/.xcode-version pins $PINNED_XCODE. Install it (xcodes install $PINNED_XCODE) and select it (sudo xcode-select -s /Applications/Xcode-$PINNED_XCODE.app, or set DEVELOPER_DIR)." >&2
    status=1
  fi
  if command -v xcodegen >/dev/null 2>&1; then
    echo "  xcodegen: ok"
  else
    echo "  xcodegen: MISSING (mise install xcodegen)" >&2
    status=1
  fi
  local tool
  for tool in swiftlint xcbeautify maestro; do
    if command -v "$tool" >/dev/null 2>&1; then
      echo "  $tool: ok"
    else
      echo "  $tool: not installed (optional: mise install $tool)"
    fi
  done
  return "$status"
}

cmd_project() {
  ios_require_macos ios-project
  command -v xcodegen >/dev/null 2>&1 || ios_die "ios-project: xcodegen not found (mise install xcodegen)"
  xcodegen generate --quiet --spec "$IOS_DIR/project.yml" --project "$IOS_DIR"
  # Seed Xcode's package pins from the committed Core lockfile (Core pulls in every remote package),
  # so Xcode resolves the same versions as `swift test` does.
  local resolved_dir="$PROJECT/project.xcworkspace/xcshareddata/swiftpm"
  mkdir -p "$resolved_dir"
  cp "$IOS_DIR/Packages/Core/Package.resolved" "$resolved_dir/Package.resolved"
  echo "ios-project: generated ${PROJECT#"$REPO_ROOT"/}"
}

cmd_build() {
  local config=dev
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --config)
        [[ $# -ge 2 ]] || ios_die "ios-build: --config needs a value (dev|preview|prod)"
        config="$2"
        shift 2
        ;;
      *) ios_die "ios-build: unknown argument '$1' (use --config dev|preview|prod)" ;;
    esac
  done
  local name
  name="$(config_name "$config")"
  ios_require_macos ios-build
  cmd_project
  echo "==> xcodebuild build: scheme AIStylist-$name, iOS Simulator, unsigned"
  run_xcodebuild build \
    -scheme "AIStylist-$name" \
    -configuration "$name" \
    -destination 'generic/platform=iOS Simulator' \
    CODE_SIGNING_ALLOWED=NO
}

cmd_test() {
  [[ $# -eq 0 ]] || ios_die "ios-test: takes no arguments"
  ios_require_macos ios-test
  cmd_project
  local udid
  udid="$(pick_simulator)"
  rm -rf "$RESULT_BUNDLE"
  echo "==> xcodebuild test: scheme AIStylist-Dev on simulator $udid"
  run_xcodebuild test \
    -scheme AIStylist-Dev \
    -configuration Dev \
    -destination "platform=iOS Simulator,id=$udid" \
    -resultBundlePath "$RESULT_BUNDLE" \
    CODE_SIGNING_ALLOWED=NO
}

cmd_e2e() {
  [[ $# -eq 0 ]] || ios_die "ios-e2e: takes no arguments"
  ios_require_macos ios-e2e
  command -v maestro >/dev/null 2>&1 || ios_die "ios-e2e: maestro not found (mise install maestro; needs Java)"
  local flow="$REPO_ROOT/e2e/smoke.yaml"
  [[ -f "$flow" ]] || ios_die "ios-e2e: shared Maestro flow ${flow#"$REPO_ROOT"/} not found"
  # The shared flow targets appId app.aistylist.mobile, which is the Prod bundle id.
  cmd_build --config prod
  local app="$DERIVED_DATA/Build/Products/Prod-iphonesimulator/AIStylist.app"
  [[ -d "$app" ]] || ios_die "ios-e2e: built app not found at $app"
  local udid
  udid="$(pick_simulator)"
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b
  xcrun simctl install "$udid" "$app"
  maestro --device "$udid" test "$flow"
}

cmd="${1:-}"
if [[ $# -gt 0 ]]; then
  shift
fi
case "$cmd" in
  doctor) cmd_doctor "$@" ;;
  project) cmd_project "$@" ;;
  build) cmd_build "$@" ;;
  test) cmd_test "$@" ;;
  e2e) cmd_e2e "$@" ;;
  -h | --help | "") usage ;;
  *) ios_die "xcode.sh: unknown command '$cmd' (doctor|project|build|test|e2e)" ;;
esac
