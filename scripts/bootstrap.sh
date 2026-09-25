#!/usr/bin/env bash
# just bootstrap — idempotent developer environment setup (planning/15 §1, §4).
#
#   scripts/bootstrap.sh            user-level steps only (no sudo): mise, pins, pnpm, hooks, .env,
#                                   and the mise + direnv block in your shell rc file
#   scripts/bootstrap.sh --system   additionally installs system packages and the native-app SDKs:
#                                     Linux  pacman (Arch, Omarchy) or apt (Debian, Ubuntu): Docker Engine,
#                                            Android udev rules, docker group (sudo); Docker image swift:6.4
#                                     macOS  Homebrew: git-lfs, OrbStack (installed and started); Xcode:
#                                            the pinned version installed with xcodes when missing (Apple ID
#                                            prompt), selected, licence + first launch, iOS simulator (sudo)
#                                     both   Android SDK packages (apps/android/tools/sdk.sh install, user-level)
#                                            and ANDROID_HOME in ~/.config/ai-stylist/env.sh (.envrc sources it)
#
# The rc block (zsh: ~/.zshrc; bash: ~/.bashrc on Linux, ~/.bash_profile on macOS) sits between
# marker lines and is rewritten in place on every run; other lines are never touched. Not under CI.
# Runs under macOS /bin/bash 3.2 as well as bash 5: no associative arrays, mapfile, ${var,,} etc.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "$REPO_ROOT"

SYSTEM=0
for arg in "$@"; do
  case "$arg" in
    --system) SYSTEM=1 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) die "unknown flag: $arg (accepted: --system)" ;;
  esac
done

# The functions below run in `f || warn` context, where bash ignores `set -e`: every step that
# can fail ends in `|| return 1`.

# macOS Docker runtime: OrbStack (Linux uses Docker Engine from pacman/apt). Installs the cask when
# the app is missing, starts the engine headless (`orb start`, a no-op when running), and makes its
# `orbstack` docker context the active one. OrbStack itself links docker into /usr/local/bin
# (after an admin prompt) and adds ~/.orbstack/bin to PATH from ~/.zprofile for new shells.
setup_orbstack() {
  if [[ -d /Applications/OrbStack.app ]]; then
    info "OrbStack installed"
  else
    brew install --cask orbstack || return 1
  fi
  local orb=/Applications/OrbStack.app/Contents/MacOS/bin/orb
  "$orb" start || return 1
  have docker || export PATH="$HOME/.orbstack/bin:$PATH"
  if [[ "$(docker context show 2>/dev/null)" != "orbstack" ]]; then
    docker context use orbstack >/dev/null || return 1
  fi
  docker info >/dev/null 2>&1 || { error "OrbStack started but 'docker info' fails"; return 1; }
  info "OrbStack running; docker context: orbstack"
}

# Xcode for apps/ios: the version pinned in apps/ios/.xcode-version, installed with xcodes when
# missing (it asks for your Apple ID and downloads about 10 GB), selected, licence accepted,
# first-launch packages installed, plus an iOS 26+ simulator runtime (just ios-test needs one).
setup_xcode() {
  local pinned state app=""
  pinned="$(tr -d '[:space:]' < apps/ios/.xcode-version)"
  state="$(darwin_xcode_state "$pinned")"
  case "$state" in
    ok) info "Xcode $pinned is the active Xcode" ;;
    unselected\ *) app="${state#unselected }" ;;
    *)
      info "Xcode $pinned is not installed: installing it with xcodes (Apple ID prompt, about 10 GB)"
      have xcodes || brew install xcodes || return 1
      xcodes install "$pinned" || return 1
      app="$(darwin_xcode_app "$pinned")" || { error "xcodes finished, but no Xcode $pinned in ${XCODES_DIRECTORY:-/Applications}"; return 1; }
      ;;
  esac
  if [[ -n "$app" ]]; then
    info "selecting $app (sudo xcode-select)"
    sudo xcode-select -s "$app/Contents/Developer" || return 1
  fi
  if ! xcodebuild -license check >/dev/null 2>&1 || ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
    info "accepting the Xcode licence and installing its first-launch packages (sudo xcodebuild -runFirstLaunch)"
    sudo xcodebuild -runFirstLaunch || return 1
  fi
  if xcrun simctl list runtimes available 2>/dev/null | command grep -Eq '^iOS (2[6-9]|[3-9][0-9])\.'; then
    info "iOS 26+ simulator runtime installed"
  else
    info "downloading the iOS simulator runtime (xcodebuild -downloadPlatform iOS, several GB)"
    xcodebuild -downloadPlatform iOS || return 1
  fi
  apps/ios/scripts/xcode.sh doctor
}

