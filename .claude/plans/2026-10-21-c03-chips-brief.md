# AppChip, AppTag, AppBadge, AppReasonRow — cross-platform brief (2026-10-21, slug c03-chips)

Phase task: none (Brand v1, milestone "Design system": AI-202 parent; AI-205 iOS lane, AI-206 Android
lane; contracts AI-203; generator AI-204) · Journey: N/A — base components; the C03 contracts stand in
for the journey
Branch: feat/c03-chips · Lanes: iOS, Android (no API lane, no contract lane)

Approval (`ui-prototype-first` step 1, "a DESIGN.md component → skip to step 5"): the approved
contracts are the owner approval, all `approved: 2026-10-21`, canvas board C03 plus the screens they
cite: `.impeccable/components/chip.yaml`, `tag.yaml`, `badge.yaml`, `reason-row.yaml` (commits
42a8792, 03d54ad). A base component needs no surface brief.

## Outcome and scope

- User outcome: both apps have `AppChip`, `AppTag`, `AppBadge` and `AppReasonRow` that look and behave
  as C03 and the drawn screens show, read only from the generated API, with previews and gallery
  sections in the catalog modules.
- **The base is red by design.** At BASE both catalog galleries fail to compile: the generated
  `GalleryComponent` gained `badge`, `chip`, `reasonRow`, `tag`, and the switches are exhaustive
  (`apps/ios/Packages/DesignSystem/Sources/DesignSystemCatalog/Gallery/GallerySection.swift:29`,
  `apps/android/core/designsystem-catalog/src/main/kotlin/app/aistylist/core/designsystem/catalog/gallery/DesignSystemGalleryScreen.kt:122`).
  The core modules (`DesignTokens`, `:core:designsystem`) compile. The lane makes the check green;
  never stop BLOCKED on this.
- Inputs (generated, committed at d653ace; never hand-edit, never redeclare):
  - iOS `apps/ios/Packages/DesignSystem/Sources/DesignTokens/generated/{ReferenceTokens,SchemeTokens,ComponentTokens,ComponentAPI}.swift`
  - Android `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/generated/{ReferenceTokens,SchemeTokens,ComponentTokens,ComponentApi}.kt`
  - Per component `<C>` in Chip, Tag, Badge, ReasonRow: `<C>Variant` (with `.role` and `.parts`),
    `<C>Size`, `<C>State`, `<C>Role`, `<C>Part` (`.kind`, `.position`, `.separatorKey`),
    `<C>PartKind`, `<C>PartPosition`, `<C>IconSource` (`.glyph(name:)` / `.prop`), `<C>TestId`,
    `<C>Appearance`, `<C>Look`, `<C>Spec.{light,dark,brand,hcLight,hcDark}.appearance(variant:size:state:)`
    (nil = combination not allowed), `<C>GalleryEntry`. Chip only: `ChipSelection`.
  - Gallery: `GalleryComponent` (`.title`, `.slug`), `ComponentGallery.chip` (84 entries),
    `.tag` (12), `.badge` (4), `.reasonRow` (1), and the samples `chipLabel` "Wool",
    `chipLeadingIcon` `.rain`, `chipPrefix` "Group:", `chipDetail` "12", `chipSwatch` `.cameraInk`,
    `tagLabel` "Plus", `tagLeadingIcon` `.laundry`, `badgeLabel` "2", `badgeHostSurface` `.surface2`,
    `reasonRowLabel`, `reasonRowFact`, `reasonRowFactIcon`, `reasonRowFreshness`,
    `reasonRowAccessibilityLabel`.
  - Already built: `AppTheme`, `AppIcon(name, size:, tint:)` (scales with Dynamic Type / font
    scale), `AppButton`, `AppMotion.Press`, `FocusRingTokens`, `AppColors[role]`, `AppTextStyle`.
