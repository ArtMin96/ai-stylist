# Developing on macOS

The tooling (`scripts/**`, `justfile`, `mise.toml`) runs on macOS (Apple Silicon and Intel) and Linux. Every script is written for the macOS default `/bin/bash` 3.2 (no `brew install bash` needed) and uses only flags shared by GNU and BSD tools; `just lint` runs shellcheck with `-s bash` to keep it that way. The `.github/workflows/portability.yml` workflow runs `scripts/bootstrap.sh` and every non-native quality gate on a `macos-15` (arm64) runner and on Ubuntu; the native lanes run in `ios.yml` (simulator build and tests on the `xcode-27` arm64 image) and `android.yml`.

## Prerequisites (once per Mac)

1. **Xcode Command Line Tools**: `xcode-select --install` (interactive Apple dialog). For iOS work also install the exact Xcode pinned in `apps/ios/.xcode-version` (Xcode 27 today; for example with `xcodes install <version>`, or the Apple developer downloads page), select it (`sudo xcode-select -s /Applications/Xcode-<version>.app`), and open it once to accept the licence and install the iOS simulator runtime. `just ios-doctor` checks all of it.
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
./scripts/bootstrap.sh --system   # Homebrew: git-lfs; Android SDK packages (~/Library/Android/sdk); Xcode check; detects your Docker runtime. No sudo.
./scripts/bootstrap.sh            # mise -> pinned toolchain (incl. xcodegen, xcbeautify, SwiftLint, maestro) -> pnpm install -> uv sync -> git hooks -> .env -> doctor
eval "$(~/.local/bin/mise activate zsh)"   # add to ~/.zshrc
eval "$(direnv hook zsh)"                  # add to ~/.zshrc; then `direnv allow` once (loads .env and ANDROID_HOME)
just doctor
```

`mise` installs to `~/.local/bin/mise` with shims in `~/.local/share/mise/shims` on macOS too (mise "Directories": data dir is `${XDG_DATA_HOME:-$HOME/.local/share}/mise`; only the cache moves to `~/Library/Caches/mise`). Every pin in `mise.toml` has a darwin-arm64 build (Temurin is arm64-native; oasdiff ships a universal binary); verified 2026-09-10 for the pre-native pins; the native-app pins added on 2026-09-22 (Temurin 21, xcodegen, xcbeautify, SwiftLint, maestro) installed on the `macos-15` portability runner on 2026-09-23. `xcodegen` and `xcbeautify` are macOS-only pins.

## What differs from Linux

- `bootstrap.sh --system` uses Homebrew instead of apt and skips udev rules, the docker group and systemd. It stops with instructions if Xcode CLT or Homebrew are missing (both installers are interactive) and only detects the Docker runtime, never installs one.
- `just doctor` adds a warn-only Xcode check (installed version vs `apps/ios/.xcode-version`).
- The native iOS app (`apps/ios`) builds and runs only on macOS with Xcode: `just ios-project` (XcodeGen), `just ios-build`, `just ios-test`, `just ios-e2e`, or all Linux-capable checks plus the simulator build and tests with `just ios-check`. Swift comes from Xcode here (Linux uses Docker `swift:6.4`). Its README covers the simulator and device workflow.
- The native Android app (`apps/android`) builds on macOS and Linux alike (`just android-check`). After a dependency bump, run `just android-deps-lock` once on a Mac too and commit any macOS-only checksums it adds to `apps/android/gradle/verification-metadata.xml`.
- The pgvector Postgres image is multi-arch (`pgvector/pgvector:pg17` publishes amd64 and arm64), so `just dev-api` needs no emulation.

## Known gaps

- `SKIP_DOCKER_TESTS=1 just test` leaves out the Testcontainers `migrations` project; it exists for the macOS CI runner (no Docker) and is not for local use. The project itself still fails, never skips, when Docker is missing.
- The `--system` step installs the Android SDK packages but no emulator image; create an emulator with Android Studio (or `sdkmanager` + `avdmanager`) to run `just android-e2e`.
- Intel Macs are supported by every pin but are not exercised by CI (`macos-15` and `xcode-27` are arm64).
