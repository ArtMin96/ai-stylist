# tools/codegen/tokens: the design-token generator

`DESIGN.md` (repository root, YAML frontmatter) is the only token master (ADR-0011, DEC-86). This
directory turns it into native theme code in the DEC-87 pipeline:

1. **Validate**: the pinned `@google/design.md` 0.4.0 `lint` must exit 0 (TK-12), plus our own rules
   TK-01 to TK-11 below.
2. **Normalise** in memory to the DTCG 2025.10 model plus resolver (`normalise.mjs`). The model is
   never written to the repository (DEC-87 D8).
3. **Emit** Swift and Kotlin in three tiers: reference scales, scheme roles, component tokens
   (`declarations.mjs` decides every name and value once; `render.mjs` lays it out;
   `emit-swift.mjs` and `emit-kotlin.mjs` spell it). See Emitted code.
4. **Gate**: `just generate --check` fails when the committed output differs from a fresh run,
   and `tests/parity.test.mjs` reads both languages' output back into one name-to-value table and
   requires the two tables to be equal.

## Status (Linear AI-189, AI-198, AI-201)

Built: all four stages, with their tests, and the wiring: `tools/codegen/generate.sh` runs
`gen-tokens.mjs` right after the shared-kernel registries, in every lane (it needs only Node), and
`--check` covers both output directories. The repository `DESIGN.md` passes TK-01 to TK-11 and
emits in both languages; the rule, model and emitter tests also run against the synthetic fixture
`fixtures/_valid/DESIGN.md`. The three tier files are committed in both app packages, each
package with a test that reads them (`DesignTokensTests`, `GeneratedTokensTest`).

AI-198 adds the component API surface (Component contracts below): the contract checker, the
merged looks and `ComponentAPI.swift` / `ComponentApi.kt`, emitted by the same run into the same
two directories. Not done: those two files are not committed or compiled inside the app packages
yet (`just generate` writes them; see Emitted code, Gates on the output).

AI-201 adds icon sets (Icon sets below): a contract with `kind: icon-set` (C02), its rules
CC-09 to CC-11, the SVG path compiler and the icon API (`AppIconName`, the sizes, the glyph types)
in the same API file, with the glyph table in a file of its own. The repository has no icon-set
contract yet (`ui-designer` writes `.impeccable/components/icon.yaml`), so the committed output
is unchanged; the fixture `fixtures/contracts/_valid/icon.yaml` exercises the whole path.

## Usage

```bash
node tools/codegen/gen-tokens.mjs --input DESIGN.md                       # validate only
node tools/codegen/gen-tokens.mjs --input DESIGN.md --components .impeccable/components \
  --swift-out <dir> --kotlin-out <dir>
```

It prints every finding as `TK-NN <where>: <message>` (or `CC-NN <file> <field>: <message>` for a
contract) and exits 1, or prints a one-line summary of the model (and one of the contracts) and
exits 0. With `--swift-out` / `--kotlin-out` it then replaces each directory with that language's
three tier files, plus the component API file when `--components` is given (and one glyph-table
file per approved icon set), and prints one line
per directory; nothing is written when any input has a finding. A contract still
`approved: pending` is checked, named on stdout and gets no API. Exit 2 is a usage error.
`DESIGN_MD_BIN` overrides the design.md bin (the tests point it at a stub); by default it is
`node_modules/.bin/design.md` from the root devDependency, never `npx`. `just generate` passes
`.impeccable/components` and the two directories under Files.

## Rules

- **TK-01** The file starts with a YAML frontmatter block that parses (no duplicate keys) into a
  mapping. `colors`, `typography`, `rounded`, `spacing`, `elevation`, `motion` and `components` are
  mappings. No other top-level key besides `version`, `name` and `description`.
- **TK-02** The Twin Rule (`DESIGN.md` "Named Rules") over `colors`, `elevation` and
  `components`: every scheme-suffixed key has its `-light` + `-dark` base, or is named on exactly
  one prose line `Unpaired by design: <token>, …` (tokens may be backticked). A listed token exists
  in one of the three groups and lacks its twin. Suffix-free keys (`scrim`, `camera-ink`) are the
  same in every scheme: they are never paired and never listed.
- **TK-03** No cross-scheme reference: a scheme-suffixed entry references only colours of its own
  scheme or scheme-independent colours; an entry without a scheme suffix references only
  scheme-independent colours.
- **TK-04** A component colour (a `color` or `*Color` property) is a `{colors.<token>}` reference,
  which the model turns into a role key; never a literal. A shadow colour (an `elevation` field
  named `color` or `*Color`) may also be a literal colour (`rgba(27,27,25,0.14)`): shadows are not
  themed roles. A literal colour anywhere else outside `colors` is a finding.
