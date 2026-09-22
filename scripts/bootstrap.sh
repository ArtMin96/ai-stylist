#!/usr/bin/env bash
# just bootstrap — idempotent developer environment setup (planning/15 §1, §4).
#
#   scripts/bootstrap.sh            user-level steps only (no sudo): mise, pins, pnpm, hooks, .env
#   scripts/bootstrap.sh --system   additionally installs system packages and the native-app SDKs:
#                                     Linux  apt + udev rules + docker group (sudo); Docker image swift:6.4
#                                     macOS  Homebrew formulae/casks, no sudo (docs/DEVELOPING-ON-MACOS.md); Xcode check
#                                     both   Android SDK packages (apps/android/tools/sdk.sh install, user-level)
#                                            and ANDROID_HOME in ~/.config/ai-stylist/env.sh (.envrc sources it)
#
# Never edits shell rc files; prints the activation line at the end instead.
# Runs under macOS /bin/bash 3.2 as well as bash 5: no associative arrays, mapfile, ${var,,} etc.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$REPO_ROOT"

SYSTEM=0
for arg in "$@"; do
  case "$arg" in
    --system) SYSTEM=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) die "unknown flag: $arg (accepted: --system)" ;;
  esac
done

heading "AI Stylist bootstrap"

# --- 0. system packages (opt-in) -----------------------------------------------------
if (( SYSTEM )) && os_is_darwin; then
  log "system packages (Homebrew) — macOS, no sudo"
  # Xcode Command Line Tools: git, clang, and the SDK headers node-gyp needs. The installer
  # is an interactive Apple dialog, so it cannot run from here.
  if xcode-select -p >/dev/null 2>&1; then
    info "xcode command line tools: $(xcode-select -p)"
  else
    error "Xcode Command Line Tools are missing"
    info "run:  xcode-select --install   (accept the dialog, wait for it to finish), then re-run: just bootstrap --system"
    exit 1
  fi
  # Homebrew: never curl-pipe-installed silently; the official one-liner is printed for you to run.
  if have brew; then
    info "homebrew: $(brew --version 2>/dev/null | head -1)"
  else
    error "Homebrew is missing"
    info "install it with the official command from https://brew.sh, then re-run: just bootstrap --system"
    # shellcheck disable=SC2016  # printed for the human to run, not expanded here
    info '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
  fi
  # git-lfs (also mise-pinned; the brew copy keeps `git lfs` working in shells without mise).
  if brew list --formula git-lfs >/dev/null 2>&1; then
    info "git-lfs already installed"
  else
    brew install git-lfs
  fi
  log "docker runtime"
  # Not installed by this script: three runtimes exist and the choice is yours
  # (docs/DEVELOPING-ON-MACOS.md). Detect only.
  case "$(darwin_docker_runtime)" in
    desktop) info "Docker Desktop detected (/Applications/Docker.app) — start it from Launchpad if 'docker info' fails" ;;
    orbstack) info "OrbStack detected — 'orb start' if 'docker info' fails" ;;
    colima) info "Colima detected — 'colima start'; Testcontainers needs DOCKER_HOST=unix://\$HOME/.colima/default/docker.sock" ;;
    *)
      warn "no Docker runtime found. Install one (docs/DEVELOPING-ON-MACOS.md):"
      info "  Docker Desktop  brew install --cask docker      GUI, zero config for Testcontainers; check Docker's licence terms for your company size"
      info "  OrbStack        brew install --cask orbstack    fastest/lightest, zero config for Testcontainers; free for personal use, paid seat commercially"
      info "  Colima          brew install colima docker      CLI only, free; Testcontainers needs DOCKER_HOST (see the doc)"
      info "  recommendation: Docker Desktop or OrbStack (no env vars); Colima if you want no GUI"
      ;;
  esac
  info "skipping udev rules / docker group / systemctl (Linux only)"
