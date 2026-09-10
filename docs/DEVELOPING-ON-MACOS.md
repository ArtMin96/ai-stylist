# Developing on macOS

The tooling (`scripts/**`, `justfile`, `mise.toml`) runs on macOS (Apple Silicon and Intel) and Linux. Every script is written for the macOS default `/bin/bash` 3.2 (no `brew install bash` needed) and uses only flags shared by GNU and BSD tools; `just lint` runs shellcheck with `-s bash` to keep it that way. The `.github/workflows/portability.yml` workflow runs `scripts/bootstrap.sh` and every quality gate on a `macos-15` (arm64) runner and on Ubuntu.

## Prerequisites (once per Mac)

1. **Xcode Command Line Tools**: `xcode-select --install` (interactive Apple dialog). For iOS builds also install Xcode from the App Store and open it once to accept the licence.
2. **Homebrew**: the official one-liner from <https://brew.sh>. The bootstrap script never installs it for you.
3. **A Docker runtime** (`docker compose` for Postgres, Testcontainers for the migration tests). macOS has no native daemon; pick one:

   | Runtime        | Install                        | Notes                                                                                                           |
   | -------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
   | Docker Desktop | `brew install --cask docker`   | GUI, zero config for Testcontainers. Check Docker's licence terms for your company size.                        |
   | OrbStack       | `brew install --cask orbstack` | Fastest and lightest, zero config for Testcontainers. Free for personal use, paid seat for commercial use.      |
   | Colima         | `brew install colima docker`   | CLI only, free. Testcontainers needs `export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock` (see below). |

   Recommendation: Docker Desktop or OrbStack (nothing to configure); Colima if you want no GUI. Colima: add to `~/.zshrc`
   `export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock` and `export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`
   (Testcontainers for Node "Supported container runtimes", checked 2026-09-10). `just doctor` warns when Colima is active without `DOCKER_HOST`.

## Setup: the same commands as Linux

```bash
git clone https://github.com/ArtMin96/ai-stylist.git && cd ai-stylist
./scripts/bootstrap.sh --system   # Homebrew: git-lfs, watchman, android-platform-tools (adb); detects your Docker runtime. No sudo.
./scripts/bootstrap.sh            # mise -> pinned toolchain -> pnpm install -> uv sync -> git hooks -> .env -> doctor
eval "$(~/.local/bin/mise activate zsh)"   # add to ~/.zshrc
just doctor
```

`mise` installs to `~/.local/bin/mise` with shims in `~/.local/share/mise/shims` on macOS too (mise "Directories": data dir is `${XDG_DATA_HOME:-$HOME/.local/share}/mise`; only the cache moves to `~/Library/Caches/mise`). Every pin in `mise.toml` has a darwin-arm64 build (Temurin 17 is arm64-native; oasdiff ships a universal binary); verified 2026-09-10.

## What differs from Linux

- `bootstrap.sh --system` uses Homebrew instead of apt and skips udev rules, the docker group and systemd. It stops with instructions if Xcode CLT or Homebrew are missing (both installers are interactive) and only detects the Docker runtime, never installs one.
- `just doctor` adds two warn-only checks: Xcode Command Line Tools and CocoaPods (`brew install cocoapods`). Expo SDK 57 still runs `pod install` during `expo prebuild` / `expo run:ios` (the SDK 57 upgrade notes say `npx pod-install`; checked 2026-09-10). Watchman is optional: Expo needs it only for SDK 55 and earlier, Metro uses Node's watcher otherwise.
- The iOS simulator is available: `just dev-mobile --ios` opens the dev client in it.
- Local iOS build: `just mobile-ios-build --profile dev` (no `--cloud`) runs `expo run:ios` (Expo's documented local path for a development build; `eas build --local` exists only to reproduce cloud build failures). `--profile preview|prod` builds `--configuration Release`; `--device` targets a USB-connected iPhone (needs a signing team selected in Xcode). `--cloud eas|gha` behave exactly as on Linux.
- `just mobile-android-build` finds the SDK at `~/Library/Android/sdk` (Android Studio default) when `ANDROID_HOME` is unset.
- The pgvector Postgres image is multi-arch (`pgvector/pgvector:pg17` publishes amd64 and arm64), so `just dev-api` needs no emulation.

## Known gaps

- `SKIP_DOCKER_TESTS=1 just test` leaves out the Testcontainers `migrations` project; it exists for the macOS CI runner (no Docker) and is not for local use. The project itself still fails, never skips, when Docker is missing.
- The `--system` step installs no Android SDK or emulator; install Android Studio for that.
- Intel Macs are supported by every pin but are not exercised by CI (`macos-15` is arm64).
