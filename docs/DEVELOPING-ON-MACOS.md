# Developing on macOS

The tooling (`scripts/**`, `justfile`, `mise.toml`) runs on macOS (Apple Silicon and Intel) and Linux. Every script is written for the macOS default `/bin/bash` 3.2 (no `brew install bash` needed) and uses only flags shared by GNU and BSD tools; `just lint` runs shellcheck with `-s bash` to keep it that way. The `.github/workflows/portability.yml` workflow runs `scripts/bootstrap.sh` and every non-native quality gate on a `macos-15` (arm64) runner and on Ubuntu; the native lanes run in `ios.yml` (simulator build and tests on the `xcode-27` arm64 image) and `android.yml`.

## Prerequisites (once per Mac)

Install these two yourself, because their installers are interactive. `./scripts/bootstrap.sh --system` stops and prints the command if either is missing.

1. **Xcode Command Line Tools**: `xcode-select --install` (an Apple dialog; wait for it to finish).
2. **Homebrew**: the official one-liner from <https://brew.sh>. The bootstrap script never installs it for you.

`./scripts/bootstrap.sh --system` sets up the rest:

- **Docker runtime: OrbStack.** macOS has no native Docker daemon. This repo uses OrbStack for `docker compose` (Postgres) and Testcontainers (the migration tests), with nothing to configure. If `/Applications/OrbStack.app` is missing, bootstrap installs it (`brew install --cask orbstack`). It then starts OrbStack headless (`orb start`) and makes `orbstack` the active docker context. On first start OrbStack asks for an admin password to link `docker` into `/usr/local/bin` and `/var/run/docker.sock`. It also adds its own line to `~/.zprofile`. OrbStack is free for personal use; commercial use needs a paid seat.
- **Xcode** for `apps/ios`: the version pinned in `apps/ios/.xcode-version` (Xcode 27 today). An `/Applications/Xcode*.app` of that version is reused, whether it came from the App Store, `xcodes`, or the Apple downloads page. If the pinned version is missing, bootstrap installs it with `xcodes`, which asks for your Apple ID and downloads about 10 GB. It selects it (`sudo xcode-select -s`). If the licence or first-launch setup is pending, it runs `sudo xcodebuild -runFirstLaunch`. Without an iOS 26+ simulator runtime it runs `xcodebuild -downloadPlatform iOS` (several GB). It finishes with the `just ios-doctor` checks.

## Setup: the same commands as Linux

```bash
git clone https://github.com/ArtMin96/ai-stylist.git && cd ai-stylist
./scripts/bootstrap.sh --system   # Homebrew: git-lfs, OrbStack (installed + started); Android SDK packages (~/Library/Android/sdk); pinned Xcode (xcodes if missing), selected, licence + first launch, iOS simulator (sudo)
./scripts/bootstrap.sh            # mise -> pinned toolchain (incl. xcodegen, xcbeautify, SwiftLint, maestro) -> pnpm install -> uv sync -> git hooks -> .env -> mise + direnv block in ~/.zshrc -> doctor
# open a new terminal: the ~/.zshrc block activates mise and direnv (.envrc loads .env and ANDROID_HOME)
just doctor
```

`mise` installs to `~/.local/bin/mise` with shims in `~/.local/share/mise/shims` on macOS too (mise "Directories": data dir is `${XDG_DATA_HOME:-$HOME/.local/share}/mise`; only the cache moves to `~/Library/Caches/mise`). Every pin in `mise.toml` has a darwin-arm64 build (Temurin is arm64-native; oasdiff ships a universal binary); verified 2026-09-10 for the pre-native pins; the native-app pins added on 2026-09-22 (Temurin 21, xcodegen, xcbeautify, SwiftLint, maestro) installed on the `macos-15` portability runner on 2026-09-23. `xcodegen` and `xcbeautify` are macOS-only pins.

## What differs from Linux

- `bootstrap.sh --system` uses Homebrew instead of pacman or apt and skips udev rules, the docker group and systemd. It stops with instructions if the Xcode CLT or Homebrew are missing (both installers are interactive). The Docker runtime is OrbStack instead of Docker Engine, and the Xcode steps are macOS-only; both are described above.
- Bash users: bootstrap writes the mise + direnv block to `~/.bash_profile`, because Terminal opens login shells (Linux: `~/.bashrc`). Zsh uses `${ZDOTDIR:-$HOME}/.zshrc` on both.
- `just doctor` adds a warn-only Xcode check: does `xcodebuild` run the version in `apps/ios/.xcode-version`? If not, it says whether that version is missing or installed but not selected (for example while the Command Line Tools are the active developer directory), and points at `./scripts/bootstrap.sh --system`.
- The native iOS app (`apps/ios`) builds and runs only on macOS with Xcode: `just ios-project` (XcodeGen), `just ios-build`, `just ios-test`, `just ios-e2e`, or all Linux-capable checks plus the simulator build and tests with `just ios-check`. Swift comes from Xcode here (Linux uses Docker `swift:6.4`). Its README covers the simulator and device workflow.
- The native Android app (`apps/android`) builds on macOS and Linux alike (`just android-check`). After a dependency bump, run `just android-deps-lock` once on a Mac too and commit any macOS-only checksums it adds to `apps/android/gradle/verification-metadata.xml`.
- The pgvector Postgres image is multi-arch (`pgvector/pgvector:pg17` publishes amd64 and arm64), so `just dev-api` needs no emulation.

## Known gaps

- `SKIP_DOCKER_TESTS=1 just test` leaves out the Testcontainers `migrations` project; it exists for the macOS CI runner (no Docker) and is not for local use. The project itself still fails, never skips, when Docker is missing.
- The `--system` step installs the Android SDK packages but no emulator image; create an emulator with Android Studio (or `sdkmanager` + `avdmanager`) to run `just android-e2e`.
- Intel Macs are supported by every pin but are not exercised by CI (`macos-15` and `xcode-27` are arm64).
