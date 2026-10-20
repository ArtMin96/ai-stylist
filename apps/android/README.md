# apps/android: AI Stylist for Android (Kotlin + Jetpack Compose)

The native Android app. It has its own Gradle build (this directory is the Gradle root) and talks to
the API only through the generated client in `packages/contracts/gen/kotlin-client`. It has no
React Native, no Kotlin Multiplatform and no 3D code.

## What's here

| Path | What it is |
|---|---|
| `app/` | `:app`, the application. Build types (= environments), `AppContainer` (the composition root), `MainActivity` (wraps everything in `AppTheme`), the window theme, manifest, and the PostHog adapter (`app/analytics/`, the only code that sees the PostHog SDK) |
| `feature/home/` | `:feature:home`, the home screen: `HomeViewModel` (StateFlow) and `HomeScreen` (Compose), plus the debug tools (shown only when `AppContainer` injects the crash action: `debug`/`preview`) |
| `core/data/` | `:core:data`, pure Kotlin. `parseAppConfig` (API_BASE_URL and PostHog key/host validation), `DataServices`, `VersionRepository` over the generated client |
| `core/analytics/` | `:core:analytics`, pure Kotlin, SDK-free. The `Analytics` port, the consent gate (`ConsentGatedAnalytics`), the no-op sink, and the generated `AnalyticsTaxonomy` |
| `core/api-client/` | `:core:api-client`. It compiles the **generated** client. It has no source code of its own |
| `core/designsystem/` | `:core:designsystem`, the app-internal design system (DEC-87), an Android library with Compose that depends on no other project module. It holds the generated `DESIGN.md` tokens in `src/main/kotlin/app/aistylist/core/designsystem/generated/` (written by `just generate`, never hand-edited), the bundled fonts (below), `AppTheme` (the token context from the system: light, dark, or high contrast S7 from Android's high-contrast-text setting on API 36+) and `AppButton` (C01, `.impeccable/components/button.yaml`) with its state-grid and playground previews in `AppButtonPreviews.kt` |
| `build-logic/` | Convention plugins. Every compiler, lint, detekt, locking and test setting lives here |
| `config/` | `detekt.yml`, `lint.xml`, `compose-stability.conf` |
| `gradle/libs.versions.toml` | The version catalog. Every dependency and plugin version is set here |
| `gradle/verification-metadata.xml`, `**/gradle.lockfile`, `*-gradle.lockfile` | Supply chain: checksums and the locked dependency graph |
| `tools/` | `gradle.sh` (runs the wrapper with JDK 25 + the SDK) and `sdk.sh` (SDK check/install), behind the `just android-*` recipes |

The generated client also has `app.aistylist.contracts.kernel` (reason codes, entitlement names and units, from
`packages/shared-kernel/registry/*.json`; [ADR-0005](../../docs/adr/0005-shared-kernel-registries-for-native-clients.md))
in `packages/contracts/gen/kotlin-client/kernel`. No module compiles it yet.

### Module graph

`checkModuleGraph` enforces this graph, like `just arch-check` does for TypeScript. The allow-list is
in `build-logic/convention/src/main/kotlin/RootConventionPlugin.kt`.

```
:app ──► :feature:home ──► :core:data ──(implementation)──► :core:api-client (generated)
  │            ├─────────► :core:analytics (+ generated AnalyticsTaxonomy)
  │            └─────────► :core:designsystem (generated tokens, AppTheme, AppButton)
  └──► :core:data, :core:analytics, :core:designsystem
```

- Feature modules never depend on each other. `core` never depends on `feature`.
- `:core:designsystem` never depends on another project module.
- Only `:core:data` can see generated DTOs. Features get the domain types from `:core:data`.
- `AppContainer` in `:app` is the only place that reads `BuildConfig` or builds adapters.

### Bundled fonts

`:core:designsystem` ships the two `DESIGN.md` families, byte-identical to iOS. They come unmodified
from google/fonts under the SIL Open Font License 1.1 (no Reserved Font Name); each has its own
licence file. Figtree is one variable font whose default instance is Light 300, so `AppFonts.kt`
sets the `wght` axis for each weight (400, 500, 600, 700). Young Serif is Regular 400 only. There is
no system-font fallback.

| File (`core/designsystem/`) | Source (google/fonts) | sha256 |
|---|---|---|
| `src/main/res/font/figtree_variable.ttf` | `a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/Figtree[wght].ttf` | `26ad3db9b31ff7dde67a91ff515d022d2f495cd506590699cf264f0bfe6fb714` |
| `src/main/res/font/young_serif_regular.ttf` | `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/youngserif/YoungSerif-Regular.ttf` | `42bb2602364b28569fdce5eeb6ab3d81cf8090ba81b211f1229ed69f33155523` |
| `licenses/Figtree-OFL.txt` | `a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/OFL.txt` | `140d37233e7f3ce7313798befa9600893bcceaf41a55fa0fa5ad52f7f657a268` |
| `licenses/YoungSerif-OFL.txt` | `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/youngserif/OFL.txt` | `737d8d343b674c6894f373de71a044b6782c130f2aebf180933d63ddf7a3dc19` |

Upstream projects: Figtree `https://github.com/erikdkennedy/figtree` (google/fonts imports commit
032dfa7), Young Serif `https://github.com/noirblancrouge/YoungSerif` (commit d307c79).

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
  internal testing. It is minified with R8 like `release`, so it is the build that proves crash
  deobfuscation.
- `BuildConfig.DEBUG_TOOLS` is `true` for `debug` and `preview` and `false` for `release`. Only when
  it is `true` does `AppContainer` hand Home the forced test crash (`throwForcedTestCrash` in
  `app/src/main/kotlin/app/aistylist/app/ForcedTestCrash.kt`), and that crash action is what turns
  on Home's debug tools (below). `release` gets no crash action, so the debug tools never appear
  there and `HomeViewModel.forceTestCrash()` does nothing.
- Intended difference: the debug tools also appear in the minified `preview` build (R8
  deobfuscation proof); iOS shows them only in Dev (dSYM suffices). `preview` is debug-signed, so
  it cannot reach Play.

## Parity with the retired React Native home screen

- The title "AI Stylist" has heading semantics.
- The caption reads `API: <base url>`.
- A card calls `GET /v1/version` through the generated client:
  - Success shows `API <version> (<commit[0..7]>)`, with test tag `api-version`.
  - Failure shows `The API is not reachable right now: <reason>`, with test tag `api-error`, plus a
    Retry button (`AppButton` primary-outline compact, test tag `retry-button`).
- The toggle "Share anonymous usage data" is off by default.
- Test tags are exposed as resource ids (`testTagsAsResourceId`) so Maestro can use them. The shared
  smoke flow is `e2e/smoke.yaml` at the repo root.
- `app_opened` is tracked through the consent gate, using names from the generated taxonomy.

## Analytics and crash reporting (PostHog)

**How it works.** Product code talks only to the `Analytics` port (`:core:analytics`). The consent
gate `ConsentGatedAnalytics` is off by default and keeps consent in memory only (it is not persisted
until P03). Its sink gets no call at all before the first opt-in. On opt-in it gets `activate()`, on
withdrawal `deactivate()`, and `send()` only in between. `AppContainer` picks the sink:

- No `POSTHOG_API_KEY`: `NoopAnalyticsSink`. No PostHog code runs. CI builds are key-less: CI sets
  no `POSTHOG_API_KEY` (only the `POSTHOG_CLI_*` mapping-upload values, on `main`), so every CI APK
  binds the no-op sink (`AppContainerTest`: "without a PostHog key the no-op sink is bound").
- With a key: `PostHogAnalyticsSink` (`app/src/main/kotlin/app/aistylist/app/analytics/`). It calls
  the SDK only through `PostHogSdk`, so `PostHogAnalyticsSinkTest` covers it with a fake SDK.
  - `activate()` sets up the official [posthog-android](https://github.com/PostHog/posthog-android)
    SDK, opts in and flushes. Before consent there is no SDK setup, no network and no crash handler.
  - `deactivate()` withdraws without sending. It makes the SDK's queue see "offline" (every send
    path checks the queue's network status first), opts out, and closes the SDK. Closing uninstalls
    the crash handler, and the flush inside `close()` now sends nothing. Then it deletes the unsent
    queue, the event files under `cacheDir/posthog-queue`. The SDK (3.71.1) has no public call that
    drops its queue.
  - Nothing captured under consent is sent after withdrawal. The only exception is a request that
    was already on the wire when consent was withdrawn. No crash can be recorded while consent is
    withdrawn: capture returns early once opted out, and after `close()` the handler is uninstalled.
  - A re-grant sends only data captured after it. A queue write that landed after the withdrawal is
    deleted again before the SDK is set up.
  - A crash is written to the SDK's disk queue before the process dies. If consent was never
    withdrawn, what was not sent is delivered after the next opt-in (the flush in `activate()`).
- The SDK config is built by `postHogConfig()` and unit-tested in `PostHogConfigTest`:
  - On: error-tracking autocapture (uncaught JVM exceptions).
  - Off: lifecycle events, screen views, deep links, click autocapture, session replay
    (screenshots, logcat), surveys, feature-flag preload and `$feature_flag_called`, push, NDK
    crashes, and breadcrumbs (exception steps).
  - Person profiles are identified-only, and default person properties are off.

**How to configure it.** Nothing is committed. Each value is read from the Gradle property, then
from the environment variable. The environment is the repo-root `.env` that `just secrets-sync`
writes and direnv loads. Missing values are empty.

| Environment variable | Gradle property | Used for |
|---|---|---|
| `POSTHOG_API_KEY` | `aistylist.posthogApiKey` | Project key, compiled into `BuildConfig`. It must start with `phc_`. A personal `phx_` key fails the build and `parseAppConfig`. |
| `POSTHOG_HOST` | `aistylist.posthogHost` | https ingestion host of the project's region (this project is on US Cloud: `https://us.i.posthog.com`). Required when the key is set. |
| `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST` | `aistylist.posthogCliApiKey`, `aistylist.posthogCliProjectId`, `aistylist.posthogCliHost` | R8 mapping upload at build time only. The API key is a personal key with the "error tracking write" and "organization read" scopes. `POSTHOG_CLI_HOST` is the app/API host, not the ingestion host (US Cloud: `https://us.posthog.com`). |

**Mapping upload.** The official Gradle plugin `com.posthog.android` works on AGP 9.4.1. For every
minified variant (`preview`, `release`) it:

1. injects a mapping id into the APK's assets, offline;
2. runs `posthog-cli exp proguard upload` after `assemble`/`install`/`bundle`
   (`uploadPostHogProguardMappings<Variant>`).

The upload runs only when all three `POSTHOG_CLI_*` values are present, and then `posthog-cli` must
be on PATH (pinned in `mise.toml`). Without them the task is `SKIPPED`, so the builds stay offline.

**How to demo a crash** (preview is the installable R8 build; P02 AC-6):

1. Build with the keys and the CLI values set: `just android-build preview`. Check that
   `uploadPostHogProguardMappingsPreview` ran and was not skipped.
2. Install and start the app on a device or emulator:
   `adb install -r apps/android/app/build/outputs/apk/preview/app-preview.apk`.
3. On Home, turn on "Analytics consent (debug)" (`debug_consent_toggle`), then tap "Force test
   crash" (`debug_force_crash`). The app crashes with `ForcedTestCrash`.
4. Relaunch and turn consent on again. This delivers anything still queued from the crashed run.
5. In PostHog Error tracking, the issue shows `app.aistylist.app.ForcedTestCrash` thrown from
   `throwForcedTestCrash`, called by `HomeViewModel.forceTestCrash`, deobfuscated.

## Setup (Linux or macOS; no Android Studio needed)

1. JDK 25: `mise` provides it. `java -version` must print 25.
2. Android SDK, installed per user (no sudo) into `~/Android/Sdk` (macOS: `~/Library/Android/sdk`):
   `just android-sdk install` (and `just android-sdk` to check; both run `apps/android/tools/sdk.sh`).
   It pins cmdline-tools 19.0 (sha1-verified) and installs `platform-tools`, `platforms;android-37.0` and `build-tools;36.0.0`.
   On a host with a broken IPv6 route, set `SDKMANAGER_OPTS=-Djava.net.preferIPv4Stack=true`.
   You don't need an emulator: the screen tests run on the JVM with Robolectric.
   To run the app, `just dev android` (or `just android-run` with the backend already up) uses a running emulator, else
   the connected phone (`adb reverse` plus a build pointed at `localhost`), else creates the AVD `aistylist-dev` and boots
   it: `tools/sdk.sh emulator` installs the emulator and a Google APIs system image for the host CPU (API 36, or the
   newest one offered; `ANDROID_SYSTEM_IMAGE` picks another). `tools/device.sh` also has `boot`, `avd [--recreate]`,
   `stop` and `list`. On Linux the x86_64 emulator needs read and write access to `/dev/kvm`.
3. AGP reads `ANDROID_HOME` (`tools/gradle.sh` falls back to `ANDROID_SDK_ROOT`, then the default path above).
   Don't commit `local.properties`.

## Commands

Use the `just android-*` recipes from the repo root. They call `apps/android/tools/gradle.sh`, which
checks for JDK 25, finds the SDK and runs the wrapper. CI runs the same recipes in
`.github/workflows/android.yml`. The Gradle equivalents are:

| Purpose | Recipe | `tools/gradle.sh` arguments |
|---|---|---|
| Debug APK | `just android-build` | `:app:assembleDebug` |
| Preview / release APK | `just android-build preview` / `release` (`all` = all three) | `:app:assemblePreview` / `:app:assembleRelease` (unsigned) |
| Unit + Robolectric tests | `just android-test` | `testDebugUnitTest :core:data:test :core:analytics:test :core:designsystem:test` |
| Android Lint (all modules, via `checkDependencies`) + module graph | `just android-lint` | `:app:lintDebug checkModuleGraph` |
| Format check / fix | `just android-format --check` / `just android-format` | `spotlessCheck` / `spotlessApply` |
| detekt (type-resolved) | `just android-detekt` | `detektMain detektTest` |
| The whole local gate in one invocation | `just android-check` | all of the above except `spotlessApply` |
| Install the debug build + run the Maestro smoke flow | `just android-e2e` | `:app:installDebug`, then `maestro test` ([e2e/README.md](../../e2e/README.md)) |
| Install and launch the debug build (emulator or phone) | `just android-run [--serial S] [--api-port N]` (`just dev android` also starts the backend) | `tools/device.sh run`: `:app:installDebug`, then `am start` |
| Refresh locks + checksums after a version bump | `just android-deps-lock` | the `android-check` tasks `--write-locks --write-verification-metadata sha256`, then review the diff |

## Strictness (don't relax these to get green)

- Kotlin `allWarningsAsErrors` in every module, including the generated client.
- Android Lint runs with `warningsAsErrors` and `abortOnError`, with no baseline, plus Slack
  compose-lint-checks. The only overrides are in `config/lint.xml`, and each one has a reason.
- ktlint (`ktlint_official`) formats through Spotless.
- detekt covers only coroutines, exceptions, potential-bugs and complexity. Any finding fails the
  build.
- Dependency locking is `STRICT`, and `gradle/verification-metadata.xml` holds sha256 checksums.
- `build-logic/convention` compiles with the catalog's Kotlin Gradle plugin (`kotlin-jvm` +
  `java-gradle-plugin` + SAM-with-receiver), not Gradle's `kotlin-dsl`. `kotlin-dsl` would bring
  Gradle's embedded KGP, which is 2.4.10 in Gradle 9.8.0 and affected by GHSA-r937-wjx7-w2jp.
- Tests live in each module's `src/test/kotlin`. This is Gradle's layout, and a documented exception
  to the repo's `tests/` rule.
- Generated code (`packages/contracts/gen/kotlin-client`) is never edited by hand. Run `just generate`.
