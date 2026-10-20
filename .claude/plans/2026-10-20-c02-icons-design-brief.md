# C02 icons: design-half brief (contract format and generator emission)

> Status: ACTIVE (2026-10-20). Linear AI-201. Branch `feat/c02-icons`. Lead: the main session.
> This brief covers steps 2 and 4 of `.claude/rules/design-system.md` invariant 8 (contract, tokens,
> generator). The native lanes get their own brief after `just generate`.

## Why

C02 is the next base component (owner, 2026-10-20). Nearly every later component (C03 chips, C04
status, C05 navigation, C06 inputs, C07 rows) uses icons, and the C01 button's `leadingIcon` slot has
none yet. The read-only board research of 2026-10-20 found:

- Board C02 draws 84 glyphs (81 shapes + 3 filled twins). They are hand-drawn in Claude Design, not
  from a library, so no licence applies. Every glyph uses a 24 × 24 viewBox, stroke 1.7, round caps
  and joins, no fill, `currentColor`, and a 2 px live area.
- The screens use about 30 more icons, and the screens and C02 disagree on about 9 concepts.
- The screens draw small sizes with a thicker stroke (in viewBox units): 12 → 2.2, 14 → 2.0, 16 → 1.7
  (1.9 on reason and filter chips, 2.6 on the confidence bars).

## Owner decisions (2026-10-20, in chat)

1. **Like and favourite.** Outfits use thumbs-up and thumbs-down for like and dislike, as the Today
   action row draws them, and the "a pairing you liked" chip and the Liked history follow. Clothing
   items use a heart for favourite. The star is kept only for the "Style preferences" row.
2. **AI spark.** It sits only beside "AI-generated preview". Discover's trend tags get a plain tag
   icon instead of the spark.
3. **Tab bar.** The five tab icons (Today, Closet, Capture, Discover, You) are C02 glyphs on both
   apps, inside the native tab bar (DEC-87). Back and close in native navigation bars stay the
   system's own; the C02 back and close are for custom headers only (camera, onboarding).
4. **Scope.** Build every drawn icon now, including the page-8 selfie, avatar and try-on icons.

Standing rule (not asked, owner rule of 2026-10-19 and invariant 8): where C02 and the screens
disagree, the screens and prototype win, and screen-only icons join the set. Where the screens
disagree with each other, the drawing used on the most boards wins (laundry: the washing machine).
Each such choice is a `Screens win:` comment in the contract.

Lead decision (technical): glyphs are emitted as code (path data replayed by SwiftUI `Path` and
Compose `ImageVector`/`PathBuilder`), not as asset files. Why: the stroke can then vary per size, as
the screens draw it; the parity test can compare one path table across both apps; and no binary
assets are needed.

## The contract: `.impeccable/components/icon.yaml` (owner: ui-designer)

```yaml
id: icon
board: C02
name: AppIcon
kind: icon-set            # new discriminator; absent = the existing control contract (button)
approved: pending         # the owner approves in chat; then "approved: <date>"
accessibility:
  role: decorative        # hidden from screen readers; the host control names the action
gallery:
  title: Icons            # gallery section "C02 Icons", slug c02-icons
sizes:                    # each names a DESIGN.md token components.icon-<n>
  - icon-12
  - icon-14
  # ... every size the screens use
defaultSize: icon-24
glyphs:
  - id: back              # kebab-case, unique; becomes the enum case (back → .back / BACK)
    set: navigation       # navigation | actions | weather | closet | status | account | capture
    source: SC05          # the board the drawing was taken from (C02 when it wins)
    shapes:               # in the 24 × 24 viewBox; SVG path data only
      - d: "M14.5 5.5L8 12l6.5 6.5"
        paint: stroke     # stroke | fill | both
```

- Every `circle`, `rect`, `ellipse`, `line` and `polyline` from the canvas is converted to one `d`
  string by the designer, so the generator reads path data only. Small dots are `paint: fill`.
- A filled twin is its own glyph (`thumbs-up-filled`, `bookmark-filled`, `heart-filled`), not a
  state.
- `set: capture` holds the page-8 selfie, avatar and try-on icons. Use the next free set name if
  the board's grouping needs another.
- No `variants`, `combinations`, `states` or `testId` pattern: an icon has no interaction states.
  The gallery test ID is `ds-icon-<id>`.

