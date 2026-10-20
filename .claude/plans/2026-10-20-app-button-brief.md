# AppButton — cross-platform brief (2026-10-20, slug app-button)

Phase task: none (Brand v1, milestone "Design system": AI-186 iOS lane, AI-188 Android lane; contract
AI-198) · Journey: N/A — a base component, no journey; the C01 contract stands in for the journey
Branch: feat/app-button · Lanes: iOS, Android (no API lane, no contract lane)

Approval (UI gate, `ui-prototype-first` step 1 "a DESIGN.md component → skip to step 5"): the
approved contract `.impeccable/components/button.yaml` is the owner approval: `approved: 2026-10-20`,
commit 60c1711, canvas board C01 plus the screens it cites. A base component needs no surface brief;
`.impeccable/surfaces/` is not required for this work.

## Outcome and scope

- User outcome: both apps have one `AppButton` that looks and behaves as C01 and the drawn screens
  show, on a theme read from the generated `DESIGN.md` tokens with the bundled fonts, and Home's
  buttons use it.
- Inputs both lanes build against (generated, committed at d3a4fa0; never hand-edit, never redeclare):
  - iOS `apps/ios/Packages/DesignSystem/Sources/DesignTokens/generated/{ReferenceTokens,SchemeTokens,ComponentTokens,ComponentAPI}.swift`
  - Android `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/generated/{ReferenceTokens,SchemeTokens,ComponentTokens,ComponentApi}.kt`
  - Names used: `ButtonVariant` (9), `ButtonSize` (5), `ButtonState` (5), `ButtonTestId`,
    `ButtonAppearance`, `ButtonLook`, `ButtonSpec.{light,dark,brand,hcLight,hcDark}.appearance(variant:size:state:)`
    (nil = combination not allowed), `ComponentGallery.button` (100 entries, each with `testId`),
    `ComponentGallery.buttonLabel` ("Continue"), `AppColors.{light,dark,hcLight,hcDark}[role]`,
    `AppColorRole`, `AppTextStyle`, `AppTypography`, `AppSpacing`, `AppRadius`, `AppMotion.Press`,
    `FocusRingTokens`.
