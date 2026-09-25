---
name: android-feature
description: Build or change native Android features in apps/android/ — Jetpack Compose screens, ViewModels with StateFlow in :feature modules, repositories in :core:data over the generated Kotlin client, AppContainer wiring, build types/config, Gradle convention plugins and the version catalog, analytics and consent wiring, and the Kotlin codegen script tools/codegen/gen-kotlin.sh — with warnings-as-errors, Android Lint, detekt and Robolectric tests. Use for "Android screen", "Compose", "ViewModel", "Gradle module", "Robolectric", "just android-check", or any path under apps/android/, including the Android lane of a cross-platform brief. Not for iOS — use `ios-feature`; not for starting a feature on both platforms — use `cross-platform-feature`; not for a missing or changed endpoint — use `api-contract-change` first; not for the shared Maestro flows in e2e/ — use `e2e-device-testing`.
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: android-engineer
---

# Android Feature Development

## Trigger

- Adding or changing a screen, ViewModel, repository, build type, config key, Gradle module or
  convention plugin under `apps/android/` (Kotlin + Jetpack Compose, own Gradle root).
- Wiring an existing endpoint through the generated client in `packages/contracts/gen/kotlin-client/`
  (output of `tools/codegen/gen-kotlin.sh`, this skill's script; the output is never hand-edited).
- Running as the Android lane of `cross-platform-feature`: the brief is the only parity source,
  and the base and worktree rules of `agent-operating-contract` apply.
- Not this skill: iOS (`ios-feature`); starting a two-platform feature (`cross-platform-feature`);
  a missing endpoint or event (`api-contract-change` first); the endpoint's server side
  (`backend-module`); Maestro flows (`e2e-device-testing`); 3D of any kind (none yet; future 3D is
  Filament's official Android AARs, behind an ADR).

## Required reading

1. The current phase file in `planning/phases/` and `PROGRESS.md`.
2. `planning/02-user-journeys-and-information-architecture.md` §1.1 (state coverage rule), the
   journey's own States subsection and §2.1 (navigation). In a lane, the brief replaces them.
3. `apps/android/README.md` (modules, module graph, environments, strictness, commands).
4. Composition: `apps/android/app/src/main/kotlin/app/aistylist/app/AppContainer.kt`,
   `apps/android/app/src/main/kotlin/app/aistylist/app/MainActivity.kt`,
   `apps/android/core/data/src/main/kotlin/app/aistylist/core/data/DataServices.kt`.
5. The siblings to copy:
   - screen: `apps/android/feature/home/src/main/kotlin/app/aistylist/feature/home/HomeViewModel.kt`,
     `apps/android/feature/home/src/main/kotlin/app/aistylist/feature/home/HomeUiState.kt`,
     `apps/android/feature/home/src/main/kotlin/app/aistylist/feature/home/HomeScreen.kt`,
     `apps/android/feature/home/src/main/res/values/strings.xml`, and the tests
     `apps/android/feature/home/src/test/kotlin/app/aistylist/feature/home/HomeViewModelTest.kt`,
     `apps/android/feature/home/src/test/kotlin/app/aistylist/feature/home/HomeScreenTest.kt`,
     `apps/android/feature/home/src/test/kotlin/app/aistylist/feature/home/Fakes.kt`;
   - endpoint repository: `apps/android/core/data/src/main/kotlin/app/aistylist/core/data/version/VersionRepository.kt`,
     `apps/android/core/data/src/main/kotlin/app/aistylist/core/data/model/ApiVersion.kt`,
     `apps/android/core/data/src/test/kotlin/app/aistylist/core/data/version/VersionRepositoryTest.kt`.
6. `apps/android/gradle/libs.versions.toml` before touching any dependency, and
   `apps/android/build-logic/convention/src/main/kotlin/RootConventionPlugin.kt`
   (`ALLOWED_MODULE_EDGES`) before adding a module.

## Workflow

1. Restate the user-visible outcome and every UI state in scope (doc 02 §1.1 plus the journey's
   States subsection, or the brief's parity table in a lane).
2. Search before write (`agent-operating-contract` step 4):
   `rg -n -i '<term>|<synonym>' apps/android packages/contracts/gen/kotlin-client`. Reuse or
   extend; one copied look-alike composable or repository is a defect.
3. Contract missing or wrong → stop BLOCKED for `contracts-engineer` (`api-contract-change`);
   resume after the regenerated client is committed.
4. Layering (the `checkModuleGraph` allow-list enforces it):
   - Only `:core:data` depends on `:core:api-client`; it maps generated DTOs to domain types.
     Copy `VersionRepository.kt`, `ApiVersion.kt` and `VersionRepositoryTest.kt` for a new endpoint.
   - A feature module holds its ViewModel (`StateFlow` UI state) and Compose screen; features never
     depend on each other.
   - `AppContainer` is the only place that reads `BuildConfig` or builds adapters.
   - No business rules in the client: decisions come from the API.
5. A new feature module: register it in `apps/android/settings.gradle.kts`, apply the convention
   plugin, and add its edges to `ALLOWED_MODULE_EDGES` in `RootConventionPlugin.kt` (called out as
   its own reviewed change in the report). A new JVM `:core:*` module also needs `:<module>:test`
   in the `android-test`, `android-check` and `android-deps-lock` recipes, or its tests never run;
   that is a `justfile` change for `tooling-engineer`: stop and report it.
6. Entry point: `MainActivity.kt` calls `setContent { … HomeRoute(…) }` and there is no navigation
   library or `NavHost`. A second reachable screen needs the nav-shell task first, and the
   navigation dependency needs the human's grant (Stop).
7. Strictness: `allWarningsAsErrors`, Android Lint `warningsAsErrors` with no baseline, detekt,
   ktlint via Spotless. Never relax them or add a blanket `@Suppress`.
8. Dependencies: versions only in the catalog; after a change run `just android-deps-lock`, review
   the diff, and list the lockfiles with `verification-metadata.xml` under
   `Must be committed together:` (only when the task grants the change).
9. Accessibility: content descriptions, semantics roles, 48 dp targets, font scaling. Strings in the
   module's res/values/strings.xml; each id is a `const val` in a `<Name>TestTags` object (copy
   `HomeTestTags` in `HomeScreen.kt`). Strings and ids equal iOS byte for byte, taken from the
   brief; never read `apps/ios/**` for parity (in a worktree it is the pre-feature base).
10. Analytics through the port with names from the generated `AnalyticsTaxonomy`
    (`packages/contracts/gen/kotlin-client/analytics/src/main/kotlin/app/aistylist/contracts/analytics/AnalyticsTaxonomy.kt`);
    a new event needs the contract lane first. Consent defaults OFF; no sensitive data in events,
    logs or fixtures. `API_BASE_URL` stays host-only; no secrets in build config.
11. Registry values (reason codes, entitlements, units): add
    `packages/contracts/gen/kotlin-client/kernel/src/main/kotlin` as a `kotlin.srcDir` in the
    module the brief or task names, copying the block in
    `apps/android/core/analytics/build.gradle.kts`, and import `app.aistylist.contracts.kernel`;
    never copy a value (DEC-55). No module has it yet: if the task does not name one, stop and ask.
12. Tests in the module's src/test/kotlin (documented test-placement exception): ViewModel tests
    with fakes, Robolectric for Compose screens, synthetic data. A bug fix is test-first:
    `just test-regression` cannot run Kotlin, so write the test, run `just test android` and keep
    the failing line, fix, rerun and keep the passing line.
13. `tools/codegen/gen-kotlin.sh` changed → stop after the edit and report it: `just generate`
    rewrites every generated tree, so the lead or `contracts-engineer` runs it.
14. Self-review before reporting (the bugs a reviewer will not see): `CancellationException`
    rethrown from every `catch`/`runCatching` around suspend code; `LaunchedEffect` keys cover every
    changing input; `rememberSaveable` (or `SavedStateHandle`) for state that must survive rotation
    and process death; `collectAsStateWithLifecycle` and `viewModelScope`, never `GlobalScope`;
    `@Immutable`/`@Stable` only on types with no mutable state.

## Validation commands

```bash
just android-check             # worktree or main checkout: Spotless, module graph, detekt, Android Lint, unit + Robolectric tests, all three APKs (no emulator)
just test android              # unit + Robolectric tests only (fast loop)
just android-format            # apply Spotless/ktlint
just lint-file <path>          # one edited .kt/.kts or apps/android/tools/*.sh file
just android-deps-lock         # after a granted dependency change; review the lockfile/checksum diff
just android-e2e               # running emulator/device + maestro: the shared flow on the dev build
# main checkout only (need node_modules); in a worktree they go under Not run and the lead runs them:
just generate --check          # after a contract or gen-kotlin.sh change
just arch-check && just docs-check
```

`.github/workflows/android.yml` runs the same checks on every PR touching apps/android. `just lint`
and `just ci-parity` run in the lead's checkout before the PR.

## Output

The `agent-operating-contract` report. Self-review lists step 14's items. Parity block: yes for a
client feature. Emulator screenshots only if a run exists (no real user photos or measurements).

Done checklist: every journey state handled · DTOs only via `:core:data` · module graph and
strictness untouched · tests in the module's src/test/kotlin · self-review done · device evidence reported as
run or Not run · `Suggested PROGRESS.md line` given.

## Stop / escalation

- Contract missing or wrong → `contracts-engineer` (`api-contract-change`).
- New dependency or version bump the task does not grant (including a navigation library) → stop;
  the lockfiles and checksums are reviewed changes.
- A new JVM `:core:*` module → the `justfile` test lists need `tooling-engineer`; stop and report.
- A second screen with no navigation shell → stop; the lead sequences a nav-shell task on both apps.
- Registry value needed and no module named for the kernel `srcDir` → stop; the brief decides.
- Behaviour must differ from iOS → `Parity: Intended differences`; the lead decides.
- No emulator or device for a device-only behaviour → implement, report `Not run`, never claim a
  device result you did not see.
- Anything 3D → stop; 3D is deferred for the native apps.

## Overlap

Adjacent: `ios-feature` (same states, strings, ids and events on iOS; in a lane, never read its
sources), `cross-platform-feature` (the lead's brief and parity review win), `api-contract-change`
(shapes first; regenerates the Kotlin client), `backend-module` (the endpoint),
`e2e-device-testing` (Maestro flows, run by `test-engineer`), `tooling-ci` (the `justfile`
recipes that list Gradle tasks), `release-readiness` (Play track, human-only),
`performance-profiling` (budgets). This skill owns `apps/android/**` and
`tools/codegen/gen-kotlin.sh`.
