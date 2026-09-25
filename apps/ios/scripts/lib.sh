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
  local fix
  fix="./scripts/bootstrap.sh --system installs Xcode $(tr -d '[:space:]' <"$IOS_DIR/.xcode-version") if missing, selects it, and finishes its licence and first-launch setup"
  if ! command -v xcodebuild >/dev/null 2>&1; then
    ios_die "$recipe: xcodebuild not found. Fix: $fix"
  fi
  # /usr/bin/xcodebuild exists even when only the Command Line Tools are selected; it runs only
  # against a selected Xcode whose licence and first-launch setup are done.
  local err
  if ! err="$(xcodebuild -version 2>&1 >/dev/null)"; then
    ios_die "$recipe: xcodebuild cannot run: ${err%%$'\n'*}
Fix: $fix"
  fi
}

# Run a `swift` subcommand: the native toolchain when `swift` is on PATH (Xcode on macOS,
# a working swift on Linux), else the Docker image with the repo mounted at its host path so every
# path argument means the same thing inside the container.
# A `swift` that is on PATH but cannot run (e.g. a mise shim for a toolchain that failed to install
# on Arch: missing libncurses.so.6/libxml2.so.2) counts as absent, so Docker takes over.
ios_has_swift() {
  command -v swift >/dev/null 2>&1 && swift --version >/dev/null 2>&1
}

ios_swift() {
  if ios_has_swift; then
    swift "$@"
  elif command -v docker >/dev/null 2>&1; then
    mkdir -p "$IOS_BUILD_DIR/docker-home"
    echo "(no working swift on PATH: running it in Docker $SWIFT_DOCKER_IMAGE)" >&2
    docker run --rm \
      --user "$(id -u):$(id -g)" \
      -e HOME="$IOS_BUILD_DIR/docker-home" \
      -v "$REPO_ROOT:$REPO_ROOT" \
      -w "$PWD" \
      "$SWIFT_DOCKER_IMAGE" swift "$@"
  else
    ios_die "no Swift toolchain: install Xcode (macOS), or Docker / a working swift on PATH (Linux)"
  fi
}
