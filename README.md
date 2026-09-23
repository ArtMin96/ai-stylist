# AI Stylist

Personal AI stylist for iOS and Android: a parametric 3D avatar built from your measurements, a digitized closet, and explainable outfit recommendations grounded in the clothes you actually own, the weather, and the occasion.

This repository is a monorepo: the native iOS and Android apps, the API, the ML workers, and the shared contracts all live here. `just` is the only command entry point. If you are new, follow **First-time setup** top to bottom; it takes about 15 minutes on a fresh Ubuntu machine, most of it downloads.

## What is inside

| Part                   | Path                                            | Stack                                                                                       |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| iOS app                | `apps/ios/`                                     | Swift + SwiftUI (native)                                                                    |
| Android app            | `apps/android/`                                 | Kotlin + Jetpack Compose (native)                                                           |
| Shared E2E flows       | `e2e/`                                          | Maestro, one smoke flow for both apps                                                       |
| API                    | `apps/api/`                                     | NestJS on Fastify, modular monolith, one dir per module                                     |
| ML / media workers     | `workers/`                                      | Python 3.12, FastAPI, uv, Docker                                                            |
| API + event contracts  | `packages/contracts/`                           | OpenAPI 3.1 + JSON Schema, generated clients                                                |
| Shared constants       | `packages/shared-kernel/`                       | IDs, units, error/reason codes, entitlements, event envelope; registries -> TS/Swift/Kotlin |
| Database               | `packages/db/`                                  | PostgreSQL + pgvector, Drizzle ORM, migrations                                              |
| Synthetic data + fakes | `packages/seed-data/`, `packages/test-support/` | never real user data                                                                        |
| Tooling                | `justfile`, `mise.toml`, `scripts/`, `tools/`   | pinned toolchain, codegen, arch rules                                                       |
| Planning and decisions | `planning/`, `docs/adr/`, `docs/modules/`       | product canon, ADRs, module contracts                                                       |

The operating rules for anyone (human or AI agent) changing code are in [`CLAUDE.md`](CLAUDE.md). Read it once before your first change.

## First-time setup

You need Ubuntu 22.04 or newer (other Linux distros work with small changes) or macOS (Apple Silicon or Intel; see [`docs/DEVELOPING-ON-MACOS.md`](docs/DEVELOPING-ON-MACOS.md) for the Mac-specific prerequisites), `git`, `curl`, and, on Linux, `sudo` for the one system step. Everything else is installed into your home directory by the bootstrap script, with exact versions pinned in `mise.toml`, so nothing here conflicts with tools you already have.

### 1. Clone

```bash
git clone https://github.com/ArtMin96/ai-stylist.git
cd ai-stylist
```

### 2. Install system packages (once per machine, needs sudo on Linux)

```bash
./scripts/bootstrap.sh --system
```

On Linux this installs the apt packages, Docker, the Android udev rules, and adds you to the `docker` group. **Log out and back in afterwards** so the group change takes effect. On macOS it uses Homebrew (git-lfs), checks for the Xcode Command Line Tools and Xcode, and tells you which Docker runtime it found (Docker Desktop, OrbStack, or Colima; it installs none). On both it installs the Android SDK packages into your home directory (no emulator) and writes `ANDROID_HOME` to `~/.config/ai-stylist/env.sh`, which `.envrc` loads; on Linux it also pulls the `swift:6.4` Docker image the Linux iOS checks use. Skip this step if Docker already works for your user and you do not work on the apps.

### 3. Install the toolchain and dependencies

```bash
./scripts/bootstrap.sh
```

This is safe to re-run at any time. It installs `mise` (the version manager), then every pinned tool (Node, pnpm, Python, Java, `just`, security scanners, and so on), then the JavaScript and Python dependencies, sets up git hooks, and creates your local `.env` from `.env.example`.

