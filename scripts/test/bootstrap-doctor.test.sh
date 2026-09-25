#!/usr/bin/env bash
# Black-box regression suite for the machine-setup helpers that bootstrap.sh and doctor.sh share
# (scripts/lib.sh: Xcode detection, the managed mise + direnv block in the shell rc file) and for the
# Xcode guard of the apps/ios recipes (apps/ios/scripts/lib.sh via xcode.sh doctor).
# Usage: scripts/test/bootstrap-doctor.test.sh   (run by `just test tooling` and `just test`)
# Runs on Linux and macOS alike: xcodebuild, plutil and uname are stubs on PATH, Xcode bundles are
# fixture directories, and HOME is a throwaway directory. Nothing reads or edits the real rc files,
# the real Xcode, or /Applications.
# shellcheck disable=SC2030,SC2031 # each probe deliberately scopes PATH/HOME/MISE_BIN to its own
# subshell; shellcheck's whole-file flow analysis otherwise flags every later use of them.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-bootstrap-tests.XXXXXX")"
trap 'rm -rf "$TEST_ROOT"' EXIT

failures=0

run_test() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS  $name"
  else
    echo "FAIL  $name" >&2
    failures=$((failures + 1))
  fi
}

# stub <dir> <name> <bash body>: an executable <dir>/<name> running <body>.
stub() {
  mkdir -p "$1"
  printf '#!/usr/bin/env bash\n%s\n' "$3" >"$1/$2"
  chmod +x "$1/$2"
}

expect_eq() {
  if [[ "$1" != "$2" ]]; then
    printf '  expected: %s\n  actual:   %s\n' "$2" "$1" >&2
    return 1
  fi
}

expect_contains() {
  if [[ "$1" != *"$2"* ]]; then
    printf '  expected output to contain: %s\n  output: %s\n' "$2" "$1" >&2
    return 1
  fi
}

CLT_ERROR="xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance"

# --- Xcode detection (scripts/lib.sh darwin_xcode_state) ------------------------------------------

# xcode_state <active version, or "" when xcodebuild cannot run> [<bundle name>:<version>...]
# Prints darwin_xcode_state 27.0 with the fixture Applications dir shown as <apps>.
xcode_state() {
  local dir active="$1" entry
  dir="$(mktemp -d "$TEST_ROOT/xcode.XXXXXX")"
  shift
  mkdir -p "$dir/Applications"
  if [[ -n "$active" ]]; then
    stub "$dir/bin" xcodebuild "printf 'Xcode %s\nBuild version 27A266a\n' '$active'"
  else
    stub "$dir/bin" xcodebuild "echo \"$CLT_ERROR\" >&2; exit 1"
  fi
  # plutil -extract CFBundleShortVersionString raw -o - <plist>: the fixture keeps the version next to it.
  # shellcheck disable=SC2016  # the stub body expands when the stub runs, not here
  stub "$dir/bin" plutil 'for last; do :; done; cat "$last.version"'
  for entry in "$@"; do
    mkdir -p "$dir/Applications/${entry%%:*}/Contents"
    : >"$dir/Applications/${entry%%:*}/Contents/Info.plist"
    echo "${entry#*:}" >"$dir/Applications/${entry%%:*}/Contents/Info.plist.version"
  done
  (
    PATH="$dir/bin:$PATH"
    export XCODES_DIRECTORY="$dir/Applications"
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    darwin_xcode_state 27.0
  ) | sed "s#$dir/Applications#<apps>#"
}

test_xcode_installed_but_command_line_tools_selected() {
  expect_eq "$(xcode_state "" Xcode.app:27.0)" "unselected <apps>/Xcode.app"
}

test_xcode_pinned_version_active() {
  expect_eq "$(xcode_state 27.0 Xcode.app:27.0)" "ok"
}

test_xcode_other_version_active_pinned_installed() {
  expect_eq "$(xcode_state 26.4 Xcode.app:26.4 Xcode-27.0.app:27.0)" "unselected <apps>/Xcode-27.0.app"
}

test_xcode_other_version_active_pinned_missing() {
  expect_eq "$(xcode_state 26.4 Xcode.app:26.4)" "other 26.4"
}

test_xcode_missing() {
  expect_eq "$(xcode_state "" Xcode_26.4.app:26.4)" "missing"
}

test_xcode_missing_empty_applications() {
  expect_eq "$(xcode_state "")" "missing"
}

# --- apps/ios recipes: xcodebuild present but unusable -----------------------------------------

test_ios_doctor_names_the_fix_when_xcode_is_not_selected() {
  local bin="$TEST_ROOT/ios-clt/bin" out
  stub "$bin" uname 'echo Darwin'
  stub "$bin" xcodebuild "echo \"$CLT_ERROR\" >&2; exit 1"
  if out="$(PATH="$bin:$PATH" "$ROOT/apps/ios/scripts/xcode.sh" doctor 2>&1)"; then
    echo "  expected a non-zero exit, got 0: $out" >&2
    return 1
  fi
  expect_contains "$out" "command line tools instance" && expect_contains "$out" "scripts/bootstrap.sh --system"
}

