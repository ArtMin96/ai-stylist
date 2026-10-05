#!/usr/bin/env bash
# Check or install the Android SDK packages apps/android needs to build, and, on request, the ones
# an emulator needs.
#
#   apps/android/tools/sdk.sh check     exit 1 listing what is missing (read-only)
#   apps/android/tools/sdk.sh install   user-level install into $ANDROID_HOME (default ~/Android/Sdk,
#                                       macOS ~/Library/Android/sdk); idempotent; no sudo
#   apps/android/tools/sdk.sh emulator [image]
#                                       also install the emulator + one system image (default: the
#                                       pinned Google APIs image for this CPU, see EMULATOR_API), then
#                                       print the image package on the last line; idempotent; no sudo
#   apps/android/tools/sdk.sh dir       print the SDK directory
#   apps/android/tools/sdk.sh bin       print the cmdline-tools bin directory (sdkmanager, avdmanager);
#                                       exit 1 when cmdline-tools are not installed
#
# Keep PACKAGES in step with build-logic (compileSdk 37) and AGP's default build-tools.
# Env: ANDROID_HOME / ANDROID_SDK_ROOT; SDKMANAGER_OPTS (e.g. -Djava.net.preferIPv4Stack=true on
# hosts with a broken IPv6 route, where sdkmanager otherwise hangs); ANDROID_SYSTEM_IMAGE (a full
# `system-images;...` package for `emulator`, instead of the pinned one).
# bash 3.2-compatible (macOS /bin/bash).
set -euo pipefail

PACKAGES=("platform-tools" "platforms;android-37.0" "build-tools;36.0.0")
# cmdline-tools 19.0: its `sdkmanager` is the classic Java tool (verified 2026-09-22). 23.0's
# is a shim over the new `android` CLI, which bootstraps itself into ~/.android and hung on IPv6.
CLT_VERSION="19.0"
CLT_BUILD="13114758"
CLT_SHA1_LINUX="5fdcc763663eefb86a5b8879697aa6088b041e70"
CLT_SHA1_MAC="c3e06a1959762e89167d1cbaa988605f6f7c1d24"
# Emulator system image: Google APIs (no Play Store, so it is rootable and has no Google sign-in
# prompt) at this API level, for the host CPU (arm64-v8a on Apple silicon and arm64 Linux, x86_64
# elsewhere). minSdk is 29, so any level from 29 up runs the app. When this level is not offered for
# the host CPU, `emulator` falls back to the newest Google APIs level that is.
EMULATOR_API="36"

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

# The sdkmanager to use, downloading the pinned cmdline-tools (sha1-checked) when none is installed.
ensure_sdkmanager() {
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
    # Callers read this function's output with $(...), where bash does not apply `set -e`: every
    # step ends in `|| return 1`.
    tmp="$(mktemp -d)" || return 1
    trap 'rm -rf "$tmp"' RETURN
    curl -fsSL --retry 3 -o "$tmp/clt.zip" \
      "https://dl.google.com/android/repository/commandlinetools-${os}-${CLT_BUILD}_latest.zip" || return 1
    if command -v sha1sum >/dev/null 2>&1; then
      echo "$sha  $tmp/clt.zip" | sha1sum -c - >/dev/null || return 1
    else
      echo "$sha  $tmp/clt.zip" | shasum -a 1 -c - >/dev/null || return 1
    fi
    unzip -q "$tmp/clt.zip" -d "$tmp" || return 1
    mkdir -p "$sdk/cmdline-tools" || return 1
    rm -rf "${sdk:?}/cmdline-tools/$CLT_VERSION"
    mv "$tmp/cmdline-tools" "$sdk/cmdline-tools/$CLT_VERSION" || return 1
    sdkmanager="$sdk/cmdline-tools/$CLT_VERSION/bin/sdkmanager"
  fi
  yes | "$sdkmanager" --sdk_root="$sdk" --licenses >/dev/null 2>&1 || true
  printf '%s' "$sdkmanager"
}

install() {
  local sdkmanager
  sdkmanager="$(ensure_sdkmanager)"
  "$sdkmanager" --sdk_root="$sdk" --install "${PACKAGES[@]}" >/dev/null
  check
}

host_abi() {
  case "$(uname -m)" in
    arm64 | aarch64) echo arm64-v8a ;;
    *) echo x86_64 ;;
  esac
}

# Every package name `sdkmanager --list` shows (installed and offered), one per line.
listed_packages() {
  "$1" --sdk_root="$sdk" --list 2>/dev/null \
    | awk -F'|' '{ pkg = $1; gsub(/[[:space:]]/, "", pkg); if (pkg ~ /;/) print pkg }'
}

# The newest `system-images;android-<N>;google_apis;<abi>` package in that list, or nothing.
newest_google_apis_image() {
  listed_packages "$1" | awk -v abi="$2" '
    $0 ~ "^system-images;android-[0-9]+;google_apis;" abi "$" {
      split($0, part, ";"); level = substr(part[2], 9) + 0
      if (level > best) { best = level; found = $0 }
    }
    END { if (found != "") print found }'
}

install_emulator() {
  local sdkmanager image abi offered
  install >/dev/null
  sdkmanager="$(ensure_sdkmanager)"
  abi="$(host_abi)"
  image="${1:-${ANDROID_SYSTEM_IMAGE:-system-images;android-${EMULATOR_API};google_apis;$abi}}"
  if [[ -z "${1:-}${ANDROID_SYSTEM_IMAGE:-}" ]] \
    && ! listed_packages "$sdkmanager" | command grep -Fxq "$image"; then
    offered="$(newest_google_apis_image "$sdkmanager" "$abi")"
    if [[ -n "$offered" ]]; then
      echo "android sdk: $image is not offered for $abi; using $offered" >&2
      image="$offered"
    fi
  fi
  if ! "$sdkmanager" --sdk_root="$sdk" --install platform-tools emulator "$image" >/dev/null; then
    echo "android sdk: could not install the emulator or $image; images offered for $abi:" >&2
    "$sdkmanager" --sdk_root="$sdk" --list 2>/dev/null | command grep "system-images;.*;$abi" >&2 || true
    echo "  pick one with ANDROID_SYSTEM_IMAGE='system-images;android-<N>;google_apis;$abi'" >&2
    return 1
  fi
  printf '%s\n' "$image"
}

case "$mode" in
  check) check ;;
  install) install ;;
  emulator) install_emulator "${2:-}" ;;
  dir) printf '%s\n' "$sdk" ;;
  bin)
    if bin="$(find_sdkmanager)"; then
      dirname "$bin"
    else
      echo "android sdk: no cmdline-tools at $sdk; run \`apps/android/tools/sdk.sh install\`" >&2
      exit 1
    fi
    ;;
  -h | --help) sed -n '2,20p' "$0" ;;
  *) echo "sdk.sh: unknown mode '$mode' (use check|install|emulator|dir|bin)" >&2; exit 2 ;;
esac
