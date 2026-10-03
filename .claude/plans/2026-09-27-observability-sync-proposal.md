# Proposal: catalog, CI and setup-doc changes for `just observability-sync` (AI-17, P02-T09 step C1)

> Status: PARTIALLY APPLIED (2026-09-27, AI-17) — Parts B and C applied (justfile); Parts A and D
> in scratchpad ai-17-human.patch. Per part: B APPLIED (`ci-parity` runs `observability-sync all
> --check`) and C APPLIED (`test-tooling`), both by the lead. A and D PENDING in the human-applied
> ai-17-human.patch; there, Part A's row ends with "(`ci-parity` runs `all --check`)", Part D's
> step 6 also names the GitHub secrets and variables (the iOS and Android workflows now upload), and
> Part D's PostHog host is `https://us.posthog.com`: the project exists in US Cloud (DEC-58), so
> the `eu.posthog.com` in Part D below is superseded. Proposed 2026-09-27 by tooling-engineer
> (worktree agent-af7728db3b1771292, base f625cf2).

The recipe itself (`observability-sync` in the root `justfile`), the tool (`tools/observability/`),
its test (`scripts/test/observability-sync.test.sh`) and the `.env.example` keys are in the same
change. Until Part A lands, `just docs-check --strict` (run by `just ci-parity`) reports:

```
ERROR DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'observability-sync' (just --summary) missing from the §5 catalog
```

## Part A: `planning/15-team-workflow-and-ai-agent-operations.md` §5 (human-only)

Insert one row directly after the `just secrets-backup-done` row:

```diff
 | `just secrets-backup-done` | Record that your age identity is backed up in the password manager (marker file checked by just doctor) |
+| `just observability-sync [grafana\|posthog\|all] [--check\|--dry-run\|--prune]` | Push the version-controlled Grafana (`docs/observability/grafana/**`) and PostHog (`docs/observability/posthog/project-settings.json`, the flag registry) definitions over the vendors' HTTP APIs; `--check` is offline and CI-safe, `--dry-run` sends only GETs, `--prune` removes what has no file (`tools/observability/README.md`) |
```

## Part B: run the offline check in the PR gate (lead or C2; no workflow change needed)

Recommended: add it to `ci-parity`, which pr-gate's parity job already runs (`just ci-parity --core`),
so CI and a local `just ci-parity` stay the same sequence. Place it after the docs checks:

```diff
     just docs-check --strict
     just docs-check --fixtures
+    just observability-sync all --check
     just generate --check
```

and extend the `ci-parity` doc comment's list with `observability-sync --check` (for example
"docs-check --strict (+ fixtures, incl. the hook replay), observability-sync --check, generate
--check"). `--check` reads no env and makes no network call. The fixture proof runs in `just test`
(below), which `ci-parity` also runs.

Alternative, only if `ci-parity` must not grow: a pr-gate parity-job step after
`Verify · .env.example covers every API env key`:

```yaml
      - name: Verify · Grafana and PostHog definitions (offline observability-sync check)
        run: just observability-sync all --check
```

Never run the sync without `--check` in CI: `POSTHOG_SYNC_API_KEY` and
`GRAFANA_SERVICE_ACCOUNT_TOKEN` are developer-machine keys, never GitHub secrets.

## Part C: wire the test suite into `just test tooling` (lead or C2)

```diff
 [private]
 test-tooling:
     scripts/test/bootstrap-doctor.test.sh
     scripts/test/contracts-breaking.test.sh
     scripts/test/regression.test.sh
+    scripts/test/observability-sync.test.sh
```

and in the `test` recipe's doc comment, replace
"`just test tooling` = the scripts/test shell suites: bootstrap/doctor, contracts-breaking, test-regression"
with
"`just test tooling` = the scripts/test shell suites: bootstrap/doctor, contracts-breaking, test-regression, observability-sync".

Also: `git update-index --chmod=+x scripts/test/observability-sync.test.sh` (or `chmod +x`) before
committing; the agent's shell guard does not allow `chmod`, so the file was written 0644.

## Part D: `docs/SERVICES-SETUP.md` (human-only)

§10 PostHog, append to "Steps":

```markdown
5. For `just observability-sync`: account settings, **Personal API keys**, **Create personal API key**,
   name `observability-sync`, scopes `project:read`, `project:write`, `feature_flag:read`,
   `feature_flag:write`, `hog_function:read`, `hog_function:write`, limited to the project. Your
   account must be a project admin (`anonymize_ips` is admin-only). Store it as `POSTHOG_SYNC_API_KEY`
   in `secrets/dev.enc.yaml`, with `POSTHOG_CLI_PROJECT_ID` (numeric project id) and
   `POSTHOG_CLI_HOST` (`https://eu.posthog.com`, the app host, not the ingestion host). Never a GitHub
   secret.
6. For symbol upload: a second personal key with only `error_tracking:write` and
   `organization:read`, stored as `POSTHOG_CLI_API_KEY` (and as a GitHub secret for the iOS and
   Android workflows once they upload).
```

§10 "What to record", replace the key line with:

```markdown
- `.env.example` keys: `POSTHOG_API_KEY`, `POSTHOG_HOST`, `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST`, `POSTHOG_SYNC_API_KEY`.
```

§11 Grafana Cloud, append to "Steps":

```markdown
6. For `just observability-sync`: in the stack, **Administration**, **Users and access**, **Service
   accounts**, **Add service account** `observability-sync` with role **Admin** (Admin holds the
   alerting provisioning writer role; Editor does not), then **Add service account token**. Store the
   `glsa_…` token as `GRAFANA_SERVICE_ACCOUNT_TOKEN`, the stack URL `https://<stack>.grafana.net` as
   `GRAFANA_URL`, the on-call addresses as `GRAFANA_ALERT_EMAILS` (comma list) and the on-call IANA
   zone as `GRAFANA_ONCALL_TIMEZONE`, all in `secrets/dev.enc.yaml` (one stack serves every
   environment). Then `just secrets-sync`, `just observability-sync all --check`,
   `just observability-sync --dry-run`, `just observability-sync`.
```

§11 "What to record", replace the key line with:

```markdown
- `.env.example` keys: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`, `GRAFANA_URL`, `GRAFANA_SERVICE_ACCOUNT_TOKEN`, `GRAFANA_ALERT_EMAILS`, `GRAFANA_ONCALL_TIMEZONE`.
```

§11 step 4 still says `workers-ml`; the service names are now `api`, `jobs` and `segmentation`, each
process with its own default (`.env.example` `OTEL_SERVICE_NAME` comment).
