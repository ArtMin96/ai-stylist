#!/usr/bin/env bash
# Shared helpers for apps/ios/scripts/*.sh. Source it; do not run it.
# Portable bash (macOS bash 3.2 compatible): no associative arrays, no ${var,,}, no mapfile.
# shellcheck shell=bash

IOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$IOS_DIR/../.." && pwd)"
# Local build state (gitignored by apps/ios/.gitignore).
IOS_BUILD_DIR="$IOS_DIR/.build"
SWIFT_DOCKER_IMAGE="${SWIFT_DOCKER_IMAGE:-swift:6.4}"

# Swift sources we own and lint/format. Generated code (packages/contracts/gen/swift-client)
# and the ban-script fixtures are deliberately not listed.
# shellcheck disable=SC2034  # used by the scripts that source this file
IOS_SWIFT_DIRS=("$IOS_DIR/App" "$IOS_DIR/Packages")

ios_die() {
  echo "$*" >&2
  exit 1
}

ios_is_macos() {
  [[ "$(uname -s)" == "Darwin" ]]
}

# Stop with a clear message on anything that is not macOS (Xcode-only recipes).
ios_require_macos() {
  local recipe="$1"
  if ! ios_is_macos; then
    ios_die "$recipe: needs Xcode, which only runs on macOS (this is $(uname -s)). Run it on the Mac, or push and let .github/workflows/ios.yml run it. On Linux you can run: just ios-lint, just ios-format --check, just ios-check-banned, just ios-test-packages."
  fi
  if ! command -v xcodebuild >/dev/null 2>&1; then
    ios_die "$recipe: xcodebuild not found. Install Xcode $(cat "$IOS_DIR/.xcode-version") and run: sudo xcode-select -s /Applications/Xcode.app"
  fi
}

# Run a `swift` subcommand: the native toolchain when `swift` is on PATH (Xcode on macOS,
# mise swift on Linux), else the Docker image with the repo mounted at its host path so every
# path argument means the same thing inside the container.
ios_swift() {
  if command -v swift >/dev/null 2>&1; then
    swift "$@"
  elif command -v docker >/dev/null 2>&1; then
    mkdir -p "$IOS_BUILD_DIR/docker-home"
    echo "(swift not on PATH: running it in Docker $SWIFT_DOCKER_IMAGE)" >&2
    docker run --rm \
      --user "$(id -u):$(id -g)" \
      -e HOME="$IOS_BUILD_DIR/docker-home" \
      -v "$REPO_ROOT:$REPO_ROOT" \
      -w "$PWD" \
      "$SWIFT_DOCKER_IMAGE" swift "$@"
  else
    ios_die "no Swift toolchain: install Xcode (macOS), or mise swift / Docker (Linux)"
  fi
}
