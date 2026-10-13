# Services setup

This document walks a developer through creating every external account and credential the AI Stylist monorepo needs, in the order they become necessary. It assumes you have never used any of these services. Follow it top to bottom; each section is self-contained and ends with a check you can run.

It complements the root [`README.md`](../README.md) (local machine setup) and the operating contract in [`CLAUDE.md`](../CLAUDE.md). When the code moves to another GitHub repository, or another machine has to be set up, follow [`docs/NEW-REPO-SETUP.md`](NEW-REPO-SETUP.md): it lists what is tied to the repository or to a machine and what carries over untouched. The vendor choices themselves are ratified in `planning/SPINE.md` §2; do not swap a vendor here, propose an ADR instead.

## The one rule

No secret ever goes into a committed file. Every value you copy from a vendor dashboard goes to exactly one of three places:

| Where                                                           | What goes there                                                                                                                                                      | Who reads it                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `.env` (repo root, gitignored)                                  | Your personal local values. Keys mirror `.env.example`.                                                                                                              | `just` recipes, direnv, the API, the workers (the native apps never read it) |
| `secrets/<env>.enc.yaml` (committed, encrypted with sops + age) | Shared values for `dev`, `staging`, `prod`. `just secrets-sync` decrypts `dev` into your `.env`. `staging`/`prod` are decrypted only by CI.                          | Developers (`dev`), CI deploy jobs (`staging`, `prod`)                       |
| GitHub repository secrets                                       | Only: the CI age private key, store signing credentials, deploy and build tokens. The exact names are listed per service below and in `.github/workflows/README.md`. | GitHub Actions                                                               |

`.env.example` is the exhaustive, zero-value catalogue of keys. `just doctor` fails when your `.env` lacks any key listed there (empty values are fine). If a service produces a key that is not in `.env.example`, the key is added to `.env.example` with the phase that needs it, never invented ad hoc.

If a secret ever shows up in a terminal shared with an AI agent, a log, a screenshot, or a commit, rotate it the same day (`planning/11-security-privacy-and-compliance.md`).

## Overview

Phase numbers refer to `planning/phases/`. "Needed from" is the first task that cannot proceed without the account. Regions are decided (2026-10-09): one EU home region for the server, R2, PostHog and Grafana (DEC-61), on Hetzner with one server at launch (DEC-62). The accounts created before that date are test accounts and will be replaced; create the real ones in the EU. Grafana Cloud uses an EU region; the PostHog test project exists in US Cloud (DEC-58, [ADR-0007](adr/0007-observability-backend.md)), and the production project goes on EU Cloud (DEC-61, which resolved OQ-07). By the owner's decisions of 2026-10-12 the server, the staging and production environments, the Cloudflare WAF and the real EU accounts wait for the first minimal release (DEC-79), and no PostHog or Grafana work is done until then (DEC-80); where a section below still says "now" or "P03" for one of them, those decisions win. The self-hosting baseline (pg-boss, owned server + Coolify, self-managed PostgreSQL, R2 delivery model) is ADR-0003, from [r7](../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md).

| #   | Service                                                                 | What it is for                                            | Needed from              | Free tier?                                   | Account owner | Done |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------ | -------------------------------------------- | ------------- | ---- |
| 1   | GitHub repository                                                       | Source, CI (GitHub Actions), branch protection            | P02 now                  | Yes (public repo or personal plan)           | `@ArtMin96`   | [ ]  |
| 2   | sops + age                                                              | Encrypted shared secrets in the repo                      | P02 now                  | Free, no account                             | `<owner>`     | [x]  |
| 3   | PostgreSQL (self-managed, pgvector)                                     | Postgres 18 + pgvector for staging, prod (docker locally) | First minimal release    | $0 software; host cost in row 4              | `<owner>`     | [ ]  |
| 4   | Server + Coolify                                                        | API, jobs, workers, PostgreSQL hosting                    | First minimal release    | Server ~€10–25/month; Coolify $0 self-hosted | `<owner>`     | [ ]  |
| 5   | pg-boss (no account)                                                    | Durable jobs (outbox relay, media pipeline)               | P02-T08                  | $0, MIT, runs on the app database            | n/a           | [x]  |
| 6   | Cloudflare (R2 + DNS/WAF)                                               | Object storage for media and public assets, DNS, WAF      | P02-T13; WAF with row 4  | Yes, 10 GB-month, Checked 2026-09-10         | `<owner>`     | [ ]  |
| 7   | Expo / EAS (removed 2026-09-22)                                         | Nothing: the React Native app and EAS builds are gone     | n/a                      | n/a                                          | n/a           | n/a  |
| 8   | Apple Developer Program                                                 | iOS signing, TestFlight, App Store, Sign in with Apple    | T14, after P02 (DEC-63)  | No, 99 USD/year, Checked 2026-09-10          | `<owner>`     | [ ]  |
| 9   | Google Play Console                                                     | Android signing and distribution                          | T14, after P02 (DEC-63)  | No, 25 USD once, Checked 2026-09-10          | `<owner>`     | [ ]  |
| 10  | PostHog                                                                 | Product analytics, replay, error tracking, flags          | P02-T09; prod with row 4 | Yes, 1M events/month, Checked 2026-09-10     | `<owner>`     | [ ]  |
| 11  | Grafana Cloud                                                           | OTel traces, metrics, logs                                | P02-T09                  | Yes, Checked 2026-09-10                      | `<owner>`     | [ ]  |
| 12  | RevenueCat                                                              | Subscriptions and entitlements                            | P13                      | Yes, up to $2,500 MTR, Checked 2026-09-10    | `<owner>`     | [ ]  |
| 13  | fal.ai, Open-Meteo, date-holidays (no account), LLM/embedding providers | AI generation, weather, holidays, extraction              | P06 / P08 / P11          | Mixed, see section 13                        | `<owner>`     | [ ]  |
| 14  | Apple and Google sign-in                                                | Social login for better-auth                              | P03                      | Included in 8 and free Google Cloud project  | `<owner>`     | [ ]  |
| 15  | Firebase Cloud Messaging + APNs                                         | Push notifications (FCM + APNs direct, server-side)       | P09-T16                  | FCM free; APNs included in 8                 | `<owner>`     | [ ]  |
| 16  | Renovate (GitHub App)                                                   | Pull requests that update dependencies                    | P02-T12                  | Yes (hosted app); price not checked          | `@ArtMin96`   | [x]  |

Replace `<owner>` with a real name once an account exists; keep this table current.

## 1. GitHub repository

### Why we use it

Source control and CI. Every CI job calls a `just` recipe; the workflows live in `.github/workflows/` and are documented in `.github/workflows/README.md`.

### When you need it

Now (P02). The repository is `https://github.com/ArtMin96/ai-stylist` under a personal account, not an organization. It is public since 2026-10-12, temporarily, so that GitHub Actions runs free (DEC-82); from 2026-10-03 until then it was private. Moving it to another repository is described in [`docs/NEW-REPO-SETUP.md`](NEW-REPO-SETUP.md).

### Cost

Free. GitHub Actions minutes on Linux runners are free for public repositories; private repositories get a monthly included quota that depends on the plan. Verify on <https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions>. The `macos` job of `ios.yml` runs on the `xcode-27` macOS runner for every pull request or push to `main` that touches the iOS paths (DEC-51; ADR-0002 was superseded by ADR-0004); on a private repository macOS minutes use up the quota much faster than Linux minutes.

### Steps

