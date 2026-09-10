# AI Stylist

Personal AI stylist for iOS and Android: a parametric 3D avatar built from your measurements, a digitized closet, and explainable outfit recommendations grounded in the clothes you actually own, the weather, and the occasion.

This repository is a monorepo: the mobile app, the API, the ML workers, and the shared contracts all live here. `just` is the only command entry point. If you are new, follow **First-time setup** top to bottom; it takes about 15 minutes on a fresh Ubuntu machine, most of it downloads.

## What is inside

| Part                   | Path                                            | Stack                                                   |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| Mobile app             | `apps/mobile/`                                  | React Native + Expo (TypeScript, New Architecture)      |
| API                    | `apps/api/`                                     | NestJS on Fastify, modular monolith, one dir per module |
| ML / media workers     | `workers/`                                      | Python 3.12, FastAPI, uv, Docker                        |
| API + event contracts  | `packages/contracts/`                           | OpenAPI 3.1 + JSON Schema, generated clients            |
| Shared constants       | `packages/shared-kernel/`                       | IDs, units, error codes, reason codes, event envelope   |
| Database               | `packages/db/`                                  | PostgreSQL + pgvector, Drizzle ORM, migrations          |
| Synthetic data + fakes | `packages/seed-data/`, `packages/test-support/` | never real user data                                    |
| Tooling                | `justfile`, `mise.toml`, `scripts/`, `tools/`   | pinned toolchain, codegen, arch rules                   |
| Planning and decisions | `planning/`, `docs/adr/`, `docs/modules/`       | product canon, ADRs, module contracts                   |

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

On Linux this installs the apt packages, Docker, the Android udev rules, and adds you to the `docker` group. **Log out and back in afterwards** so the group change takes effect. On macOS it uses Homebrew (git-lfs, watchman, adb), checks for the Xcode Command Line Tools, and tells you which Docker runtime it found (Docker Desktop, OrbStack, or Colima; it installs none). Skip this step if Docker already works for your user and you do not need Android device access.

### 3. Install the toolchain and dependencies

```bash
./scripts/bootstrap.sh
```

This is safe to re-run at any time. It installs `mise` (the version manager), then every pinned tool (Node, pnpm, Python, Java, `just`, security scanners, and so on), then the JavaScript and Python dependencies, sets up git hooks, and creates your local `.env` from `.env.example`.

At the end it prints one line to add to your shell config so the pinned tools are on your PATH in every terminal:

```bash
eval "$(~/.local/bin/mise activate zsh)"   # or bash
```

Add it to `~/.zshrc` (or `~/.bashrc`), then open a new terminal. You do not strictly need this for `just` recipes, which find the tools on their own, but you need it to run `pnpm`, `node`, or `uv` by hand.

### 4. Check everything

```bash
just doctor                              # or, before mise is activated: ~/.local/bin/mise exec -- just doctor
```

Every line should be a ✔. A ⚠ is informational. An ✘ comes with a hint for the fix. Run this whenever something feels off.

### 5. External accounts (only when a task needs one)

Nothing above needs a vendor account. When a phase does (Neon, Railway, Trigger.dev, Cloudflare, Expo/EAS, Apple, Google Play, PostHog, Grafana, and so on), follow [`docs/SERVICES-SETUP.md`](docs/SERVICES-SETUP.md). It has every account in phase order, every step and field, and where each key goes.

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

### Mobile

```bash
just dev-mobile              # starts Metro (the JS bundler)
just dev-mobile --android    # also opens the app on a connected Android device or emulator
```

Expo Go is enough for the current placeholder app (`pnpm --filter @ai-stylist/mobile exec expo start --go --android` if you prefer it; `just dev-mobile` always starts the dev client, and Expo refuses `--dev-client` together with `--go`); a development build becomes necessary once the first native module lands.

The mobile app cannot be run on iOS from Linux; on a Mac, `just dev-mobile --ios` opens the simulator and `just mobile-ios-build --profile dev` builds locally. From Linux, iOS builds happen in CI on a hosted Mac (see `.github/workflows/README.md`). For Android you need either the Android SDK and an emulator, or a physical phone with USB debugging on. See `apps/mobile/README.md` for the details.

## Daily commands

| Command                                               | What it does                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `just --list`                                         | Every recipe with a one-line description                                                                  |
| `just test`                                           | Full test suite. `just test closet` runs one module's tests                                               |
| `just lint`                                           | ESLint (with architecture boundaries) and Ruff                                                            |
| `just typecheck`                                      | TypeScript and Python type checks                                                                         |
| `just format`                                         | Prettier and Ruff format. `--check` for CI mode                                                           |
| `just arch-check`                                     | Module boundary rules. Fails on a forbidden import                                                        |
| `just arch-check --fixtures`                          | Proves each boundary rule still fires on its fixture. `just lint --fixtures` does the same for lint rules |
| `just generate`                                       | Regenerate clients from the OpenAPI and event schemas. `--check` = staleness gate                         |
| `just db-migrate`                                     | Apply pending migrations to your local database                                                           |
| `just db-rollback`                                    | Roll back the last migration                                                                              |
| `just db-reset --yes`                                 | Drop and rebuild the local database with seed data. Local only, refuses anything else                     |
| `just mobile-android-build --profile preview`         | Android APK/AAB. Local Gradle if `ANDROID_HOME` is set, otherwise `--cloud` for EAS                       |
| `just mobile-ios-build --cloud eas --profile preview` | iOS build on EAS. Needs the accounts in `docs/SERVICES-SETUP.md` section 7 and 8                          |
| `just security-scan`                                  | Secret scan, dependency vulnerabilities, license check                                                    |
| `just ci-parity`                                      | Exactly what the pull-request gate runs. Run before opening a PR                                          |

## Before you commit

Git hooks run automatically: a secret scan on every commit and a Conventional Commits check on the message. A message like `feat(closet): add garment upload` passes; `Added stuff` does not.

Before opening a pull request:

```bash
just ci-parity
```

If it is green locally, it is green in CI. The CI workflows call the same `just` recipes and nothing else.

## Where things are decided

- `planning/SPINE.md` is the product and architecture canon. When a document and the code disagree, the SPINE wins.
- `planning/PROGRESS.md` is the status ledger. It says which phase is in progress and what the next action is.
- `docs/adr/` records decisions. `docs/modules/<name>.md` is the contract for each backend module.
- `docs/SERVICES-SETUP.md` is the checklist for every external account and credential.
- `.agents/skills/` holds step-by-step procedures for common task types (migrations, contract changes, security review, and so on).

## When something is red

1. `just doctor` first. Most environment problems show up there with a fix hint.
2. `just bootstrap` again. It is idempotent and repairs missing tools or dependencies.
3. Docker not reachable: on Linux make sure the daemon is running and your user is in the `docker` group (step 2 above, then re-login); on macOS start Docker Desktop / OrbStack / `colima start` (the doctor hint names the one it found; Colima also needs `DOCKER_HOST`, see `docs/DEVELOPING-ON-MACOS.md`).
4. `git push` complains about `git-lfs`: your shell has not activated `mise`. Add the activation line from step 3 or run the command through `mise exec -- git push`.
5. `just generate --check` fails: someone edited a contract without regenerating. Run `just generate` and commit the result.
6. Still stuck: open an issue using `templates/issue.md` and paste the failing command with its full output.
