#!/usr/bin/env bash
# Proves the PostHog and package-pin guards of scripts/xcode.sh without Xcode (Linux and macOS). Run by
# `just ios-check-banned --fixtures`, so by `just ios-check`. A stub `xcodebuild` on PATH records its
# arguments and the NAMES of its environment variables; nothing is built. Keys are synthetic.
#   1. no POSTHOG_CLI_* variable reaches xcodebuild (it imports its environment as build settings), and
#      the dSYM upload still receives every one of them;
#   2. xcodebuild runs with -onlyUsePackageVersionsFromResolvedFile (pins from apps/ios/Package.resolved);
#   3. a POSTHOG_API_KEY that is not a project key (phc_...) stops the build before xcodebuild runs,
#      from the environment or from Local.xcconfig, and the message never shows the value;
#   4. apps/ios/Package.resolved holds every pin of apps/ios/Packages/*/Package.resolved unchanged.
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
    export PATH="$tmp/bin:$PATH"
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

exit "$failed"