- **TK-05** The scheme variants of one component state (`button-primary-light`, `-dark`,
  `-hc-light`, …) have the same properties. A colour property may name a different role in each
  scheme (a twin keeps the role, not always the tonal step: `chip-never-suggest` is `error-bg` in
  light and `surface-2` in dark). The `-light`, `-dark` and `-brand` variants have the same other
  values; a `-hc-light` / `-hc-dark` variant may change them (S7 draws the focus ring 3 px). A state
  has a scheme-independent entry or scheme variants, not both.
- **TK-06** A `{group.key}` reference resolves, names a single value (not a group, not another
  reference, so there are no alias chains or cycles) and comes from a group allowed there:
  components may reference every group, `elevation` colours, radii and spacing, `motion` other
  `motion` values (`easing: '{motion.easing-enter}'`).
- **TK-07** Every `elevation` and `motion` entry is a single value, or a mapping one level deep of
  single values: no CSS shorthand (`150ms linear`, `0 8px 24px …`), no list.
- **TK-08** Every `typography` entry has exactly `fontFamily`, `fontSize` (px), `fontWeight`
  (1–1000), `lineHeight` (px or a ratio), `letterSpacing` (px or em: `0em`, not `0`),
  `dynamicType` (a SwiftUI `Font.TextStyle`, leading dot optional) and `m3Roles` (a list, may be
  empty).
- **TK-09** Each of the 15 Material 3 type roles (`displayLarge` … `labelSmall`) appears in exactly
  one `m3Roles` list.
- **TK-10** Keys are lowercase kebab-case; colour, typography and component keys start with a
  letter; property names are lowerCamelCase; no two keys generate the same identifier
  (`surface-2` and `surface2`, `padding` and `paddingTop`).
- **TK-11** Values parse: colours `#RRGGBB`, `#RRGGBBAA`, `rgb()` or `rgba()`; radii and spacing
  px or a number; component values px, a number, a `{reference}` or a 1–4 part `padding`;
  durations `ms` or `s`; curves `cubic-bezier()` or `linear`.
- **TK-12** The pinned `@google/design.md` `lint` exits 0. Warnings are allowed, such as the
  accepted `token-like-ignored` for `elevation` and `motion`; its output is shown when it fails.

Key grammar: a colour or component key may end in a scheme suffix (`-light`, `-dark`, `-brand`,
`-hc-light`, `-hc-dark`); a component key may end in a state before that (`-pressed`, `-focused`,
`-disabled`, `-loading`, `-error`, `-selected`, `-expanded`). Every token is treated the same way;
no component is special-cased.

## Component contracts (Linear AI-198)

`.impeccable/components/<id>.yaml` is the master for a component's API (ADR-0011 follow-up 7,
DEC-87; field rules in `.impeccable/components/README.md`). `contracts.mjs` checks each contract;
`contract-model.mjs` merges its looks; `api-declarations.mjs` decides the API's names and values;
`emit-api-swift.mjs` and `emit-api-kotlin.mjs` spell them with the token dialects.

- **CC-01** The YAML parses (no duplicate keys) and matches `component-contract.schema.json`
  (Ajv, draft 2020-12 with ajv-formats, loaded from the `packages/contracts` devDependencies as
  `gen-kernel.mjs` does): every field of the contracts README, `approved` included, nothing else.
  `gallery.title` is required and is words of letters and digits joined by single spaces
  (`Buttons`), so its slug is well defined (fixture `fixtures/contracts/CC-01-gallery-title/`).
  The schema has two closed branches: a contract without `kind` is a control (the button, the
  fields below), and `kind: icon-set` is an icon set (Icon sets); any other `kind` fails
  (`fixtures/contracts/CC-01-icon-kind/`). Ajv's own "must match the then/else schema" error is
  left out, since the branch's errors say what is wrong.
- **CC-02** `id` is the file name without `.yaml`.
- **CC-03** The axes agree: `combinations` names exactly the variants, each allows only listed
  sizes and states, every listed size and state is allowed by some variant, and the ids and test-ID
  constants become distinct identifiers that are no Swift or Kotlin keyword.
- **CC-04** `tokens` has one entry per variant; its `sizes` name exactly the variant's allowed
  sizes, its `states` only allowed states other than `enabled` (the base entry is that look).
- **CC-05** Every `{components.…}` reference resolves in the token model, and the
  `accessibility.label` `{props.…}` names a prop. A whole component wins; otherwise
  `<component>-<state>` names that component's state (owner decision 2026-10-20:
  `{components.button-primary-pressed}` is `button-primary` -> `pressed`).
- **CC-06** Each reference plays its part. A base is a whole component. A state names the same
  state of the variant's base, or a whole component drawn over the enabled look (an overlay:
  `focus-ring`) with an instance in every context of the table. A size is the base itself or a size
  entry (a whole component with no colour and no state). A look with a `borderColor` needs
  `<id>-outline-ring` with a `width`. A merged property has one type in every look.
- **CC-07** `accessibility.busy` is a state, and an explicit `gallery.include` names only allowed
  combinations.
