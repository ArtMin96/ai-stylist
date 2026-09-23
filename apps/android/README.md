# apps/android: AI Stylist for Android (Kotlin + Jetpack Compose)

The native Android app. It has its own Gradle build (this directory is the Gradle root) and talks to
the API only through the generated client in `packages/contracts/gen/kotlin-client`. It has no
React Native, no Kotlin Multiplatform and no 3D code.

## What's here

| Path | What it is |
|---|---|
| `app/` | `:app`, the application. Build types (= environments), `AppContainer` (the composition root), `MainActivity`, theme, manifest |
| `feature/home/` | `:feature:home`, the home screen: `HomeViewModel` (StateFlow) and `HomeScreen` (Compose) |
| `core/data/` | `:core:data`, pure Kotlin. `parseAppConfig` (API_BASE_URL validation), `DataServices`, `VersionRepository` over the generated client |
| `core/analytics/` | `:core:analytics`, pure Kotlin. The `Analytics` port, the consent-gated no-op stub, and the generated `AnalyticsTaxonomy` |
| `core/api-client/` | `:core:api-client`. It compiles the **generated** client. It has no source code of its own |
| `build-logic/` | Convention plugins. Every compiler, lint, detekt, locking and test setting lives here |
| `config/` | `detekt.yml`, `lint.xml`, `compose-stability.conf` |
| `gradle/libs.versions.toml` | The version catalog. Every dependency and plugin version is set here |
| `gradle/verification-metadata.xml`, `**/gradle.lockfile`, `*-gradle.lockfile` | Supply chain: checksums and the locked dependency graph |
| `tools/` | `gradle.sh` (runs the wrapper with JDK 21 + the SDK) and `sdk.sh` (SDK check/install), behind the `just android-*` recipes |

The generated client also has `app.aistylist.contracts.kernel` (reason codes, entitlement names and units, from
`packages/shared-kernel/registry/*.json`; [ADR-0005](../../docs/adr/0005-shared-kernel-registries-for-native-clients.md))
in `packages/contracts/gen/kotlin-client/kernel`. No module compiles it yet.

### Module graph

`checkModuleGraph` enforces this graph, like `just arch-check` does for TypeScript. The allow-list is
in `build-logic/convention/src/main/kotlin/RootConventionPlugin.kt`.

```
:app ──► :feature:home ──► :core:data ──(implementation)──► :core:api-client (generated)
  │            └─────────► :core:analytics (+ generated AnalyticsTaxonomy)
  └──► :core:data, :core:analytics
```

- Feature modules never depend on each other. `core` never depends on `feature`.
- Only `:core:data` can see generated DTOs. Features get the domain types from `:core:data`.
- `AppContainer` in `:app` is the only place that reads `BuildConfig` or builds adapters.

## Environments (build types)