- Scope, both lanes:
  1. **AppTheme** exposes `chips: ChipSpec`, `tags: TagSpec`, `badges: BadgeSpec`,
     `reasonRows: ReasonRowSpec` of the selected context, exactly as it exposes `buttons`. No new
     context logic; S3 `brand` stays unselected.
  2. **Touch target.** iOS: move `AppButtonStyle.minTouchTarget` (44, "No token carries it yet") into
     one internal constant in the `DesignSystem` target that `AppButtonStyle` and `AppChip` both
     read; never a second copy. Android: `Modifier.minimumInteractiveComponentSize()`, as `AppButton`.
  3. **Strings** (copy, identical bytes on both apps; resources, never Swift or Kotlin literals):

     | Key | Value | Used by |
     | --- | --- | --- |
     | `ds_chip_detail_separator` | `· ` (U+00B7 then U+0020) | the chip's `detail` part; the key is `ChipPart.detail.separatorKey` |
     | `ds_chip_state_expanded` | `Expanded` | reason chip, spoken state while `expanded` |
     | `ds_chip_state_collapsed` | `Collapsed` | reason chip, spoken state while not `expanded` |
     | `app_button_loading` | `Loading` | AppButton's busy state (exists on Android; iOS moves it here) |

     - Android: `core/designsystem/src/main/res/values/strings.xml`. The trailing space is trimmed
       unless the value is quoted, so write exactly `<string name="ds_chip_detail_separator">"· "</string>`.
       Read through `R.string.*`, never `getIdentifier`.
     - iOS: new String Catalog `Sources/DesignSystem/Resources/Localizable.xcstrings` (source
       language en) with the four keys; `Package.swift` gains `defaultLocalization: "en"`. Read with
       `String(localized:bundle: .module)`; the separator by its generated key
       (`String.LocalizationValue(key)`). `AppButtonRules.loadingStateText` reads the catalog; its
       callers and tests keep working.
  4. **AppChip** per `chip.yaml`:
     - iOS: `AppChip(_ label: String, variant: ChipVariant, size: ChipSize, leadingIcon: AppIconName? = nil, selected: Bool = false, expanded: Bool = false, enabled: Bool = true, selection: ChipSelection = .multiple, prefix: String? = nil, detail: String? = nil, swatch: Color? = nil, accessibilityLabel: String? = nil, action: @escaping () -> Void)`,
       a SwiftUI `Button` with a `ButtonStyle`, as `AppButton`.
     - Android: `AppChip(label: String, variant: ChipVariant, size: ChipSize, action: () -> Unit, modifier: Modifier = Modifier, leadingIcon: AppIconName? = null, selected: Boolean = false, expanded: Boolean = false, enabled: Boolean = true, selection: ChipSelection = ChipSelection.MULTIPLE, prefix: String? = null, detail: String? = null, swatch: Color? = null, accessibilityLabel: String? = null)`.
     - **State shown** (contract G2), first match wins: `disabled` if not `enabled`, else `pressed`,
       else `focused` (both from the platform), else none; prefixed `selected-` while `selected`,
       `expanded-` while `expanded`. None plus a toggle is the toggle (`selected`, `expanded`);
       none with no toggle is `enabled`. Examples: selected and pressed → `selected-pressed`;
       selected and not enabled → `selected-disabled`.
     - **Not allowed → nothing** (the AppButton rule): when the resting state (the rule above with
       no interaction) has no look at that variant × size, the chip renders nothing, on both apps.
       This covers a disallowed size and a toggle or `enabled = false` the variant does not take.
       `selection` matters only when `variant.role` is `selectable`.
     - **Look**, only from `AppTheme.chips.appearance(variant, size, state)`; colours through
       `AppColors[role]`:
       - Fill `backgroundColor` (nil = none), and a pressed overlay `overlayColor` over the fill.
       - Ring `borderColor` at `borderWidth`, inside the shape.
       - Shape radius `rounded`, min height `height`, padding top/end/bottom/start.
       - Label in `typography` / `textColor`.
       - Focus ring `appearance.focusRing`, outside the chip, following its corners (as AppButton).
     - **Content, in order:** leading icon, before-label parts in `ChipPart` order (prefix, swatch; no variant has both),
       label, after-label parts (detail), trailing icon. Gaps: `iconGap` after the leading icon,
       `swatchGap`, `prefixGap`, `detailGap` before the detail, `trailingIconGap` before the trailing
       icon.
     - **Icons:** `appearance.leadingIcon` / `trailingIcon`. `.glyph(name)` draws that glyph;
       `.prop` draws the caller's `leadingIcon`, and nil leaves the icon out while the chip still
       renders; a nil source is no icon. `AppIcon(name, size: iconSize, tint: iconColor ?? textColor)`;
       trailing at `trailingIconSize`, tint `trailingIconColor ?? textColor`. Icons are decorative.
     - **Parts**, drawn only when `variant.parts` lists the part and its prop is non-nil (otherwise
       left out; the chip still renders):
       - `prefix`: text in `prefixTypography ?? typography`, `prefixColor ?? textColor`.
       - `swatch`: a circle of `swatchSize` filled with the `swatch` colour. The ring is
         `swatchRingColor` at `swatchRingWidth`, `swatchRingGap` outside the circle, when set. The
         edge is `swatchEdgeColor` at `swatchEdgeWidth` inside the circle. Draw the edge only when
         contrast(swatch, resolved `backgroundColor`) < `swatchEdgeMinContrast`. Contrast is
         WCAG 2.x: relative luminance L = 0.2126 R + 0.7152 G + 0.0722 B on linear sRGB, and
         ratio = (Lmax + 0.05) / (Lmin + 0.05). iOS uses `Color.Resolved` (`resolve(in:)`,
         `linearRed`/`linearGreen`/`linearBlue`); Android uses `Color.luminance()`. Every swatch
         look sets a fill.
       - `detail`: one run, the separator string plus `detail`, in `detailTypography ?? typography`,
         `detailColor ?? textColor`.
     - **Text:** label and parts wrap, never truncate; heights are minimums; Dynamic Type and Android
       font scale to 200 %.
     - **Touch target:** item 2, every size. The hit area is part of the layout, so a wrapping row
       of chips sits 44 pt apart on iOS and 48 dp on Android.
     - **Press motion:** `AppMotion.Press` duration and easing; none under Reduce Motion (as
       `AppButtonStyle`; Android follows the system animator scale).
     - **Disabled:** not activatable, announced disabled, the `disabled` look (never opacity alone).
       Activation runs `action` once per tap, keyboard or assistive activation in every state but
       disabled ones.
     - **Accessibility:** the name is `accessibilityLabel ?? label`. Icons, swatch, prefix,
       separator and detail are hidden inside the one element. The role is `variant.role`:

       | `variant.role` | Variants | iOS | Android | Spoken state (our copy) |
       | --- | --- | --- | --- | --- |
       | `button` | weather, context, condition-*, override, never-suggest, soft-dislike, add, never-suggest-add | button trait | `Role.Button` | — |
       | `selectable`, `selection` multiple | choice, swatch, filter | `.isToggle` trait, `.isSelected` while selected | `Modifier.toggleable(value = selected, role = Role.Checkbox)` | — (platform words) |
       | `selectable`, `selection` single | choice, swatch, filter | button trait, `.isSelected` while selected | `Modifier.selectable(selected, role = Role.RadioButton)`; the caller's row adds `selectableGroup()` | — (platform words) |
       | `disclosure` | reason | button trait; `accessibilityValue` = expanded / collapsed string | `Role.Button`; `stateDescription` = expanded / collapsed string; `expand` / `collapse` semantics actions run `action` | `Expanded` / `Collapsed` |
       | `menu` | filter-menu, group-sort | button trait; `.isSelected` while selected (filter-menu) | `Role.DropdownList`; `selected` semantics while selected | — |

       Confirm each API on developer.apple.com / developer.android.com (context7) and record the
       doc date in the report.
  5. **AppTag** per `tag.yaml` (one state, `enabled`):
     - iOS: `AppTag(_ label: String, variant: TagVariant, size: TagSize, leadingIcon: AppIconName? = nil, accessibilityLabel: String? = nil)`.
     - Android: `AppTag(label: String, variant: TagVariant, size: TagSize, modifier: Modifier = Modifier, leadingIcon: AppIconName? = null, accessibilityLabel: String? = null)`.
     - Not allowed → nothing.
     - Look: fill, ring, radius, height, padding and label as the chip. The ring is dashed when
       `borderDash` is set: dashes and gaps of that length (G13). Icon source as the chip; the `dot`
       part (variant `new`) is a dot of `dotSize` in `textColor`, `dotGap` before the label.
     - Accessibility: read as static text, name `accessibilityLabel ?? label`. Icon and dot hidden.
       No focus stop of its own, no action, no touch target.
  6. **AppBadge** per `badge.yaml` (one state, `enabled`):
     - iOS: `AppBadge(variant: BadgeVariant, size: BadgeSize, label: String? = nil, hostSurface: AppColorRole? = nil)`.
     - Android: `AppBadge(variant: BadgeVariant, size: BadgeSize, modifier: Modifier = Modifier, label: String? = null, hostSurface: AppColorRole? = null)`.
     - Not allowed → nothing. A nil `label` on count, trial or trial-last-day → nothing.
     - Look: dot is a circle of `size`. Count and trial use `height` / `minWidth` / padding / label
       (`minWidth` keeps one digit round). The `outerRing` part (dot, count) is a ring of
       `outerRingWidth` outside the shape in `AppColors[hostSurface]`; a nil `hostSurface` means no
       ring.
     - Accessibility: dot and count are hidden from assistive tech (the host names them; iOS
       `accessibilityHidden(true)`, Android `clearAndSetSemantics {}`). Trial and trial-last-day are
       read as static text. No action, no touch target.
  7. **AppReasonRow** per `reason-row.yaml` (one variant `standard`, one size, one state):
     - iOS: `AppReasonRow(_ label: String, fact: String, factIcon: AppIconName, freshness: String, accessibilityLabel: String)`.
     - Android: `AppReasonRow(label: String, fact: String, factIcon: AppIconName, freshness: String, accessibilityLabel: String, modifier: Modifier = Modifier)`.
     - Look: fill, ring, radius and padding from the appearance. Three lines, `lineGap` apart:
       - the label in `typography` / `textColor`;
       - the fact line: a disc of `iconDiscSize` in `iconDiscColor` holding `factIcon` at
         `iconSize` in `iconColor`, `iconGap`, then `fact` in `factTypography` / `factColor`;
       - `freshness` in `freshnessTypography` / `freshnessColor`.
     - Accessibility: a region named `accessibilityLabel`, its lines read in order; the icon is
       hidden. iOS `.accessibilityElement(children: .contain)` plus `.accessibilityLabel`. Android
       `semantics { contentDescription = accessibilityLabel; isTraversalGroup = true }` on the
       container; lines stay separate nodes. No action, no touch target.
  8. **Face views and previews** (previews only in `DesignSystemCatalog` / `:core:designsystem-catalog`):
     - `AppChipFace` on both apps renders a given `ChipAppearance` plus content. `AppChip` uses it,
       and previews and the gallery draw forced states through it (the `AppButtonFace` pattern).
       Tag, badge and reason row have one state and need no face.
     - One previews file per component, each with:
       - a state grid: one cell per `ComponentGallery.<c>` entry in generated order, with the
         gallery samples, each cell tagged `entry.testId`, once in light and once in dark;
       - a playground with live controls: chip variant, size (only sizes the variant allows),
         selected, expanded, enabled, selection, label, prefix, detail; tag variant, size and label;
         badge variant, size and label; reason-row texts. iOS `#Preview` with `@Previewable @State`;
         Android `@Preview` with `remember { mutableStateOf(...) }`.
  9. **Gallery.** Render the four new `GalleryComponent` cases on both apps:
     - Section id `ds-gallery-section-<slug>` and title from the generated enum.
     - Cells in `ComponentGallery.<c>` order, each tagged `entry.testId`.
     - Chips sit in wrapping rows (iOS `GalleryFlowLayout`; Android a flow row). Badges sit on an
       `AppColors[badgeHostSurface]` fill with `hostSurface = badgeHostSurface`.
     - Chip samples:
       - `chipLeadingIcon` where the look's icon source is `.prop`;
       - `chipPrefix` for `group-sort`;
       - `chipDetail` where `variant.parts` has `detail`;
       - `AppColors[chipSwatch]` as the swatch colour.
     - Update `tests/DesignSystemCatalogTests/GalleryTests.swift` and the Android
       `catalog/gallery/GalleryTest.kt` for the new sections and ids.
