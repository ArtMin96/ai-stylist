# Grafana definitions (source of truth)

These files define everything in the Grafana Cloud stack that is not data: dashboards, alert rules,
the contact point, mute timings and the notification policy (ADR-0007). `just observability-sync`
pushes them over the Grafana HTTP API. Change a file here and re-run the sync; do not edit these
objects in the Grafana UI. The sync overwrites the UI copy, and the alerting objects are locked there.

> Status (2026-10-03): `just observability-sync` is implemented in `tools/observability/` (P02-T09)
> and tested against local stubs. Its first run against the dev stack was on 2026-10-03
> (`just observability-sync grafana`: 8 created, 1 updated; the second run: 9 unchanged).

## Files and API calls

The sync works in this order. Every object lives in the folder with uid `ai-stylist`.

| #   | File                       | Grafana object                  | Call                                                                                                                                            |
| --- | -------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | none                       | folder `ai-stylist`             | `GET /api/folders/ai-stylist`; on 404 `POST /api/folders` with `{"uid":"ai-stylist","title":"AI Stylist"}`                                      |
| 2   | `contact-points.json`      | array of `EmbeddedContactPoint` | per item, by `uid`: `PUT /api/v1/provisioning/contact-points/<uid>`; `POST /api/v1/provisioning/contact-points` if it does not exist            |
| 3   | `mute-timings.json`        | array of `MuteTimeInterval`     | per item, by `name`: `PUT /api/v1/provisioning/mute-timings/<name>`; `POST /api/v1/provisioning/mute-timings` if it does not exist              |
| 4   | `notification-policy.json` | the whole policy tree (`Route`) | `PUT /api/v1/provisioning/policies` (replaces the tree)                                                                                         |
| 5   | `alerts/*.json`            | one `AlertRuleGroup` per file   | `PUT /api/v1/provisioning/folder/ai-stylist/rule-groups/<title>` with the file as body                                                          |
| 6   | `dashboards/*.json`        | one dashboard model per file    | `POST /api/dashboards/db` with `{"dashboard": <file>, "folderUid": "ai-stylist", "overwrite": true, "message": "observability-sync <git sha>"}` |

Before the first write the sync resolves `${PROM_DATASOURCE_UID}` (`GET /api/datasources`) and every
other token, then reads each object and sends it only when it differs, so a failed lookup changes
nothing.

Field notes the sync relies on:

- An `AlertRuleGroup` has `title`, `folderUid`, `interval` (seconds) and `rules`. Each rule carries a
  stable `uid`, `ruleGroup` equal to the group `title`, `folderUID` `ai-stylist`, `condition`, `data`,
  `noDataState`, `execErrState`, `for`, `labels` and `annotations`. No `orgID`: the token sets the org.
- Grafana stores every `data[].model` with `intervalMs` (default 1000) and `maxDataPoints`
  (default 43200) filled in, expressions included. Every model in `alerts/*.json` states both, so a
  stored rule equals its file and a second sync leaves it unchanged.
- A dashboard has a stable `uid` and `"id": null`. Its panels use Grafana's own `${datasource}` variable,
  so no datasource token is needed there. The `message` in row 6 is meant as the version note;
  Grafana 13.3.0 recorded the first version as "Initial save" instead (seen 2026-10-03), and whether
  a later version keeps the sync's message has not been seen.
- Send no `X-Disable-Provenance` header. Provisioned alerting objects then stay read-only in the UI.
- Every `/api` route in the table is deprecated since Grafana 13 in favour of `/apis/…`. Grafana's
  API reference marks the alerting provisioning routes (`/api/v1/provisioning/…`, rows 2 to 5) with
  "This API is deprecated and will be removed in a future release" and names the App Platform
  alerting APIs as the replacement. It gives no removal date or version (checked 2026-10-03), so
  the routes work until a Grafana release removes them, and that release is not announced. Grafana
  Cloud stacks upgrade automatically: this stack ran Grafana 13.3.0 on 2026-10-03, and
  `GET /api/health` shows the current version. Every call here behaves the same on 12.x and 13.x.

## Tokens

The sync replaces upper-case tokens only. Lower-case `${datasource}` and `$env` are Grafana dashboard
variables and pass through unchanged.