- **CC-08** Every size an allowed combination uses has its shared size entry `<id>-<size>`
  (`button-compact`), and that entry holds the leading-icon slot, `iconSize` and `iconGap`, as
  dimensions in every context of the table. The slot depends on the size only, never the variant
  (`button.yaml` `leadingIcon`, DESIGN.md "Buttons"), so a missing value is a finding, never a
  default.

`iconSize` and `iconGap` are ordinary component properties for TK-11 (px, a number or a
reference, like `height`); the normaliser makes them `dimension` tokens.

The rules run in stages (CC-01; CC-02 and CC-03; CC-04 and CC-07; CC-05; CC-06; CC-08; for an
icon set CC-01; CC-02 and CC-09; CC-10; CC-11) and stop at the first stage with a finding, so each
`fixtures/contracts/CC-NN/` (or `CC-NN-<case>/`) case fails on its own rule only.

**The merge** (owner decision 2026-10-20: one ready look per allowed variant x size x state x
context). For each context of the table (the contexts every base and size entry has, `contextsOf`):
the base entry's properties, then the state entry's, then the size entry's, later overriding
earlier. `enabled`, and a state the variant names no token for (`loading` on primary), is the base
look. A size entry that is the base itself adds nothing: applying it again would undo the state
(the destructive-filled disabled label weight). An overlay state (`focused: {components.focus-ring}`)
changes no colour: it adds a field named after its component that holds that component's instance
for the context (`focusRing = FocusRingTokens.hcDark`). A look with a `borderColor` ring gets
`borderWidth` from `<id>-outline-ring` (`button-outline-ring`, 1.5). Last, every look takes
`iconSize` and `iconGap` from the shared size entry `<id>-<size>`, even where the variant's own
entry holds that size's height and padding (`button-compact-filled`, `button-text-compact`, a
variant base): 18 / 6 at compact, 20 / 8 at large, card, medium and small. The look's fields are colours,
then `borderWidth`, then the other properties, then overlays; a field some look lacks is optional
(`nil` / `null`: no fill, no ring, the spinner takes the label colour). Only allowed combinations
get a look, so a disallowed one is never offered.

## Icon sets (Linear AI-201)

A contract with `kind: icon-set` (`.impeccable/components/icon.yaml`, board C02; the format is in
`.claude/plans/2026-10-20-c02-icons-design-brief.md`) holds `id`, `board`, `name`, `kind`,
`accessibility.role: decorative`, `gallery.title`, `sizes` (each `icon-<n>`), `defaultSize`,
`glyphs` and `approved`, nothing else: no props, variants, states, tokens or `testId`. Each glyph
has a kebab `id`, a `set` (`navigation`, `actions`, `weather`, `closet`, `status`, `account`,
`capture`), the `source` board it was drawn from (`SC05`, `C02`) and a non-empty list of `shapes`,
each SVG path data `d` in the 24 x 24 viewBox with a `paint` (`stroke`, `fill` or `both`). A
filled twin is a glyph of its own (`heart-filled`). `icon-set.mjs` checks it; `svg-path.mjs`
compiles the paths; `icon-declarations.mjs` decides the API's names and values.

- **CC-09** Glyph ids are unique, and become distinct Swift cases, Kotlin entries and nested type
  names that are no keyword (`repeat`, `Type`) and no member the generated enum already has
  (`set`, `test-id`, `glyph`, `rawValue`, `allCases`, `hashValue`).
- **CC-10** `defaultSize` is one of `sizes`, and each size names a `DESIGN.md` component
  `components.icon-<n>` that holds exactly `size` (a px dimension equal to n) and `strokeWidth`
  (a number in viewBox units: the rendered width is `strokeWidth x size / 24`), both literal, with
  no state and the same value in every context.
- **CC-11** Every `d` compiles (below) and draws a line or a curve; the finding names the glyph and
  the first character the grammar rejects
  (`info: cannot compile the path: expected an arc flag (0 or 1) at 12`).

**The path compiler** (`compilePath`). It reads the SVG path grammar: every command, absolute and
relative (`M L H V C S Q T A Z`), numbers that a sign or a second dot separates (`-1.5-2.5.5`),
exponents, comma-whitespace, arc flags written without separators (`a1 1 0 011 1`) and the implicit
lineto after a moveto. It emits only absolute `move`, `line`, `cubic` and `close`: H and V are
lines; S and T mirror the previous control point; a quadratic becomes its exact cubic (controls
2/3 of the way to the quadratic's); an arc becomes one cubic per quarter turn or less (SVG 2
appendix B.2.4: the endpoint-to-centre conversion, radii scaled up when too small, rotation
applied, handles `4/3 tan(step/4)`, the last cubic ending exactly on the end point), a zero radius
a line and an arc to the pen's own point nothing. After `Z` the pen is back at the subpath start,
and a drawing command that follows first emits a `move` there, so both platforms replay the same
path. Every coordinate is rounded to 3 decimals (half up, never `-0`) and spelled by `num`, so the
Swift and Kotlin numbers are the same text.

**The API** (`<Name>` is the contract `name`: `AppIcon`), in the component API file after the
contract's file-name turn:

