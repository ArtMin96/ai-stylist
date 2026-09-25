# Proposal — human-only doc edits from the 2026-09-25 bootstrap automation

`planning/15-team-workflow-and-ai-agent-operations.md` is human-only (root `CLAUDE.md`, "Prohibited without explicit human authorization"; `.claude/rules/docs-and-progress.md`). Branch `fix/bootstrap-automation` changed `scripts/bootstrap.sh`, `scripts/doctor.sh` and the `just test` routes, so the lines below are now out of date. Apply them by hand, or authorize an agent to apply exactly these edits. Item 3 supersedes item 4 of [`s4-doc-refresh-human-proposals.md`](s4-doc-refresh-human-proposals.md).

## `planning/15-team-workflow-and-ai-agent-operations.md`

1. §1 heading and §1.1: Linux is no longer Ubuntu-only; Arch (Omarchy) via pacman is the primary Linux target and apt stays supported.

   ```diff
   -## 1. Developer environment (Ubuntu Linux)
   +## 1. Developer environment (Linux: Arch/Omarchy or Ubuntu; macOS)
   ```

   ```diff
   -### 1.1 System packages (apt)
   +### 1.1 System packages (pacman or apt)
   ```

   Add under the §1.1 code block: "`scripts/bootstrap.sh --system` installs them with `pacman -S --needed` (Arch, Omarchy: `base-devel git git-lfs curl unzip zip ca-certificates gnupg openssl pkgconf docker docker-compose docker-buildx android-udev`) or `apt-get install` (Ubuntu: `build-essential … docker.io docker-compose-v2 android-sdk-platform-tools-common`); any other distro stops with the list to install by hand. `adb` itself comes from the Android SDK's platform-tools, never the distro."

2. §1.4 Containers, first bullet:

   ```diff
   -- **Docker Engine + Compose plugin** (docker.io or docker-ce). Used for: …
   +- **Docker Engine + Compose plugin** on Linux (Arch `docker` + `docker-compose`, Ubuntu `docker.io` + `docker-compose-v2`); **OrbStack** on macOS, installed and started by `bootstrap.sh --system` (no Docker Desktop, no Colima). Used for: …
   ```

3. §4 `just bootstrap` "Steps:" sentence. Proposed replacement:

   > Steps: `--system` (Linux: pacman or apt packages, udev rules, Docker group + service; macOS: Xcode CLT + Homebrew check, git-lfs, OrbStack installed and started, the pinned Xcode installed with `xcodes` when missing, selected, licence + first launch, iOS simulator runtime; both: Android SDK packages + `ANDROID_HOME` in `~/.config/ai-stylist/env.sh`; Linux also Docker `swift:6.4`) → mise (an existing one on PATH, else installed to `~/.local/bin`) + `mise install` (all pins) → `pnpm install` / `uv sync` → git hooks (`prek`: gitleaks, commitlint) → `.env` scaffold from `.env.example` with the local `DATABASE_URL` → the mise + direnv block in the shell rc file (zsh `~/.zshrc`; bash `~/.bashrc` on Linux, `~/.bash_profile` on macOS; skipped when `CI=true`) → age identity + secrets onboarding PR, or `secrets-sync` when the recipient is already listed (§6) → `just doctor` → prints next steps (open a new terminal; secrets).

   Also in §4: "Two commands stand between a fresh Ubuntu install and a working environment" → "a fresh Arch, Ubuntu or macOS install".

4. §5 recipe table, `just test <module>` row: add `tooling` to the routed names.

   ```diff
   -… `ios`, `android`, `workers`, `secrets`, `platform`, `api` route to their own suites instead of a `modules/<name>/tests` dir (`ios` = `ios-test-packages`, `android` = `android-test`); …
   +… `ios`, `android`, `workers`, `secrets`, `tooling`, `platform`, `api` route to their own suites instead of a `modules/<name>/tests` dir (`ios` = `ios-test-packages`, `android` = `android-test`, `tooling` = the bootstrap/doctor shell suite); …
   ```

## `planning/16-risks-open-questions-and-decision-log.md`

5. The user made these decisions on 2026-09-25; no decision-log entry covers them yet. Proposed row (next free id, DEC-56 at the time of writing):

   | ID | Decision | Rationale (one line) | Evidence |
   |---|---|---|---|
   | DEC-56 | **(2026-09-25) Developer-machine setup is automated end to end.** macOS Docker runtime = OrbStack only, installed and started by `bootstrap.sh --system`. Linux = Docker Engine; Arch/Omarchy via pacman is the primary Linux target, Ubuntu/apt stays supported (CI runs `ubuntu-latest`). A missing pinned Xcode is installed with `xcodes`, then selected and set up. Bootstrap writes a marked mise + direnv block into the shell rc file (reverses the earlier "never edits rc files" rule). | One command per machine instead of manual runtime, Xcode and rc-file steps; one Docker runtime per OS keeps doctor hints and docs short. | Branch `fix/bootstrap-automation`; `scripts/test/bootstrap-doctor.test.sh` |

`CLAUDE.md` and `planning/SPINE.md`: nothing stale found for this scope.
