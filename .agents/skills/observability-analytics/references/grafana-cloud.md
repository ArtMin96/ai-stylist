# Grafana Cloud — reference

> A reference file inside `observability-analytics`, not a standalone skill. Open it when a task
> touches the Grafana Cloud account itself: a token, the OTLP header, a call that
> `just observability-sync` makes, where to look in the Grafana screens, or a free-tier limit.
> General Grafana knowledge (PromQL, dashboard JSON, alerting concepts, Loki, Tempo) is not here;
> Grafana Labs publishes skills for that. How a dashboard or alert file is written is in
> `docs/observability/grafana/README.md`.

Last reviewed: 2026-10-03

## How to read this file

Words used below, for a reader who has never used Grafana Cloud:

- A **stack** is one Grafana Cloud environment: its own Grafana website plus the databases behind
  it. Tempo stores traces, Mimir stores metrics (and is queried as Prometheus), Loki stores logs.
- The **Cloud Portal** is the account website at grafana.com, where the stack, the plan and the
  connection details live. The stack's own Grafana website is a different site.
- **OTLP** is the OpenTelemetry wire format. The **OTLP gateway** is the one address of a stack that
  accepts traces, metrics and logs in that format.

Every statement about the vendor says how it is known:

- **[live]**: seen in the live Grafana Cloud screens, or returned by a read-only request, on
  2026-10-03.