- `AppIconName`: one case per glyph, in contract order (Swift `String` raw value, written only
  where it differs, + `CaseIterable`; Kotlin `enum class` with `val id`), with `set: AppIconSet`,
  `testId: String` (`ds-icon-<id>`, the iOS accessibilityIdentifier and Android testTag of the
  gallery cell) and `glyph: AppIconGlyph`. Swift spells the three as computed properties switching
  over the cases, Kotlin as constructor fields; a Kotlin entry longer than 120 columns takes one
  argument per line.
- `AppIconSet`: the sets the glyphs use, in first-appearance order.
- `AppIconSize`: one case per `sizes` entry (`icon16`, `"icon-16"`) with `size: Double` (pt/dp)
  and `strokeWidth: Double` (viewBox units) from its token.
- `AppIconMetrics`: `viewBox` (24.0) and `defaultSize`.
- `AppIconGlyph` (`shapes`), `AppIconShape` (`paint`, `segments`), `AppIconPaint` (every schema
  paint), `AppIconSegment` (`command`, `points`: flat x, y pairs, one pair for `move` and `line`,
  three for `cubic`, none for `close`) and `AppIconCommand` (`move`, `line`, `cubic`, `close`).
- `GalleryComponent` gains the icon set's case (`C02 Icons`, `c02-icons`); `ComponentGallery` holds
  only control cells, since the icon gallery reads `AppIconName`.

The glyph table is `AppIconGlyphs`, in its own file (`AppIconGlyphs.swift`, `AppIconGlyphs.kt`):
one nested namespace per glyph holding its one `glyph` value (`AppIconGlyphs.HeartFilled.glyph`),
which `AppIconName.glyph` returns. One namespace per glyph keeps each Kotlin class initialiser to
one glyph, far below the JVM's 64 KB method limit, which one shared initialiser for the whole set
would likely pass (an estimate, not measured: roughly 80 bytes of bytecode per segment and some
3,000 segments for the drawn set). The native `AppIcon(name:size:)` replays the segments, scales `viewBox` to `size` and
strokes at `strokeWidth x size / viewBox`, tinted by its host.

## Model interface

This section is the contract between stages 1–2 and the emitters. An emitter imports only the
exports listed here and reads only the model shape described here. The model is plain JSON-safe
data (no `Map`, no class instances), the same for the same input, and never written to disk
(DEC-87 D8). Every example below comes from the synthetic fixture `fixtures/_valid/DESIGN.md`.

### Exports

- `tools/codegen/tokens/pipeline.mjs`
  - `loadTokens(text)`: DESIGN.md text -> `{ findings }` when anything fails (TK-01 to TK-11), or
    `{ findings: [], model }`. Use this; there is no other way to get a valid model.
  - `formatFinding({ rule, at, message })` -> `'TK-NN <at>: <message>'`.
- `tools/codegen/tokens/normalise.mjs`
  - `resolveColors(model, context)` -> `{ [roleKey]: ColorValue }` with every role of
    `model.roles`, in that order, resolved for one context.
  - `resolveComponents(model, context)` -> `{ [component]: ComponentGroup }` with every component,
    resolved for one context (Component tokens below).
  - `CONTEXT_SOURCES`: each context's source schemes, later overriding earlier (below).
  - `normalise(frontmatter)` builds the model. Call it only on frontmatter that passed `validate`,
    so emitters go through `loadTokens`.
- `tools/codegen/tokens/syntax.mjs` (closed lists, in emission order)
  - `CONTEXTS`: `['light', 'dark', 'brand', 'hc-light', 'hc-dark']`.
  - `STATES`: `pressed`, `focused`, `disabled`, `loading`, `error`, `selected`, `expanded`.
  - `M3_ROLES`: the 15 Compose `Typography` properties, `displayLarge` … `labelSmall`.
  - `DYNAMIC_TYPE_STYLES`: the SwiftUI `Font.TextStyle` cases, `largeTitle` … `caption2`.
- `tools/codegen/tokens/naming.mjs`: every identifier helper (see Naming rules).
- `tools/codegen/gen-tokens.mjs`: the CLI (Usage).

### Values (DTCG 2025.10)

A token is `{ $type, $value }`; typography tokens also carry `$extensions`. A node with an own
`$value` is a token; any other object is a group. `$type` is one of:

- `color`: `{ colorSpace: 'srgb', components: [r, g, b], alpha, hex }`, where `components` and
  `alpha` are 0–1 numbers and `hex` is lowercase `#rrggbb` (alpha not included). Inside a component
  the `$value` is always a role alias string `'{colors.<roleKey>}'` instead; inside `elevation` it
  is that alias or, for a literal shadow colour, the colour value itself.
- `dimension`: `{ value, unit: 'px' }`. `px` is the only unit; numbers may be negative or
  fractional.