- Acceptance criteria:
  - AC-1 iOS builds, lints and tests: `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just ios-check`
    → exit 0 on the Mac (simulator build and tests included).
  - AC-2 Android: `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-check`
    → exit 0, `checkModuleGraph: 14 edges, all allowed` (unchanged; no new module, no new dependency).
  - AC-3 no generated type redeclared:
    `rg -n 'enum (class )?(Chip|Tag|Badge|ReasonRow)(Variant|Size|State|Role|Selection|Part|PartKind|PartPosition|IconSource)\b' apps/ios/Packages apps/android --glob '!**/generated/**' --glob '!**/build/**'`
    → no hits.
  - AC-4 no literal style values in the hand-written layer:
    `rg -n 'Color\(red:|Color\(0x|0x[0-9A-Fa-f]{6,8}|cornerRadius: [0-9]|padding\([0-9]|[0-9]+\.(dp|sp)\b' apps/ios/Packages/DesignSystem/Sources/DesignSystem apps/android/core/designsystem/src/main --glob '!**/generated/**'`
    → no hits. The moved iOS touch-target constant is the only known exception; list it with file:line.
  - AC-5 copy lives in resources: `rg -n '"· "|"Expanded"|"Collapsed"' apps/ios/Packages apps/android -g '*.swift' -g '*.kt' --glob '!**/generated/**' --glob '!**/build/**' --glob '!**/tests/**' --glob '!**/src/test/**'`
    → no hits; the four keys exist in `strings.xml` / `Localizable.xcstrings`.
  - AC-6 core holds no previews: `rg -n '#Preview|@Preview' apps/ios/Packages/DesignSystem/Sources/DesignSystem apps/ios/Packages/DesignSystem/Sources/DesignTokens apps/android/core/designsystem/src`
    → no hits.