# --- shell rc file (scripts/lib.sh shell_rc_file) ------------------------------------------------

# rc_file_for <SHELL> <OS_NAME> [ZDOTDIR]
rc_file_for() {
  (
    export SHELL="$1" HOME=/home/dev
    if [[ -n "${3:-}" ]]; then export ZDOTDIR="$3"; else unset ZDOTDIR; fi
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    OS_NAME="$2"
    shell_rc_file
  )
}

test_rc_file_zsh() {
  expect_eq "$(rc_file_for /bin/zsh Darwin)" "/home/dev/.zshrc" \
    && expect_eq "$(rc_file_for /usr/bin/zsh Linux /home/dev/.config/zsh)" "/home/dev/.config/zsh/.zshrc"
}

test_rc_file_bash() {
  expect_eq "$(rc_file_for /bin/bash Linux)" "/home/dev/.bashrc" \
    && expect_eq "$(rc_file_for /bin/bash Darwin)" "/home/dev/.bash_profile"
}

test_rc_file_unsupported_shell() {
  if rc_file_for /usr/bin/fish Linux >/dev/null; then
    echo "  expected fish to be reported as unsupported" >&2
    return 1
  fi
}

# --- managed mise + direnv block (scripts/lib.sh shell_activation_write) ---------------------------

# write_block <rc> <shell> <direnv version>
write_block() {
  (
    export MISE_BIN=/opt/mise/bin/mise HOME="$TEST_ROOT/home"
    # shellcheck source=scripts/lib.sh
    source "$ROOT/scripts/lib.sh"
    shell_activation_write "$@"
  )
}

# shellcheck disable=SC2016  # the expected rc lines contain literal $(...)
expected_block() {
  printf '%s\n' \
    '# >>> ai-stylist: mise + direnv (managed by scripts/bootstrap.sh) >>>' \
    "eval \"\$(/opt/mise/bin/mise activate $1)\"" \
    "eval \"\$(/opt/mise/bin/mise exec direnv@$2 -- direnv hook $1)\"" \
    '# <<< ai-stylist <<<'
}

test_block_created_in_missing_rc() {
  local rc="$TEST_ROOT/new/.zshrc"
  mkdir -p "$(dirname "$rc")"
  write_block "$rc" zsh 2.37.1
  expect_eq "$(cat "$rc")" "$(expected_block zsh 2.37.1)"
}

test_block_replaced_in_place_and_never_duplicated() {
  local rc="$TEST_ROOT/replace/.bashrc"
  mkdir -p "$(dirname "$rc")"
  printf 'export FOO=1\n' >"$rc"
  write_block "$rc" bash 2.37.1
  printf 'alias ll="ls -l"\n' >>"$rc"
  write_block "$rc" bash 2.38.0
  write_block "$rc" bash 2.38.0
  expect_eq "$(cat "$rc")" "$(printf 'export FOO=1\n%s\nalias ll="ls -l"' "$(expected_block bash 2.38.0)")"
}

test_block_keeps_a_symlinked_rc_a_symlink() {
  local dir="$TEST_ROOT/symlink"
  mkdir -p "$dir/dotfiles"
  printf 'export FOO=1\n' >"$dir/dotfiles/zshrc"
  ln -s "$dir/dotfiles/zshrc" "$dir/.zshrc"
  write_block "$dir/.zshrc" zsh 2.37.1
  if [[ ! -L "$dir/.zshrc" ]]; then
    echo "  $dir/.zshrc is no longer a symlink" >&2
    return 1
  fi
  expect_eq "$(cat "$dir/dotfiles/zshrc")" "$(printf 'export FOO=1\n%s' "$(expected_block zsh 2.37.1)")"
}

run_test "xcode: installed, command line tools selected -> unselected" test_xcode_installed_but_command_line_tools_selected
run_test "xcode: pinned version active -> ok" test_xcode_pinned_version_active
run_test "xcode: other version active, pinned installed -> unselected" test_xcode_other_version_active_pinned_installed
run_test "xcode: other version active, pinned missing -> other" test_xcode_other_version_active_pinned_missing
run_test "xcode: only another version installed, none usable -> missing" test_xcode_missing
run_test "xcode: nothing installed -> missing" test_xcode_missing_empty_applications
run_test "ios-doctor: unusable xcodebuild prints the fix, not only Apple's error" test_ios_doctor_names_the_fix_when_xcode_is_not_selected
run_test "rc file: zsh (ZDOTDIR honoured)" test_rc_file_zsh
run_test "rc file: bash (Linux .bashrc, macOS .bash_profile)" test_rc_file_bash
run_test "rc file: unsupported shell" test_rc_file_unsupported_shell
run_test "rc block: created when the rc file is missing" test_block_created_in_missing_rc
run_test "rc block: replaced in place, never duplicated" test_block_replaced_in_place_and_never_duplicated
run_test "rc block: a symlinked rc file stays a symlink" test_block_keeps_a_symlinked_rc_a_symlink

if ((failures > 0)); then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "all tests passed"
