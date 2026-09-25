#!/usr/bin/env bash
# Shared helpers for scripts/*.sh (planning/15 §4). Source, do not execute.
#   source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# shellcheck disable=SC2034
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# mise: an explicit MISE_BIN wins; else the mise.run install location; else a mise already on PATH
# (an OS package such as /usr/bin/mise). With none of them present, MISE_BIN stays at the mise.run
# location, which is where bootstrap installs it.
if [[ -z "${MISE_BIN:-}" ]]; then
  MISE_BIN="$HOME/.local/bin/mise"
  if [[ ! -x "$MISE_BIN" ]]; then
    _lib_mise_on_path="$(command -v mise 2>/dev/null || true)"
    [[ "$_lib_mise_on_path" == /* && -x "$_lib_mise_on_path" ]] && MISE_BIN="$_lib_mise_on_path"
    unset _lib_mise_on_path
  fi
fi

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
else
  C_RESET=''; C_BOLD=''; C_DIM=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''
fi

log()      { printf '%s==>%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
info()     { printf '    %s\n' "$*"; }
warn()     { printf '%s!!%s  %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
error()    { printf '%sERROR%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }
die()      { error "$@"; exit 1; }
heading()  { printf '\n%s%s%s\n' "$C_BOLD" "$*" "$C_RESET"; }

# Doctor-style check lines: one per check, ✔ / ✘ / ⚠ plus a fix hint.
DOCTOR_FAILURES=0
DOCTOR_WARNINGS=0
ok()       { printf '%s✔%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
fail()     { DOCTOR_FAILURES=$((DOCTOR_FAILURES + 1)); printf '%s✘%s %s\n' "$C_RED" "$C_RESET" "$1"; [[ -n "${2:-}" ]] && printf '    %sfix:%s %s\n' "$C_DIM" "$C_RESET" "$2"; return 0; }
warnc()    { DOCTOR_WARNINGS=$((DOCTOR_WARNINGS + 1)); printf '%s⚠%s %s\n' "$C_YELLOW" "$C_RESET" "$1"; [[ -n "${2:-}" ]] && printf '    %shint:%s %s\n' "$C_DIM" "$C_RESET" "$2"; return 0; }

have()     { command -v "$1" >/dev/null 2>&1; }

# Run a tool through mise without requiring shell activation.
mise_exec() { "$MISE_BIN" exec -- "$@"; }

# --- portability (Linux + macOS; scripts stay bash 3.2-clean because macOS /bin/bash is 3.2) ----
OS_NAME="$(uname -s)"
os_is_darwin() { [[ "$OS_NAME" == "Darwin" ]]; }

# In-place sed that works with GNU sed (-i takes an optional suffix) and BSD sed (-i needs one).
#   sed_inplace 's/a/b/' file...
sed_inplace() {
  if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi
}

# Free space of the filesystem holding $1 (default: cwd) in whole GiB. POSIX `df -Pk` parses the
# same on both OSes; GNU-only `df -BG --output=avail` does not exist on macOS.
disk_free_gb() {
  df -Pk "${1:-.}" | awk 'NR == 2 { printf "%d\n", $4 / 1048576 }'
}

# Which Docker runtime provides `docker` on macOS: the active docker context first (a machine can
# have several installed), then installed apps. Prints desktop | orbstack | colima | none.
darwin_docker_runtime() {
  local ctx
  ctx="$(docker context show 2>/dev/null || true)"
  case "$ctx" in
    orbstack) echo orbstack; return ;;
    colima*) echo colima; return ;;
    desktop-linux) echo desktop; return ;;
  esac
  if [[ -d /Applications/OrbStack.app ]] || have orbctl; then echo orbstack
  elif [[ -d /Applications/Docker.app ]]; then echo desktop
  elif have colima; then echo colima
  else echo none
  fi
}

# --- Xcode (macOS; apps/ios/.xcode-version pins the version) ---------------------------------------

# The installed Xcode bundle whose CFBundleShortVersionString is $1, searched as
# ${XCODES_DIRECTORY:-/Applications}/Xcode*.app: the App Store installs Xcode.app, xcodes installs
# Xcode-<version>.app (honouring the same XCODES_DIRECTORY), GitHub runners ship Xcode_<version>.app.
# Prints the path; returns 1 when no bundle matches.
darwin_xcode_app() {
  local app
  for app in "${XCODES_DIRECTORY:-/Applications}"/Xcode*.app; do
    [[ -f "$app/Contents/Info.plist" ]] || continue
    if [[ "$(plutil -extract CFBundleShortVersionString raw -o - "$app/Contents/Info.plist" 2>/dev/null)" == "$1" ]]; then
      printf '%s\n' "$app"
      return 0
    fi
  done
  return 1
}

# How the Xcode that xcodebuild runs compares with the pinned version $1. Prints one of:
#   ok                 xcodebuild runs the pinned version
#   unselected <app>   the pinned Xcode is installed at <app>, but xcodebuild does not run it: the
#                      Command Line Tools or another Xcode is selected, or its licence / first-launch
#                      setup is pending (/usr/bin/xcodebuild exists even with only the CLT)
#   other <version>    xcodebuild runs another version and the pinned one is not installed
#   missing            no usable Xcode and the pinned one is not installed
darwin_xcode_state() {
  local active app
  active="$(xcodebuild -version 2>/dev/null | awk 'NR == 1 { print $2 }' || true)"
  if [[ "$active" == "$1" ]]; then
    echo ok
  elif app="$(darwin_xcode_app "$1")"; then
    echo "unselected $app"
  elif [[ -n "$active" ]]; then
    echo "other $active"
  else
    echo missing
  fi
}

# --- shell activation (bootstrap writes it; doctor points at it) ----------------------------------
SHELL_RC_BEGIN='# >>> ai-stylist: mise + direnv (managed by scripts/bootstrap.sh) >>>'
SHELL_RC_END='# <<< ai-stylist <<<'

# The rc file an interactive shell of the user's login shell ($SHELL) reads: zsh ->
# ${ZDOTDIR:-$HOME}/.zshrc; bash -> ~/.bash_profile on macOS (Terminal opens login shells) and
# ~/.bashrc on Linux. Returns 1 for any other shell.
shell_rc_file() {
  case "$(basename "${SHELL:-}")" in
    zsh) printf '%s\n' "${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) if os_is_darwin; then printf '%s\n' "$HOME/.bash_profile"; else printf '%s\n' "$HOME/.bashrc"; fi ;;
    *) return 1 ;;
  esac
}

# Writes the managed block into rc file $1 for shell $2 (zsh | bash): activate mise, then hook
# direnv $3 (the version mise.toml pins). direnv is pinned only in this repo, so the hook runs it
# through `mise exec direnv@<version>`, which works from any directory; the hook it prints calls
# that binary by absolute path. Re-running replaces the block in place (one block, the user's
# lines untouched); writing through the path keeps a symlinked rc file a symlink.
shell_activation_write() {
  local rc="$1" shell="$2" direnv_version="$3" block tmp
  block="$(mktemp)"
  tmp="$(mktemp)"
  # shellcheck disable=SC2016  # the $(...) is for the rc file, expanded when the shell starts
  printf '%s\neval "$(%s activate %s)"\neval "$(%s exec direnv@%s -- direnv hook %s)"\n%s\n' \
    "$SHELL_RC_BEGIN" "$MISE_BIN" "$shell" "$MISE_BIN" "$direnv_version" "$shell" "$SHELL_RC_END" >"$block"
  [[ -f "$rc" ]] || : >"$rc"
  awk -v begin="$SHELL_RC_BEGIN" -v end="$SHELL_RC_END" -v block="$block" '
    function emit(  line) { while ((getline line < block) > 0) print line; close(block); done = 1 }
    $0 == begin { if (!done) emit(); skip = 1; next }
    skip { if ($0 == end) skip = 0; next }
    { print }
    END { if (!done) emit() }' "$rc" >"$tmp"
  cat "$tmp" >"$rc"
  rm -f "$block" "$tmp"
}