- Non-goals:
  - adopting the components on any screen (none draws them yet);
  - a chip-row container component;
  - the sheets and lists that filter-menu, group-sort and context open (the chip only runs `action`);
  - C04 tile and provenance badges;
  - snapshot tests (AI-190);
  - the S3 brand scheme;
  - any `generated/` file, `DESIGN.md` or `.impeccable/**`.
- Search done (lead, 2026-10-21):
  `rg -n -i 'chip|tag\b|badge|reason.?row|FilterChip|AssistChip|SuggestionChip' apps/ios/Packages apps/android --glob '!**/generated/**' --glob '!**/build/**'`
  → no chip, tag, badge or reason-row component. The only hits are Material `FilterChip` in the
  Android catalog playgrounds (`AppButtonPreviews.kt`, `gallery/GalleryIcons.kt`); leave them.

## Entry point and navigation

- iOS: no screen; reached from previews and the debug gallery (`DesignSystemGalleryScreen`).
- Android: no screen; reached from previews and the debug gallery (`DesignSystemGalleryScreen.kt`).
- Doc 02 §2.1 tab or route: N/A — no new screen or route.

## Contract

- Operations: none. Contract lane changes: none. Analytics events: none. Registry values: none.
  Kernel wiring: none.

## Parity table (identical on both apps; each lane reports against it)

