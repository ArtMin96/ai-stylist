# tools/codegen/tokens: the design-token generator

`DESIGN.md` (repository root, YAML frontmatter) is the only token master (ADR-0011, DEC-86). This
directory turns it into native theme code in the DEC-87 pipeline:

1. **Validate**: the pinned `@google/design.md` 0.4.0 `lint` must exit 0 (TK-12), plus our own rules
   TK-01 to TK-11 below.
2. **Normalise** in memory to the DTCG 2025.10 model plus resolver (`normalise.mjs`). The model is
   never written to the repository (DEC-87 D8).
3. **Emit** Swift and Kotlin in three tiers: reference scales, scheme roles, component tokens
   (`emit-swift.mjs`, `emit-kotlin.mjs`; not built yet, see Status).
4. **Gate**: the generated files are checked for drift, and a golden test proves the Swift and
   Kotlin emitters produce the same name-to-value table (not built yet).

## Status (Linear AI-189)

Built: stages 1 and 2, with their tests. The repository `DESIGN.md` passes TK-01 to TK-11, and a
test keeps it that way; the rule and model tests run against the synthetic fixture
`fixtures/_valid/DESIGN.md`.

Not built yet: the emitters, their output directories and `--check`, the parity test, and the
wiring into `just generate` / `just generate --check`. `declarations.mjs`, `render.mjs`,
`emit-swift.mjs` and `emit-kotlin.mjs` are an unreviewed, untested first draft from this pass,
left for the emitter pass to adopt or replace. Nothing imports them yet.

## Usage

```bash
node tools/codegen/gen-tokens.mjs --input DESIGN.md
```

It prints every finding as `TK-NN <where>: <message>` and exits 1, or prints a one-line summary
of the model and exits 0. Exit 2 is a usage error. `DESIGN_MD_BIN` overrides the design.md bin
(the tests point it at a stub); by default it is `node_modules/.bin/design.md` from the root
devDependency, never `npx`.

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
- `tools/codegen/gen-tokens.mjs`: the CLI. The emitter pass adds the output directories and
  `--check` here.

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
  there, possibly as an empty group.
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
  and `<Component>Tokens`.
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

### Reserved file names

- `tools/codegen/tokens/emit-swift.mjs`: the Swift emitter. Its planned output directory is
  `apps/ios/Packages/DesignSystem/Sources/DesignTokens/generated/`.
- `tools/codegen/tokens/emit-kotlin.mjs`: the Kotlin emitter. Its planned output directory is
  `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/generated/`.
- `tools/codegen/tokens/tests/parity.test.mjs`: the golden test that the Swift and Kotlin
  name-to-value tables are equal. Today it is a comment-only placeholder; `node --test` counts it
  as one passing file.
- `tools/codegen/tokens/tests/parity-table.mjs`: that test's table reader. It is a placeholder too,
  and the suite does not run it (it is not a `*.test.mjs` file).
- New tests go in `tools/codegen/tokens/tests/*.test.mjs`. `scripts/test/design-tokens.test.sh`
  runs that glob.

The two emitter files above exist today, together with `declarations.mjs` and `render.mjs`, as an
unreviewed, untested draft (see Status). The emitter pass adopts or replaces them; it does not add
new names alongside them.

Open question: the `brand` context falls back to `dark` for every role S3 Viridian does not
declare. `DESIGN.md` does not state that fallback yet (it does for high contrast); confirm it with
the owner before the emitters ship.

## Tests and fixtures

`scripts/test/design-tokens.test.sh` (part of `just test tooling`) runs `node --test` over
`tests/`: the parser and every rule (`generator.test.mjs`), the model and resolver
(`normalise.test.mjs`) and the CLI against a design.md stub (`cli.test.mjs`). The repository
`DESIGN.md` and `fixtures/_valid/` must pass; each `fixtures/TK-NN/` is the valid file with one
defect and must fail on rule TK-NN and nothing else. A new rule ships with its fixture, and a shape
a rule accepts ships with a passing test. The fixture values are synthetic, not the real tokens;
the `DESIGN.md` test checks only that the file passes and resolves in every context.
