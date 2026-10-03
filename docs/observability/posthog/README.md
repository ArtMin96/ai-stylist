# PostHog definitions (source of truth)

`just observability-sync` applies these definitions to the PostHog project named by
`POSTHOG_CLI_PROJECT_ID`. Developer guide: [../posthog.md](../posthog.md).

> Status (2026-09-27): implemented in `tools/observability/` (P02-T09) and tested against local
> stubs. Until its first run against the project, a human applies the same settings in PostHog.

## Inputs

| Input                                                | Content                                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-settings.json`                              | `project`: the body of one project `PATCH`. `disabledTransformationTemplates`: transformation template ids that must be disabled (`template-geoip`). |
| `packages/shared-kernel/registry/feature-flags.json` | the flag registry (schema beside it)                                                                                                                 |
| env `POSTHOG_CLI_HOST`                               | API host, `https://us.posthog.com` (not the ingestion host)                                                                                          |
| env `POSTHOG_CLI_PROJECT_ID`                         | numeric project id                                                                                                                                   |
| env `POSTHOG_SYNC_API_KEY`                           | personal API key (`phx_…`), sent as `Authorization: Bearer <key>`                                                                                    |

`POSTHOG_SYNC_API_KEY` scopes: `project:read`, `project:write`, `feature_flag:read`,
`feature_flag:write`, `hog_function:read`, `hog_function:write`, limited to the one project. The
key's owner must be a project admin: `anonymize_ips`, `autocapture_opt_out`, `heatmaps_opt_in`,
`capture_console_log_opt_in` and `capture_performance_opt_in` are admin-only, and the PATCH always
sends the whole `project` object (`session_recording_opt_in`, `surveys_opt_in` and
`autocapture_exceptions_opt_in` are member-level). Each `:write` scope includes its `:read`. Keep it
out of CI. The symbol-upload key `POSTHOG_CLI_API_KEY` keeps only `error_tracking:write` and
`organization:read`, so a leaked CI key cannot change settings or flags.

PostHog's key form does not show those `object:action` strings; they appear only in the key list
after a key exists. To create either key, open `https://us.posthog.com/settings/user-api-keys`
(settings sidebar: **Account** → **Personal API keys**) and click **Create personal API key**. The
form has a **Label**, an **Organization & project access** choice (**All access**, **Organizations**
or **Projects**) and, under **Scopes**, one row per scope with **No access**, **Read** or **Write**.

| Key                    | **Label**            | **Organization & project access**                                          | **Scopes**                                                                                                                                                         |
| ---------------------- | -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POSTHOG_SYNC_API_KEY` | `observability-sync` | **Projects**, then tick the project in **Select projects…**                | type in **Search scopes…** and set **Write** on the rows **Project**, **Feature flag** and **Hog function**; no preset covers this set                             |
| `POSTHOG_CLI_API_KEY`  | `symbol-upload`      | **Organizations**, then tick the organization in **Select organizations…** | **Select preset** → **Source map upload**, which sets **Error tracking** to **Write** and **Organization** to **Read** and leaves every other row on **No access** |

Click **Create key**. The dialog **Personal API key ready** shows the value once; copy it before
closing, because PostHog never shows it again. The symbol-upload key must use **Organizations**: the
**Organization** row is not available on a key limited to **Projects**.

Not confirmed yet (2026-10-03), because the sync key has not been created:

- The row labels **Project**, **Feature flag** and **Hog function** come from PostHog's frontend
  source, not from the live form. The rest of the form was seen live.
- A key limited to **Projects** has not been tried on `GET` and `PATCH /api/projects/<id>/` (step 1
  under Calls). If `just observability-sync posthog --dry-run` answers 403 on that path, edit the
  key and change its access to **Organizations**.

## Calls (base `${POSTHOG_CLI_HOST}/api/projects/${POSTHOG_CLI_PROJECT_ID}`)

PostHog's API reference documents the transformation and flag calls (steps 2 and 3) under
`/api/projects/<id>/`. It documents reading and updating the project itself (step 1) only at
`/api/organizations/<organization id>/projects/<id>/`. The `/api/projects/<id>/` form the sync uses
for step 1 is left out of the reference on purpose and is the one PostHog's own app calls (source
comment: "hidden from the API docs, but used in the app"; checked 2026-10-03), so step 1 relies on
an undocumented path. `/api/environments/<id>/` is a deprecated alias, and multiple environments per
project no longer exist.

1. **Settings.** `GET /` and compare with `project`. If anything differs, `PATCH /` with the whole
   `project` object.
2. **Transformations.** `GET /hog_functions/?type=transformation`. For each function whose template
   id is in `disabledTransformationTemplates` and that is enabled, `PATCH /hog_functions/<id>/` with
   `{"enabled": false}`. On 403, print the human step instead: Data pipelines → Transformations →
   GeoIP → disable. `type` takes a comma-separated list; the list response names the template as
   `template.id` (`template_id` only with `?full=true`).
3. **Flags.** `GET /feature_flags/` and `GET /feature_flags/?archived=true` (both paginated). For
   each registry key:
   - In neither list: `POST /feature_flags/` with
     `{"key": "<key>", "name": "<purpose> [registry: owner <person-id>, <kind>, expires <expiresAt or never>]", "active": false, "filters": {"groups": [{"properties": [], "rollout_percentage": 0}]}}`.
     A new flag is **off**. Turning it on or rolling it out is a human decision in PostHog, audited
     (planning/14 §10, §11).
   - Only in the archived list: no call. The sync prints a `WARN` line asking to unarchive the flag
     in PostHog or retire the key, because creating the key again would fail with a 400.
   - Present: `PATCH /feature_flags/<id>/` with `{"name": …}` only when the name differs. Never touch
     `active` or `filters`.
   - A PostHog flag whose name contains `[registry:` but whose key is gone from the registry gets
     reported. With `--prune`: `PATCH /feature_flags/<id>/` with `{"deleted": true}` (soft delete).
   - Warn about registry flags past `expiresAt`. The expired-flag report (`just flags-report`, run
     nightly) is the gate.

   `active: false` must be sent (PostHog's default is `true`). `DELETE` is refused (405); soft delete
   is the only delete. Archived flags are listed only with `?archived=true`, which is why the sync
   requests that list as well. New flags keep `evaluation_runtime: "all"` and no evaluation
   contexts, so posthog-node's remote evaluation returns them; an inactive flag evaluates to `false`
   (reason `flag_disabled`).

The sync is idempotent. `--dry-run` sends GET requests only, needs the same env as a real run, and
prints every call a real run would send. The template id is read from `template.id`. Soft-deleted
flags (`deleted: true`) are ignored. The key is never printed.