At the end it prints two lines to add to your shell config: `mise` puts the pinned tools on your PATH, and `direnv` loads `.env` and `~/.config/ai-stylist/env.sh` (`ANDROID_HOME`, the SDK's `platform-tools` on PATH) when you enter the repo:

```bash
eval "$(~/.local/bin/mise activate zsh)"   # or bash
eval "$(direnv hook zsh)"                  # or bash
```

Add them to `~/.zshrc` (or `~/.bashrc`), open a new terminal, and run `direnv allow` once in the repo. `just` recipes find the pinned tools without activation, but you need them to run `pnpm`, `node`, `uv`, or the SDK's `adb` by hand.

### 4. Check everything

```bash
just doctor                              # or, before mise is activated: ~/.local/bin/mise exec -- just doctor
```

Every line should be a ✔. A ⚠ is informational. An ✘ comes with a hint for the fix. Run this whenever something feels off.

### 5. Get access to shared development configuration

Bootstrap creates a local `.env`, but shared values are stored in Git as sops-encrypted files. Step 3
(`./scripts/bootstrap.sh`) already generated your personal age identity and opened a pull request
adding you as a `dev` recipient in `.sops.yaml` — it printed a compare URL; open that link. While you
wait for an approver to run `just secrets-approve <branch>` and merge it, `just doctor` correctly
reports that your recipient is not yet listed; that is expected. Three commands cover the rest:

```bash
just secrets-backup-done     # after you back up the identity file in the team password manager
just secrets-sync            # once the pull request has merged — decrypts the shared dev values into .env
just doctor                  # confirm every check is ✔
```

See the [`secrets/` technical guide](secrets/README.md) for the full flow, the offline fallback, and
how to onboard someone else. Never send or commit the private identity.

### 6. External accounts (only when a task needs one)

Nothing above needs a vendor account. When a phase does (a server provider + Coolify, Cloudflare R2, Apple, Google Play, PostHog, Grafana, and so on; pg-boss and PostgreSQL need no account), follow [`docs/SERVICES-SETUP.md`](docs/SERVICES-SETUP.md). It has every account in phase order, every step and field, and where each key goes.

## Running the app

Open one terminal per process, or use the `solo.yml` process list if you use Soloist.

### API

```bash
just dev-api
```

Starts PostgreSQL with pgvector in Docker, then the API in watch mode. Check it:

```bash
curl localhost:3000/v1/health     # {"status":"ok","checks":{"db":"ok"}}
curl localhost:3000/v1/version
```

If port 5432 is already taken on your machine, set `POSTGRES_HOST_PORT=5433` in `.env` and update `DATABASE_URL` to match.

### Workers

```bash
just dev-workers
```

Starts the Python segmentation service on port 8001. `curl localhost:8001/health` should answer.

### Mobile apps

The apps are native: Swift + SwiftUI in `apps/ios/` and Kotlin + Jetpack Compose in `apps/android/`. Each app's own README ([`apps/ios/README.md`](apps/ios/README.md), [`apps/android/README.md`](apps/android/README.md)) explains how to build and run it; both talk to the API through clients generated from `packages/contracts` and share one Maestro smoke flow in `e2e/`. Dev builds call your local `just dev-api`; preview builds point at `https://staging-api.ai-stylist.app`, which is not live yet.

```bash
# Android (Linux or macOS)
just android-sdk install      # SDK packages into your home directory (bootstrap --system already ran this)
just android-check            # format, lint, detekt, unit + Robolectric tests, all APKs
just android-build            # debug APK (app.aistylist.mobile.dev); `just android-e2e` runs the smoke flow on an emulator

# iOS (a Mac with the pinned Xcode is required to build and run)
just ios-project              # generate apps/ios/AIStylist.xcodeproj from project.yml (XcodeGen; never edit the project)
just ios-build                # unsigned Dev simulator build; `just ios-e2e` runs the smoke flow
just ios-test                 # package unit tests on an iPhone simulator
just ios-check                # lint, format, bans, package tests (Linux via Docker swift:6.4); on a Mac also build + test
```

The Android app needs the Android SDK (`just android-sdk install`) and, to run it, an emulator or a phone with USB debugging on. The iOS app builds and runs only on macOS with the Xcode version pinned in `apps/ios/.xcode-version`.

## Daily commands

| Command                      | What it does                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `just --list`                | Every recipe with a one-line description                                                                  |
| `just test`                  | Full test suite. `just test closet` runs one module's tests                                               |
| `just lint`                  | ESLint (with architecture boundaries), Ruff, shellcheck, actionlint, SwiftLint, Android Lint + detekt     |
| `just typecheck`             | TypeScript and Python type checks                                                                         |
| `just format`                | Prettier, Ruff, swift-format and Spotless (ktlint). `--check` for CI mode                                 |
| `just arch-check`            | Module boundary rules. Fails on a forbidden import                                                        |
| `just arch-check --fixtures` | Proves each boundary rule still fires on its fixture. `just lint --fixtures` does the same for lint rules |
| `just generate`              | Regenerate clients (OpenAPI, event schemas) and shared-kernel constants. `--check` = staleness gate       |
| `just db-migrate`            | Apply pending migrations to your local database                                                           |
| `just db-rollback`           | Roll back the last migration                                                                              |
| `just db-reset --yes`        | Drop and rebuild the local database with seed data. Local only, refuses anything else                     |
| `just security-scan`         | Secret scan, dependency vulnerabilities, license check                                                    |
| `just ci-parity`             | Every pull-request gate, including the iOS and Android lanes. Run before opening a PR                     |
| `just ios-check`             | The iOS gate (Linux-capable parts everywhere; simulator build + tests on macOS)                           |
| `just android-check`         | The Android gate: format, lint, detekt, tests, all three APKs                                             |

## Before you commit

Git hooks run automatically: a secret scan on every commit and a Conventional Commits check on the message. A message like `feat(closet): add garment upload` passes; `Added stuff` does not.

Before opening a pull request:

```bash
just ci-parity
```

If it is green locally, it is green in CI. The CI workflows call the same `just` recipes and nothing else. Two caveats: on Linux the Xcode steps print a skip (the `ios` workflow runs them on macOS), and a native lane whose toolchain is missing fails `ci-parity` with an install hint instead of passing.

## Where things are decided

- `planning/SPINE.md` is the product and architecture canon. When a document and the code disagree, the SPINE wins.
- `planning/PROGRESS.md` is the status ledger. It says which phase is in progress and what the next action is.
- `docs/adr/` records decisions. `docs/modules/<name>.md` is the contract for each backend module.
- `secrets/README.md` is the technical guide for encrypted configuration, developer access, and key rotation.
- `docs/SERVICES-SETUP.md` is the checklist for every external account and credential.
- `.agents/skills/` holds step-by-step procedures for common task types (migrations, contract changes, security review, and so on).

## When something is red

1. `just doctor` first. Most environment problems show up there with a fix hint.
2. `just bootstrap` again. It is idempotent and repairs missing tools or dependencies.
3. Docker not reachable: on Linux make sure the daemon is running and your user is in the `docker` group (step 2 above, then re-login); on macOS start Docker Desktop / OrbStack / `colima start` (the doctor hint names the one it found; Colima also needs `DOCKER_HOST`, see `docs/DEVELOPING-ON-MACOS.md`).
4. `git push` complains about `git-lfs`: your shell has not activated `mise`. Add the activation line from step 3 or run the command through `mise exec -- git push`.
5. `just generate --check` fails: someone edited a contract without regenerating. Run `just generate` and commit the result.
6. Still stuck: open an issue using `templates/issue.md` and paste the failing command with its full output.
