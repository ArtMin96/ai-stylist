# Proposal: `docs/SERVICES-SETUP.md` §10 PostHog and §11 Grafana Cloud key setup, matched to the live UIs and official docs (AI-17, P02-T09)

> Status: APPLIED (2026-10-03, AI-17), by hand and with changes, by a docs agent in a session for
> which the owner authorized agents to edit the human-only docs. Do not re-apply the diff.
> Part B: all six hunks are in `docs/SERVICES-SETUP.md`, adapted to the answers to Part F. F1: the
> steps stay name-independent. F2: the explicit access policy and `Authorization=Basic%20` are the
> documented way. F3: the `gh` sentence is kept, in the forms the owner ran that day
> (`gh secret set <NAME> < <file>`, `gh variable set <NAME> --body '<value>'`). F4: the token is
> read with `read -rs` and the header is piped into `just secrets-push --set`, so it is never typed
> on a command line; the Verify test reads the header from the environment. Every "type the line"
> and `just secrets-edit dev` storing step became `just secrets-push --set <KEY>`
> (`.claude/plans/2026-10-03-setup-automation-proposal.md`, "Interplay"). D1 is settled: the sync
> key exists, and its three scope rows and its **Projects** access were confirmed live.
> Part E: the `docs/observability/**` items were already in the tree, in its own wording, from the
> observability docs pass of the same day; applied with this banner:
> `docs/adr/0007-observability-backend.md` line 38 and the three code comments. Not applied:
> `.env.example` (three comment lines),
> `tools/observability/README.md` lines 118–119, `secrets/README.md` (the path guard refused the
> edit), `planning/16-risks-open-questions-and-decision-log.md` lines 68 and 145, and the Linear
> text. F5 to F10 stay open. Proposed 2026-10-03 by docs-maintainer (worktree
> agent-a3450284fcf28af2b, base 1655729).

`docs/SERVICES-SETUP.md` is human-only (`.claude/rules/docs-and-progress.md`,
`.claude/rules/human-only.md`). Apply Part B by hand, or authorize one session to apply exactly that
diff. Nothing else in the repository was edited for this proposal.

## A. What is wrong today, and how that was established

The owner is new to both services, followed §10 and §11 literally, and could not obtain several keys.
On 2026-10-03 five reports were written:

- `grafana-live-ui.md` and `posthog-live-ui.md`: two agents walked the live UIs in the owner's
  signed-in browser and recorded the exact labels. They created the Grafana OTLP token (through an
  explicit access policy), the Grafana service account token and the PostHog `symbol-upload` key, and
  verified each with a request that changes nothing. The PostHog `observability-sync` key was **not** created
  (the browser extension disconnected before **Create key**), and no `ci-metrics` token was created.
- `grafana-docs-research.md` and `posthog-docs-research.md`: two agents fetched the official pages
  the same day and compared them with the repo.
- `keys-inventory.md`: one agent listed every key the repo reads and where each is stored.

The reports sit in the session scratchpad under `/tmp`, which does not survive a reboot, so every
fact this proposal relies on is restated below. I re-read each repo path named in Part C at base
1655729; I did not open either vendor's UI or fetch any page myself.

Line numbers are those of `docs/SERVICES-SETUP.md` at base 1655729.

| Line | The doc says | What is true on 2026-10-03 |
| --- | --- | --- |
| 505 | "Create a stack named `ai-stylist`" | The account's one stack has a different name; the free plan allows one stack per account. |
| 506 | "your organization **Overview**, select the stack, then **Configure**" | The stack card has two buttons, **Launch** and **Details**. **Details** opens the page that has the **OpenTelemetry** tile. |
| 507 | "generate an API token (name `api-dev`, role write)" | No role field exists. The tile's **Generate now** dialog has a read-only policy name, a token name, an expiration and eight fixed scopes that cannot be narrowed. |
| 507 | "It shows ready-made environment variables … Copy both exactly as shown" | They appear only after a token is created through the tile. The doc never says where the instance ID half of the header comes from. |
| 507, 525 | `Authorization=Basic <base64 …>` (with a space) | The value stored today is `Authorization=Basic%20<base64>`; it passed the doc's own curl test, and all four consumers decode it. |
| 510 | "**Add service account token** with a 90-day expiry" | That dialog has no 90-day choice: only **No expiration**, or **Set expiration date** with a calendar. |
| 511 | `ci-metrics` "with only the metrics write scope", "never the dev token (step 5)" | Only a Cloud access policy can produce a metrics-only token, and the doc gives no path to it. The dev token is step 3, not step 5. |
| 464, 468 | "A region cannot change after creation" | PostHog moves a project between regions for Scale or Enterprise customers only; on the free plan EU means a new organization and project on EU Cloud. |
| 469 | "Create an organization `ai-stylist` and a project `ai-stylist-dev`. Add `ai-stylist-prod` in P03." | The live organization and project have other names, and the free plan allows one project. |
| 470 | "**Settings**, **Project**, **Project API key** (label may differ)" | The box is **Project token**, in the section **Project token & ID** of **Settings - General**. |
| 472 | "`POSTHOG_CLI_PROJECT_ID` (numeric project id)" with no location | It is the **Project ID** box in the same section, and the number in the address bar. |
| 472, 473 | Scopes written as `project:write`, `error_tracking:write`, … | The create form has no such strings. It has named rows, each with **No access**, **Read**, **Write**. The `object:action` form appears only in the key list afterwards. |
| 472, 473 | "limited to the project"; no access mode for the second key | The control is **Organization & project access** with **All access**, **Organizations**, **Projects**, and each key needs a different one. The preset **Source map upload** is not mentioned. |
| 67 | Only the GitHub web path for secrets and variables | No doc in the repo gives a `gh secret set` / `gh variable set` instruction. |
| 155 | "Edit values later with `just secrets-edit`" | `secrets-edit` seeds key names only when it first creates the file. Five key names that this task needs are absent from `secrets/dev.enc.yaml` and must be typed in: `GRAFANA_SERVICE_ACCOUNT_TOKEN`, `GRAFANA_ALERT_EMAILS`, `GRAFANA_ONCALL_TIMEZONE`, `POSTHOG_CLI_API_KEY`, `POSTHOG_SYNC_API_KEY`. |

Why this has to be right before the next rotation: the two Grafana tokens created today (the `api-dev`
OTLP token and the `observability-sync` service account token) expire on 2027-01-01, 90 days after
creation (`planning/11-security-privacy-and-compliance.md` §5.3). The owner will repeat §11 steps 3
and 6 then.

Non-secret identifiers seen on 2026-10-03. The diff in Part B does **not** write them into the doc
(question F1):

| Service | Identifier | Value |
| --- | --- | --- |
| Grafana Cloud | organization and stack name | `hugesnail1458` (stack address `https://hugesnail1458.grafana.net`) |
| Grafana Cloud | region | `prod-eu-north-0` (EU) |
| PostHog | region | `US Cloud` |
| PostHog | organization, project | `Garderi Test`, `Default project` |
| PostHog | numeric project id | `630358` |

## B. The diff for `docs/SERVICES-SETUP.md` (human-only)

Six hunks:

1. §1 step 7: the `gh` commands as an alternative to the web path.
2. §2 step 8: a key added to `.env.example` after the encrypted file was created is typed in by hand.
3. §10 Cost and Steps 1–6: region move, free-plan project limit, the project settings page, both
   personal keys with the labels of the create dialog.
4. §10 Do not and Verify: **Reset token**, key separation, a check for each personal key.
5. §11 Steps 1–7, What to record, Do not, and the first sentence of Verify: portal path, the OTLP
   values, the explicit access policy, the header, the service account token, `ci-metrics`.
6. §11 Verify: the service account token check.

Choices built into the diff, each open to a question in Part F: the steps name no account (F1); the
dev OTLP token comes from an explicit access policy (F2); the header is stored as
`Authorization=Basic%20<base64>` (F2); the service account keeps the Admin role (F5). Both sections
keep their step numbers (six in §10, seven in §11), so "section 1 step 7" and every `§10` / `§11`
reference elsewhere in the repo stays valid. Steps that now hold a list are separated by blank lines,
the way §2 already is.