elif (( SYSTEM )); then
  log "system packages (apt) — requires sudo"
  APT_PKGS=(build-essential git git-lfs curl unzip zip ca-certificates gnupg libssl-dev pkg-config
            docker.io docker-compose-v2 android-sdk-platform-tools-common)
  # adb itself comes from the Android SDK's platform-tools (step 3), not apt: two adb binaries of
  # different versions kill each other's server. android-sdk-platform-tools-common = udev rules only.
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${APT_PKGS[@]}"
  log "udev rules for Android devices"
  if [[ ! -f /etc/udev/rules.d/51-android.rules ]]; then
    sudo mkdir -p /etc/udev/rules.d   # absent on minimal/container/WSL images without udev
    printf 'SUBSYSTEM=="usb", ATTR{idVendor}=="18d1", MODE="0666", GROUP="plugdev"\n' \
      | sudo tee /etc/udev/rules.d/51-android.rules >/dev/null
    if have udevadm; then
      sudo udevadm control --reload-rules && sudo udevadm trigger
    else
      info "udevadm not present (no udev on this machine) — rules written, will apply once udev runs"
    fi
  else
    info "udev rules already present"
  fi
  log "docker group membership"
  me="$(id -un)"   # $USER is unset in non-login shells (CI, docker exec, systemd)
  if id -nG "$me" | command grep -qw docker; then
    info "$me already in docker group"
  else
    sudo usermod -aG docker "$me"
    warn "added $me to docker group — log out and back in for it to take effect"
  fi
  sudo systemctl enable --now docker >/dev/null 2>&1 || warn "could not enable docker service"
else
  if os_is_darwin; then
    info "skipping Homebrew steps (run with --system to include them: Xcode CLT check, git-lfs, Docker runtime detection)"
  else
    info "skipping apt / udev / docker-group steps (run with --system to include them; they need sudo)"
  fi
fi

# --- 1. mise -----------------------------------------------------------------------
log "mise"
if [[ -x "$MISE_BIN" ]]; then
  info "present: $("$MISE_BIN" --version | head -1)"
else
  info "installing to $MISE_BIN"
  curl -fsSL https://mise.run | MISE_INSTALL_PATH="$MISE_BIN" sh
fi

# --- 2. pinned toolchain -------------------------------------------------------------
log "mise install (pins from mise.toml)"
"$MISE_BIN" install --yes
"$MISE_BIN" ls --current 2>/dev/null | sed 's/^/    /'

# --- 3. workspace dependencies ---------------------------------------------------------
log "pnpm install"
# .npmrc pins store-dir under $HOME. A checkout whose node_modules was linked from the old in-repo
# store (<repo>/.pnpm-store, pnpm's default when the repo sits on another filesystem) must be
# relinked; pnpm asks for a TTY confirmation before purging node_modules, so answer yes here —
# node_modules is derived state and this script is the repair path.
if [[ -d .pnpm-store ]]; then
  warn "removing stale in-repo pnpm store .pnpm-store/ (store-dir now lives under \$HOME, see .npmrc)"
  rm -rf .pnpm-store
fi
if [[ -f pnpm-lock.yaml ]]; then
  mise_exec pnpm install --frozen-lockfile --config.confirm-modules-purge=false
else
  warn "no pnpm-lock.yaml yet — running a non-frozen install to create it (commit the lockfile)"
  mise_exec pnpm install --config.confirm-modules-purge=false
fi

log "uv sync (Python workers)"
if [[ -f workers/uv.lock ]]; then
  mise_exec uv sync --frozen --project workers
else
  info "no workers/uv.lock — skipping Python dependency sync"
fi

