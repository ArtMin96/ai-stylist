#!/usr/bin/env bash
# Proves the PostHog and package-pin guards of scripts/xcode.sh without Xcode (Linux and macOS). Run by
# `just ios-check-banned --fixtures`, so by `just ios-check`. A stub `xcodebuild` on PATH records its
# arguments and the NAMES of its environment variables; nothing is built. Keys are synthetic.
#   1. no POSTHOG_CLI_* variable reaches xcodebuild (it imports its environment as build settings), and
#      the dSYM upload still receives every one of them;
#   2. xcodebuild runs with -onlyUsePackageVersionsFromResolvedFile (pins from apps/ios/Package.resolved);
#   3. a POSTHOG_API_KEY that is not a project key (phc_...) stops the build before xcodebuild runs,
#      from the environment or from Local.xcconfig, and the message never shows the value;
#   4. apps/ios/Package.resolved holds every pin of apps/ios/Packages/*/Package.resolved unchanged;
#   5. `run` opens Device Hub from the selected Xcode, and stops when that Xcode has none;
#   6. the dSYM upload skips a symbol set PostHog already holds with other content, instead of failing.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
xcode_sh="$IOS_DIR/scripts/xcode.sh"
app_lockfile="$IOS_DIR/Package.resolved"
package_lockfiles=("$IOS_DIR"/Packages/*/Package.resolved)

tmp="$(mktemp -d "${TMPDIR:-/tmp}/ios-xcode-guards.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cat >"$tmp/bin/xcodebuild" <<EOF
#!/bin/sh
printf '%s\n' "\$@" >"$tmp/xcodebuild.args"
env | cut -d= -f1 >"$tmp/xcodebuild.env"
EOF
chmod +x "$tmp/bin/xcodebuild"
# The stubs in $tmp/bin shadow the real tools for the whole test.
export PATH="$tmp/bin:$PATH"

failed=0
pass() { echo "ok: xcode.sh $*"; }
fail() {
  echo "test-xcode-guards: FAIL: $*" >&2
  failed=1
}

# scenario <Local.xcconfig path> [NAME=value...]: sources xcode.sh in a subshell whose only PostHog
# variables are the given ones, runs run_xcodebuild against the stub, and saves the names the dSYM
# upload would receive. stderr goes to $tmp/stderr. Returns the subshell's status.
scenario() {
  local xcconfig="$1"
  shift
  rm -f "$tmp/xcodebuild.args" "$tmp/xcodebuild.env" "$tmp/upload.names"
  (
    for name in $(compgen -e); do
      case "$name" in POSTHOG_*) unset "$name" ;; esac
    done
    for assignment in "$@"; do
      export "${assignment?}"
    done
    # shellcheck source=xcode.sh
    . "$xcode_sh"
    LOCAL_XCCONFIG="$xcconfig"
    run_xcodebuild build >/dev/null
    printf '%s\n' ${POSTHOG_CLI_ENV[@]+"${POSTHOG_CLI_ENV[@]}"} | cut -d= -f1 | LC_ALL=C sort | tr '\n' ' ' \
      >"$tmp/upload.names"
  ) 2>"$tmp/stderr"
}

# 1 + 2: upload credentials stay out of xcodebuild; the project key and the pin flag go in.
if scenario "$tmp/absent.xcconfig" POSTHOG_API_KEY=phc_guardtest POSTHOG_HOST=https://us.i.posthog.com \
  POSTHOG_CLI_API_KEY=phx_guardtest POSTHOG_CLI_PROJECT_ID=1 POSTHOG_CLI_HOST=https://us.posthog.com \
  POSTHOG_CLI_EXTRA=1; then
  if [[ ! -f "$tmp/xcodebuild.env" ]]; then
    fail "the stub xcodebuild did not run: $(cat "$tmp/stderr")"
  elif grep -q '^POSTHOG_CLI_' "$tmp/xcodebuild.env"; then
    fail "POSTHOG_CLI_* reached xcodebuild's environment: $(grep '^POSTHOG_CLI_' "$tmp/xcodebuild.env" | tr '\n' ' ')"
  elif ! grep -qx 'POSTHOG_API_KEY=phc_guardtest' "$tmp/xcodebuild.args"; then
    fail "POSTHOG_API_KEY was not passed to xcodebuild as a build setting"
  else
    pass "keeps every POSTHOG_CLI_* variable out of xcodebuild's environment"
  fi
  expected="POSTHOG_CLI_API_KEY POSTHOG_CLI_EXTRA POSTHOG_CLI_HOST POSTHOG_CLI_PROJECT_ID "
  if [[ "$(cat "$tmp/upload.names" 2>/dev/null)" == "$expected" ]]; then
    pass "hands every POSTHOG_CLI_* variable to the dSYM upload"
  else
    fail "the dSYM upload would get '$(cat "$tmp/upload.names" 2>/dev/null)', expected '$expected'"
  fi
  if grep -qx -- '-onlyUsePackageVersionsFromResolvedFile' "$tmp/xcodebuild.args" 2>/dev/null; then
    pass "builds only from the seeded Package.resolved pins"
  else
    fail "xcodebuild ran without -onlyUsePackageVersionsFromResolvedFile"
  fi
else
  fail "a build with a project key and upload credentials failed: $(cat "$tmp/stderr")"
fi

# 3: a key that is not a project key stops the build, from either source, without showing the value.
expect_refused() {
  local label="$1" where="$2"
  shift 2
  if scenario "$@"; then
    fail "$label: the build was not stopped"
  elif [[ -f "$tmp/xcodebuild.args" ]]; then
    fail "$label: xcodebuild ran before the key check"
  elif ! grep -q "POSTHOG_API_KEY in $where" "$tmp/stderr"; then
    fail "$label: the message does not name POSTHOG_API_KEY in $where: $(cat "$tmp/stderr")"
  elif grep -q 'guardtest' "$tmp/stderr"; then
    fail "$label: the message shows the key's value"
  else
    pass "stops the build for $label, value not shown"
  fi
}
expect_refused "a personal key in the environment" "the environment" \
  "$tmp/absent.xcconfig" POSTHOG_API_KEY=phx_guardtest
printf '%s\n' '// synthetic Local.xcconfig' 'POSTHOG_API_KEY[config=Dev] = phx_guardtest // personal key' \
  >"$tmp/personal.xcconfig"
expect_refused "a personal key in Local.xcconfig" "$tmp/personal.xcconfig (line 2)" "$tmp/personal.xcconfig"
printf '%s\n' '// synthetic Local.xcconfig' 'POSTHOG_API_KEY = phc_guardtest // project key' >"$tmp/project.xcconfig"
if scenario "$tmp/project.xcconfig" && [[ -f "$tmp/xcodebuild.args" ]]; then
  pass "accepts a project key in Local.xcconfig"
else
  fail "a project key in Local.xcconfig was refused: $(cat "$tmp/stderr")"
fi

# 4: the app lockfile carries the package pins, so Xcode builds what `swift test` tests.
command -v jq >/dev/null 2>&1 || ios_die "test-xcode-guards: jq not found (macOS 15+ ships it; Linux: install jq)"
pins() {
  jq -r '.pins[] | "\(.identity) \(.location) \(.state.version // "-") \(.state.revision)"' "$@" | LC_ALL=C sort -u
}
missing="$(LC_ALL=C comm -23 <(pins "${package_lockfiles[@]}") <(pins "$app_lockfile"))"
if [[ -z "$missing" ]]; then
  pass "seeds Xcode with apps/ios/Package.resolved, which holds every Packages/*/Package.resolved pin"
else
  fail "apps/ios/Package.resolved lacks or differs from these package pins (copy them over, see apps/ios/README.md):
$missing"
fi

# 5: open_device_window opens Device Hub from the Xcode that xcode-select names (Xcode 27 has no
# Simulator.app), and stops with the path it checked when that Xcode has none. Stub xcode-select and
# open; the fake Xcode bundle is a directory tree.
fake_developer="$tmp/Xcode.app/Contents/Developer"
printf '#!/bin/sh\necho "%s"\n' "$fake_developer" >"$tmp/bin/xcode-select"
printf '#!/bin/sh\nprintf "%%s\\n" "$@" >"%s"\n' "$tmp/open.args" >"$tmp/bin/open"
chmod +x "$tmp/bin/xcode-select" "$tmp/bin/open"
open_window() {
  rm -f "$tmp/open.args"
  (
    # shellcheck source=xcode.sh
    . "$xcode_sh"
    open_device_window
  ) 2>"$tmp/stderr"
}
mkdir -p "$fake_developer" "$tmp/Xcode.app/Contents/Applications/DeviceHub.app"
if ! open_window; then
  fail "open_device_window failed with Device Hub present: $(cat "$tmp/stderr")"
elif ! grep -qx "$tmp/Xcode.app/Contents/Applications/DeviceHub.app" "$tmp/open.args" 2>/dev/null; then
  fail "open_device_window did not open the selected Xcode's DeviceHub.app: $(cat "$tmp/open.args" 2>/dev/null)"
else
  pass "opens Device Hub from the selected Xcode"
fi
rm -rf "$tmp/Xcode.app/Contents/Applications/DeviceHub.app"
if open_window; then
  fail "open_device_window succeeded although the selected Xcode has no DeviceHub.app"
elif [[ -f "$tmp/open.args" ]]; then
  fail "open_device_window ran open without a DeviceHub.app"
elif ! grep -q "$tmp/Xcode.app/Contents/Applications/DeviceHub.app" "$tmp/stderr"; then
  fail "the message does not name the DeviceHub.app path it checked: $(cat "$tmp/stderr")"
else
  pass "stops with the checked path when the selected Xcode has no Device Hub"
fi

# 6: upload_dsyms against a stub upload-symbols.sh that records its environment. The stub plutil
# answers every Info.plist read, so this runs on Linux too.
products="$tmp/DerivedData/Build/Products/Dev-iphonesimulator"
upload_script="$tmp/SourcePackages/checkouts/posthog-ios/build-tools/upload-symbols.sh"
mkdir -p "$products/AIStylist.app.dSYM" "${upload_script%/*}"
printf '#!/bin/sh\necho synthetic\n' >"$tmp/bin/plutil"
chmod +x "$tmp/bin/plutil"
printf 'env >"%s"\n' "$tmp/upload.env" >"$upload_script"
if (
  for name in $(compgen -e); do
    case "$name" in POSTHOG_*) unset "$name" ;; esac
  done
  export POSTHOG_CLI_API_KEY=phx_guardtest POSTHOG_CLI_PROJECT_ID=1 POSTHOG_CLI_HOST=https://us.posthog.com
  # shellcheck source=xcode.sh
  . "$xcode_sh"
  DERIVED_DATA="$tmp/DerivedData"
  SOURCE_PACKAGES="$tmp/SourcePackages"
  upload_dsyms Dev >/dev/null
) 2>"$tmp/stderr"; then
  if [[ ! -f "$tmp/upload.env" ]]; then
    fail "upload_dsyms did not run upload-symbols.sh: $(cat "$tmp/stderr")"
  elif ! grep -qx 'POSTHOG_SKIP_ON_CONFLICT=1' "$tmp/upload.env"; then
    fail "the dSYM upload runs without POSTHOG_SKIP_ON_CONFLICT=1, so a rebuilt unchanged binary fails the build"
  else
    pass "skips symbol sets PostHog already holds for the same UUID"
  fi
else
  fail "upload_dsyms failed: $(cat "$tmp/stderr")"
fi

exit "$failed"