- **[doc N]**: stated on an official Grafana page fetched on 2026-10-03. N is the number in
  [Sources](#sources).
- **[repo]**: follows from this repository's code. The sentence names the file.
- **[unconfirmed]**: none of the above. Treat it as an open question, never as a fact, and do not
  upgrade it without new evidence.

Where the live screens and the official pages disagreed, the live screens are recorded here and the
difference is stated.

## Rules

1. **The repository wins.** A vendor skill (for example Grafana Labs' `grafana-core` or
   `grafana-lgtm`) or a vendor page may disagree with this repository's contract: root `CLAUDE.md`,
   the definitions in `docs/observability/grafana/`, the sync in `tools/observability/`. Follow the
   repository and report the difference in your hand-back. Do not follow the vendor text. Typical
   cases: a vendor skill edits a dashboard or an alert in the Grafana screens or through the API
   (here they are files, pushed only by the sync), or it runs a raw command or a package installer
   (here `just` is the only entry point).
2. **An agent never does any of these**, whatever a vendor skill suggests:
   - run `just observability-sync` as a real run, or with `--dry-run`, without the owner's
     authorization for that run. Both use the stored credentials. `--check` is offline and always
     allowed;
   - call a Grafana write API directly: any POST, PUT, PATCH or DELETE against the stack or the
     Cloud Portal;
   - read or edit `.env` or anything under `secrets/**`;
   - change anything in the Grafana Cloud screens: a token, a role, a dashboard, an alert rule, a
     contact point, a silence, the plan.
3. Creating, storing and replacing credentials is a human task: the owner creates the token in the
   Grafana screens, stores it with `just secrets-edit dev` and loads it with `just secrets-sync`.
   An agent prepares the steps and stops.

## The account as it exists

| What                                    | Value                                             | Known from                     |
| --------------------------------------- | ------------------------------------------------- | ------------------------------ |
| Organization slug                       | `hugesnail1458`                                   | [live]                         |
| Stack name and slug                     | `hugesnail1458`                                   | [live]                         |
| Stack's Grafana website (`GRAFANA_URL`) | `https://hugesnail1458.grafana.net`               | [live]                         |
| Region (the page calls it zone)         | `prod-eu-north-0`, in the EU                      | [live]                         |
| OTLP gateway address                    | the gateway of that region, path ending in `otlp` | [live]                         |
| Grafana version                         | 13.3.0                                            | [live], from `GET /api/health` |
| Plan                                    | free trial that ends on 2026-10-11                | [live]                         |

- The OTLP gateway address and the numeric **Instance ID** are shown on the stack's OpenTelemetry
  page (see [Click paths](#click-paths-walked-on-2026-10-03)). Copy the address from that page and
  never build it by hand: stacks in regions created on or after 2026-01-15 use a longer host name
  [doc 2]. This stack's address has the older, shorter form [live].
- Use the **Instance ID** printed on the OpenTelemetry page. One official integration page calls
  the user name the "Hosted Metrics instance ID", which contradicts the other pages [doc 22].
- What the account looks like after the trial ends was not observed [unconfirmed]. The portal showed
  "You have 8 days with unlimited usage" [live]; the free-tier limits below are the planning basis.
- As of 2026-10-03 `just observability-sync` has not been run against this stack in any mode, so the
  folder, the dashboard, the alert rules, the contact point and the routing do not exist there yet
  [live].

## Two kinds of token

Grafana Cloud has two unrelated kinds of credential, and this repository uses one of each. They are
not interchangeable: each is rejected where the other is expected [doc 3] [doc 6].

|                        | Access policy token                                                          | Service account token                                                   |
| ---------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Value starts with      | `glc_` [live]                                                                | `glsa_` [live]                                                          |
| Created under          | **Administration** → **Users and access** → **Cloud access policies** [live] | **Administration** → **Users and access** → **Service accounts** [live] |
| What grants its rights | the **scopes** ticked on its access policy                                   | the **role** of its service account                                     |
| Can                    | send telemetry to the stack's OTLP gateway                                   | call the Grafana HTTP API of the stack, which the sync does             |
| Cannot                 | call the Grafana HTTP API                                                    | send telemetry to the OTLP gateway                                      |
| Env key it feeds       | `OTEL_EXPORTER_OTLP_HEADERS`                                                 | `GRAFANA_SERVICE_ACCOUNT_TOKEN`                                         |
| How it is sent         | HTTP Basic: the Instance ID as user name, the token as password              | `Authorization: Bearer <token>`                                         |
| Shown again later      | no, once only [live]                                                         | no, once only [live]                                                    |

The credentials in the account on 2026-10-03 [live]:

| Credential                                                                | Kind            | Rights                                                    | Expires           | Feeds                                                     |
| ------------------------------------------------------------------------- | --------------- | --------------------------------------------------------- | ----------------- | --------------------------------------------------------- |
| policy `api-dev`, token `api-dev`                                         | access policy   | scopes `metrics:write`, `logs:write`, `traces:write` only | 2027-01-01        | `OTEL_EXPORTER_OTLP_HEADERS` for the API, jobs and worker |
| service account `observability-sync`, token `observability-sync-20261003` | service account | role **Admin**                                            | 2027-01-01        | `GRAFANA_SERVICE_ACCOUNT_TOKEN` for the sync              |
| a `ci-metrics` policy and token                                           | access policy   | scope `metrics:write` only                                | not created       | GitHub secrets, for the CI row of dashboard 01            |
| policy `stack-<instance id>-otlp-write`, token `garderi`                  | access policy   | the eight fixed scopes of the OpenTelemetry tile          | never; never used | nothing. A leftover the owner may delete                  |

- A policy created inside the stack has its realm (the thing it applies to) set to that stack
  automatically [doc 4]. The `api-dev` policy shows realm `prod-eu-north-0` and state Active [live].
- The eight fixed scopes of the tile are `metrics:write`, `metrics:import`, `logs:write`,
  `traces:write`, `alerts:write`, `rules:write`, `profiles:write` and `datadog:validate` [live].
  That is broader than the API needs, which is why the dev token was made through an explicit
  policy instead.
- Organization-level access policies were not inventoried: the page that lists them could not be
  opened in the session, so a leftover there is possible [unconfirmed].
- Sixteen service accounts named `extsvc-…` belong to Grafana's own plugins. Leave them alone
  [live].

### Why the service account has the Admin role

Admin is the only basic role that the official role tables show covering every call the sync makes
[doc 7] [doc 8] [doc 23]:

- `GET /api/datasources` needs the permission `datasources:read` on every data source. Among the
  basic roles only Admin holds it for all data sources.
- Admin holds `fixed:alerting.provisioning:writer`, which "does not require user to have any
  additional permissions". Editor holds only `fixed:alerting.provisioning.provenance:writer`.
- Admin holds the dashboard and folder writer roles; Editor holds only the creator roles.

Whether the Editor role would also work is [unconfirmed]: no page lists the permissions per
provisioning endpoint. A narrower setup (basic role None plus three fixed roles from the role
picker) is documented in general, but whether this plan's role picker offers fixed roles is
[unconfirmed]. Do not narrow the role without the owner; a 403 from the sync is the symptom of a
role that is too small.

## Env keys on the Grafana side

All values are stored by a human with `just secrets-edit dev` and reach `.env` through
`just secrets-sync`. What the code checks is [repo] `tools/observability/sync.mjs` unless noted.

| Key                             | What it is                                                        | What the code checks                                                                   |
| ------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT`   | the OTLP gateway address, ending in `otlp`                        | empty means export is off. Not read by the sync                                        |
| `OTEL_EXPORTER_OTLP_HEADERS`    | the Basic credential, see the next section                        | nothing validates it. Not read by the sync                                             |
| `GRAFANA_URL`                   | the stack's Grafana website                                       | must be https (http only for a loopback host, for the tests)                           |
| `GRAFANA_SERVICE_ACCOUNT_TOKEN` | the `glsa_` token                                                 | non-empty only                                                                         |
| `GRAFANA_ALERT_EMAILS`          | on-call addresses (personal data), written into the contact point | non-empty only; put into the contact point's `addresses` field unchanged               |
| `GRAFANA_ONCALL_TIMEZONE`       | the time zone that quiet hours (23:00–08:00) follow               | must start with a letter and be a zone name the JavaScript runtime accepts; no offsets |

- The sync masks the token, the address list and each single address in every line it prints [repo]
  `tools/observability/output.mjs`.
- **Several alert addresses:** the repository's docs say Grafana splits the list on commas,
  semicolons and newlines. The official email page shows only a semicolon between addresses and
  says "Email addresses are case sensitive" [doc 10]. That a comma works is [unconfirmed]; a single
  address avoids the question.
- **Time zone:** write the full area and city name, for example Europe/Berlin. The repository's
  check is looser than that (it also accepts short names such as CET), and what Grafana itself
  accepts in a mute timing is [unconfirmed].

## The OTLP header the three consumers accept

`OTEL_EXPORTER_OTLP_HEADERS` holds one HTTP Basic credential: the base64 text of
`<Instance ID>:<token>`, Instance ID first [doc 1]. The value stored for this stack is spelled

```text
Authorization=Basic%20<base64 of instanceId:token>
```

with `%20` where a space would be, and no line break inside the base64 text.

Three programs read this key:

| Consumer                      | Where                                                         | How it reads the value                                        |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| API and jobs processes (Node) | `apps/api/src/platform/telemetry/telemetry.ts`                | the OTLP exporters read the env key themselves                |
| Segmentation worker (Python)  | `workers/ml/segmentation/src/ai_stylist_segmentation/main.py` | `OTLPSpanExporter()` reads the env key itself                 |
| CI metrics push               | `tools/ci-metrics/push-pr-gate-metrics.mjs`                   | its own parser: comma-separated `name=value`, percent-decoded |

- The `%20` spelling is the one Grafana prescribes for Python [doc 1], and it has no space that a
  shell or an env-file loader could split on.
- A probe on 2026-10-03 sent both spellings (`Basic%20` and `Basic` followed by a space) through
  all three consumers against a local stand-in server, and each arrived as a correct
  `Authorization: Basic …` header. The probe used the installed exporter versions (Node exporters
  0.222.0, Python exporter 1.45.0) and was not re-run for this file. The CI parser's
  percent-decoding is [repo].
- `docs/SERVICES-SETUP.md` and `.env.example` show the spelling with a space. Both work; store the
  `%20` form.
- The portal's ready-made environment variables appear only after a token is made through the
  OpenTelemetry tile, which was not used. How the portal itself spells the header is [unconfirmed].
- The exporters are the protobuf-over-HTTP ones, fixed in code [repo]. The protocol variable the
  portal also offers is not needed.
- Each consumer adds the signal path to the endpoint itself (the CI script adds the metrics path
  [repo]), so the stored endpoint stays as the portal shows it.

Checked on 2026-10-03 with the `api-dev` token [live]: an empty payload posted to the traces path
returned 200, to the metrics path 200, to the logs path 204, and the same request with a made-up
token returned 401. An empty payload stores nothing, so this is the test to use after a rotation.
The official check posts a real span instead [doc 5].

## What the sync calls in Grafana

[repo] `tools/observability/grafana.mjs`, sent by `tools/observability/http.mjs` with
`Authorization: Bearer <token>`. Every object lives in the folder with uid `ai-stylist` (title "AI
Stylist").

| Step                | Read                                                                                            | Write (only when the file differs)                                          |
| ------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Data source lookup  | `GET /api/datasources`                                                                          | none                                                                        |
| Folder              | `GET /api/folders/ai-stylist`                                                                   | `POST /api/folders`                                                         |
| Contact points      | `GET /api/v1/provisioning/contact-points`                                                       | `POST` to the same path, or `PUT /api/v1/provisioning/contact-points/<uid>` |
| Mute timings        | `GET /api/v1/provisioning/mute-timings`                                                         | `POST` to the same path, or `PUT /api/v1/provisioning/mute-timings/<name>`  |
| Notification policy | `GET /api/v1/provisioning/policies`                                                             | `PUT /api/v1/provisioning/policies`                                         |
| Alert rule groups   | `GET /api/v1/provisioning/folder/ai-stylist/rule-groups/<title>`                                | `PUT` to the same path, for a create as well as an update                   |
| Dashboards          | `GET /api/dashboards/uid/<uid>`                                                                 | `POST /api/dashboards/db`                                                   |
| Orphans             | `GET /api/v1/provisioning/alert-rules` and `GET /api/search?type=dash-db&folderUIDs=ai-stylist` | with `--prune` only: `DELETE` of the rule group or the dashboard            |

- The data source lookup runs because every alert file uses the `${PROM_DATASOURCE_UID}` token. It
  takes the Prometheus data source with uid `grafanacloud-prom`, else exactly one named
  `grafanacloud-<stack>-prom` [repo]. This stack has uid `grafanacloud-prom`, named
  `grafanacloud-hugesnail1458-prom`, and a second Prometheus source `grafanacloud-usage` that the
  sync ignores by design [live].
- The sync sends no `X-Disable-Provenance` header, so the alerting objects it creates are read-only
  in the Grafana screens [repo]. That lock is intended.
- `--check` sends nothing. `--dry-run` sends the reads only and prints each write it would send.
- A 401 means the token was rejected (expired, revoked or mistyped). A 403 means the role is too
  small [repo] `tools/observability/sync.mjs`.

## Where to look in the Grafana screens

The left menu entries **Administration** → **Users and access** were walked [live]. The paths in
this section come from official pages and were not walked in this stack, because nothing has been
synced yet.

- **A trace by its id:** **Explore** → pick the Tempo data source → **TraceQL** tab → paste the
  trace id → **Run query** [doc 11]. `{ trace:id = "<id>" }` works too.
- **A trace by correlation id:** in the same tab, `{ span.correlation_id = "<id>" }`. The spans
  carry that attribute [repo] `apps/api/src/platform/telemetry/correlation.ts`; the query has not
  been run against this stack [unconfirmed]. The log-first route is in
  `.agents/skills/observability-analytics/references/opentelemetry.md`.
- **A link to a trace:** **Share** in the Explore toolbar gives a short link; choose an option
  under **Time-Sync URL Links** for a fixed time range [doc 12].
- **A fired alert:** **Alerts & IRM** → **Alerting** → **Alert rules**, where the rule
  `queue.job.dlq` sits in group `queue`; and **Alerts & IRM** → **Alerting** → **History**
  [doc 13] [doc 14].
- **The contact point:** **Alerts & IRM** → **Alerting** → **Notification configuration**, tab
  **Contact points** [doc 10].
- **The dashboard:** **Dashboards** → folder "AI Stylist" → "01 Service health". For a link:
  **Share** → **Share internally** → **Copy link** [doc 15].

Anyone who opens a link needs a login to the stack, and data older than the retention is gone.

## Free-tier limits that matter here

| Limit                                                     | Why it matters in this repository                                              | Known from |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| 10,000 active metric series                               | never put a user id, event id or other unbounded value on a metric             | [doc 16]   |
| 50 GB of logs, 50 GB of traces, 50 GB of profiles a month | traces are sampled at 100 % today; a volume jump needs a look at usage         | [doc 16]   |
| 14 days of retention                                      | evidence links and screenshots must be taken promptly; an older flow is gone   | [doc 16]   |
| 3 active users                                            | inviting a fourth person is not possible on this plan                          | [doc 16]   |
| one stack per free account                                | dev, staging and prod share this stack and differ by the environment attribute | [doc 17]   |
| 1,000 dashboards and 1,000 folders per stack              | far away; listed for completeness                                              | [doc 18]   |
| 500 alert rules, 1,000 instances per rule                 | far away; listed for completeness                                              | [doc 19]   |

- An access policy token's expiry is optional. An organization can set a maximum, and the stack's
  admins get warning emails before a token of a stack policy expires [doc 3].
- A service account token has no expiry unless one is set [doc 6] [live]. Whether Grafana warns
  before it expires is [unconfirmed].
- No free-tier cap on the number of service accounts or tokens is stated on the pages fetched
  [unconfirmed].
- Leaving the free tier is an ADR, not a setting to change (the skill's "Stop / escalation").

## Click paths walked on 2026-10-03

All labels below are [live]. They are recorded so a human can repeat them; an agent does not click
them (Rules).

**Getting in**

1. Open `https://grafana.com/` and click **My account** in the header. This opens the Cloud Portal
   for the organization.
2. Under "Manage your Grafana Cloud stack" the stack's card has two buttons, **Launch** and
   **Details**. Click **Details**. The page "Manage Stack: hugesnail1458" opens.
3. On the **OpenTelemetry** tile click **Configure**. The page shows the address under "OTLP
   Endpoint" and the number under "Instance ID". Its section "Password / API Token" has the link
   **Generate now**; do not use it for the dev token (see below).
4. Back on "Manage Stack", click **Launch** on the **Grafana** tile (or **Launch Grafana Cloud** at
   the top right). This signs in to the stack's Grafana website. Opening the stack's address
   directly showed a sign-in page instead; go through **Launch**.

**The OTLP token (access policy token)**

5. In the stack's Grafana: left menu **Administration** → **Users and access** → **Cloud access
   policies**.
6. Click **Create access policy**. The dialog "Create new access policy" opens. Type the **Display
   name** (`api-dev`; **Name** fills itself). In the **Scopes** table tick **Write** on the rows
   `metrics`, `logs` and `traces`. Click **Create**.
7. On the new policy's card click **Add token**. The dialog "Create new token" opens. Type the
   **Token name**. Open the **Expiration date** list and choose **90 days**; the dialog then says
   which day the token expires. The list's other entries are "No expiry" (the default), "30 days",
   "60 days" and "Choose an expiration date". Click **Create**.
8. The dialog "Token successfully added." shows the token once ("Copy the token. It will be shown
   only once."). Copy the **Token** field, then click **Close**.
9. Build the header value in a terminal that no agent can see: join the Instance ID, a colon and
   the token, base64-encode that text without a trailing line break, and put
   `Authorization=Basic%20` in front.

The **Generate now** link on the OpenTelemetry page was opened and closed without creating
anything. Its dialog "Create an API token" has a read-only "Access policy name", a "Token name"
field, an "Expiration" list ("No expiry" by default; 30, 90, 180 or 365 days; "Choose an expiration
date") and the eight fixed scopes listed earlier. The official pages do not describe this dialog.

A `ci-metrics` token is made the same way: step 6 with **Write** ticked on the `metrics` row only,
then step 7. The tile cannot make it, because its scopes are fixed. Whether the gateway accepts a
metrics-only token on the metrics path is [unconfirmed]; the traces page says a token without
`traces:write` gets a 401 there [doc 5].

**The service account token**

10. Left menu **Administration** → **Users and access** → **Service accounts** → **Add service
    account**.
11. On the page "Create service account" type the **Display name** (`observability-sync`). Click
    **Role**, which shows "No roles assigned"; under "Basic roles" choose **Admin**; click
    **Apply**; then click **Create**.
12. On the account's page, under "Tokens", click **Add service account token**. Type the **Display
    name**. Under "Expiration" click **Set expiration date**; the default is "No expiration".
13. Click the "Expiration date" field. It starts at tomorrow, in month/day/year order. In the
    calendar press **›** until the month is right and click the day. There is no 90-day preset.
    Click **Generate token**.
14. The dialog "Service account token created" shows the token once. Copy the **Token** field and
    click **Close**.

Differences from the official pages: they describe the token dialog's fields as a display name and
a typed date [doc 4] and set the role after creating the account [doc 6]. The live screens have a
"Token name" field with a list of periods, and a role picker in the create form. The live screens
win.

## Known deprecations

- **The alerting provisioning API.** The official reference marks the contact point, notification
  policy, mute timing and alert rule endpoints the sync calls as "deprecated and will be removed in
  a future release", in favour of the Grafana App Platform alerting APIs. It gives no date [doc 9].
- **The older API routes in general.** The same page says that, starting in Grafana 13, the routes
  whose path begins with "api" are being deprecated in favour of routes whose path begins with
  "apis" [doc 9]. This stack already runs Grafana 13.3.0 [live].
- `tools/observability/README.md` and `docs/observability/grafana/README.md` say these routes
  "remain operative with no removal date". That is still true as far as a date goes, but the
  official wording is stronger: removal is announced. A sync call that starts failing with 404 or
  410 is this deprecation arriving; report it to the owner of `tools/observability/` and do not
  work around it.

## Vendor material an agent may read

- `https://grafana.com/llms.txt` and `https://grafana.com/llms-full.txt` index the documentation.
  Any docs page comes as Markdown when `.md` is appended to its address, or when it is requested
  with the header `Accept: text/markdown` [doc 20].
- Grafana Labs' skills `grafana-core` (dashboards, PromQL, alerting, OpenTelemetry) and
  `grafana-lgtm` (Loki, Tempo, Prometheus, Mimir) carry general knowledge, when the owner has
  installed them. They need no credential. Rule 1 applies to everything they say.
- Grafana's MCP servers and the `gcx` command-line tool can write dashboards and alert rules, which
  is exactly what the sync owns. They are not set up here, and adding one needs an ADR (planning
  doc 15 §12.5).

## Where this repository's docs differ from what was seen

These are recorded so nobody follows the stale line. The files are outside this skill; their owners
apply the fix.

- `docs/SERVICES-SETUP.md` §11 says to create a stack named `ai-stylist`. The stack is named
  `hugesnail1458`, and a free account has one stack [live] [doc 17].
- The same section says "select the stack, then **Configure**". The stack card's buttons are
  **Launch** and **Details**; **Details** leads to the tile page [live].
- It says to generate a token with "role write" and to copy the ready-made variables. There is no
  role field, the tile's scopes are fixed and broad, and the variables appear only after a tile
  token is made [live].
- It says to add the service account token "with a 90-day expiry". There is no such preset; a date
  is picked in a calendar [live].
- Its credential test says to take the text after `Authorization=Basic` and a space. With the
  stored spelling the text follows `Authorization=Basic%20`.
- `docs/observability/grafana.md` writes "Alerting → Silences", "Alerting → Alert rules" and
  "Alerting → History". The official pages put each under **Alerts & IRM** → **Alerting**
  [doc 13] [doc 14].
- `docs/observability/grafana.md` and `docs/observability/README.md` say the CI row waits for a
  workflow change. The push step is already in `.github/workflows/pr-gate.yml`; only the two
  GitHub secrets are missing [repo].
- `docs/observability/grafana.md` and `docs/SERVICES-SETUP.md` give the endpoint as one fixed
  pattern. Newer regions use a longer host name [doc 2].
- `docs/observability/grafana/README.md` says Grafana splits the alert address list on commas,
  semicolons and newlines. No page fetched says so; only a semicolon appears in an official example
  [doc 10].

## Sources

Official pages, all fetched on 2026-10-03:

1. `https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/`
2. `https://grafana.com/docs/grafana-cloud/security-and-account-management/region-url-formats/`
3. `https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/security-and-access/authentication-and-permissions/access-policies/`
4. `https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/security-and-access/authentication-and-permissions/access-policies/create-access-policies/`
5. `https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/add-access-policy/` and
   `https://grafana.com/docs/grafana-cloud/observe-and-act/send-data/traces/set-up/verify-ingestion/`
6. `https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/security-and-access/authentication-and-permissions/service-accounts/`
7. `https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/rbac-fixed-basic-role-definitions/`
8. `https://grafana.com/docs/grafana/latest/alerting/set-up/configure-rbac/access-roles/`
9. `https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy/alerting_provisioning/`
10. `https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-email/`
11. `https://grafana.com/docs/grafana/latest/datasources/tempo/query-editor/traceql-editor/`
12. `https://grafana.com/docs/grafana/latest/visualizations/explore/get-started-with-explore/`
13. `https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-rules/`
14. `https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-state-history/`
15. `https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/`
16. `https://grafana.com/pricing/`
17. `https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/stack-plans/`
18. `https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/usage-limits/`
19. `https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-grafana-managed-rule/`
20. `https://grafana.com/llms-full.txt`
21. `https://grafana.com/docs/grafana-cloud/platform/security-and-account-management/account-management/cloud-portal/`
22. `https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-infrastructure/integrations/integration-reference/integration-claude-code/`
23. `https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy/data_source/`