# --- 3. native app toolchains (opt-in with --system) ------------------------------------
if (( SYSTEM )); then
  log "Android SDK (apps/android) — user-level, no sudo, no emulator"
  mise_exec apps/android/tools/sdk.sh install
  if os_is_darwin; then sdk_dir="$HOME/Library/Android/sdk"; else sdk_dir="$HOME/Android/Sdk"; fi
  sdk_dir="${ANDROID_HOME:-$sdk_dir}"
  env_file="$HOME/.config/ai-stylist/env.sh"
  mkdir -p "$(dirname "$env_file")"
  if [[ -f "$env_file" ]] && command grep -q '^export ANDROID_HOME=' "$env_file"; then
    info "ANDROID_HOME already set in $env_file"
  else
    {
      echo "# Written by scripts/bootstrap.sh --system; sourced by the repo .envrc (planning/15 §1)."
      echo "export ANDROID_HOME=\"$sdk_dir\""
      # shellcheck disable=SC2016  # expanded when env.sh is sourced, not here
      echo 'export PATH="$ANDROID_HOME/platform-tools:$PATH"'
    } >>"$env_file"
    info "wrote ANDROID_HOME=$sdk_dir to $env_file (direnv loads it through .envrc)"
  fi
  if os_is_darwin; then
    log "Xcode (apps/ios)"
    apps/ios/scripts/xcode.sh doctor || warn "Xcode is not ready for apps/ios; follow the hints above (Xcode $(cat apps/ios/.xcode-version))"
  else
    log "Swift for the Linux iOS recipes and gen-swift.sh (Docker image swift:6.4)"
    if docker info >/dev/null 2>&1; then
      docker pull -q swift:6.4 || warn "docker pull swift:6.4 failed; the first ios-* recipe or just generate retries it"
    else
      warn "docker not reachable yet (log out and back in after the docker group change); the first ios-* recipe pulls swift:6.4"
    fi
  fi
else
  info "skipping native-app SDK steps (run with --system: Android SDK, ANDROID_HOME env file, Xcode check or Docker swift:6.4)"
fi

# --- 4. git hooks --------------------------------------------------------------------
log "git hooks (prek: gitleaks + commitlint)"
mise_exec prek install --hook-type pre-commit --hook-type commit-msg
if git lfs version >/dev/null 2>&1; then
  git lfs install --local >/dev/null 2>&1 && info "git lfs hooks installed (local)"
else
  if os_is_darwin; then
    warn "git-lfs missing — assets/3d/** needs it (run: just bootstrap --system, or: brew install git-lfs)"
  else
    warn "git-lfs missing — assets/3d/** needs it (run: just bootstrap --system)"
  fi
fi

# --- 5. .env scaffold ------------------------------------------------------------------
log ".env"
if [[ -f .env ]]; then
  info ".env exists — leaving it untouched"
else
  cp .env.example .env
  info "created .env from .env.example (empty values) — fill via: just secrets-sync"
fi
if have direnv || mise_exec direnv --version >/dev/null 2>&1; then
  mise_exec direnv allow . 2>/dev/null || true
fi

# --- 6. age identity + secrets onboarding -----------------------------------------------
log "age identity + secrets onboarding"
set +e
mise_exec scripts/security/secrets-onboard.sh
onboard_rc=$?
set -e
(( onboard_rc == 0 )) || warn "secrets onboarding step reported a problem — see above; bootstrap continues"

# --- 7. doctor -------------------------------------------------------------------------
log "doctor"
set +e
"$REPO_ROOT/scripts/doctor.sh"
doctor_rc=$?
set -e

# --- next steps ------------------------------------------------------------------------
heading "Next steps"
cat <<MSG
  Activate mise in your shell (not written to rc files by this script):
      eval "\$(~/.local/bin/mise activate zsh)"
      eval "\$(direnv hook zsh)"
  Then:  direnv allow
  Secrets: open the onboarding pull request printed above, then ask an approver to run
           'just secrets-approve <branch>'. Once it merges:  just secrets-sync  ·  just doctor  ·  just dev-api
  Back up your age identity in the team password manager, then:  just secrets-backup-done
MSG
exit "$doctor_rc"