heading "AI Stylist bootstrap"

# --- 0. system packages (opt-in) -----------------------------------------------------
if (( SYSTEM )) && os_is_darwin; then
  log "system packages (Homebrew) — macOS"
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
  log "docker runtime: OrbStack"
  setup_orbstack || warn "OrbStack is not running; follow the output above, then re-run: just bootstrap --system"
  info "skipping udev rules / docker group / systemctl (Linux only)"
elif (( SYSTEM )); then
  # adb itself comes from the Android SDK's platform-tools (step 3), not the distro: two adb
  # binaries of different versions kill each other's server. The distro package adds udev rules only.
  if have pacman; then
    log "system packages (pacman: Arch, Omarchy) — requires sudo"
    # No -y: installing against the synced package database avoids a partial upgrade.
    # android-udev ships /usr/lib/udev/rules.d/51-android.rules (uaccess for the logged-in user).
    PACMAN_PKGS=(base-devel git git-lfs curl unzip zip ca-certificates gnupg openssl pkgconf
                 docker docker-compose docker-buildx android-udev)
    sudo pacman -S --needed --noconfirm "${PACMAN_PKGS[@]}" \
      || die "pacman could not install the packages; update the system first (sudo pacman -Syu, or omarchy-update on Omarchy), then re-run: just bootstrap --system"
  elif have apt-get; then
    log "system packages (apt: Debian, Ubuntu) — requires sudo"
    APT_PKGS=(build-essential git git-lfs curl unzip zip ca-certificates gnupg libssl-dev pkg-config
              docker.io docker-compose-v2 android-sdk-platform-tools-common)
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
  else
    die "bootstrap --system supports pacman (Arch, Omarchy) and apt (Debian, Ubuntu); on this distro install Docker Engine + compose, git-lfs, a C toolchain, curl, unzip and zip by hand, then re-run without --system"
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
    info "skipping Homebrew steps (run with --system to include them: Xcode CLT check, git-lfs, OrbStack)"
  else
    info "skipping pacman/apt / udev / docker-group steps (run with --system to include them; they need sudo)"
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
    setup_xcode || warn "Xcode is not ready for apps/ios; follow the output above, then re-run: just bootstrap --system"
  else
    log "Swift for the Linux iOS recipes and gen-swift.sh (Docker image swift:6.4)"
    if docker info >/dev/null 2>&1; then
      docker pull -q swift:6.4 || warn "docker pull swift:6.4 failed; the first ios-* recipe or just generate retries it"
    else
      warn "docker not reachable yet (log out and back in after the docker group change); the first ios-* recipe pulls swift:6.4"
    fi
  fi
else
  info "skipping native-app SDK steps (run with --system: Android SDK, ANDROID_HOME env file, Xcode setup or Docker swift:6.4)"
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
# The value of KEY in .env (last assignment wins, as in dotenv), unquoted; empty when absent.
env_file_value() {
  awk -v key="$1" -v q="'" '
    { line = $0; sub(/\r$/, "", line); sub(/^export[[:space:]]+/, "", line) }
    index(line, key "=") == 1 { val = substr(line, length(key) + 2) }
    END {
      sub(/[[:space:]]+$/, "", val)
      first = substr(val, 1, 1)
      if (length(val) >= 2 && (first == "\"" || first == q) && substr(val, length(val), 1) == first)
        val = substr(val, 2, length(val) - 2)
      print val
    }' .env
}

if [[ -f .env ]]; then
  info ".env exists — only an empty DATABASE_URL is filled in (below)"
else
  cp .env.example .env
  info "created .env from .env.example (empty values) — shared values come from: just secrets-sync"
