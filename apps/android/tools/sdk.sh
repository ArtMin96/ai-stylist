#!/usr/bin/env bash
# Check or install the Android SDK packages apps/android needs. Nothing else (no emulator).
#
#   apps/android/tools/sdk.sh check     exit 1 listing what is missing (read-only)
#   apps/android/tools/sdk.sh install   user-level install into $ANDROID_HOME (default ~/Android/Sdk,
#                                       macOS ~/Library/Android/sdk); idempotent; no sudo
#
# Keep PACKAGES in step with build-logic (compileSdk 37) and AGP's default build-tools.
# Env: ANDROID_HOME / ANDROID_SDK_ROOT; SDKMANAGER_OPTS (e.g. -Djava.net.preferIPv4Stack=true on
# hosts with a broken IPv6 route, where sdkmanager otherwise hangs).
# bash 3.2-compatible (macOS /bin/bash).
set -euo pipefail

PACKAGES=("platform-tools" "platforms;android-37.0" "build-tools;36.0.0")
# cmdline-tools 19.0: its `sdkmanager` is the classic Java tool (verified 2026-09-22). 23.0's
# is a shim over the new `android` CLI, which bootstraps itself into ~/.android and hung on IPv6.
CLT_VERSION="19.0"
CLT_BUILD="13114758"
CLT_SHA1_LINUX="5fdcc763663eefb86a5b8879697aa6088b041e70"
CLT_SHA1_MAC="c3e06a1959762e89167d1cbaa988605f6f7c1d24"

mode="${1:-check}"

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$sdk" ]]; then
  case "$(uname -s)" in
    Darwin) sdk="$HOME/Library/Android/sdk" ;;
    *) sdk="$HOME/Android/Sdk" ;;
  esac
fi

dir_for() { printf '%s/%s' "$sdk" "$(printf '%s' "$1" | tr ';' '/')"; }

check() {
  local missing=0 pkg
  for pkg in "${PACKAGES[@]}"; do
    if [[ -d "$(dir_for "$pkg")" ]]; then
      echo "ok       $pkg"
    else
      echo "MISSING  $pkg"
      missing=1
    fi
  done
  if [[ ! -f "$sdk/licenses/android-sdk-license" ]]; then
    echo "MISSING  SDK licenses ($sdk/licenses/android-sdk-license)"
    missing=1
  fi
  if ((missing)); then
    echo "android sdk: incomplete at $sdk; run \`apps/android/tools/sdk.sh install\`" >&2
    return 1
  fi
  echo "android sdk: complete at $sdk"
}

find_sdkmanager() {
  local candidate
  for candidate in "$sdk/cmdline-tools/$CLT_VERSION/bin/sdkmanager" "$sdk/cmdline-tools/latest/bin/sdkmanager"; do
    if [[ -x "$candidate" ]]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

install() {
  local sdkmanager tmp os sha
  if ! sdkmanager="$(find_sdkmanager)"; then
    case "$(uname -s)" in
      Darwin) os="mac"; sha="$CLT_SHA1_MAC" ;;
      *) os="linux"; sha="$CLT_SHA1_LINUX" ;;
    esac
    if [[ -z "$sha" ]]; then
      echo "android sdk: no pinned checksum for cmdline-tools on $os; install Android Studio instead" >&2
      return 1
    fi
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' RETURN
    curl -fsSL --retry 3 -o "$tmp/clt.zip" \
      "https://dl.google.com/android/repository/commandlinetools-${os}-${CLT_BUILD}_latest.zip"
    if command -v sha1sum >/dev/null 2>&1; then
      echo "$sha  $tmp/clt.zip" | sha1sum -c - >/dev/null
    else
      echo "$sha  $tmp/clt.zip" | shasum -a 1 -c - >/dev/null
    fi
    unzip -q "$tmp/clt.zip" -d "$tmp"
    mkdir -p "$sdk/cmdline-tools"
    rm -rf "${sdk:?}/cmdline-tools/$CLT_VERSION"
    mv "$tmp/cmdline-tools" "$sdk/cmdline-tools/$CLT_VERSION"
    sdkmanager="$sdk/cmdline-tools/$CLT_VERSION/bin/sdkmanager"
  fi
  yes | "$sdkmanager" --sdk_root="$sdk" --licenses >/dev/null 2>&1 || true
  "$sdkmanager" --sdk_root="$sdk" --install "${PACKAGES[@]}" >/dev/null
  check
}

case "$mode" in
  check) check ;;
  install) install ;;
  -h | --help) sed -n '2,12p' "$0" ;;
  *) echo "sdk.sh: unknown mode '$mode' (use check|install)" >&2; exit 2 ;;
esac
