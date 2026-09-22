# Services setup

This document walks a developer through creating every external account and credential the AI Stylist monorepo needs, in the order they become necessary. It assumes you have never used any of these services. Follow it top to bottom; each section is self-contained and ends with a check you can run.

It complements the root [`README.md`](../README.md) (local machine setup) and the operating contract in [`CLAUDE.md`](../CLAUDE.md). The vendor choices themselves are ratified in `planning/SPINE.md` §2; do not swap a vendor here, propose an ADR instead.

## The one rule

No secret ever goes into a committed file. Every value you copy from a vendor dashboard goes to exactly one of three places:

| Where                                                           | What goes there                                                                                                                                                      | Who reads it                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `.env` (repo root, gitignored)                                  | Your personal local values. Keys mirror `.env.example`.                                                                                                              | `just` recipes, direnv, the API, the mobile app        |
| `secrets/<env>.enc.yaml` (committed, encrypted with sops + age) | Shared values for `dev`, `staging`, `prod`. `just secrets-sync` decrypts `dev` into your `.env`. `staging`/`prod` are decrypted only by CI.                          | Developers (`dev`), CI deploy jobs (`staging`, `prod`) |
| GitHub repository secrets                                       | Only: the CI age private key, store signing credentials, deploy and build tokens. The exact names are listed per service below and in `.github/workflows/README.md`. | GitHub Actions                                         |

`.env.example` is the exhaustive, zero-value catalogue of keys. `just doctor` fails when your `.env` lacks any key listed there (empty values are fine). If a service produces a key that is not in `.env.example`, the key is added to `.env.example` with the phase that needs it, never invented ad hoc.

If a secret ever shows up in a terminal shared with an AI agent, a log, a screenshot, or a commit, rotate it the same day (`planning/11-security-privacy-and-compliance.md`).

## Overview

Phase numbers refer to `planning/phases/`. "Needed from" is the first task that cannot proceed without the account. Regions for the server, R2, and PostHog are provisional until the OQ-07 data-residency memo lands in P00 (DEC-36; OQ-14 covers the server provider and topology). The self-hosting baseline (pg-boss, owned server + Coolify, self-managed PostgreSQL, R2 delivery model) is ADR-0003, from [r7](../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md).

| #   | Service                                                                 | What it is for                                            | Needed from                | Free tier?                                   | Account owner | Done |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------- | -------------------------------------------- | ------------- | ---- |
| 1   | GitHub repository                                                       | Source, CI (GitHub Actions), branch protection            | P02 now                    | Yes (public repo or personal plan)           | `<owner>`     | [ ]  |
| 2   | sops + age                                                              | Encrypted shared secrets in the repo                      | P02 now                    | Free, no account                             | `<owner>`     | [x]  |
| 3   | PostgreSQL (self-managed, pgvector)                                     | Postgres 17 + pgvector for staging, prod (docker locally) | P02-T07                    | $0 software; host cost in row 4              | `<owner>`     | [ ]  |
| 4   | Server + Coolify                                                        | API, jobs, workers, PostgreSQL hosting                    | P02 (server), P03 (deploy) | Server ~€10–25/month; Coolify $0 self-hosted | `<owner>`     | [ ]  |
| 5   | pg-boss (no account)                                                    | Durable jobs (outbox relay, media pipeline)               | P02-T08                    | $0, MIT, runs on the app database            | n/a           | [ ]  |
| 6   | Cloudflare (R2 + DNS/WAF)                                               | Object storage for media and public assets, DNS, WAF      | P02-T13                    | Yes, 10 GB-month, Checked 2026-09-10         | `<owner>`     | [ ]  |
| 7   | Expo / EAS (removed 2026-09-22)                                         | Nothing: the React Native app and EAS builds are gone     | n/a                        | n/a                                          | n/a           | n/a  |
| 8   | Apple Developer Program                                                 | iOS signing, TestFlight, App Store, Sign in with Apple    | P02-T14                    | No, 99 USD/year, Checked 2026-09-10          | `<owner>`     | [ ]  |
| 9   | Google Play Console                                                     | Android signing and distribution                          | P02-T14                    | No, 25 USD once, Checked 2026-09-10          | `<owner>`     | [ ]  |
| 10  | PostHog                                                                 | Product analytics, replay, error tracking, flags          | P02-T09/P03                | Yes, 1M events/month, Checked 2026-09-10     | `<owner>`     | [ ]  |
| 11  | Grafana Cloud                                                           | OTel traces, metrics, logs                                | P02-T09                    | Yes, Checked 2026-09-10                      | `<owner>`     | [ ]  |
| 12  | RevenueCat                                                              | Subscriptions and entitlements                            | P13                        | Yes, up to $2,500 MTR, Checked 2026-09-10    | `<owner>`     | [ ]  |
| 13  | fal.ai, Open-Meteo, date-holidays (no account), LLM/embedding providers | AI generation, weather, holidays, extraction              | P06 / P08 / P11            | Mixed, see section 13                        | `<owner>`     | [ ]  |
| 14  | Apple and Google sign-in                                                | Social login for better-auth                              | P03                        | Included in 8 and free Google Cloud project  | `<owner>`     | [ ]  |

