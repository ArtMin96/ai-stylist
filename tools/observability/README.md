# tools/observability: `just observability-sync`

Pushes the version-controlled Grafana and PostHog definitions to the vendors over their HTTP APIs,
so nobody clicks through a vendor UI. What gets pushed, in which order and with which tokens is the
contract in [docs/observability/grafana/README.md](../../docs/observability/grafana/README.md) and
[docs/observability/posthog/README.md](../../docs/observability/posthog/README.md). This file covers
running the tool, what it guarantees and how to extend it. Node 24 built-ins only: it runs without
`node_modules`, in a fresh worktree and in CI.

## Usage

```bash
just observability-sync all --check        # offline checks only: no network, no env (CI-safe)
just observability-sync --dry-run          # read the current state (GET only), print every call a run would send
just observability-sync                    # check, then apply both vendors (target defaults to all)
just observability-sync grafana            # one vendor: grafana | posthog | all
just observability-sync --prune            # also delete what has no file any more (see below)
```

`--check` and `--dry-run` exclude each other; `--check` cannot take `--prune`. `--root <dir>` reads
the definitions below another directory (the tests use it). Exit codes: 0 done, 1 a finding, a
missing env key or a failed call, 2 a usage error.

## Environment

The recipe loads the repo-root `.env` that `just secrets-sync` writes (Node `--env-file`; a value
already exported, by direnv or CI, wins). Only the chosen target's keys are required.

- Grafana: `GRAFANA_URL`, `GRAFANA_SERVICE_ACCOUNT_TOKEN` (service account with the Admin role),
  `GRAFANA_ALERT_EMAILS`, `GRAFANA_ONCALL_TIMEZONE` (an IANA zone).
- PostHog: `POSTHOG_CLI_HOST` (app host, not the ingestion host), `POSTHOG_CLI_PROJECT_ID`
  (numeric), `POSTHOG_SYNC_API_KEY` (personal key; scopes in the PostHog contract).

URLs must be `https://` (plain `http://` only for a loopback host). A missing or malformed key is
reported by name; its value is never printed.

## First run (human, once per stack)

1. Create the Grafana service-account token and the PostHog sync key with the roles and scopes the
   two contracts list.
2. `just secrets-edit dev` and fill the seven keys above, then `just secrets-sync`.
3. `just observability-sync all --check`, then `just observability-sync --dry-run` and read the plan.
4. `just observability-sync`. Run it a second time: every line must say `unchanged`.

## What a run does

1. Loads every definition and runs the offline checks. Any finding stops the run before the first
   call, so a bad file never half-applies.
2. Grafana: resolves everything a write depends on first (Grafana Cloud's Prometheus datasource:
   uid `grafanacloud-prom` if it exists, else the one `prometheus` datasource named
   `grafanacloud-<stack>-prom`; every token), then folder `ai-stylist`, contact points, mute
   timings, notification policy, one rule group per `alerts/*.json`, one dashboard per
   `dashboards/*.json`, then rule groups and dashboards in the folder that have no file.
3. PostHog: project settings, GeoIP transformation, flags. A new flag is created off at 0 %; an
   existing flag only ever gets its name updated, never `active` or `filters`. A registry key whose
   flag is archived in PostHog is reported as a `WARN`, never created again. A 403 on the
   transformation calls prints the manual step and the run goes on; a listed template that matches
   no transformation is a `WARN`.

Idempotent: every object is read first and sent only when it differs, so a second run changes
nothing and a dashboard gets no new version. A dashboard must equal its file exactly (`id` and
`version` excepted). An alerting object is compared on the top-level keys its file sets, because
Grafana adds keys of its own (`provenance`, `id`, `updated`); below the top level the comparison is
exact, so a removed label, route or query is still a change. A key missing on one side equals a
zero value (`""`, `0`, `false`, `null`, `[]`, `{}`) on the other, as Go and Python servers echo them.
Each alert query `model` is first given what Grafana stores with it (its query's `refId`,
`intervalMs` 1000 and `maxDataPoints` 43200 when missing or 0), and is compared and sent in that
form.

`--prune` deletes, in Grafana, the rule groups and dashboards in folder `ai-stylist` that have no
file, and soft-deletes (`deleted: true`) the PostHog flags whose name carries `[registry:` but whose
key left the registry (archived flags are left alone). Without it they are reported as `WARN` lines.

## Output and secrets

One line per call (`grafana: update contact point ai-stylist-oncall: PUT /api/...`, prefixed
`[dry-run]` in a dry run), `unchanged` lines, `WARN` lines for orphans and expired flags, and a
summary per vendor. Every line passes through a mask of the secret values (both keys, the alert
addresses list and each address), so no code path can print one. HTTP errors print method, path and
status only, never a response body; 401 and 403 add a hint.

## Files

- `sync.mjs`: the CLI (arguments, env, order of the two vendors).
- `check.mjs`: the offline checks. `tokens.mjs`: token scan, placement rules and substitution.
- `grafana.mjs`, `posthog.mjs`: one vendor each. `http.mjs`: fetch, pagination, dry run.
- `compare.mjs`: the equality rules above. `inputs.mjs`: file loading. `output.mjs`: masked output.
- `tests/sync.test.mjs` with `tests/stubs.mjs` (local Grafana and PostHog stand-ins).
- `fixtures/<case>/`: broken definitions that `--check` must reject.

## Tests and fixtures

`just test tooling` runs `scripts/test/observability-sync.test.sh` (`node --test`). The tool runs as a
child process with synthetic keys and an env built from scratch against the stubs, never a real
service; every run asserts that no secret value was printed. Each `fixtures/<case>/` tree is laid
over a staged copy of the real inputs, and `--check` must print exactly the `ERROR` lines in the
case's `.expect` file. A new check ships with a new case.

## API calls

The calls below follow the two contracts. Re-check them against the vendors' API reference when a
call starts failing:

- Grafana: `GET /api/datasources`; `GET /api/folders/ai-stylist`, `POST /api/folders`;
  `GET|POST /api/v1/provisioning/contact-points`, `PUT /api/v1/provisioning/contact-points/<uid>`;
  `GET|POST /api/v1/provisioning/mute-timings`, `PUT /api/v1/provisioning/mute-timings/<name>`;
  `GET|PUT /api/v1/provisioning/policies`;
  `GET|PUT|DELETE /api/v1/provisioning/folder/ai-stylist/rule-groups/<title>`;
  `GET /api/v1/provisioning/alert-rules`; `GET /api/dashboards/uid/<uid>`, `POST /api/dashboards/db`,
  `DELETE /api/dashboards/uid/<uid>`; `GET /api/search?type=dash-db&folderUIDs=ai-stylist`.
- PostHog (base `/api/projects/<id>`): `GET|PATCH /`; `GET /hog_functions/?type=transformation`
  (the list names the template as `template.id` only), `PATCH /hog_functions/<id>/`;
  `GET /feature_flags/` and `GET /feature_flags/?archived=true` (both paginated),
  `POST /feature_flags/`, `PATCH /feature_flags/<id>/`.

Grafana 13 deprecates every `/api` route above in favour of `/apis/…` (dashboard.grafana.app/v1,
folder.grafana.app/v1, rules.alerting.grafana.app/v0alpha1,
notifications.alerting.grafana.app/v1beta1). The legacy routes remain operative with no removal
date (checked 2026-09-27). PostHog `/api/environments/*` is a deprecated alias of `/api/projects/*`.