## Tokens: `DESIGN.md` frontmatter (owner: ui-designer)

One `components` entry per icon size the screens use: `icon-<n>: { size: <n>px, strokeWidth: <w> }`.
Here `strokeWidth` is in viewBox units, so the rendered width is `w × n / 24`. The values are
measured from the screens (the most common stroke per size). The tint comes from the host and from
the existing colour roles; no icon colour token is added. Update the "### Icons (C02)" prose and
the size line near L1948 in the same change.

## Generator (owner: tooling-engineer)

`tools/codegen/tokens/**` + `tools/codegen/gen-tokens.mjs`:

- **Schema:** `component-contract.schema.json` accepts `kind: icon-set` with the fields above (closed
  schema, CC rules). Keep it strict: the glyph `id` pattern, `paint` enum, `set` enum, unique ids,
  `sizes`/`defaultSize` resolving to existing `components.icon-*` tokens, and non-empty `shapes`.
  Path data that the parser rejects is an error.
- **Path compile:** parse SVG path data (every command, relative and absolute, including `A` arcs, `S`
  and `T`), and emit absolute `move`, `line`, `cubic` and `close` only (arcs → cubics; quadratics →
  cubics). Number formatting is deterministic, the same in both languages.
- **Emit** into the existing generated dirs (`ComponentAPI.swift` / `ComponentApi.kt`, or a sibling
  generated file if that reads better):
  - an `AppIconName` enum (Swift `String` raw value + `CaseIterable`; Kotlin enum with `id`), in
    contract order;
  - the glyph table: per name, the compiled segments and paint, in viewBox units;
  - the icon sizes (`size`, `strokeWidth`) from the tokens, and the default size;
  - the gallery entry (C02 Icons) and the test ID helper `ds-icon-<id>`.
- **Tests:** CC rules for the new kind, with failing fixtures; the path compiler, with arcs and
  relative commands; and the Swift/Kotlin parity test, covering the glyph table.
- **Docs:** `tools/codegen/tokens/README.md` (how an icon set is generated).

The native lanes then write one `AppIcon(name:size:)` view per app that replays the table, scales
24 → size and strokes at `strokeWidth × size / 24`, tinted by the host's foreground. That is the
next brief, not this one.

## Amendment 2026-10-21: an icon scale, and components that point at the scales

Owner decisions (2026-10-21, in chat):

5. **A named icon scale replaces the 14 measured sizes.** Six steps, Tailwind-style:
   `xs 12 · sm 16 · md 20 · lg 24 · xl 32 · hero 56`. Every use on the screens snaps to the nearest
   step (tab bar 26 → lg, plan checks 11 → xs, chip icons 18 → sm or md by fit). The small
   visual shifts are accepted.
6. **Components point at the shared scales** instead of repeating numbers.
7. **Icons grow with the user's text size** (Dynamic Type on iOS, font scale on Android), like the
   platform's own icons.

Format (ui-designer and tooling-engineer build to this):

- Tokens: `components.icon-xs|sm|md|lg|xl|hero: { size: <n>px, strokeWidth: <w> }`. The stroke is
  in viewBox units, measured per step from the screens. The old `icon-11 … icon-56` entries go.
- `icon.yaml`: `sizes: [icon-xs, icon-sm, icon-md, icon-lg, icon-xl, icon-hero]`,
  `defaultSize: icon-lg`; record decisions 5–7 in the header with the date. Every usage note
  that named a measured size names its step.
- Emitted names: the size enum drops the `icon-` prefix (`AppIconSize.xs … .hero`; Kotlin
  `XS … HERO`), so code reads `AppIcon(name: .heart, size: .sm)`.
- Button: `iconSize` is a reference, `'{components.icon-md}'` (large, card, medium, small) and the
  compact step by fit, and the generator emits `ButtonAppearance.iconSize` typed as
  `AppIconSize`. A component dimension that equals a shared-scale step is a reference: padding and
  gap point at `spacing` (a shorthand may mix parts, e.g. `padding: '0 {spacing.24}'`), and the
  typography and colour references stay as they are. Values that are not on a scale (heights 44
  and 52, gap 6) stay literal; list them, never snap them without the owner. The emitted numbers
  of every non-icon button value stay the same.
- Text-size scaling is a native rendering rule (the lanes brief), and the contract records it under
  `accessibility` as a comment.
