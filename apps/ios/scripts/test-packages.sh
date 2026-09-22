#!/usr/bin/env bash
# `just ios-test-packages [core|features]...`: `swift test` for the local Swift packages.
# Runs on macOS (Xcode's swift) AND Linux (mise swift, or Docker swift:6.4 when swift is not on
# PATH). No simulator: this is the fast unit-test lane for everything that is not a SwiftUI view.
#   core      apps/ios/Packages/Core      (config, analytics, services, API data via the generated client)
#   features  apps/ios/Packages/Features  (view models; SwiftUI views are compiled on Apple platforms only)
# No argument = both.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

packages=()
for arg in "$@"; do
  case "$arg" in
    core) packages+=(Core) ;;
    features) packages+=(Features) ;;
    -h | --help) sed -n '2,7p' "$0"; exit 0 ;;
    *) ios_die "ios-test-packages: unknown package '$arg' (use core|features)" ;;
  esac
done
if [[ ${#packages[@]} -eq 0 ]]; then
  packages=(Core Features)
fi

cd "$REPO_ROOT"
for pkg in "${packages[@]}"; do
  echo "==> swift test: apps/ios/Packages/$pkg"
  # Build products go to apps/ios/.build/<pkg> (gitignored) instead of the package directory.
  ios_swift test \
    --package-path "$IOS_DIR/Packages/$pkg" \
    --scratch-path "$IOS_BUILD_DIR/spm-$pkg"
done
