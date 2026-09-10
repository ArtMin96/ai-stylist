#!/usr/bin/env bash
# Shared helpers for scripts/*.sh (planning/15 §4). Source, do not execute.
#   source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# shellcheck disable=SC2034
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MISE_BIN="${MISE_BIN:-$HOME/.local/bin/mise}"

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
