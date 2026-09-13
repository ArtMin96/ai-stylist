#!/usr/bin/env bash
# just doctor — read-only environment + repo health check (planning/15 §4).
# One line per check (✔ / ✘ / ⚠) with a fix hint. Exits non-zero if any non-warn check fails.
# Linux + macOS (bash 3.2-clean; POSIX df/grep only — see scripts/lib.sh for the helpers).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=scripts/security/secrets-lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/security/secrets-lib.sh"
# shellcheck source=scripts/security/secrets-doctor.sh
source "$(dirname "${BASH_SOURCE[0]}")/security/secrets-doctor.sh"
cd "$REPO_ROOT"

heading "AI Stylist doctor"

# --- mise + pinned tools ------------------------------------------------------
# A clean machine has no system python3; use the mise-pinned one when installed, else the system one.
doctor_python() {
  if "$MISE_BIN" which python3 >/dev/null 2>&1; then mise_exec python3 "$@"
  elif have python3; then python3 "$@"
  else return 127
  fi
}
if [[ -x "$MISE_BIN" ]]; then
  ok "mise present ($("$MISE_BIN" --version 2>/dev/null | head -1))"
  # Every tool in mise.toml must resolve to exactly its pinned version (mise ls --current --json).
  pin_rows="$("$MISE_BIN" ls --current --json 2>/dev/null \
    | doctor_python -c '
import json,sys
d=json.load(sys.stdin)
for tool,entries in d.items():
    for e in entries:
        req=e.get("requested_version") or ""
        inst=e.get("version") if e.get("installed") else "(missing)"
        print(f"{tool}\t{req}\t{inst}")' 2>/dev/null || true)"
  if [[ -z "$pin_rows" ]]; then
    # shellcheck disable=SC2088  # the ~ is in a hint string typed by a human, not expanded here
    fail "could not read pinned tool versions (mise ls --current --json)" "~/.local/bin/mise install --yes   (or: just bootstrap)"
  fi
  while IFS=$'\t' read -r tool requested installed; do
    [[ -z "$tool" ]] && continue
    if [[ "$installed" == "$requested" ]]; then
      ok "$tool $installed"
    else
      # shellcheck disable=SC2088
      fail "$tool resolves to '$installed', pinned '$requested'" "~/.local/bin/mise install $tool@$requested"
    fi
  done <<< "$pin_rows"
else
  fail "mise not found at $MISE_BIN" "curl https://mise.run | sh   (or: just bootstrap)"
fi