- `duration`: `{ value, unit: 'ms' }` (seconds are already converted: `0.3s` -> `300`).
- `cubicBezier`: `[x1, y1, x2, y2]` (`linear` is already converted: `[0, 0, 1, 1]`).
- `number`: a bare number.
- `typography`: the composite under Reference scales.
- An alias is a `$value` string `'{<group>.<key>}'` whose `$type` is the target's type: `{colors.…}`
  is `color` and names a role key; `{typography.…}` is `typography`; `{rounded.…}` and
  `{spacing.…}` are `dimension`; `{elevation.…}` and `{motion.…}` take the target token's type.
  An alias always names a single token, never a group (TK-06).

### Model shape

```text
model.roles                                   [{ key, fixed }]   every colour role, first-appearance order
model.sets.primitives.spacing  .rounded       { key: dimension }
model.sets.primitives.typography              { style: typography }
model.sets.primitives.elevation .motion       { key: token | { field: token } }
model.sets.primitives.colors                  { fixedRoleKey: color }
model.modifiers.theme.contexts.<context>.colors       { roleKey: color }  only what that scheme declares
model.modifiers.theme.contexts.<context>.components   { component: ComponentGroup }  only scheme-dependent values
model.sets.components                         { component: ComponentGroup }  the values every scheme shares
model.resolver   { version: '2025.10', sets: ['primitives', 'components'],
                   modifiers: { theme: { contexts: CONTEXT_SOURCES, default: 'light' } },
                   resolutionOrder: ['primitives', 'theme', 'components'] }
```

Object key order follows the `DESIGN.md` order, and the emitters keep that order. One exception
comes from JavaScript itself: integer-like keys (`'4'`, `'16'`) come first, in ascending numeric
order, wherever they appear in the file.

**Reference scales (tier 1).**

- `spacing` and `rounded`: `{ key: dimension }`. Keys may be numeric strings (`spacing['8']`,
  `rounded['4']`) or words (`rounded.full`).
- `typography`: `{ style: token }` with
  `$value = { fontFamily: string[], fontSize: { value, unit: 'px' }, fontWeight, lineHeight, letterSpacing: { value, unit: 'px' } }`.
  `fontFamily` is the CSS stack split, quotes removed (`['Fixture Serif', 'serif']`). `fontWeight` is
  a number from 1 to 1000. `lineHeight` is a unitless ratio of `fontSize` (`34px` on `28px` ->
  `34 / 28`). `letterSpacing` is in px (`em` is already multiplied by `fontSize`).
  `$extensions['app.dynamicType']` is one `DYNAMIC_TYPE_STYLES` name with no leading dot (`'caption'`).
  `$extensions['app.m3Roles']` is a list of `M3_ROLES` names, possibly empty. Each of the 15 roles
  appears in exactly one style's list (TK-09), so a full Compose `Typography(...)` can always be
  built. A style with `[]` maps to no M3 role.
- `elevation` and `motion`: each entry is a single token, or a group one level deep whose fields
  are lowerCamelCase names holding single tokens (`elevation.sheet.offsetY`,
  `elevation.sheet.color`). There are no shorthands and no lists (TK-07). Tokens are `dimension`,
  `number`, `duration` or `cubicBezier`. In `elevation` they can also be literal shadow colours
  (`color`) or aliases to a colour role, a radius or a spacing. In `motion` they can be aliases to
  another `motion` value, typed as that value (`easing: '{motion.easing-enter}'` is a
  `cubicBezier` alias). Elevation keys keep their scheme suffix (`sheet-light`, `sheet-dark`).

**Scheme roles × 5 contexts (tier 2).**

- `model.roles` lists every colour role in first-appearance order. A `-light` + `-dark` pair is one
  role named by its base, with `fixed: false` (`surface-2-light` + `surface-2-dark` -> `surface-2`).
  Its `-brand`, `-hc-light` and `-hc-dark` keys belong to the same role. Any other colour is a
  fixed role named by its full key, with `fixed: true` (`scrim`, `ring-light`). A fixed role has the
  same value in every context and sits in `primitives.colors`.
- `modifiers.theme.contexts[context].colors` holds only what that scheme declares: `light` and
  `dark` declare every scheme role, while `brand`, `hc-light` and `hc-dark` declare only their
  overrides. Do not read it directly for output.
- `resolveColors(model, context)`, called once for each entry of `CONTEXTS`, is the complete table:
  every role (fixed ones included) in role order, each a `ColorValue`. The fallback chain is
  `CONTEXT_SOURCES`: `light` <- light; `dark` <- dark; `brand` <- dark, then brand;
  `hc-light` <- light, then hc-light; `hc-dark` <- dark, then hc-dark. The default context is
  `light`.

**Component tokens (tier 3).**

