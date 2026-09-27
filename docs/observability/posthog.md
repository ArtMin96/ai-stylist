# PostHog: product analytics, crash reporting, feature flags

PostHog Cloud EU (Frankfurt) handles consent-gated product analytics, native crash and error
tracking, and feature flags (ADR-0007; planning/14 §5, §9, §11). Traces, metrics and logs go to
Grafana, not PostHog ([grafana.md](grafana.md)).

## How it works

**Native apps (iOS, Android).** Product code calls one `Analytics` port. `ConsentGatedAnalytics` is
off by default, and consent is kept in memory only until P03 persists it. Before the first opt-in the
PostHog sink gets no call at all: no SDK setup, no network, no crash handler. Opting in sets up the
SDK with error-tracking autocapture on. Crashes are written to disk and sent after the next opt-in.
Withdrawing consent opts the SDK out. Autocapture, screen views, lifecycle events, replay,
surveys, flag preload and breadcrumbs are all off. Details, and the only files that see the SDK:

- iOS: [apps/ios/README.md, "Analytics and crash reporting (PostHog)"](../../apps/ios/README.md#analytics-and-crash-reporting-posthog)
- Android: [apps/android/README.md, "Analytics and crash reporting (PostHog)"](../../apps/android/README.md#analytics-and-crash-reporting-posthog)

Event names come only from `packages/contracts/events/analytics/events.json`. Android uses the
generated `AnalyticsTaxonomy`; iOS names are hand-written and must equal the file byte for byte. In
P02, events (only `app_opened`) flow only from a Dev build whose developer switched on the debug
consent toggle. The real consent flow, and with it the first user events, arrives in P03.

**API (server).** The API reads feature flags through the `FeatureFlags` port
(`packages/shared-kernel/src/feature-flags.ts`). The posthog-node adapter lives in `platform`. Every
flag is declared in `packages/shared-kernel/registry/feature-flags.json`. When `POSTHOG_API_KEY` is
empty or PostHog is unreachable, the check returns the flag's `defaultWhenUnavailable` and never
throws. So local runs, tests and CI need no PostHog project. The server sends no product events.
Server exceptions are found in Grafana. Routing them to PostHog error tracking (planning/14 §5) is
not part of the P02 wiring.

## Configuration

| Key                      | Value                                                                                                                                   | Used by                                  | Where it lives                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTHOG_API_KEY`        | project key `phc_…`. Public by design (it ships inside the apps), but never committed. A personal `phx_…` key is rejected by both apps. | apps (compiled in), API flags            | sops → `.env`. iOS: `apps/ios/Config/Local.xcconfig` (gitignored) or the build environment. Android: Gradle property or environment. CI: GitHub variable. |
| `POSTHOG_HOST`           | `https://eu.i.posthog.com` (ingestion)                                                                                                  | same                                     | same                                                                                                                                                      |
| `POSTHOG_CLI_API_KEY`    | personal key `phx_…` with only `error_tracking:write` and `organization:read`                                                           | dSYM and R8 mapping upload               | sops → `.env`. CI: GitHub secret for the iOS and Android workflows.                                                                                       |
| `POSTHOG_CLI_PROJECT_ID` | numeric project id                                                                                                                      | symbol upload, `just observability-sync` | sops → `.env`. CI: GitHub variable.                                                                                                                       |
| `POSTHOG_CLI_HOST`       | `https://eu.posthog.com` (app and API host, not ingestion)                                                                              | same                                     | same                                                                                                                                                      |
| `POSTHOG_SYNC_API_KEY`   | personal key `phx_…`, scopes in [posthog/README.md](posthog/README.md)                                                                  | `just observability-sync` only           | sops → `.env` on a developer machine. Never a GitHub secret.                                                                                              |

Set values with `just secrets-edit dev`, then `just secrets-sync` (direnv loads `.env`). Staging and
prod use `secrets/<env>.enc.yaml`. The PostHog prod project arrives in P03.

Human-only steps: creating the organization and projects (`docs/SERVICES-SETUP.md` §10), creating the
two personal keys with exactly these scopes, and adding the GitHub secret and variables. The CI
workflows do not read any `POSTHOG_*` value yet. Wiring them into the iOS and Android lanes is a
workflow change for a human to apply.

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

The region (EU) was chosen when the project was created and cannot change.

## Symbol upload

- iOS: `just ios-build [--config dev|preview|prod]` (macOS) uploads the dSYMs when all three
  `POSTHOG_CLI_*` values are set, and prints a notice otherwise.
- Android: `just android-build preview` or `just android-build release` runs the `com.posthog.android`
  Gradle plugin's `uploadPostHogProguardMappings<Variant>`. The task is `SKIPPED` without all three
  values.
- `posthog-cli` must be on PATH. Install it as the iOS README says. It is not pinned in `mise.toml` yet.

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

Kill-switch flags are permanent and listed in runbook 10 (ships with P11). The nightly `expired-flags`
job in `.github/workflows/nightly.yml` is still a placeholder.

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

| Symptom                         | Check                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| No events or crashes at all     | Consent is off (expected until opted in), or `POSTHOG_API_KEY` is empty, which binds the no-op sink.                        |
| Build or launch rejects the key | It is a personal `phx_` key. Use the project `phc_` key.                                                                    |
| Events sent, nothing in PostHog | `POSTHOG_HOST` must be the ingestion host `https://eu.i.posthog.com`.                                                       |
| iOS crash never arrives         | A debugger was attached (it disables the crash handler), or consent was not switched on again after the relaunch.           |
| Stack trace not symbolicated    | The upload was skipped (a `POSTHOG_CLI_*` value missing), the project id is wrong, or `posthog-cli` is not on PATH.         |
| Flag always returns its default | The API has no `POSTHOG_API_KEY`, PostHog is unreachable, the flag is missing in this project (run the sync), or it is off. |
| Sync fails with 403             | The sync key lacks a scope, or its owner is not a project admin.                                                            |
