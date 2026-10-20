# AppIcon (C02 icons) — cross-platform brief (2026-10-20, amended 2026-10-21, slug c02-icons)

> Status: ACTIVE (2026-10-21). Linear AI-201. Branch `feat/c02-icons` @ 94e79ac. Lead: the main session.
> This is step 5 of `.claude/rules/design-system.md` invariant 8. The design half (contract, tokens,
> generator) is `.claude/plans/2026-10-20-c02-icons-design-brief.md`, including its "Amendment
> 2026-10-21", and it has landed at 94e79ac.

Phase task: none (Brand v1, milestone "Design system", Linear AI-201) · Journey: N/A. This is a base
component with no journey, so the C02 contract stands in for the journey.
Branch: feat/c02-icons · Lanes: iOS, Android (no API lane, no contract lane)

Approval (UI gate, `ui-prototype-first` step 1, "a DESIGN.md component → skip to step 5"): the
approved contract `.impeccable/components/icon.yaml` is the owner's approval. It records
`approved: 2026-10-20`, plus owner decisions 9–11 of 2026-10-21 in its header (the icon scale,
components pointing at the scales, and icons growing with the user's text size). Canvas board C02
and the screens and page-8 boards it cites are the sources. A base component needs no surface brief,
so `.impeccable/surfaces/` is not required here.

## Outcome and scope

- User outcome: both apps have one `AppIcon` that draws any of the 124 C02 glyphs at any step of the
  six-step icon scale. The stroke is the one the screens draw for that step, the tint comes from the
  host, and the icon grows with the user's text size. `AppButton`'s leading icon is an `AppIcon`, and
  the debug gallery shows the whole set with a size and tint playground.
- Inputs both lanes build against. They are generated and committed at 94e79ac. Never hand-edit them
  and never redeclare them:
  - iOS `apps/ios/Packages/DesignSystem/Sources/DesignTokens/generated/{ComponentAPI,AppIconGlyphs,ComponentTokens}.swift`
  - Android `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/generated/{ComponentApi,AppIconGlyphs,ComponentTokens}.kt`
  - Names used:
    - `AppIconName` (124 cases in contract order). Each case has `set`, `testId` (`ds-icon-<id>`) and
      `glyph`. Swift uses the `String` raw value and `CaseIterable`; Kotlin uses `enum class` with `id`.
    - `AppIconSet`: 7 sets in first-appearance order: `navigation`, `actions`, `weather`, `closet`,
      `status`, `account`, `capture`.
    - `AppIconSize`: 6 steps, Swift `.xs .sm .md .lg .xl .hero` (raw values `"icon-xs"` …
      `"icon-hero"`) and Kotlin `XS … HERO` (`id` `"icon-xs"` …). Each has `size` and
      `strokeWidth`, both `Double`, at 100 % text size.
    - `AppIconMetrics.viewBox` (24.0) and `AppIconMetrics.defaultSize` (`.lg` / `LG`).
    - The glyph types: `AppIconGlyph(shapes)`, `AppIconShape(paint, segments)`,
      `AppIconPaint {stroke, fill, both}`, `AppIconSegment(command, points)` and
      `AppIconCommand {move, line, cubic, close}`.
    - The glyph table `AppIconGlyphs.<Name>.glyph`.
    - `GalleryComponent.icon` / `ICON`, with title `"C02 Icons"` and slug `"c02-icons"`.
    - `ButtonAppearance.iconSize` is now typed `AppIconSize`: `.md` / `MD` in all 500 generated
      looks. `ButtonAppearance.iconGap` stays a `Double` (8, or 6 at compact).
    - Already used by C01: `ButtonSpec.{light,dark,brand,hcLight,hcDark}`, `ComponentGallery.button`,
      `AppColorRole`, `AppTypography`, `AppSpacing`.
  - The generated table holds 241 shapes and 1,595 segments (361 move, 541 line, 567 cubic,
    126 close). Every shape starts with a `move`. Every coordinate lies in 2.19 … 22.278, inside the
    24 viewBox. 16 shapes are `fill` or `both`. The rule is in `tools/codegen/tokens/README.md`
    "Icon sets".
- **The base does not build today.** This was read from the code at 94e79ac, not run. Two things
  break it:
  - **Core.** `ButtonAppearance.iconSize` is now `AppIconSize`, but `AppButtonFace` still reads it
    as a number. iOS `Sources/DesignSystem/AppButtonFace.swift:77,83` uses
    `.frame(width: appearance.iconSize, …)`. Android `AppButtonFace.kt:72` uses
    `Modifier.size(appearance.iconSize.dp)`. So the iOS `DesignSystem` target and Android
    `:core:designsystem` fail to compile. Scope item 3 fixes it.
  - **Catalog.** `GalleryComponent` gained `icon`, but iOS `GallerySection.init(component:)`
    (`Sources/DesignSystemCatalog/Gallery/GallerySection.swift`) and Android
    `DesignSystemGalleryScreen.kt:122` (`when (kind.component)`) switch exhaustively over it and
    handle only `button`. So the iOS `DesignSystemCatalog` target and Android
    `:core:designsystem-catalog` fail to compile. Scope item 4 fixes it.

  These two fixes are each lane's first step.
- Scope, both lanes:
  1. **Geometry (pure, unit-testable).** It takes no UI framework and no environment, so it runs on
     Linux and the plain JVM. Every size argument is the final **rendered size** as a plain number:
     points on iOS, px on Android at draw time. Swift is `nonisolated package enum AppIconGeometry`;
     Kotlin is `internal object AppIconGeometry`. Members:
     - `unitScale(renderedSize)` = `renderedSize / AppIconMetrics.viewBox`.
     - `strokeWidth(step, renderedSize)` = `step.strokeWidth × renderedSize / AppIconMetrics.viewBox`.
       The stroke is in viewBox units, so it grows with the rendered size.
     - `scaled(glyph, factor)` returns an `AppIconGlyph`: the same shapes, paints, commands and
       order, with every point coordinate multiplied by `factor`. It uses the generated types. Swift
       may call their memberwise initialiser because it lives in the same module as them.
     - iOS: `apps/ios/Packages/DesignSystem/Sources/DesignTokens/AppIconGeometry.swift`. It is
       hand-written and sits beside `generated/`, not in it (lead decision, 2026-10-21). It imports
       Foundation only, because `just ios-check-banned` bans UI imports in `DesignTokens`. That
       target builds and tests on Linux, which the SwiftUI targets do not. `package` access keeps it
       visible to `DesignSystem` and the tests but hidden from the app and `HomeFeature`. Update the
       `Package.swift` header comment and the `apps/ios/README.md` layout line: `DesignTokens` now
       also holds the icon geometry next to the generated tokens.
     - Android: `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/AppIconGeometry.kt`.
       It also holds the replay to Compose `PathNode`s:
       `internal fun AppIconShape.toPathNodes(): List<PathNode>`, mapping `move` → `MoveTo`,
       `line` → `LineTo`, `cubic` → `CurveTo` and `close` → `Close`. `PathNode` is plain Kotlin data,
       so a plain JUnit test reaches it.
  2. **AppIcon** (system core, decorative, no interaction):
     - iOS: `public struct AppIcon: View`, in `Sources/DesignSystem/AppIcon.swift`. Signature:
       `AppIcon(_ name: AppIconName, size: AppIconSize = AppIconMetrics.defaultSize, tint: AppColorRole? = nil)`.
     - Android: `@Composable fun AppIcon(name: AppIconName, modifier: Modifier = Modifier, size: AppIconSize = AppIconMetrics.defaultSize, tint: AppColorRole? = null)`,
       in `core/designsystem/.../AppIcon.kt`.
     - **Text-size scaling** (owner decision 11, 2026-10-21): the rendered size is the token
       `size.size`, scaled the way the platform scales text. There is no cap.
       - iOS: `@ScaledMetric(relativeTo: .body)`, seeded in `init` with `size.size`
         (`_rendered = ScaledMetric(wrappedValue: size.size, relativeTo: .body)`).
       - Android: the token size is treated as sp and converted with the current `Density`, so
         Android's non-linear font scaling applies: `with(LocalDensity.current) { size.size.sp.toDp() }`
         for the frame, and `size.size.sp.toPx()` for the draw. Confirm the `Density` sp-conversion
         API on developer.android.com and note the doc date in the report.
       - At 100 % text size, the rendered size equals the token size.
     - Drawing: replay `AppIconGeometry.scaled(name.glyph, unitScale(rendered))`. Paint the shapes
       in table order. For each shape:
       - `stroke`: stroke at `AppIconGeometry.strokeWidth(size, rendered)` with round cap and round
         join.
       - `fill`: fill with the non-zero winding rule. That is the SVG default, and the contract sets
         no fill rule.
       - `both`: fill first, then stroke, which is SVG's default paint order.
     - iOS draws in points: one `Canvas`, or one `Path` per shape in a `ZStack`. It replays
       `move(to:)`, `addLine(to:)`, `addCurve(to:control1:control2:)` and `closeSubpath()`, then
       strokes with `StrokeStyle(lineWidth:lineCap: .round, lineJoin: .round)` or fills with
       `FillStyle()`.
     - Android draws in `Canvas(modifier.size(renderedDp))` in px, where the rendered size in px is
       `size.size.sp.toPx()`. It replays through `toPathNodes()`, then `toPath()` or an equivalent
       `Path` build; confirm the current API too. It strokes with
       `Stroke(width = strokeWidth(size, renderedPx), cap = StrokeCap.Round, join = StrokeJoin.Round)`
       or fills with `Fill`, keeping `PathFillType.NonZero`. Remember the scaled glyph keyed on
       `(name, size, renderedPx)`.
     - Tint: no literal colours, and never a hard-coded role inside `AppIcon`.
       - `tint == nil`: the host's foreground. iOS draws with the inherited `foregroundStyle` (the
         Canvas `.foreground` shading, or shapes without an explicit style). Android uses
         `LocalContentColor.current` (material3).
       - `tint != nil`: iOS uses `theme.color(tint)` from `@Environment(\.appTheme)`. Android uses
         `AppTheme.colors.color(tint)`.
     - Frame: exactly the rendered size on both axes, with no padding and no minimum touch target.
       The 44 pt / 48 dp target belongs to the host control (DESIGN.md "Icons (C02)": "Every
       tappable icon sits in a 44 pt / 48 dp target"). It is a minimum, and it may grow with the
       icon at large text sizes.
     - Decorative (contract `accessibility.role: decorative`): iOS uses `.accessibilityHidden(true)`.
       Android adds no semantics: no `contentDescription`, no role and no text, so TalkBack never
       stops on it. A caller's `testTag` in `modifier` still works.
     - Previews: none in core (invariant 9).
  3. **AppButton leading icon.** `button.yaml` declares `leadingIcon` `type: icon`. The generator emits
     no prop types, so the slot's type is hand-written. It becomes `AppIconName?` on both apps, and
     that ends the C01 brief's intended difference "Icon parameter type — iOS `Image?`, Android
     `Painter?`".
     - iOS: `AppButton(_:variant:size:leadingIcon: AppIconName? = nil, …)` takes the new type, and
       `AppButtonStyle.leadingIcon` and `AppButtonFace.leadingIcon` follow (both `AppIconName?`).
     - Android: `AppButton(…, leadingIcon: AppIconName? = null, …)`, and `AppButtonFace(…, leadingIcon: AppIconName? = null, …)`
       follows.
     - Size: pass `appearance.iconSize` straight through as `AppIcon(name, size: appearance.iconSize)`.
       It is already an `AppIconSize` (`.md`), so there is no lookup or mapping. `AppIcon` applies
       the text-size scaling itself. Keep `iconGap` as the row spacing, as today.
     - The loading spinner shares the slot. Size it to the same rendered size as the icon:
       - iOS: the face's own `@ScaledMetric(relativeTo: .body)`, seeded with
         `appearance.iconSize.size`.
       - Android: `with(LocalDensity.current) { appearance.iconSize.size.sp.toDp() }`. A small
         `internal` helper shared with `AppIcon` is fine.

       Either way, this replaces the number reads at `AppButtonFace.swift:77,83` and
       `AppButtonFace.kt:72`.
     - Tint: the label colour, inherited. iOS: the face's `HStack` already sets
       `.foregroundStyle(theme.color(appearance.textColor))`, so `AppIcon` gets no `tint`. Android:
       `AppButtonFace` wraps the icon in
       `CompositionLocalProvider(LocalContentColor provides content) { AppIcon(name, size = appearance.iconSize) }`,
       where `content` is the animated label colour it already passes to `Text`.
     - The icon stays hidden from the screen reader.
     - No current caller passes `leadingIcon`: `rg -n 'leadingIcon' apps` hits only the design-system
       files. So no screen changes.
  4. **Catalog: the "C02 Icons" gallery section** (dev-only, invariant 9):
     - Section id `ds-gallery-section-c02-icons` and title "C02 Icons". Both come from the existing
       derivation `GallerySection.idPrefix` / `GalleryTestTags.SECTION_PREFIX` + `GalleryComponent.slug`,
       and the title from `GalleryComponent.title`; never type them.
     - The section goes after "C01 Buttons", following `GalleryComponent` order.
     - iOS: `GallerySectionKind` gains `case icons([AppIconName])`, whose `itemLabels` are the
       `testId`s. `GallerySection.init(component:)` maps `.icon` to `.icons(AppIconName.allCases)`.
       `GallerySectionView` renders it with a new `GalleryIconSection`.
     - Android: `DesignSystemGalleryScreen`'s `when` gains `GalleryComponent.ICON -> GalleryIcons()`.
       `GallerySectionKind.Component` stays unchanged.
     - Content, top to bottom:
       1. Playground controls. Their state is local to the section: iOS `@State`, Android
          `remember { mutableStateOf(…) }`. They apply to every cell below.
          - "Size" offers every `AppIconSize`, in generated order, labelled with its id
            (`icon-xs`, `icon-sm`, `icon-md`, `icon-lg`, `icon-xl`, `icon-hero`). Default
            `AppIconMetrics.defaultSize` (`icon-lg`).
          - "Tint" offers 7 roles, labelled with their ids: `text`, `text-secondary`,
            `primary-text`, `success-fg`, `warning-fg`, `error-fg`, `info-fg`. These are DESIGN.md
            "Icons (C02)" Tint: the host foregrounds and the status foregrounds. Default `text`.
          - There is no text-size control. The cells follow the system Dynamic Type or font-scale
            setting, so changing it in Settings shows the scaling.
          - iOS uses `Picker`s. Android uses `FlowRow`s of `FilterChip`, as `AppButtonPreviews.kt`
            does. The label strings "Size" and "Tint" go in Android's catalog
            `src/main/res/values/strings.xml`.
       2. One group per `AppIconSet` (`AppIconSet.allCases` / `entries`). The header is the set id,
          for example "navigation", in `headline` style and the `text` colour. The cells are that
          set's `AppIconName`s in generated order.
       3. Each cell is the `AppIcon` at the picked size and tint, with the glyph id under it (for
          example "chevron-right": Swift `rawValue`, Kotlin `id`) in `caption` style and the
          `text-secondary` colour. The cell carries the test ID `name.testId`:
          - iOS: on the cell container, with `.accessibilityElement(children: .combine)` and
            `.accessibilityIdentifier(name.testId)`. The icon is hidden, so the cell reads as its id.
          - Android: `Modifier.testTag(name.testId)` on the cell `Column`.
     - Layout: non-lazy, so every cell id is in the tree at once, as `DesignSystemGalleryScreen`'s
       comment requires. iOS uses a `Grid` or a small `Layout` flow; Android uses `FlowRow`. Cells
       wrap as the icons grow. Spacing comes from `AppSpacing` (`space12` between cells, `space4`
       from icon to caption, `space24` between groups). There are no literals.
     - Previews, in the catalog only:
       - iOS `Sources/DesignSystemCatalog/AppIconPreviews.swift`: "AppIcon set, light", "AppIcon
         set, dark" and "AppIcon set, largest text". The last uses
         `.environment(\.dynamicTypeSize, .accessibility5)`. Each is
         `GallerySectionView(section: GallerySection(component: .icon))` on the theme background, as
         `ButtonSectionPreview` does.
       - Android `catalog/AppIconPreviews.kt`: `GalleryIcons()` under `AppTheme(scheme = LIGHT / DARK)`,
         as `AppButtonStates` does, plus a `@Preview(fontScale = 2f)` variant.
       - Both `AppButtonPreviews` playgrounds gain a "leadingIcon" picker: none, or any
         `AppIconName`, default none.
  5. **Docs, written by each lane in its own tree:**
     - iOS `apps/ios/README.md`: the layout block, where `DesignTokens` gains the icon geometry and
       `DesignSystem` gains AppIcon (C02). The "Design system" bullets gain AppIcon, with its
       Dynamic Type scaling, change the AppButton signature to `leadingIcon: AppIconName?`, add the
       gallery section "C02 Icons", and change "today C01 Buttons" to "C01 Buttons, C02 Icons".
     - iOS `Packages/DesignSystem/Package.swift` header comment.
     - Android `apps/android/README.md`: the rows for `core/designsystem/` and
       `core/designsystem-catalog/`, plus the module diagram label at line 36.
- Acceptance criteria:
  - AC-1 iOS lint, format, bans and Linux package tests pass. Proof: `just ios-lint`,
    `just ios-format --check`, `just ios-check-banned`, `just ios-test-packages designsystem` → exit 0,
    with `AppIconGeometryTests` listed. Mac proof, by the lead: `just ios-check` → exit 0, with
    `DesignSystemTests` and `DesignSystemCatalogTests` listed.
  - AC-2 Android passes. Proof: `just android-format --check`, `just android-detekt`,
    `just android-test`, `just android-lint`, `just android-build debug` → exit 0, with
    `AppIconGeometryTest` in the test report. Lead: the full
    `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-check` →
    exit 0, with the `checkModuleGraph` edge count unchanged (no new module edge).
  - AC-3 no generated name is redeclared. Proof:
    `rg -n 'enum (class )?(AppIconName|AppIconSize|AppIconSet|AppIconPaint|AppIconCommand)\b|struct AppIcon(Glyph|Shape|Segment)|data class AppIcon(Glyph|Shape|Segment)' apps/ios/Packages apps/android --glob '!**/generated/**' --glob '!**/build/**'`
    → no hits.
  - AC-4 no literal style values in the hand-written layer. Proof: the C01 command
    `rg -n 'Color\(red:|Color\(0x|0x[0-9A-Fa-f]{6,8}|cornerRadius: [0-9]|padding\([0-9]|\b[0-9]+(\.[0-9]+)?\.(dp|sp)\b' apps/ios/Packages/DesignSystem/Sources apps/android/core/designsystem/src/main apps/android/core/designsystem-catalog/src/main --glob '!**/generated/**'`
    → no hits, plus
    `rg -n 'lineWidth: [0-9]|width = [0-9]|\b24(\.0)?\b' apps/ios/Packages/DesignSystem/Sources/DesignSystem/AppIcon.swift apps/ios/Packages/DesignSystem/Sources/DesignSystem/AppButtonFace.swift apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/AppButtonFace.kt apps/ios/Packages/DesignSystem/Sources/DesignTokens/AppIconGeometry.swift apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/AppIcon*.kt`
    → no hits. The viewBox always comes from `AppIconMetrics.viewBox`. List each exception with
    file:line and the reason in the report; none are expected.
  - AC-5 the generated files are untouched. Proof: `git diff --stat 94e79ac -- '**/generated/**'`
    → empty, and `just generate --check` → exit 0.
  - AC-6 nothing reads `iconSize` as a number. Proof:
    `rg -n 'iconSize\.dp|width: appearance\.iconSize|height: appearance\.iconSize' apps/ios/Packages apps/android --glob '!**/generated/**' --glob '!**/build/**'`
    → no hits.
- Non-goals:
  - Screenshots, screenshot or golden tests, and new UI tests or Maestro flows. The owner checks the
    debug gallery, and AI-190 owns snapshot tests.
  - The tab bar. Owner decision 3 (2026-10-20): the five tab icons (`today`, `closet`, `capture`,
    `discover`, `you`) are C02 glyphs inside the native tab bar on both apps (DEC-87), and native
    navigation bars keep the system back and close. Since 2026-10-21 the tab bar draws `lg` (26 →
    lg, decision 9). No tab shell exists yet, so this lands with the nav-shell task. Record it
    there; it is not built here.
  - Any screen, any change to Home, and C03+.
  - Asset files (PDF, SVG or vector drawables). Glyphs are code by the lead decision in the design
    brief.
  - The S3 brand scheme.
  - Any cap on text-size scaling.
- Search done (2026-10-20, re-checked at 94e79ac on 2026-10-21):
  - `rg -n 'AppIcon|PathBuilder|addCurve|cubicTo|ImageVector|systemName:|Icons\.(Filled|Default|Outlined)' apps/ios apps/android --glob '!**/generated/**'`
    → no hand-written icon code. The only hits are the iOS app-icon asset set `AppIcon.appiconset`
    and `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon` in `Config/Base.xcconfig`. That is the App
    target's asset catalog, a different module from `DesignSystem`, so no symbol clash is expected.
    Report one if Xcode's generated asset symbols disagree.
  - `rg -n 'leadingIcon' apps` → only `AppButton`, `AppButtonStyle` and `AppButtonFace` (iOS), and
    `AppButton` and `AppButtonFace` (Android).
  - `rg -n 'iconSize|iconGap' apps --glob '!**/generated/**'` → only the `AppButtonFace` reads cited
    above.
  - `rg -n 'GalleryComponent' apps --glob '!**/generated/**'` → the two exhaustive switches above,
    plus `GalleryTests.swift`, `GallerySection.kt` and `GallerySectionKind.kt`.
  - Siblings to copy: iOS `GalleryButtonCell.swift`, `GallerySectionKind.swift`,
    `AppButtonPreviews.swift`, `AppButtonFace.swift` (`package` access) and
    `tests/DesignTokensTests/DesignTokensTests.swift`. Android `gallery/GalleryButtons.kt`,
    `catalog/AppButtonPreviews.kt`, `AppButtonFace.kt` and `GeneratedTokensTest.kt` (plain JUnit).

## Entry point and navigation

- iOS: the Dev build opens "Design system gallery" from Home's debug section (`debug_open_ds_gallery`,
  `App/AIStylistApp.swift`). The new section appears there, and Xcode previews show it in
  `DesignSystemCatalog`. `AppIcon` has no product caller yet beyond `AppButton`.