- `sets.components` has one group per component, in first-appearance order. The component name is
  the key with its scheme suffix and then its state suffix removed: `button-primary-pressed-dark`
  -> component `button-primary`, state `pressed`. Every component and every declared state appears
  there, possibly as an empty group. Names come from the keys as written and are never inferred
  (owner decision 2026-10-20):
  - A key without its light/dark twin (on the `Unpaired by design:` line) is a component of its
    own, named by its full key and the same in every context, as an unpaired colour is a fixed
    role: `banner-dark` -> component `banner-dark` (`BannerDarkTokens`), never `banner`. The
    emitters give it instances only for the contexts of its scheme (Emitted code).
  - A state suffix names a state only when that component has a default-state key. Otherwise it is
    part of the name: `camera-mode-selected-light` + `-dark` -> component `camera-mode-selected`
    (there is no `camera-mode` key), next to the scheme-independent `camera-mode-switch`. The same
    rule makes `button-action-selected` a component of its own.
- At the top level of a group are the default-state properties, as tokens. Each state from `STATES`
  that the component declares is a nested group (`components['button-primary'].pressed`). That
  group holds only the properties the state overrides, as tokens of the same shapes. A node with an
  own `$value` is a property; any other key is a state.
- Scheme variants are split, the way colours are. A property whose token is the same in every
  scheme variant of its state sits in `sets.components`. A property that differs (TK-05 allows a
  different colour role per scheme and a different high-contrast value) is absent there and sits
  in `modifiers.theme.contexts[scheme].components`, with the same group and state nesting, once for
  each scheme that declares it. A property is in exactly one of the two places.
- `resolveComponents(model, context)`, called once for each entry of `CONTEXTS`, is the complete
  table: the shared tokens, then the context's own values through the same `CONTEXT_SOURCES`
  chain as colours (so `brand` takes the `dark` values it does not declare). In each resolved group
  the shared properties come first, then the scheme-dependent ones. Do not read the theme contexts
  directly for output.
- Colour properties are role aliases (`backgroundColor: { $type: 'color', $value: '{colors.primary}' }`)
  and are never resolved. The emitter turns the role key into an `AppColorRole` reference, and the
  app resolves it against the current context's `AppColors`.
- `padding` never appears. It is expanded into `paddingTop`, `paddingEnd`, `paddingBottom` and
  `paddingStart` (logical start/end, for RTL), each a `dimension`.
- Other properties are aliases (`{typography.label}`, `{rounded.full}`, `{spacing.8}`,
  `{motion.press}`) or literals (`dimension`, `number`).

### Naming rules

Use only the helpers in `naming.mjs`. TK-10 runs the same helpers over the input, which is what
guarantees that no two generated identifiers collide. Any other derivation loses that guarantee.

- Public types (DEC-87 D6): `AppColorRole` (one case per `model.roles` entry), `AppColors` (one
  instance per context), `AppTypography`, `AppSpacing`, `AppRadius`, `AppElevation`, `AppMotion`,
  `AppScaleStep`, and `<Component>Tokens`; with contracts, `GalleryComponent` and the per-contract
  types (Emitted code).
- `memberId(key)` names roles and type styles (`on-primary` -> `onPrimary`, `surface-2` ->
  `surface2`, `ring-light` -> `ringLight`). `memberId(key, group)` names keys of the `spacing`,
  `rounded`, `elevation` and `motion` scales. A key that starts with a digit gets the group prefix:
  `spacing['4']` -> `space4`, `rounded['4']` -> `radius4`; `elevation` and `motion` use their own
  name as prefix.
- `contextId(context)` names the `AppColors` instances: `light`, `dark`, `brand`, `hcLight`,
  `hcDark`.
- `tokensTypeName(component)`: `button-primary` -> `ButtonPrimaryTokens`. `nestedTypeName(key)`
  names a state or an elevation/motion group namespace: `pressed` -> `Pressed`, `sheet` -> `Sheet`.
- Property and field names are already lowerCamelCase (TK-10), so use them verbatim or through
  `propertyIds(prop)`. Never pass them through `camel()`, which lowercases inner words
  (`backgroundColor` -> `backgroundcolor`).
- Kotlin enum entries come from `ktEnumEntry(id)`: `onPrimary` -> `ON_PRIMARY`.
- Reserved words are escaped with `swiftIdent(id)` and `ktIdent(id)`. Literals go through
  `swiftStr`, `ktStr` and `num` (always a floating-point literal: `2` -> `2.0`). Doc comments go
  through `docText`.

### Files

- `tools/codegen/tokens/declarations.mjs`: the model -> one language-neutral declaration tree
  (every name, type and value). `render.mjs` owns order, line breaks and blank lines.
- `tools/codegen/tokens/emit-swift.mjs`: the Swift dialect. `just generate` writes its output to
  `apps/ios/Packages/DesignSystem/Sources/DesignTokens/generated/`.
- `tools/codegen/tokens/emit-kotlin.mjs`: the Kotlin dialect. `just generate` writes its output to
  `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/generated/`.
- `tools/codegen/tokens/component-contract.schema.json`, `contracts.mjs` (`loadContracts`,
  `checkContract`: CC-01 to CC-11), `contract-model.mjs` (the reference grammar, the allowed
  combinations and the merged API model), `api-declarations.mjs` (the API declaration tree) and
  `emit-api-swift.mjs` / `emit-api-kotlin.mjs`: the component API surface, written as
  `ComponentAPI.swift` and `ComponentApi.kt` beside the tier files.
