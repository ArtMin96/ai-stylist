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
  ok "mise present at $MISE_BIN ($("$MISE_BIN" --version 2>/dev/null | head -1))"
  # Every tool pinned in this repo's mise config must resolve to exactly its pinned version
  # (mise ls --current --json). `--current` also merges the user's global/system configs
  # (~/.config/mise/config.toml, a parent directory's mise.toml); those tools are not this repo's
  # pins, so entries sourced from a config file outside $REPO_ROOT are skipped. Everything else —
  # mise.toml, a repo-local mise.local.toml, a MISE_<TOOL>_VERSION env override — is still checked.
  pin_rows="$("$MISE_BIN" ls --current --json 2>/dev/null \
    | doctor_python -c '
import json,os,sys
root=os.path.realpath(sys.argv[1])
d=json.load(sys.stdin)
for tool,entries in d.items():
    for e in entries:
        src=(e.get("source") or {}).get("path") or ""
        if src and not os.path.realpath(src).startswith(root + os.sep):
            continue
        req=e.get("requested_version") or ""
        inst=e.get("version") if e.get("installed") else "(missing)"
        print(f"{tool}\t{req}\t{inst}")' "$REPO_ROOT" 2>/dev/null || true)"
  if [[ -z "$pin_rows" ]]; then
    fail "could not read this repo's pinned tool versions (mise ls --current --json)" "$MISE_BIN trust && $MISE_BIN install --yes   (or: just bootstrap)"
  fi
  while IFS=$'\t' read -r tool requested installed; do
    [[ -z "$tool" ]] && continue
    if [[ "$installed" == "$requested" ]]; then
      ok "$tool $installed"
    else
      fail "$tool resolves to '$installed', pinned '$requested'" "$MISE_BIN install $tool@$requested"
    fi
  done <<< "$pin_rows"
else
  # shellcheck disable=SC2088  # the ~ is in a message for a human, not expanded here
  fail "mise not found at $MISE_BIN (unless MISE_BIN is set, ~/.local/bin/mise then PATH are tried)" "curl https://mise.run | sh   (or: just bootstrap)"
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
# macOS has no native daemon: this repo uses OrbStack, which bootstrap.sh --system installs and starts
# (docs/DEVELOPING-ON-MACOS.md). A machine that already runs Colima still works, but Testcontainers
# (apps/api migrations tests) talks to the socket directly, which Colima only exposes through DOCKER_HOST.
colima_sock="unix://$HOME/.colima/default/docker.sock"
if have docker; then
  if docker info >/dev/null 2>&1; then
    ok "docker daemon reachable"
    if os_is_darwin && [[ "$(darwin_docker_runtime)" == "colima" && -z "${DOCKER_HOST:-}" ]]; then
      warnc "Colima is the docker runtime but DOCKER_HOST is unset (Testcontainers cannot find the socket)" "export DOCKER_HOST=$colima_sock   (or switch to OrbStack: ./scripts/bootstrap.sh --system)"
    fi
  elif os_is_darwin; then
    case "$(darwin_docker_runtime)" in
      orbstack) fail "docker daemon not reachable (OrbStack installed but not running)" "orb start" ;;
      *) fail "docker daemon not reachable (this repo uses OrbStack on macOS)" "./scripts/bootstrap.sh --system   (installs and starts OrbStack)" ;;
    esac
  else
    fail "docker daemon not reachable" "./scripts/bootstrap.sh --system   (enables the docker service, adds you to the docker group; then log out and back in)"
  fi
elif os_is_darwin; then
  fail "docker not installed (this repo uses OrbStack on macOS)" "./scripts/bootstrap.sh --system   (installs and starts OrbStack)"
else
  fail "docker not installed" "./scripts/bootstrap.sh --system   (installs Docker Engine + compose with pacman or apt)"
fi

# --- direnv ---------------------------------------------------------------------
if have direnv || { [[ -x "$MISE_BIN" ]] && mise_exec direnv --version >/dev/null 2>&1; }; then
  ok "direnv present"
  if [[ -z "${DIRENV_DIR:-}" ]]; then
    if rc_file="$(shell_rc_file)" && command grep -qxF "$SHELL_RC_BEGIN" "$rc_file" 2>/dev/null; then
      warnc "direnv not active in this shell" "open a new terminal (the mise + direnv lines are in $rc_file), then cd into the repo"
    else
      warnc "direnv not active in this shell" "./scripts/bootstrap.sh   (adds the mise + direnv lines to your shell rc file), then open a new terminal"
    fi
  fi
else
  fail "direnv missing" "$MISE_BIN install direnv"
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

# --- jq (Claude Code hooks) -------------------------------------------------------
# Every PreToolUse guard in scripts/hooks/ parses its payload with jq and denies the tool call
# without it (fail closed), so an agent session here cannot edit files or run commands.
if have jq; then
  ok "jq present ($(jq --version 2>/dev/null))"
elif os_is_darwin; then
  fail "jq not installed (the Claude Code guards in scripts/hooks/ deny every edit and command without it)" "brew install jq   (macOS 15+ ships /usr/bin/jq)"
else
  fail "jq not installed (the Claude Code guards in scripts/hooks/ deny every edit and command without it)" "sudo pacman -S jq   (or: sudo apt-get install jq)"
fi

# --- git lfs --------------------------------------------------------------------
if git lfs version >/dev/null 2>&1; then
  ok "git LFS installed ($(git lfs version | head -1))"