fi
# .env.example keeps every value empty (scripts/ci/env-example-check.sh), but the API cannot reach a
# database without one. Point an empty DATABASE_URL at the docker-compose Postgres documented in
# .env.example, resolving the host port the way compose does: POSTGRES_HOST_PORT from the
# environment, else from .env, else 5432. A non-empty value (hand-set or synced) is never touched;
# secrets-sync skips keys whose shared value is empty, so it does not blank this one either.
if [[ -z "$(env_file_value DATABASE_URL)" ]]; then
  if [[ -n "${POSTGRES_HOST_PORT+set}" ]]; then pg_port="$POSTGRES_HOST_PORT"; else pg_port="$(env_file_value POSTGRES_HOST_PORT)"; fi
  pg_port="${pg_port:-5432}"
  local_db_url="postgres://ai_stylist:ai_stylist@localhost:${pg_port}/ai_stylist"
  env_tmp="$(mktemp)"
  awk -v url="$local_db_url" '
    /^(export[[:space:]]+)?DATABASE_URL=/ { if (!done) print "DATABASE_URL=" url; done = 1; next }
    { print }
    END { if (!done) print "DATABASE_URL=" url }' .env > "$env_tmp"
  cat "$env_tmp" > .env   # rewrite in place: keeps .env's existing mode (secrets-sync makes it 0600)
  rm -f "$env_tmp"
  info "DATABASE_URL was empty — set it to the local docker-compose Postgres (localhost:$pg_port)"
fi
if have direnv || mise_exec direnv --version >/dev/null 2>&1; then
  mise_exec direnv allow . 2>/dev/null || true
fi

# --- 5b. shell activation (managed block in the rc file) ----------------------------------
log "shell activation (mise + direnv)"
if [[ "${CI:-}" == "true" ]]; then
  info "CI: rc file not changed (CI shells are not interactive)"
  shell_hint=""
elif ! rc_file="$(shell_rc_file)"; then
  warn "login shell '${SHELL:-unknown}' is neither zsh nor bash: add mise and direnv activation to its config by hand"
  shell_hint="Activate mise and direnv in your shell's config by hand (mise: 'mise activate --help'; direnv: 'direnv hook --help')."
else
  direnv_version="$("$MISE_BIN" current direnv 2>/dev/null || true)"
  if [[ -z "$direnv_version" ]]; then
    die "mise.toml pins no direnv version ('$MISE_BIN current direnv' is empty); run '$MISE_BIN install --yes' and re-run"
  fi
  shell_activation_write "$rc_file" "$(basename "$SHELL")" "$direnv_version"
  info "mise + direnv block up to date in $rc_file"
  shell_hint="Open a new terminal so mise and direnv load ($rc_file)."
fi

# --- 6. age identity + secrets onboarding -----------------------------------------------
log "age identity + secrets onboarding"
onboard_status_file="$(mktemp)"
trap 'rm -f "$onboard_status_file"' EXIT
set +e
SECRETS_ONBOARD_STATUS_FILE="$onboard_status_file" mise_exec scripts/security/secrets-onboard.sh
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
# The Secrets line follows what onboarding actually did (status words: secrets-onboard.sh header).
if command grep -qx pushed "$onboard_status_file"; then
  secrets_hint="Secrets: open the onboarding pull request printed above, then ask an approver to run
           'just secrets-approve <branch>'. Once it merges:  just secrets-sync  ·  just doctor  ·  just dev-api"
elif command grep -qx synced "$onboard_status_file"; then
  secrets_hint="Secrets: your age recipient is already approved; the shared dev values were synced into .env
           (refresh any time with: just secrets-sync). Then:  just doctor  ·  just dev-api"
elif command grep -qx skipped "$onboard_status_file"; then
  secrets_hint="Secrets: onboarding skipped (CI or SOPS_AGE_KEY is set); fill .env with:  just secrets-sync"
else
  secrets_hint="Secrets: onboarding did not finish — follow its output above, then:  just secrets-sync  ·  just doctor"
fi
if [[ -n "$shell_hint" ]]; then
  info "$shell_hint"
fi
cat <<MSG
  $secrets_hint
  Back up your age identity in the team password manager, then:  just secrets-backup-done
MSG
exit "$doctor_rc"