| Build type | Env | applicationId | App name | Default `API_BASE_URL` |
|---|---|---|---|---|
| `debug` | dev | `app.aistylist.mobile.dev` | AI Stylist Dev | `http://10.0.2.2:3000` (the emulator's alias for the host running `just dev-api`) |
| `preview` | preview | `app.aistylist.mobile.preview` | AI Stylist Preview | `https://staging-api.ai-stylist.app` (staging) |
| `release` | prod | `app.aistylist.mobile` | AI Stylist | `https://api.ai-stylist.app` |

- **`API_BASE_URL` is host-only**: `scheme://host[:port]`, with no path. The generated operations
  already start with `v1/`, so the request path is `/v1/...` exactly once. `parseAppConfig` rejects a
  base URL that has a path, query, fragment or credentials. The app fails at startup instead of
  calling `/v1/v1/...`.
- Override order: `-Paistylist.apiBaseUrl=...`, then env `AISTYLIST_API_BASE_URL`, then the default
  in the table. The config holds no secrets.
- On a physical device, run `adb reverse tcp:3000 tcp:3000` and build with
  `-Paistylist.apiBaseUrl=http://localhost:3000`. Debug builds allow cleartext only to
  `10.0.2.2`/`localhost` (`app/src/debug/res/xml/network_security_config.xml`).
- `release` is unsigned until Play signing lands. `preview` is debug-signed so it installs for
  internal testing.

## Parity with the retired React Native home screen

- The title "AI Stylist" has heading semantics.
- The caption reads `API: <base url>`.
- A card calls `GET /v1/version` through the generated client:
  - Success shows `API <version> (<commit[0..7]>)`, with test tag `api-version`.
  - Failure shows `The API is not reachable right now: <reason>`, with test tag `api-error`, plus a
    Retry button.
- The toggle "Share anonymous usage data" is off by default.
- Test tags are exposed as resource ids (`testTagsAsResourceId`) so Maestro can use them. The shared
  smoke flow is `e2e/smoke.yaml` at the repo root.
- `app_opened` is tracked through the consent gate, using names from the generated taxonomy.

## Setup (Linux or macOS; no Android Studio needed)

1. JDK 21: `mise` provides it. `java -version` must print 21.
2. Android SDK, installed per user (no sudo) into `~/Android/Sdk` (macOS: `~/Library/Android/sdk`):
   `just android-sdk install` (and `just android-sdk` to check; both run `apps/android/tools/sdk.sh`).
   It pins cmdline-tools 19.0 (sha1-verified) and installs `platform-tools`, `platforms;android-37.0` and `build-tools;36.0.0`.
   On a host with a broken IPv6 route, set `SDKMANAGER_OPTS=-Djava.net.preferIPv4Stack=true`.
   You don't need an emulator: the screen tests run on the JVM with Robolectric.
3. AGP reads `ANDROID_HOME` (`tools/gradle.sh` falls back to `ANDROID_SDK_ROOT`, then the default path above).
   Don't commit `local.properties`.

## Commands

Use the `just android-*` recipes from the repo root. They call `apps/android/tools/gradle.sh`, which
checks for JDK 21, finds the SDK and runs the wrapper. CI runs the same recipes in
`.github/workflows/android.yml`. The Gradle equivalents are:

| Purpose | Recipe | `tools/gradle.sh` arguments |
|---|---|---|
| Debug APK | `just android-build` | `:app:assembleDebug` |
| Preview / release APK | `just android-build preview` / `release` (`all` = all three) | `:app:assemblePreview` / `:app:assembleRelease` (unsigned) |
| Unit + Robolectric tests | `just android-test` | `testDebugUnitTest :core:data:test :core:analytics:test` |
| Android Lint (all modules, via `checkDependencies`) + module graph | `just android-lint` | `:app:lintDebug checkModuleGraph` |
| Format check / fix | `just android-format --check` / `just android-format` | `spotlessCheck` / `spotlessApply` |
| detekt (type-resolved) | `just android-detekt` | `detektMain detektTest` |
| The whole local gate in one invocation | `just android-check` | all of the above except `spotlessApply` |
| Install the debug build + run the Maestro smoke flow | `just android-e2e` | `:app:installDebug`, then `maestro test` ([e2e/README.md](../../e2e/README.md)) |
| Refresh locks + checksums after a version bump | `just android-deps-lock` | the `android-check` tasks `--write-locks --write-verification-metadata sha256`, then review the diff |

## Strictness (don't relax these to get green)

- Kotlin `allWarningsAsErrors` in every module, including the generated client.
- Android Lint runs with `warningsAsErrors` and `abortOnError`, with no baseline, plus Slack
  compose-lint-checks. The only overrides are in `config/lint.xml`, and each one has a reason.
- ktlint (`ktlint_official`) formats through Spotless.
- detekt covers only coroutines, exceptions, potential-bugs and complexity. Any finding fails the
  build.
- Dependency locking is `STRICT`, and `gradle/verification-metadata.xml` holds sha256 checksums.
- Tests live in each module's `src/test/kotlin`. This is Gradle's layout, and a documented exception
  to the repo's `tests/` rule.
- Generated code (`packages/contracts/gen/kotlin-client`) is never edited by hand. Run `just generate`.
