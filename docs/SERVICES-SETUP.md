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

Phase numbers refer to `planning/phases/`. "Needed from" is the first task that cannot proceed without the account. Regions for Neon, R2, Railway, and PostHog are provisional until the OQ-07 data-residency memo lands in P00 (DEC-36).

| #   | Service                                                 | What it is for                                         | Needed from     | Free tier?                                  | Account owner | Done |
| --- | ------------------------------------------------------- | ------------------------------------------------------ | --------------- | ------------------------------------------- | ------------- | ---- |
| 1   | GitHub repository                                       | Source, CI (GitHub Actions), branch protection         | P02 now         | Yes (public repo or personal plan)          | `<owner>`     | [ ]  |
| 2   | sops + age                                              | Encrypted shared secrets in the repo                   | P02 now         | Free, no account                            | `<owner>`     | [ ]  |
| 3   | Neon                                                    | Postgres 17 + pgvector for dev, staging, prod          | P02-T07         | Yes, Checked 2026-09-10                     | `<owner>`     | [ ]  |
| 4   | Railway                                                 | API + workers hosting                                  | P03 (deploy)    | $1/month credit on Free, Checked 2026-09-10 | `<owner>`     | [ ]  |
| 5   | Trigger.dev                                             | Durable jobs (outbox relay, media pipeline)            | P02-T08         | Yes, $5/month credit, Checked 2026-09-10    | `<owner>`     | [ ]  |
| 6   | Cloudflare (R2, Images, WAF)                            | Object storage for media, later transforms and WAF     | P02-T13         | Yes, 10 GB-month, Checked 2026-09-10        | `<owner>`     | [ ]  |
| 7   | Expo / EAS                                              | Cloud builds for iOS and Android                       | P02-T14         | 15 + 15 builds/month, Checked 2026-09-10    | `<owner>`     | [ ]  |
| 8   | Apple Developer Program                                 | iOS signing, TestFlight, App Store, Sign in with Apple | P02-T14         | No, 99 USD/year, Checked 2026-09-10         | `<owner>`     | [ ]  |
| 9   | Google Play Console                                     | Android signing and distribution                       | P02-T14         | No, 25 USD once, Checked 2026-09-10         | `<owner>`     | [ ]  |
| 10  | PostHog                                                 | Product analytics, replay, error tracking, flags       | P02-T09/P03     | Yes, 1M events/month, Checked 2026-09-10    | `<owner>`     | [ ]  |
| 11  | Grafana Cloud                                           | OTel traces, metrics, logs                             | P02-T09         | Yes, Checked 2026-09-10                     | `<owner>`     | [ ]  |
| 12  | RevenueCat                                              | Subscriptions and entitlements                         | P13             | Yes, up to $2,500 MTR, Checked 2026-09-10   | `<owner>`     | [ ]  |
| 13  | fal.ai, Open-Meteo, Nager.Date, LLM/embedding providers | AI generation, weather, holidays, extraction           | P06 / P08 / P11 | Mixed, see section 13                       | `<owner>`     | [ ]  |
| 14  | Apple and Google sign-in                                | Social login for better-auth                           | P03             | Included in 8 and free Google Cloud project | `<owner>`     | [ ]  |

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
- Do not require `ios-eas`, `ios-gha-macos`, `android`, or `nightly` checks on `main`; they are dispatch-only or scheduled.
- Do not change required checks, force-push, or rewrite history without explicit human authorization (`CLAUDE.md` "Prohibited").

### Verify

Open a pull request with any small change. The checks list shows the five `pr-gate` jobs plus `ci.pr_gate_duration`, and the "Merge" button stays disabled until they pass. Locally, `just ci-parity` must be green before you open it.

## 2. sops + age

### Why we use it

Shared secrets are committed to the repo encrypted, one file per environment (`secrets/dev.enc.yaml`, `secrets/staging.enc.yaml`, `secrets/prod.enc.yaml`). sops encrypts values and leaves keys readable, so diffs are reviewable. age is the key type: every developer has one key pair, CI has one. See `secrets/README.md`, `.sops.yaml`, `.envrc`, and `planning/15-team-workflow-and-ai-agent-operations.md` §6.

### When you need it

Now. Every other service in this document stores its values through this mechanism. Status today: `.sops.yaml` lists no recipients (each environment has an `# ADD RECIPIENTS` marker) and `secrets/` has no encrypted files. Until step 3 below is done, `just secrets-sync` and `just secrets-edit` exit 1 with `no age recipients in .sops.yaml for secrets/dev.enc.yaml — follow docs/SERVICES-SETUP.md §2`.

### Cost

Free. No account. `sops` 3.13.3 and `age` 1.3.2 are pinned in `mise.toml` and installed by `./scripts/bootstrap.sh`; the two recipes below run them through `scripts/security/secrets-edit.sh` and `scripts/security/secrets-sync.sh`.

### Steps

