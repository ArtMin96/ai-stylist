---
paths:
  - "apps/android/**"
  - "tools/codegen/gen-kotlin.sh"
  - "packages/contracts/gen/kotlin-client/**"
---

# Native Android app (apps/android)

**Skill:** `android-feature` (both platforms at once: `cross-platform-feature`; endpoint or event
shape: `api-contract-change`).

**Agent:** `android-engineer` (iOS: `ios-engineer`; contracts: `contracts-engineer`; API: `api-engineer`).

**Proof:** `just android-check` (Spotless, module graph, detekt, Android Lint, unit + Robolectric tests,
all three APKs; runs entirely on Linux). `just android-e2e` needs a running emulator or device.

**Invariants that bite here:**
1. Never lower `allWarningsAsErrors`, Android Lint `warningsAsErrors`/`abortOnError`, or detekt
   thresholds; never add a lint baseline or a blanket `@Suppress`.
2. Every version goes in `apps/android/gradle/libs.versions.toml`. After any dependency change run
   `just android-deps-lock`, review the diff, and commit the lockfiles and
   `apps/android/gradle/verification-metadata.xml` together; never hand-edit either.
3. Only `AppContainer` reads `BuildConfig` or constructs adapters. Only `:core:data` depends on
   `:core:api-client`; features never depend on each other. Edit the `checkModuleGraph` allow-list only
   in a reviewed commit of its own.
4. Never hand-edit `packages/contracts/gen/kotlin-client/**` (output of `tools/codegen/gen-kotlin.sh`):
   run `just generate`. Analytics names come from the generated `AnalyticsTaxonomy`.
5. Coroutines: rethrow `CancellationException`; `viewModelScope`, never `GlobalScope`;
   `collectAsStateWithLifecycle` in the UI; `LaunchedEffect` keys cover every changing input;
   `rememberSaveable` for state that must survive rotation; `@Immutable`/`@Stable` only on types that
   really never change.
6. User-facing strings in res/values/strings.xml; strings and test tags asserted by `e2e/smoke.yaml`
   (`AI Stylist`, `Share anonymous usage data`, `api-version`, `api-error`) stay byte-identical to iOS;
   every such `testTag` equals the iOS accessibility identifier.
7. Tests go in each Gradle module's src/test/kotlin (documented test-placement exception).
8. `API_BASE_URL` is host-only; no secrets in build config. No 3D now (future: Filament's official
   Android AARs, behind an ADR).
