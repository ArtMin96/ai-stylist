# apps/ios: native iOS app (Swift 6 + SwiftUI)

The iPhone client of AI Stylist. It is fully native, has no 3D, and talks to the one backend through the
Swift client **generated** from the OpenAPI contract.

## Layout

```
project.yml              XcodeGen spec: the ONLY project definition (the .xcodeproj is generated, gitignored)
.xcode-version           pinned Xcode (27.0); checked by `just ios-doctor`
.swift-format            formatter + formatter-level safety rules (no force unwrap / force try / IUO)
.swiftlint.yml           SwiftLint safety rules only (only_rules)
Config/                  ALL build settings: Base (Swift 6 safety), Dev / Preview / Prod, Release
App/                     thin app target: @main entry, CompositionRoot, Info.plist, privacy manifest, assets
Packages/Core/           no UI; builds and tests on macOS AND Linux
  Sources/AppConfig        API_BASE_URL + app version validator (host-only base URL)
  Sources/Analytics        analytics port + consent-gated no-op stub (consent OFF by default)
  Sources/AppServices      container handed to features + service protocols (VersionFetching)
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
| `just ios-build [--config dev\|preview\|prod]` |  yes  |  no   | Builds the app unsigned for the simulator                                                                           |
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
mise install                 # xcodegen, swiftlint, xcbeautify, maestro (+ just)
just ios-doctor              # Xcode 27.0 selected?
just ios-project             # generate AIStylist.xcodeproj
open apps/ios/AIStylist.xcodeproj   # scheme AIStylist-Dev, any iPhone simulator
just ios-build && just ios-test
```

To add a file, create it under `App/` or in a package, then re-run `just ios-project`. XcodeGen picks it up, so you
never edit the project file. To add a screen, add a `<Name>Model` target (with tests in `tests/<Name>ModelTests`) and a
`<Name>Feature` target to `Packages/Features/Package.swift`, and add the test target to the `AIStylist-Dev` scheme in
`project.yml`.
