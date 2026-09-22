---
name: android-feature
description: Build or change native Android features in apps/android/ — Jetpack Compose screens, ViewModels with StateFlow in :feature modules, repositories in :core:data over the generated Kotlin client, AppContainer wiring, build types/config, Gradle convention plugins and the version catalog, analytics and consent wiring — with warnings-as-errors, Android Lint, detekt and Robolectric tests. Use for "Android screen", "Compose", "ViewModel", "Gradle module", "Robolectric", "just android-check", or any path under apps/android/. Not for iOS — use `ios-feature`; not for a feature on both platforms — start with `cross-platform-feature`; not for a missing or changed endpoint — use `api-contract-change` first; not for the shared Maestro flows in e2e/ — use `e2e-device-testing`.
metadata:
  modules:
  last-reviewed: 2026-09-23
  owner-agent: android-engineer
---

# Android Feature Development

## Trigger

- Adding or changing a screen, ViewModel, repository, build type, config key, Gradle module or
  convention plugin under `apps/android/` (Kotlin + Jetpack Compose, own Gradle root).
- Wiring an existing endpoint into the Android app through the generated client in
  `packages/contracts/gen/kotlin-client/` (output of `tools/codegen/gen-kotlin.sh`; regenerate with
  `just generate`, never hand-edit).
- Not this skill: iOS (`ios-feature`); the same feature on both platforms (`cross-platform-feature`
  orchestrates, then runs this skill for the Android half); a missing endpoint or event
  (`api-contract-change` first); the endpoint's server side (`backend-module`, `api-engineer`);
  Maestro flows (`e2e-device-testing`); 3D of any kind (none yet; future 3D is Filament's official
  Android AARs, behind an ADR).

## Required reading

1. The current phase file in `planning/phases/` and `PROGRESS.md`.
2. `planning/02-user-journeys-and-information-architecture.md`: the journey and its empty, loading,
   partial, failure, retry, offline and accessibility states.
3. `apps/android/README.md` (modules, module graph, environments, strictness, commands).
4. `apps/android/app/src/main/kotlin/app/aistylist/app/AppContainer.kt`,
   `apps/android/core/data/src/main/kotlin/app/aistylist/core/data/DataServices.kt`, and the closest
   existing feature (`apps/android/feature/home/`).
5. `apps/android/gradle/libs.versions.toml` before touching any dependency.

## Workflow

1. Restate the user-visible outcome and every UI state in scope; the journeys doc defines them.
2. Search before write: `rg` the Kotlin sources and the generated client by behaviour and synonyms.
   Reuse or extend; one copied look-alike composable or repository is a defect.
3. Contract missing or wrong → stop, `api-contract-change`, then return after `just generate`.
4. Layering (the `checkModuleGraph` allow-list enforces it):
   - Only `:core:data` depends on `:core:api-client`; it maps generated DTOs to domain types.
   - A feature module holds its ViewModel (`StateFlow` UI state) and Compose screen; features never
     depend on each other.
   - `AppContainer` is the only place that reads `BuildConfig` or builds adapters.
   - No business rules in the client: decisions come from the API.
5. A new feature module: register it in `apps/android/settings.gradle.kts`, apply the convention
   plugin, and add its edges to the allow-list in a separate, reviewed commit.
6. Strictness: `allWarningsAsErrors`, Android Lint `warningsAsErrors` with no baseline, detekt,
   ktlint via Spotless. Never relax them or add a blanket `@Suppress`.
7. Dependencies: versions only in the catalog; after a change run `just android-deps-lock`, review
   the diff, and commit the lockfiles with `verification-metadata.xml` (only when the task grants it).
8. Accessibility: content descriptions, semantics roles, 48dp targets, font scaling. Strings in
   res/values/strings.xml; strings asserted by `e2e/smoke.yaml` stay identical to iOS, and each
   `testTag` the flow reads equals the iOS accessibility identifier.
9. Analytics through the port with names from the generated `AnalyticsTaxonomy`; consent defaults
   OFF; no sensitive data in events, logs or fixtures. `API_BASE_URL` stays host-only; no secrets
   in build config.
10. Tests in the module's src/test/kotlin (documented test-placement exception): ViewModel tests
    with fakes, Robolectric for Compose screens, synthetic data. A bug fix starts with a failing test.
11. Self-review before reporting (the bugs a reviewer will not see): `CancellationException`
    rethrown from every `catch`/`runCatching` around suspend code; `LaunchedEffect` keys cover every
    changing input; `rememberSaveable` (or `SavedStateHandle`) for state that must survive rotation
    and process death; `collectAsStateWithLifecycle` and `viewModelScope`, never `GlobalScope`;
    `@Immutable`/`@Stable` only on types with no mutable state.

## Validation commands

```bash
just android-check             # Spotless, module graph, detekt, Android Lint, unit + Robolectric tests, all three APKs (Linux, no emulator)
just test android              # unit + Robolectric tests only (fast loop)
just android-format            # apply Spotless/ktlint
just generate --check          # if a contract change preceded this work
just android-deps-lock         # after a dependency change; review the lockfile/checksum diff
just android-e2e               # running emulator/device + maestro: e2e/smoke.yaml on the dev build
```

`.github/workflows/android.yml` runs the same checks on every PR touching apps/android.

## Output

PR with: states implemented, verification transcript, parity notes for iOS, emulator screenshots
if a run exists (no real user photos/measurements). Done = every journey state · DTOs only via
`:core:data` · module graph and strictness untouched · tests in src/test · self-review done ·
device evidence named honestly · `PROGRESS.md` line proposed.

## Stop / escalation

- Contract missing or wrong → `api-contract-change`.
- New dependency or version bump the task does not grant → stop; the lockfiles and checksums are
  reviewed changes.
- Behaviour must differ from iOS → raise it in the `cross-platform-feature` parity review.
- No emulator or device for a device-only behaviour → implement, then hand off; never claim a
  device result you did not see.
- Anything 3D → stop; 3D is deferred for the native apps.

## Overlap

`ios-feature` (the iOS half: same states, strings, events), `cross-platform-feature` (both halves +
parity review), `api-contract-change` (shapes; regenerates the Kotlin client), `e2e-device-testing`
(Maestro), `release-readiness` (Play track, human-only), `performance-profiling` (budgets).