| State | Trigger | Exact visible strings | Id (a11y id == testTag) | Analytics | Operation | Error → state |
| --- | --- | --- | --- | --- | --- | --- |
| enabled | idle, no toggle | `{prefix} {label} · {detail}` as the parts allow | gallery: `entry.testId` | — | — | — |
| pressed / focused | platform interaction | as enabled | as above | — | — | — |
| disabled | `enabled` false (choice, swatch, filter) | as enabled | as above | — | — | — |
| selected (+ -pressed, -focused, -disabled) | `selected` true (choice, swatch, filter, filter-menu) | as enabled, check icon shown | as above | — | — | — |
| expanded (+ -pressed, -focused) | `expanded` true (reason) | as enabled, chevron-up shown; spoken "Expanded" | as above | — | — | — |
| not allowed | resting state has no look | nothing rendered | — | — | — | — |
| loading / empty / offline | N/A — no chip is busy (G1), no data, no I/O | — | — | — | — | — |

- Gallery: four new sections, ids `ds-gallery-section-c03-badges`, `-c03-chips`,
  `-c03-reason-row`, `-c03-tags`. Cells number 84 chips, 12 tags, 4 badges and 1 reason row, ids
  `ds-<component>-<variant>-<size>-<state>` from the entries, in generated order, light then dark
  in previews.