- Android: the debug build opens the same gallery through `DebugCatalog` (`:app` debugImplementation
  → `:core:designsystem-catalog`). Previews are in Android Studio.
- Doc 02 §2.1 tab or route: N/A. There is no new screen or route, and the tab bar is out of scope (see
  Non-goals).

## Contract

- Operations: none.
- Contract lane changes: none. The design half landed at 94e79ac.
- Analytics events: none.
- Registry values: none.
- Kernel wiring: none.

## Parity table (identical on both apps; each lane reports against it)

| State          | Trigger                                    | Exact visible strings       | Id (a11y id == testTag) | Analytics event | Operation | Error → this state |
| -------------- | ------------------------------------------ | --------------------------- | ----------------------- | --------------- | --------- | ------------------ |
| drawn          | `AppIcon(name)`, any size, `tint` nil      | none (decorative)           | caller's, if any        | —               | —         | —                  |
| tinted         | `tint` set to a role                       | none                        | caller's, if any        | —               | —         | —                  |
| larger text    | system text size above 100 %               | none                        | caller's, if any        | —               | —         | —                  |
| in button      | `AppButton(…, leadingIcon: name)`          | `{label}`                   | the button's            | —               | —         | —                  |
| button loading | `loading` true with a `leadingIcon`        | `{label}`; spoken "Loading" | the button's            | —               | —         | —                  |
| gallery cell   | the debug gallery's C02 section            | `{glyph id}`                | `ds-icon-<id>`          | —               | —         | —                  |
| loading        | N/A: no I/O                                | —                           | —                       | —               | —         | —                  |
| empty          | N/A: every name has a glyph                | —                           | —                       | —               | —         | —                  |
| failure        | N/A: no I/O                                | —                           | —                       | —               | —         | —                  |
| offline        | N/A: no I/O                                | —                           | —                       | —               | —         | —                  |