Replace `<owner>` with a real name once an account exists; keep this table current.

## 1. GitHub repository

### Why we use it

Source control and CI. Every CI job calls a `just` recipe; the workflows live in `.github/workflows/` and are documented in `.github/workflows/README.md`.

### When you need it

Now (P02). The repository is `https://github.com/ArtMin96/ai-stylist` under a personal account, not an organization.

### Cost

Free. GitHub Actions minutes on Linux runners are free for public repositories; private repositories get a monthly included quota that depends on the plan. Verify on <https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions>. The `ios-gha-macos.yml` lane uses macOS runners, which are billed per minute even on paid plans; that lane is dispatch-only until ADR-0002 is decided.

### Steps

1. Confirm Actions are enabled: repository page, **Settings**, **Actions**, **General**. Under "Actions permissions" choose "Allow all actions and reusable workflows" (label may differ). Under "Workflow permissions" choose "Read repository contents and packages permissions"; the workflows declare their own `permissions:` blocks and need nothing more.
2. Replace the placeholder handles in `CODEOWNERS` (`@team`, `@dev-lead`, `@3d-owner`, `@ml-owner`) with real GitHub usernames. GitHub silently ignores unknown owners, so do this before step 3. With a one-person team every handle can be the same username. Commit the change through a normal pull request.
3. Protect `main`: **Settings**, **Branches**, **Add classic branch protection rule** (GitHub also offers **Rulesets** under **Settings**, **Rules**; either works, use one, not both). Branch name pattern: `main`.
4. Tick **Require a pull request before merging**. Tick **Require review from Code Owners** only after step 2 is merged.
5. Tick **Require status checks to pass before merging** and **Require branches to be up to date before merging**. In the search box add these check names exactly as the jobs in `pr-gate.yml` report them: `just ci-parity`, `contracts (generate --check, spectral, oasdiff)`, `gitleaks (PR diff)`, `.env.example covers apps/api env keys`, `clone detection (NFR-TEAM-040)`. The names only appear in the search box after the workflow has run at least once on a pull request, so open a trivial PR first if the list is empty. `ci.pr_gate_duration` is informational; do not require it.
6. Save the rule.
7. Repository secrets live at **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Create them as each later section tells you to. Nothing is needed for `pr-gate.yml`, `affected.yml`, or `nightly.yml` today. `GITLEAKS_LICENSE` is only needed when the repository moves under a GitHub organization; skip it.
8. Turborepo remote cache (optional). `pr-gate.yml` prints "Turborepo remote cache disabled" until `TURBO_TOKEN` and `TURBO_TEAM` exist. Two options: Vercel Remote Cache (free on all Vercel plans, Checked 2026-09-10, <https://turborepo.dev/docs/core-concepts/remote-caching>; create a Vercel account, run `pnpm exec turbo login` then `pnpm exec turbo link` in the repo root, then create a token under the Vercel account settings, **Tokens** (label may differ), and store it as `TURBO_TOKEN` with the Vercel team slug as `TURBO_TEAM`), or a self-hosted cache server (an open-source `turborepo-remote-cache` deployment you run yourself). Recommendation: skip this until `ci.pr_gate_duration_seconds` in the job summary is consistently above the 10 minute budget. Cold CI runs are within budget today.

### What to record

- GitHub secrets: none required today. Optional: `TURBO_TOKEN`, `TURBO_TEAM`, `GITLEAKS_LICENSE` (organization only).
- Repo: `CODEOWNERS` with real handles; `.github/workflows/README.md` "Required secrets" column stays the source of truth for names.

### Do not

- Do not add secrets to workflow YAML or to `.env.example`.
- Do not require the native `android` / iOS build lanes or `nightly` checks on `main`; they are dispatch-only or scheduled.
- Do not change required checks, force-push, or rewrite history without explicit human authorization (`CLAUDE.md` "Prohibited").

### Verify

Open a pull request with any small change. The checks list shows the five `pr-gate` jobs plus `ci.pr_gate_duration`, and the "Merge" button stays disabled until they pass. Locally, `just ci-parity` must be green before you open it.

## 2. sops + age

### Why we use it

Shared secrets are committed to the repo encrypted, one file per environment (`secrets/dev.enc.yaml`, `secrets/staging.enc.yaml`, `secrets/prod.enc.yaml`). sops encrypts values and leaves keys readable, so diffs are reviewable. age is the key type: every developer has one key pair, CI has one. See `secrets/README.md`, `.sops.yaml`, `.envrc`, and `planning/15-team-workflow-and-ai-agent-operations.md` §6.

### When you need it

Now. Every other service in this document stores its values through this mechanism. The initial developer and CI public recipients are listed in `.sops.yaml`, `secrets/dev.enc.yaml` contains every `.env.example` key with an empty value ready to be filled as services are provisioned, and the matching CI private identity is stored in the GitHub repository secret `SOPS_AGE_KEY`. Staging and production files stay absent until those environments exist.

### Cost

Free. No account. `sops` 3.13.3 and `age` 1.3.2 are pinned in `mise.toml` and installed by `./scripts/bootstrap.sh`; the two recipes below run them through `scripts/security/secrets-edit.sh` and `scripts/security/secrets-sync.sh`.

### Steps

Run these in a shell where mise is activated (`eval "$(~/.local/bin/mise activate zsh)"`), or prefix each tool with `~/.local/bin/mise exec --`. `just` recipes need no activation.

1. Run `just bootstrap`. Near the end it generates your age identity if none exists yet, at the resolved path (`SOPS_AGE_KEY` when set — key material in the environment, no file — else `SOPS_AGE_KEY_FILE`, else the default sops looks in on Linux: `$XDG_CONFIG_HOME/sops/age/keys.txt`, falling back to `~/.config/sops/age/keys.txt`, Checked 2026-09-10 at <https://getsops.io/docs/usage/identities/age/>; that order — `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, the default file — is the precedence), mode 600 (directory mode 700); the private key is never printed. It then adds a `# developer: <label>` comment and your `age1...` recipient under the `dev` rule's `# ADD RECIPIENTS` marker in `.sops.yaml`, on a new `onboard/<slug>` branch, pushes it, and prints a compare URL — open that link as your pull request. Running it again once your identity exists and is already listed is a no-op (`age identity present at <path>` then `your age recipient is already listed in .sops.yaml (dev) — nothing to do`). In CI (`CI` set) or when `SOPS_AGE_KEY` is already set, this step is skipped entirely: no key is generated and no branch is created.

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

8. Edit values later with `just secrets-edit` (or `just secrets-edit staging`); commit the encrypted file through a pull request like any other change, then everyone runs `just secrets-sync` again.

9. Onboard another developer: they run `just bootstrap`, which generates their identity, adds their `# developer: <label>` comment and recipient to the `dev` rule of `.sops.yaml` on a new `onboard/<slug>` branch, and prints a compare URL to open a pull request — no manual key exchange needed. Review the diff (it should touch only `.sops.yaml`, adding a label comment and a bare `- age1...` line), then run `just secrets-approve <branch>`: it re-wraps every `secrets/*.enc.yaml` for the new recipient list, commits and pushes onto their branch, and prints the compare URL again. Merge it; the new developer runs `just secrets-sync` (or re-runs `just bootstrap`) to pick up the shared dev values. Only the `dev` rule is automated this way — a deployer who needs `staging` or `prod` access still adds their own recipient under that rule by hand and asks a teammate who can already decrypt to run `just secrets-updatekeys`.

10. `direnv allow` once in the repo root so `.envrc` loads `.env` into every shell (optional; `just` recipes and the db scripts read `.env` themselves).

### What to record

- `.sops.yaml`: one `age1...` public key per developer under the `dev` rule, plus deployers and the CI key under `staging` and `prod`.
- `secrets/dev.enc.yaml` committed; `staging`/`prod` when they exist.
- GitHub secret: `SOPS_AGE_KEY` (the CI private key file contents).
- Password manager: your own private key file.

### Do not

- Do not paste a private key into a chat, a ticket, or a workflow file.
- Do not commit `secrets/*.dec.*` or `.env`; both are gitignored, keep it that way.
- Do not put values into `secrets/*.enc.yaml` that are not keys in `.env.example`; the file must mirror it (`secrets/README.md`). `secrets-edit` seeds exactly that key list.
- Do not share one age key between two people.

### Verify

```bash
just secrets-sync
just doctor
```

Expected: `secrets-sync: merged secrets/dev.enc.yaml into .env — N replaced, M added, K skipped (empty in the shared file), other lines untouched` (preceded by one `replaced KEY` / `added KEY` line per key), then a `✔ .env has every key from .env.example` line, followed by four sops + age checks in the doctor output: `✔ age identity present (<path>, mode 600)`, `✔ age recipient listed in .sops.yaml (dev)`, `✔ secrets/dev.enc.yaml decrypts with your identity`, and `✔ age identity backup recorded (<date>)` (this last line is `⚠ age identity not recorded as backed up` — a warning, never a failure — until you run `just secrets-backup-done`).

## 3. PostgreSQL (self-managed)

### Why we use it

Self-managed PostgreSQL 17 with pgvector on an owned host (DEC-43, ADR-0003, [r7](../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)). The database runs from the same `pgvector/pgvector:pg17` image that `docker-compose.yml` uses locally, so versions match and the repo's migrations create the extension in both places. Running it ourselves brings obligations that a managed vendor used to carry: WAL archiving and point-in-time recovery through pgBackRest, a nightly logical backup, PgBouncer pooling, disk/backup-age alerts in Grafana, and a quarterly restore drill (RISK-17).

### When you need it

P02-T07 (the staging database, its backup pipeline, and the ephemeral test databases are the `PARTIAL` remainder of that task) and P02-T08 onward. The database lives on the server from section 4, so its region follows OQ-07 / OQ-14; expect to rebuild it from a backup if the residency memo says otherwise.

### Cost

$0 for software: PostgreSQL, pgvector, pgBackRest, and PgBouncer are all open source (pgBackRest, Checked 2026-09-13 at <https://pgbackrest.org>). The host cost is in section 4. Backup storage is a dedicated R2 bucket (section 6), inside the free tier at launch.

### Steps

1. Provision on the server from section 4, on the private Docker network: either Coolify's built-in PostgreSQL service with the image set to `pgvector/pgvector:pg17`, or a `docker compose` stack that Coolify manages. Put the data directory on the encrypted disk. Publish no port; the API, the jobs process, and the workers reach it over the private network only, with TLS enabled on the server.
2. Enable pgvector once per database (`CREATE EXTENSION IF NOT EXISTS vector;`); the committed migrations also do this, matching local.
3. Create the `staging` database and its application role now (least privilege, own password); create the `production` database and role only when P03 deploys production. Keep one superuser for provisioning and backups, never for the API.
4. PgBouncer (transaction pooling) in front of the database for the running API; `just db-migrate` uses the direct connection, because transaction pooling does not support everything migration tools need.
5. pgBackRest WAL archiving: create a dedicated R2 bucket `ai-stylist-pg-backups` with its own token scoped to that bucket only (section 6 step 5 pattern, **Object Read & Write**, never the media token). Configure a pgBackRest stanza `ai-stylist` with the S3 repository type pointed at the R2 endpoint, repository encryption on (`repo1-cipher-type`), `archive_mode=on`, and `archive_command` delegated to `pgbackrest archive-push`. Take the first full backup, then schedule a daily differential and a weekly full backup with a retention that keeps at least two full backups.
6. Nightly `pg_dump` logical backup of each database to the same bucket under a separate prefix, kept for 30 days. It is the fallback when a PITR restore is not possible and the input for the scratch-database migration test.
7. Grafana alerts (section 11): backup age above 26 hours, WAL archive push failures, disk usage above 80%, and replication lag once a replica exists.
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

The account and the empty server: now, so the region is settled together with R2 per OQ-07 / OQ-14 and the database in section 3 has somewhere to live. The first deploy: P03 (there is no `apps/api/Dockerfile` yet; it lands with the first deploy task, together with the Coolify sync script and the deploy workflow).

### Cost

One owned server in the ~€10–25/month class (Hetzner is the working assumption per OQ-14, not a decision; verify current prices on the chosen provider's page before ordering). Coolify is $0 self-hosted (Checked 2026-09-13 at <https://coolify.io/docs/core/what-is-coolify>). Coolify Cloud is an optional paid managed control plane and is not used.

### Steps

1. Choose the provider and region per OQ-07 / OQ-14 and record both in the overview table notes.
2. Provision an Ubuntu LTS host (4 GB RAM and 80 GB disk are enough for staging plus a first production; a dedicated database host comes later when load justifies it). Enable disk encryption at creation (provider-side or LUKS); it is the at-rest encryption for the database and for uploaded media caches.
3. Harden before anything else runs: SSH keys only (`PasswordAuthentication no`), a non-root sudo user, `ufw` default deny with 22, 80, and 443 open, unattended upgrades enabled. Record the SSH public key fingerprint in the password manager, not in the repo.
4. Install Coolify with the official installation script from its docs (read the script first; do not run install scripts from any other source). Open the dashboard, create the admin account, and disable public registration.
5. Create the project `ai-stylist` with environments `staging` and `production`. Each environment gets its own variables and its own deploy later.
6. Networking: keep the API, jobs, workers, and PostgreSQL resources on one private Docker network per environment; only the API and, later, the workers' health endpoint are published through Coolify's proxy with HTTPS. PostgreSQL is never published.
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

Over SSH, `docker ps` lists the Coolify containers and nothing else; `ufw status` shows only 22, 80, and 443 open. The dashboard shows project `ai-stylist` with environments `staging` and `production` and zero resources. After P03 lands `apps/api/Dockerfile`, `curl https://<api domain>/v1/health` should return `{"status":"ok","checks":{"db":"ok"}}`.

## 5. pg-boss (durable jobs)

### Why we use it

Durable job pipelines with retries and backoff, dead-letter handling, scheduling, and priorities, on the app's own PostgreSQL instead of a separate queue service (DEC-41, ADR-0003, [r7](../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)). pg-boss v12 is MIT (Checked 2026-09-13 at <https://github.com/timgit/pg-boss>). Job definitions live in `apps/api/src/jobs/`; the API's outbox relay (P02-T08) hands events to pg-boss jobs, and the handlers run in the API process or in a dedicated `jobs` process. There is no dev server and no dashboard to sign up for.

### When you need it

P02-T08. `just dev-workers` runs the handlers in-process from T08 on.

### Cost

$0. No account.

### Steps

None beyond adding the `pg-boss` dependency and letting it create its `pgboss` schema in the app database (`DATABASE_URL`). Locally that is the docker compose Postgres; in staging and production it is the database from section 3, so it is covered by the same backups and alerts.

### What to record

Nothing. No keys, no dashboard, no GitHub secrets.

### Do not

- Do not run a second queue service until the P02-T08 acceptance suite (kill/retry, idempotency, DLQ, replay, per-user cancellation, deletion/export scenarios) proves pg-boss insufficient; the fallback is then the self-hosted queue service recorded in DEC-41, adopted only through an ADR, not a quiet swap.
- Do not put business logic into job handlers; they are adapters (`CLAUDE.md` invariants).

### Verify

Until T08 lands: `just doctor` reports `✔ .env has every key from .env.example`. After T08: the T08 acceptance suite is green (`just test platform`) and `just dev-workers` runs the handlers in-process against the local database.

## 6. Cloudflare (R2, DNS/WAF)

### Why we use it

R2 is the object store for user media and for public app assets (zero egress fees, `SPINE.md` §2; DEC-44), behind the `StorageProvider` port in `apps/api/src/platform/`. DNS and the WAF sit in front of the API when it has a public hostname. Delivery model (DEC-44): private user media is served by presigned GET on the S3 endpoint, uncached, TTL at most 10 minutes; only public app and content assets (3D bundles, avatar/garment manifests, app content) go through an R2 custom domain with the Cloudflare cache. Fixed derivatives (cutout, two or three thumbnail sizes, palette swatch) are produced once by the media workers and stored in R2; there is no on-the-fly image transform service.

### When you need it

R2 bucket and token: P02-T13 (signed-URL skeleton). Custom domain for the public assets bucket: P04 (3D bundles) or P06 (closet derivatives), whichever ships first. WAF and DNS: when the API gets a domain in P03. Region ("location hint" or jurisdiction) is provisional per OQ-07.

### Cost

R2, Checked 2026-09-10 at <https://developers.cloudflare.com/r2/pricing/>: free tier 10 GB-month storage, 1 million Class A operations and 10 million Class B operations per month, egress free. DNS and the managed WAF rules used here are on the free plan. Enabling R2 may ask for a payment method; verify at signup.

### Steps

1. Sign up at <https://dash.cloudflare.com/sign-up>. One account for the project, owned by `<owner>`.
2. Left menu, **R2 object storage**. Enable it if asked (this is where a payment method may be requested).
3. **Create bucket**. Name: `ai-stylist-dev`. Location: **Automatic**, or a specific jurisdiction (for example **EU**) if OQ-07 requires it; note that a jurisdiction changes the S3 endpoint hostname. Leave default storage class (Standard; the free tier applies only to Standard). Repeat for `ai-stylist-staging` and, in P03, `ai-stylist-prod`.
4. Copy the account id: R2 overview page, **Account details** panel, **Account ID**. Store it as `R2_ACCOUNT_ID`.
5. Create a token: R2 overview, **Account details**, **Manage** next to **API Tokens**, **Create Account API token** (an account token outlives any one person; do not use "Create User API token"). Name `ai-stylist-dev`. Permissions: **Object Read & Write**. Under "Specify bucket(s)" choose only `ai-stylist-dev`. TTL: leave unlimited or set a rotation date. Create.
6. The next screen shows **Access Key ID** and **Secret Access Key** once. Copy them into `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. The S3 endpoint is `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (or the jurisdiction variant shown on that screen); the adapter builds it from `R2_ACCOUNT_ID`, so it is not a separate key.
7. Set `R2_BUCKET=ai-stylist-dev`. Leave `R2_PUBLIC_BASE_URL` empty locally; it is set when a custom domain is attached to the public assets bucket (step 9), which is not needed before P04/P06.
8. Repeat steps 5 and 6 with a separate token per environment (`ai-stylist-staging`, `ai-stylist-prod`), each scoped to its own bucket, into the matching `secrets/<env>.enc.yaml`.
9. Custom domain for public assets (P04/P06): create a separate bucket `ai-stylist-assets-<env>` for public app and content assets only, then bucket, **Settings**, **Public access**, **Custom domains**, connect a hostname on the project's Cloudflare zone and set `R2_PUBLIC_BASE_URL` to it in the matching `secrets/<env>.enc.yaml`. The Cloudflare cache in front of that hostname is the only CDN in the design. User media buckets never get a custom domain or `r2.dev` access; they are read through presigned GETs only. A separate backup bucket with its own token is created in section 3 step 5.
10. WAF (P03 or later): add the API domain to Cloudflare DNS, proxy it (orange cloud), then **Security**, **WAF** managed rules. Rate limits inside the API (`RATE_LIMIT_*`) stay on regardless; never disable one to make the other work.

### What to record

- `.env.example` keys: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` (one set per environment).
- Overview table: bucket names (media, public assets, backups), jurisdiction chosen.

### Do not

- Do not create one token with **Admin Read & Write** and reuse it across environments.
- Do not make a user media bucket public in any environment; only the dedicated public assets bucket gets a custom domain.
- Do not upload real user photos to any bucket; test data is synthetic.

### Verify

No repo command exists until P02-T13 lands the adapter and its `*.sec.test.ts` suite; then `just test platform` exercises presigned PUT/GET against the configured bucket. Until then, `just doctor` confirms the keys are present in `.env`, and the bucket page in the dashboard lists `ai-stylist-dev` with zero objects.

## 7. Expo / EAS (removed)

The React Native / Expo app and its EAS build and submit lanes were removed on 2026-09-22; the native
iOS app builds with Xcode and the native Android app with Gradle, so no Expo account is needed. The
section number is kept so references to sections 8 and 9 stay valid.

If an Expo account or project was already created, a human cleans up:

- delete the GitHub secret `EXPO_TOKEN`;
- remove `EXPO_PUBLIC_EAS_PROJECT_ID` and `EXPO_PUBLIC_API_BASE_URL` from `secrets/dev.enc.yaml` with
  `just secrets-edit dev` (they are no longer in `.env.example`);
- optionally delete the Expo project and any robot-user access token on <https://expo.dev>.

## 8. Apple Developer Program and App Store Connect

### Why we use it

iOS code signing, TestFlight, App Store distribution, and Sign in with Apple. Today `.github/workflows/ios.yml` builds unsigned simulator builds only and needs no secret; the signing + TestFlight upload lane is future work a human approves and runs, and it will read the App Store Connect API key and signing material from the GitHub secrets below.

### When you need it

P02-T14. Apple's approval can take days, so enroll at phase start (`P02` §3).

### Cost

99 USD per membership year (Checked 2026-09-10, <https://developer.apple.com/programs/whats-included/>). Enrollment needs an Apple Account with two-factor authentication. Individuals enroll with their legal name; organizations need a legal entity, a D-U-N-S Number, a domain-matching work email and a public website (Checked 2026-09-10, <https://developer.apple.com/programs/enroll/>). Decide individual vs organization before enrolling; the seller name shown on the App Store follows from it.

Since 2026-04-28 Apple requires uploads to be built with Xcode 26 or later using the iOS 26 SDK (Checked 2026-09-10, <https://developer.apple.com/news/upcoming-requirements/>). The iOS lane pins Xcode 27 (`apps/ios/.xcode-version`, the `xcode-27` runner image in `ios.yml`), which satisfies this.

### Steps

1. Enroll at <https://developer.apple.com/programs/enroll/>. Wait for the confirmation email before continuing; App Store Connect stays empty until then.
2. Decide the bundle identifier. The native apps use the placeholder `app.aistylist.mobile` as both the iOS bundle identifier and the Android `applicationId` for prod, with `.dev` and `.preview` suffixes for the other environments (set in `apps/ios/Config/*.xcconfig` and `apps/android/app/build.gradle.kts`); it must be replaced by a final reverse-domain id that you own before the first signed build, because Apple ties it to the App ID and it cannot change later. Change it through a pull request (both apps and the Maestro `APP_ID` values in the `just` e2e recipes).
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

P02-T14 (the release build stays unsigned until the signing lane exists).

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

Product analytics, session replay, error tracking, and feature flags (`SPINE.md` §2). The native apps have an analytics port with a consent stub whose sink is a no-op; the consent default is OFF, so nothing is sent until P03 wires the consent-gated SDK.

### When you need it

P02-T09 (server-side error tracking wiring can start) and P03 (consent-gated mobile events, deletion-API adapter in `platform`).

### Cost

Free tier, Checked 2026-09-10 at <https://posthog.com/pricing>: 1M events, 5K session recordings, 100K exceptions, 1M feature flag requests per month; no credit card required. PostHog Cloud offers US and EU regions; the EU region is the natural pick if OQ-07 lands on EU residency (verify the region list on the signup page).

### Steps

1. Sign up at <https://posthog.com/signup>. Choose the cloud region (provisional per OQ-07; the host differs per region: `https://us.i.posthog.com` or `https://eu.i.posthog.com`).
2. Create an organization `ai-stylist` and a project `ai-stylist-dev`. Add `ai-stylist-prod` in P03.
3. **Settings**, **Project**, **Project API key** (label may differ). This key is public-ish (it is embedded in clients) but still stays out of committed files. Store it as `POSTHOG_API_KEY` and the region host as `POSTHOG_HOST`, in `secrets/dev.enc.yaml`. Leave both empty in your personal `.env` if you want to be sure the stub sends nothing locally.
4. A **Personal API key** (account settings) is needed later by the deletion adapter in P03; that task adds its key name to `.env.example`.

### What to record

- `.env.example` keys: `POSTHOG_API_KEY`, `POSTHOG_HOST`.

### Do not

- Do not call PostHog from anywhere except the analytics port; consent gating is a legal requirement (`planning/11`).
- Do not enable session replay on screens that show measurements, selfies, or photos; that is a P03 review item.

### Verify

`just doctor` shows `✔ .env has every key from .env.example`. Nothing else is observable yet: with the consent stub OFF, the PostHog **Activity** page must stay empty even after running the app. An event appearing there before P03 is a bug.

## 11. Grafana Cloud

### Why we use it

OpenTelemetry backend for traces, metrics, and logs (doc 14; ADR-OBS-01 is written in P02-T09). The API and workers export OTLP to it; the free tier is expected to cover launch.

### When you need it

P02-T09.

### Cost

Free tier, Checked 2026-09-10 at <https://grafana.com/pricing/>: 10k active metric series, 50 GB logs, 50 GB traces, 50 GB profiles per month, 14 day retention, 3 active users; no credit card required.

### Steps

1. Sign up at <https://grafana.com/auth/sign-up/create-user>. Create a stack named `ai-stylist`; choose the region closest to the server's (section 4; provisional per OQ-07).
2. Grafana Cloud portal, your organization **Overview**, select the stack, then **Configure** on the **OpenTelemetry** tile (Checked 2026-09-10, <https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/>).
3. Follow that page to generate an API token (name `api-dev`, role write). It shows ready-made environment variables: `OTEL_EXPORTER_OTLP_ENDPOINT` (`https://otlp-gateway-<region>.grafana.net/otlp`) and `OTEL_EXPORTER_OTLP_HEADERS` (`Authorization=Basic <base64 of instanceId:token>`). Copy both exactly as shown.
4. Store them in `secrets/dev.enc.yaml` and `.env` under the same names. Set `OTEL_SERVICE_NAME=api` for the API and `workers-ml` for the workers (the workers get their own env in their compose/Coolify config).
5. Generate a separate token per environment (`api-staging`, `api-prod`) into the matching `secrets/<env>.enc.yaml` so one can be revoked without touching the others.

### What to record

- `.env.example` keys: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`.

### Do not

- Do not log request bodies or any sensitive field to Loki; the redaction allowlist from T09 applies to OTel attributes too.
- Do not share the token between environments.

### Verify

Until T09 wires the exporter, test the credentials directly. Take the base64 part after `Authorization=Basic ` from `OTEL_EXPORTER_OTLP_HEADERS`:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -H 'Authorization: Basic <base64>' \
  -d '{"resourceSpans":[]}' "$OTEL_EXPORTER_OTLP_ENDPOINT/v1/traces"
```

Expected: `200`. A `401` means the header or token is wrong. After T09, `just dev-api` followed by `curl localhost:3000/v1/health` produces a trace visible under **Explore**, **Tempo** in the stack.

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

- Where it comes from: Google Cloud Console (<https://console.cloud.google.com>), create project `ai-stylist`, **APIs & Services**, **OAuth consent screen** (fill app name, support email, privacy policy URL; label may differ), then **Credentials**, **Create credentials**, **OAuth client ID**. Create three clients: **Android** (package name from `app.config.ts` plus the SHA-1 of the upload certificate from section 9 and of the Play app-signing certificate), **iOS** (bundle id), and **Web application** (used by the API for token verification).
- Record: `GOOGLE_SIGNIN_CLIENT_ID` = the Web client id (server verifies ID tokens against it). The mobile clients are configured in the app in P03.
- Do not: put the client secret of the web client anywhere client-side; the mobile flow does not use it.

### Verify

Deferred to P03: `just test identity` runs the better-auth provider fixtures.

## Checklist by phase

| Phase     | Do now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P02 (now) | 1 GitHub (CODEOWNERS, branch protection, Actions). 2 sops + age (keys, `.sops.yaml`, `secrets/dev.enc.yaml`, `SOPS_AGE_KEY`). 3 PostgreSQL on the server: databases, PgBouncer, pgBackRest to the backup bucket (T07). 4 Server + Coolify: host, hardening, project + environments. 5 pg-boss: nothing to provision (T08). 6 R2 dev bucket + token (T13). 8 Apple enrollment + ASC API key (T14). 9 Play Console + keystore secrets (T14). 10 PostHog project (T09). 11 Grafana Cloud stack + OTel vars (T09). Request Apple and Google approvals first; they take days. |
| P03       | Coolify first deploy (Dockerfile, `COOLIFY_TOKEN`, sync script), production database + role, `secrets/staging.enc.yaml` and `secrets/prod.enc.yaml`, Cloudflare DNS + WAF for the API domain, PostHog prod project + personal API key, 14 Apple and Google sign-in credentials.                                                                                                                                                                                                                                                                                          |
| P06       | fal.ai key + spend limit, vision-LLM and embedding provider accounts (privacy review first), GPU eval host for the self-hosted eval arms, R2 public assets custom domain (if not done in P04), R2 multipart upload settings.                                                                                                                                                                                                                                                                                                                                             |
| P08       | Open-Meteo Standard plan + key; run the weather comparison (Open-Meteo managed vs self-hosted vs WeatherKit); holidays need nothing (embedded `date-holidays`).                                                                                                                                                                                                                                                                                                                                                                                                          |
| P11       | fal.ai production key, AIC-O2 review passed, Replicate fallback account, per-provider spend caps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P13       | 12 RevenueCat project, store connections, webhook secret, `REVENUECAT_*` in `secrets/prod.enc.yaml`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| P14       | Rotate every credential created during development that was ever pasted into a shared terminal; confirm each `secrets/prod.enc.yaml` value is production-scoped; restore drill via pgBackRest into a scratch database (section 3 step 9); Play closed-testing requirement; App Store review assets.                                                                                                                                                                                                                                                                      |

## When something goes wrong

1. `just secrets-sync` reports `no age recipients in .sops.yaml`. Finish section 2 step 3 for the environment named in the error, then retry. If it reports that `secrets/<env>.enc.yaml` does not exist, create that encrypted file with `just secrets-edit <env>` as described in section 2 step 5.
2. `sops` says `no key could decrypt the data` or `failed to get the data key`. Your public key is not in the file's recipient list, or your private key is not at `~/.config/sops/age/keys.txt`. Ask a developer who can decrypt to add your key to `.sops.yaml` and run `just secrets-updatekeys`. Check `SOPS_AGE_KEY_FILE` if you keep the key elsewhere.
3. `just doctor` reports `.env missing N key(s)`. Someone added keys to `.env.example`. Copy the missing lines from `.env.example` into `.env` (values stay empty) or re-run `just secrets-sync` after the shared file is updated.
4. `just db-migrate` against the staging PostgreSQL fails with a `SET` or `prepared statement` error. You used the pooled (PgBouncer) connection string. Use the direct string from section 3 step 8 and retry.
5. A native build workflow stops at a missing-secret step (App Store Connect API key or signing material). The GitHub secret is missing or named differently. The names must match `.github/workflows/README.md` exactly; check for trailing spaces in the secret value when the secret step passes but the upload is still rejected as unauthenticated.
6. The `android` workflow's release APK is unsigned and cannot be uploaded to Play. That is expected: the signing lane is future work (section 9); the job summary lists the signing state per variant.