- Separator: exactly `· ` before the detail. Expanded and collapsed words: `Expanded`, `Collapsed`.
- Accessibility: the role table in scope item 4. Targets are 44 pt / 48 dp for chips only. Dynamic
  Type / font scale 200 % wraps without clipping. Reduce Motion removes the press animation.
  Consent: N/A.

Tests (no snapshot tests; AI-190 owns them):

- iOS, Swift Testing in `apps/ios/Packages/DesignSystem/tests/DesignSystemTests/`, no rendering:
  - the state rule over every variant × size × (selected, expanded, enabled), and "not allowed →
    nil";
  - every interaction state of an allowed resting state has a look;
  - every `ComponentGallery` entry of the four components resolves in all five contexts;
  - test ids are unique and equal the pattern;
  - the activation gate;
  - the separator resolves to exactly `· ` (two characters, ending in a space), plus the expanded,
    collapsed and loading strings;
  - contrast: `camera-ink` on the light `surface` draws no edge, a near-white swatch on it does.
- Android, Robolectric Compose tests in `apps/android/core/designsystem/src/test/kotlin/app/aistylist/core/designsystem/`
  (`@Config(sdk = [37])`, as `AppButtonTest`):
  - a disabled chip `assertIsNotEnabled` and a click does not call `action`;
  - the toggleable and selectable roles, and the reason chip's `stateDescription` "Expanded" /
    "Collapsed";
  - `onNodeWithTag(id)` finds the chip, and a not-allowed chip emits no node;
  - touch target ≥ 48 dp at every chip size;
  - the separator string is `"· "` (ends in a space) and
    `resources.getResourceEntryName(R.string.ds_chip_detail_separator) == ChipPart.DETAIL.separatorKey`;
  - dot and count badges expose no semantics; the tag's `accessibilityLabel` override; the reason
    row's content description;
  - the contrast pair as on iOS.

  Existing tests stay green.

## Lanes

