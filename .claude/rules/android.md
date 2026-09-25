---
paths:
  - "apps/android/**"
  - "tools/codegen/gen-kotlin.sh"
---

# Native Android app (apps/android)

**Skill:** `android-feature` (both platforms at once: `cross-platform-feature`, run by the main session;
endpoint or event shape: `api-contract-change` first).

**Agent:** `android-engineer` (iOS: `ios-engineer`; contracts: `contracts-engineer`; API:
`api-engineer`; the shared Maestro flows in `e2e/`: `test-engineer`).

**Proof:** `just android-check` (Spotless, module graph, detekt, Android Lint, unit + Robolectric tests,
all three APKs; runs on Linux). `just android-e2e` needs a running emulator or device. A
`tools/codegen/gen-kotlin.sh` change needs `just generate --check`.

**Invariants that bite here:**
1. Never lower `allWarningsAsErrors`, Android Lint `warningsAsErrors`/`abortOnError` or the detekt
   thresholds, and never add a lint baseline or a blanket `@Suppress` — `just android-check` fails on any
   finding; a lowered threshold is reviewer-checked.
2. Every version goes in `apps/android/gradle/libs.versions.toml`. After a dependency change run
   `just android-deps-lock` and keep the lockfiles and `apps/android/gradle/verification-metadata.xml`
   together in one change — the PreToolUse path guard denies hand edits to both.
3. Only `AppContainer` reads `BuildConfig` or constructs adapters. Only `:core:data` depends on
   `:core:api-client`; features never depend on each other — the `checkModuleGraph` allow-list
   (`just android-lint`, `just arch-check`); edit that allow-list only in a reviewed change of its own.
4. Never hand-edit `packages/contracts/gen/kotlin-client/**` — the path guard denies it. `just generate`
   rewrites every client, so an Android task that needs regeneration stops and reports it. Analytics
   names come from the generated `AnalyticsTaxonomy`; reason codes and entitlement names from the
   generated `app.aistylist.contracts.kernel` (reviewer-checked).
5. Coroutines: rethrow `CancellationException` and never use `GlobalScope` — detekt
   `SuspendFunSwallowedCancellation`, `GlobalCoroutineUsage` (`just android-detekt`). Use
   `viewModelScope`, `collectAsStateWithLifecycle` in the UI, `LaunchedEffect` keys that cover every
   changing input, `rememberSaveable` for state that must survive rotation, and `@Immutable`/`@Stable`
   only on truly immutable types (reviewer-checked).
6. User-facing strings live in res/values/strings.xml. The strings `e2e/smoke.yaml` asserts
   (`AI Stylist`, `Share anonymous usage data`) stay byte-identical to iOS, and each `testTag` a flow uses
   (`api-version`, `api-error`) equals the iOS accessibility identifier — `just android-e2e`.
7. Tests go in each Gradle module's src/test/kotlin (instrumented: src/androidTest/kotlin) — the path
   guard denies a `*Test.kt` file elsewhere under `apps/android/`.
8. `API_BASE_URL` is host-only; no secrets in build config. No 3D now; Filament's official Android AARs
   come later, behind an ADR (reviewer-checked).