else
  if os_is_darwin; then
    fail "git LFS not installed (assets/3d/** needs it)" "just bootstrap --system  (brew install git-lfs) then: git lfs install"
  else
    fail "git LFS not installed (assets/3d/** needs it)" "just bootstrap --system  (pacman or apt install git-lfs) then: git lfs install"
  fi
fi

# --- disk -----------------------------------------------------------------------
free_gb="$(disk_free_gb .)"
if (( free_gb >= 10 )); then
  ok "free disk ${free_gb}G (≥ 10G)"
else
  fail "free disk ${free_gb}G < 10G" "free space for pnpm store / asset caches / Docker images"
fi

# --- Android (apps/android; warn only: backend-only machines need none of it) ------------------
java_major=""
if have java; then
  java_major="$(java -XshowSettings:properties -version 2>&1 | sed -n 's/^ *java\.specification\.version = //p')"
fi
if [[ "$java_major" == "21" ]]; then
  ok "JDK 21 on PATH (apps/android, gen-kotlin.sh)"
else
  warnc "java is '${java_major:-missing}'; apps/android and just generate need JDK 21" "mise install   (mise.toml pins Temurin 21)"
fi
# apps/android/tools/gradle.sh prefers JAVA_HOME over PATH: a stale one (e.g. an old global mise JDK) breaks Gradle.
if [[ -n "${JAVA_HOME:-}" ]]; then
  java_home_major="$("$JAVA_HOME/bin/java" -XshowSettings:properties -version 2>&1 | sed -n 's/^ *java\.specification\.version = //p' || true)"
  if [[ "$java_home_major" != "21" ]]; then
    warnc "JAVA_HOME=$JAVA_HOME is JDK '${java_home_major:-unknown}', and Gradle (apps/android) uses it over PATH" "unset JAVA_HOME, or point it at the mise JDK 21 (mise where java)"
  fi
fi
if sdk_report="$(apps/android/tools/sdk.sh check 2>&1)"; then
  sdk_line="$(printf '%s\n' "$sdk_report" | tail -n 1)"
  ok "$sdk_line"
  sdk_root="${sdk_line#android sdk: complete at }"
  if [[ -z "${ANDROID_HOME:-}" ]]; then
    # shellcheck disable=SC2016  # hint text for the reader's rc file
    warnc "ANDROID_HOME is unset (apps/android/tools/gradle.sh still finds $sdk_root; IDEs and adb want it)" 'just bootstrap --system writes it to ~/.config/ai-stylist/env.sh; or export ANDROID_HOME and put $ANDROID_HOME/platform-tools on PATH'
  fi
  if have adb && [[ "$(command -v adb)" != "$sdk_root/platform-tools/adb" ]]; then
    # shellcheck disable=SC2016
    warnc "adb on PATH is $(command -v adb), not the SDK's $sdk_root/platform-tools/adb (two adb servers fight over devices)" 'put $ANDROID_HOME/platform-tools first on PATH'
  fi
else
  warnc "Android SDK incomplete (only needed for apps/android work)" "just android-sdk install   (user-level, no sudo; apps/android/README.md)"
fi

# --- iOS (apps/ios; warn only) --------------------------------------------------------------
if os_is_darwin; then
  pinned_xcode="$(tr -d '[:space:]' < apps/ios/.xcode-version 2>/dev/null || true)"
  xcode_state="$(darwin_xcode_state "$pinned_xcode")"
  case "$xcode_state" in
    ok) ok "Xcode $pinned_xcode (pinned in apps/ios/.xcode-version)" ;;
    unselected\ *)
      warnc "Xcode $pinned_xcode is installed at ${xcode_state#unselected } but xcodebuild cannot use it (active developer directory: $(xcode-select -p 2>/dev/null || echo none))" \
        "./scripts/bootstrap.sh --system   (selects it, accepts its licence, runs its first-launch setup)" ;;
    other\ *)
      warnc "Xcode ${xcode_state#other }, but apps/ios/.xcode-version pins $pinned_xcode" \
        "./scripts/bootstrap.sh --system   (installs Xcode $pinned_xcode with xcodes and selects it)" ;;
    *)
      warnc "Xcode $pinned_xcode not installed (iOS builds need it, not only the command line tools)" \
        "./scripts/bootstrap.sh --system   (installs it with xcodes: asks for your Apple ID)" ;;
  esac
else
  # Linux: the Linux-capable iOS recipes and gen-swift.sh run Docker swift:6.4 unless a working
  # swift is on PATH (mise's swift cannot run on Arch).
  if have swift && swift --version >/dev/null 2>&1; then
    ok "swift on PATH ($(swift --version 2>&1 | head -n 1))"
  elif have docker && docker info >/dev/null 2>&1; then
    if docker image inspect swift:6.4 >/dev/null 2>&1; then
      ok "Swift via Docker image swift:6.4 (ios-test-packages, ios-format, just generate)"
    else
      warnc "Docker image swift:6.4 not pulled yet: the first ios-* recipe or just generate pulls about 1.3 GB" "docker pull swift:6.4"
    fi
  else
    warnc "no Swift toolchain: the Linux iOS recipes and the Swift half of just generate need swift or Docker" "fix Docker above (image swift:6.4 is pulled on first use)"
  fi
fi

# --- summary -------------------------------------------------------------------------
echo
if (( DOCTOR_FAILURES > 0 )); then
  error "$DOCTOR_FAILURES check(s) failed, $DOCTOR_WARNINGS warning(s)"
  exit 1
fi
log "all checks passed ($DOCTOR_WARNINGS warning(s))"