| Lane | Agent | Isolation | Scope | Files expected | Sibling to copy | Checks |
| --- | --- | --- | --- | --- | --- | --- |
| iOS | ios-engineer | worktree | apps/ios/** | `Packages/DesignSystem/Package.swift`; `Sources/DesignSystem/{AppChip,AppChipFace,AppChipStyle,AppChipRules,AppTag,AppBadge,AppReasonRow,AppTouchTarget,AppColorContrast}.swift` (names may vary, one type per file); `Sources/DesignSystem/Resources/Localizable.xcstrings`; `AppTheme.swift`, `AppButtonStyle.swift`, `AppButtonRules.swift`; `Sources/DesignSystemCatalog/{AppChip,AppTag,AppBadge,AppReasonRow}Previews.swift`; `Sources/DesignSystemCatalog/Gallery/*` (section kind, section view, new cells); `tests/DesignSystemTests/*`; `tests/DesignSystemCatalogTests/GalleryTests.swift`; `apps/ios/README.md` if it lists components | `AppButton.swift`, `AppButtonFace.swift`, `AppButtonRules.swift`, `AppButtonStyle.swift`, `AppButtonPreviews.swift`, `Gallery/GalleryButtonCell.swift`, `AppButtonTests.swift` | `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just ios-check` on the Mac |
| Android | android-engineer | worktree | apps/android/** | `core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/{AppChip,AppChipFace,AppTag,AppBadge,AppReasonRow,ColorContrast}.kt` (names may vary); `AppTheme.kt`; `core/designsystem/src/main/res/values/strings.xml`; `core/designsystem-catalog/src/main/kotlin/.../catalog/{AppChip,AppTag,AppBadge,AppReasonRow}Previews.kt`; `catalog/gallery/{DesignSystemGalleryScreen,GalleryChips,GalleryTags,GalleryBadges,GalleryReasonRow,GalleryTestTags}.kt`; `core/designsystem/src/test/kotlin/.../{AppChip,AppTag,AppBadge,AppReasonRow}Test.kt`; `core/designsystem-catalog/src/test/kotlin/.../gallery/GalleryTest.kt`; `apps/android/README.md` if it lists components | `AppButton.kt`, `AppButtonFace.kt`, `AppButtonPreviews.kt`, `gallery/GalleryButtons.kt`, `AppButtonTest.kt` | `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-check` |
| API | N/A — no endpoint | — | — | — | — | — |
| e2e | N/A — `e2e/smoke.yaml` unchanged | — | — | — | — | — |

Notes for the lanes:

- Neither lane reads the other app's sources. Parity comes from the generated files, the four
  contracts, `.impeccable/components/README.md` ("Fields", "Entry properties") and this brief.
- No new dependency and no lockfile change. If one is needed, stop and report it; the lead runs
  `just android-deps-lock`.
- Never touch `generated/`, `DESIGN.md`, `.impeccable/**`, `tools/**` or `justfile`. Doc text
  outside the lane goes under `Noticed but not touched:`.

## Intended differences

- Test ID attachment: iOS `.accessibilityIdentifier(id)` applied by the caller, Android
  `Modifier.testTag(id)` through `modifier`. Platform idiom; lead, 2026-10-21 (as AppButton).
- Theme plumbing: iOS environment value, Android `CompositionLocal`. Platform idiom; lead,
  2026-10-21 (as AppButton).
- Touch target: 44 pt iOS, 48 dp Android. Source: DESIGN.md Layout and the contract; owner.
- Accessibility APIs per role: iOS traits, Android `Role` / semantics (table in scope item 4).
  - Selection words are spoken by each platform, not our copy.
  - iOS has no public popup trait, so `menu` is a button trait on iOS and `Role.DropdownList` on
    Android.

  Platform API; lead, 2026-10-21.
- Reason-row region: iOS `.contain` with a label; Android a traversal group with a content
  description. Platform API; lead, 2026-10-21.
- Strings: iOS String Catalog, Android `strings.xml`, same keys and values. Platform idiom; lead,
  2026-10-21.
- Swatch colour type: SwiftUI `Color`, Compose `Color`; the contrast formula is the same. Platform
  idiom; lead, 2026-10-21.
- Badge gallery id: on iOS it sits on the captioned cell, because the badge is hidden from VoiceOver
  and XCUITest cannot find a hidden element. On Android it sits on the badge, where the `testTag`
  survives `clearAndSetSemantics`. Each id occurs once on each app. Platform API; lead, 2026-10-21
  (architecture review).
- Disclosure actions: Android offers `expand` only while collapsed and `collapse` only while expanded
  (Compose convention); iOS is a button whose value is the state word. Platform API; lead,
  2026-10-21 (architecture review).

## Rules settled after the architecture review (2026-10-21; both apps)

- An interaction state with no look (pressed or focused where the contract has none) shows the
  resting look. Today both test suites prove the case cannot occur.
- A swatch chip whose look has no fill draws the swatch edge. Today every swatch look sets a fill.
  Both suites assert the rule.
- The chip's look follows its `enabled` prop only. iOS does not read `\.isEnabled` from the
  environment for the look: a parent `.disabled(true)` would otherwise remove a variant with no
  disabled look. The doc comment says a chip is disabled through `enabled`.
- Shared drawing is extracted once, and every existing sibling uses it. No component keeps a
  private copy, and `just clone-check` passes.

## Fix round 1 (2026-10-21, after the architecture and UI reviews)

New generated inputs (353a632, plus the lead's regeneration after the ui-designer's `DESIGN.md` and
`badge.yaml` edits):

- `ButtonAccessibility.minTouchTarget` and `ChipAccessibility.minTouchTarget`, a `Double`: 44 in
  Swift, 48 in Kotlin.
- `AppTextStyle.textTransform` (`AppTextTransform.none` / `.uppercase`). `typography.overline` is
  `uppercase`.
- `<C>GalleryEntry.label`, each cell's sample label (the trial badges get their own words).

Both lanes:

- **F1 Duplicates.** `just clone-check` must pass on the integrated tree. It fails today at 0.82 %
  against 0.48 %. No clone pair may involve a file this branch added or changed in your scope.
  - Extract shared code once: the preview scaffolding (state grid, light and dark frames,
    playground rows), the gallery cell layout, face content and test helpers.
  - Every existing sibling then uses it: AppButton previews, the gallery button and icon cells,
    and the button tests.
  - Never raise the threshold, and never add a jscpd ignore.
- **F2 Settled rules:** the "Rules settled after the architecture review" section above.
- **F3** Trial-pill text is centred when it wraps.
- **F4 Text transform.** Every place that draws an `AppTextStyle` applies its `textTransform`. Only
  the drawn text changes; the spoken name stays the caller's string.
- **F5** Gallery cells read `entry.label`, not the component-wide `ComponentGallery.<c>Label`.
- **F6 Touch target from the generated constant.**
  - iOS deletes the literal 44: `AppButtonStyle` reads `ButtonAccessibility.minTouchTarget` and
    `AppChipStyle` reads `ChipAccessibility.minTouchTarget`.
  - Android keeps `minimumInteractiveComponentSize()`, fed from the generated value through
    `LocalMinimumInteractiveComponentSize` in `AppButton` and `AppChip`. Confirm the API on
    developer.android.com.

iOS only:

- **I1 (architecture, blocking)** `AppButtonFace` draws through `appShape`:
  - remove its own fill, overlay and ring;
  - drop the unused `shape`;
  - name `AppButtonFace` in the `AppShapeStyle` header.
- **I2** `AppButtonFace`'s label uses `AppComponentText`, with an alignment parameter.
- **I3** One outside-ring helper, used by `AppFocusRing`, `AppBadge` and `AppChipFace`.
- **I4** `GalleryButtonCell` and `GalleryIconCell` use `GalleryCaptionedCell`, and
  `ButtonSectionPreview` becomes `GallerySectionPreview(component: .button)`.
- **I5 Comments:**
  - `AppChipFace.swift:10` and `apps/ios/README.md:79-80` say "(prefix, swatch)";
  - the `AppIconTests.swift` comment names the SDK that `xcrun --sdk iphonesimulator --show-sdk-version` prints.
- **I6** The Swift clones from `just clone-check`:
  - `C03GalleryTests` (three internal clones);
  - `AppChipFace` vs `AppTag`;
  - `AppButtonStyle` vs `AppChipStyle`;
  - `AppButtonPreviews` vs `AppChipPreviews`;
  - `AppBadgePreviews` vs `AppTagPreviews`.

Android only:

- **A1 (UI B1, blocking)** At 200 % font scale the chip must keep its detail and trailing icon:
  - the prefix, label and detail runs take `Modifier.weight(1f, fill = false)`;
  - `ChipText` takes a modifier, and `ChipPartRun` becomes a `RowScope` extension;
  - icons, swatch and `Gap` stay unweighted.

  Test it with `fontScale = 2f` in a narrow box: the trailing icon has a width above 0, and the
  detail is displayed.
- **A2 (UI B2, blocking)** The `AppReasonRow` column fills the width (`fillMaxWidth()` after
  `modifier`), as iOS does.
- **A3** `AppButtonFace.kt:44-45` uses `animatedRoleColor`.
- **A4** `GalleryButtons` and `GalleryIcons` use `GalleryCell`.
- **A5** The chip playground turns an empty `prefix` or `detail` into null, as iOS does.
- **A6** `AppChipTest.kt` (490 lines) is split into two files: roles and semantics, and the state
  rule.
- **A7** The Kotlin clones from `just clone-check`:
  - previews: AppTag, AppBadge, AppChip, AppReasonRow and AppButton previews;
  - gallery: `GalleryChips` vs `GalleryTags`, and `GalleryCell` / `AppReasonRow` vs
    `GalleryTokenSections`;
  - components: `AppFaceDrawing` / `AppChipFace` / `AppBadge` vs `AppTag`, and `AppButton` vs
    `AppChip`;
  - tests: `AppReasonRowTest` / `AppBadgeTest` vs `AppTagTest`, and `AppButtonTest` vs
    `AppChipTest` / `GalleryTest`;
  - `DesignSystemGalleryScreen` vs `HomeScreen`, only if the branch introduced it.