# --- pnpm store -----------------------------------------------------------------
if [[ -x "$MISE_BIN" ]] && mise_exec pnpm --version >/dev/null 2>&1; then
  if store="$(mise_exec pnpm store path 2>/dev/null)" && [[ -n "$store" ]]; then
    if [[ "$store" == "$REPO_ROOT"/* ]]; then
      fail "pnpm store is inside the repo ($store) — prettier/eslint/gitleaks would crawl it" "just bootstrap   (relinks node_modules from the \$HOME store pinned in .npmrc)"
    else
      ok "pnpm store ok ($store)"
    fi
  else
    fail "pnpm store not resolvable" "mise exec -- pnpm store path"
  fi
  if [[ -d node_modules ]]; then
    ok "root node_modules present"
  else
    fail "root node_modules missing" "mise exec -- pnpm install --frozen-lockfile"
  fi
else
  fail "pnpm unavailable via mise" "just bootstrap"
fi

# --- docker ---------------------------------------------------------------------
# macOS has no native daemon: Docker Desktop, OrbStack or Colima provide one (docs/DEVELOPING-ON-MACOS.md).
# Testcontainers (apps/api migrations tests) talks to the socket directly, which Colima only
# exposes through DOCKER_HOST.
colima_sock="unix://$HOME/.colima/default/docker.sock"
if have docker; then
  if docker info >/dev/null 2>&1; then
    ok "docker daemon reachable"
    if os_is_darwin && [[ "$(darwin_docker_runtime)" == "colima" && -z "${DOCKER_HOST:-}" ]]; then
      warnc "Colima is the docker runtime but DOCKER_HOST is unset (Testcontainers cannot find the socket)" "export DOCKER_HOST=$colima_sock   (docs/DEVELOPING-ON-MACOS.md)"
    fi
  elif os_is_darwin; then
    case "$(darwin_docker_runtime)" in
      desktop) fail "docker daemon not reachable (Docker Desktop installed but not running)" "open -a Docker   then wait for the whale icon to settle" ;;
      orbstack) fail "docker daemon not reachable (OrbStack installed but not running)" "orb start" ;;
      colima) fail "docker daemon not reachable (Colima installed but not running)" "colima start   then: export DOCKER_HOST=$colima_sock" ;;
      *) fail "docker daemon not reachable and no Docker runtime found" "install Docker Desktop, OrbStack or Colima: docs/DEVELOPING-ON-MACOS.md" ;;
    esac
  else
    fail "docker daemon not reachable" "start Docker and add yourself to the docker group: just bootstrap --system"
  fi
elif os_is_darwin; then
  fail "docker not installed" "install Docker Desktop, OrbStack or Colima (docs/DEVELOPING-ON-MACOS.md); just bootstrap --system lists the commands"
else
  fail "docker not installed" "just bootstrap --system  (installs docker.io + compose plugin)"
fi

# --- direnv ---------------------------------------------------------------------
if have direnv || { [[ -x "$MISE_BIN" ]] && mise_exec direnv --version >/dev/null 2>&1; }; then
  ok "direnv present"
  if [[ -z "${DIRENV_DIR:-}" ]]; then
    # shellcheck disable=SC2016  # hint text, the $(...) is for the reader's rc file
    warnc "direnv not active in this shell" 'add: eval "$(direnv hook zsh)" to ~/.zshrc, then: direnv allow'
  fi
else
  # shellcheck disable=SC2088
  fail "direnv missing" "~/.local/bin/mise install direnv"
fi

# --- .env keys ------------------------------------------------------------------
if [[ -f .env ]]; then
  missing_keys=()
  while IFS= read -r key; do
    [[ -z "$key" ]] && continue
    command grep -qE "^${key}=" .env || missing_keys+=("$key")
  done < <(command grep -oE '^[A-Z][A-Z0-9_]*=' .env.example | tr -d '=')
  if (( ${#missing_keys[@]} == 0 )); then
    ok ".env has every key from .env.example"
  else
    fail ".env missing ${#missing_keys[@]} key(s): ${missing_keys[*]}" "copy the lines from .env.example (values stay yours), or: just secrets-sync"
  fi
else
  fail ".env not found" "cp .env.example .env   (or: just secrets-sync)"
fi

# --- sops + age identity ---------------------------------------------------------
secrets_select_env dev
secrets_doctor_checks

# --- git hooks (prek) -------------------------------------------------------------
hooks_dir="$(git rev-parse --git-path hooks 2>/dev/null || echo .git/hooks)"
if [[ -f "$hooks_dir/pre-commit" ]] && command grep -q prek "$hooks_dir/pre-commit"; then
  ok "prek pre-commit hook installed"
else
  fail "prek pre-commit hook missing" "mise exec -- prek install --hook-type pre-commit --hook-type commit-msg"
fi
if [[ -f "$hooks_dir/commit-msg" ]] && command grep -q prek "$hooks_dir/commit-msg"; then
  ok "prek commit-msg hook installed"
else
  fail "prek commit-msg hook missing" "mise exec -- prek install --hook-type commit-msg"
fi

# --- git lfs --------------------------------------------------------------------
if git lfs version >/dev/null 2>&1; then
  ok "git LFS installed ($(git lfs version | head -1))"
else
  if os_is_darwin; then
    fail "git LFS not installed (assets/3d/** needs it)" "just bootstrap --system  (brew install git-lfs) then: git lfs install"
  else
    fail "git LFS not installed (assets/3d/** needs it)" "just bootstrap --system  (apt install git-lfs) then: git lfs install"
  fi
fi

# --- disk -----------------------------------------------------------------------
free_gb="$(disk_free_gb .)"
if (( free_gb >= 10 )); then
  ok "free disk ${free_gb}G (≥ 10G)"
else
  fail "free disk ${free_gb}G < 10G" "free space for pnpm store / asset caches / Docker images"
fi

# --- adb (warn only) --------------------------------------------------------------
if have adb; then
  ok "adb present ($(adb devices 2>/dev/null | command grep -c $'\tdevice$' || true) device(s) attached)"
elif os_is_darwin; then
  warnc "adb not found (needed for Android device work)" "just bootstrap --system  (brew install --cask android-platform-tools)"
else
  warnc "adb not found (needed for Android device work)" "just bootstrap --system  (installs platform-tools + udev rules)"
fi

# --- macOS: iOS native toolchain (warn only; Expo prebuild/run:ios need them) -------------
if os_is_darwin; then
  if xcode-select -p >/dev/null 2>&1; then
    ok "xcode command line tools ($(xcode-select -p))"
  else
    warnc "xcode command line tools missing (expo prebuild / run:ios need them)" "xcode-select --install"
  fi
  if have pod; then
    ok "CocoaPods present ($(pod --version 2>/dev/null || echo '?'))"
  else
    warnc "CocoaPods not found (expo prebuild --platform ios runs pod install; SDK 57 still uses CocoaPods)" "brew install cocoapods"
  fi
fi

# --- summary -------------------------------------------------------------------------
echo
if (( DOCTOR_FAILURES > 0 )); then
  error "$DOCTOR_FAILURES check(s) failed, $DOCTOR_WARNINGS warning(s)"
  exit 1
fi
log "all checks passed ($DOCTOR_WARNINGS warning(s))"
