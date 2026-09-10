#!/usr/bin/env bash
# just bootstrap — idempotent developer environment setup (planning/15 §1, §4).
#
#   scripts/bootstrap.sh            user-level steps only (no sudo): mise, pins, pnpm, hooks, .env
#   scripts/bootstrap.sh --system   additionally runs the apt / udev / docker-group steps (sudo)
#
# Never edits shell rc files; prints the activation line at the end instead.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$REPO_ROOT"

SYSTEM=0
WATCHMAN_VERSION="${WATCHMAN_VERSION:-2026.07.27.00}"   # bump with Renovate-style PRs; not mise-managed (see mise.toml)
for arg in "$@"; do
  case "$arg" in
    --system) SYSTEM=1 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) die "unknown flag: $arg (accepted: --system)" ;;
  esac
done

heading "AI Stylist bootstrap"

# --- 0. system packages (opt-in, sudo) -------------------------------------------
if (( SYSTEM )); then
  log "system packages (apt) — requires sudo"
  APT_PKGS=(build-essential git git-lfs curl unzip zip ca-certificates gnupg libssl-dev pkg-config
            docker.io docker-compose-v2 android-sdk-platform-tools-common adb)
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
  if id -nG "$me" | /usr/bin/grep -qw docker; then
    info "$me already in docker group"
  else
    sudo usermod -aG docker "$me"
    warn "added $me to docker group — log out and back in for it to take effect"
  fi
  sudo systemctl enable --now docker >/dev/null 2>&1 || warn "could not enable docker service"
  log "watchman (Metro file watcher; prebuilt binary needs libs in /usr/local/lib)"
  if have watchman; then
    info "present: $(watchman --version 2>/dev/null || true)"
  else
    tmp="$(mktemp -d)"
    curl -fsSL -o "$tmp/watchman.zip" \
      "https://github.com/facebook/watchman/releases/download/v${WATCHMAN_VERSION}/watchman-v${WATCHMAN_VERSION}-linux.zip"
    unzip -q "$tmp/watchman.zip" -d "$tmp"
    sudo mkdir -p /usr/local/{bin,lib} /usr/local/var/run/watchman
    sudo cp "$tmp"/watchman-v*/bin/* /usr/local/bin/
    sudo cp "$tmp"/watchman-v*/lib/* /usr/local/lib/
    sudo chmod 755 /usr/local/bin/watchman
    sudo chmod 2777 /usr/local/var/run/watchman
    rm -rf "$tmp"
    info "installed watchman v${WATCHMAN_VERSION}"
  fi
else
  info "skipping apt / udev / docker-group steps (run with --system to include them; they need sudo)"
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

# --- 4. git hooks --------------------------------------------------------------------
log "git hooks (prek: gitleaks + commitlint)"
mise_exec prek install --hook-type pre-commit --hook-type commit-msg
if git lfs version >/dev/null 2>&1; then
  git lfs install --local >/dev/null 2>&1 && info "git lfs hooks installed (local)"
else
  warn "git-lfs missing — assets/3d/** needs it (run: just bootstrap --system)"
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

# --- 6. doctor -------------------------------------------------------------------------
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
  Then:  direnv allow   ·   just secrets-sync   ·   just doctor   ·   just dev-api
MSG
exit "$doctor_rc"
