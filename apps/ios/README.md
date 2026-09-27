# apps/ios: native iOS app (Swift 6 + SwiftUI)

The iPhone client of AI Stylist. It is fully native, has no 3D, and talks to the one backend through the
Swift client **generated** from the OpenAPI contract.

## Layout

```
project.yml              XcodeGen spec: the ONLY project definition (the .xcodeproj is generated, gitignored)
.xcode-version           pinned Xcode (27.0); checked by `just ios-doctor`
.swift-format            formatter + formatter-level safety rules (no force unwrap / force try / IUO)
.swiftlint.yml           SwiftLint safety rules only (only_rules)
Config/                  ALL build settings: Base (Swift 6 safety), Dev / Preview / Prod, Release; optional
                         gitignored Local.xcconfig (POSTHOG_API_KEY / POSTHOG_HOST, per machine)
App/                     thin app target: @main entry, CompositionRoot, Info.plist, privacy manifest, assets,
                         PostHogAnalyticsSink (the only posthog-ios user), ForceTestCrash (DEBUG only)
Packages/Core/           no UI; builds and tests on macOS AND Linux
  Sources/AppConfig        API_BASE_URL + app version validator (host-only base URL)
  Sources/Analytics        analytics port, consent gate (OFF by default), NoopSink, SDK-free PostHogSettings
  Sources/AppServices      container handed to features + service protocols (VersionFetching) + DebugTools
  Sources/APIData          the ONLY code that imports the generated client (AIStylistAPI) / OpenAPI runtime
  tests/<Target>Tests      Swift Testing unit tests
Packages/Features/       one pair of targets per screen
  Sources/HomeModel        @Observable view model (no SwiftUI; tests run on Linux too)
  Sources/HomeFeature      SwiftUI view (Apple platforms only; left out of the manifest on Linux)
  tests/HomeModelTests
scripts/                 recipe bodies (bash 3.2-portable); fixtures/ prove each ban still fires
```

The generated client lives in `packages/contracts/gen/swift-client/`. `tools/codegen/gen-swift.sh`
(`just generate`) writes it. Never edit it. Its package has two products: `AIStylistAPI` (the OpenAPI client) and
`AIStylistKernel` (reason codes, entitlement names and units generated from `packages/shared-kernel/registry/*.json`,
[ADR-0005](../../docs/adr/0005-shared-kernel-registries-for-native-clients.md)). No app target consumes
`AIStylistKernel` yet.

## Environments

| Config (scheme)               | Display name       | Bundle id                      | API_BASE_URL (host-only)             |
| ----------------------------- | ------------------ | ------------------------------ | ------------------------------------ |
| Dev (`AIStylist-Dev`)         | AI Stylist Dev     | `app.aistylist.mobile.dev`     | `http://localhost:3000`              |
| Preview (`AIStylist-Preview`) | AI Stylist Preview | `app.aistylist.mobile.preview` | `https://staging-api.ai-stylist.app` |
| Prod (`AIStylist-Prod`)       | AI Stylist         | `app.aistylist.mobile`         | `https://api.ai-stylist.app`         |

`API_BASE_URL` is **host-only**: scheme, host and optional port, with no path. The operation paths already start with
`/v1`. `AppConfig.parse` rejects a base URL that has a path, so a request can never go to `/v1/v1/...`. In an
xcconfig, `//` starts a comment, so write URLs as `http:/$()/host`. Everything in the bundle is public, so never put
a secret in an xcconfig.

## Analytics and crash reporting (PostHog)

- One port: features call `Analytics`; `ConsentGatedAnalytics` decides consent (OFF by default, not persisted
  yet: P03). Before the first grant the sink gets no call at all. A grant calls `activate()`, a withdrawal
  `deactivate()`, and events tracked while consent is off are dropped, never replayed.