The "larger text" row grows the frame and stroke by the platform's text scale.

| Item                | iOS                                                                 | Android                                                                     |
| ------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| View / composable   | `AppIcon(_ name:size:tint:)`                                        | `AppIcon(name, modifier, size, tint)`                                       |
| Geometry            | `AppIconGeometry.unitScale(_:)`, `.strokeWidth(_:renderedSize:)`, `.scaled(_:by:)` (`package`, `DesignTokens`) | `AppIconGeometry.unitScale()`, `.strokeWidth()`, `.scaled()`, `AppIconShape.toPathNodes()` (`internal`, `:core:designsystem`) |
| Text-size scaling   | `@ScaledMetric(relativeTo: AppIcon.scalingStyle(for: size))` seeded with `size.size` (xs–lg body, xl title2, hero largeTitle) | `size.size.sp` converted with `LocalDensity` (non-linear font scale)        |
| Button slot         | `leadingIcon: AppIconName?`, drawn at `appearance.iconSize` (`.md`) | `leadingIcon: AppIconName?`, drawn at `appearance.iconSize` (`MD`)          |
| Gallery section     | `ds-gallery-section-c02-icons`, "C02 Icons", after "C01 Buttons"    | same                                                                        |
| Gallery cells       | 124, grouped by the 7 `AppIconSet`s in generated order, id `ds-icon-<id>`, caption = glyph id | same                                     |
| Playground strings  | "Size" (6 options `icon-xs` … `icon-hero`, default `icon-lg`); "Tint" (7 options: `text`, `text-secondary`, `primary-text`, `success-fg`, `warning-fg`, `error-fg`, `info-fg`; default `text`) | same |
| Set headers         | `navigation`, `actions`, `weather`, `closet`, `status`, `account`, `capture` | same                                                              |

