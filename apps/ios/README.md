# apps/ios: native iOS app (Swift 6 + SwiftUI)

The iPhone client of AI Stylist. It is fully native, has no 3D, and talks to the one backend through the
Swift client **generated** from the OpenAPI contract.

## Layout

```
project.yml              XcodeGen spec: the ONLY project definition (the .xcodeproj is generated, gitignored)
Package.resolved         the app's SwiftPM lockfile: every remote package (posthog-ios + the Packages/* pins),
                         each pinned to a commit; `just ios-project` seeds Xcode with it (see "Package pins")
.xcode-version           pinned Xcode (27.1); checked by `just ios-doctor`
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
  Sources/APIData          the ONLY code that imports the generated client (AIStylistAPI) / OpenAPI runtime;
                           also depends on the generated AIStylistKernel
  tests/<Target>Tests      Swift Testing unit tests
Packages/Features/       one pair of targets per screen
  Sources/HomeModel        @Observable view model (no SwiftUI; tests run on Linux too)
  Sources/HomeFeature      SwiftUI view (Apple platforms only; left out of the manifest on Linux)
  Sources/CaptureModel     guided capture camera logic and pixel measuring (no UI, camera, Vision or
                           analytics; tests run on Linux too)
  Sources/CaptureFeature   capture screens + camera plumbing (SwiftUI, AVFoundation, Vision, CoreMotion,
                           PhotosUI; iOS-only sources, `#if os(iOS)`); copy in Resources/Localizable.xcstrings
  Sources/CaptureDebug     dev-only capture test harness (frame sets, sweep, results log); linked by the
                           Dev configuration only, like DesignSystemCatalog
  tests/HomeModelTests
  tests/CaptureModelTests
  tests/CaptureFeatureTests  every capture string key exists (runs under `swift test` on macOS too)
  tests/CaptureDebugTests    the harness launch arguments (runs under `swift test` on macOS too)
Packages/DesignSystem/   app-internal design system (DEC-87); no dependency on Core or APIData; used by the app
                         target (`.appTheme()` at the root) and the *Feature targets
  Sources/DesignTokens     Foundation-only tokens (tests run on Linux too); `just generate` writes them into
                           generated/ (never hand-edit); beside it, the hand-written C02 icon geometry
                           (AppIconGeometry, `package` access)
  Sources/DesignSystem     SwiftUI layer (Apple platforms only; left out of the manifest on Linux): AppTheme
                           (`\.appTheme`, set by `.appTheme()`), AppFonts (bundled fonts, Resources/Fonts),
                           AppButton (C01) with its face, style and rules, AppIcon (C02), AppChip (C03) with
                           its face, style and rules, AppTag, AppBadge and AppReasonRow (C03); the copy in
                           the String Catalog Resources/Localizable.xcstrings; system core, so no previews
  Sources/DesignSystemCatalog  dev-only (Apple platforms only): the Xcode previews and the debug "Design
                           system gallery"; linked by the Dev configuration only (see "Design system")
  tests/<Target>Tests      DesignTokensTests, DesignSystemTests, DesignSystemCatalogTests
scripts/                 recipe bodies (bash 3.2-portable); fixtures/ prove each ban still fires,
                         test-xcode-guards.sh the PostHog, pin and Device Hub guards of xcode.sh
