# PostHog: product analytics, crash reporting, feature flags

PostHog Cloud US handles consent-gated product analytics, native crash and error tracking, and
feature flags (ADR-0007, which also records the OQ-07 data-residency caveat; planning/14 §5, §9,
§11). Traces, metrics and logs go to Grafana, not PostHog ([grafana.md](grafana.md)).

## How it works

**Native apps (iOS, Android).** Product code calls one `Analytics` port. `ConsentGatedAnalytics` is
off by default, and consent is kept in memory only until P03 persists it. Before the first opt-in the
PostHog sink gets no call at all: no SDK setup, no network, no crash handler. Opting in sets up the
SDK with error-tracking autocapture on. Crashes are written to disk and sent after the next opt-in,
except a crash that happened after a withdrawal (iOS drops it at the next setup; Android uninstalls
its handler on withdrawal). Withdrawing consent opts the SDK out and discards what it has not sent
yet; it never flushes. Autocapture, screen views, lifecycle events, replay, surveys, flag preload and
breadcrumbs are all off. Details, and the only files that see the SDK:

- iOS: [apps/ios/README.md, "Analytics and crash reporting (PostHog)"](../../apps/ios/README.md#analytics-and-crash-reporting-posthog)
- Android: [apps/android/README.md, "Analytics and crash reporting (PostHog)"](../../apps/android/README.md#analytics-and-crash-reporting-posthog)

Event names come only from `packages/contracts/events/analytics/events.json`. Android uses the
generated `AnalyticsTaxonomy`; iOS names are hand-written and must equal the file byte for byte. In
P02 the only event is `app_opened`. Every build has the user-facing consent toggle ("Share anonymous
usage data", off by default), and any build compiled with a `POSTHOG_API_KEY` sends after opt-in.
CI-built APKs and apps carry no ingestion key, so they bind the no-op sink. Persisted consent
arrives in P03.

**API (server).** The API reads feature flags through the `FeatureFlags` port
(`packages/shared-kernel/src/feature-flags.ts`). The posthog-node adapter lives in `platform`
([`apps/api/src/platform/feature-flags/README.md`](../../apps/api/src/platform/feature-flags/README.md)).
Every flag is declared in `packages/shared-kernel/registry/feature-flags.json`. With an empty
`POSTHOG_API_KEY` every check returns the flag's `defaultWhenUnavailable`, so local runs, tests and
CI need no PostHog project. With a key, a flag that is inactive in PostHog reads as off; only an
unreachable, erroring or quota-limited PostHog returns `defaultWhenUnavailable`. A check never
throws. The server sends no product events. Server exceptions are found in Grafana. Routing them to
PostHog error tracking (planning/14 §5) is not part of the P02 wiring.

## Configuration

| Key                      | Value                                                                                                                                                                                                                                   | Used by                                  | Where it lives                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTHOG_API_KEY`        | project key `phc_…`. Public by design (it ships inside the apps), but never committed. A personal `phx_…` key is rejected by both apps and by the API config (`apps/api/src/config.ts`), which also requires `POSTHOG_HOST` with a key. | apps (compiled in), API flags            | sops → `.env`. iOS: `apps/ios/Config/Local.xcconfig` (gitignored) or the build environment. Android: Gradle property or environment. Never set in CI. |
| `POSTHOG_HOST`           | `https://us.i.posthog.com` (ingestion, US Cloud)                                                                                                                                                                                        | same                                     | same. Never set in CI.                                                                                                                                |
| `POSTHOG_CLI_API_KEY`    | personal key `phx_…` with only `error_tracking:write` and `organization:read`                                                                                                                                                           | dSYM and R8 mapping upload               | sops → `.env`. CI: secret.                                                                                                                            |
| `POSTHOG_CLI_PROJECT_ID` | numeric project id                                                                                                                                                                                                                      | symbol upload, `just observability-sync` | sops → `.env`. CI: variable.                                                                                                                          |
| `POSTHOG_CLI_HOST`       | `https://us.posthog.com`, the app and API host (not ingestion). Required even though posthog-cli defaults to it: the symbol upload is skipped and the sync refuses to run without it.                                                   | same                                     | sops → `.env`. CI: variable.                                                                                                                          |
| `POSTHOG_SYNC_API_KEY`   | personal key `phx_…`, scopes in [posthog/README.md](posthog/README.md)                                                                                                                                                                  | `just observability-sync` only           | sops → `.env` on a developer machine. Never a GitHub secret.                                                                                          |

Set values with `just secrets-edit dev`, then `just secrets-sync` (direnv loads `.env`). Staging and
prod use `secrets/<env>.enc.yaml`. The PostHog prod project is planned for P03. PostHog's Free plan
allows 1 project and its pay-as-you-go plan 6 (posthog.com/pricing, checked 2026-10-03), so a prod
project cannot be added beside the dev one on the Free plan. P03 has to settle that against DEC-48
(exit before any paid usage).

CI: `POSTHOG_CLI_API_KEY` is a GitHub **secret**; `POSTHOG_CLI_HOST` and `POSTHOG_CLI_PROJECT_ID` are
**variables**. The Android `build` job (`.github/workflows/android.yml`) and the iOS `macos` job
(`.github/workflows/ios.yml`) get only these three symbol-upload values, and only on `main`. No
workflow passes `POSTHOG_API_KEY` or `POSTHOG_HOST`, so CI-built APKs and apps carry no ingestion
key and send nothing. Pull requests upload nothing. None of the three is set in GitHub as of
2026-10-03; until all three exist, the `main` builds skip the upload and still pass.

Human-only steps: creating the organization and projects (`docs/SERVICES-SETUP.md` §10), creating the
two personal keys, and adding the GitHub secrets and variables. The two personal keys stay separate:
`POSTHOG_CLI_API_KEY` has only `error_tracking:write` and `organization:read`; `POSTHOG_SYNC_API_KEY`
has `project`, `feature_flag` and `hog_function` read and write, and its owner is a project admin. A
leaked CI key then cannot change settings or flags. What to select in PostHog's key form for each:
[posthog/README.md](posthog/README.md#inputs).

## Project settings

`just observability-sync` applies [`posthog/project-settings.json`](posthog/project-settings.json) and
reports anything it cannot change.

| Setting                                                           | Value                                         | Why                                                                            |
| ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ |
| Exception autocapture (`autocapture_exceptions_opt_in`)           | on                                            | crash reporting (planning/14 §5). The apps also enable it in their SDK config. |
| Discard client IP data (`anonymize_ips`)                          | on                                            | no IP stored (planning/11 §8)                                                  |
| GeoIP transformation                                              | off (disabled by the sync, else a human step) | no location enrichment (planning/11 §7.4)                                      |
| Session replay (`session_recording_opt_in`)                       | off                                           | no screenshots or view hierarchies (planning/14 §5)                            |
| Surveys, heatmaps, autocapture, console logs, performance capture | off                                           | nothing is captured beyond the declared events                                 |

The region (US Cloud) was set when the project was created. PostHog moves a project to another
region only for customers on its Scale or Enterprise plan, and a PostHog engineer runs that move
(posthog.com/docs/settings/projects, checked 2026-10-03). On the Free plan, moving to EU therefore
means a new organization and project on EU Cloud (ADR-0007, OQ-07).

## Symbol upload

- iOS: `just ios-build [--config dev|preview|prod]` (macOS) uploads the dSYMs when all three
  `POSTHOG_CLI_*` values are set, and prints a notice otherwise.
- Android: `just android-build preview` or `just android-build release` runs the `com.posthog.android`
  Gradle plugin's `uploadPostHogProguardMappings<Variant>`. The task is `SKIPPED` without all three
  values.
- `posthog-cli` must be on PATH. `mise.toml` pins it (`npm:@posthog/cli`), so `just bootstrap`
  installs it and `just doctor` checks it. `POSTHOG_CLI_HOST` must be `https://us.posthog.com` (the
  app host, not the ingestion host).

Crash demo, step by step: the iOS and Android README sections linked above (P02 AC-6).

## Feature flags

Flags gate rollout and experiments only, never paid capability. A premium check sits behind the
entitlement check (planning/14 §11).

**Add a flag**

1. Add an entry to `packages/shared-kernel/registry/feature-flags.json`: `owner` (a person id from
   `owners.json`), `purpose`, `kind`, `createdAt`, `expiresAt` (at most 90 days for `rollout`; none for
   `kill-switch`), `rolloutPlan`, `offBehavior` (off must be a safe rollback) and
   `defaultWhenUnavailable`. The shared-kernel tests check it. The package is single-writer.
2. `just observability-sync` creates the flag in PostHog, **off**.
3. Check it in code with `featureFlags.isEnabled('<key>')`. The key type comes from the registry, so a
   typo fails `just typecheck`.
4. Roll out in PostHog by the `rolloutPlan`. This is a human decision, and prod changes are audited.

**Retire a flag**: remove its last check and its registry entry in the same change. Never rename or
reuse a key. After the merge, `just observability-sync --prune` soft-deletes it in PostHog.

Kill-switch flags are permanent and listed in runbook 10 (ships with P11). `just flags-report` lists
every registry flag with its owner and days left ([`tools/flags/README.md`](../../tools/flags/README.md)).
The nightly `expired-flags` job in `.github/workflows/nightly.yml` runs it every day at 03:00 UTC
and fails on a rollout or experiment flag past `expiresAt` (> 30 days overdue = DEFECT). The job
reads only the flag and owner registries in the repo, so it needs no GitHub secret or variable. A
red nightly job is investigated; it does not block a merge.

## Privacy rules

- Nothing leaves the device before analytics consent (planning/11 §7.2): no events, no SDK setup, no
  crash handler.
- Only event names from `events.json`. Properties are enums, booleans, counts and ids (planning/14 §9).
  A new event is a contract change first (`.agents/skills/api-contract-change/SKILL.md`).
- No session replay, screenshots, view hierarchies, logcat or console capture. No breadcrumbs.
- No key from `packages/shared-kernel/registry/forbidden-log-keys.json` in any property (planning/11 §8).
- Person profiles are identified-only, IPs are discarded, GeoIP is off.
- Account deletion deletes the PostHog person (planning/11 §13.2 step 3, built in P03).

## Troubleshooting

| Symptom                                    | Check                                                                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No events or crashes at all                | Consent is off (expected until opted in), or `POSTHOG_API_KEY` is empty, which binds the no-op sink.                                                                                           |
| Build, launch or API start rejects the key | It is a personal `phx_` key. Use the project `phc_` key. The API also refuses a key without `POSTHOG_HOST`.                                                                                    |
| Events sent, nothing in PostHog            | `POSTHOG_HOST` must be the ingestion host `https://us.i.posthog.com`.                                                                                                                          |
| iOS crash never arrives                    | A debugger was attached (it disables the crash handler), or consent was not switched on again after the relaunch.                                                                              |
| Stack trace not symbolicated               | The upload was skipped (a `POSTHOG_CLI_*` value missing), the project id is wrong, `POSTHOG_CLI_HOST` is not `https://us.posthog.com`, or `posthog-cli` is not on PATH (`just doctor`).        |
| Flag always returns its default            | The API has no `POSTHOG_API_KEY`, or PostHog is unreachable, erroring or quota-limited. A missing or inactive flag reads as off, not as its default: run the sync, then turn it on in PostHog. |
| Sync fails with 403                        | The sync key lacks a scope, or its owner is not a project admin.                                                                                                                               |