- Scope, both lanes:
  1. **AppTheme.** Picks the token context from the system: light → `light`, dark → `dark`, high
     contrast → `hcLight` / `hcDark` (S7). `brand` (S3) is not selected anywhere in this work. It
     exposes the generated `AppColors`, `AppTypography`, `AppSpacing`, `AppRadius` and `ButtonSpec`
     of that context without redeclaring them; the only hand-written code is the adapters
     (`UInt32`/`Long` ARGB → `Color`, `Double` → `CGFloat`/`dp`/`sp`, `AppTextStyle` → `Font`/`TextStyle`).
     - iOS: an environment value `\.appTheme` (type `AppTheme`), set by a `.appTheme()` view modifier
       that reads `colorScheme` and `colorSchemeContrast` (`.increased` → S7). Applied once at the app
       root: `apps/ios/App/AIStylistApp.swift` wraps `HomeScreen` in `.appTheme()`; `apps/ios/project.yml`
       gives the `AIStylist` target `- package: DesignSystem` / `products: [DesignSystem]`.
     - Android: `@Composable fun AppTheme(content)` with `staticCompositionLocalOf` holders and an
       `object AppTheme` accessor (`AppTheme.colors`, `.typography`, `.spacing`, `.radius`, `.buttons`).
       Dark from `isSystemInDarkTheme()`; S7 from the public high-contrast-text query on API 36+
       (`AccessibilityManager#isHighContrastTextEnabled`; confirm on developer.android.com and record
       the doc date in the report), off below API 36. It wraps `MaterialTheme` with the same stock
       `lightColorScheme()` / `darkColorScheme()` that `AiStylistTheme` uses today, so non-button
       Home components look unchanged. Never `dynamicLightColorScheme` / `dynamicDarkColorScheme`.
  2. **Bundled fonts** (files already in the tree, see Fonts below). Figtree is one variable font
     whose default instance is Light 300 (axis `wght` 300–900), so every Figtree style sets its weight
     explicitly from `AppTextStyle.fontWeight` (400/500/600/700); Young Serif is 400 only. No system
     font fallback.
     - iOS: register `Figtree-Variable.ttf` and `YoungSerif-Regular.ttf` once per process from
       `Bundle.module` with CoreText (`CTFontManagerRegisterFontsForURL`, scope `.process`), called by
       `.appTheme()`; `DesignSystem` target declares `resources: [.process("Resources")]`. Family
       names: "Figtree", "Young Serif" (equal to `AppTextStyle.fontFamily`). Text styles scale with
       Dynamic Type relative to `AppTextStyle.dynamicType`. A registration failure logs only the file name.
     - Android: `res/font/figtree_variable.ttf` → one `Font(..., weight, variationSettings =
       FontVariation.Settings(FontVariation.weight(n)))` per weight 400/500/600/700;
       `res/font/young_serif_regular.ttf` → `FontWeight.W400`. Sizes in `sp`.
  3. **AppButton** per `.impeccable/components/button.yaml`:
     - Props, contract names: `label`, `action`, `leadingIcon`, `fullWidth`, `enabled`, `loading`,
       plus `variant` and `size` (required, no defaults).
       - iOS: `AppButton(_ label: String, variant: ButtonVariant, size: ButtonSize, leadingIcon: Image? = nil, fullWidth: Bool = false, enabled: Bool = true, loading: Bool = false, action: @escaping () -> Void)`
         built as a SwiftUI `Button` with a `ButtonStyle`.
       - Android: `AppButton(label: String, variant: ButtonVariant, size: ButtonSize, action: () -> Unit, modifier: Modifier = Modifier, leadingIcon: Painter? = null, fullWidth: Boolean = false, enabled: Boolean = true, loading: Boolean = false)`.
     - Look: only from `AppTheme`'s `ButtonSpec.appearance(variant, size, state)`; colours resolved
       through `AppColors[role]`; ring = `borderColor` at `borderWidth`; pressed overlay =
       `overlayColor`; shape radius `rounded`; min height `height`; padding top/end/bottom/start.
     - Displayed state, first match wins (contract): `loading` if loading, else `disabled` if not
       enabled, else `pressed` or `focused` from the platform interaction, else `enabled`. Focused is
       the enabled look plus the focus ring (`appearance.focusRing`: width and offset, colour role
       `focus`, following the pill's corners, drawn outside the button).
     - Disallowed variant × size (appearance nil for `enabled`): the button renders nothing, on both apps.
     - Loading (contract `accessibility.busy`): label stays; a spinner in the leading-icon slot in
       `spinnerColor`, else `textColor`; enabled colours kept, never greyed; stays focusable; every
       activation (tap, keyboard, assistive) is ignored while loading; announced busy with the state
       text "Loading" (see Parity table).
     - Disabled: not activatable, announced disabled, `disabled` look (never opacity alone).
     - leadingIcon: the slot only, no icon files (C02 icons are not built). The icon is decorative
       (hidden from the screen reader), tinted `textColor`, sized and spaced as P1 below.
     - fullWidth: true fills the available width; false hugs the label. Labels wrap, never truncate;
       `height` is a minimum.
     - Touch target: at least 44 × 44 pt on iOS, 48 × 48 dp on Android, for every size (small 36 too).
     - Pressed transition: `AppMotion.Press` duration and easing; none under Reduce Motion (iOS
       `accessibilityReduceMotion`; Android follows the system animator scale).
  4. **Previews**, in the file next to `AppButton`:
     - State grid: one cell per `ComponentGallery.button` entry, in generated order, label
       `ComponentGallery.buttonLabel`, each cell tagged with `entry.testId`; once in light and once in
       dark. Forced states (pressed, focused, loading, disabled) are drawn through an internal face view
       (`AppButtonFace` on both apps) that renders a given `ButtonAppearance`, which `AppButton` also uses.
     - Playground: live controls for variant, size (only the sizes the variant allows), enabled,
       loading, fullWidth and label text. iOS `#Preview` with `@Previewable @State`; Android
       `@Preview` using `remember { mutableStateOf(...) }`, used in Android Studio interactive mode.
  5. **Home adoption** (owner: yes; straight swap, no new UI, strings unchanged):

     | Button           | Visible string     | iOS today                              | Android today                    | Becomes                                    | Id (a11y id == testTag) |
     | ---------------- | ------------------ | -------------------------------------- | -------------------------------- | ------------------------------------------ | ----------------------- |
     | Retry (version card, failed state) | "Retry" | `Button("Retry")`               | `TextButton`                     | `primary-outline`, `compact`, no icon       | `retry-button`          |
     | Force test crash (debug tools only) | "Force test crash" | `Button(role: .destructive)` | `OutlinedButton`        | `destructive`, `medium`, no icon            | `debug_force_crash`     |

     Android gains `HomeTestTags.RETRY_BUTTON = "retry-button"` on Retry so the id matches iOS (it
     has none today). Retry keeps `Task { await model.retry() }` on iOS and `onRetry` on Android.
  6. **iOS housekeeping:** delete `Sources/DesignSystem/DesignSystemModule.swift` and
     `tests/DesignSystemTests/DesignSystemSmokeTests.swift`; `apps/ios/Packages/Features/Package.swift`
     adds `.package(path: "../DesignSystem")` and the `DesignSystem` product to `HomeFeature` only.
  7. **Android module switch:** `apps/android/core/designsystem/build.gradle.kts` plugin
     `aistylist.jvm.library` → `aistylist.android.library.compose`, `namespace =
     "app.aistylist.core.designsystem"`, dependencies from existing catalog entries only (compose BOM,
     `ui`, `material3`, `ui-tooling-preview`, debug `ui-tooling`; tests `junit4`, `robolectric`,
     `ui-test-junit4`, debug `ui-test-manifest`, plus the espresso constraint block of
     `feature/home/build.gradle.kts`). `AiStylistTheme` removed: `MainActivity.kt` uses `AppTheme`,
     `app/src/main/kotlin/app/aistylist/app/ui/theme/Theme.kt` deleted, the `themes.xml` comment
     names `AppTheme` (window theme `Theme.AiStylist` stays). `ALLOWED_MODULE_EDGES` adds
     `:core:designsystem` to `:app` and `:feature:home`. Lockfiles and
     `gradle/verification-metadata.xml` change only through `just android-deps-lock`; on this Mac
     that run also records the missing macOS aapt2 checksum (AI-33), which is expected in the diff.
- Acceptance criteria:
  - AC-1 iOS builds, lints and tests — proof: `just ios-check` → exit 0 on the Mac (simulator build
    and tests included), `DesignSystemTests` listed.
  - AC-2 Android builds, lints and tests — proof: `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-check`
    → exit 0, `checkModuleGraph: <N> edges, all allowed` with N two higher than at d3a4fa0.
  - AC-3 no enum redeclared — proof: `rg -n 'enum (class )?(ButtonVariant|ButtonSize|ButtonState)' apps/ios/Packages apps/android --glob '!**/generated/**' --glob '!**/build/**'` → no hits.
  - AC-4 no literal style values in the hand-written layer — proof:
    `rg -n 'Color\(red:|Color\(0x|0x[0-9A-Fa-f]{6,8}|cornerRadius: [0-9]|padding\([0-9]|[0-9]+\.(dp|sp)\b' apps/ios/Packages/DesignSystem/Sources/DesignSystem apps/android/core/designsystem/src/main --glob '!**/generated/**'`
    → no hits (each exception listed with file:line and reason in the report; none expected).
  - AC-5 `AiStylistTheme` gone — proof: `rg -n 'AiStylistTheme' apps/android --glob '!**/build/**'` → no hits.
  - AC-6 fonts identical — proof: `shasum -a 256` of the six font and licence paths below equals the Fonts table.
- Non-goals: icon files or the C02 icon set; snapshot / golden tests (AI-190); the S3 brand scheme;
  the full M3 `ColorScheme` / `Typography` / `Shapes` mapping and the token swap of Home's
  non-button literals (rest of AI-186 / AI-188); the debug gallery screen (AI-195); lint bans
  (AI-191); any change to strings, copy or layout.
- Search done (lead, 2026-10-20): `rg -n 'ComponentAPI|ComponentApi|ButtonVariant|ComponentGallery|AppTheme|AiStylistTheme' apps tools`
  → the generated files above, `AiStylistTheme` in `MainActivity.kt:14,33`, `ui/theme/Theme.kt:11`,
  `themes.xml:3`; no hand-written button, theme or font code on either app. Siblings to copy:
  `apps/ios/Packages/Features/Package.swift` (product/target pattern),
  `apps/android/feature/home/build.gradle.kts` (Compose library block),
  `apps/android/feature/home/src/test/kotlin/app/aistylist/feature/home/HomeScreenTest.kt` (Robolectric).

## Prerequisite before launch

- **P1 — leading-icon size and gap tokens: DONE (commit 005ef40).** The shared button size entries in
  `DESIGN.md` carry `iconSize` / `iconGap` (20/8 at large, card, medium and small; 18/6 at compact),
  and every merged look exposes them as `ButtonAppearance.iconSize` / `iconGap` (Swift `Double`, Kotlin
  `Double`, in points / dp). The leading icon and the loading spinner both use this slot. Lanes read
  only `appearance.iconSize` / `appearance.iconGap` and never type the values.

## Fonts (identical bytes on both apps)

Source: google/fonts, files fetched unmodified with the GitHub contents API (raw); git blob SHAs equal
upstream. OFL 1.1, no Reserved Font Name. Each font has its own copyright line, so each ships its own
licence file (renaming a file is not a modification of the font).

| File (iOS: `apps/ios/Packages/DesignSystem/Sources/DesignSystem/Resources/Fonts/`) | Android path (`apps/android/core/designsystem/`) | Source (ref) | sha256 |
| --- | --- | --- | --- |
| `Figtree-Variable.ttf` | `src/main/res/font/figtree_variable.ttf` | `https://github.com/google/fonts/blob/a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/Figtree%5Bwght%5D.ttf` | `26ad3db9b31ff7dde67a91ff515d022d2f495cd506590699cf264f0bfe6fb714` |
| `YoungSerif-Regular.ttf` | `src/main/res/font/young_serif_regular.ttf` | `https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/youngserif/YoungSerif-Regular.ttf` | `42bb2602364b28569fdce5eeb6ab3d81cf8090ba81b211f1229ed69f33155523` |
| `Figtree-OFL.txt` | `licenses/Figtree-OFL.txt` | `.../a60a77e14f28abd4ef243a1b5dfc48df0cec5205/ofl/figtree/OFL.txt` | `140d37233e7f3ce7313798befa9600893bcceaf41a55fa0fa5ad52f7f657a268` |
| `YoungSerif-OFL.txt` | `licenses/YoungSerif-OFL.txt` | `.../8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/youngserif/OFL.txt` | `737d8d343b674c6894f373de71a044b6782c130f2aebf180933d63ddf7a3dc19` |

Upstream projects: Figtree `https://github.com/erikdkennedy/figtree` (google/fonts imports commit
032dfa7), Young Serif `https://github.com/noirblancrouge/YoungSerif` (commit d307c79). Each lane
records this table in its README (`apps/ios/README.md`, `apps/android/README.md`) and hands the OFL-1.1
line for `docs/security/licenses.md` to the lead under `Noticed but not touched:`.

## Entry point and navigation

- iOS: `AppButton` is reached by `HomeScreen` (`apps/ios/Packages/Features/Sources/HomeFeature/HomeScreen.swift`);
  the theme is applied in `apps/ios/App/AIStylistApp.swift`. Previews in Xcode.
- Android: `AppButton` is reached by `HomeScreen.kt` in `:feature:home`; the theme is applied in
  `MainActivity.kt` `setContent`. Previews in Android Studio.
- Doc 02 §2.1 tab or route: N/A — no new screen or route.

## Contract

- Operations: none.
- Contract lane changes: none.
- Analytics events: none.
- Registry values: none.
- Kernel wiring: none.

## Parity table (identical on both apps; each lane reports against it)

| State    | Trigger                                   | Exact visible strings | Id (a11y id == testTag)                        | Analytics event | Operation | Error → this state |
| -------- | ----------------------------------------- | --------------------- | ---------------------------------------------- | --------------- | --------- | ------------------ |
| enabled  | `enabled` true, `loading` false, idle     | `{label}`             | gallery: `ButtonTestId` per cell; Home: below  | —               | —         | —                  |
| pressed  | finger / pointer down on an enabled button | `{label}`             | as above                                       | —               | —         | —                  |
| focused  | keyboard / Full Keyboard Access / D-pad focus | `{label}`         | as above                                       | —               | —         | —                  |
| disabled | `enabled` false and `loading` false        | `{label}`             | as above                                       | —               | —         | —                  |
| loading  | `loading` true (wins over every other state) | `{label}`; spoken state "Loading" | as above                           | —               | —         | —                  |
| empty    | N/A — a button has no empty state         | —                     | —                                              | —               | —         | —                  |
| offline  | N/A — the button does no I/O              | —                     | —                                              | —               | —         | —                  |

- Gallery: 100 cells, order exactly `ComponentGallery.button`, label "Continue", ids
  `ds-button-<variant>-<size>-<state>` from the entry; light grid then dark grid.
- Home ids and strings: "Retry" → `retry-button`; "Force test crash" → `debug_force_crash`.
- Activation: `action` runs once per activation only in `enabled` / `pressed` / `focused`; never in
  `disabled` or `loading`.
- Accessibility: role button, accessible name `{label}`; loading exposes the state text "Loading"
  and stays enabled to assistive tech; disabled is announced disabled; leading icon hidden; targets
  44 pt / 48 dp; Dynamic Type / font scale 200 % wrap the label without clipping; Reduce Motion
  removes the press animation. Consent: N/A — no analytics.

Tests (no snapshot tests; AI-190 owns them):

- iOS, Swift Testing in `apps/ios/Packages/DesignSystem/tests/DesignSystemTests/` (no rendering):
  every `ButtonVariant` × `ButtonSize` pair resolves an appearance exactly when the pair occurs in
  `ComponentGallery.button`, and `AppButton`'s resolver returns nil otherwise; the state precedence
  rule; the activation gate runs the action when enabled and ignores it when loading or disabled;
  every gallery `testId` equals `ds-button-<variant.rawValue>-<size.rawValue>-<state.rawValue>` and
  the 100 ids are unique; both font files register and the families "Figtree" and "Young Serif" resolve.
- Android, Robolectric Compose tests in `apps/android/core/designsystem/src/test/kotlin/app/aistylist/core/designsystem/`
  (`@Config(sdk = [37])`, as `HomeScreenTest`): a click while loading does not call `action`, the
  label is still displayed and the state description is "Loading"; a disabled button
  `assertIsNotEnabled` and a click does not call `action`; `Modifier.testTag(id)` is found by
  `onNodeWithTag`; a disallowed variant × size emits no node; touch target ≥ 48 dp for every size;
  `AppTheme.typography` uses the bundled families, never `FontFamily.Default`. `GeneratedTokensTest`,
  `HomeScreenTest` and `HomeViewModelTest` stay green.

## Lanes

| Lane    | Agent            | Isolation | Scope | Files expected | Sibling to copy | Checks |
| ------- | ---------------- | --------- | ----- | -------------- | --------------- | ------ |
| iOS     | ios-engineer     | worktree  | apps/ios/** | `Packages/DesignSystem/Package.swift`; `Sources/DesignSystem/{AppTheme,AppFonts,AppButton,AppButtonFace,AppButtonPreviews}.swift` (names may vary, one type per file); fonts already present under `Sources/DesignSystem/Resources/Fonts/`; `tests/DesignSystemTests/*`; delete `DesignSystemModule.swift` + `DesignSystemSmokeTests.swift`; `Packages/Features/Package.swift`; `HomeFeature/HomeScreen.swift`; `App/AIStylistApp.swift`; `project.yml`; `README.md` | `Packages/Features/Package.swift`, `HomeScreen.swift`, `tests/HomeModelTests` | `just ios-check` on the Mac |
| Android | android-engineer | worktree  | apps/android/** | `core/designsystem/build.gradle.kts`; `core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/{AppTheme,AppFonts,AppButton,AppButtonFace,AppButtonPreviews}.kt`; fonts already present under `src/main/res/font/` and `licenses/`; `core/designsystem/src/test/kotlin/.../AppButtonTest.kt`; `core/designsystem/gradle.lockfile` + other lockfiles + `gradle/verification-metadata.xml` (only via `just android-deps-lock`); `RootConventionPlugin.kt` edges; `app/build.gradle.kts`; `MainActivity.kt`; delete `ui/theme/Theme.kt`; `themes.xml` comment; `feature/home/build.gradle.kts`; `HomeScreen.kt`; `README.md` | `feature/home/build.gradle.kts`, `HomeScreen.kt`, `HomeScreenTest.kt` | `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just android-check` |
| API     | N/A — no endpoint | — | — | — | — | — |
| e2e     | N/A — `e2e/smoke.yaml` unchanged; its strings stay byte-identical | — | — | — | — | — |

Notes for the lanes:

- Neither lane reads the other app's sources; parity comes from the generated files, the contract and
  this brief.
- `justfile` stays unchanged: `:core:designsystem:test` still resolves on an Android library (it
  runs every variant's unit tests); dropping it from `justfile` lines 463, 485 and 493 is a later
  tooling-engineer clean-up, not part of this lane.
- Human-applied doc texts (rules, skills, `docs/security/licenses.md`) go under `Noticed but not touched:`.

## Intended differences

- Test ID attachment — iOS `.accessibilityIdentifier(id)` applied by the caller; Android
  `modifier = Modifier.testTag(id)` (Compose convention: every component takes `modifier`) —
  platform idiom — accepted by the lead on 2026-10-20.
- Icon parameter type — iOS `Image?`, Android `Painter?` — platform idiom — lead, 2026-10-20.
- Theme plumbing — iOS environment value + `.appTheme()` modifier; Android `AppTheme {}` composable
  with `CompositionLocal`s — platform idiom — lead, 2026-10-20.
- Touch target — 44 pt iOS, 48 dp Android — `DESIGN.md` Layout and the contract — owner (DESIGN.md).
- Spinner — iOS `ProgressView` (circular), Android `CircularProgressIndicator`, each at the slot size
  in the resolved colour, platform stroke — platform idiom — lead, 2026-10-20.
- Busy announcement — iOS `accessibilityValue("Loading")`, Android `stateDescription = "Loading"` —
  platform accessibility API — lead, 2026-10-20.
- High-contrast trigger — iOS Increase Contrast; Android high-contrast text on API 36+ only (off
  below) — available public APIs — lead, 2026-10-20.
- Android keeps the stock M3 light/dark `ColorScheme` under `AppTheme` for non-button components
  until the full mapping lands; iOS keeps system styles likewise — no visual change in this work —
  lead, 2026-10-20.