Rendering maths (both apps; `viewBox` = `AppIconMetrics.viewBox` = 24; `rendered` = the token size
scaled by the platform's text size, in pt on iOS and px on Android at draw time):

- `unitScale = rendered / viewBox`. Every point `(x, y)` becomes `(x × unitScale, y × unitScale)`.
- `stroke = strokeWidth × rendered / viewBox`. Caps and joins are round, the fill rule is non-zero,
  and `both` fills, then strokes. Shapes are painted in table order with one tint.
- The frame is exactly `rendered × rendered`.

At 100 % text size (`rendered` = `size`, pt/dp):

| Step (Swift / Kotlin) | id        | size | strokeWidth (viewBox) | unitScale | drawn stroke (pt/dp)                    |
| --------------------- | --------- | ---- | --------------------- | --------- | --------------------------------------- |
| `.xs` / `XS`          | icon-xs   | 12   | 2.2                   | 0.5       | 1.1                                     |
| `.sm` / `SM`          | icon-sm   | 16   | 1.7                   | 0.666667  | 1.133333                                |
| `.md` / `MD`          | icon-md   | 20   | 1.7                   | 0.833333  | 1.416667 (every button size)            |
| `.lg` / `LG`          | icon-lg   | 24   | 1.7                   | 1         | 1.7 (default)                           |
| `.xl` / `XL`          | icon-xl   | 32   | 1.7                   | 1.333333  | 2.266667                                |
| `.hero` / `HERO`      | icon-hero | 56   | 1.7                   | 2.333333  | 3.966667                                |

These values are read from the generated `AppIconSize`; the lanes never type them except as test
expectations. At other text sizes, the size and stroke both multiply by the platform's scale
factor, and the stroke-to-size ratio stays the same.

Accessibility: `AppIcon` is hidden from VoiceOver and TalkBack, and the host names the action. The
host's 44 pt / 48 dp target is a minimum. A gallery cell reads as its glyph id. The button keeps its
C01 semantics. Consent: N/A, because there are no analytics.

Tests (no snapshot, golden or new UI tests; only what the existing targets run). Every geometry test
passes the rendered size as a plain number:

- iOS `apps/ios/Packages/DesignSystem/tests/DesignTokensTests/AppIconGeometryTests.swift`, Swift
  Testing. It runs on Linux and macOS with `just ios-test-packages designsystem`:
  - Scaling: `AppIconGlyphs.Today.glyph` at `.xs` (rendered 12). Its first cubic
    `[19.157, 5.0, 20.5, 6.343, 20.5, 8.0]` becomes `[9.5785, 2.5, 10.25, 3.1715, 10.25, 4.0]`,
    within 1e-9. Commands, paints and shape count are unchanged.
  - Stroke maths: `strokeWidth(step, renderedSize: step.size)` equals
    `step.strokeWidth × step.size / viewBox` for every `AppIconSize`. Spot values: `.lg` → 1.7,
    `.md` → 1.4166…, `.xs` → 1.1. With a larger text size, `strokeWidth(.lg, renderedSize: 36)`
    → 2.55: the stroke grows with the size.
  - Every glyph builds: for every `AppIconName` × `AppIconSize` × rendered in
    `{step.size, step.size × 2}`:
    - the shape count is unchanged and every shape starts with `move`;
    - points come in pairs (2 for `move` and `line`, 6 for `cubic`, 0 for `close`);
    - every point is finite and in `0…rendered`.
- iOS `tests/DesignSystemTests/AppIconTests.swift` (Apple only; on the Mac it runs in
  `just ios-test-packages` and `just ios-test`): the replayed `SwiftUI.Path` of one glyph at one
  rendered size has the same element sequence (move, line, curve, closeSubpath) and points as the
  scaled segments.
- iOS `tests/DesignSystemCatalogTests/GalleryTests.swift`: add
  `("ds-gallery-section-c02-icons", "C02 Icons")` to `paritySections`. That is required, because the
  test asserts the full list.
- Android `apps/android/core/designsystem/src/test/kotlin/app/aistylist/core/designsystem/AppIconGeometryTest.kt`,
  plain JUnit (no Robolectric), the same cases as iOS. It adds the replay: `toPathNodes()` of every
  shape yields `MoveTo` / `LineTo` / `CurveTo` / `Close` in segment order, with the scaled points.
- Android `core/designsystem-catalog/src/test/.../gallery/GalleryTest.kt`: add
  `"ds-gallery-section-c02-icons" to "C02 Icons"` to `PARITY_SECTIONS`, which is required.
  `AppButtonTest`, `AppThemeTest` and `GeneratedTokensTest` stay green.
- The button icon wiring passes a generated value straight through, so it has no logic of its own
  and no extra test. The existing `AppButtonTest` / `AppButtonTests` must still compile and pass.

## Lanes

| Lane    | Agent            | Isolation | Scope | Files expected | Sibling to copy | Checks |
| ------- | ---------------- | --------- | ----- | -------------- | --------------- | ------ |
| iOS     | ios-engineer     | worktree  | apps/ios/** | New: `Packages/DesignSystem/Sources/DesignTokens/AppIconGeometry.swift`; `Sources/DesignSystem/AppIcon.swift`; `Sources/DesignSystemCatalog/Gallery/GalleryIconSection.swift` (+ `GalleryIconCell.swift`, names may vary); `Sources/DesignSystemCatalog/AppIconPreviews.swift`; `tests/DesignTokensTests/AppIconGeometryTests.swift`; `tests/DesignSystemTests/AppIconTests.swift`. Changed: `Sources/DesignSystem/{AppButton,AppButtonStyle,AppButtonFace}.swift`; `Sources/DesignSystemCatalog/Gallery/{GallerySectionKind,GallerySection,GallerySectionView}.swift`; `Sources/DesignSystemCatalog/AppButtonPreviews.swift`; `tests/DesignSystemCatalogTests/GalleryTests.swift`; `Packages/DesignSystem/Package.swift` (comment only); `apps/ios/README.md` | `GalleryButtonCell.swift`, `GallerySectionKind.swift`, `AppButtonPreviews.swift`, `AppButtonFace.swift`, `DesignTokensTests.swift` | `just ios-lint`, `just ios-format --check`, `just ios-check-banned`, `just ios-test-packages designsystem`, `just ios-test` (skips on Linux), `just generate --check` |
| Android | android-engineer | worktree  | apps/android/** | New: `core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/{AppIcon,AppIconGeometry}.kt`; `core/designsystem/src/test/kotlin/app/aistylist/core/designsystem/AppIconGeometryTest.kt`; `core/designsystem-catalog/src/main/kotlin/app/aistylist/core/designsystem/catalog/gallery/GalleryIcons.kt`; `core/designsystem-catalog/src/main/kotlin/app/aistylist/core/designsystem/catalog/AppIconPreviews.kt`. Changed: `core/designsystem/.../{AppButton,AppButtonFace}.kt`; `catalog/gallery/DesignSystemGalleryScreen.kt`; `catalog/AppButtonPreviews.kt`; `core/designsystem-catalog/src/main/res/values/strings.xml`; `core/designsystem-catalog/src/test/kotlin/app/aistylist/core/designsystem/catalog/gallery/GalleryTest.kt`; `apps/android/README.md`. No build file, lockfile or module-edge change | `gallery/GalleryButtons.kt`, `catalog/AppButtonPreviews.kt`, `AppButtonFace.kt`, `GeneratedTokensTest.kt` | `just android-format --check`, `just android-detekt`, `just android-test`, `just android-lint`, `just android-build debug` (the Gradle tasks behind them: `apps/android/tools/gradle.sh spotlessCheck detektMain detektTest testDebugUnitTest :core:designsystem:test :app:lintDebug checkModuleGraph :app:assembleDebug`), `just generate --check` |
| API     | N/A: no endpoint | — | — | — | — | — |
| e2e     | N/A: `e2e/smoke.yaml` unchanged; no new flow (owner checks the gallery) | — | — | — | — | — |

Notes for the lanes:

- Neither lane reads the other app's sources. Parity comes from the generated files, the contract and
  this brief.
- Lanes never run `just generate` in write mode and never hand-edit `generated/`. A missing generated
  field or type goes under **Blockers** in the report, with the exact name needed; do not work around
  it.
- Neither lane can unset the PostHog keys (`.claude/rules/design-system.md` invariant 10), so they run
  only the non-uploading commands listed. The lead runs `just ios-check` (Mac), the full
  `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-check`,
  `just generate --check`, `just arch-check`, `just docs-check` and the rest after integration.
- On Linux, the iOS lane compiles and tests only `DesignTokens`. `AppIcon`, the button change and the
  catalog compile only on a Mac, so the report says which iOS checks did not run.
- Human-applied doc texts (rules, skills) go under `Noticed but not touched:`.

## Intended differences

- Tint inheritance: iOS uses the inherited `foregroundStyle`; Android uses material3
  `LocalContentColor`, and `AppButtonFace` provides it around the icon. Reason: platform idiom.
  Accepted by the lead, 2026-10-20.
- Text-size scaling curve: iOS uses `@ScaledMetric(relativeTo: .body)` (Dynamic Type); Android uses
  sp through `Density` (font scale, non-linear on newer Android). At the same setting the two apps
  can render slightly different sizes. Reason: owner decision 11 ("like the platform's own icons").
  Owner, 2026-10-21.
- Test ID attachment: iOS puts `.accessibilityIdentifier` on a combined cell element (the icon itself
  is `accessibilityHidden`). Android puts `Modifier.testTag` on the cell `Column`, and `AppIcon` takes
  `modifier`, by Compose convention. Reason: platform idiom. Lead, 2026-10-20.
- Decorative hiding: iOS uses `.accessibilityHidden(true)`; Android adds no semantics. Reason: the
  platform accessibility API. Lead, 2026-10-20.
- Where the geometry lives: iOS puts it in the Foundation-only `DesignTokens` target (`package`
  access) so it tests on Linux. Android puts it in `:core:designsystem` (`internal`), where it tests
  with plain JUnit, and adds the `PathNode` replay step. Reason: each app's build layout. Lead,
  2026-10-21.
- Units: points on iOS, sp-derived dp and px on Android. Reason: platform idiom. Owner (DESIGN.md).
- Playground controls: iOS `Picker`; Android `FilterChip` rows. Reason: platform idiom. Lead,
  2026-10-20.
- Ended: the C01 brief's "Icon parameter type — iOS `Image?`, Android `Painter?`". Both apps are now
  `AppIconName?`.

## Amended after review (2026-10-21)

- Owner, 2026-10-21: on iOS each step scales with its own Dynamic Type text style through
  `AppIcon.scalingStyle(for:)`: xs–lg `.body`, xl `.title2`, hero `.largeTitle`. This supersedes
  `relativeTo: .body` in scope items 2 and 3 and in the intended difference on the scaling curve.
  Android keeps sp through `Density`, whose non-linear font scale already damps the large sizes.
- Lead, after the design and architecture reviews: both `AppTheme`s set the root content colour to
  the `text` role, so an untinted `AppIcon` draws in `text`. The playground labels use `headline`,
  with `space8` between the controls. The button playground's picker label is "Leading icon" on
  both apps. Gallery set headers are headings on both.

## Decided before launch

- The loading spinner shares the icon slot, so it grows with text size exactly as the icon does
  (scope item 3). Otherwise the button would change size between idle and loading. That is the
  undrawn-state rule of `.claude/rules/design-system.md` invariant 8. Lead, 2026-10-21.

## Open questions

None.