- `App/PostHogAnalyticsSink.swift` wraps the official SDK [posthog-ios](https://github.com/PostHog/posthog-ios)
  (pinned exactly in `project.yml`, app target only). `activate()` sets the SDK up on the first grant (and
  `optIn()`s after a withdrawal); `deactivate()` calls `optOut()`. The settings live in Core's `PostHogSettings`
  (unit-tested on Linux): no autocapture, screen views, lifecycle events, session replay, surveys, flag preload,
  `$feature_flag_called` events, swizzling or breadcrumbs; person profiles identified-only (the app never
  identifies yet); error tracking autocapture ON (native crashes, stored on disk and sent on the next launch
  once the user has opted in again). No crash handler exists before consent.
- Keys are never committed. `POSTHOG_API_KEY` (project key `phc_...`, public by design because it ships in
  Info.plist) and `POSTHOG_HOST` come from `Config/Local.xcconfig` (gitignored) or from the environment of
  `just ios-build` / `just ios-e2e`. Empty key: the composition root binds `NoopSink` and no PostHog code runs.
  A personal API key (`phx_...`) is a secret and is rejected at launch.

  ```sh
  # apps/ios/Config/Local.xcconfig (gitignored). `//` starts an xcconfig comment, hence :/$()/
  POSTHOG_API_KEY = phc_your_project_key
  POSTHOG_HOST = https:/$()/eu.i.posthog.com
  ```

- Debug tools (Dev configuration only, where `DEBUG` is set): the home screen shows "Analytics consent (debug)"
  (`debug_consent_toggle`) and "Force test crash" (`debug_force_crash`), which calls `forceTestCrash()` in
  `App/ForceTestCrash.swift`. Preview and Prod compile neither the crash function nor the debug tools.
- Symbols: every configuration writes a dSYM (Dev too). `just ios-build` uploads them afterwards with
  posthog-ios's own `build-tools/upload-symbols.sh` (`posthog-cli dsym upload`) when `POSTHOG_CLI_API_KEY`,
  `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST` are all set, and prints a notice otherwise. It is not a Run
  Script phase because that script skips configurations not named "Release" and needs script sandboxing off.
  Install the CLI with `npm install -g @posthog/cli` or `brew install posthog/tap/posthog-cli`.
- To see a symbolicated crash, run the app without the debugger (an attached debugger disables the crash
  handler): build, launch from the simulator's home screen, switch analytics consent on, tap "Force test
  crash", relaunch, switch consent on again. The crash arrives as a `$exception` event in PostHog error
  tracking with the `forceTestCrash()` frame.

## Safety settings (non-negotiable)

- The Swift 6 language mode is on, so strict concurrency is `complete` and data races are compile errors.
- Code runs on the main actor by default (`SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`), with approachable
  concurrency. Opt out explicitly with `nonisolated` or `@concurrent`, so real parallelism is visible in review.
- `ExistentialAny`, `MemberImportVisibility` and `InternalImportsByDefault` are enabled, and all warnings are errors.
- The xcconfigs set these for the app target. For our package targets, `strictSettings` in each `Package.swift` sets
  them. Keep the two in sync. Generated code is exempt.
- These are banned: `@unchecked Sendable`, `nonisolated(unsafe)`, `@preconcurrency import`, UI imports in `Core` and
  `*Model` targets, and generated-client imports outside `APIData`. `just ios-check-banned` enforces the bans.
- Don't use force unwraps, `try!`, implicitly unwrapped optionals, `unowned` captures, or non-private `@State`.
  swift-format and SwiftLint enforce these.

## Commands

The `just` recipes are wired in the root justfile. The recipe bodies are `apps/ios/scripts/*.sh`.

| Recipe                                         | macOS | Linux | What it does                                                                                                        |
| ---------------------------------------------- | :---: | :---: | ------------------------------------------------------------------------------------------------------------------- |
| `just ios-doctor`                              |  yes  |  yes  | Checks that Xcode matches `.xcode-version` and that the tools are installed. On Linux it reports what can run there |
| `just ios-project`                             |  yes  |  no   | Runs XcodeGen: `project.yml` to `AIStylist.xcodeproj`                                                               |
| `just ios-build [--config dev\|preview\|prod]` |  yes  |  no   | Builds the app unsigned for the simulator, then uploads its dSYMs to PostHog when `POSTHOG_CLI_*` are set           |
| `just ios-test`                                |  yes  |  no   | Runs the package unit tests through the `AIStylist-Dev` scheme on an iOS 26+ iPhone simulator                       |
| `just ios-e2e`                                 |  yes  |  no   | Builds Dev for the simulator and runs the shared Maestro flow `e2e/smoke.yaml` (`APP_ID=app.aistylist.mobile.dev`) |
| `just ios-test-packages [core\|features]`      |  yes  |  yes  | Runs `swift test` for Core and the Features view models                                                             |
| `just ios-lint`                                |  yes  |  yes  | Runs the SwiftLint safety rules (on Linux: `swiftlint-static`)                                                      |
| `just ios-format [--check]`                    |  yes  |  yes  | Runs swift-format, in place or as a check                                                                           |
| `just ios-check-banned [--fixtures]`           |  yes  |  yes  | Runs the grep bans, or proves every ban still fires                                                                 |
| `just ios-check`                               |  yes  |  yes  | The local gate: lint, format check, bans (+ fixtures), package tests; on macOS also `ios-build` + `ios-test`        |

Where Swift comes from on Linux: a working `swift` on PATH, else Docker `swift:6.4`. `mise.toml` does not pin Swift
(Xcode provides it on macOS).

### First run on the Mac

```sh
./scripts/bootstrap.sh --system   # once: Xcode 27.0 (xcodes installs it if missing), selected, licence, first launch,
                                  # iOS simulator (sudo); also mise install: xcodegen, swiftlint, xcbeautify, maestro, just
just ios-doctor              # Xcode 27.0 selected?
just ios-project             # generate AIStylist.xcodeproj
open apps/ios/AIStylist.xcodeproj   # scheme AIStylist-Dev, any iPhone simulator
just ios-build && just ios-test
```

To add a file, create it under `App/` or in a package, then re-run `just ios-project`. XcodeGen picks it up, so you
never edit the project file. To add a screen, add a `<Name>Model` target (with tests in `tests/<Name>ModelTests`) and a
`<Name>Feature` target to `Packages/Features/Package.swift`, and add the test target to the `AIStylist-Dev` scheme in
`project.yml`.