1. Confirm Actions are enabled: repository page, **Settings**, **Actions**, **General**. Under "Actions permissions" choose "Allow all actions and reusable workflows" (label may differ). Under "Workflow permissions" choose "Read repository contents and packages permissions"; the workflows declare their own `permissions:` blocks and need nothing more.
2. `CODEOWNERS` must name real GitHub usernames. GitHub silently ignores unknown owners, so check this before step 3. Since 2026-10-12 every owner line names the owner's handle; before that day the file held the placeholders `@team`, `@dev-lead`, `@3d-owner` and `@ml-owner`. With a one-person team every handle can be the same username. Commit a change through a normal pull request.
3. Protect `main`: **Settings**, **Branches**, **Add classic branch protection rule** (GitHub also offers **Rulesets** under **Settings**, **Rules**; either works, use one, not both). Branch name pattern: `main`.
4. Tick **Require a pull request before merging**. Tick **Require review from Code Owners** only after step 2 is merged.
5. Tick **Require status checks to pass before merging** and **Require branches to be up to date before merging**. In the search box add these check names exactly as the jobs in `pr-gate.yml` report them: `Gate · just ci-parity` (it also runs the `.env.example` key check), `Gate · Contracts (generate --check, spectral, oasdiff)`, `Gate · Secret scan (PR diff)`, `Gate · Clone detection`, and `Report · PR gate summary`, which fails when any gate job failed or was cancelled and carries `ci.pr_gate_duration_seconds`. The names only appear in the search box after the workflow has run at least once on a pull request, so open a trivial PR first if the list is empty.
6. Save the rule.
7. Repository secrets live at **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Create them as each later section tells you to. Nothing is required for `pr-gate.yml`, `affected.yml`, or `nightly.yml`. On pushes to `main` only, `pr-gate.yml` pushes CI metrics when the optional `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` secrets exist (section 11), and `ios.yml` / `android.yml` upload debug symbols with the PostHog secret and variables from section 10; pull requests never receive them. Hosts and project ids are repository **variables** (the **Variables** tab on the same page), never secrets. From a terminal in the repo, the GitHub CLI does the same (`gh` is not installed by `just bootstrap`; `gh auth login` signs it in): `gh secret set <NAME> < <file>` reads the secret from a file through standard input, so the value is never typed on a command line, and `gh variable set <NAME> --body '<value>'` sets a variable; `gh secret list` and `gh variable list` show which names exist. Both forms were run for this repository on 2026-10-03. Run them yourself, and delete the file that held the secret afterwards; the repo's Bash guard (`scripts/hooks/guard-bash.sh`) refuses both `set` commands from an AI agent session. `GITLEAKS_LICENSE` is only needed when the repository moves under a GitHub organization; skip it.
8. Turborepo remote cache (optional). `pr-gate.yml` prints "Turborepo remote cache disabled" until `TURBO_TOKEN` and `TURBO_TEAM` exist. Two options: Vercel Remote Cache (free on all Vercel plans, Checked 2026-09-10, <https://turborepo.dev/docs/core-concepts/remote-caching>; create a Vercel account, run `pnpm exec turbo login` then `pnpm exec turbo link` in the repo root, then create a token under the Vercel account settings, **Tokens** (label may differ), and store it as `TURBO_TOKEN` with the Vercel team slug as `TURBO_TEAM`), or a self-hosted cache server (an open-source `turborepo-remote-cache` deployment you run yourself). Recommendation: skip this until `ci.pr_gate_duration_seconds` in the job summary is consistently above the 10 minute budget. Cold CI runs are within budget today.

### What to record

- GitHub secrets: none required by the PR gate. Optional: `TURBO_TOKEN`, `TURBO_TEAM`, `GITLEAKS_LICENSE` (organization only), `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` (CI metrics with the CI-only `ci-metrics` token, section 11). Native lanes: secret `POSTHOG_CLI_API_KEY` and variables `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST` (symbol upload on `main`, section 10). CI never gets a PostHog project key.
- Repo: `CODEOWNERS` with real handles; `.github/workflows/README.md` "Required secrets" column stays the source of truth for names.

### Do not

- Do not add secrets to workflow YAML or to `.env.example`.
- Do not require the native `ios` / `android` lanes or `nightly` checks on `main`; the native lanes run only when their paths change (a required check that never runs blocks every other pull request) and `nightly` is scheduled.
- Do not change required checks, force-push, or rewrite history without explicit human authorization (`CLAUDE.md` "Prohibited").

### Verify

Open a pull request with any small change. The checks list shows the four `Gate · …` jobs plus `Report · PR gate summary`, and once steps 2 to 6 are done the "Merge" button stays disabled until they pass. On 2026-10-03 they were not done for this repository yet: `main` was not protected and `CODEOWNERS` still held the placeholder handles. `CODEOWNERS` was fixed on 2026-10-12; `main` is still not protected, because branch protection waits for the move to an organization (DEC-77, DEC-82). Locally, `just ci-parity` must be green before you open it.

## 2. sops + age

### Why we use it

Shared secrets are committed to the repo encrypted, one file per environment (`secrets/dev.enc.yaml`, `secrets/staging.enc.yaml`, `secrets/prod.enc.yaml`). sops encrypts values and leaves keys readable, so diffs are reviewable. age is the key type: every developer has one key pair, CI has one. See `secrets/README.md`, `.sops.yaml`, `.envrc`, and `planning/15-team-workflow-and-ai-agent-operations.md` §6.

### When you need it

Now. Every other service in this document stores its values through this mechanism. The initial developer and CI public recipients are listed in `.sops.yaml`, `secrets/dev.enc.yaml` holds the shared dev values (`just secrets-push --apply` adds the key names `.env.example` gained since the file was created, `--prune` removes the ones it dropped, and `just doctor` warns while the two differ), and the matching CI private identity is stored in the GitHub repository secret `SOPS_AGE_KEY`. Staging and production files stay absent until those environments exist.

### Cost

Free. No account. `sops` 3.13.3 and `age` 1.3.2 are pinned in `mise.toml` and installed by `./scripts/bootstrap.sh`; the recipes below run them through `scripts/security/secrets-edit.sh`, `scripts/security/secrets-sync.sh` and `scripts/security/secrets-push.sh`.

### Steps

Run these in a shell where mise is activated (`eval "$(~/.local/bin/mise activate zsh)"`), or prefix each tool with `~/.local/bin/mise exec --`. `just` recipes need no activation.

1. Run `just bootstrap`. Near the end it generates your age identity if none exists yet, at the resolved path (`SOPS_AGE_KEY` when set — key material in the environment, no file — else `SOPS_AGE_KEY_FILE`, else the default keys file `$XDG_CONFIG_HOME/sops/age/keys.txt`, falling back to `~/.config/sops/age/keys.txt`, on Linux and macOS alike. That is where sops itself looks on Linux; on macOS sops alone would look in `~/Library/Application Support/sops/age/keys.txt`, so `scripts/security/secrets-lib.sh` exports `SOPS_AGE_KEY_FILE` for the path above in every recipe that calls sops, whenever that file exists and neither variable is set (covered by a test with made-up keys; not yet confirmed on a real Mac). Checked 2026-09-10 at <https://getsops.io/docs/usage/identities/age/>; that order — `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, the default file — is the precedence), mode 600 (directory mode 700); the private key is never printed. It then adds a `# developer: <label>` comment and your `age1...` recipient under the `dev` rule's `# ADD RECIPIENTS` marker in `.sops.yaml`, on a new `onboard/<slug>` branch, pushes it, and prints a compare URL — open that link as your pull request. Running it again once your identity exists and is already listed is a no-op (`age identity present at <path>` then `your age recipient is already listed in .sops.yaml (dev) — nothing to do`). In CI (`CI` set) or when `SOPS_AGE_KEY` is already set, this step is skipped entirely: no key is generated and no branch is created.

   If the push fails (no remote access yet), bootstrap still exits successfully, warns, and prints the exact `git push -u origin onboard/<slug>` command to run later; the branch and commit already exist locally.

   **Manual fallback**, only if `just bootstrap` cannot run at all:

   ```bash
   mkdir -p ~/.config/sops/age
   age-keygen -o ~/.config/sops/age/keys.txt
   chmod 600 ~/.config/sops/age/keys.txt
   ```

   The command prints `Public key: age1<...>`. Copy that line, then under the `# ADD RECIPIENTS` comment of the `dev` rule in `.sops.yaml` add `# developer: <your name>` then `- age1<your public key>` (same indentation as the comment), and open a pull request yourself. The file itself contains the private key (`AGE-SECRET-KEY-1<...>`); the repo's gitleaks rule blocks that string from ever being committed.

2. Back up the private key file somewhere outside the repo (a password manager entry), then run `just secrets-backup-done` — it records today's date in `<path>.backed-up` (mode 600) so `just doctor` stops warning. Losing the key without a backup means you cannot decrypt anything encrypted for you.

3. Wait for approval. An approver — a teammate whose identity can already decrypt `secrets/dev.enc.yaml` — reviews the pull request (it should touch only `.sops.yaml`, adding your `# developer:` comment and recipient line; public keys are not secrets, `.gitleaks.toml` allowlists them in this file) and runs `just secrets-approve <branch>`, which re-wraps every `secrets/*.enc.yaml` for the new recipient list, commits, and pushes. Merge it, then run `just secrets-sync` (or re-run `just bootstrap`) to decrypt the shared dev values into your `.env`. Until it merges, `just doctor` correctly reports your recipient as not yet listed — that is expected, not a bug.

4. Generate the CI key the same way, into a temporary file, and treat it as a service credential:

   ```bash
   ci_age_dir="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-ci-age.XXXXXX")"   # mktemp -d creates it mode 0700
   age-keygen -o "$ci_age_dir/ci.txt"
   ```

   Add its `Public key:` line under `# ADD RECIPIENTS` in all three rules. Copy the whole contents of `$ci_age_dir/ci.txt` into a GitHub repository secret named `SOPS_AGE_KEY` (no workflow reads it yet; the deploy jobs added in P03 export it as the `SOPS_AGE_KEY` environment variable that sops and `scripts/security/secrets-sync.sh` honor). Immediately remove the private key and its temporary directory, then clear the shell variable:

   ```bash
   rm -rf "$ci_age_dir"
   unset ci_age_dir
   ```

5. Create the first encrypted file:

   ```bash
   just secrets-edit            # same as: just secrets-edit dev
   ```

   On the first run for an environment this creates `secrets/dev.enc.yaml` with every key from `.env.example` and an empty value (`KEY: ""`), encrypted for the `dev` recipients, and opens it in `$EDITOR` through `sops`. Fill in the shared dev values (`KEY: value`), leave unknown ones empty, save and quit; sops re-encrypts on save (`File has not changed, exiting.` means you quit without editing, which is fine). No plaintext file ever lands in the repo: the template is built in a private temp dir and encrypted before it is moved into `secrets/`.

6. Repeat step 5 with `env=staging` / `env=prod` when those environments exist (staging PostgreSQL database, Coolify environments). Until then leave them absent.

7. Merge into your `.env`:

   ```bash
   just secrets-sync            # same as: just secrets-sync dev
   ```

   This decrypts `secrets/dev.enc.yaml` to a private temp file and merges it into `.env`: every key with a non-empty shared value replaces its `KEY=...` line (or is appended if missing); keys whose shared value is empty are skipped; every other line is kept verbatim, so personal overrides such as `POSTGRES_HOST_PORT` survive as long as the shared file leaves them empty. If `.env` does not exist it is created from `.env.example` first. The output lists the key names that were replaced or added and a count; it never prints a value, and `.env` ends up with mode 600. `.envrc` (`dotenv_if_exists .env`) keeps working unchanged.

   `just secrets-sync staging` and `just secrets-sync prod` refuse to run on a workstation; CI sets `CI=true`, and a human who really needs it locally passes `--i-know-this-is-not-dev`.

8. Add or change shared dev values later without an editor: put them in `.env`, run `just secrets-push` (a dry run that lists the key names it would add or fill, and the ones whose shared value differs), then `just secrets-push --apply`. It also creates the key names `.env.example` gained since the file was created. A shared value that differs from `.env` is named and left alone: run `just secrets-sync` if the shared one is newer, add `--replace` if yours is. `--prune` removes the empty names `.env.example` dropped; one that still holds a value needs `--prune --prune-values`. `just secrets-push --set KEY` reads one value from a hidden prompt instead of `.env`; never give the value as an argument. It replaces the value the key already has, so it is also the way to store a renewed token; run `just secrets-sync` afterwards so this machine's `.env` gets it. Keys tagged `[machine-local]` in `.env.example` (`DATABASE_URL`, `POSTGRES_HOST_PORT` and the other per-machine settings) are never pushed. `just secrets-edit` (or `just secrets-edit staging`) still opens a file in `$EDITOR` and is the only way to change `staging` or `prod`. The commands that write (`--apply`, `--set`, `secrets-edit`) are run by a human, never by an AI agent. Commit the encrypted file through a pull request like any other change, then everyone runs `just secrets-sync` again.

9. Onboard another developer: they run `just bootstrap`, which generates their identity, adds their `# developer: <label>` comment and recipient to the `dev` rule of `.sops.yaml` on a new `onboard/<slug>` branch, and prints a compare URL to open a pull request — no manual key exchange needed. Review the diff (it should touch only `.sops.yaml`, adding a label comment and a bare `- age1...` line), then run `just secrets-approve <branch>`: it re-wraps every `secrets/*.enc.yaml` for the new recipient list, commits and pushes onto their branch, and prints the compare URL again. Merge it; the new developer runs `just secrets-sync` (or re-runs `just bootstrap`) to pick up the shared dev values. Only the `dev` rule is automated this way — a deployer who needs `staging` or `prod` access still adds their own recipient under that rule by hand and asks a teammate who can already decrypt to run `just secrets-updatekeys`.

10. Nothing to do for direnv: `./scripts/bootstrap.sh` already allowed the repo's `.envrc` and hooked direnv into your shell rc file, so a new terminal loads `.env` when you enter the repo (`just` recipes and the db scripts read `.env` themselves).

### What to record

- `.sops.yaml`: one `age1...` public key per developer under the `dev` rule, plus deployers and the CI key under `staging` and `prod`.
- `secrets/dev.enc.yaml` committed; `staging`/`prod` when they exist.
- GitHub secret: `SOPS_AGE_KEY` (the CI private key file contents).
- Password manager: your own private key file.

### Do not

- Do not paste a private key into a chat, a ticket, or a workflow file.
- Do not commit `secrets/*.dec.*` or `.env`; both are gitignored, keep it that way.
- Do not put values into `secrets/*.enc.yaml` that are not keys in `.env.example`; the file must mirror it (`secrets/README.md`). `just doctor` warns when it does not and names the command that fixes it.
- Do not share one age key between two people.

### Verify

```bash
just secrets-sync
just doctor
```

Expected: `secrets-sync: merged secrets/dev.enc.yaml into .env — N replaced, M added, K skipped (empty in the shared file), other lines untouched` (preceded by one `replaced KEY` / `added KEY` line per key), then a `✔ .env has every key from .env.example` line, followed by four sops + age checks in the doctor output: `✔ age identity present (<path>, mode 600)`, `✔ age recipient listed in .sops.yaml (dev)`, `✔ secrets/dev.enc.yaml decrypts with your identity`, and `✔ age identity backup recorded (<date>)` (this last line is `⚠ age identity not recorded as backed up` — a warning, never a failure — until you run `just secrets-backup-done`).

## 3. PostgreSQL (self-managed)

### Why we use it

Self-managed PostgreSQL 18 with pgvector on an owned host (DEC-43, ADR-0003, [r7](../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)). The database runs from the same `pgvector/pgvector:pg18` image that `docker-compose.yml` uses locally, so versions match and the repo's migrations create the extension in both places. Running it ourselves brings obligations that a managed vendor used to carry: WAL archiving and point-in-time recovery through pgBackRest, a nightly logical backup, PgBouncer pooling, disk/backup-age alerts in Grafana, and a quarterly restore drill (RISK-17).

### When you need it

P02-T07 (the staging database, its backup pipeline, and the ephemeral test databases are the `PARTIAL` remainder of that task) and P02-T08 onward. Since 2026-10-12 the staging and production databases and their backup pipeline wait for the first minimal release (DEC-79). The database lives on the server from section 4, so its region is that server's: an EU data center (DEC-61, DEC-62).

### Cost

$0 for software: PostgreSQL, pgvector, pgBackRest, and PgBouncer are all open source (pgBackRest, Checked 2026-09-13 at <https://pgbackrest.org>). The host cost is in section 4. Backup storage is a dedicated R2 bucket (section 6), inside the free tier at launch.

### Steps

1. Provision on the server from section 4, on the private Docker network: either Coolify's built-in PostgreSQL service with the image set to `pgvector/pgvector:pg18`, or a `docker compose` stack that Coolify manages. Put the data directory on the encrypted disk. PostgreSQL 18+ images store data under /var/lib/postgresql/18/docker; mount the data volume at /var/lib/postgresql, not /var/lib/postgresql/data. Publish no port; the API, the jobs process, and the workers reach it over the private network only, with TLS enabled on the server.
2. Enable pgvector once per database (`CREATE EXTENSION IF NOT EXISTS vector;`); the committed migrations also do this, matching local.
3. Create the `staging` database and its application role now (least privilege, own password); create the `production` database and role only when P03 deploys production. Keep one superuser for provisioning and backups, never for the API.
4. PgBouncer (transaction pooling) in front of the database for the running API; `just db-migrate` uses the direct connection, because transaction pooling does not support everything migration tools need.
5. pgBackRest WAL archiving: create a dedicated R2 bucket `ai-stylist-pg-backups` with its own token scoped to that bucket only (section 6 step 5 pattern, **Object Read & Write**, never the media token). Configure a pgBackRest stanza `ai-stylist` with the S3 repository type pointed at the R2 endpoint, repository encryption on (`repo1-cipher-type`), `archive_mode=on`, and `archive_command` delegated to `pgbackrest archive-push`. Take the first full backup, then schedule a daily differential and a weekly full backup with a retention that keeps at least two full backups.
6. Nightly `pg_dump` logical backup of each database to the same bucket under a separate prefix, kept for 30 days. It is the fallback when a PITR restore is not possible and the input for the scratch-database migration test.
7. Grafana alerts (section 11): backup age above 26 hours, WAL archive push failures, less than 15 % disk free (`docs/observability/grafana/alerts/host-disk.json`), and replication lag once a replica exists.
8. Store the direct connection string (TLS on) as `DATABASE_URL` in `secrets/staging.enc.yaml` (create the file per section 2 step 5) and the pooled string under the key the P02-T07 task adds for the API. Your local `.env` keeps the docker value from `.env.example`; only put the staging string in `.env` temporarily when you run the verify step below. Production strings go into `secrets/prod.enc.yaml` in P03.
9. Restore drill: restore the latest backup into a scratch database and run the migration suite against it. First run at P02-T07, then quarterly and before every P14 release check. The same restored scratch database is where staging migrations are proven before they run on staging (`.agents/skills/db-migration/SKILL.md`).

### What to record

- `.env.example` keys: `DATABASE_URL` (staging: `secrets/staging.enc.yaml`; prod: `secrets/prod.enc.yaml`; local: docker value). No GitHub secrets; CI uses Testcontainers, not a shared database.
- Overview table: host, region, backup bucket name, and the date of the last restore drill.

### Do not

- Do not run `just db-reset` against any non-local host; it refuses by design, do not work around it.
- Do not use the pooled (PgBouncer) string for `just db-migrate`.
- Do not put a connection string into `.env.example` or into the native apps' build configuration.
- Do not expose port 5432 on the host firewall or through Coolify's proxy.
- Do not skip the restore drill; a backup that has never been restored is not a backup.
- Do not create the `production` database before P03 needs it.

### Verify

```bash
DATABASE_URL='<direct connection string>' just db-migrate
```

Expected last line: `db-migrate: up to date`. This applies the committed migrations from `packages/db/migrations` to the staging database. A `password authentication failed` or `ENOTFOUND` error means the string was pasted wrong or the private network is not reachable from where you ran it. On the host, `pgbackrest --stanza=ai-stylist info` must list a full backup and a WAL archive range; the Grafana backup-age alert must be green.

## 4. Server + Coolify

### Why we use it

Owned servers with Docker and Coolify (Apache-2.0) host the NestJS API, the jobs process, the Python workers, and PostgreSQL (DEC-42, ADR-0003, [r7](../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)). Coolify provides deploys, HTTPS, health checks, rollbacks, and per-environment variables. Production secrets are pushed from `secrets/prod.enc.yaml` into Coolify environment variables by a sync script (doc 15 §6); the dashboard is never hand-edited. API, jobs, workers, and PostgreSQL share a private Docker network on the host; the host firewall and TLS to the database close the rest.

### When you need it

The account and the empty server: when the first minimal release is prepared (DEC-79, 2026-10-12; until that decision the answer was "now"). The provider and the region are decided: Hetzner, an EU data center, one server at launch (DEC-61 and DEC-62 resolved OQ-07 and OQ-14). The first deploy: with that release (there is no `apps/api/Dockerfile` yet; it lands with the first deploy task, together with the Coolify sync script and the deploy workflow).

### Cost

One owned server in the ~€10–25/month class (Hetzner, EU data center: decided 2026-10-09, DEC-62; verify current prices on Hetzner's page before ordering). Coolify is $0 self-hosted (Checked 2026-09-13 at <https://coolify.io/docs/core/what-is-coolify>). Coolify Cloud is an optional paid managed control plane and is not used.

### Steps

1. The provider and the region are decided: Hetzner, an EU data center (DEC-61, DEC-62). Choose the data center and record it in the overview table notes.
2. Provision an Ubuntu LTS host (4 GB RAM and 80 GB disk are enough for staging plus a first production; a dedicated database host comes later when load justifies it). Enable disk encryption at creation (provider-side or LUKS); it is the at-rest encryption for the database and for uploaded media caches.
3. Harden before anything else runs: SSH keys only (`PasswordAuthentication no`), a non-root sudo user, `ufw` default deny with 22, 80, and 443 open, unattended upgrades enabled. Record the SSH public key fingerprint in the password manager, not in the repo.
4. Install Coolify with the official installation script from its docs (read the script first; do not run install scripts from any other source). Open the dashboard, create the admin account, and disable public registration.
5. Create the project `ai-stylist` with environments `staging` and `production`. Each environment gets its own variables and its own deploy later.
6. Networking: keep the API, jobs, workers, and PostgreSQL resources on one private Docker network per environment; only the API and, later, the workers' health endpoint are published through Coolify's proxy with HTTPS. PostgreSQL is never published. The API hostnames are fixed in the native apps' build configuration: `staging-api.ai-stylist.app` for staging (OQ-17; the iOS Preview and Android `preview` builds call it) and `api.ai-stylist.app` for production. Neither is provisioned yet; point each at the server in Cloudflare DNS (section 6 step 10) and attach it to that environment's API resource when P03 first deploys it.
7. API token for CI: Coolify dashboard, **Keys & Tokens**, **API tokens** (label may differ), create one named `github-actions` with the narrowest permission that can trigger a deploy. Copy it once and store it as `COOLIFY_TOKEN` in `secrets/staging.enc.yaml` (and `secrets/prod.enc.yaml` in P03); the deploy jobs decrypt it with `SOPS_AGE_KEY`, so no extra GitHub secret is needed. The P03 deploy task adds the key to `.env.example` with a comment. Nothing reads it until then.
8. Do not connect the GitHub repository or enable automatic deploys in P02; there is nothing to build yet.

### What to record

- `.env.example` key `COOLIFY_TOKEN` (added in P03; staging/prod only, in the matching `secrets/<env>.enc.yaml`). `PORT` is set per resource in Coolify and already listed there.
- GitHub secrets: none.
- Overview table: provider, region, host name, Coolify dashboard URL, environments.

### Do not

- Do not type secrets into Coolify environment variables by hand; the sync script is the only writer.
- Do not publish the PostgreSQL port; the database is reachable only on the private network.
- Do not enable automatic deploys or connect the repository in P02.
- Do not run the observability stack on this host if it is ever self-hosted; it belongs on a separate failure domain (DEC-48).

### Verify

Over SSH, `docker ps` lists the Coolify containers and nothing else; `ufw status` shows only 22, 80, and 443 open. The dashboard shows project `ai-stylist` with environments `staging` and `production` and zero resources. After P03 lands `apps/api/Dockerfile`, `curl https://staging-api.ai-stylist.app/v1/health` should return `{"status":"ok","checks":{"db":"ok"}}`.

## 5. pg-boss (durable jobs)

### Why we use it

Durable job pipelines with retries and backoff, dead-letter handling, scheduling, and priorities, on the app's own PostgreSQL instead of a separate queue service (DEC-41, ADR-0003, [r7](../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)). pg-boss v12 is MIT (Checked 2026-09-13 at <https://github.com/timgit/pg-boss>). Job definitions live in `apps/api/src/jobs/`; the outbox relay runs in the API process (P02-T08) and hands events to pg-boss jobs, and the handlers run in the dedicated `jobs` process (`apps/api/src/jobs/main.ts`). There is no dev server and no dashboard to sign up for.

### When you need it

P02-T08. `just dev-workers` starts compose Postgres, the pg-boss jobs process (apps/api `src/jobs/main.ts`) and the segmentation worker.

### Cost

$0. No account.

### Steps

None beyond the `pg-boss` dependency and `just db-migrate`: migration `0003_pgboss_schema` creates its `pgboss` schema in the app database (`DATABASE_URL`); the app never lets pg-boss run DDL on boot (DEC-57). Locally that is the docker compose Postgres; in staging and production it is the database from section 3, so it is covered by the same backups and alerts.

### What to record

No keys, no dashboard, no GitHub secrets. Gate result (2026-09-26, DEC-57): the P02-T08 acceptance suite passes on pg-boss 12.34.0 — AC-1 idempotency, AC-2 retry + DLQ (worker and relay), AC-3 replay (also after pg-boss dropped the job), AC-4 kill/retry with zero lost events, AC-5 SKIP LOCKED with two relays, AC-6 per-user cancellation, AC-7 deletion scenario, AC-8 export chain. Measured throughput ≈ 95–103 jobs/s end to end (relay → pg-boss → handler → worker, 500 events) against A11 (≤ ~10 jobs/s).

### Do not

- Do not run a second queue service until the P02-T08 acceptance suite (kill/retry, idempotency, DLQ, replay, per-user cancellation, deletion/export scenarios) proves pg-boss insufficient; the fallback is then the self-hosted queue service recorded in DEC-41, adopted only through an ADR, not a quiet swap.
- Do not put business logic into job handlers; they are adapters (`CLAUDE.md` invariants).

### Verify

Until T08 lands: `just doctor` reports `✔ .env has every key from .env.example`. After T08: the T08 acceptance suite is green (`just test platform` and `just test api`) and `just dev-workers` runs the jobs process against the local database.

## 6. Cloudflare (R2, DNS/WAF)

### Why we use it

R2 is the object store for user media and for public app assets (zero egress fees, `SPINE.md` §2; DEC-44), behind the `StorageProvider` port in `apps/api/src/platform/`. DNS and the WAF sit in front of the API when it has a public hostname. Delivery model (DEC-44): private user media is served by presigned GET on the S3 endpoint, uncached, TTL at most 10 minutes; only public app and content assets (3D bundles, avatar/garment manifests, app content) go through an R2 custom domain with the Cloudflare cache. Fixed derivatives (cutout, two or three thumbnail sizes, palette swatch) are produced once by the media workers and stored in R2; there is no on-the-fly image transform service.

### When you need it

R2 dev bucket and token: P02-T13 (signed-URL skeleton); both exist since 2026-10-12. Staging and production buckets, the WAF and DNS: with the server, for the first minimal release (DEC-79). Custom domain for the public assets bucket: P04 (3D bundles) or P06 (closet derivatives), whichever ships first. The jurisdiction is decided: every bucket is created in the EU jurisdiction (DEC-61).

### Cost

R2, Checked 2026-09-10 at <https://developers.cloudflare.com/r2/pricing/>: free tier 10 GB-month storage, 1 million Class A operations and 10 million Class B operations per month, egress free. DNS and the managed WAF rules used here are on the free plan. Enabling R2 may ask for a payment method; verify at signup.

### Steps

1. Sign up at <https://dash.cloudflare.com/sign-up>. One account for the project, owned by `<owner>`.
2. Left menu, **R2 object storage**. Enable it if asked (this is where a payment method may be requested).
3. **Create bucket**. Name: `ai-stylist-dev`. Location: the **EU** jurisdiction (DEC-61); note that a jurisdiction changes the S3 endpoint hostname. Leave default storage class (Standard; the free tier applies only to Standard). Repeat for `ai-stylist-staging` and `ai-stylist-prod` when the first minimal release is prepared (DEC-79).
4. Copy the account id: R2 overview page, **Account details** panel, **Account ID**. Store it as `R2_ACCOUNT_ID`.
5. Create a token: R2 overview, **Account details**, **Manage** next to **API Tokens**, **Create Account API token** (an account token outlives any one person; do not use "Create User API token"). Name `ai-stylist-dev`. Permissions: **Object Read & Write**. Under "Specify bucket(s)" choose only `ai-stylist-dev`. TTL: leave unlimited or set a rotation date. Create.
6. The next screen shows **Access Key ID** and **Secret Access Key** once. Copy them into `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. The S3 endpoint of an EU-jurisdiction bucket is `https://<R2_ACCOUNT_ID>.eu.r2.cloudflarestorage.com`; the adapter builds it from `R2_ACCOUNT_ID` and `R2_JURISDICTION`, so it is not a separate key.
7. Set `R2_BUCKET=ai-stylist-dev` and `R2_JURISDICTION=eu`. The jurisdiction is the one chosen in step 3; every environment of this project uses `eu` (DEC-61). Leave `R2_PUBLIC_BASE_URL` empty locally; it is set when a custom domain is attached to the public assets bucket (step 9), which is not needed before P04/P06.
8. Repeat steps 5 and 6 with a separate token per environment (`ai-stylist-staging`, `ai-stylist-prod`), each scoped to its own bucket, into the matching `secrets/<env>.enc.yaml`.
9. Custom domain for public assets (P04/P06): create a separate bucket `ai-stylist-assets-<env>` for public app and content assets only, then bucket, **Settings**, **Public access**, **Custom domains**, connect a hostname on the project's Cloudflare zone and set `R2_PUBLIC_BASE_URL` to it in the matching `secrets/<env>.enc.yaml`. The Cloudflare cache in front of that hostname is the only CDN in the design. User media buckets never get a custom domain or `r2.dev` access; they are read through presigned GETs only. A separate backup bucket with its own token is created in section 3 step 5.
10. WAF (with the server, for the first minimal release, DEC-79): add the `ai-stylist.app` zone to Cloudflare DNS with the API hostnames from section 4 step 6 (`staging-api`, `api`), proxy them (orange cloud), then **Security**, **WAF** managed rules. Rate limits inside the API (`RATE_LIMIT_*`) stay on regardless; never disable one to make the other work.

### What to record

- `.env.example` keys: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_JURISDICTION`, `R2_PUBLIC_BASE_URL` (one set per environment); `R2_LIVE_TEST` (machine-local opt-in for the live test suite, empty by default).
- Overview table: bucket names (media, public assets, backups), jurisdiction chosen.
- What exists since 2026-10-12 (Linear AI-21): the bucket `ai-stylist-dev` in the EU jurisdiction, and one Account API token named `ai-stylist-dev` with **Object Read & Write** on that bucket only. The staging and production buckets and the WAF wait for the first minimal release (DEC-79).

### Do not

- Do not create one token with **Admin Read & Write** and reuse it across environments.
- Do not make a user media bucket public in any environment; only the dedicated public assets bucket gets a custom domain.
- Do not upload real user photos to any bucket; test data is synthetic.

### Verify

With the four `R2_*` keys and `R2_JURISDICTION=eu` in `.env` (`just secrets-sync`; direnv loads them), run `R2_LIVE_TEST=1 just test platform`. The suite `apps/api/src/platform/tests/r2-storage.live.sec.test.ts` checks presigned PUT and GET against the configured bucket: a signed upload succeeds, and R2 refuses another content type, another size, an edited URL, another user's prefix and an expired URL. It overwrites one synthetic object under `u/usr_0000000000000000000000TEST/`. Without `R2_LIVE_TEST=1` it is skipped; it refuses to run with `APP_ENV` staging or prod, or against a bucket whose name does not end in `-dev` or `-local`. Paste one run on Linear AI-21. The bucket page in the dashboard lists `ai-stylist-dev`; before the first run of the suite it holds zero objects.

## 7. Expo / EAS (removed)

The React Native / Expo app and its EAS build and submit lanes were removed on 2026-09-22; the native
iOS app builds with Xcode and the native Android app with Gradle, so no Expo account is needed. The
section number is kept so references to sections 8 and 9 stay valid.

If an Expo account or project was already created, a human cleans up:

- ~~delete the GitHub secret `EXPO_TOKEN`~~ — checked 2026-09-23: it was never created (not in the repository's Actions, Dependabot or Codespaces secrets, and no environments exist);
- ~~remove `EXPO_PUBLIC_EAS_PROJECT_ID` and `EXPO_PUBLIC_API_BASE_URL` from `secrets/dev.enc.yaml`~~ — done
  2026-09-24 (`sops unset`);
- optionally delete the Expo project and any robot-user access token on <https://expo.dev>.

## 8. Apple Developer Program and App Store Connect

### Why we use it

iOS code signing, TestFlight, App Store distribution, and Sign in with Apple. Today `.github/workflows/ios.yml` builds unsigned simulator builds only and needs no secret; the signing + TestFlight upload lane is future work a human approves and runs, and it will read the App Store Connect API key and signing material from the GitHub secrets below.

### When you need it

P02-T14, which DEC-63 moved out of P02 to the first phase that ships a build to testers, no later than P13 store setup. Apple's approval can take days, so enroll before that phase starts.

### Cost

99 USD per membership year (Checked 2026-09-10, <https://developer.apple.com/programs/whats-included/>). Enrollment needs an Apple Account with two-factor authentication. Individuals enroll with their legal name; organizations need a legal entity, a D-U-N-S Number, a domain-matching work email and a public website (Checked 2026-09-10, <https://developer.apple.com/programs/enroll/>). Decide individual vs organization before enrolling (deferred by the owner on 2026-10-09, DEC-63); the seller name shown on the App Store follows from it.

Since 2026-04-28 Apple requires uploads to be built with Xcode 26 or later using the iOS 26 SDK (Checked 2026-09-10, <https://developer.apple.com/news/upcoming-requirements/>). The iOS lane pins Xcode 27 (`apps/ios/.xcode-version`, the `xcode-27` runner image in `ios.yml`), which satisfies this.

### Steps

1. Enroll at <https://developer.apple.com/programs/enroll/>. Wait for the confirmation email before continuing; App Store Connect stays empty until then.
2. Decide the bundle identifier (OQ-18; deferred by the owner on 2026-10-09 together with store enrollment, DEC-63). The native apps use the placeholder `app.aistylist.mobile` as both the iOS bundle identifier and the Android `applicationId` for prod, with `.dev` and `.preview` suffixes for the other environments (set in `apps/ios/Config/*.xcconfig` and `apps/android/app/build.gradle.kts`); it must be replaced by a final reverse-domain id that you own before the first signed build, because Apple ties it to the App ID and it cannot change later. Change it through a pull request (both apps and the Maestro `APP_ID` values in the `just` e2e recipes).
3. Register the App ID: <https://developer.apple.com/account>, **Certificates, Identifiers & Profiles**, **Identifiers**, **+**, **App IDs**, type **App**, description `AI Stylist`, Bundle ID **Explicit** with the id from step 2. Enable the **Sign in with Apple** and **Push Notifications** capabilities now; they are free to enable and needed in P03 and P09. Register.
4. Copy the **Team ID** from the account **Membership details** page (10 characters). Store it as GitHub secret `APPLE_TEAM_ID`; the future signing lane reads it.
5. Create the app record: <https://appstoreconnect.apple.com>, **Apps**, **+**, **New App**, platform iOS, name `AI Stylist`, primary language, the bundle id from step 3, SKU `ai-stylist`. This makes TestFlight uploads possible.
6. Create the App Store Connect API key: **Users and Access**, **Integrations** (opens with App Store Connect API selected), **Team Keys**, **Generate API Key** (or **+**). Name `github-actions`. Access: **App Manager** (enough for TestFlight uploads). **Generate**.
7. The key row now shows **Key ID**; the page header shows **Issuer ID**. Download the `AuthKey_<KEYID>.p8` file; it can be downloaded once only. Store:
   - **Key ID** as GitHub secret `APP_STORE_CONNECT_API_KEY_ID`
   - **Issuer ID** as GitHub secret `APP_STORE_CONNECT_API_ISSUER_ID`
   - the full text of the `.p8` file (including the `-----BEGIN PRIVATE KEY-----` lines) as GitHub secret `APP_STORE_CONNECT_API_KEY_P8`
8. Move the `.p8` file into the password manager and delete it from disk.
9. Distribution certificate and provisioning profile: the future signing lane needs them exported as `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, and `IOS_PROVISIONING_PROFILE_BASE64`. Skip until that lane asks for them.

### What to record

- GitHub secrets: `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_P8`, `APPLE_TEAM_ID`; later `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`.
- `.env.example` keys `APPLE_SIGNIN_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_CLIENT_ID` come from section 14, not from this section.
- Repo: final bundle id in the iOS app's build configuration.

### Do not

- Do not give the API key **Admin** access; App Manager is enough.
- Do not commit the `.p8`, a `.p12`, or a `.mobileprovision` anywhere.
- Do not share the Apple Account password with anyone; use App Store Connect user roles instead.

### Verify

Once the signing + upload lane exists (it will be listed in `.github/workflows/README.md`), a human runs it; a new build appears under **TestFlight** in App Store Connect within about 30 minutes. Until then, confirm the App ID and app record exist in the portal; nothing in the repo reads these secrets yet.

## 9. Google Play Console

### Why we use it

Android distribution. Today `.github/workflows/android.yml` builds debug, preview and an **unsigned** release APK and needs no secret; a signed release bundle (AAB) and the Play internal-track upload are a future, tag- or dispatch-only lane a human approves and runs.

### When you need it

P02-T14, moved out of P02 by DEC-63 with the Apple enrollment of section 8 (the release build stays unsigned until the signing lane exists).

### Cost

25 USD one-time registration fee, paid by card; identity verification may ask for a government id (Checked 2026-09-10, <https://support.google.com/googleplay/android-developer/answer/6112435>). Personal accounts created after 2023-11-13 must complete a closed-testing requirement before production release; the details are on the linked Google page and are a P14 concern.

### Steps

1. Register at <https://play.google.com/console/signup> with the owner's Google account. Choose organization if a legal entity exists (matches the Apple decision in section 8). Pay the fee and complete verification.
2. **Create app**: name `AI Stylist`, default language, **App** (not game), **Free**. Accept the declarations. The package name is fixed by the first uploaded bundle; it must equal the Android app's `applicationId`, so finish section 8 step 2 first.
3. Signing. Two keys exist: the **upload key** (yours; signs the AAB you upload) and the **app signing key** (Google's; signs what users install). Use **Play App Signing** (default on new apps) so Google holds the app signing key.
4. Upload keystore. Generate one locally with `keytool` from the mise-pinned JDK (`keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`).
5. Store, as GitHub secrets, under the names the future signing lane will read:
   - `ANDROID_KEYSTORE_BASE64`: `base64 -w0 upload.jks`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
6. Move the keystore and its passwords into the password manager and delete the keystore from the repo checkout.
7. First upload (human, once the signing lane produces a signed AAB): Play Console, **Testing**, **Internal testing**, **Create new release**, upload that AAB. Play records the upload certificate from this first bundle; every later upload must be signed with the same key. Google requires the first bundle to be uploaded by hand; the API cannot create the first release.
8. Play upload service account (for the future upload lane; skip until it exists). In Google Cloud (the project from section 14 is fine), **IAM & Admin**, **Service Accounts**, create `play-upload`, then **Keys**, **Add key**, **JSON**. In Play Console, **Users and permissions**, **Invite new users**, the service account's email, app access `AI Stylist` only, permissions **Release apps to testing tracks** (add production release rights only when a staged-rollout lane is approved). Store the JSON file's full text as GitHub secret `PLAY_SERVICE_ACCOUNT_JSON`, then move the file into the password manager and delete it from disk.

### What to record

- GitHub secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and (step 8) `PLAY_SERVICE_ACCOUNT_JSON`.
- `.env.example`: nothing; `GOOGLE_SIGNIN_CLIENT_ID` comes from section 14.
- Repo: final `applicationId` in the Android app's build configuration.

### Do not

- Do not lose the upload keystore; recovering requires a support request to Google and a key reset.
- Do not commit `*.jks`, `*.keystore`, or the service-account JSON key.
- Do not opt out of Play App Signing.

### Verify

Until the signing lane exists, confirm the app record exists in Play Console and the four keystore secrets are set; nothing in the repo reads them yet. Once the lane exists (it will be listed in `.github/workflows/README.md`), a human runs it: the artifact contains a signed `.aab`, and uploading it to Internal testing succeeds without a signature error.

## 10. PostHog

### Why we use it

Product analytics, session replay, error tracking, and feature flags (`SPINE.md` §2). The native apps wire PostHog behind a consent-gated analytics port (P02-T09); consent defaults to OFF, and nothing, crash capture included, starts before opt-in. Until P03 ships the consent flow, only a Dev build's debug consent toggle opts in. How it works: [docs/observability/posthog.md](observability/posthog.md).

### When you need it

P02-T09 (native analytics and crash reporting, symbol upload, API feature flags, `just observability-sync`) and P03 (consent-gated user events, prod project, deletion-API adapter in `platform`).

### Cost

Free tier, Checked 2026-10-03 at <https://posthog.com/pricing>: 1M events, 5K session recordings, 100K exceptions, 1M feature flag requests per month; no credit card required; 1 project, and at most 10 personal API keys. PostHog Cloud offers US and EU regions; the test project exists in US Cloud (DEC-58); the production project goes on EU Cloud with the real account (DEC-61). PostHog moves a project to the other region only for Scale or Enterprise customers (<https://posthog.com/docs/settings/projects>), so on the free plan the EU home region (DEC-61, which resolved OQ-07) means a new organization and project on EU Cloud (<https://eu.posthog.com/signup>).

### Steps

1. Sign up at <https://posthog.com/signup>, or sign in at <https://us.posthog.com>. The test project is in **US** Cloud (DEC-58); the production project goes on EU Cloud (DEC-61; the Cost paragraph above says what that takes). PostHog has two hosts, and every key below belongs to exactly one of them: `https://us.i.posthog.com` is the ingestion host, where the apps and the API send events and flag requests (`POSTHOG_HOST`); `https://us.posthog.com` is the app and API host, used by the web UI, `posthog-cli` and `just observability-sync` (`POSTHOG_CLI_HOST`). Do not swap the two: the code checks only that each is an http(s) address, so a swapped pair is noticed only when events, the symbol upload or the sync fail.

2. Use the organization and the project the account has after sign-up. Their names do not matter: every step below finds the project by its numeric id. The free plan allows one project, so the production project planned for P03 is created as a new organization and project on EU Cloud with the real account (DEC-61), which keeps DEC-48 (exit before any paid usage).

3. Open <https://us.posthog.com/settings/project>; it redirects to `https://us.posthog.com/project/<project id>/settings/project-details`. The page is **Settings - General**, and its section **Project token & ID** has three boxes:

   - **Project token**: a value of the form `phc_<letters and digits>`. The page notes that integrations often call it the project API key. It is public by design (it is compiled into the apps) but still stays out of committed files. Store it as `POSTHOG_API_KEY`. Do not click the **Reset token** icon next to it: according to PostHog's source it invalidates the current token at once (not tried), and every app build that carries the old token would stop sending.
   - **Project ID**: digits only, the same number as in the address bar. Store it as `POSTHOG_CLI_PROJECT_ID`.
   - **Region**: `US Cloud`. Nothing to store; it confirms which hosts from step 1 apply.

   Store these in `secrets/dev.enc.yaml` the way section 2 step 8 describes, together with `POSTHOG_HOST` (`https://us.i.posthog.com`) and `POSTHOG_CLI_HOST` (`https://us.posthog.com`, no path and no trailing slash). Leave `POSTHOG_API_KEY` and `POSTHOG_HOST` empty in your personal `.env` if you want to be sure nothing is sent locally.

4. A **Personal API key** (account settings) is needed later by the deletion adapter in P03; that task adds its key name to `.env.example`.

5. For `just observability-sync`, create a personal API key. Open <https://us.posthog.com/settings/user-api-keys> (settings sidebar: **Account**, **Personal API keys**) and click **Create personal API key**. In the dialog of the same name:

   - **Label**: `observability-sync`.
   - **Organization & project access**: the choices are **All access**, **Organizations** and **Projects**. Choose **Projects**, click **Select projects…** and tick the project.
   - **Scopes**: every scope is a row with **No access**, **Read** and **Write**. No preset fits this key, so type into **Search scopes…** to find the rows **Project**, **Feature flag** and **Hog function**, and set each to **Write** (Write includes Read). Leave every other row on **No access**. The form shows these names; the `project:write`, `feature_flag:write` and `hog_function:write` spellings appear only in the key list afterwards.
   - Click **Create key**. The dialog **Personal API key ready** shows the value, which starts with `phx_`, once only. Copy it, then click **Okay**.

   Your account must be a project admin, because the sync changes admin-only settings such as `anonymize_ips`; organization owners and admins are project admins automatically. Store the key with `just secrets-push --set POSTHOG_SYNC_API_KEY`, which asks for the value at a hidden prompt (section 2 step 8), then run `just secrets-sync`. Never a GitHub secret. A key made this way was accepted by every call of the sync on 2026-10-03, so **Organizations** access is not needed.

6. For symbol upload, create a second personal API key in the same dialog:

   - **Label**: `symbol-upload`.
   - **Organization & project access**: choose **Organizations**, click **Select organizations…** and tick the organization. Do not choose **Projects** for this key: PostHog's source marks the **Organization** scope it needs as not available on a key limited to projects (not tried).
   - **Scopes**: click **Select preset** and choose **Source map upload**. It sets exactly two rows, **Error tracking** to **Write** and **Organization** to **Read**; the key list shows them as `error_tracking:write` and `organization:read`.
   - Click **Create key**, copy the `phx_` value from **Personal API key ready**, then click **Okay**.

   Store it with `just secrets-push --set POSTHOG_CLI_API_KEY`, then run `just secrets-sync`. The iOS and Android workflows upload with it on `main` only: add the GitHub secret `POSTHOG_CLI_API_KEY` and the variables `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST` (section 1 step 7), each with its value from `secrets/dev.enc.yaml`. Do not add `POSTHOG_API_KEY` or `POSTHOG_HOST` to GitHub: CI-built apps carry no project key. `.github/workflows/README.md` lists which job reads which.

### What to record

- `.env.example` keys: `POSTHOG_API_KEY`, `POSTHOG_HOST`, `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST`, `POSTHOG_SYNC_API_KEY`.
- GitHub secret: `POSTHOG_CLI_API_KEY`; variables: `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST`.

### Do not

- Do not call PostHog from anywhere except the analytics port; consent gating is a legal requirement (`planning/11`).
- Do not enable session replay on screens that show measurements, selfies, or photos; that is a P03 review item.
- Do not click **Reset token** on the project settings page, and do not put a personal key (`phx_`) into `POSTHOG_API_KEY`: the API and both apps accept only a `phc_` token there.
- Do not give a personal key **All access**, and do not use one key for both jobs: the key that CI holds must not be able to change settings or flags.

### Verify

`just doctor` shows `✔ .env has every key from .env.example`. With consent OFF (the default), the PostHog **Activity** page must stay empty even after running the app; an event there while the Dev build's debug consent toggle is off is a bug. The crash demo and symbol upload checks are in [docs/observability/posthog.md](observability/posthog.md#symbol-upload).

To test the two personal keys, in a terminal where direnv has loaded `.env` after `just secrets-sync`:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $POSTHOG_CLI_API_KEY" "$POSTHOG_CLI_HOST/api/organizations/@current/"
curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $POSTHOG_CLI_API_KEY" "$POSTHOG_CLI_HOST/api/projects/$POSTHOG_CLI_PROJECT_ID/feature_flags/"
just observability-sync posthog --dry-run
```

Expected: `200` (the upload key works), then `403` (it cannot read flags, so it holds nothing beyond its two scopes), then the plan of the dry run, which sends only GET requests with `POSTHOG_SYNC_API_KEY`. Both status codes were seen on 2026-10-03. A `403` in the dry run means one of the three scope rows or the selected project is missing on the sync key.

## 11. Grafana Cloud

### Why we use it

OpenTelemetry backend for traces, metrics, and logs (doc 14; ADR-OBS-01 = [ADR-0007](adr/0007-observability-backend.md)). The `api`, `jobs` and `segmentation` processes export OTLP to it; the free tier is expected to cover launch. How it works: [docs/observability/grafana.md](observability/grafana.md).

### When you need it

P02-T09.

### Cost

Free tier, Checked 2026-09-10 at <https://grafana.com/pricing/>: 10k active metric series, 50 GB logs, 50 GB traces, 50 GB profiles per month, 14 day retention, 3 active users; no credit card required. On 2026-10-03 the account was still on a trial: the portal showed "Free trial" with an end date of 2026-10-11. What changes on that date was not checked on any official page, so confirm afterwards that the stack is on the free plan (DEC-48: exit before any paid usage).

### Steps

1. Sign up at <https://grafana.com/auth/sign-up/create-user>. Later, sign in at <https://grafana.com/> and click **My account** in the page header to open the Grafana Cloud Portal. Use the stack the account has (the free plan allows one stack per account; if there is none yet, create it in an EU region, DEC-58). The stack's name, written `<stack>` below, is the title of its card under **Manage your Grafana Cloud stack** and the first part of its address `https://<stack>.grafana.net`. No step depends on the name.

2. Read the two OTLP connection values (Checked 2026-10-03, <https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/>). On the stack's card click **Details** (not **Launch**); the **Manage Stack** page of that stack opens. On its **OpenTelemetry** tile click **Configure**. The connection-details page shows:

   - **OTLP Endpoint**: a URL such as `https://otlp-gateway-prod-<region>.grafana.net/otlp`. Copy it as shown and keep the `/otlp` ending; never type it by hand, because newer regions use a longer host name. This is `OTEL_EXPORTER_OTLP_ENDPOINT`.
   - **Instance ID**: a number. It is the user-name half of the header built in step 3. It is not a secret and is not stored under a key of its own.

   Do not click **Generate now** under **Password / API Token** on that page. The token it creates belongs to a ready-made policy (named `stack-<number>-otlp-write`) whose scopes cannot be changed and are broader than this project needs: besides `metrics:write`, `logs:write` and `traces:write` it carries `metrics:import`, `alerts:write`, `rules:write`, `profiles:write` and `datadog:validate`.

3. Create the dev token from an access policy of its own, with only the three scopes the processes use. Go back to **Manage Stack** and click **Launch** on the **Grafana** tile; the stack's Grafana opens at `https://<stack>.grafana.net`. In its left menu choose **Administration**, **Users and access**, **Cloud access policies**, then:

   - Click **Create access policy**. In the dialog **Create new access policy**, type `api-dev` into **Display name** (**Name** fills in by itself). In the **Scopes** table tick **Write** on the rows `metrics`, `logs` and `traces`, and nothing else. Click **Create**.
   - On the new `api-dev` card click **Add token**. In the dialog **Create new token**, type `api-dev` into **Token name** and choose **90 days** under **Expiration date** (the default is **No expiry**; `planning/11-security-privacy-and-compliance.md` §5.3 sets 90 days for provider keys). Click **Create**.
   - The dialog **Token successfully added.** shows the token, a value that starts with `glc_`, once only. Copy it before you click **Close**.

   Build the header and store it in a terminal that no AI agent can read, without the token ever being shown or typed on a command line. First run this line on its own; it waits for you to paste the token and press Enter, and shows nothing:

   ```bash
   read -rs GLC_TOKEN
   ```

   Then put the Instance ID from step 2 in place of the placeholder, keep the single quotes, and run the rest. The first command does nothing while the token is empty.

   ```bash
   [ -n "$GLC_TOKEN" ] && printf 'Authorization=Basic%%20%s' "$(printf '%s:%s' '<instance id>' "$GLC_TOKEN" | base64 | tr -d '\n')" |
     just secrets-push --set OTEL_EXPORTER_OTLP_HEADERS
   unset GLC_TOKEN
   ```

   `OTEL_EXPORTER_OTLP_HEADERS` now holds `Authorization=Basic%20<base64 of instance id:token>`, on one line, with no space and no quotes. `%20` stands for the space after `Basic`; the API, the jobs process, the Python worker and the CI metrics push all read this spelling correctly. The header in use since 2026-10-03 has this form and passed the test under Verify. The two commands above were tried with a made-up token only (the header came out right), and the pipe into `just secrets-push --set` is covered by that script's tests, not by a run with a real token.

4. Store the endpoint with `just secrets-push --set OTEL_EXPORTER_OTLP_ENDPOINT` (paste the address at the hidden prompt), then run `just secrets-sync` to copy both values into `.env`. Leave `OTEL_SERVICE_NAME` empty in both places: each process has its own name (`api`, `jobs`, `segmentation`), which `just dev-api` / `just dev-workers` set per process and each deployed service sets in its own Coolify config ([docs/observability/grafana.md](observability/grafana.md#configure-a-process)). `APP_ENV` is per machine as well: it stays empty in `secrets/dev.enc.yaml`, and `just bootstrap` writes `local` into an empty `APP_ENV` in `.env`.

5. For every later environment, repeat step 3 with an access policy and a token of its own (`api-staging`, `api-prod`) and store the header in the matching `secrets/<env>.enc.yaml` with `just secrets-edit <env>` (`just secrets-push` writes `dev` only), so one can be revoked without touching the others. The endpoint and the Instance ID are the same for all of them: one stack serves every environment.

6. For `just observability-sync`, create a service account token. This is a second kind of token: the `glc_` token from step 3 can send telemetry but cannot call Grafana's HTTP API, and a service account token (`glsa_`) is the reverse. In the stack's Grafana choose **Administration**, **Users and access**, **Service accounts**, **Add service account**, then:

   - On the page **Create service account**, type `observability-sync` into **Display name**. Click **Role** (it shows **No roles assigned**), choose **Admin** under **Basic roles** and click **Apply**, then **Create**. Admin holds the alerting provisioning writer role; Editor does not.
   - On the account's page, under **Tokens**, click **Add service account token**. Fill in **Display name**, for example `observability-sync-<yyyymmdd>`. Under **Expiration** click **Set expiration date**: the default is **No expiration** and there is no 90-day choice, so click the **Expiration date** field and pick the day 90 days from today in the calendar (`planning/11-security-privacy-and-compliance.md` §5.3). Click **Generate token**.
   - The dialog **Service account token created** shows the token, a value that starts with `glsa_`. Copy it before you click **Close**; treat it as shown once.

   Store the token with `just secrets-push --set GRAFANA_SERVICE_ACCOUNT_TOKEN`, which asks for it at a hidden prompt (section 2 step 8). Store three more values in `secrets/dev.enc.yaml` the same way (one stack serves every environment): the address `https://<stack>.grafana.net` with no path as `GRAFANA_URL`, the on-call addresses as `GRAFANA_ALERT_EMAILS` (one address, or a comma list; `docs/observability/grafana/README.md` records what is known about separators) and the on-call IANA zone as `GRAFANA_ONCALL_TIMEZONE` (for example `Europe/Berlin`; an offset such as `+01:00` is refused). Then `just secrets-sync`, `just observability-sync all --check`, `just observability-sync --dry-run`, `just observability-sync`. Run the last command a second time: every line must then say `unchanged`.

7. Optional, for the CI row of dashboard 1: GitHub secrets `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` (section 1 step 7), read by the `pr-gate.yml` summary job on pushes to `main` only. `OTEL_EXPORTER_OTLP_HEADERS` must carry a separate token named `ci-metrics` with only the metrics write scope, never the dev token (step 3), so the CI copy can write metrics and nothing else and can be revoked alone. Create it as in step 3, with an access policy `ci-metrics` on which **Write** is ticked on the `metrics` row only; the OpenTelemetry tile cannot produce such a token. Build its header the same way, with the same Instance ID, but hand it to `gh secret set` instead of `just secrets-push`: [`docs/NEW-REPO-SETUP.md`](NEW-REPO-SETUP.md), "Grafana Cloud: a token expired, or the account is new", has the commands. GitHub gets the endpoint and the header as raw values, without `export` and without quotes. No such token exists yet (2026-10-03), and no Grafana page states that the gateway accepts a metrics-only token: the first push to `main` after both secrets exist is the test.

### What to record

- `.env.example` keys: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`, `GRAFANA_URL`, `GRAFANA_SERVICE_ACCOUNT_TOKEN`, `GRAFANA_ALERT_EMAILS`, `GRAFANA_ONCALL_TIMEZONE`.
- GitHub secrets (optional): `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` (CI metrics; the headers hold the `ci-metrics` token only).
- Password manager or calendar: the expiry date of every token from steps 3, 6 and 7. After that date the exporters, the sync or the CI push are expected to be refused (not seen yet), and the step is repeated with a new token. Appendix B of [`docs/NEW-REPO-SETUP.md`](NEW-REPO-SETUP.md) lists the tokens that exist and their dates.

### Do not

- Do not log request bodies or any sensitive field to Loki; the redaction allowlist from T09 applies to OTel attributes too.
- Do not share the token between environments.
- Do not use a token from **Generate now** on the OpenTelemetry tile; its scopes are fixed and broader than the three this project needs (step 2).
- Do not add `GRAFANA_SERVICE_ACCOUNT_TOKEN` to GitHub; the sync runs on a developer machine only.

### Verify

To test the credentials alone, without running a process, use a terminal where direnv has loaded `.env` after `just secrets-sync`. The command takes the base64 part after `Authorization=Basic%20` out of `OTEL_EXPORTER_OTLP_HEADERS` by itself, so nothing is pasted:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Basic ${OTEL_EXPORTER_OTLP_HEADERS#Authorization=Basic%20}" \
  -d '{"resourceSpans":[]}' "$OTEL_EXPORTER_OTLP_ENDPOINT/v1/traces"
```

Expected: `200`. A `401` means the header or token is wrong: on 2026-10-03 the real token answered `200` and a made-up one `401`. That test took the base64 part from the stored value in another way; the `${…#…}` form above was checked only for the text it produces, with a made-up value. A `ci-metrics` header is expected to answer `401` here too, because it has no traces scope (not tried). With the exporter wired (P02-T09), `just dev-api` followed by `curl localhost:3000/v1/health` produces a trace visible under **Explore**, **Tempo** in the stack.

To test the service account token, in the same terminal:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $GRAFANA_SERVICE_ACCOUNT_TOKEN" "$GRAFANA_URL/api/datasources"
```

Expected: `200` (seen on 2026-10-03). A `401` means the token is wrong or expired.

## 12. RevenueCat

### Why we use it

Subscriptions across App Store and Play with a server-side entitlements table as the source of truth and idempotent webhooks (`SPINE.md` §2).

### When you need it

P13 only. Nothing in P02 through P12 reads the keys.

### Cost

Free up to $2,500 monthly tracked revenue, then 1% of tracked revenue (Checked 2026-09-10, <https://www.revenuecat.com/pricing/>).

### Steps (prepare only)

1. Sign up at <https://app.revenuecat.com/signup> when P13 starts; create project `ai-stylist`.
2. Connect the App Store app (needs the App Store Connect API key from section 8, or an app-specific shared secret) and the Play app (needs a Google Cloud service account with Play Developer API access).
3. Products and entitlements are defined in P13 from `shared-kernel` entitlement names; the mobile SDK key is public and the **secret** API key is server-only.
4. Configure the webhook to the API's billing endpoint with an authorization header value you generate.

### What to record

- `.env.example` keys: `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_SECRET` (server-side, per environment).

### Do not

- Do not start P13 entitlement code from RevenueCat's dashboard state; the entitlements table is the source of truth.

### Verify

Deferred to P13: `just test billing` covers the webhook handler with recorded fixtures.

## 13. AI and data providers

Keep these short; each provider is wrapped by a port in `apps/api/src/platform/` and needs a doc-10 entry before any call goes to production.

### fal.ai

- Why: segmentation fallback (P06) and generative try-on and missing views (P11), `SPINE.md` §2.
- When: P06 (segmentation fallback), P11 (generation). P11 also requires the AIC-O2 privacy/DPA review before any user photo is sent.
- Cost: pay per image; the verified figures are in `planning/research/r6-pricing-verification-2026-09-09.md` (try-on $0.07 to 0.075 per image, verified 2026-09-09). Verify current prices on <https://fal.ai/pricing>. Set a spend limit in the dashboard before the first call.
- Steps: sign up at <https://fal.ai>; dashboard **Keys** (<https://fal.ai/dashboard/keys>), **Add Key**, name `ai-stylist-dev`, scope **API** (not ADMIN), **Create Key**. Copy once into `FAL_KEY` in `secrets/dev.enc.yaml` and `.env`. One key per environment.
- Record: `.env.example` key `FAL_KEY`.
- Do not: send face or body photos before the AIC-O2 review passes; do not call fal.ai from a module, only from the `platform` adapter.
- Verify: `just doctor` key check today; P06 adds `just test platform` fixtures.

### Open-Meteo

- Why: weather facts behind the `WeatherProvider` port (P08).
- When: P08. Development uses the free endpoint `https://api.open-meteo.com` (no key). Production requires a commercial plan (DEC-22); never launch on the free tier.
- Cost: free tier is non-commercial, 10,000 calls/day, 300,000 calls/month; commercial plans have a dedicated endpoint `customer-api.open-meteo.com` with an API key, Standard 1M calls/month (Checked 2026-09-10, <https://open-meteo.com/en/pricing>). The Standard price recorded in DEC-35 is $29/month (verified 2026-09-09 in r6); verify on the pricing page before buying.
- Steps: at P08 start, buy Standard at <https://open-meteo.com/en/pricing> with the owner's card; the customer portal is <https://dashboard.open-meteo.com>. Copy the API key. The adapter reads `OPEN_METEO_BASE_URL` (set to the customer endpoint in staging/prod, empty locally); the API-key variable is added to `.env.example` by the P08 adapter task.
- Record: `.env.example` key `OPEN_METEO_BASE_URL`; API key name added in P08.

### date-holidays (embedded)

- Why: public holidays behind the `HolidayProvider` port (P08) from the embedded open-source `date-holidays` library (ISC code, CC-BY-3.0 data; DEC-45, adapter `DateHolidaysHolidayProvider`, provider id `date-holidays`). No account, no network call, no key (Checked 2026-09-13 at <https://github.com/commenthol/date-holidays>).
- When: P08. The hosted Nager.Date API is used only to record cross-check fixtures in the P08 tests, never at runtime. Nager.Date self-hosting needs a licence key for its Docker image and package, so it was not chosen.
- Record: nothing in `.env.example`.

### Embeddings and vision LLM

- Why: attribute extraction (Gemini Flash-class or Claude Haiku), embeddings (Voyage multimodal per DEC-35, Cohere as the SPINE-era pick). Explanations are templates from reason codes with no LLM polish (DEC-46). The self-hosted eval arms (BiRefNet for segmentation, Qwen3-VL for extraction, SigLIP/SigLIP2 for embeddings in P06; FASHN VTON 1.5 for try-on in P11; DEC-47) need a GPU eval host, not accounts.
- When: P06 onward. Each provider must pass the doc 11 §7.5 privacy review before receiving garment images.
- Steps: create the accounts when P06 starts (Google AI Studio or Google Cloud for Gemini; Anthropic Console for Claude; Voyage AI dashboard for embeddings). Keys are not in `.env.example` yet; the P06 tasks that add the adapters add the keys with comments, following the existing pattern. Prefer a project-owned email and a monthly spend cap on each.
- Do not: put any of these keys in the mobile app; all calls go through the API.

## 14. Sign-in providers

better-auth (self-hosted, P03) needs Apple and Google as identity providers. Overview only; the P03-T03 task holds the precise configuration.

### Sign in with Apple

- Where it comes from: Apple Developer portal, **Certificates, Identifiers & Profiles**. (a) The App ID from section 8 step 3 with the **Sign in with Apple** capability. (b) **Identifiers**, **+**, **Services ID**: identifier such as `<bundle id>.signin`, enable Sign in with Apple, associate the App ID, add the API's return URL. (c) **Keys**, **+**, enable **Sign in with Apple**, pick the App ID, register, download the `.p8` once (Checked 2026-09-10, <https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web>).
- Record: `APPLE_SIGNIN_CLIENT_ID` = the Services ID identifier; `APPLE_SIGNIN_TEAM_ID` = the Team ID; `APPLE_SIGNIN_KEY_ID` = the Key ID. The `.p8` contents need a key that is not in `.env.example` yet; P03-T03 adds it. All go into `secrets/staging.enc.yaml` and `secrets/prod.enc.yaml` (`.env.example` marks them staging/prod).

### Google Sign-In

- Where it comes from: Google Cloud Console (<https://console.cloud.google.com>), create project `ai-stylist`, **APIs & Services**, **OAuth consent screen** (fill app name, support email, privacy policy URL; label may differ), then **Credentials**, **Create credentials**, **OAuth client ID**. Create three clients: **Android** (package name = the `applicationId` in `apps/android/app/build.gradle.kts`, see section 8 step 2, plus the SHA-1 of the upload certificate from section 9 and of the Play app-signing certificate), **iOS** (bundle id), and **Web application** (used by the API for token verification).
- Record: `GOOGLE_SIGNIN_CLIENT_ID` = the Web client id (server verifies ID tokens against it). The mobile clients are configured in the app in P03.
- Do not: put the client secret of the web client anywhere client-side; the mobile flow does not use it.

### Verify

Deferred to P03: `just test identity` runs the better-auth provider fixtures.

## 15. Push notifications (FCM + APNs)

Server-side FCM + APNs direct, behind a `platform` port (`SPINE.md` §2); clients register natively: UserNotifications on iOS, the Firebase Cloud Messaging SDK on Android (DEC-52). Overview only; P09-T16 holds the precise configuration. Nothing is built yet.

- When: P09-T16 (daily-outfit notification).
- Cost: FCM has no per-message charge; APNs is included in the Apple membership (section 8). Verify on <https://firebase.google.com/pricing> before relying on it.
- Firebase: in the Firebase console, add Firebase to the Google Cloud project from section 14, register the Android app with the `applicationId` (section 8 step 2), then **Project settings**, **Service accounts**, **Generate new private key** (label may differ). Store the JSON base64-encoded as `FCM_SERVICE_ACCOUNT_B64` in the matching `secrets/<env>.enc.yaml`, one service account per environment, and delete the file from disk.
- APNs: the App ID already has **Push Notifications** enabled (section 8 step 3). In **Certificates, Identifiers & Profiles**, **Keys**, **+**, enable **Apple Push Notifications service (APNs)**, register, download the `.p8` once, and move it into the password manager. Its key names are not in `.env.example` yet; the P09-T16 adapter task adds them.
- Record: `.env.example` key `FCM_SERVICE_ACCOUNT_B64`; the APNs key names once P09-T16 adds them.
- Do not: put a service-account JSON or the `.p8` in the native apps, and do not send sensitive data classes in a push payload (`docs/modules/notifications.md`).
- Verify: deferred to P09: `just test notifications` covers the port with a fake transport; the device push smoke runs on both platforms.

## 16. Renovate

### Why we use it

Renovate is a hosted bot that opens pull requests for dependency updates, so the pinned versions stay current without manual work. All of its behaviour comes from [`renovate.json`](../renovate.json) at the repo root: the schedule, the groups, and which updates merge by themselves (DEC-56).

### When you need it

P02 (P02-T12, Linear AI-20). The install is one browser step by the repository owner. Done on 2026-10-13 for `ArtMin96/ai-stylist`: the app opened its "Dependency Dashboard" as issue #25 that day.

### Cost

Free for this use: Mend's hosted Renovate app, without Mend's paid products. The price was not checked on Mend's site on 2026-10-13. Each Renovate pull request runs CI, which is free while the repository is public (DEC-82) and uses paid Actions minutes once it is private again.

### Steps

1. Install the GitHub App as [`docs/NEW-REPO-SETUP.md`](NEW-REPO-SETUP.md) section 9 "GitHub Apps" describes, for `ArtMin96/ai-stylist` only. Mend's sign-up screens asked two questions on 2026-10-13: choose "Renovate Only", not "Mend Application Security", and choose "Scan and Alert", not "Scan Only". What "Scan Only" does was not found in Mend's documentation; it is read here as the silent mode, which opens no pull requests.
2. Nothing else is configured in the app. Change its behaviour through `renovate.json` in a normal pull request.
3. Minor and patch updates of npm, Python and GitHub Actions dependencies merge by themselves once CI is green. Toolchain pins in `mise.toml`, Android and iOS updates wait for a person: the body of each such pull request names the command to run on its branch (`just android-deps-lock`, `just ios-test-packages`, `just generate`). The `description` of each rule in `renovate.json` says why.

### What to record

- No secret: the app authenticates as a GitHub App and needs no repository secret.
- The row of this service in the overview table: the owner, and the tick once the "Dependency Dashboard" issue exists.

### Do not

- Do not give the app access to every repository of the account.
- Do not add Mend's application-security product. It scans the source code, and no provider data-policy check covers it (doc 11 §7.5).
- Do not merge a major bump of `node`, `pnpm`, `python` or `java` without an ADR; `renovate.json` labels those pull requests `needs-adr`.

### Verify

[`docs/NEW-REPO-SETUP.md`](NEW-REPO-SETUP.md) section 9 has the command: it prints the "Dependency Dashboard" issue once the app has run. `renovate.json` schedules its work "before 6am on monday", so the first pull requests can take until the next Monday.

## Checklist by phase

| Phase                 | Do now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P02 (now)             | 1 GitHub (CODEOWNERS, branch protection, Actions). 2 sops + age (keys, `.sops.yaml`, `secrets/dev.enc.yaml`, `SOPS_AGE_KEY`). 5 pg-boss: nothing to provision (T08). 6 R2 dev bucket + token (T13). 10 PostHog test project (T09). 11 Grafana Cloud test stack + OTel vars (T09). 16 Renovate GitHub App (T12). Store enrollment (8 Apple, 9 Play Console) left P02 with T14 (DEC-63) for the first phase that ships builds to testers, P13 at the latest.                                                                                                                                                                                                                                                                                         |
| P03                   | 14 Apple and Google sign-in credentials.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| First minimal release | Moved here from P02 and P03 on 2026-10-12 (DEC-79, DEC-80); the date is not set. 3 PostgreSQL on the server: staging and production databases + roles, PgBouncer, pgBackRest to the backup bucket, and the restore proof before the server holds real user data (the rest of T07). 4 Server + Coolify: host, hardening, project + environments, then the first deploy (Dockerfile, `COOLIFY_TOKEN`, sync script). `secrets/staging.enc.yaml` and `secrets/prod.enc.yaml`. 6 R2 staging and production buckets, Cloudflare DNS + WAF for the API domain. 10 PostHog production project on EU Cloud with the real account (the free plan allows one project: section 10 step 2) + personal API key. 11 Grafana Cloud: the real EU account and stack. |
| P06                   | fal.ai key + spend limit, vision-LLM and embedding provider accounts (privacy review first), GPU eval host for the self-hosted eval arms, R2 public assets custom domain (if not done in P04), R2 multipart upload settings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P08                   | Open-Meteo Standard plan + key; run the weather comparison (Open-Meteo managed vs self-hosted vs WeatherKit); holidays need nothing (embedded `date-holidays`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| P09                   | 15 Firebase project + FCM service account per environment, APNs key (T16).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| P11                   | fal.ai production key, AIC-O2 review passed, Replicate fallback account, per-provider spend caps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P13                   | 12 RevenueCat project, store connections, webhook secret, `REVENUECAT_*` in `secrets/prod.enc.yaml`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| P14                   | Rotate every credential created during development that was ever pasted into a shared terminal (the test accounts are replaced by real ones before launch, and no test key is reused); confirm each `secrets/prod.enc.yaml` value is production-scoped; restore drill via pgBackRest into a scratch database (section 3 step 9); Play closed-testing requirement; App Store review assets.                                                                                                                                                                                                                                                                                                                                                         |

## When something goes wrong

1. `just secrets-sync` reports `no age recipients in .sops.yaml`. Finish section 2 step 3 for the environment named in the error, then retry. If it reports that `secrets/<env>.enc.yaml` does not exist, create that encrypted file with `just secrets-edit <env>` as described in section 2 step 5.
2. `sops` says `no key could decrypt the data` or `failed to get the data key`. Your public key is not in the file's recipient list, or your private key is not at `~/.config/sops/age/keys.txt` (the same path on macOS: the recipes point sops at it, a bare `sops` command there needs `SOPS_AGE_KEY_FILE` set to it). Ask a developer who can decrypt to add your key to `.sops.yaml` and run `just secrets-updatekeys`. Check `SOPS_AGE_KEY_FILE` if you keep the key elsewhere.
3. `just doctor` reports `.env missing N key(s)`. Someone added keys to `.env.example`. Copy the missing lines from `.env.example` into `.env` (values stay empty) or re-run `just secrets-sync` after the shared file is updated.
4. `just doctor` warns that values exist only on this machine, or that `secrets/dev.enc.yaml` lacks or has stale key names. Run `just secrets-push` to read the plan, then `just secrets-push --apply` and commit `secrets/dev.enc.yaml`. Add `--prune` for empty stale names; a stale name that holds a value needs `--prune-values` as well. A key the plan lists as `differs` needs `just secrets-sync` (the shared value is newer) or `--replace` (yours is). A warning that shared values are not in `.env` yet means `just secrets-sync`.
5. `just dev-api` or `just dev-workers` stops with `container name "/ai-stylist-postgres" is already in use`. A container left by another compose project owns the name (an older checkout directory, or a `COMPOSE_PROJECT_NAME` you no longer export). Run `just doctor`: it names that project, prints the commands that remove the container, and says where its data stays.
6. `just db-migrate` against the staging PostgreSQL fails with a `SET` or `prepared statement` error. You used the pooled (PgBouncer) connection string. Use the direct string from section 3 step 8 and retry.
7. A native build workflow stops at a missing-secret step (App Store Connect API key or signing material). The GitHub secret is missing or named differently. The names must match `.github/workflows/README.md` exactly; check for trailing spaces in the secret value when the secret step passes but the upload is still rejected as unauthenticated.
8. The `android` workflow's release APK is unsigned and cannot be uploaded to Play. That is expected: the signing lane is future work (section 9); the job summary lists the signing state per variant.