````diff
--- a/docs/SERVICES-SETUP.md
+++ b/docs/SERVICES-SETUP.md
@@ -64,7 +64,7 @@
 4. Tick **Require a pull request before merging**. Tick **Require review from Code Owners** only after step 2 is merged.
 5. Tick **Require status checks to pass before merging** and **Require branches to be up to date before merging**. In the search box add these check names exactly as the jobs in `pr-gate.yml` report them: `Gate · just ci-parity` (it also runs the `.env.example` key check), `Gate · Contracts (generate --check, spectral, oasdiff)`, `Gate · Secret scan (PR diff)`, `Gate · Clone detection (placeholder)`, and `Report · PR gate summary`, which fails when any gate job failed or was cancelled and carries `ci.pr_gate_duration_seconds`. The names only appear in the search box after the workflow has run at least once on a pull request, so open a trivial PR first if the list is empty.
 6. Save the rule.
-7. Repository secrets live at **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Create them as each later section tells you to. Nothing is required for `pr-gate.yml`, `affected.yml`, or `nightly.yml`. On pushes to `main` only, `pr-gate.yml` pushes CI metrics when the optional `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` secrets exist (section 11), and `ios.yml` / `android.yml` upload debug symbols with the PostHog secret and variables from section 10; pull requests never receive them. Hosts and project ids are repository **variables** (the **Variables** tab on the same page), never secrets. `GITLEAKS_LICENSE` is only needed when the repository moves under a GitHub organization; skip it.
+7. Repository secrets live at **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Create them as each later section tells you to. Nothing is required for `pr-gate.yml`, `affected.yml`, or `nightly.yml`. On pushes to `main` only, `pr-gate.yml` pushes CI metrics when the optional `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` secrets exist (section 11), and `ios.yml` / `android.yml` upload debug symbols with the PostHog secret and variables from section 10; pull requests never receive them. Hosts and project ids are repository **variables** (the **Variables** tab on the same page), never secrets. From a terminal in the repo, the GitHub CLI (`gh`, not installed by `just bootstrap`) does the same: `gh secret set <NAME>` asks for the value at a prompt, so it stays out of the shell history, and `gh variable set <NAME> --body '<value>'` sets a variable; `gh secret list` and `gh variable list` show which names exist. `GITLEAKS_LICENSE` is only needed when the repository moves under a GitHub organization; skip it.
 8. Turborepo remote cache (optional). `pr-gate.yml` prints "Turborepo remote cache disabled" until `TURBO_TOKEN` and `TURBO_TEAM` exist. Two options: Vercel Remote Cache (free on all Vercel plans, Checked 2026-09-10, <https://turborepo.dev/docs/core-concepts/remote-caching>; create a Vercel account, run `pnpm exec turbo login` then `pnpm exec turbo link` in the repo root, then create a token under the Vercel account settings, **Tokens** (label may differ), and store it as `TURBO_TOKEN` with the Vercel team slug as `TURBO_TEAM`), or a self-hosted cache server (an open-source `turborepo-remote-cache` deployment you run yourself). Recommendation: skip this until `ci.pr_gate_duration_seconds` in the job summary is consistently above the 10 minute budget. Cold CI runs are within budget today.
 
 ### What to record
@@ -152,7 +152,7 @@
 
    `just secrets-sync staging` and `just secrets-sync prod` refuse to run on a workstation; CI sets `CI=true`, and a human who really needs it locally passes `--i-know-this-is-not-dev`.
 
-8. Edit values later with `just secrets-edit` (or `just secrets-edit staging`); commit the encrypted file through a pull request like any other change, then everyone runs `just secrets-sync` again.
+8. Edit values later with `just secrets-edit` (or `just secrets-edit staging`); commit the encrypted file through a pull request like any other change, then everyone runs `just secrets-sync` again. `secrets-edit` writes the key names only when it first creates the file, so a key that was added to `.env.example` afterwards is not in the encrypted file yet: type its whole line yourself (`KEY: value`, the same form as the lines around it) before you save.
 
 9. Onboard another developer: they run `just bootstrap`, which generates their identity, adds their `# developer: <label>` comment and recipient to the `dev` rule of `.sops.yaml` on a new `onboard/<slug>` branch, and prints a compare URL to open a pull request — no manual key exchange needed. Review the diff (it should touch only `.sops.yaml`, adding a label comment and a bare `- age1...` line), then run `just secrets-approve <branch>`: it re-wraps every `secrets/*.enc.yaml` for the new recipient list, commits and pushes onto their branch, and prints the compare URL again. Merge it; the new developer runs `just secrets-sync` (or re-runs `just bootstrap`) to pick up the shared dev values. Only the `dev` rule is automated this way — a deployer who needs `staging` or `prod` access still adds their own recipient under that rule by hand and asks a teammate who can already decrypt to run `just secrets-updatekeys`.
 
@@ -461,16 +461,41 @@
 
 ### Cost
 
-Free tier, Checked 2026-09-10 at <https://posthog.com/pricing>: 1M events, 5K session recordings, 100K exceptions, 1M feature flag requests per month; no credit card required. PostHog Cloud offers US and EU regions; the project exists in US Cloud (DEC-58). A region cannot change after creation, so an EU requirement from OQ-07 means a new EU project.
+Free tier, Checked 2026-10-03 at <https://posthog.com/pricing>: 1M events, 5K session recordings, 100K exceptions, 1M feature flag requests per month; no credit card required; 1 project, and at most 10 personal API keys. PostHog Cloud offers US and EU regions; the project exists in US Cloud (DEC-58). PostHog moves a project to the other region only for Scale or Enterprise customers (<https://posthog.com/docs/settings/projects>), so on the free plan an EU requirement from OQ-07 means a new organization and project on EU Cloud (<https://eu.posthog.com/signup>).
 
 ### Steps
 
-1. Sign up at <https://posthog.com/signup>. The project is in **US** Cloud (DEC-58; provisional per OQ-07, and the region cannot change later). Its hosts: `https://us.i.posthog.com` for ingestion, `https://us.posthog.com` for the app and API.
-2. Create an organization `ai-stylist` and a project `ai-stylist-dev`. Add `ai-stylist-prod` in P03.
-3. **Settings**, **Project**, **Project API key** (label may differ). This key is public-ish (it is embedded in clients) but still stays out of committed files. Store it as `POSTHOG_API_KEY` and the region host as `POSTHOG_HOST`, in `secrets/dev.enc.yaml`. Leave both empty in your personal `.env` if you want to be sure nothing is sent locally.
+1. Sign up at <https://posthog.com/signup>, or sign in at <https://us.posthog.com>. The project is in **US** Cloud (DEC-58; provisional per OQ-07; the Cost paragraph above says what a move to EU takes). PostHog has two hosts, and every key below belongs to exactly one of them: `https://us.i.posthog.com` is the ingestion host, where the apps and the API send events and flag requests (`POSTHOG_HOST`); `https://us.posthog.com` is the app and API host, used by the web UI, `posthog-cli` and `just observability-sync` (`POSTHOG_CLI_HOST`). With the two swapped, events are lost or the symbol upload and the sync fail.
+
+2. Use the organization and the project the account has after sign-up. Their names do not matter: every step below finds the project by its numeric id. The free plan allows one project, so the production project planned for P03 needs the pay-as-you-go plan (a card on file) or a second organization.
+
+3. Open <https://us.posthog.com/settings/project>; it redirects to `https://us.posthog.com/project/<project id>/settings/project-details`. The page is **Settings - General**, and its section **Project token & ID** has three boxes:
+
+   - **Project token**: a value of the form `phc_<letters and digits>`. The page notes that integrations often call it the project API key. It is public by design (it is compiled into the apps) but still stays out of committed files. Store it as `POSTHOG_API_KEY`. Do not click the **Reset token** icon next to it: that invalidates the current token at once.
+   - **Project ID**: digits only, the same number as in the address bar. Store it as `POSTHOG_CLI_PROJECT_ID`.
+   - **Region**: `US Cloud`. Nothing to store; it confirms which hosts from step 1 apply.
+
+   Store these with `just secrets-edit dev` in `secrets/dev.enc.yaml`, together with `POSTHOG_HOST` (`https://us.i.posthog.com`) and `POSTHOG_CLI_HOST` (`https://us.posthog.com`, no path and no trailing slash). Leave `POSTHOG_API_KEY` and `POSTHOG_HOST` empty in your personal `.env` if you want to be sure nothing is sent locally.
+
 4. A **Personal API key** (account settings) is needed later by the deletion adapter in P03; that task adds its key name to `.env.example`.
-5. For `just observability-sync`: account settings, **Personal API keys**, **Create personal API key**, name `observability-sync`, scopes `project:read`, `project:write`, `feature_flag:read`, `feature_flag:write`, `hog_function:read`, `hog_function:write`, limited to the project. Your account must be a project admin (`anonymize_ips` is admin-only). Store it as `POSTHOG_SYNC_API_KEY` in `secrets/dev.enc.yaml`, with `POSTHOG_CLI_PROJECT_ID` (numeric project id) and `POSTHOG_CLI_HOST` (`https://us.posthog.com`, the app host, not the ingestion host). Never a GitHub secret.
-6. For symbol upload: a second personal key with only `error_tracking:write` and `organization:read`, stored as `POSTHOG_CLI_API_KEY`. The iOS and Android workflows upload with it on `main` only: add the GitHub secret `POSTHOG_CLI_API_KEY` and the variables `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST` (section 1 step 7), each with its value from `secrets/dev.enc.yaml`. Do not add `POSTHOG_API_KEY` or `POSTHOG_HOST` to GitHub: CI-built apps carry no project key. `.github/workflows/README.md` lists which job reads which.
+
+5. For `just observability-sync`, create a personal API key. Open <https://us.posthog.com/settings/user-api-keys> (settings sidebar: **Account**, **Personal API keys**) and click **Create personal API key**. In the dialog of the same name:
+
+   - **Label**: `observability-sync`.
+   - **Organization & project access**: the choices are **All access**, **Organizations** and **Projects**, and the dialog does not submit until one is chosen. Choose **Projects**, click **Select projects…** and tick the project.
+   - **Scopes**: every scope is a row with **No access**, **Read** and **Write**. No preset fits this key, so type into **Search scopes…** to find the rows **Project**, **Feature flag** and **Hog function**, and set each to **Write** (Write includes Read). Leave every other row on **No access**. The form shows these names; the `project:write`, `feature_flag:write` and `hog_function:write` spellings appear only in the key list afterwards.
+   - Click **Create key**. The dialog **Personal API key ready** shows the value, which starts with `phx_`, once only. Copy it, then click **Okay**.
+
+   Your account must be a project admin, because the sync changes admin-only settings such as `anonymize_ips`; organization owners and admins are project admins automatically. Store the key as `POSTHOG_SYNC_API_KEY` in `secrets/dev.enc.yaml` (type the line if the file does not have it, section 2 step 8). Never a GitHub secret.
+
+6. For symbol upload, create a second personal API key in the same dialog:
+
+   - **Label**: `symbol-upload`.
+   - **Organization & project access**: choose **Organizations**, click **Select organizations…** and tick the organization. Do not choose **Projects** for this key: the **Organization** scope it needs is not available on a project-scoped key.
+   - **Scopes**: click **Select preset** and choose **Source map upload**. It sets exactly two rows, **Error tracking** to **Write** and **Organization** to **Read**; the key list shows them as `error_tracking:write` and `organization:read`.
+   - Click **Create key**, copy the `phx_` value from **Personal API key ready**, then click **Okay**.
+
+   Store it as `POSTHOG_CLI_API_KEY` in `secrets/dev.enc.yaml` (type the line if the file does not have it, section 2 step 8), then run `just secrets-sync`. The iOS and Android workflows upload with it on `main` only: add the GitHub secret `POSTHOG_CLI_API_KEY` and the variables `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST` (section 1 step 7), each with its value from `secrets/dev.enc.yaml`. Do not add `POSTHOG_API_KEY` or `POSTHOG_HOST` to GitHub: CI-built apps carry no project key. `.github/workflows/README.md` lists which job reads which.
 
 ### What to record
 
@@ -481,11 +506,23 @@
 
 - Do not call PostHog from anywhere except the analytics port; consent gating is a legal requirement (`planning/11`).
 - Do not enable session replay on screens that show measurements, selfies, or photos; that is a P03 review item.
+- Do not click **Reset token** on the project settings page, and do not put a personal key (`phx_`) into `POSTHOG_API_KEY`: the API and both apps accept only a `phc_` token there.
+- Do not give a personal key **All access**, and do not use one key for both jobs: the key that CI holds must not be able to change settings or flags.
 
 ### Verify
 
 `just doctor` shows `✔ .env has every key from .env.example`. With consent OFF (the default), the PostHog **Activity** page must stay empty even after running the app; an event there while the Dev build's debug consent toggle is off is a bug. The crash demo and symbol upload checks are in [docs/observability/posthog.md](observability/posthog.md#symbol-upload).
 
+To test the two personal keys, in a terminal where direnv has loaded `.env` after `just secrets-sync`:
+
+```bash
+curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $POSTHOG_CLI_API_KEY" "$POSTHOG_CLI_HOST/api/organizations/@current/"
+curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $POSTHOG_CLI_API_KEY" "$POSTHOG_CLI_HOST/api/projects/$POSTHOG_CLI_PROJECT_ID/feature_flags/"
+just observability-sync posthog --dry-run
+```
+
+Expected: `200` (the upload key works), then `403` (it cannot read flags, so it holds nothing beyond its two scopes), then the plan of the dry run, which sends only GET requests with `POSTHOG_SYNC_API_KEY`. A `403` in the dry run means one of the three scope rows or the selected project is missing on the sync key.
+
 ## 11. Grafana Cloud
 
 ### Why we use it
@@ -502,27 +539,59 @@
 
 ### Steps
 
-1. Sign up at <https://grafana.com/auth/sign-up/create-user>. Create a stack named `ai-stylist` in an EU region (DEC-58).
-2. Grafana Cloud portal, your organization **Overview**, select the stack, then **Configure** on the **OpenTelemetry** tile (Checked 2026-09-10, <https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/>).
-3. Follow that page to generate an API token (name `api-dev`, role write). It shows ready-made environment variables: `OTEL_EXPORTER_OTLP_ENDPOINT` (`https://otlp-gateway-<region>.grafana.net/otlp`) and `OTEL_EXPORTER_OTLP_HEADERS` (`Authorization=Basic <base64 of instanceId:token>`). Copy both exactly as shown.
-4. Store them in `secrets/dev.enc.yaml` and `.env` under the same names. Leave `OTEL_SERVICE_NAME` empty there: each process has its own name (`api`, `jobs`, `segmentation`), which `just dev-api` / `just dev-workers` set per process and each deployed service sets in its own Coolify config ([docs/observability/grafana.md](observability/grafana.md#configure-a-process)).
-5. Generate a separate token per environment (`api-staging`, `api-prod`) into the matching `secrets/<env>.enc.yaml` so one can be revoked without touching the others.
-6. For `just observability-sync`: in the stack, **Administration**, **Users and access**, **Service accounts**, **Add service account** `observability-sync` with role **Admin** (Admin holds the alerting provisioning writer role; Editor does not), then **Add service account token** with a 90-day expiry (rotation inventory, `planning/11-security-privacy-and-compliance.md` §5.3). Store the `glsa_…` token as `GRAFANA_SERVICE_ACCOUNT_TOKEN`, the stack URL `https://<stack>.grafana.net` as `GRAFANA_URL`, the on-call addresses as `GRAFANA_ALERT_EMAILS` (comma list) and the on-call IANA zone as `GRAFANA_ONCALL_TIMEZONE`, all in `secrets/dev.enc.yaml` (one stack serves every environment). Then `just secrets-sync`, `just observability-sync all --check`, `just observability-sync --dry-run`, `just observability-sync`.
-7. Optional, for the CI row of dashboard 1: GitHub secrets `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` (section 1 step 7), read by the `pr-gate.yml` summary job on pushes to `main` only. `OTEL_EXPORTER_OTLP_HEADERS` must carry a separate token named `ci-metrics` with only the metrics write scope, never the dev token (step 5), so the CI copy can write metrics and nothing else and can be revoked alone.
+1. Sign up at <https://grafana.com/auth/sign-up/create-user>. Later, sign in at <https://grafana.com/> and click **My account** in the page header to open the Grafana Cloud Portal. Use the stack the account has (the free plan allows one stack per account; if there is none yet, create it in an EU region, DEC-58). The stack's name, written `<stack>` below, is the title of its card under **Manage your Grafana Cloud stack** and the first part of its address `https://<stack>.grafana.net`. No step depends on the name.
+
+2. Read the two OTLP connection values (Checked 2026-10-03, <https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/>). On the stack's card click **Details** (not **Launch**); the **Manage Stack** page of that stack opens. On its **OpenTelemetry** tile click **Configure**. The connection-details page shows:
+
+   - **OTLP Endpoint**: a URL such as `https://otlp-gateway-prod-<region>.grafana.net/otlp`. Copy it as shown and keep the `/otlp` ending; never type it by hand, because newer regions use a longer host name. This is `OTEL_EXPORTER_OTLP_ENDPOINT`.
+   - **Instance ID**: a number. It is the user-name half of the header built in step 3. It is not a secret and is not stored under a key of its own.
+
+   Do not click **Generate now** under **Password / API Token** on that page. The token it creates belongs to a ready-made policy (named `stack-<number>-otlp-write`) whose scopes cannot be changed and are broader than this project needs: besides `metrics:write`, `logs:write` and `traces:write` it carries `metrics:import`, `alerts:write`, `rules:write`, `profiles:write` and `datadog:validate`.
+
+3. Create the dev token from an access policy of its own, with only the three scopes the processes use. Go back to **Manage Stack** and click **Launch** on the **Grafana** tile; the stack's Grafana opens at `https://<stack>.grafana.net`. In its left menu choose **Administration**, **Users and access**, **Cloud access policies**, then:
+
+   - Click **Create access policy**. In the dialog **Create new access policy**, type `api-dev` into **Display name** (**Name** fills in by itself). In the **Scopes** table tick **Write** on the rows `metrics`, `logs` and `traces`, and nothing else. Click **Create**.
+   - On the new `api-dev` card click **Add token**. In the dialog **Create new token**, type `api-dev` into **Token name** and choose **90 days** under **Expiration date** (the default is **No expiry**; `planning/11-security-privacy-and-compliance.md` §5.3 sets 90 days for provider keys). Click **Create**.
+   - The dialog **Token successfully added.** shows the token, a value that starts with `glc_`, once only. Copy it before you click **Close**.
+
+   Build the header value in a terminal that no AI agent can read. Put the Instance ID from step 2 and the token in place of the two placeholders and keep the single quotes:
+
+   ```bash
+   printf '%s:%s' '<instance id>' '<glc_ token>' | base64 | tr -d '\n'
+   ```
+
+   `OTEL_EXPORTER_OTLP_HEADERS` is the text `Authorization=Basic%20` followed directly by what the command prints: `Authorization=Basic%20<base64>`, on one line, with no space and no quotes. `%20` stands for the space after `Basic`; the API, the jobs process, the Python worker and the CI metrics push all read this spelling correctly.
+
+4. Store both values with `just secrets-edit dev`, as `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` in `secrets/dev.enc.yaml`, then run `just secrets-sync` to copy them into `.env`. Leave `OTEL_SERVICE_NAME` empty there: each process has its own name (`api`, `jobs`, `segmentation`), which `just dev-api` / `just dev-workers` set per process and each deployed service sets in its own Coolify config ([docs/observability/grafana.md](observability/grafana.md#configure-a-process)).
+
+5. For every later environment, repeat step 3 with an access policy and a token of its own (`api-staging`, `api-prod`) and store the header in the matching `secrets/<env>.enc.yaml`, so one can be revoked without touching the others. The endpoint and the Instance ID are the same for all of them: one stack serves every environment.
+
+6. For `just observability-sync`, create a service account token. This is a second kind of token: the `glc_` token from step 3 can send telemetry but cannot call Grafana's HTTP API, and a service account token (`glsa_`) is the reverse. In the stack's Grafana choose **Administration**, **Users and access**, **Service accounts**, **Add service account**, then:
+
+   - On the page **Create service account**, type `observability-sync` into **Display name**. Click **Role** (it shows **No roles assigned**), choose **Admin** under **Basic roles** and click **Apply**, then **Create**. Admin holds the alerting provisioning writer role; Editor does not.
+   - On the account's page, under **Tokens**, click **Add service account token**. Fill in **Display name**, for example `observability-sync-<yyyymmdd>`. Under **Expiration** click **Set expiration date**: the default is **No expiration** and there is no 90-day choice, so click the **Expiration date** field and pick the day 90 days from today in the calendar (`planning/11-security-privacy-and-compliance.md` §5.3). Click **Generate token**.
+   - The dialog **Service account token created** shows the token, a value that starts with `glsa_`. Copy it before you click **Close**; treat it as shown once.
+
+   Store four values with `just secrets-edit dev` in `secrets/dev.enc.yaml` (one stack serves every environment; type the line for any key the file does not have, section 2 step 8): the token as `GRAFANA_SERVICE_ACCOUNT_TOKEN`, the address `https://<stack>.grafana.net` with no path as `GRAFANA_URL`, the on-call addresses as `GRAFANA_ALERT_EMAILS` (comma list) and the on-call IANA zone as `GRAFANA_ONCALL_TIMEZONE` (for example `Europe/Berlin`; an offset such as `+01:00` is refused). Then `just secrets-sync`, `just observability-sync all --check`, `just observability-sync --dry-run`, `just observability-sync`.
+
+7. Optional, for the CI row of dashboard 1: GitHub secrets `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` (section 1 step 7), read by the `pr-gate.yml` summary job on pushes to `main` only. `OTEL_EXPORTER_OTLP_HEADERS` must carry a separate token named `ci-metrics` with only the metrics write scope, never the dev token (step 3), so the CI copy can write metrics and nothing else and can be revoked alone. Create it as in step 3, with an access policy `ci-metrics` on which **Write** is ticked on the `metrics` row only; the OpenTelemetry tile cannot produce such a token. Build its header the same way, with the same Instance ID, and give GitHub the endpoint and the header as raw values, without `export` and without quotes.
 
 ### What to record
 
 - `.env.example` keys: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`, `GRAFANA_URL`, `GRAFANA_SERVICE_ACCOUNT_TOKEN`, `GRAFANA_ALERT_EMAILS`, `GRAFANA_ONCALL_TIMEZONE`.
 - GitHub secrets (optional): `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` (CI metrics; the headers hold the `ci-metrics` token only).
+- Password manager or calendar: the expiry date of every token from steps 3, 6 and 7. After that date the exporters, the sync or the CI push are refused, and the step is repeated with a new token.
 
 ### Do not
 
 - Do not log request bodies or any sensitive field to Loki; the redaction allowlist from T09 applies to OTel attributes too.
 - Do not share the token between environments.
+- Do not use a token from **Generate now** on the OpenTelemetry tile; its scopes are fixed and broader than the three this project needs (step 2).
+- Do not add `GRAFANA_SERVICE_ACCOUNT_TOKEN` to GitHub; the sync runs on a developer machine only.
 
 ### Verify
 
-To test the credentials alone, without running a process, take the base64 part after `Authorization=Basic ` from `OTEL_EXPORTER_OTLP_HEADERS`:
+To test the credentials alone, without running a process, take the base64 part after `Authorization=Basic%20` from `OTEL_EXPORTER_OTLP_HEADERS`:
 
 ```bash
 curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
@@ -530,7 +599,15 @@
   -d '{"resourceSpans":[]}' "$OTEL_EXPORTER_OTLP_ENDPOINT/v1/traces"
 ```
 
-Expected: `200`. A `401` means the header or token is wrong. With the exporter wired (P02-T09), `just dev-api` followed by `curl localhost:3000/v1/health` produces a trace visible under **Explore**, **Tempo** in the stack.
+Expected: `200`. A `401` means the header or token is wrong; a `ci-metrics` header is expected to answer `401` here too, because it has no traces scope. With the exporter wired (P02-T09), `just dev-api` followed by `curl localhost:3000/v1/health` produces a trace visible under **Explore**, **Tempo** in the stack.
+
+To test the service account token, in a terminal where direnv has loaded `.env` after `just secrets-sync`:
+
+```bash
+curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $GRAFANA_SERVICE_ACCOUNT_TOKEN" "$GRAFANA_URL/api/datasources"
+```
+
+Expected: `200`. A `401` means the token is wrong or expired.
 
 ## 12. RevenueCat
 
````

## C. How each changed statement is known

Markers:

- **LIVE**: seen in the live UI on 2026-10-03 (`grafana-live-ui.md`, `posthog-live-ui.md`).
- **DOC**: stated on an official page that a research agent fetched on 2026-10-03 (URL given). I did
  not fetch the pages again.
- **SRC**: read in PostHog's own source on `master` by the research agent. That is neither a doc page
  nor the live UI.
- **REPO**: derived from this repository; I re-read every path named here at base 1655729.
- **NOT SEEN LIVE**: no live observation backs the statement. Part D collects these.

### §1 and §2

| # | Statement in the diff | Known from |
| --- | --- | --- |
| 1 | `gh secret list` and `gh variable list` show the names that exist | Both were run on 2026-10-03 (`keys-inventory.md`). |
| 2 | `gh secret set <NAME>` prompts for the value; `gh variable set <NAME> --body '<value>'` sets a variable | **NOT VERIFIED.** No report ran either command or fetched the `gh` manual; I wrote them from general knowledge of the GitHub CLI. Check with `gh secret set --help` and `gh variable set --help` (F3). |
| 3 | `gh` is not installed by `just bootstrap` | REPO: `mise.toml` pins no `gh`. |
| 4 | `secrets-edit` writes key names only when it first creates the file | REPO: `scripts/security/secrets-edit.sh:18-31` (the template is built only inside `if [[ ! -f "$ENC_FILE" ]]`). The key names of `secrets/dev.enc.yaml` at base lack the five keys listed in Part A. |

### §10 PostHog

| # | Statement in the diff | Known from |
| --- | --- | --- |
| 5 | Free allowance, 1 project, at most 10 personal API keys | DOC: <https://posthog.com/pricing>. |
| 6 | A region move is for Scale or Enterprise only; on the free plan EU means a new organization and project on EU Cloud | DOC: <https://posthog.com/docs/settings/projects>. |
| 7 | Hosts: `us.i.posthog.com` is ingestion, `us.posthog.com` is the app and API | DOC: <https://posthog.com/docs/api>. LIVE: the SDK snippet on the project page shows the ingestion host. |
| 8 | Which key takes which host | REPO: `.env.example:66,72`, `tools/observability/sync.mjs:118-119`. |
| 9 | With the hosts swapped, events are lost or the upload and the sync fail | The research agent's own conclusion (`posthog-docs-research.md`, "Gotchas"). **NOT SEEN LIVE.** |
| 10 | Every step finds the project by its numeric id, not its name | REPO: `tools/observability/sync.mjs:121-122`, and the base path `/api/projects/<id>` in `docs/observability/posthog/README.md:28`. |
| 11 | The P03 production project needs pay-as-you-go or a second organization | DOC: <https://posthog.com/pricing> ("1 project" on Free, 6 on pay-as-you-go). |
| 12 | `https://us.posthog.com/settings/project` redirects to `/project/<project id>/settings/project-details`; page **Settings - General**; section **Project token & ID**; boxes **Project token**, **Project ID**, **Region**; the note that integrations call the token the project API key; `US Cloud` | LIVE. |
| 13 | The token has the form `phc_…` and is public by design | DOC: <https://posthog.com/docs/api>. REPO: `apps/api/src/config.ts:25`. |
| 14 | A **Reset token** icon sits next to the token | LIVE (seen, not clicked). |
| 15 | **Reset token** invalidates the current token at once | SRC: `frontend/src/scenes/settings/environment/TeamSettings.tsx`. **NOT SEEN LIVE** (and it must not be tested). |
| 16 | **Project ID** is digits only and equals the number in the address bar | LIVE. REPO: `tools/observability/sync.mjs:121`. |
| 17 | `POSTHOG_CLI_HOST` has no path and no trailing slash | DOC: <https://posthog.com/docs/cli>. |
| 18 | `https://us.posthog.com/settings/user-api-keys`; sidebar **Account**, **Personal API keys**; button and dialog **Create personal API key**; **Label** | LIVE. |
| 19 | **Organization & project access** offers **All access**, **Organizations**, **Projects**; **Select projects…** lists the project | LIVE (the project was listed; the tick was not completed). |
| 20 | The dialog does not submit until an access mode is chosen | SRC. **NOT SEEN LIVE.** |
| 21 | Every scope is a row with **No access**, **Read**, **Write**; a **Search scopes…** box exists; no preset fits the sync key | LIVE (the preset list was read: none carries this scope set). |
| 22 | The rows are labelled **Project**, **Feature flag** and **Hog function** | SRC. **NOT SEEN LIVE**: `POSTHOG_SYNC_API_KEY` has not been created, so these three rows were never reached. |
| 23 | Write includes Read | SRC: `posthog/scopes.py`. REPO: `docs/observability/posthog/README.md:24`. |
| 24 | The sync needs project, feature flag and hog function write | REPO: `docs/observability/posthog/README.md:19-26,33-48`. DOC: the `feature_flags_*`, `hog_functions_*` and `organizations_projects_*` pages under <https://posthog.com/docs/open-api-spec/>. |
| 25 | The `object:action` spellings appear only in the key list | LIVE. |
| 26 | **Create key**; dialog **Personal API key ready**; value shown once; **Okay**; the value starts with `phx_` | LIVE. |
| 27 | The sync changes admin-only settings such as `anonymize_ips` | REPO: `docs/observability/posthog/README.md:21-23`. SRC: `posthog/api/team.py`. |
| 28 | Organization owners and admins are project admins automatically | DOC: <https://posthog.com/docs/settings/access-control>. LIVE: the owner's membership is Owner and the project has no access control (read from the API, not from the Members page). |
| 29 | A key with access **Projects** is enough for the sync | **NOT TESTED.** The research agent expects it to pass; no key exists yet (D1). |
| 30 | Symbol-upload key: label `symbol-upload`; **Organizations**; **Select organizations…**; **Select preset**, **Source map upload**; it sets **Error tracking** to **Write** and **Organization** to **Read**; the list shows `organization:read` and `error_tracking:write` | LIVE: the key was created this way and verified. |
| 31 | The **Organization** scope is not available on a project-scoped key | SRC. **NOT SEEN LIVE.** |
| 32 | Only a `phc_` token is accepted as `POSTHOG_API_KEY` | REPO: `apps/api/src/config.ts:25`, `apps/ios/Packages/Core/Sources/Analytics/PostHogSettings.swift:63`, `apps/android/app/build.gradle.kts:46`. |
| 33 | One key per job, so the key CI holds cannot change settings or flags | REPO: `docs/observability/posthog.md:59-62`. |
| 34 | `GET /api/organizations/@current/` answers 200 and `GET /api/projects/<id>/feature_flags/` answers 403 with the upload key | LIVE: both requests and both status codes. The `curl` spelling was not run in this exact form; the `Bearer` header is how the repo sends a personal key (`tools/observability/http.mjs:25`). |
| 35 | `just observability-sync posthog --dry-run` sends only GET requests; a 403 means a missing scope | GET only: REPO `tools/observability/README.md:42`, `docs/observability/posthog/README.md:58`. 403 for a missing scope: LIVE, row 34 (the upload key has no flag scope and got 403). The dry run itself was **NOT RUN**: no sync key exists. |

### §11 Grafana Cloud

| # | Statement in the diff | Known from |
| --- | --- | --- |
| 36 | **My account** in the header of grafana.com opens the Grafana Cloud Portal; the stack has a card under **Manage your Grafana Cloud stack** | LIVE. |
| 37 | The free plan allows one stack per account | DOC: <https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/stack-plans/>. |
| 38 | **Details** (not **Launch**) opens **Manage Stack**; **OpenTelemetry** tile, **Configure**; **OTLP Endpoint** and **Instance ID** on the connection-details page | LIVE. |
| 39 | Endpoint shape; newer regions use a longer host; copy it, never build it | DOC: <https://grafana.com/docs/grafana-cloud/security-and-account-management/region-url-formats/>, <https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/>. |
| 40 | Keep the `/otlp` ending | REPO: `tools/ci-metrics/push-pr-gate-metrics.mjs:211` appends `/v1/metrics` itself. |
| 41 | The Instance ID is the user-name half of the header | DOC: <https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/>. LIVE: a header built with it answered 200. |
| 42 | **Generate now** under **Password / API Token**; the policy name `stack-<number>-otlp-write`; its eight fixed scopes | LIVE: the dialog was opened, read and closed without creating anything. |
| 43 | **Launch** on the **Grafana** tile opens `https://<stack>.grafana.net`; **Administration**, **Users and access**, **Cloud access policies**; **Create access policy**; dialog **Create new access policy**; **Display name**, **Name**; **Scopes** rows `metrics`, `logs`, `traces` with **Write**; **Create** | LIVE. DOC: <https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/security-and-access/authentication-and-permissions/access-policies/create-access-policies/>. |
| 44 | **Add token**; dialog **Create new token**; **Token name**; **Expiration date** with **90 days**; default **No expiry** | LIVE. |
| 45 | 90 days for provider keys | REPO: `planning/11-security-privacy-and-compliance.md:108` (§5.3). |
| 46 | Dialog **Token successfully added.**; shown once; the token starts with `glc_`; **Close** | LIVE. |
| 47 | The `printf … \| base64 \| tr -d '\n'` command and the value `Authorization=Basic%20<base64>` | LIVE: the header was built this way, and the doc's curl test answered 200 on `/v1/traces` (401 with a made-up token). |
| 48 | The API, the jobs process, the Python worker and the CI push all read the `%20` spelling | REPO: `tools/ci-metrics/push-pr-gate-metrics.mjs:96-119` percent-decodes; the research agent ran the Node exporters (0.222.0) and the Python exporter (1.45.0) against a local stub with both spellings (`grafana-docs-research.md`). I did not repeat that probe. Grafana's own page prescribes `Basic%20` for Python (quoted in the same report, page not named there). |
| 49 | The endpoint and the Instance ID are the same for every environment | REPO: one stack serves every environment (`docs/adr/0007-observability-backend.md:23`, `.env.example:54`). |
| 50 | A `glc_` token cannot call Grafana's HTTP API; a `glsa_` token is the reverse | DOC: <https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/security-and-access/authentication-and-permissions/service-accounts/>. |
| 51 | **Service accounts**, **Add service account**; page **Create service account**; **Display name**; **Role** showing **No roles assigned**; **Basic roles**, **Admin**, **Apply**, **Create** | LIVE. (The official page does not describe a role field in the create form.) |
| 52 | Admin holds the alerting provisioning writer role; Editor does not | DOC: <https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/>. Whether Editor would work was **NOT TESTED**. |
| 53 | **Tokens**, **Add service account token**; **Display name**; **Expiration**, **Set expiration date**; default **No expiration**; no 90-day choice; **Expiration date** field with a calendar; **Generate token** | LIVE. |
| 54 | Dialog **Service account token created**; the token starts with `glsa_`; **Close** | LIVE. |
| 55 | Treat the service account token as shown once | `grafana-live-ui.md` says the tokens cannot be shown again but does not quote the dialog; the official page is silent. Hence "treat it as". |
| 56 | `GRAFANA_URL` is `https://<stack>.grafana.net` with no path | LIVE: the address **Launch** opens. REPO: `tools/observability/sync.mjs:82-90,110-112` requires https. |
| 57 | A zone such as `Europe/Berlin` is accepted and an offset such as `+01:00` is refused | REPO: `tools/observability/sync.mjs:93-100,113-116`. |
| 58 | `GRAFANA_ALERT_EMAILS` is a comma list (unchanged wording) | REPO: `.env.example:58`, `docs/observability/grafana/README.md:55`. The comma separator is **not confirmed** on any official page (D6). |
| 59 | A metrics-only token needs an access policy with **Write** on the `metrics` row; the tile cannot produce it | LIVE: the form allows it and the tile's scopes are fixed. No `ci-metrics` token was created. |
| 60 | "(step 3)" replaces "(step 5)" | REPO: the doc itself; the dev token is created in step 3. |
| 61 | Raw values in GitHub, without `export` or quotes | REPO: `.github/workflows/pr-gate.yml:233-234` passes the two secrets to the script as they are. |
| 62 | After its expiry date a token is refused | Expected, **NOT SEEN LIVE**: no token has expired yet. |
| 63 | `GRAFANA_SERVICE_ACCOUNT_TOKEN` never goes to GitHub | REPO: `.env.example:56`. |
| 64 | Verify: the base64 part follows `Authorization=Basic%20`; 200 is expected, 401 means a wrong header or token | LIVE. |
| 65 | A `ci-metrics` header answers 401 on `/v1/traces` | DOC: <https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/add-access-policy/> (a token without `traces:write` gets 401). **NOT SEEN LIVE.** |
| 66 | `GET <GRAFANA_URL>/api/datasources` with the service account token answers 200 | LIVE: request and status code. The `curl` spelling was not run in this exact form. That an expired token answers 401 is expected, **NOT SEEN LIVE**. |

## D. Not confirmed by any source

1. **`POSTHOG_SYNC_API_KEY` does not exist yet.** Rows 22 and 29: the labels of its three scope rows
   come from PostHog's source, and nobody has tested a key with access **Projects** against
   `GET` / `PATCH /api/projects/<id>/`. If `just observability-sync posthog --dry-run` answers 403 on
   the project itself with all three rows set, the fallback named by the research agent is to edit
   the key to **Organizations**. If that happens, replace "Choose **Projects**, click **Select
   projects…** and tick the project." in §10 step 5 with "Choose **Organizations**, click **Select
   organizations…** and tick the organization."
2. **No `ci-metrics` token exists yet.** No page states that the gateway accepts a metrics-only token
   on `/v1/metrics` (rows 59 and 65). The first push to `main` after the two GitHub secrets exist is
   the test: the summary job prints a `pushed … (HTTP 2xx)` line or a `push failed` warning
   (`tools/ci-metrics/push-pr-gate-metrics.mjs:245-260`).
3. **The tile's own output was never seen.** Nobody created a token through **Generate now**, so
   whether the portal prints the header with `Basic ` or `Basic%20` is unknown. The diff no longer
   depends on it.
4. **`gh secret set` and `gh variable set`** (row 2) were neither run nor looked up today.
5. **Sign-up itself was not walked.** Both accounts already existed. §10 step 1–2 and §11 step 1 for
   a brand-new account rest on the old text and on the official stack-plans and pricing pages.
6. **The separator in `GRAFANA_ALERT_EMAILS`.** The only official example uses `;`. A single address
   avoids the question.
7. **Whether Editor would be enough** for the service account (row 52), and whether the Free plan's
   role picker offers the fixed roles a least-privilege account would need (F5).
8. **Grafana's "Free trial".** The portal labelled the account "Free trial" with an upgrade banner
   and an end date of 2026-10-11. What happens on that date was not checked on any official page, so
   the Cost paragraph of §11 (line 501) is unchanged. DEC-48's exit trigger is "before paid usage":
   confirm after 2026-10-11 that the stack is on the Free plan.
9. **Organization-level access policies were not inventoried.** The visit to the portal's own Access
   Policies page was denied to the agent; only the in-stack page was read.
10. **`organization:read` on the upload key.** PostHog's upload pages require it; the pinned CLI's
    upload code calls only project endpoints. The diff follows the docs.
11. **Formatting of the applied result.** Prettier covers `docs/`. I could not run `just format --check`
    (not in this agent's command allowlist, and the diff is not applied). The new lists follow the
    blank-line pattern §2 already uses.
12. **GitHub's web labels in §1 step 7** were not re-checked today; that text is unchanged.

## E. Corrections that belong to other owners

Exact replacement text. Line numbers are at base 1655729. None of these is applied.

### `.env.example` — tooling-engineer (single-writer)

Line 50, the header example:

```text
old: # OTLP headers, e.g. "Authorization=Basic <base64>". dev/staging/prod.
new: # OTLP headers, e.g. Authorization=Basic%20<base64 of instanceId:token> (no space, no quotes; docs/SERVICES-SETUP.md §11 step 3). dev/staging/prod.
```

Line 68:

```text
old: # Personal API key (phx_…) with only error tracking write + organization read: build-time dSYM/R8 mapping upload only. dev; CI: GitHub secret (iOS/Android workflows).
new: # Personal API key (phx_…), access "Organizations", preset "Source map upload" (error tracking write + organization read only): build-time dSYM/R8 mapping upload only. dev; CI: GitHub secret (iOS/Android workflows).
```

Line 74 (the access mode is untested until the key exists, D1):

```text
old: # Personal API key (phx_…) for `just observability-sync`: project, feature_flag, hog_function read/write; its owner is a project admin. dev only; never a CI secret.
new: # Personal API key (phx_…) for `just observability-sync`: access "Projects" (this project); Project, Feature flag and Hog function set to Write (Write includes Read); its owner is a project admin. dev only; never a CI secret.
```

### `tools/observability/README.md` — tooling-engineer

Line 41:

```text
old: 2. `just secrets-edit dev` and fill the seven keys above, then `just secrets-sync`.
new: 2. `just secrets-edit dev` and fill the seven keys above (type the whole `KEY: value` line for a key the file does not have: `secrets-edit` seeds key names only when it creates the file), then `just secrets-sync`.
```

Lines 118–119 (official pages now mark the alerting provisioning routes for removal, no date given):

```text
old: notifications.alerting.grafana.app/v1beta1). The legacy routes remain operative with no removal
     date (checked 2026-09-27). PostHog `/api/environments/*` is a deprecated alias of `/api/projects/*`.
new: notifications.alerting.grafana.app/v1beta1). The legacy routes still work; Grafana's API reference
     marks the alerting provisioning routes "deprecated and will be removed in a future release", with
     no date (checked 2026-10-03). PostHog `/api/environments/*` is a deprecated alias of `/api/projects/*`.
```

### `docs/observability/**` — no agent's write set covers it; the lead (main session)

`docs/observability/grafana.md`, the two table cells at lines 19 and 20 (run `just format` afterwards,
the table is width-aligned):

```text
line 19 old cell: `https://otlp-gateway-<region>.grafana.net/otlp`. **Empty = export disabled**, so tests, CI and local runs need no Grafana account.
line 19 new cell: the URL under **OTLP Endpoint** on the stack's OpenTelemetry tile, for example `https://otlp-gateway-prod-<region>.grafana.net/otlp` (copy it, never build it). **Empty = export disabled**, so tests, CI and local runs need no Grafana account.
line 20 old cell: `Authorization=Basic <base64 of instanceId:token>` (secret)
line 20 new cell: `Authorization=Basic%20<base64 of instanceId:token>` (secret; built in `docs/SERVICES-SETUP.md` §11 step 3)
```

`docs/observability/grafana.md` lines 46–47 and the cell at line 123, and `docs/observability/README.md`
line 60: all three say the CI row waits on a workflow change. The push step is already in
`.github/workflows/pr-gate.yml:228-237`; only the two GitHub secrets are missing.

```text
grafana.md 46-47 old:   summary job of `.github/workflows/pr-gate.yml`. The CI panels stay empty until that workflow change
                        lands (human) and the `OTEL_EXPORTER_OTLP_*` GitHub secrets exist.
grafana.md 46-47 new:   summary job of `.github/workflows/pr-gate.yml`. The CI panels stay empty until the
                        `OTEL_EXPORTER_OTLP_*` GitHub secrets exist (`docs/SERVICES-SETUP.md` §11 step 7).
grafana.md 123 old cell: No, until `just ci-pr-gate-metrics` runs in pr-gate's summary job (workflow change, human) with the `OTEL_EXPORTER_OTLP_*` secrets set
grafana.md 123 new cell: No, until the `OTEL_EXPORTER_OTLP_*` GitHub secrets are set (pr-gate's summary job already runs `just ci-pr-gate-metrics`)
README.md 60 old cell:   empty until `just ci-pr-gate-metrics` ([`tools/ci-metrics/`](../../tools/ci-metrics/README.md)) runs in pr-gate's summary job: that needs the workflow change (human) and the `OTEL_EXPORTER_OTLP_*` secrets
README.md 60 new cell:   empty until the `OTEL_EXPORTER_OTLP_*` GitHub secrets exist; pr-gate's summary job already runs `just ci-pr-gate-metrics` ([`tools/ci-metrics/`](../../tools/ci-metrics/README.md))
```

`docs/observability/grafana.md` lines 130–131, 139 and 145: the menu is **Alerts & IRM**, then
**Alerting**, on the official pages. Replace "Alerting → Silences", "Alerting → Alert rules" and
"Alerting → History" with "Alerts & IRM → Alerting → Silences", "Alerts & IRM → Alerting → Alert
rules" and "Alerts & IRM → Alerting → History". (Not seen live.)

`docs/observability/posthog.md`:

```text
line 50 old:    prod use `secrets/<env>.enc.yaml`. The PostHog prod project arrives in P03.
line 50 new:    prod use `secrets/<env>.enc.yaml`. The PostHog prod project arrives in P03; the free plan allows
                one project, so it needs the pay-as-you-go plan or a second organization.
lines 77-78 old: The region (US Cloud) was set when the project was created and cannot change; moving to EU means a
                 new project (ADR-0007, OQ-07).
lines 77-78 new: The region (US Cloud) was set when the project was created. PostHog moves a project to the other
                 region only for Scale or Enterprise customers, so on the free plan moving to EU means a new
                 organization and project on EU Cloud (ADR-0007, OQ-07).
```

`docs/observability/posthog/README.md`:

```text
lines 19-20 old: `POSTHOG_SYNC_API_KEY` scopes: `project:read`, `project:write`, `feature_flag:read`,
                 `feature_flag:write`, `hog_function:read`, `hog_function:write`, limited to the one project. The
lines 19-20 new: `POSTHOG_SYNC_API_KEY` scopes: `project:write`, `feature_flag:write` and `hog_function:write` (in
                 the create form: the rows Project, Feature flag and Hog function set to Write), with
                 "Organization & project access" set to "Projects" and the one project selected. The
lines 53-54 old: is the only delete. Archived flags are listed only with `?archived=true`, which the sync does not
                 request yet, so a registry key whose flag is archived fails its create with a 400. New flags keep
lines 53-54 new: is the only delete. Archived flags are listed only with `?archived=true`; the sync requests that
                 list too and warns about a registry key whose flag is archived instead of creating it. New flags keep
```

The second pair is stale against `tools/observability/posthog.mjs:74-80`, which already requests
`?archived=true` and warns. Line 30 of the same file calls `/api/projects/<id>/` "PostHog's canonical
path"; the public API reference documents project read and update only under
`/api/organizations/{organization_id}/projects/{id}/` (the root path works today but is hidden from
the API docs). That is a decision for `tools/observability/posthog.mjs`'s owner, not a wording fix.

`docs/observability/grafana/README.md` lines 40–43 carry the same "no removal date as of 2026-09"
claim as `tools/observability/README.md` above; line 55's "Grafana splits on `,`, `;` and newlines" is
not confirmed on any official page (D6).

### `secrets/README.md` — human (`secrets/**` is human-only)

Lines 13–14:

```text
old: CI public recipients for every environment, and `dev.enc.yaml` contains all `.env.example` keys
     with empty values ready to be filled as services are provisioned. The matching CI private identity
new: CI public recipients for every environment, and `dev.enc.yaml` was created with every key
     `.env.example` had at that time; a key added to `.env.example` later is typed in through
     `just secrets-edit dev`. The matching CI private identity
```

### `docs/SERVICES-SETUP.md` outside Part B — human

Line 93 makes the same claim ("`secrets/dev.enc.yaml` contains every `.env.example` key with an empty
value ready to be filled as services are provisioned"). It is outside the two sections this proposal
covers, so it is not in the diff. If wanted, replace that clause with "`secrets/dev.enc.yaml` was
created with every key `.env.example` had at that time (later keys are typed in, step 8)".

### `docs/adr/0007-observability-backend.md` — human (ADR body)

Line 38, one clause. The rest of the ADR matches what was seen: Grafana Cloud in an EU region, PostHog
in US Cloud.

```text
old: (Grafana Cloud EU; PostHog Cloud US — a rejection of US means a new PostHog EU project and re-pointing `POSTHOG_HOST` / `POSTHOG_CLI_HOST`)
new: (Grafana Cloud EU; PostHog Cloud US — a rejection of US means a new PostHog organization and project on EU Cloud, because PostHog moves a project between regions only for Scale or Enterprise customers, and re-pointing `POSTHOG_HOST` / `POSTHOG_CLI_HOST`)
```

Two sentences of the ADR depend on question F1 and are otherwise still true: line 37 ("The exact
Grafana Cloud stack region is visible in the Grafana Cloud portal, not recorded in the repo") and line
23 ("id recorded in the secret store").

### `planning/16-risks-open-questions-and-decision-log.md` — human

The same exit-path wording, twice. This sharpens how the recorded exit works; it does not reopen
DEC-58. Whether to edit in place or add a dated amendment is the human's call
(`.claude/rules/human-only.md`, invariant 2).

```text
line 68 (OQ-07) old:   if it rejects US, a new PostHog EU project is required (DEC-48 exit trigger)
line 68 (OQ-07) new:   if it rejects US, a new PostHog organization and project on EU Cloud is required, because PostHog moves a project between regions only for Scale or Enterprise customers (DEC-48 exit trigger)
line 145 (DEC-58) old: for PostHog US that means a new EU project)
line 145 (DEC-58) new: for PostHog US that means a new organization and project on EU Cloud)
```

Not a wording fix, but a conflict the reports expose in planning: `planning/14-observability-operations-and-analytics.md:15`
and DEC-48 keep PostHog only "before any paid usage", while P03 plans a second (production) project
and the free plan allows one (question F6).

### Linear AI-17 — human

The issue text says "OpenTelemetry → Configure → Generate token". The button is **Generate now** under
**Password / API Token**, and the CI token is a Cloud access policy with `metrics:write`, not a tile
token.

### Code comments — api-engineer and platform-engineer

Three comments use the EU ingestion host as their example while the project is in US Cloud:
`apps/api/src/config.ts:27` (api-engineer), `apps/api/src/platform/feature-flags/create-feature-flags.ts:15`
and `apps/api/src/platform/feature-flags/posthog-feature-flags.ts:59` (platform-engineer). Replace
`https://eu.i.posthog.com` with `https://us.i.posthog.com` in the first two; the third also says "the
SDK's default is the US region", so its owner rewords it.

## F. Questions to answer before applying

Blocking the apply:

1. **Should the doc name the real accounts, or stay name-independent?** The diff stays
   name-independent: `<stack>`, "the organization", "the project". That matches ADR-0007, which keeps
   the region and the project id out of the repo. If you prefer names in the doc, add these two
   sentences after applying, and edit ADR-0007 lines 23 and 37 to match:
   - §11 step 1, after "No step depends on the name.": "As of 2026-10-03 the stack is `hugesnail1458`
     (`https://hugesnail1458.grafana.net`), region `prod-eu-north-0`."
   - §10 step 2, after "finds the project by its numeric id.": "As of 2026-10-03 the organization is
     `Garderi Test` and the project is `Default project`, id `630358`."

   A third option is to rename the accounts to the names the old doc prescribed (`ai-stylist`,
   `ai-stylist-dev`). Whether either vendor allows that rename was not checked.
2. **Do you accept the explicit access policy and the `Basic%20` spelling as the documented way?**
   Both research reports recommend them and today's token was made that way. The alternative, a token
   from the OpenTelemetry tile, carries five scopes this project does not need.
3. **Keep the `gh` sentence in §1 step 7?** It is the one statement in the diff that nobody verified
   (row 2). Either check it with `gh secret set --help` and `gh variable set --help`, or delete the
   sentence that begins "From a terminal in the repo" before applying.
4. **Is the token on a command line acceptable?** The `printf` line in §11 step 3 is what was run
   today, and it leaves the token in the shell history. A variant that reads the token without
   echoing it and keeps it out of the history was **not** run today:

   ```bash
   read -rs GLC_TOKEN
   printf '%s:%s' '<instance id>' "$GLC_TOKEN" | base64 | tr -d '\n'; unset GLC_TOKEN
   ```

   The same applies to the `<base64>` pasted into the existing curl test in §11 Verify.

Not blocking, but owed:

5. **Service account role.** Admin is documented and was used today. The least-privilege alternative
   (basic role None plus the fixed roles for data sources, alerting provisioning and folders) is
   untested on the Free plan. Keep Admin?
6. **PostHog production project.** The free plan allows one project. P03 needs a paid plan (a card on
   file) or a second organization, and DEC-48 says to exit PostHog Cloud before any paid usage. Which
   one, and does it need a decision-log entry?
7. **The leftover tile token.** An earlier attempt left a token named `garderi` under the tile's
   `stack-<number>-otlp-write` policy: never used, no expiry, eight scopes. Delete it?
8. **Where do expiry dates live?** `planning/11-security-privacy-and-compliance.md` §5.3 puts the
   rotation inventory in the ops runbook, and `docs/runbooks/` has no such file. The diff says
   "password manager or calendar". Today's Grafana tokens expire on 2027-01-01.
9. **`organization:read` puts an organization-scoped key into CI** (D10). Accept, as PostHog's docs
   require it?
10. **Grafana trial end, 2026-10-11** (D8). Who confirms the stack is on Free afterwards?

## G. Apply and check

From the repo root, on a branch (a human, or one authorized session). The first command extracts the
one block fenced with four backticks:

```bash
awk '/^````diff$/{f=1;next} /^````$/{f=0} f' .claude/plans/2026-10-03-services-setup-observability-proposal.md > /tmp/services-setup.patch
git apply --check /tmp/services-setup.patch   # dry run, changes nothing
git apply /tmp/services-setup.patch
just format --check                           # prettier covers docs/; run `just format` if it reports the file
just docs-check
```

Then, once per item of Part E, hand the replacement text to its owner. The first real test of the new
§10 step 5 is creating `POSTHOG_SYNC_API_KEY`; the first real test of §11 step 7 is the `ci-metrics`
token. Update Part D's items 1 and 2 in a new note when either is done (this file is history once
applied).

How the diff was checked here: `git apply` is not in this agent's command allowlist. The block above
is byte-identical to the output of `diff -u` between `docs/SERVICES-SETUP.md` at base 1655729 and the
proposed text, and a line-by-line dry run of the block against the base file (context and removed
lines compared at their stated positions, hunk counts checked) reproduces the proposed text exactly.
Neither check writes a file. The `awk` and `git apply` lines above were not run by this agent.