| Token                     | Allowed in                                  | Replaced with                                                                                                                                           | Source                                                                              |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `${OWNERS:<role>}`        | any string                                  | display names of the role's members, joined with `, `                                                                                                   | `packages/shared-kernel/registry/owners.json`: `roles.<role>`, then `people[].name` |
| `${OWNER_TAGS:<role>}`    | a whole element of a dashboard `tags` array | one `owner:<person-id>` tag per member                                                                                                                  | same file                                                                           |
| `${PROM_DATASOURCE_UID}`  | alert `datasourceUid`                       | `grafanacloud-prom` when a `prometheus` datasource has that uid; otherwise the uid of the one `prometheus` datasource named `grafanacloud-<stack>-prom` | `GET /api/datasources`; without that uid, fail on zero or several name matches      |
| `${GRAFANA_ALERT_EMAILS}` | contact point `settings.addresses`          | the value, verbatim: one address or a comma-separated list (separators: see the note below)                                                             | env `GRAFANA_ALERT_EMAILS`                                                          |
| `${ONCALL_TIMEZONE}`      | mute timing `location`                      | an IANA zone, for example `Europe/Berlin`                                                                                                               | env `GRAFANA_ONCALL_TIMEZONE`                                                       |

The sync fails on an unknown upper-case token, an unknown or empty role, or an empty env value. People
and addresses never appear in these files.

Separators in `GRAFANA_ALERT_EMAILS` (checked 2026-10-03). Grafana's source code splits an email
contact point's addresses on `,`, `;` and newlines (`receivers/delimited_strings.go` in
`github.com/grafana/alerting`), and its description of the **Addresses** field reads "You can enter
multiple email addresses using a ";", "\n" or "," separator". Grafana's documentation pages state no
rule; their one example separates two addresses with `;`. The first sync run (2026-10-03) sent the
configured value, and the email integration reported no error when the alert fired. A list of
several addresses has not been checked on this stack.

## Offline checks (`--check`, no network, CI-safe)

- Every file parses as JSON.
- Every alert rule has `labels.severity` in `SEV1`, `SEV2`, `SEV3` and `labels.owner_role` naming a role
  in `owners.json`. A rule without a severity would reach the root policy and page at any hour.
- Every alert rule has the annotations `summary` and `runbook_url`. The URL has the form
  `https://github.com/ArtMin96/ai-stylist/blob/main/docs/runbooks/<file>.md`, and that file exists
  (planning/14 §7: an alert without a runbook cannot ship).
- Rule `uid`s are unique, and each rule's `ruleGroup` equals its group's `title`.
- Every receiver and mute timing named in `notification-policy.json` exists in `contact-points.json`
  or `mute-timings.json`.
- No `@` outside a token, so no email address is committed by accident.
- Each token appears only where the Tokens table allows it, and `${OWNER_TAGS:<role>}` is a whole
  `tags` element.
- Every group has `folderUid` `ai-stylist`, a positive `interval` and a title no other file uses, and
  every rule has `folderUID` `ai-stylist`.
- Every dashboard has `"id": null` and a unique `uid`. Contact-point uids and names, and mute-timing
  names, are unique.
- Every mute-timing weekday range runs forward from `sunday` to `saturday` (for example
  `monday:friday` or `sunday:saturday`). Grafana counts Sunday as day 0 and rejects `monday:sunday`
  with a 400.

## Environment keys

| Key                             | Secret              | Value                                                                                                                                                                                                                                                            |
| ------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GRAFANA_URL`                   | no                  | stack URL, `https://<stack>.grafana.net`                                                                                                                                                                                                                         |
| `GRAFANA_SERVICE_ACCOUNT_TOKEN` | yes                 | service-account token (`glsa_…`) with the Admin role. Admin is the smallest basic role that covers every call: `GET /api/datasources` needs `datasources:read`, which among basic roles only Admin holds (Admin also holds `fixed:alerting.provisioning:writer`) |
| `GRAFANA_ALERT_EMAILS`          | yes (personal data) | comma list of on-call addresses                                                                                                                                                                                                                                  |
| `GRAFANA_ONCALL_TIMEZONE`       | no                  | IANA zone that quiet hours (23:00–08:00) follow                                                                                                                                                                                                                  |

One stack serves every environment, so these keys live in `secrets/dev.enc.yaml`. Set them with
`just secrets-edit dev` and load them with `just secrets-sync`. The sync never prints the token or
the addresses.

## Behaviour

- Idempotent: a second run changes nothing.
- `--dry-run` sends GET requests only and prints every create, update and delete a real run would
  send.
- `--prune` deletes the rule groups and dashboards in folder `ai-stylist` that have no file. The sync
  finds them with `GET /api/v1/provisioning/alert-rules` (rules whose `folderUID` is `ai-stylist`,
  grouped by `ruleGroup`) and `GET /api/search?type=dash-db&folderUIDs=ai-stylist`. Without
  `--prune` it reports them as `WARN` lines.
- An alert rule's evaluation interval is its group's `interval` (60 s here). Alerts assume the OTel
  SDK's default 60 s metric export interval.