- `tools/codegen/tokens/icon-set.mjs` (CC-09 to CC-11 and the icon-set API model),
  `svg-path.mjs` (`compilePath`: path data to absolute move, line, cubic and close) and
  `icon-declarations.mjs` (the icon declarations and the glyph table): an icon set's part of the
  API file, plus `<Name>Glyphs.swift` / `<Name>Glyphs.kt` beside it.
- `tools/codegen/tokens/tests/parity.test.mjs`: the golden test that the Swift and Kotlin
  name-to-value tables are equal, the component API files, their merged looks and the icon glyph
  table included; `tests/parity-table.mjs` reads the emitted text back into that table.
- New tests go in `tools/codegen/tokens/tests/*.test.mjs`. `scripts/test/design-tokens.test.sh`
  runs that glob; `tests/models.mjs` holds the models the tests share.

The `brand` context falls back to `dark` for every role S3 Viridian does not declare, as the
`DESIGN.md` frontmatter comment above the `-brand` colours states ("The roles S3 does not draw
copy the S2 value"; owner confirmed 2026-10-20).

## Emitted code

Each language gets three files: `ReferenceTokens`, `SchemeTokens`, `ComponentTokens` (`.swift`,
`.kt`), plus the component API file with `--components` (and a glyph-table file per approved
icon set), each with a `GENERATED … DO NOT EDIT` header. Values are plain types only, so the iOS
`DesignTokens` target stays Foundation-free and Linux-testable and the Android `:core:designsystem`
module stays pure JVM: `Double` (pt on iOS, dp/sp on Android), `Int` (font weight), `String`,
`[String]`/`List<String>`, `[Double]`/`List<Double>` (cubic-bezier points), and colours as 32-bit
ARGB (`UInt32`/`Long`, `0xFFFA_FAFA`). The theme code in each app maps them to SwiftUI or Compose.

- Tier 1: `AppSpacing`, `AppRadius`, `AppTypography`, `AppElevation`, `AppMotion` are namespaces
  (Swift `enum`, Kotlin `object`) of constants; a one-level group is a nested namespace
  (`AppElevation.SheetLight.offsetY`, `AppMotion.Sheet.easing`). `AppTextStyle` is a value type
  (`name` = its `DESIGN.md` key such as `title-1`, `fontFamily` = the first family of the stack,
  `lineHeight` as a height, `letterSpacing` in pt/sp, `dynamicType`, `m3Roles`). An alias stays a
  reference (`AppMotion.easingEnter`); a shadow colour is a role or ARGB. For the gallery, each of
  `AppSpacing`, `AppRadius` and `AppTypography` ends with `all`, every entry in model (`DESIGN.md`)
  order: `AppSpacing.all` and `AppRadius.all` are `AppScaleStep(name, value)` lists (`name` the
  key with its group, `spacing-4` … `rounded-full`; `value` a reference to the constant), and
  `AppTypography.all` lists the styles. `all` comes last, so a Kotlin `object` initialises every
  constant before the list reads it.
- Tier 2: `AppColorRole` (one case per role, role order, carrying its `DESIGN.md` role key: Swift
  `String` raw value, written only where it differs from the case, `case surface2 = "surface-2"`;
  Kotlin `val id: String` as the first constructor parameter, `SURFACE2("surface-2", …)`) and
  `AppColors` (one field per role, one instance per context: `light`, `dark`, `brand`, `hcLight`,
  `hcDark`, plus `colors[role]`).
- Tier 3: one `<Component>Tokens` value type per component: its properties, then one field per
  state holding a nested type (`ButtonPrimaryTokens.Pressed`), and one instance per context from
  `resolveComponents` (`ButtonPrimaryTokens.dark.pressed.backgroundColor`). Colour properties are
  `AppColorRole` values; resolve them with the same context's `AppColors`. A component that is the
  same in every context still has five equal instances, so every component is used the same way.
  An unpaired component (named by its scheme-suffixed key) has instances only for the contexts
  that draw from that scheme (`CONTEXT_SOURCES`, owner decision 2026-10-20): `BannerDarkTokens`
  has `dark`, `brand` and `hcDark`, and no `light` or `hcLight`, so a light use does not compile.
- Component API (`ComponentAPI.swift`, `ComponentApi.kt`), per approved contract, `<Name>` from
  its id (`button` -> `Button`; names per D6, no product name): `<Name>Variant`, `<Name>Size`,
  `<Name>State` (Swift `String` raw-value enums, `CaseIterable, Sendable`, the raw value written
  only where it differs from the case: `case primaryOutline = "primary-outline"`; Kotlin
  `enum class` entries with `val id: String`: `PRIMARY_OUTLINE("primary-outline")`);
  `<Name>TestId` (one string constant per allowed combination: `primaryLargeEnabled` =
  `"ds-button-primary-large-enabled"`); `<Name>Appearance` (the merged look: optional colours and
  `borderWidth`, then `typography`, `rounded`, `height`, the four paddings, the non-optional
  `iconSize: Double` and `iconGap: Double` (pt/dp; Kotlin `val iconSize: Double`), then the optional
  `focusRing`); `<Name>Look`
  (variant, size, state, appearance); `<Name>Spec` (`looks`, one instance per context of the table,
  and `appearance(variant:size:state:)` returning that combination's `<Name>Appearance`, or
  `nil` / `null` for a combination the contract does not allow); `<Name>GalleryEntry` (variant, size, state, `testId`). Then
  `GalleryComponent`: one case per approved contract in board order, its id the contract id,
  with `title` (`<board> <gallery.title>`: `C01 Buttons`) and `slug` (the title in lower-case
  kebab: `c01-buttons`); Swift `enum GalleryComponent: String, CaseIterable, Sendable` with
  computed `title` and `slug`, Kotlin `enum class GalleryComponent(val id, val title, val slug)`.
  The galleries switch over it exhaustively, so a new contract fails their build until it has a
  renderer. Then `ComponentGallery`: per contract `<id>Label` (the synthetic `gallery.label`) and
  `<id>` (its entries, each `testId` a reference to the constant). Props stay hand-written in each app (owner
  decision 2026-10-20); no props descriptor is emitted. An icon set emits its own types instead
  (Icon sets: `AppIconName`, `AppIconSet`, `AppIconSize`, `AppIconMetrics` and the glyph types)
  and its glyph table `AppIconGlyphs` in `AppIconGlyphs.swift` / `AppIconGlyphs.kt`.
- Swift: every type is `nonisolated public` (the package defaults to `MainActor` isolation; these
  are immutable `Sendable` values), structs are `Sendable, Equatable` with the memberwise
  initialiser, 2-space indent, 120 columns. Kotlin: package
  `app.aistylist.core.designsystem.generated`, `data class` values with companion instances,
  ktlint_official layout (trailing commas, a multiline value wrapped after its `=`, a list item
  where it stands), 120 columns.

Gates on the output, not run by this pass: the Swift files sit under `apps/ios/Packages`, so
swift-format and SwiftLint lint them, and `swift build` compiles them with warnings as errors; the
Kotlin files are compiled with warnings as errors and checked by Spotless (ktlint), detekt
(`LongParameterList` allows 8 constructor parameters; its `ignoreDataClasses` default is expected
to exempt these data classes, unverified) and Android Lint. A data class constructor
takes at most 255 JVM slots, so `AppColors` (two per `Long`) holds at most 126 roles. The button's
merged table is 100 combinations x 5 contexts = 500 looks (about 12,000 to 13,000 lines per language). On the
JVM all five `ButtonSpec` instances initialise in one companion `<clinit>`, estimated at about
40 KB of the 64 KB method limit; a contract with many more combinations needs that split.

## Tests and fixtures

`scripts/test/design-tokens.test.sh` (part of `just test tooling`) runs `node --test` over
`tests/`: the parser and every rule (`generator.test.mjs`), the model and resolver
(`normalise.test.mjs`), each emitter (`emit-swift.test.mjs`, `emit-kotlin.test.mjs`), the
contract checker, the merge and the icon-set rules (`contracts.test.mjs`), the SVG path compiler
(`svg-path.test.mjs`: every command, relative and absolute, arcs, rounding, rejected input), the
component API emitters (`component-api.test.mjs`), the golden parity test (`parity.test.mjs`,
the icon glyph table included) and the CLI against a design.md stub (`cli.test.mjs`). The
repository `DESIGN.md` and `fixtures/_valid/` must pass; each `fixtures/TK-NN/` is the valid file
with one defect and must fail on rule TK-NN and nothing else. The repository contracts and
`fixtures/contracts/_valid/` (`button.yaml`, and `icon.yaml`, whose glyphs use arcs, relative
commands, a filled dot and a filled twin) pass against their tokens (`fixtures/contracts/DESIGN.md`,
synthetic, with `icon-12`, `icon-16` and `icon-24`); each `fixtures/contracts/CC-NN/button.yaml`
or `icon.yaml` (and `CC-NN-<case>/`, a second case of the same rule: `CC-01-icon-kind`,
`CC-01-icon-paint`) is a valid contract with one defect and must fail on rule CC-NN and nothing
else. The tests read the repository contracts lazily
(`once` in `tests/models.mjs`), so a defect there fails the repository tests and leaves the
fixture tests running. A new rule ships with its fixture,
and a shape a rule accepts ships with a passing test. The fixture values are synthetic, not the
real tokens; the `DESIGN.md` tests check that the file passes, resolves in every context, emits
the owner's names and lays out within 120 columns, and that both languages spell the same table.
`scripts/test/generate.test.sh` proves a failing `gen-tokens.mjs` fails `just generate [--check]`.