```

The generated client lives in `packages/contracts/gen/swift-client/`. `tools/codegen/gen-swift.sh`
(`just generate`) writes it. Never edit it. Its package has two products: `AIStylistAPI` (the OpenAPI client) and
`AIStylistKernel` (reason codes, entitlement names and levels, units, error codes, measurement definitions,
starting shapes and capture rules generated from `packages/shared-kernel/registry/*.json`,
[ADR-0005](../../docs/adr/0005-shared-kernel-registries-for-native-clients.md)). The Core package compiles
`AIStylistKernel`: `APIData` and `APIDataTests` depend on it, and `tests/APIDataTests/KernelTests.swift` checks
its registry invariants. `CaptureModel` in `Packages/Features` also depends on it: every capture threshold, count
and timing comes from the generated `CaptureRules`. Import it; never copy a value from it.

## Guided capture camera (CaptureModel)

The logic of capture brief `.claude/plans/2026-10-22-capture-camera-brief.md` §3–§7, pure and driven by an
injected clock (`CaptureClock`; the app uses `ContinuousCaptureClock`), so every rule and timing is tested with
`swift test` on macOS and Linux. No analytics (owner, 2026-10-22: camera only).

- `CaptureObservation`: one analysed frame from the platform (item box, mask area, edge contact, sharpness,
  luma, clipped share, device motion, tilt, body pose with `.modelUnavailable` for the doc-10 fallback).
- `CaptureRuleEngine`: one observation → `CaptureVerdict` (blocking and advisory hints in §6 order);
  `importTips(for:family:)` for a library still.
- `ShutterLock` (§4 states and transitions), `AnywayTimer`, `HintPresenter` (hold + minimum visible time) and
  `SpeechGate` (screen reader or speaker button, gap, repeat window).
- `CaptureCameraSession`: one camera screen; every input takes the clock time and returns `CaptureEffect`s
  (capture request, speech line, haptic) for the app to perform; `output` is what the screen draws.
- `CaptureModel` (`@Observable`): the flow (picker, underwear opt-in through `UnderwearOptInStore`, back and pair
  step, batch, library import); it reads the clock and owns one session per camera screen.
- `CaptureObservationSource`: the port the live camera + Vision source and the debug test-frame source implement.
- `CaptureGuideOutline`: the guide outline per shape family and mode, back and pair, as path segments in the
  350 × 506 preview the surface brief's C11 board draws them in; `CaptureFeature` scales them into the preview.

Hints, guides and reasons are keys (`CaptureHint`, `CaptureGuide`, `CaptureAnywayReason`); the copy lives in
`CaptureFeature`'s String Catalog, keyed by the hint keys (`CaptureText`).

### Screens and camera (CaptureFeature)

- `CaptureFlowView(dependencies:onClose:)` renders `CaptureModel.screen`: picker, underwear opt-in sheet and
  sub-pick, camera, inline photo picker, import tips, review, batch summary. The app opens it from Home's
  "Add item" (`home-open-capture`), Dev builds only (capture brief Q-F); nothing is saved, photos stay in memory.
- `CaptureCamera` is the port the screen runs: `LiveCaptureCamera` (AVCaptureSession, preview-sized analysis
  buffers, Vision foreground mask and body pose, luma, CoreMotion) or the Dev harness's frame camera.
  `CaptureCameraController` feeds observations and ticks to the model and performs its effects (photo, speech
  or VoiceOver announcement, haptics) inside the camera view's `.task`, which stops on leave or background.
- The surface brief's "Proposed values" (guide stroke, shutter, hint card, step pill, count chip, anyway slot)
  are in `CaptureMetrics` until they are DESIGN.md tokens. `NSCameraUsageDescription` is in `App/Info.plist`.

### Capture test harness (CaptureDebug, Dev only)

Launch arguments (`-key value`, as `xcrun simctl launch` and Maestro `launchApp: arguments` pass them, or
`key=value`):

- `captureFrameSet <set id>`: the camera plays that set from `index.json` in real time (30 fps).
- `captureScreenReader 1`: VoiceOver behaviour (anyway at once, spoken hints) plus the visible spoken log.
- `captureSweep 1`: the capture flow opens at launch and plays every set (or only `captureFrameSet`) on a
  virtual clock; a capture is recorded and the camera carries on (batch sets still count photos).
- `captureMaskCadenceMs <ms>`: frame sets give the rules a new mask only this often, stamped with its time, as the
  phone's Vision mask (every 250 ms) does; `just capture-sim-ios` sweeps with it. Unset: a fresh mask every frame.
- `captureRecordOnly 1`: in real time, a capture is recorded and the camera carries on (the sweep's rule), so
  the unlocked states keep coming back for the `e2e/capture` screenshot flows.
- `captureFramesDir <absolute path>`: the frames folder; default `<repo>/artifacts/capture-camera/frames` of
  the checkout the Dev build was compiled from (`just capture-frames` writes it; the Simulator reads the
  Mac's file system).

Results: one JSON line per played segment in `Documents/capture-results.jsonl` of the app's data container
(`xcrun simctl get_app_container booted app.aistylist.mobile.dev data`); a sweep writes
`Documents/capture-results.done` when it ends. A launch with any harness argument starts a fresh log. The debug
panel (`cap-debug-panel`) switches the source and the set (`cap-debug-frameset-<set id>`) for the next camera
opening.

## Design system

- **Theme.** `.appTheme()` is applied once, in `App/AIStylistApp.swift`. It registers the bundled fonts and
  sets the environment value `\.appTheme` from the system appearance: light → S1 (`light`), dark → S2
  (`dark`), Increase Contrast → S7 (`hcLight` / `hcDark`). The S3 brand scheme is not selected anywhere yet.
  It also sets the root foreground style to the theme's `text` role, so inherited foregrounds (an untinted
  `AppIcon`) draw in the token, not the system `.primary`. `AppTheme` only selects a context of the generated tokens and adapts them (ARGB → `Color`, `AppTextStyle`
  → `Font` scaled with Dynamic Type); it never redeclares a value.
- **AppButton.** `AppButton(_:variant:size:leadingIcon:fullWidth:enabled:loading:action:)` follows the C01
  contract `.impeccable/components/button.yaml`. A variant and size pair the contract does not allow renders
  nothing. The caller attaches the test ID with `.accessibilityIdentifier(_:)`. `leadingIcon: AppIconName?`
  draws an `AppIcon` at the look's `iconSize` step in the label colour; while loading, the spinner takes the
  same Dynamic Type-scaled slot.
- **AppIcon.** `AppIcon(_:size:tint:)` follows the C02 contract `.impeccable/components/icon.yaml`: any of
  the generated `AppIconName` glyphs at an `AppIconSize` step (default `AppIconMetrics.defaultSize`,
  `icon-lg`). The rendered size is the token size scaled with Dynamic Type, no cap, by the step's text
  style (`AppIcon.scalingStyle(for:)`: xs to lg `.body`, xl `.title2`, hero `.largeTitle`, so the large
  steps grow more gently, owner 2026-10-21; `AppButton`'s leading slot uses the same function). The stroke
  scales with it (`AppIconGeometry` in `DesignTokens`, tested on Linux). `tint: nil` draws in the inherited foreground style; a role draws in
  `theme.color(role)`. The frame is exactly the rendered size; the host control owns the 44 pt target and
  the accessible name, because the icon is hidden from VoiceOver.
- **AppChip.** `AppChip(_:variant:size:leadingIcon:selected:expanded:enabled:selection:prefix:detail:swatch:accessibilityLabel:action:)`
  follows the C03 contract `.impeccable/components/chip.yaml`. `AppChipRules` picks the state shown (G2:
  disabled, else pressed, else focused, prefixed with `selected-` or `expanded-` while that toggle is on).
  When the resting state has no look at that variant and size (a size the variant does not take, or a
  toggle or `enabled: false` it does not take) the chip renders nothing; a pressed or focused state with no
  look shows the resting look. The look follows the chip's `enabled` only, never the environment's
  `isEnabled`, so a parent's `.disabled(true)` blocks activation but keeps the look. The content is the
  leading icon, the before-label parts (prefix, swatch), the label, the detail (behind the separator copy)
  and the trailing icon. A swatch gets its inner edge when its WCAG contrast with the fill is below
  `swatchEdgeMinContrast` (`AppColorContrast`), and always on a look with no fill. Every chip has the
  generated touch target `ChipAccessibility.minTouchTarget` (44 pt; `AppButtonStyle` reads
  `ButtonAccessibility.minTouchTarget`, both through `appTouchTarget` in `AppInteraction`) and the
  `AppMotion.Press` transition, none under Reduce Motion. VoiceOver
  reads `accessibilityLabel ?? label` in the role of `variant.role`: button; selectable as a toggle
  (`selection: .multiple`) or a button that is selected (`.single`); disclosure with the value "Expanded" /
  "Collapsed"; menu as a button that is selected while `selected`. `AppChipFace` has `package` access, so
  the catalog can draw forced states.
- **AppTag, AppBadge, AppReasonRow.** `AppTag(_:variant:size:leadingIcon:accessibilityLabel:)` (tag.yaml)
  reads as static text, with a dashed ring where the look sets `borderDash`. `AppBadge(variant:size:label:hostSurface:)`
  (badge.yaml) draws the dot, the count or a trial pill; a look that draws a label renders nothing without
  one; the dot and the count are hidden from VoiceOver, and `hostSurface` colours the ring outside them.
  `AppReasonRow(_:fact:factIcon:freshness:accessibilityLabel:)` (reason-row.yaml) is a region named by
  `accessibilityLabel` that fills the offered width, its icon disc grown with Dynamic Type as the icon is.
  None of the three has an action or a touch target. A variant and size pair the contract does not allow
  renders nothing.
- **Shared drawing.** One copy each, used by every component: `AppComponentText` draws every run of text in
  a type style (the components' labels and parts, and every catalog text), applying the style's
  `textTransform` to the drawn string only (the overline draws in caps; VoiceOver reads the caller's
  string); `appFace` (`AppFaceLook`) pads and sizes the button, chip and tag pills, and `AppShapeStyle`
  draws every fill, pressed overlay, inner ring and focus ring; `AppOutsideRing` draws the focus ring, the
  badge's outer ring and the selected swatch's ring.
- **Copy.** The components' strings live in the String Catalog `Sources/DesignSystem/Resources/Localizable.xcstrings`
  (source language en, `defaultLocalization: "en"` in `Package.swift`), never in Swift: `app_button_loading`,
  `ds_chip_detail_separator` (`· `, read by its generated key `ChipPart.detail.separatorKey`),
  `ds_chip_state_expanded`, `ds_chip_state_collapsed`. Keys and values equal the Android string resources.
- **Catalog (dev-only).** Previews and dev tools never live in the `DesignSystem` target (owner rule,
  2026-10-20). They live in the `DesignSystemCatalog` target of the same package, which carries no
  `#if DEBUG`. `AppButtonPreviews.swift` holds "AppButton states, light" and "AppButton states, dark"
  (the gallery's C01 section) and "AppButton playground" (with a leading-icon picker).
  `AppIconPreviews.swift` holds "AppIcon set, light", "AppIcon set, dark" and "AppIcon set, largest text"
  (the gallery's C02 section; the largest-text one first draws one glyph at every step).
  `AppChipPreviews.swift`, `AppTagPreviews.swift`, `AppBadgePreviews.swift` and `AppReasonRowPreviews.swift`
  each hold "<Component> states, light", "<Component> states, dark" (the gallery's C03 section) and a
  "<Component> playground" with live controls. Every previews file shares one scaffold: the state grid
  `GallerySectionPreview(component:)`, the light and dark frames `previewFrame(_:)`, and the variant and
  size rows `PlaygroundPickers`. `AppButtonFace` and `AppChipFace` have `package` access, so
  the catalog can draw forced states (pressed, focused, loading, disabled, the toggles); `HomeFeature` and
  the app cannot.
- **Design system gallery (AI-195).** In the Dev build, Home's debug section shows "Design system gallery"
  (`debug_open_ds_gallery`). It opens `DesignSystemGalleryScreen` full screen (root `ds-gallery`, "Close"
  = `debug_close_ds_gallery`). The screen shows the sections Colours, Typography, Spacing, Radius, then
  one section per generated `GalleryComponent` (today "C01 Buttons", "C02 Icons", "C03 Badges", "C03 Chips",
  "C03 Reason row", "C03 Tags"), each tagged `ds-gallery-section-<slug>`. "C02 Icons" has a "Size" and
  "Tint" playground, then every glyph grouped by `AppIconSet`, each cell tagged `ds-icon-<id>` and captioned
  with the glyph id; the cells wrap, and a caption wider than the screen wraps inside its cell. The C01 and
  C03 sections draw every `ComponentGallery` entry in generated order with the generated samples and the
  entry's own sample label (`entry.label`; the trial pills have words of their own), each cell
  (`GalleryCaptionedCell`) tagged with the entry's test ID and captioned with it: the chips (forced states through `AppChipFace`)
  and the tags in wrapping rows, the badges on their host surface `ComponentGallery.badgeHostSurface`, the
  reason row on its own. Every item comes from the generated manifest
  (`AppColorRole` raw values, `AppTypography.all`, `AppSpacing.all`, `AppRadius.all`, `ComponentGallery`,
  `AppIconName`, `AppIconSet`), so a new token, component cell or glyph appears without a hand edit, and a new component fails the build until
  `GallerySection` maps it. The scheme follows the system appearance (S1, S2, S7).
- **How Prod excludes the catalog.** `project.yml` adds `DesignSystemCatalog` as a build dependency
  with `link: false`, and only `Config/Dev.xcconfig` links its object
  (`OTHER_LDFLAGS = $(inherited) $(BUILT_PRODUCTS_DIR)/DesignSystemCatalog.o …`; the capture harness
  `CaptureDebug.o` is linked the same way). `App/AIStylistApp.swift`
  imports and uses it under `#if DEBUG` only. In the P0 spike (2026-10-20), a plain link put 37 symbols of a
  throwaway catalog into the Prod binary, even with the `#if DEBUG` in the app. With this setup Prod
  had 0 symbols and 0 strings. Check with `strings -a` and `nm -m` on
  `.build/DerivedData/Build/Products/Prod-iphonesimulator/AIStylist.app/AIStylist` after
  `just ios-build --config prod`. Preview links no catalog either.

### Fonts

Bundled in `Packages/DesignSystem/Sources/DesignSystem/Resources/Fonts/`, registered per process with
CoreText. Source: google/fonts, files unmodified (renamed only). OFL 1.1, no Reserved Font Name; each font
ships its own licence file. Figtree is one variable font (axis `wght` 300–900, default instance Light 300), so
every Figtree style sets its weight from `AppTextStyle.fontWeight`; Young Serif is 400 only. No system font
fallback.

| File                     | Source (google/fonts ref)                                                     | sha256                                                             |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Figtree-Variable.ttf`   | `a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/Figtree[wght].ttf`      | `26ad3db9b31ff7dde67a91ff515d022d2f495cd506590699cf264f0bfe6fb714` |
| `YoungSerif-Regular.ttf` | `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/youngserif/YoungSerif-Regular.ttf` | `42bb2602364b28569fdce5eeb6ab3d81cf8090ba81b211f1229ed69f33155523` |
| `Figtree-OFL.txt`        | `a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/OFL.txt`                | `140d37233e7f3ce7313798befa9600893bcceaf41a55fa0fa5ad52f7f657a268` |
| `YoungSerif-OFL.txt`     | `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/youngserif/OFL.txt`             | `737d8d343b674c6894f373de71a044b6782c130f2aebf180933d63ddf7a3dc19` |

Upstream projects: Figtree `https://github.com/erikdkennedy/figtree` (google/fonts imports commit 032dfa7),
Young Serif `https://github.com/noirblancrouge/YoungSerif` (commit d307c79). Android ships the same bytes.

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
  `deactivate()`, and events tracked while consent is off are dropped, never replayed. The gate decides; the
  sink only translates each call into SDK calls.
- `App/PostHogAnalyticsSink.swift` wraps the official SDK [posthog-ios](https://github.com/PostHog/posthog-ios)
  (pinned by commit in `Package.resolved`, app target only). `activate()` sets the SDK up (first grant, or the
  first grant after a withdrawal) and calls `optIn()`. The settings live in Core's `PostHogSettings`
  (unit-tested on Linux): no autocapture, screen views, lifecycle events, session replay, surveys, flag preload,
  `$feature_flag_called` events, swizzling or breadcrumbs; person profiles identified-only (the app never
  identifies yet); error tracking autocapture ON (native crashes, stored on disk and sent on the next launch
  once the user has opted in again). No crash handler exists before consent.
- Withdrawal (`deactivate()`) discards, never flushes. It calls `optOut()`, then `close()`, because
  `optOut()` alone leaves the event queue running (its timer and the flush on entering the background would
  still send what is queued), then deletes the SDK's on-disk event queue. posthog-ios 3.85.0 has no public call
  that empties that queue, so the sink deletes the directory the SDK uses
  (`PostHogSettings.eventQueueDirectory`; re-check it on every SDK bump). A batch already being uploaded at
  that moment is not recalled.
- A crash after a withdrawal is discarded too. posthog-ios cannot remove its crash handler once installed, so
  a crash later in the same run is still written to disk, and the SDK would send it at the next setup, after
  the next grant. The sink stores one flag in `UserDefaults` (set on withdrawal, cleared on grant; no user
  data), and the SDK's `beforeSend` hook drops every `$exception` from before the current setup when that flag
  was set (`PostHogSettings.dropsEvent`, unit-tested). The one gap: a crash report that has no timestamp gets
  the time it is processed, so it would be sent (PLCrashReporter records a timestamp on every crash).
- Keys are never committed. `POSTHOG_API_KEY` (project key `phc_...`, public by design because it ships in
  Info.plist) and `POSTHOG_HOST` (the ingestion host of your PostHog region; this project is on US Cloud,
  `https://us.i.posthog.com`) come from `Config/Local.xcconfig` (gitignored) or from the environment of
  `just ios-build` / `just ios-test` / `just ios-e2e`. Empty key: the composition root binds `NoopSink` and no
  PostHog code runs. A personal API key (`phx_...`) is a secret: `scripts/xcode.sh` stops before building when
  `POSTHOG_API_KEY` is anything but a `phc_` key, in the environment or on any `POSTHOG_API_KEY` line of
  `Local.xcconfig` (it does not follow `#include`), and names the key but never its value. The app still
  rejects such a key at launch.

  ```sh
  # apps/ios/Config/Local.xcconfig (gitignored). `//` starts an xcconfig comment, hence :/$()/
  POSTHOG_API_KEY = phc_your_project_key
  POSTHOG_HOST = https:/$()/us.i.posthog.com
  ```

- Privacy manifest (`App/PrivacyInfo.xcprivacy`): after opt-in the app collects crash data (purpose App
  Functionality), product interaction (`app_opened`, purpose Analytics) and a device ID (the persistent
  pseudonymous install id posthog-ios puts on every event and crash report; purposes Analytics and App
  Functionality), all not linked to an identity and not used for tracking. It also declares the app's own
  `UserDefaults` use (reason `CA92.1`). Other diagnostic data is not declared: the settings above turn off
  everything but crash reports. posthog-ios ships its own manifest (product interaction and other usage data
  for analytics, plus its required-reason APIs), and Xcode's privacy report lists both. The App Store privacy
  label is the union. Revisit the manifest when P03 adds accounts (identify() would make the data linked).
- Debug tools (Dev configuration only, where `DEBUG` is set): the home screen shows "Analytics consent (debug)"
  (`debug_consent_toggle`) and "Force test crash" (`debug_force_crash`), which calls `forceTestCrash()` in
  `App/ForceTestCrash.swift`. Preview and Prod compile neither the crash function nor the debug tools.
  Intended difference: Android also shows the debug tools in its minified `preview` build (R8 proof); iOS
  Dev + dSYM suffices.
- Symbols: every configuration writes a dSYM (Dev too). `just ios-build` uploads them afterwards with
  posthog-ios's own `build-tools/upload-symbols.sh` (`posthog-cli dsym upload`) when `POSTHOG_CLI_API_KEY`,
  `POSTHOG_CLI_PROJECT_ID` and `POSTHOG_CLI_HOST` are all set, and prints a notice otherwise. It is not a Run
  Script phase because that script skips configurations not named "Release" and needs script sandboxing off.
  Only that upload sees the `POSTHOG_CLI_*` variables: `scripts/xcode.sh` takes them out of the environment
  first, because xcodebuild turns every environment variable into a build setting.
  The upload passes `POSTHOG_SKIP_ON_CONFLICT=1`: a dSYM whose UUID PostHog already holds with other
  content is skipped, not a build failure. An equal UUID means equal code, so the stored symbols still
  fit; only debug metadata differs, e.g. after a CI runner image update.
  `mise.toml` pins the CLI (`npm:@posthog/cli`): `just bootstrap` installs it and `just doctor` checks it.
  `POSTHOG_CLI_HOST` is your PostHog region's app host (this project: `https://us.posthog.com`);
  `POSTHOG_HOST` is the ingestion host (`https://us.i.posthog.com`).
- To see a symbolicated crash, run the app without the debugger (an attached debugger disables the crash
  handler): build, launch from the simulator's home screen, switch analytics consent on, tap "Force test
  crash", relaunch, switch consent on again. The crash arrives as a `$exception` event in PostHog error
  tracking with the `forceTestCrash()` frame. Switching consent off before the crash discards it (see above).

## Package pins

`Package.resolved` (next to `project.yml`) is the app's lockfile. It holds posthog-ios, which `project.yml`
declares, plus the exact pins of `Packages/Core/Package.resolved` and `Packages/Features/Package.resolved`, each
with its commit. `just ios-project` copies it into the generated project, and every `xcodebuild` in
`scripts/xcode.sh` runs with `-onlyUsePackageVersionsFromResolvedFile`: Xcode checks out exactly those commits
(a moved tag changes nothing) and fails instead of re-resolving when the file no longer matches. osv-scanner
(`just security-scan`) reads it like every other lockfile. `just ios-check-banned --fixtures` fails when a
`Packages/*/Package.resolved` pin is missing from it or differs. After a package bump, copy the refreshed
`Packages/*/Package.resolved` pins in. For a posthog-ios bump, change `exactVersion` in `project.yml` and the
pin's `version` and `revision` (the commit of the release tag) together, then re-check the SDK internals that
`PostHogSettings` ("Consent withdrawal") mirrors.

## Safety settings (non-negotiable)

- The Swift 6 language mode is on, so strict concurrency is `complete` and data races are compile errors.
- Code runs on the main actor by default (`SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`), with approachable
  concurrency. Opt out explicitly with `nonisolated` or `@concurrent`, so real parallelism is visible in review.
- `ExistentialAny`, `MemberImportVisibility` and `InternalImportsByDefault` are enabled, and all warnings are errors.
- The xcconfigs set these for the app target. For our package targets, `strictSettings` in each `Package.swift` sets
  them. Keep the two in sync. Generated code is exempt.
- These are banned: `@unchecked Sendable`, `nonisolated(unsafe)`, `@preconcurrency import`, UI imports in `Core`,
  `*Model` and `DesignTokens` targets, and generated-client imports outside `APIData`. `just ios-check-banned`
  enforces the bans.
- Don't use force unwraps, `try!`, implicitly unwrapped optionals, `unowned` captures, or non-private `@State`.
  swift-format and SwiftLint enforce these.

## Commands

The `just` recipes are wired in the root justfile. The recipe bodies are `apps/ios/scripts/*.sh`.

| Recipe                                         | macOS | Linux | What it does                                                                                                        |
| ---------------------------------------------- | :---: | :---: | ------------------------------------------------------------------------------------------------------------------- |
| `just ios-doctor`                              |  yes  |  yes  | Checks that Xcode matches `.xcode-version` and that the tools are installed. On Linux it reports what can run there |
| `just ios-project`                             |  yes  |  no   | Runs XcodeGen: `project.yml` to `AIStylist.xcodeproj`, seeded with the pins of `Package.resolved`                   |
| `just ios-build [--config dev\|preview\|prod]` |  yes  |  no   | Builds the app unsigned for the simulator, then uploads its dSYMs to PostHog when `POSTHOG_CLI_*` are set           |
| `just ios-test`                                |  yes  |  no   | Runs the package unit tests through the `AIStylist-Dev` scheme on an iOS 26+ iPhone simulator                       |
| `just ios-e2e`                                 |  yes  |  no   | Builds Dev for the simulator and runs the shared Maestro flow `e2e/smoke.yaml` (`APP_ID=app.aistylist.mobile.dev`) |
| `just ios-run`                                 |  yes  |  no   | Builds Dev, installs the app, opens Device Hub and launches the app (`just dev ios` also starts the backend)        |
| `just ios-test-packages [pkg...]`              |  yes  |  yes  | Runs `swift test` for the packages `core`, `features`, `designsystem` (default: all three)                          |
| `just ios-lint`                                |  yes  |  yes  | Runs the SwiftLint safety rules (on Linux: `swiftlint-static`)                                                      |
| `just ios-format [--check]`                    |  yes  |  yes  | Runs swift-format, in place or as a check                                                                           |
| `just ios-check-banned [--fixtures]`           |  yes  |  yes  | Runs the grep bans, or proves every ban and the `scripts/xcode.sh` PostHog and pin guards still fire                |
| `just ios-check`                               |  yes  |  yes  | The local gate: lint, format check, bans (+ fixtures), package tests; on macOS also `ios-build` + `ios-test`        |

Where Swift comes from on Linux: a working `swift` on PATH, else Docker `swift:6.4`. `mise.toml` does not pin Swift
(Xcode provides it on macOS).

### First run on the Mac

```sh
./scripts/bootstrap.sh --system   # once: Xcode 27.1 (xcodes installs it if missing), selected, licence, first launch,
                                  # iOS simulator (sudo); also mise install: xcodegen, swiftlint, xcbeautify, maestro, just
just ios-doctor              # Xcode 27.1 selected?
just ios-project             # generate AIStylist.xcodeproj
open apps/ios/AIStylist.xcodeproj   # scheme AIStylist-Dev, any iPhone simulator
just ios-build && just ios-test
just dev                     # or all of it at once: backend + the app in the simulator (and the Android app)
```

To add a file, create it under `App/` or in a package, then re-run `just ios-project`. XcodeGen picks it up, so you
never edit the project file. To add a screen, add a `<Name>Model` target (with tests in `tests/<Name>ModelTests`) and a
`<Name>Feature` target to `Packages/Features/Package.swift`, and add the test target to the `AIStylist-Dev` scheme in
`project.yml`.
