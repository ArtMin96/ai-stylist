# Component gallery — cross-platform brief (2026-10-20, slug component-gallery)

Phase task: none (Brand v1, milestone "Design system": Linear AI-195; blocks AI-190) · Journey: N/A —
debug-only developer tooling, no user journey; AI-195 Scope 1 stands in for the States section
Branch: feat/ai-195-component-gallery · Lanes: iOS, Android (no API lane, no contract lane); three
prerequisites run by the lead first (P0–P2 below), the Maestro flow after integration

Approval (UI gate): not a gate. AI-195 Context records the owner decision of 2026-10-19: "The gallery
is debug-only tooling and is exempt from the `ui-prototype-first` surface-brief gate". The skill's own
"Not a gate" list (`.agents/skills/ui-prototype-first/SKILL.md:22`) does not name the gallery yet, so
each lane hands the lead the exact text for that line (see Docs). `ui-designer` still reviews
screenshots of every section in light and dark on both apps against `DESIGN.md` and canvas page 3
(AI-195 AC-7). No `.impeccable/surfaces/` brief.

Navigation (`cross-platform-feature` SKILL.md:73–76, "A second screen → stop and sequence a nav-shell
task"): not triggered. The gallery is a debug-only modal opened from Home's existing debug section. It
has no route, no tab and no back stack, and it needs no navigation dependency. AI-195 places it there
because neither app has a nav shell (AI-120 / AI-170). iOS presents it with `.fullScreenCover`.
Android swaps the activity content behind a boolean and closes on Back.

## Owner decision folded in (2026-10-20, binding)

"Previews are for development while base components are system core." So each app gets one dev-only
**catalog module** next to the core design system:

- iOS: target and library product `DesignSystemCatalog` in `apps/ios/Packages/DesignSystem/Package.swift`,
  inside the existing `#if !os(Linux)` block, depending on `DesignSystem` and `DesignTokens`.
- Android: Gradle module `:core:designsystem-catalog` at `apps/android/core/designsystem-catalog/`
  (Compose library, namespace `app.aistylist.core.designsystem.catalog`), depending on `:core:designsystem`.
- The existing previews (`AppButtonPreviews.swift` / `AppButtonPreviews.kt`, state grid and playground)
  move there, and the AI-195 gallery lives there too. Afterwards the core modules contain no `#Preview`,
  no `@Preview` and no `ui-tooling` / `ui-tooling-preview` dependency.
- Production code never depends on the catalog. Only the dev build reaches it: Android
  `debugImplementation` from `:app`; iOS see "iOS: how Prod excludes the catalog".

This supersedes these AI-195 lines: gallery paths `Sources/DesignSystem/Gallery/` and
`core/designsystem/src/debug/`; test paths `DesignSystemTests/GalleryTests.swift` and
`core/designsystem/src/test/.../gallery/`; "no lockfile change" and "no `ALLOWED_MODULE_EDGES` change"
(AC-5 "N unchanged" becomes N + 2); AC-3's `#if DEBUG` and `rg 'Gallery'` proofs (rewritten below).

## Outcome and scope

- Outcome: in the dev build of each app (iOS Dev, Android `debug`), a "Design system gallery" button
  in Home's debug section opens one screen. It shows every colour role, text style, spacing step and
  radius, then every `ComponentGallery.button` cell in its forced state. Sections, titles, order and
  ids are identical on both apps. Preview, Prod and release builds contain neither the screen nor the
  button.
- Inputs (generated; never hand-edit, never redeclare): `apps/ios/Packages/DesignSystem/Sources/DesignTokens/generated/*.swift`,
  `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/generated/*.kt`, after P1.
- Scheme: the gallery follows the system appearance and contrast through `AppTheme` (S1 light, S2
  dark, S7 high contrast; `.appTheme()` / `AppTheme {}`). No in-app scheme picker (AI-195 Scope 3).
  Previews force a scheme: iOS through `.environment(\.colorScheme, …)` + `.appTheme()` (public today),
  Android through `AppTheme(scheme = AppScheme.X)` (made public, below).
- Live controls: none in the gallery (AI-195 does not ask for them). The playground preview keeps its
  live controls and moves unchanged to the catalog.
- Acceptance criteria (AI-195's, adapted to the catalog modules):
  - AC-1 every manifest entry is rendered once with its generated test ID — proof: `just test android` → exit 0,
    with `GalleryTest` in `apps/android/core/designsystem-catalog/build/test-results/` (testsuite and
    testcase lines pasted); on the Mac `just ios-test` → exit 0 with `GalleryTests` listed.
  - AC-2 section titles, order and ids are identical on both apps — proof: the step-8 parity note with
    `rg -n 'ds-gallery|Design system gallery|debug_open_ds_gallery|debug_close_ds_gallery' apps/ios apps/android --glob '!**/build/**' --glob '!**/.build/**'`
    pasted, literals matching the Parity table.
  - AC-3 dev builds only — proof, Android: `rg -n 'designsystem\.catalog|designsystem-catalog' apps/android --glob '!**/build/**'`
    → hits only in `settings.gradle.kts`, `app/build.gradle.kts` (one `debugImplementation` line),
    `RootConventionPlugin.kt`, `app/src/debug/**` and `core/designsystem-catalog/**`. The lead's
    `:app:assemblePreview` and `:app:assembleRelease` compile without the catalog on the classpath.
    iOS: `rg -n 'DesignSystemCatalog' apps/ios/App apps/ios/Packages/Features apps/ios/Packages/Core`
    → hits only inside `#if DEBUG … #endif` in `apps/ios/App/`. On the Mac, `just ios-build --config dev`
    and `just ios-build --config prod` → exit 0. P0's symbol check on the Prod binary → no
    `DesignSystemCatalog` symbols and no `ds-gallery` string.
  - AC-4 no literal style values, no hand-written variant or test-ID list — proof:
    `rg -n '[0-9]+\.(dp|sp)\b|Color\(0x' apps/android/core/designsystem-catalog/src/main` → no hits;
    `rg -n 'Color\(red:|\.system\(size:|cornerRadius: [0-9]|spacing: [0-9]|padding\([0-9]' apps/ios/Packages/DesignSystem/Sources/DesignSystemCatalog`
    → no hits; `rg -n '"ds-[a-z]+-' apps/ios/Packages/DesignSystem/Sources apps/ios/Packages/Features/Sources apps/android/core/designsystem/src apps/android/core/designsystem-catalog/src --glob '!**/generated/**'`
    → only `ds-gallery` and `ds-gallery-section-` literals.
  - AC-5 core holds no preview code — proof: `rg -n '#Preview|PreviewProvider' apps/ios/Packages/DesignSystem/Sources/DesignSystem`
    → no hits; `rg -n '@Preview|ui\.tooling|ui-tooling' apps/android/core/designsystem --glob '!**/build/**'`
    → no hits.
  - AC-6 the face stays internal to the design system — proof: `rg -n 'AppButtonFace|AppScheme' apps --glob '!**/build/**' --glob '!**/.build/**' --glob '!**/README.md' --glob '!**/Packages/DesignSystem/**' --glob '!**/core/designsystem/**' --glob '!**/core/designsystem-catalog/**'`
    → no hits.
  - AC-7 gates green — proof: the lead runs `just ios-check` on the Mac (simulator build and tests
    included) and `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-check`
    → exit 0, with `checkModuleGraph: <N+2> edges, all allowed` (N = the count at the commit before P2).
  - AC-8 flow passes on devices (after integration, test-engineer) — proof: `just android-e2e e2e/design-system-gallery.yaml`
    and, on the Mac, `just ios-e2e e2e/design-system-gallery.yaml` → every step passes; `e2e/smoke.yaml`
    still passes on both. Without a device: `Not run`, AC open.
  - AC-9 `ui-designer` review of screenshots of each section in light and dark on both apps, no open
    finding (AI-195 AC-7). Screenshots go in the PR or `artifacts/designsystem-review/`.
- Non-goals: snapshot tests and goldens (AI-190); live controls in the gallery; an in-app scheme
  picker; new components; `AppElevation` / `AppMotion` sections (AI-195 lists four token sections
  only); the S3 brand scheme; any release-build UI; Home's `@Preview`s in `:feature:home` (owner's rule
  covers the core modules).
- Search done (lead, 2026-10-20, at 10cd9bc): `rg -n -i 'gallery|catalog|specimen|showcase' apps e2e`
  → only the generated `ComponentGallery` / `ButtonGalleryEntry` and `AppButtonPreviews.{swift,kt}`
  (state grid, playground). `rg -n '#if DEBUG' apps/ios/Packages --glob '*.swift'` → none (no package
  code is debug-gated today). Debug wiring: iOS `CompositionRoot.makeDebugTools()` (`#if DEBUG`),
  `AppServices.DebugTools`, `HomeModel.showsDebugTools`, ids `debug_consent_toggle` and
  `debug_force_crash`. Android `BuildConfig.DEBUG_TOOLS` (true in `debug` and `preview`),
  `AppContainer.forceTestCrash`, `HomeTestTags.DEBUG_*`, `HomeUiState.debugTools`. The generated API
  has no section list, no display name or slug, no colour-role name, and no enumerable typography,
  spacing or radius (→ P1). Siblings to copy: `apps/ios/Packages/DesignSystem/Sources/DesignSystem/AppButtonPreviews.swift`
  and `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/AppButtonPreviews.kt`
  (the C01 section is their state grid, laid out as one column), `apps/android/core/designsystem/build.gradle.kts`
  (the catalog build file), `apps/android/feature/home/src/test/kotlin/app/aistylist/feature/home/HomeScreenTest.kt`
  (Robolectric Compose test), `apps/ios/Packages/Features/tests/HomeModelTests/HomeModelTests.swift`.

## Prerequisites before launch (lead; BASE is the commit after all three)

- **P1: generated gallery manifest (tooling-engineer, then ui-designer, then the lead).** AI-195 says
  "a missing manifest field → stop and report to the lead (contracts ticket)". These fields are missing.
  Both emitters (`tools/codegen/tokens/emit-api-{swift,kotlin}.mjs`, `emit-{swift,kotlin}.mjs`, the
  declarations, the parity test) gain the following. Names and strings are identical in Swift and Kotlin.
  - `AppColorRole` carries its `DESIGN.md` role key (no scheme suffix), e.g. `text-secondary`, `surface-2`.
    Swift: `enum AppColorRole: String, CaseIterable` with that raw value. Kotlin: `val id: String` as
    the first constructor parameter. Order unchanged.
  - `AppTextStyle` gains `name: String` with the `DESIGN.md` key (`display`, `title-1`, …,
    `button-disabled`). `AppTypography.all` lists every style in `DESIGN.md` order.
  - New `AppScaleStep(name: String, value: Double)`. `AppSpacing.all` holds names `spacing-4` …
    `spacing-64`. `AppRadius.all` holds names `rounded-2` … `rounded-24`, `rounded-full`, in `DESIGN.md` order.
  - New `GalleryComponent`, one case per component contract, in board order. Swift:
    `enum GalleryComponent: String, CaseIterable, Sendable { case button }` with `title` and `slug`.
    Kotlin: `enum class GalleryComponent(val id: String, val title: String, val slug: String) { BUTTON("button", "C01 Buttons", "c01-buttons") }`.
    `title` = "`{board} {gallery.title}`", `slug` = lower-case kebab of the title. The gallery switches
    exhaustively over it, so a new contract fails the build until it has a renderer. Hand edits stay
    impossible to forget.
  - Contract: `component-contract.schema.json` requires `gallery.title` (tooling-engineer, with the
    field rule in `.impeccable/components/README.md` written by ui-designer). ui-designer adds
    `title: Buttons` under `gallery:` in `.impeccable/components/button.yaml`. This is metadata whose
    text AI-195 fixes ("C01 Buttons"); no visual change.
  - Proof: `just test tooling` → design-tokens suite green; the lead runs `just generate`, then
    `just generate --check` → up to date; commit.
- **P2: Android catalog module scaffold and lockfiles (lead).** A new module cannot be created inside
  the lane. `LockMode.STRICT` fails without the module's `gradle.lockfile`, lockfiles change only
  through `just android-deps-lock`, and that recipe assembles `preview` and `release`, which upload R8
  mappings when the PostHog CLI keys are set.
  - `apps/android/settings.gradle.kts`: include `:core:designsystem-catalog`.
  - `apps/android/core/designsystem-catalog/build.gradle.kts`: copy `core/designsystem/build.gradle.kts`.
    Set namespace `app.aistylist.core.designsystem.catalog`, add `implementation(project(":core:designsystem"))`,
    and keep `ui-tooling-preview` plus `debugImplementation(ui-tooling)` here. Tests: `junit4`,
    `robolectric`, `ui-test-junit4`, `ui-test-manifest`, and the espresso constraint block. No new catalog entry.
  - `RootConventionPlugin.kt` `ALLOWED_MODULE_EDGES`: `":app"` adds `":core:designsystem-catalog"`. New
    entry `":core:designsystem-catalog" to setOf(":core:designsystem")`, with the comment
    "dev-only catalog: previews and the debug gallery; only `:app` debugImplementation".
  - `apps/android/app/build.gradle.kts`: `debugImplementation(project(":core:designsystem-catalog"))`.
  - `core/designsystem/build.gradle.kts` is **not** trimmed yet: `AppButtonPreviews.kt` still compiles
    there until the lane moves it. The lead removes `ui-tooling-preview` and `debugImplementation(ui-tooling)`
    at integration (keep `debugImplementation(ui-test-manifest)`: core's own Robolectric tests need it)
    and relocks then.
  - Proof: `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-deps-lock`
    → exit 0. New `core/designsystem-catalog/gradle.lockfile`; `checkModuleGraph` shows N + 2 edges; commit.
- **P0: iOS link spike on the Mac (lead, about 15 min, scratch worktree, nothing committed but the
  result).** XcodeGen cannot add a package product per configuration, so the `AIStylist` target links
  `DesignSystemCatalog` in Dev, Preview and Prod alike. `#if DEBUG` inside a package target is not a
  reliable gate. Xcode picks a package's debug or release build by the configuration's name, and
  "Dev" is not "Debug". `AppButtonRules.swift:3–4` already records that the Dev test run builds the
  package without testability. The spike adds a throwaway `DesignSystemCatalog` target with one public
  view holding the string `ds-gallery-spike` and references it from `AIStylistApp.swift` under
  `#if DEBUG` only. It then checks:
  1. Variant A, plain link (`products: [DesignSystem, DesignSystemCatalog]`): run `just ios-build --config prod`
     with the `POSTHOG_CLI_*` keys unset. Then `nm -m` and `strings` on the Prod app binary, grepping
     `DesignSystemCatalog` and `ds-gallery-spike`. No hits → Variant A.
  2. Hits → Variant B. Add a second `- package: DesignSystem` dependency with `products: [DesignSystemCatalog]`
     and `link: false`. In `Config/Dev.xcconfig` set `OTHER_LDFLAGS = $(inherited) $(BUILT_PRODUCTS_DIR)/DesignSystemCatalog.o`
     (the object Xcode builds per package target). Rebuild dev and prod, rerun the same check. Dev
     links and Prod shows no hits → Variant B.
  3. Also record whether `#if DEBUG` code inside the package compiles in under `--config dev` (for the
     README; no code relies on it).
  4. Neither variant keeps the catalog out of the Prod binary → stop; this is the one owner decision
     (report: rename the configurations to a `Debug` prefix, or accept unreferenced catalog code in Prod).
  Record the variant and the command output in the lane prompts; the iOS lane writes `project.yml` per
  that variant.

## iOS: how Prod excludes the catalog

- Catalog sources carry no `#if DEBUG` (see P0). The gate lives in the app target, where
  `Config/Dev.xcconfig` sets `SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG` with certainty.
  `apps/ios/App/AIStylistApp.swift` imports `DesignSystemCatalog` and references it only inside
  `#if DEBUG … #endif`. Preview and Prod compile no reference.
- Linking: per the P0 variant. Prod then holds no catalog symbol (AC-3).
- `HomeFeature` and `Core` never import the catalog.

## Entry point

- Home button: string "Design system gallery", id `debug_open_ds_gallery`. It appears in Home's debug
  section after "Force test crash", as `AppButton` `secondary`, `medium`, and only when the app root
  passes an action.
  - iOS: `HomeScreen(services:onOpenDesignSystemGallery:)`, new parameter `(() -> Void)? = nil`, handed
    to `HomeModel(services:openDesignSystemGallery:)`. `HomeModel` exposes `showsDesignSystemGallery: Bool`
    (true when the action is non-nil) and `openDesignSystemGallery()`, so `HomeModelTests` cover it.
    `AppServices.DebugTools` is unchanged: Core stays UI-free, and opening a screen is presentation,
    not a service.
  - Android: `HomeRoute(…, onOpenDesignSystemGallery: (() -> Unit)? = null)` →
    `HomeScreen(…, onOpenDesignSystemGallery: (() -> Unit)?)` → `DebugTools` shows the button when
    non-null. Add `HomeTestTags.DEBUG_OPEN_DS_GALLERY = "debug_open_ds_gallery"` and string
    `home_debug_open_ds_gallery` ("Design system gallery") in `feature/home/src/main/res/values/strings.xml`.
- App root, dev build only:
  - iOS `AIStylistApp.swift` (inside `#if DEBUG`): `@State` flag; passes `{ flag = true }` to
    `HomeScreen`; `.fullScreenCover(isPresented:)` shows `DesignSystemGalleryScreen(onClose:)` with
    `.appTheme()` applied to the cover content. Outside DEBUG it builds `HomeScreen(services:)` as today.
  - Android: `app/src/debug/kotlin/app/aistylist/app/DebugCatalog.kt` declares
    `internal object DebugCatalog { val gallery: (@Composable (onClose: () -> Unit) -> Unit)? = { DesignSystemGalleryScreen(onClose = it) } }`.
    `app/src/preview/…/DebugCatalog.kt` and `app/src/release/…/DebugCatalog.kt` declare the same object
    with `gallery = null`. `matchingFallbacks` does not cover source sets, so `preview` needs its own
    file. `MainActivity.kt` keeps a `rememberSaveable` flag. When it is set and `gallery != null`, it shows
    the gallery in place of `HomeRoute`, in the same `Surface`, so `testTagsAsResourceId` still applies.
    A `Dialog` would be a new window without it. A `BackHandler` clears the flag. `HomeRoute` gets
    `onOpenDesignSystemGallery = DebugCatalog.gallery?.let { { flag = true } }`. `preview` keeps its
    other debug tools (`DEBUG_TOOLS = true`) but has no gallery button.
- Doc 02 §2.1 tab or route: N/A — debug-only modal, no route.

## Contract

- Operations: none. Contract lane changes: none (P1 is the token generator, not `packages/contracts`).
  Analytics events: none (no log line, no event). Registry values: none. Kernel wiring: none.

## The gallery screen (identical structure on both apps)

- Screen: `DesignSystemGalleryScreen(onClose:)` in the catalog. It is one vertical, **non-lazy**
  scroll view (iOS `ScrollView` + `VStack`; Android `Column` + `verticalScroll`). Every id then exists
  in the tree for the Robolectric test, Maestro and AI-190. Root id `ds-gallery`; background role
  `background`; side padding `AppSpacing.space20`; `space24` between sections; `space12` between items.
- Header: "Design system gallery" in `title-2` with header trait/semantics. A "Close" `AppButton`
  `text`, `compact`, id `debug_close_ds_gallery`, calls `onClose`.
- Section: a container tagged `ds-gallery-section-<slug>`, title in `title-3` with header
  trait/semantics, then its items. The section list is pure data
  (`GallerySection(id, title, kind)` in the catalog; one type per file). It holds the four token
  sections in this fixed order (they are token categories, not components, so a fixed list is
  correct), followed by `GalleryComponent.allCases` / `.entries` mapped to `ds-gallery-section-{slug}`
  and `{title}`.
- Items, all sizes from `AppSpacing` / `AppRadius`, colours from roles, no literals:
  - Colours: every `AppColorRole` in generated order. A square swatch (side `space40`, radius
    `radius8`, filled with the role, hairline `divider` stroke at platform default width) and the role
    id in `footnote`, colour `text`.
  - Typography: every `AppTypography.all` style, showing its `name` in that style, colour `text`.
  - Spacing: every `AppSpacing.all` step. A bar `value` wide and `space8` high in `primary`, then the
    name in `footnote`.
  - Radius: every `AppRadius.all` step. A `space48` square in `surface-2`, hairline `outline` stroke,
    corner radius = value (`full` clamps to a capsule), then the name in `footnote`.
  - C01 Buttons: every `ComponentGallery.button` entry in generated order, one per row (no horizontal
    scroll). `AppButtonFace` with `ComponentGallery.buttonLabel` and
    `theme.buttons.appearance(entry.variant, entry.size, entry.state)`, spinner when the state is
    `loading`, tagged `entry.testId`. Below it, the test id in `caption`, colour `text-secondary`.
    This is the existing state grid. The two "AppButton states, light/dark" previews now render this
    section, so there is no second specimen.
- Forced states use `AppButtonFace`. It must be reachable from the catalog:
  - iOS: `package struct AppButtonFace` with an explicit `package init(label:appearance:leadingIcon:loading:fullWidth:)`.
    The catalog is in the same SwiftPM package; `HomeFeature` and the app cannot see it.
    `InternalImportsByDefault` is on, so the file's imports become `package import DesignTokens` and
    `package import SwiftUI`. Otherwise the package signature that exposes `ButtonAppearance` and
    `Image` fails to compile. The same rule applies to every catalog declaration at `package` or
    `public` access that names a generated or SwiftUI type.
  - Android: `AppButtonFace`, `AppScheme` and `AppTheme(scheme, content)` become `public`. Kotlin
    `internal` is module-scoped. KDoc on each: "For the catalog and snapshot tests only; product UI uses
    `AppButton` and `AppTheme {}`". AC-6 checks that nothing else uses them.

## Parity table (identical on both apps; each lane reports against it)

| State | Trigger | Exact visible strings | Id (a11y id == testTag) | Analytics event | Operation | Error → this state |
| --- | --- | --- | --- | --- | --- | --- |
| entry shown | Home in iOS Dev / Android `debug` | "Design system gallery" | `debug_open_ds_gallery` | — | — | — |
| entry absent | iOS Preview, Prod; Android `preview`, `release` | — | — (no node) | — | — | — |
| gallery open | tap the entry | "Design system gallery", "Close" | `ds-gallery`, `debug_close_ds_gallery` | — | — | — |
| section Colours | gallery open | "Colours"; each role id (`background` …) | `ds-gallery-section-colours` | — | — | — |
| section Typography | gallery open | "Typography"; each style name (`display` …) | `ds-gallery-section-typography` | — | — | — |
| section Spacing | gallery open | "Spacing"; `spacing-4` … `spacing-64` | `ds-gallery-section-spacing` | — | — | — |
| section Radius | gallery open | "Radius"; `rounded-2` … `rounded-full` | `ds-gallery-section-radius` | — | — | — |
| section C01 Buttons | gallery open | "C01 Buttons"; each cell "Continue" + its test id | `ds-gallery-section-c01-buttons`; cells `ds-button-<variant>-<size>-<state>` (100, generated order) | — | — | — |
| closed | "Close"; Android also system Back | Home as before | — | — | — | — |
| loading | N/A — static data, no I/O | — | — | — | — | — |
| empty | N/A — the generated lists are never empty (P1 test) | — | — | — | — | — |
| failure / offline | N/A — no I/O | — | — | — | — | — |

- Strings come from the generated code (role ids, style and step names, `GalleryComponent.title`,
  `buttonLabel`, test ids), except "Design system gallery", "Close", "Colours", "Typography",
  "Spacing" and "Radius", which each app spells exactly as above (British "Colours", from AI-195).
- Accessibility: titles are headers; Close and the Home entry are buttons (role button, name = label,
  44 pt / 48 dp targets via `AppButton`); forced cells are display-only (no action) and keep their
  test id; Dynamic Type / font scale 200 % wrap labels without clipping. Consent: N/A — no analytics.
- Scheme: follows the system (S1 / S2 / S7). Previews in the catalog show the sections in light and dark.

## Tests

- iOS (Swift Testing, no rendering):
  - `apps/ios/Packages/DesignSystem/tests/DesignSystemCatalogTests/GalleryTests.swift`. Test target
    `DesignSystemCatalogTests` (deps `DesignSystemCatalog`, `DesignSystem`, `DesignTokens`) inside
    `#if !os(Linux)`; add `- package: DesignSystem/DesignSystemCatalogTests` to the `AIStylist-Dev`
    test list in `apps/ios/project.yml`.
    - The section list's ids and titles equal the Parity table in order.
    - The C01 section's cell ids equal `ComponentGallery.button.map(\.testId)` in order, and are unique.
    - The colour, typography, spacing and radius items equal `AppColorRole.allCases` / `.all` names, in order.
    - Every section id is `ds-gallery-section-` + slug.
  - `HomeModelTests`: `showsDesignSystemGallery` is false without an action and true with one;
    `openDesignSystemGallery()` calls the action once.
- Android (Robolectric, `@Config(sdk = [37])` as `HomeScreenTest`):
  - `apps/android/core/designsystem-catalog/src/test/kotlin/app/aistylist/core/designsystem/catalog/gallery/GalleryTest.kt`.
    - Every `ComponentGallery.button` test tag exists exactly once (`onAllNodesWithTag(id, useUnmergedTree = true).assertCountEquals(1)`).
    - `ds-gallery` and the five section tags exist.
    - The section data's titles and order equal the Parity table.
    - Clicking `debug_close_ds_gallery` calls `onClose`.
  - `HomeScreenTest`: `debug_open_ds_gallery` exists and calls the action when one is passed with
    `debugTools = true`, and does not exist when the action is null.
  - `AppButtonTest`, `AppThemeTest`, `GeneratedTokensTest`, `HomeViewModelTest` stay green.

## Lanes

| Lane | Agent | Isolation | Scope | Files expected | Sibling to copy | Checks (lane) |
| --- | --- | --- | --- | --- | --- | --- |
| iOS | ios-engineer | worktree | apps/ios/** | `Packages/DesignSystem/Package.swift` (product + target + test target, header comment); `git mv Sources/DesignSystem/AppButtonPreviews.swift Sources/DesignSystemCatalog/AppButtonPreviews.swift` (state previews render the C01 section; playground unchanged); `Sources/DesignSystem/AppButtonFace.swift` (`package` access + init, header comment); `Sources/DesignSystemCatalog/Gallery/*.swift` (screen, section data, one view per section kind; one type per file); `tests/DesignSystemCatalogTests/GalleryTests.swift`; `Packages/Features/Sources/HomeModel/HomeModel.swift`; `Packages/Features/Sources/HomeFeature/HomeScreen.swift`; `Packages/Features/tests/HomeModelTests/HomeModelTests.swift`; `App/AIStylistApp.swift`; `project.yml` (P0 variant + scheme test list); `Config/Dev.xcconfig` only if P0 picked Variant B; `README.md` | `AppButtonPreviews.swift`, `HomeScreen.swift` debug section, `HomeModelTests.swift`, `Package.swift` `DesignSystemTests` block | `just ios-lint`, `just ios-format --check`, `just ios-check-banned`, `just ios-check-banned --fixtures`, `just ios-test-packages designsystem features`, `just ios-project`, `just ios-test` |
| Android | android-engineer | worktree | apps/android/** except the P2 files | `git mv core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/AppButtonPreviews.kt core/designsystem-catalog/src/main/kotlin/app/aistylist/core/designsystem/catalog/AppButtonPreviews.kt` (package `…catalog`; state previews render the C01 section via `AppTheme(scheme = …)`; playground unchanged); `core/designsystem/…/AppButtonFace.kt`, `AppTheme.kt` (public + KDoc); `core/designsystem-catalog/src/main/kotlin/app/aistylist/core/designsystem/catalog/gallery/*.kt`; `core/designsystem-catalog/src/test/kotlin/app/aistylist/core/designsystem/catalog/gallery/GalleryTest.kt`; `app/src/{debug,preview,release}/kotlin/app/aistylist/app/DebugCatalog.kt`; `app/src/main/kotlin/app/aistylist/app/MainActivity.kt`; `feature/home/…/HomeScreen.kt`; `feature/home/src/main/res/values/strings.xml`; `feature/home/src/test/…/HomeScreenTest.kt`; `README.md` | `AppButtonPreviews.kt`, `HomeScreen.kt` `DebugTools`, `HomeScreenTest.kt`, `AppButtonTest.kt` | `just android-format`, `just android-format --check`, `just android-detekt`, `just android-lint`, `just android-test` (or `just test android`), `just android-build` (debug only) |
| API | N/A — no endpoint | — | — | — | — | — |
| e2e | test-engineer | lead checkout, after both | e2e/** | `e2e/design-system-gallery.yaml`: launch, tap `debug_open_ds_gallery`, `assertVisible` `ds-gallery`, each section id (scroll as needed), and `ds-button-primary-large-enabled` | `e2e/smoke.yaml` | lead runs `just android-e2e e2e/design-system-gallery.yaml`, `just ios-e2e e2e/design-system-gallery.yaml` (keys unset) |

Notes for the lanes:

- Neither lane reads the other app's sources; parity comes from the generated files and this brief.
- **Upload-safe commands only.** The agents' Bash guards block `env -u`. On iOS, `xcode.sh build`
  (`just ios-build`, and `ios-check`, `ios-run`, `ios-e2e`, which call it) uploads dSYMs when
  `POSTHOG_CLI_*` are set. `xcode.sh test` (`just ios-test`) does not. On Android,
  `:app:assemblePreview` and `:app:assembleRelease` (`just android-check`, `just android-deps-lock`,
  `just android-build preview|release|all`) upload R8 mappings. `assembleDebug` is not minified and has
  no upload task. Lanes run only the commands in their Checks column. Never run `just ios-check`,
  `just ios-build`, `just android-check`, `just android-deps-lock` or `just android-build preview|release|all`.
  The lead runs the full gates with the keys unset.
- Exact Gradle tasks behind the safe Android recipes (from `justfile`):
  - `just android-format` → `spotlessApply`; `just android-format --check` → `spotlessCheck`;
  - `just android-detekt` → `detektMain detektTest`;
  - `just android-lint` → `:app:lintDebug checkModuleGraph`;
  - `just android-test` / `just test android` → `testDebugUnitTest :core:data:test :core:analytics:test :core:designsystem:test`;
  - `just android-build` (default `debug`) → `:app:assembleDebug`.
  None of them assembles a minified variant, so none can upload. The catalog's tests run through the
  aggregate `testDebugUnitTest`, so the `justfile` stays unchanged.
- Android lane: do not touch lockfiles, `settings.gradle.kts`, `RootConventionPlugin.kt` or the two
  `build.gradle.kts` files P2 wrote. A lock or edge error → stop and report.
- iOS lane: no `#if DEBUG` in any package file; the only `#if DEBUG` is in `apps/ios/App/AIStylistApp.swift`.
- Stop and report (do not fork the component) if a forced state cannot be drawn with `AppButtonFace`
  and the generated appearance.
- Docs, each lane in its README. iOS: the `Sources/` layout row (`DesignSystemCatalog`: previews and
  the debug gallery) and the "Design system" section (previews moved, how to open the gallery, Dev
  only, how Prod excludes it per P0, generated manifest). Android: "What's here" rows for
  `core/designsystem` (previews removed) and the new `core/designsystem-catalog`, the module-graph block
  (`:app ──(debugImplementation)──► :core:designsystem-catalog ──► :core:designsystem`), and the
  build-types bullets (gallery in `debug` only, not `preview`). Under `Noticed but not touched:` give
  the exact text for:
  - `.agents/skills/ui-prototype-first/SKILL.md:22` "Not a gate" list: add "the debug-only
    design-system gallery and the component previews in the catalog modules (owner decision 2026-10-19)";
  - `.agents/skills/ui-prototype-first/SKILL.md:172` and `.claude/agents/ui-designer.md:51`, if they
    should name the catalog;
  - `.claude/rules/android.md` / `ios.md` lines that describe `:core:designsystem` as dependency-free
    or the previews' location, if any;
  - `docs/adr/0011-design-system-source-of-truth-and-impeccable.md` (catalog modules);
  - a `Suggested PROGRESS.md line`.

## Lead steps at integration

1. Integrate both lanes on BASE. Remove `implementation(libs.androidx.compose.ui.tooling.preview)` and
   `debugImplementation(libs.androidx.compose.ui.tooling)` from `apps/android/core/designsystem/build.gradle.kts`.
   Then run `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-deps-lock`.
2. With the same `env -u` prefix: `just android-check` (AC-7), `just ios-check`, `just ios-build --config dev`,
   `just ios-build --config preview`, `just ios-build --config prod`, and the P0 symbol check on the
   Preview and Prod binaries (AC-3).
3. `just lint`, `just typecheck`, `just arch-check`, `just generate --check`, `just docs-check`; e2e
   lane; `ui-designer` review (AC-9); `architecture-reviewer` on the integrated diff.
4. Linear (lead): update AI-195's superseded lines (top of this brief). Update AI-190's paths: its
   snapshot tests, Roborazzi plugin and goldens now belong in `:core:designsystem-catalog`
   (`src/test/screenshots/`) and in `DesignSystemCatalogTests`. They render
   `GallerySection` / C01 cells through `AppTheme(scheme:)` / `.environment` + `.appTheme()`.

## Intended differences

- Presentation: iOS `.fullScreenCover` closed by "Close"; Android in-place content swap closed by
  "Close" or system Back. Reason: platform idiom, and on Android the same window keeps
  `testTagsAsResourceId`. Accepted by the lead on 2026-10-20.
- Dev-only gate: iOS `#if DEBUG` in the app target plus the P0 link variant; Android
  `debugImplementation` plus per-build-type `DebugCatalog` source sets. Reason: platform build systems.
  Lead, 2026-10-20.
- Builds that show the entry: iOS Dev only; Android `debug` only. Android `preview` keeps its other
  debug tools (R8 proof, existing intended difference) but not the gallery (AI-195 Scope 2). Owner (AI-195).
- Face visibility: iOS `package` access; Android `public` with KDoc and the AC-6 check. Reason: Kotlin
  has no package-wide access across modules. Lead, 2026-10-20.
- Home entry wiring: iOS through `HomeModel` (logic in the Linux-testable `*Model` target); Android
  through `HomeRoute` / `HomeScreen` parameters (tested by Robolectric). Reason: platform idiom. Lead, 2026-10-20.
- Test ID attachment: iOS `.accessibilityIdentifier`; Android `Modifier.testTag` — platform idiom
  (as in the AppButton brief).