Run these in a shell where mise is activated (`eval "$(~/.local/bin/mise activate zsh)"`), or prefix each tool with `~/.local/bin/mise exec --`. `just` recipes need no activation.

1. Generate your key. The path is the default sops looks in on Linux (`$XDG_CONFIG_HOME/sops/age/keys.txt`, falling back to `~/.config/sops/age/keys.txt`, Checked 2026-09-10 at <https://getsops.io/docs/usage/identities/age/>); the scripts also honor `SOPS_AGE_KEY_FILE` and `SOPS_AGE_KEY` (in that order of precedence: `SOPS_AGE_KEY`, `SOPS_AGE_KEY_FILE`, the default file):

   ```bash
   mkdir -p ~/.config/sops/age
   age-keygen -o ~/.config/sops/age/keys.txt
   chmod 600 ~/.config/sops/age/keys.txt
   ```

   The command prints `Public key: age1<...>`. Copy that line. The file itself contains the private key (`AGE-SECRET-KEY-1<...>`); the repo's gitleaks rule blocks that string from ever being committed.

2. Back up the private key file somewhere outside the repo (a password manager entry). Losing it means you cannot decrypt anything encrypted for you.

3. Edit `.sops.yaml`. Under the `# ADD RECIPIENTS` comment of the `dev` rule add one line `- age1<your public key>` (same indentation as the comment). Deployers add theirs under `staging` and `prod` too. Each later developer adds their own line the same way; the comment stays as the marker. Public keys are not secrets (`.gitleaks.toml` allowlists them in this file).

4. Generate the CI key the same way, into a temporary file, and treat it as a service credential:

   ```bash
   age-keygen -o "$(mktemp -d)/ci.txt"
   ```

   Add its `Public key:` line under `# ADD RECIPIENTS` in all three rules. Copy the whole contents of the file into a GitHub repository secret named `SOPS_AGE_KEY` (no workflow reads it yet; the deploy jobs added in P03 export it as the `SOPS_AGE_KEY` environment variable that sops and `scripts/security/secrets-sync.sh` honor). Then delete the temporary file.

5. Create the first encrypted file:

   ```bash
   just secrets-edit            # same as: just secrets-edit env=dev
   ```

   On the first run for an environment this creates `secrets/dev.enc.yaml` with every key from `.env.example` and an empty value (`KEY: ""`), encrypted for the `dev` recipients, and opens it in `$EDITOR` through `sops`. Fill in the shared dev values (`KEY: value`), leave unknown ones empty, save and quit; sops re-encrypts on save (`File has not changed, exiting.` means you quit without editing, which is fine). No plaintext file ever lands in the repo: the template is built in a private temp dir and encrypted before it is moved into `secrets/`.

6. Repeat step 5 with `env=staging` / `env=prod` when those environments exist (Neon staging branch, Railway environments). Until then leave them absent.

7. Merge into your `.env`:

   ```bash
   just secrets-sync            # same as: just secrets-sync dev
   ```

   This decrypts `secrets/dev.enc.yaml` to a private temp file and merges it into `.env`: every key with a non-empty shared value replaces its `KEY=...` line (or is appended if missing); keys whose shared value is empty are skipped; every other line is kept verbatim, so personal overrides such as `POSTGRES_HOST_PORT` or `EXPO_PUBLIC_API_BASE_URL` survive as long as the shared file leaves them empty. If `.env` does not exist it is created from `.env.example` first. The output lists the key names that were replaced or added and a count; it never prints a value, and `.env` ends up with mode 600. `.envrc` (`dotenv_if_exists .env`) keeps working unchanged.

   `just secrets-sync staging` and `just secrets-sync prod` refuse to run on a workstation; CI sets `CI=true`, and a human who really needs it locally passes `--i-know-this-is-not-dev`.

8. Edit values later with `just secrets-edit` (or `just secrets-edit env=staging`); commit the encrypted file through a pull request like any other change, then everyone runs `just secrets-sync` again.

9. Onboard another developer: they run step 1, send you the public key, you add it to `.sops.yaml` (step 3), then run `for f in secrets/*.enc.yaml; do sops updatekeys "$f"; done` and commit. `updatekeys` re-wraps the data key for the new recipient list without changing the values.

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

Expected: `secrets-sync: merged secrets/dev.enc.yaml into .env — N replaced, M added, K skipped (empty in the shared file), other lines untouched` (preceded by one `replaced KEY` / `added KEY` line per key), then a `✔ .env has every key from .env.example` line in the doctor output.

## 3. Neon

### Why we use it

Serverless Postgres with scale-to-zero and branching (`SPINE.md` §2). pgvector is available as an extension on every Neon project; the repo's migrations create it. Locally, `docker-compose.yml` runs `pgvector/pgvector:pg17`, so the Neon project must be Postgres 17 to match.

### When you need it

P02-T07 (Neon envs and PR branches are the `PARTIAL` remainder of that task) and P02-T08 onward. Region choice is provisional until OQ-07 (P00-T06); pick one now and record it, expect to recreate the project if the memo says otherwise.

### Cost

Free plan, Checked 2026-09-10 at <https://neon.com/docs/introduction/plans>: 100 projects, 10 branches per project, 0.5 GB storage per project, 100 compute-unit hours per project per month, autoscaling up to 2 CU. Neon supports Postgres 14 through 18 (Checked 2026-09-10, <https://neon.com/docs/postgresql/postgres-version-policy>). The docs do not state whether a credit card is needed for the free plan; expect none. Paid plans: verify on <https://neon.com/pricing>.

### Steps

1. Sign up at <https://neon.com> (GitHub login is simplest; the account should belong to the account owner, not a personal email that could leave the project).
2. Create a project: name `ai-stylist`, Postgres version **17**, region: the one closest to the launch market pending OQ-07 (write the choice into the overview table's notes). Leave the default compute size.
3. The project comes with a `main` branch and a database named `neondb` by default (label may differ). Until launch, `main` is the **staging** environment. Create a second branch only when P03 deploys production; name it `production` then and never point staging tooling at it.
4. Get connection strings: project dashboard, **Connect** button. The modal has a **Connection pooling** toggle. Copy two strings:
   - Toggle off: the **direct** string, host `ep-<...>.<region>.aws.neon.tech`. Use this for migrations; transaction pooling does not support everything migration tools need.
   - Toggle on: the **pooled** string, host `ep-<...>-pooler.<region>.aws.neon.tech`. Use this for the running API.
5. Store the direct string as `DATABASE_URL` in `secrets/staging.enc.yaml` (create the file per section 2 step 5). Your local `.env` keeps the docker value from `.env.example`; only put the Neon string in `.env` temporarily when you run the verify step below.
6. API key for CI branch-per-PR: account menu, **Account settings**, **API keys** (label may differ), **Create new API key**, name `github-actions`. Copy it once. Store it as GitHub secret `NEON_API_KEY`. Copy the project id from **Project settings**, **General** (label may differ) into GitHub secret `NEON_PROJECT_ID`. `affected.yml` has the branch-per-PR steps commented out and will use both when T07 is finished; nothing runs until then.

### What to record

- `.env.example` keys: `DATABASE_URL` (staging: `secrets/staging.enc.yaml`; local: docker value), `NEON_API_KEY` and `NEON_PROJECT_ID` (GitHub secrets only, CI).
- Overview table: region chosen and the date.

### Do not

- Do not run `just db-reset` against Neon; it refuses non-local hosts by design, do not work around it.
- Do not use the pooled string for `just db-migrate`.
- Do not create the `production` branch before P03 needs it.
- Do not put the Neon string into `.env.example` or into the mobile app (`EXPO_PUBLIC_*`).

### Verify

```bash
DATABASE_URL='<direct connection string>' just db-migrate
```

Expected last line: `db-migrate: up to date`. This applies the committed migrations from `packages/db/migrations` to the Neon `main` branch, which is the intended state for staging. A `password authentication failed` or `ENOTFOUND` error means the string was pasted wrong; copy it again from **Connect**.

## 4. Railway

### Why we use it

Hosts the NestJS API and the Python workers as containers (`SPINE.md` §2, about $15/month at launch was the planning estimate; not verified against a real bill). Production secrets are pushed from `secrets/prod.enc.yaml` into Railway variables by a sync script (doc 15 §6); the dashboard is never hand-edited.

### When you need it

The account and empty project: now, so the region is settled together with Neon and R2. The first deploy: P03 (there is no `apps/api/Dockerfile` yet; it lands with the first deploy task, together with the Railway sync script and the deploy workflow).

### Cost

Checked 2026-09-10 at <https://docs.railway.com/reference/pricing/plans>: Free plan $0 with $1 of credit per month (1 replica, 0.5 GB RAM, 1 vCPU per service); Trial gives a one-time $5 grant; Hobby $5/month; Pro $20/month. Railway requires a post-paid card for paid plans. Plan to move to Hobby before the first staging deploy; the Free allowance will not run an API continuously.

### Steps

1. Sign up at <https://railway.com> with GitHub.
2. **New Project**, choose **Empty project**. Do not choose "GitHub repo": there is nothing to build yet, and connecting the repo now would create failing deployments on every push.
3. Rename the project to `ai-stylist`: **Project Settings** (gear icon), **General**, name field (label may differ).
4. Environments: **Project Settings**, **Environments**. Rename the default environment to `staging` and add `production`. Each gets its own variables and its own deploy later.
5. Region: Railway sets the region per service, not per project (**US West Metal**, **US East Metal**, **EU West Metal**, **Southeast Asia Metal**, Checked 2026-09-10 at <https://docs.railway.com/reference/deployment-regions>). There is no service yet, so record the intended region in the overview notes and set it when the first service is created in P03, in the same region family as Neon.
6. No API token is needed now. When the deploy workflow lands in P03 it will need a Railway project token stored as a GitHub secret; that task adds the key name to `.github/workflows/README.md`.

### What to record

- Nothing in `.env.example` yet. `PORT` is set by Railway at runtime and already listed there.
- Overview table: project name, environments, intended region.

### Do not

- Do not connect the GitHub repository or enable automatic deploys in P02.
- Do not type secrets into Railway variables by hand; the sync script is the only writer.
- Do not add a Railway-managed Postgres; the database is Neon.

### Verify

No repo command exists yet. Verify in the dashboard: project `ai-stylist` shows environments `staging` and `production` and zero services. After P03 lands `apps/api/Dockerfile`, `curl <railway url>/v1/health` should return `{"status":"ok","checks":{"db":"ok"}}`.

## 5. Trigger.dev

### Why we use it

Durable job pipelines with retries, idempotency keys, and dead-letter semantics (`SPINE.md` §2). Task definitions live in `apps/api/src/trigger/`. The API's outbox relay (P02-T08) hands events to Trigger.dev tasks; the worker round-trip test depends on it.

### When you need it

P02-T08. `just dev-workers` currently notes that the Trigger.dev dev-server half lands in T08.

### Cost

Trigger.dev Cloud, Checked 2026-09-10 at <https://trigger.dev/pricing>: Free plan $0 with $5/month of credits, 20 concurrent runs, 5 team members, 10 schedules, 1 day log retention; runs in the `dev` environment are not charged. Hobby $10/month, Pro $50/month. Self-hosting exists (a webapp container bundling the dashboard, Postgres and Redis, plus a worker container with the supervisor and runners, and the object storage and registry those need; Checked 2026-09-10 at <https://trigger.dev/docs/self-hosting/overview>). Recommendation: cloud. Self-hosting is several services to operate for a two-person team, and the SPINE names pg-boss as the fallback if the vendor fails, not a self-hosted Trigger.dev.

### Steps

1. Sign up at <https://cloud.trigger.dev> with GitHub.
2. Create an organization named `ai-stylist` (or accept the default personal org) and a project named `ai-stylist`. Choose v4 if asked; new projects are v4.
3. Copy the project ref from **Project settings** in the dashboard. It looks like `proj_<...>` and is not a secret. Store it as `TRIGGER_PROJECT_REF` in `.env` and in `secrets/dev.enc.yaml`. T08 will write the same value into `trigger.config.ts` under `apps/api/`.
4. Open **API keys** (dashboard, project selected, environment selector). Copy the **Development** secret key (`tr_dev_sk_...`) and store it as `TRIGGER_SECRET_KEY` in `.env` and `secrets/dev.enc.yaml`. The **Production** key (`tr_prod_sk_...`) goes into `secrets/prod.enc.yaml` when P03 creates it; a preview key exists as well (`tr_preview_sk_...`) and is not used yet.
5. The `dev` environment runs tasks on your machine through the CLI dev server; `prod` runs them on Trigger.dev's cloud. Deployment credentials (`TRIGGER_ACCESS_TOKEN`) are needed only by the deploy workflow in P03 and will be added to `.github/workflows/README.md` then.

### What to record

- `.env.example` keys: `TRIGGER_PROJECT_REF`, `TRIGGER_SECRET_KEY` (per environment: `dev` in `.env` and `secrets/dev.enc.yaml`, `prod` in `secrets/prod.enc.yaml`).

### Do not

- Do not use the production secret key locally.
- Do not put business logic into task handlers; they are adapters (`CLAUDE.md` invariants).

### Verify

Until T08 lands: `just doctor` reports `✔ .env has every key from .env.example`. After T08: `just dev-workers` starts the Trigger.dev dev server and the dashboard's `dev` environment shows your machine as connected.

## 6. Cloudflare (R2, Images, WAF)

### Why we use it

R2 is the object store for user media (zero egress fees, `SPINE.md` §2), behind the `StorageProvider` port in `apps/api/src/platform/`. Cloudflare Images provides transforms later; the WAF sits in front of the API when it has a public hostname.

### When you need it

R2 bucket and token: P02-T13 (signed-URL skeleton). Images: P06 (closet capture, thumbnails). WAF and DNS: when the API gets a domain in P03. Region ("location hint" or jurisdiction) is provisional per OQ-07.

### Cost

R2, Checked 2026-09-10 at <https://developers.cloudflare.com/r2/pricing/>: free tier 10 GB-month storage, 1 million Class A operations and 10 million Class B operations per month, egress free. Cloudflare Images, Checked 2026-09-10 at <https://developers.cloudflare.com/images/pricing/>: 5,000 unique transformations per month free, then $0.50 per 1,000; stored images $5 per 100,000 per month. Enabling R2 may ask for a payment method; verify at signup.

### Steps

1. Sign up at <https://dash.cloudflare.com/sign-up>. One account for the project, owned by `<owner>`.
2. Left menu, **R2 object storage**. Enable it if asked (this is where a payment method may be requested).
3. **Create bucket**. Name: `ai-stylist-dev`. Location: **Automatic**, or a specific jurisdiction (for example **EU**) if OQ-07 requires it; note that a jurisdiction changes the S3 endpoint hostname. Leave default storage class (Standard; the free tier applies only to Standard). Repeat for `ai-stylist-staging` and, in P03, `ai-stylist-prod`.
4. Copy the account id: R2 overview page, **Account details** panel, **Account ID**. Store it as `R2_ACCOUNT_ID`.
5. Create a token: R2 overview, **Account details**, **Manage** next to **API Tokens**, **Create Account API token** (an account token outlives any one person; do not use "Create User API token"). Name `ai-stylist-dev`. Permissions: **Object Read & Write**. Under "Specify bucket(s)" choose only `ai-stylist-dev`. TTL: leave unlimited or set a rotation date. Create.
6. The next screen shows **Access Key ID** and **Secret Access Key** once. Copy them into `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. The S3 endpoint is `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (or the jurisdiction variant shown on that screen); the adapter builds it from `R2_ACCOUNT_ID`, so it is not a separate key.
7. Set `R2_BUCKET=ai-stylist-dev`. Leave `R2_PUBLIC_BASE_URL` empty locally; it is set when a custom domain or `r2.dev` public access is attached to a bucket (bucket, **Settings**, **Public access**), which is not needed before P06.
8. Repeat steps 5 and 6 with a separate token per environment (`ai-stylist-staging`, `ai-stylist-prod`), each scoped to its own bucket, into the matching `secrets/<env>.enc.yaml`.
9. Cloudflare Images (P06): left menu **Images**, enable, then follow the P06 task; no key exists in `.env.example` yet and one will be added with that phase.
10. WAF (P03 or later): add the API domain to Cloudflare DNS, proxy it (orange cloud), then **Security**, **WAF** managed rules. Rate limits inside the API (`RATE_LIMIT_*`) stay on regardless; never disable one to make the other work.

### What to record

- `.env.example` keys: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` (one set per environment).
- Overview table: bucket names, jurisdiction chosen.

### Do not

- Do not create one token with **Admin Read & Write** and reuse it across environments.
- Do not make the dev or staging bucket public.
- Do not upload real user photos to any bucket; test data is synthetic.

### Verify

No repo command exists until P02-T13 lands the adapter and its `*.sec.test.ts` suite; then `just test platform` exercises presigned PUT/GET against the configured bucket. Until then, `just doctor` confirms the keys are present in `.env`, and the bucket page in the dashboard lists `ai-stylist-dev` with zero objects.

## 7. Expo / EAS

### Why we use it

The team develops on Linux with no Mac (ADR-0002). EAS Build produces iOS and Android binaries in the cloud; `eas submit` uploads to TestFlight from a Linux runner. The `ios-eas.yml` and `android.yml` workflows, and `just mobile-ios-build --cloud eas` / `just mobile-android-build --cloud`, all depend on this account. Profiles are in `apps/mobile/eas.json` (`dev`, `preview`, `prod`).

### When you need it

P02-T14 (both iOS lanes running for about two weeks so P02-T15 can write ADR-0002).

### Cost

Checked 2026-09-10 at <https://expo.dev/pricing>: Free plan 15 Android and 15 iOS builds per month, 45 minute build timeout, low queue priority. Starter $19/month plus usage. The two-week dual-lane experiment in T14 will consume a large part of one month's free quota; watch **Usage** in the dashboard.

### Steps

1. Create an Expo account at <https://expo.dev/signup>. Use the project owner's email; an Expo organization can be added later and the project transferred.
2. Log in from the repo (eas-cli is not pinned in `mise.toml` yet; the justfile falls back to `pnpm dlx`):

   ```bash
   cd apps/mobile
   pnpm dlx eas-cli@latest login
   ```

3. Create the EAS project and get its id:

   ```bash
   pnpm dlx eas-cli@latest init
   ```

   `eas init` creates the project on EAS under your account with the slug `ai-stylist` from `app.config.ts` and prints the project id (a UUID). Because `app.config.ts` is TypeScript, `eas init` cannot write `extra.eas.projectId` for you; the config reads it from `EXPO_PUBLIC_EAS_PROJECT_ID` instead. If the command offers to modify a config file, decline.

4. Put the id into `.env` as `EXPO_PUBLIC_EAS_PROJECT_ID=<uuid>` and into `secrets/dev.enc.yaml`. It is not a secret (it ships in the bundle) but everyone needs the same value.
5. First build, Android, preview profile, from the repo root:

   ```bash
   just mobile-android-build --cloud --profile preview
   ```

   On the first run EAS asks to generate an Android keystore; answer yes and let EAS manage it (see section 9 for how that keystore relates to Play Console). The build page URL is printed; the APK is downloadable there when it finishes.

6. Access token for CI: <https://expo.dev>, account menu, **Access tokens** (under the account settings), **Create token**. Prefer creating a **Robot** user first (same page) and generating the token for it, so the token does not act as you. Name `github-actions`. Copy the token once and store it as GitHub secret `EXPO_TOKEN`. eas-cli honors it as the `EXPO_TOKEN` environment variable without `eas login` (Checked 2026-09-10, <https://docs.expo.dev/accounts/programmatic-access/>).
7. iOS builds additionally need section 8 done; the first `eas build --platform ios` run asks for the Apple account to create the distribution certificate and provisioning profile, and stores them on EAS.

### What to record

- `.env.example` key: `EXPO_PUBLIC_EAS_PROJECT_ID` (`.env`, `secrets/dev.enc.yaml`).
- GitHub secret: `EXPO_TOKEN`.
- `apps/mobile/README.md` "Configuration" already documents the key.

### Do not

- Do not commit `credentials.json` or a downloaded keystore under `apps/mobile/`.
- Do not hand-edit `app.config.ts` to hardcode the project id; the env var is the mechanism.
- Do not run `prod` profile builds before the store accounts exist; they consume quota and cannot be submitted.

### Verify

```bash
cd apps/mobile && pnpm dlx eas-cli@latest whoami
```

Expected: your Expo username. Then in GitHub, **Actions**, **ios-eas**, **Run workflow** with profile `preview` and submit unchecked; the `Require EXPO_TOKEN` step passes and `just mobile-ios-build --cloud eas` starts (it fails later at signing until section 8 is done, which is expected).

## 8. Apple Developer Program and App Store Connect

### Why we use it

iOS code signing, TestFlight, App Store distribution, and Sign in with Apple. The `ios-eas.yml` upload job and the `ios-gha-macos.yml` lane read App Store Connect API keys from GitHub secrets.

### When you need it

P02-T14. Apple's approval can take days, so enroll at phase start (`P02` §3).

### Cost

99 USD per membership year (Checked 2026-09-10, <https://developer.apple.com/programs/whats-included/>). Enrollment needs an Apple Account with two-factor authentication. Individuals enroll with their legal name; organizations need a legal entity, a D-U-N-S Number, a domain-matching work email and a public website (Checked 2026-09-10, <https://developer.apple.com/programs/enroll/>). Decide individual vs organization before enrolling; the seller name shown on the App Store follows from it.

Since 2026-04-28 Apple requires uploads to be built with Xcode 26 or later using the iOS 26 SDK (Checked 2026-09-10, <https://developer.apple.com/news/upcoming-requirements/>). EAS build images and the `macos-15` GitHub runner image must therefore provide Xcode 26; check the image notes when T14 pins them.

### Steps

1. Enroll at <https://developer.apple.com/programs/enroll/>. Wait for the confirmation email before continuing; App Store Connect stays empty until then.
2. Decide the bundle identifier. `apps/mobile/app.config.ts` uses the placeholder `app.aistylist.mobile` for both `ios.bundleIdentifier` and `android.package`; it must be replaced by a final reverse-domain id that you own before the first signed build, because Apple ties it to the App ID and it cannot change later. Change it through a pull request.
3. Register the App ID: <https://developer.apple.com/account>, **Certificates, Identifiers & Profiles**, **Identifiers**, **+**, **App IDs**, type **App**, description `AI Stylist`, Bundle ID **Explicit** with the id from step 2. Enable the **Sign in with Apple** and **Push Notifications** capabilities now; they are free to enable and needed in P03 and P09. Register.
4. Copy the **Team ID** from the account **Membership details** page (10 characters). Store it as GitHub secret `APPLE_TEAM_ID`; the `ios-gha-macos.yml` lane and `just mobile-ios-build --cloud gha` read it to sign.
5. Create the app record: <https://appstoreconnect.apple.com>, **Apps**, **+**, **New App**, platform iOS, name `AI Stylist`, primary language, the bundle id from step 3, SKU `ai-stylist`. This makes TestFlight uploads possible.
6. Create the App Store Connect API key: **Users and Access**, **Integrations** (opens with App Store Connect API selected), **Team Keys**, **Generate API Key** (or **+**). Name `github-actions`. Access: **App Manager** (enough for TestFlight uploads). **Generate**.
7. The key row now shows **Key ID**; the page header shows **Issuer ID**. Download the `AuthKey_<KEYID>.p8` file; it can be downloaded once only. Store:
   - **Key ID** as GitHub secret `APP_STORE_CONNECT_API_KEY_ID`
   - **Issuer ID** as GitHub secret `APP_STORE_CONNECT_API_ISSUER_ID`
   - the full text of the `.p8` file (including the `-----BEGIN PRIVATE KEY-----` lines) as GitHub secret `APP_STORE_CONNECT_API_KEY_P8`
8. Move the `.p8` file into the password manager and delete it from disk.
9. Distribution certificate and provisioning profile: let EAS create and store them on the first `eas build --platform ios` (section 7 step 7). The `ios-gha-macos.yml` lane instead needs them exported as `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, and `IOS_PROVISIONING_PROFILE_BASE64`; T14 documents that export (`pnpm dlx eas-cli@latest credentials` can download what EAS holds). Skip until T14 asks for it.

### What to record

- GitHub secrets: `APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY_P8`, `APPLE_TEAM_ID`; later `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`.
- `.env.example` keys `APPLE_SIGNIN_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_CLIENT_ID` come from section 14, not from this section.
- Repo: final bundle id in `apps/mobile/app.config.ts`.

### Do not

- Do not give the API key **Admin** access; App Manager is enough.
- Do not commit the `.p8`, a `.p12`, or a `.mobileprovision` anywhere.
- Do not share the Apple Account password with anyone; use App Store Connect user roles instead.

### Verify

GitHub, **Actions**, **ios-eas**, **Run workflow**, profile `preview`, submit **checked**. The `Require App Store Connect API key secrets` step passes and `eas submit --platform ios --latest` runs; a new build appears under **TestFlight** in App Store Connect within about 30 minutes. If the build step fails on signing, section 7 step 7 has not been completed.

## 9. Google Play Console

### Why we use it

Android distribution. `android.yml` signs release builds when the upload keystore secrets exist, and `just mobile-android-build --profile prod` produces the AAB that Play accepts.

### When you need it

P02-T14 (`android.yml` is dispatch-only and unsigned until then).

### Cost

25 USD one-time registration fee, paid by card; identity verification may ask for a government id (Checked 2026-09-10, <https://support.google.com/googleplay/android-developer/answer/6112435>). Personal accounts created after 2023-11-13 must complete a closed-testing requirement before production release; the details are on the linked Google page and are a P14 concern.

### Steps

1. Register at <https://play.google.com/console/signup> with the owner's Google account. Choose organization if a legal entity exists (matches the Apple decision in section 8). Pay the fee and complete verification.
2. **Create app**: name `AI Stylist`, default language, **App** (not game), **Free**. Accept the declarations. The package name is fixed by the first uploaded bundle; it must equal `android.package` in `apps/mobile/app.config.ts`, so finish section 8 step 2 first.
3. Signing. Two keys exist: the **upload key** (yours; signs the AAB you upload) and the **app signing key** (Google's; signs what users install). Use **Play App Signing** (default on new apps) so Google holds the app signing key.
4. Upload keystore. If section 7 step 5 let EAS generate the keystore, download it: `cd apps/mobile && pnpm dlx eas-cli@latest credentials`, platform **Android**, profile `prod`, **credentials.json: Upload/Download credentials between EAS servers and your local json**, **Download credentials from EAS to credentials.json** (Checked 2026-09-10, <https://docs.expo.dev/app-signing/app-credentials/>). The keystore path, its password, the key alias and the key password are in the downloaded `credentials.json`. Otherwise generate one locally with `keytool` from the mise-pinned JDK (`keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`).
5. Store, as GitHub secrets, exactly as `android.yml` expects:
   - `ANDROID_KEYSTORE_BASE64`: `base64 -w0 upload.jks`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
6. Move the keystore and `credentials.json` into the password manager and delete both from the repo checkout (`credentials.json` must never be committed).
7. First upload: Play Console, **Testing**, **Internal testing**, **Create new release**, upload the signed AAB from the `android` workflow artifact (or from EAS). Play records the upload certificate from this first bundle; every later upload must be signed with the same key.

### What to record

- GitHub secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- `.env.example`: nothing; `GOOGLE_SIGNIN_CLIENT_ID` comes from section 14.
- Repo: final package name in `apps/mobile/app.config.ts`.

### Do not

- Do not lose the upload keystore; recovering requires a support request to Google and a key reset.
- Do not commit `credentials.json`, `*.jks`, or `*.keystore`.
- Do not opt out of Play App Signing.

### Verify

GitHub, **Actions**, **android**, **Run workflow**, profile `prod`. The log prints `Signing: enabled` (instead of the `ANDROID_KEYSTORE_BASE64 not set` notice) and the artifact contains an `.aab`. Uploading it to Internal testing succeeds without a signature error.

## 10. PostHog

### Why we use it

Product analytics, session replay, error tracking, and feature flags (`SPINE.md` §2). The mobile app has an analytics port with a consent stub whose sink is a no-op (`apps/mobile/src/lib/analytics`); the consent default is OFF, so nothing is sent until P03 wires the consent-gated SDK.

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

1. Sign up at <https://grafana.com/auth/sign-up/create-user>. Create a stack named `ai-stylist`; choose the region closest to Railway's (provisional per OQ-07).
2. Grafana Cloud portal, your organization **Overview**, select the stack, then **Configure** on the **OpenTelemetry** tile (Checked 2026-09-10, <https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/>).
3. Follow that page to generate an API token (name `api-dev`, role write). It shows ready-made environment variables: `OTEL_EXPORTER_OTLP_ENDPOINT` (`https://otlp-gateway-<region>.grafana.net/otlp`) and `OTEL_EXPORTER_OTLP_HEADERS` (`Authorization=Basic <base64 of instanceId:token>`). Copy both exactly as shown.
4. Store them in `secrets/dev.enc.yaml` and `.env` under the same names. Set `OTEL_SERVICE_NAME=api` for the API and `workers-ml` for the workers (the workers get their own env in their compose/Railway config).
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

### Nager.Date

- Why: public holidays behind the `HolidayProvider` port (P08).
- When: P08. No account, no API key, no rate limit on the hosted API (Checked 2026-09-10, <https://nagerholidays.com/Api>; note that `date.nager.at` now redirects to `nagerholidays.com`, which the P08 adapter base URL must reflect). Self-hosting is the documented fallback (DEC-23).
- Record: nothing in `.env.example` yet; a base-URL key is added in P08.

### Embeddings and vision LLM

- Why: attribute extraction (Gemini Flash-class or Claude Haiku), embeddings (Voyage multimodal per DEC-35, Cohere as the SPINE-era pick), explanation polish (Claude Haiku).
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

| Phase     | Do now                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P02 (now) | 1 GitHub (CODEOWNERS, branch protection, Actions). 2 sops + age (keys, `.sops.yaml`, `secrets/dev.enc.yaml`, `SOPS_AGE_KEY`). 3 Neon project (T07). 4 Railway empty project. 5 Trigger.dev (T08). 6 R2 dev bucket + token (T13). 7 Expo/EAS + `EXPO_TOKEN` (T14). 8 Apple enrollment + ASC API key (T14). 9 Play Console + keystore secrets (T14). 10 PostHog project (T09). 11 Grafana Cloud stack + OTel vars (T09). Request Apple and Google approvals first; they take days. |
| P03       | Railway first deploy (Dockerfile, project token, sync script), Neon `production` branch, `secrets/staging.enc.yaml` and `secrets/prod.enc.yaml`, Cloudflare DNS + WAF for the API domain, PostHog prod project + personal API key, 14 Apple and Google sign-in credentials.                                                                                                                                                                                                      |
| P06       | fal.ai key + spend limit, vision-LLM and embedding provider accounts (privacy review first), Cloudflare Images, R2 multipart upload settings.                                                                                                                                                                                                                                                                                                                                    |
| P08       | Open-Meteo Standard plan + key, Nager.Date base URL decision (hosted vs self-hosted).                                                                                                                                                                                                                                                                                                                                                                                            |
| P11       | fal.ai production key, AIC-O2 review passed, Replicate fallback account, per-provider spend caps.                                                                                                                                                                                                                                                                                                                                                                                |
| P13       | 12 RevenueCat project, store connections, webhook secret, `REVENUECAT_*` in `secrets/prod.enc.yaml`.                                                                                                                                                                                                                                                                                                                                                                             |
| P14       | Rotate every credential created during development that was ever pasted into a shared terminal; confirm each `secrets/prod.enc.yaml` value is production-scoped; Play closed-testing requirement; App Store review assets.                                                                                                                                                                                                                                                       |

## When something goes wrong

1. `just secrets-sync` prints `NOT IMPLEMENTED (P02 T02)` and exits 2. `secrets/dev.enc.yaml` does not exist yet. Finish section 2 step 5, or copy `.env.example` to `.env` and fill values by hand.
2. `sops` says `no key could decrypt the data` or `failed to get the data key`. Your public key is not in the file's recipient list, or your private key is not at `~/.config/sops/age/keys.txt`. Ask a developer who can decrypt to add your key to `.sops.yaml` and run `sops updatekeys` on every file. Check `SOPS_AGE_KEY_FILE` if you keep the key elsewhere.
3. `just doctor` reports `.env missing N key(s)`. Someone added keys to `.env.example`. Copy the missing lines from `.env.example` into `.env` (values stay empty) or re-run `just secrets-sync` after the shared file is updated.
4. `just db-migrate` against Neon fails with a `SET` or `prepared statement` error. You used the pooled connection string. Copy the direct string (Connection pooling toggle off) and retry.
5. The `ios-eas` workflow stops at `Require EXPO_TOKEN` or `Require App Store Connect API key secrets`. The GitHub secret is missing or named differently. The names must match `.github/workflows/README.md` exactly; check for trailing spaces in the secret value when the step passes but `eas` still reports `Not logged in`.
6. `eas build` reports the free build quota is exhausted. Wait for the monthly reset shown under **Usage**, or build Android locally with `just mobile-android-build --profile preview` (needs `ANDROID_HOME`), or upgrade the plan with the owner's approval.
7. The `android` workflow prints `ANDROID_KEYSTORE_BASE64 not set`. Expected until section 9 is done; the build is unsigned and cannot be uploaded to Play. After adding the four secrets, re-run the workflow and look for `Signing: enabled`.
