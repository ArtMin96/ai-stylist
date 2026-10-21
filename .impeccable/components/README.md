# Component contracts

One YAML file per base component, `<id>.yaml`, owned by `ui-designer` (ADR-0011 follow-up 7, DEC-87).

The contract is the master for a component's API, as the `DESIGN.md` frontmatter is the master for its values. It says what the component accepts (props), which variants, sizes and states exist, which combinations are allowed, which `DESIGN.md` component tokens style each one, its accessibility, its gallery and its test IDs. It never holds a value: no colour, size, spacing or duration, only references to `DESIGN.md`.

Each component is written natively twice, by `ios-engineer` and `android-engineer` in parallel, and neither lane reads the other's code. Parity comes from three generated inputs: the tokens (from `DESIGN.md`), this contract, and the component API surface the generator emits from it for each platform (the variant, size and state enums, the test-ID constants and the gallery list). Both lanes build against that generated surface.

Examples: `button.yaml` (`AppButton`, canvas board C01), a control contract; `icon.yaml` (`AppIcon`, canvas board C02), an icon set (see "Icon sets" below); `chip.yaml` (`AppChip`), `tag.yaml` (`AppTag`), `badge.yaml` (`AppBadge`) and `reason-row.yaml` (`AppReasonRow`), all on C03 and approved 2026-10-21, are control contracts that also use the proposed fields below ("Proposed fields": G2, G4, G7, G8, G10 and the contract-side `parts` of G12), which the generator does not read yet (it checks G4's `icons` only by shape, to find the icon slots).

## Fields

These are the fields of a control contract (no `kind`, as `button.yaml`). An icon set has its own fields, under "Icon sets". All fields are required unless marked optional.

- `id`: kebab-case, equal to the file name without `.yaml` (`button`).
- `board`: the canvas board on page 3 of "Garderi App UI" (`C01` … `C10`).
- `name`: the public type name, matching `^App[A-Z][A-Za-z]+$` (`AppButton`). Never "Garderi" (DEC-87 D6; no product name in code until AI-182).
- `props`: a list of `{ name, type, required | default }`. `name` is lowerCamelCase. `type` is one of `string`, `bool`, `icon`, `action`. A prop has either `required: true` or a `default`; `default: null` means optional and absent unless passed.
- `variants`, `sizes`, `states`: lists of kebab-case ids. State ids must be valid identifiers on both platforms: `enabled`, never `default`.
- `combinations`: for each variant, its allowed `sizes` and `states`. Every pairing of the listed sizes and states is allowed; anything not listed is invalid, and the generated API must not offer it.
- `tokens`: for each variant, `base`, `states` and `sizes`, each value a reference `{components.<base-name>}`.
  - The base name is the component key without its theme suffix: `button-primary-light` and `button-primary-dark` → `{components.button-primary}`.
  - Every reference must exist in the `DESIGN.md` frontmatter `components`, either as a `-light` / `-dark` twin pair or as one key without a suffix that serves both themes (`button-medium`).
  - `states` lists only the states that change a colour or the label style. A state that changes one but has no token yet is written as a comment and proposed to the owner; a contract never points at a token that does not exist.
  - `sizes` names the entry that holds each size's height and padding: the base for the variant's own size, otherwise the shared size entry (buttons: `button-large`, `button-card`, `button-medium`, `button-compact`, `button-compact-filled`, `button-text-compact`, `button-small`; chips: `chip-medium`; tags: `tag-plan`; badges: `badge-large`).
  - Entry properties beyond fill, text and type are listed under "Entry properties" below: `borderColor` is a ring drawn inside the shape (its width is `<id>-outline-ring`: `button-outline-ring`, `chip-outline-ring`, `tag-outline-ring`, `badge-outline-ring`, `reason-row-outline-ring`), `spinnerColor` is the loading spinner when it is not the label colour, and `iconColor` is the leading icon's tint when it is not the label colour.
  - An entry's dimensions may point at a shared scale (see "Scale references" below): `iconSize` names an icon step by its bare key (`icon-md`), and padding and gap parts name spacing steps.
  - **G3. Trailing icon slot.** A component entry may hold `trailingIconSize` (an icon step key, as `iconSize`) and `trailingIconGap` (a dimension or `{spacing.<key>}`). TK-06 and TK-11: a property named `iconSize` or ending in `IconSize` names an icon step. CC-08 and CC-12 apply to the trailing slot of every size where an allowed look draws a trailing icon (G4). The merged look gains the optional `trailingIconSize` (the icon size enum) and `trailingIconGap`; `trailingIconColor` (a colour role) tints it, else the label colour.
  - **G5. An entry's own `borderWidth` wins** over `<id>-outline-ring`'s width, which becomes the default for a ringed look (the never-suggest chip's pressed 2 px, the override chip's 1.5 px).
  - **G6. A variant's own slot values win.** `iconSize`, `iconGap`, `trailingIconSize` and `trailingIconGap` on a variant's base or state entry win over the shared size entry `<id>-<size>`, which stays the default (the group and sort chip's gaps of 6 at 36, where `chip-medium` has 4).
  - **G11. A slot entry only where an icon is drawn.** CC-08 asks for `<id>-<size>` and its `iconSize` / `iconGap` only for sizes where an allowed look draws a leading icon (G4), and for its trailing slot only where one draws a trailing icon (the 18 Differs tag and the 8 and 18 badges draw none). A contract without `icons` (the button) draws the leading slot at every size and no trailing slot.
  - **G13. Dashed rings.** An entry with `borderDash` (a dimension) draws its `borderColor` ring dashed, with dashes and gaps of that length (3 px on the provisional tag, as its icon's 3 / 3 dash). TK accepts it today as a dimension; the native lanes draw it.
- `accessibility`:
  - `role`: the semantic role (`button`).
  - `label`: the accessible name, as a `{props.<name>}` reference.
  - `busy` (optional, G1): the busy state (`loading`), with this behaviour on every variant (owner 2026-10-20). The label stays and a 20 spinner shows in the leading-icon slot. The component ignores every activation (tap, keyboard, assistive) until the state ends, so a request cannot be sent twice. It keeps its enabled colours, is never greyed out or announced as disabled, stays focusable and is announced as busy.
  - **G1. `accessibility.busy` is optional.** Present: it names a state (CC-07), as today. Absent: the component has no busy state (no chip, tag, badge or reason row has one).
  - `minTouchTarget: { ios: <pt>, android: <dp> }`: from `DESIGN.md` "Layout" → Touch targets (44 pt, 48 dp).
  - **G9. `minTouchTarget` is optional when no role is interactive** (`text`, `region`, `decorative` only), and such a contract has no `action` prop. CC: an interactive role (`button`, `toggle`, `radio`, `selectable`, `disclosure`, `menu`) needs `minTouchTarget` and an `action` prop. Any role outside `text`, `region` and `decorative` counts as interactive.
- `gallery`: `title`, the section name in the component gallery, words of letters and digits joined by single spaces (`Buttons`); the generator shows it as `<board> <title>` with a kebab-case slug (`C01 Buttons`, `c01-buttons`). `label`, a synthetic string (never real user data), and `include`: `all` (every allowed combination) or an explicit list of `{ variant, size, state }`.
- `testId`: exactly `ds-{component}-{variant}-{size}-{state}`, for example `ds-button-primary-large-enabled`. It is the iOS `accessibilityIdentifier` and the Android `testTag`, the same literal on both.
- `approved`: `pending`, or the date (`yyyy-mm-dd`) the owner approved the contract in chat. `ui-designer` writes it when the lead relays the owner's words. Silence is not approval, and neither is an agent's own opinion.

Comments may explain a choice (usage rules, a token gap, a board-versus-screen choice, a question still open for the owner); they never add a field.

## Scale references

A `DESIGN.md` component entry (`components.<name>`) points at a shared scale instead of repeating its number (owner 2026-10-21):

- An icon slot (`iconSize`) names an icon-scale step with the bare key `icon-<step>` (`iconSize: icon-md`), never a `{components.…}` reference (the pinned design.md lint, TK-12, rejects those) and never a number. The generated look types it as the icon size enum (`AppIconSize`).
- CC-12: once an icon set (`kind: icon-set`) exists, every icon slot in use must name one of that set's `sizes`; a number, or a key outside `sizes`, is a finding.
- A `padding` or `iconGap` part that equals a `spacing` step names it: `iconGap: '{spacing.8}'`, `padding: '0 {spacing.24}'`. A shorthand may mix references, `0` and px literals: `padding: '{spacing.12} {spacing.4} {spacing.12} 14px'`.
- A value that is not on a scale stays a literal: heights (52, 44, 36), widths and sizes, and off-scale parts (`iconGap: '6px'`, `padding: '0 10px'`). It is never snapped to a step without the owner.
- Typography (`'{typography.<style>}'`), colour (`'{colors.<role>}'`) and radius (`'{rounded.<step>}'`) references stay as they are.

The generated numbers are the referenced step's value, so moving a literal to its reference never changes what the apps draw.

## Proposed fields

The chip, tag, badge and reason-row contracts (C03) need these fields and rules, and are written with them (owner 2026-10-21: "I don't want to left anything behind"). The generator does not read them yet, so those four files fail CC-01 until `tooling-engineer` implements them. Each item is the exact shape to implement: the schema (`component-contract.schema.json`), the rules (TK, CC) and the emitted API. Once implemented, each moves into "Fields" above.

- **G2. Compound toggle states.** A state id `<toggle>-<interaction>` joins a toggle (`selected`, `expanded`) and an interaction (`pressed`, `focused`, `disabled`): `selected-pressed`, `selected-focused`, `selected-disabled`, `expanded-pressed`, `expanded-focused`. The `DESIGN.md` key is `<component>-<toggle>-<interaction>-<scheme>` (`chip-choice-selected-pressed-light`); `syntax.mjs` `STATES` gains the five compounds and `splitState` matches the longest suffix first. In `tokens.<variant>.states` a compound names that state of the base or an overlay (`selected-focused: '{components.focus-ring}'`). The merge for a compound is: base, then the toggle's entry, then the compound's entry (or overlay), then size, then slot. CC-03: a compound is allowed only where its toggle is. The test ID carries the compound (`ds-chip-choice-large-selected-pressed`). The state shown, first match wins: disabled, pressed, focused, none; prefixed with the toggle while it is on.
- **G4. `icons`.** A map from variant to `{ leading, trailing, states }`. `leading` and `trailing` are an icon-set glyph id (`check`), a `'{props.<name>}'` reference to an `icon` prop, or `null`; `states.<state>` overrides them for that state, and a toggle state's icons apply to its compounds. CC: every glyph id is in the icon set's `glyphs`; every referenced prop is an `icon` prop. The merged look gains `leadingIcon` and `trailingIcon`, each an optional `<Name>IconSource` (`.glyph(AppIconName)` or `.prop`).
- **G7. Accessibility per variant.** `accessibility.role` is the default and `accessibility.roles` (optional) maps a variant to its own. Role values: `button`, `toggle`, `radio`, `selectable` (toggle or radio by `accessibility.selection`), `disclosure` (expanded or collapsed), `menu` (opens a list), `text`, `region`, `decorative` (hidden; the host names it). `accessibility.selection` (optional, required when a role is `selectable`): `'{props.<name>}'`, an `enum` prop with the values `multiple` (toggle) and `single` (radio). `accessibility.labelOverride` (optional): `'{props.<name>}'`, a string prop that replaces `label` as the accessible name when it is passed. The generated spec gains `<Name>Role` and `role(variant:)`.
- **G8. Prop types and per-variant props.** `type` adds `enum` (with `values`, a list of kebab-case ids; `default` is one of them; the generator emits `<Name><Prop>`, for example `AppChipSelection`), `color` (a runtime colour from data, never a token: the swatch) and `colorRole` (one of `AppColorRole`: the badge's host surface). `variants` (optional) limits a prop to the variants listed; `required: true` then means required for those variants. CC: every listed variant exists.
- **G10. `gallery.props`** (optional): a synthetic sample per prop for the gallery cells. An `icon` prop takes a glyph id, a `color` or `colorRole` prop a `'{colors.<role>}'` role reference (resolved per context; a fixed role such as `camera-ink` is the same in every scheme), a `string` prop text, an `enum` prop one of its values. Never real user data.
- **G12. `parts`.** A list of runs beside the label, each `{ name, kind, position, separator?, color?, icon?, variants? }`. `kind`: `text` (filled by the `string` prop `name`), `swatch` (filled by the `color` prop `name`), `dot` (no prop) or `ring` (no prop, coloured by `color`). `position`: `before-label`, `after-label`, `line` (its own line under the label, in list order) or `outside` (a ring round the shape). `separator`: copy drawn before the part's text, identical on both apps (`'· '`). `color`: `'{props.<name>}'`, a `colorRole` prop (rings). `icon: leading`: the variant's leading icon opens this part's line instead of the label's. `variants` limits the part. The entry properties each kind reads are under "Entry properties". CC: each part's prop exists with the right type; the merged look carries the part's properties like any other.

## Entry properties

Beyond fill (`backgroundColor`), text (`textColor`), type (`typography`), shape (`rounded`), size (`height`, `width`, `size`, `minWidth`), `padding` and the icon slot, a `DESIGN.md` component entry may hold these. Colour properties name a colour role; dimensions are px or `{spacing.<key>}`.

- Ring: `borderColor` (inside the shape), `borderWidth` (G5), `borderDash` (G13); `outerRingWidth`, a ring outside the shape in the colour of the `ring` part's prop (the count badge's 2 px in the host surface).
- Pressed tint: `overlayColor`, laid over the fill and under the content.
- Icons: `iconColor` (the leading icon), `trailingIconSize`, `trailingIconGap` (G3), `trailingIconColor`; `iconDiscSize`, `iconDiscColor` (a circle behind a line's leading icon: the reason row's fact).
- Text parts (G12): `<part>Typography`, `<part>Color`, `<part>Gap` (the space before the part on its line); `lineGap` (the space between the label and each `line` part).
- Swatch part (G12): `swatchSize`, `swatchGap` (to the label); `swatchEdgeColor`, `swatchEdgeWidth`, drawn inside the swatch when its contrast with the fill is below `swatchEdgeMinContrast` (a number, 3); `swatchRingColor`, `swatchRingWidth`, `swatchRingGap`, a ring outside the swatch that far from it (selected: surface 1.5 at 0; disabled: divider 1 at 1.5).
- Dot part (G12): `dotSize`, `dotGap`; the dot takes the label colour.
- `spinnerColor`: the loading spinner when it is not the label colour.

## Icon sets

`kind: icon-set` marks a contract that defines a set of glyphs instead of a control (`icon.yaml`, canvas board C02). An icon has no props, variants, combinations or interaction states: the generator emits a name enum and a path table, and each app draws every glyph with one view that takes a name and a size. The fields, all required:

- `id`, `board`, `name`, `approved`: as for a control contract (`icon`, `C02`, `AppIcon`).
- `kind`: `icon-set`. A contract without `kind` is a control contract.
- `accessibility.role`: `decorative`. The icon is hidden from screen readers; the host control, or the words beside the icon, carry the name.
- `gallery.title`: as for a control contract (`Icons` → `C02 Icons`, slug `c02-icons`). The gallery shows every glyph, and each glyph's test ID is `ds-icon-<id>`, the same literal on both apps. An icon set has no `label`, `include` or `testId` field.
- `sizes`: the icon scale, the steps the set may be drawn at, each the name of a `DESIGN.md` token `components.icon-<step>`: `icon-xs`, `icon-sm`, `icon-md`, `icon-lg`, `icon-xl`, `icon-hero` (owner 2026-10-21). Each token holds `size` and `strokeWidth`. The stroke is in viewBox units, so the drawn width is `strokeWidth × size / 24`. The size is the one at the default text size: icons grow with the user's text size, and the native lanes implement it. The generated size enum drops the `icon-` prefix (`AppIconSize.sm`, Kotlin `SM`). Every icon a screen draws snaps to the nearest step; `DESIGN.md` "Icons (C02)" lists where each use lands.
- `defaultSize`: one of `sizes` (`icon-lg`).
- `glyphs`: the list, in the board's set order, with the icons only the screens draw at the end of each set. Each glyph has:
  - `id`: kebab-case and unique in the set. It becomes the enum case (`chevron-right` → `.chevronRight` / `CHEVRON_RIGHT`).
  - `set`: `navigation`, `actions`, `weather`, `closet`, `status`, `account` or `capture` (the page-8 selfie, avatar and try-on icons).
  - `source`: the canvas board the drawing was taken from: `C02` when the board's own drawing wins, otherwise the screen, prototype, page-8 or component board (`SC05`, `P02`, `SE1`, `C07`).
  - `shapes`: one or more `{ d, paint }`, drawn in order. `d` is SVG path data in the 24 × 24 viewBox. The designer converts every circle, rect, ellipse, line and polyline to one `d` string (starting at 3 o'clock and running clockwise, as SVG draws them) and a dashed stroke to its dash segments, so the generator reads path data only. `paint` is `stroke` (the size's stroke width, round caps and joins), `fill`, or `both`.
- A selected state is its own filled glyph (`heart` and `heart-filled`), never a state of the glyph.
- A glyph never holds a size, stroke width or colour. The tint comes from the host's foreground and the existing colour roles; there is no icon colour token. Where a board draws one icon in two tones (the confidence bars, the busy ring), the contract splits it into glyphs the host layers, and a comment says how.

## Which drawing wins

A component is drawn on its C01–C10 board and used on the screens (canvas page 6), the prototype (page 7) and page 8. Where they disagree, the way the screens and the prototype use it wins (owner 2026-10-20), and the contract records each such choice in a short comment that names the boards and screens. Something the screens draw that no variant, size or state can express is listed as open for the owner, never added silently.

## Adding a component

1. Check first (`ui-prototype-first`, step 1): the component must be drawn on a C01–C10 board and described in `DESIGN.md` "Components". Not there → it is a new component: draw a proposal board and get the owner's approval before writing a contract.
2. Every token the contract needs must already be in the `DESIGN.md` frontmatter. A missing token is a proposal: the owner approves it, then it lands in the frontmatter (and on canvas board R2 when R2 lists that kind of token) in the same change.
3. Write `<id>.yaml` with `approved: pending`, allowing only what the board and the screens draw and `DESIGN.md` describes (see "Which drawing wins").
4. The lead shows the owner; after the owner approves, `ui-designer` writes the date into `approved`.
5. The generator emits the component's API surface for both platforms; both lanes then build the component against it.
6. Changing a contract (a new variant, size, state or prop, or removing one) changes both apps, so it follows the same steps.

## Not a contract

System chrome stays native with brand tint only (DEC-87): the tab bar (the Capture tab included), navigation bars, back behaviour, sheets, alerts, menus, dialogs, pickers, the keyboard, the search field, toggles, sliders, the share sheet, the photo picker, the camera and permission prompts. These get no component contract.
