# PostHog definitions (source of truth)

`just observability-sync` applies these definitions to the PostHog project named by
`POSTHOG_CLI_PROJECT_ID`. Developer guide: [../posthog.md](../posthog.md).

> Status (2026-09-27): the sync is being written (P02-T09, tooling). This README is its contract. Until
> it runs, a human applies the same settings in PostHog.

## Inputs

| Input                                                | Content                                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-settings.json`                              | `project`: the body of one project `PATCH`. `disabledTransformationTemplates`: transformation template ids that must be disabled (`template-geoip`). |
| `packages/shared-kernel/registry/feature-flags.json` | the flag registry (schema beside it)                                                                                                                 |
| env `POSTHOG_CLI_HOST`                               | API host, `https://eu.posthog.com` (not the ingestion host)                                                                                          |
| env `POSTHOG_CLI_PROJECT_ID`                         | numeric project id                                                                                                                                   |
| env `POSTHOG_SYNC_API_KEY`                           | personal API key (`phx_…`), sent as `Authorization: Bearer <key>`                                                                                    |

`POSTHOG_SYNC_API_KEY` scopes: `project:read`, `project:write`, `feature_flag:read`,
`feature_flag:write`, `hog_function:read`, `hog_function:write`, limited to the one project. The
key's owner must be a project admin, because `anonymize_ips` is an admin-only setting. Keep it out of
CI. The symbol-upload key `POSTHOG_CLI_API_KEY` keeps only `error_tracking:write` and
`organization:read`, so a leaked CI key cannot change settings or flags.

## Calls (base `${POSTHOG_CLI_HOST}/api/projects/${POSTHOG_CLI_PROJECT_ID}`)

1. **Settings.** `GET /` and compare with `project`. If anything differs, `PATCH /` with the whole
   `project` object.
2. **Transformations.** `GET /hog_functions/?type=transformation`. For each function whose template
   id is in `disabledTransformationTemplates` and that is enabled, `PATCH /hog_functions/<id>/` with
   `{"enabled": false}`. On 403, print the human step instead: Data pipelines → Transformations →
   GeoIP → disable.
3. **Flags.** `GET /feature_flags/` (paginated). For each registry key:
   - Missing: `POST /feature_flags/` with
     `{"key": "<key>", "name": "<purpose> [registry: owner <person-id>, <kind>, expires <expiresAt or never>]", "active": false, "filters": {"groups": [{"properties": [], "rollout_percentage": 0}]}}`.
     A new flag is **off**. Turning it on or rolling it out is a human decision in PostHog, audited
     (planning/14 §10, §11).
   - Present: `PATCH /feature_flags/<id>/` with `{"name": …}` only when the name differs. Never touch
     `active` or `filters`.
   - A PostHog flag whose name contains `[registry:` but whose key is gone from the registry gets
     reported. With `--prune`: `PATCH /feature_flags/<id>/` with `{"deleted": true}` (soft delete).
   - Warn about registry flags past `expiresAt`. The nightly expired-flag report is the gate.

The sync is idempotent. `--dry-run` prints the planned calls, and the key is never printed.
