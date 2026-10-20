# Component contracts

One YAML file per base component, `<id>.yaml`, owned by `ui-designer` (ADR-0011 follow-up 7, DEC-87).

The contract is the master for a component's API, as the `DESIGN.md` frontmatter is the master for its values. It says what the component accepts (props), which variants, sizes and states exist, which combinations are allowed, which `DESIGN.md` component tokens style each one, its accessibility, its gallery and its test IDs. It never holds a value: no colour, size, spacing or duration, only references to `DESIGN.md`.

Each component is written natively twice, by `ios-engineer` and `android-engineer` in parallel, and neither lane reads the other's code. Parity comes from three generated inputs: the tokens (from `DESIGN.md`), this contract, and the component API surface the generator emits from it for each platform (the variant, size and state enums, the test-ID constants and the gallery list). Both lanes build against that generated surface.

Example: `button.yaml` (`AppButton`, canvas board C01).

## Fields

All fields are required unless marked optional.

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
  - `sizes` names the entry that holds each size's height and padding: the base for the variant's own size, otherwise the shared size entry (buttons: `button-large`, `button-card`, `button-medium`, `button-compact`, `button-compact-filled`, `button-text-compact`, `button-small`).
  - Two entry properties go beyond fill, text and type: `borderColor` is a ring drawn inside the shape (the buttons' width is `button-outline-ring`), and `spinnerColor` is the loading spinner when it is not the label colour.
- `accessibility`:
  - `role`: the semantic role (`button`).
  - `label`: the accessible name, as a `{props.<name>}` reference.
  - `busy`: the busy state (`loading`), with this behaviour on every variant (owner 2026-10-20). The label stays and a 20 spinner shows in the leading-icon slot. The component ignores every activation (tap, keyboard, assistive) until the state ends, so a request cannot be sent twice. It keeps its enabled colours, is never greyed out or announced as disabled, stays focusable and is announced as busy.
  - `minTouchTarget: { ios: <pt>, android: <dp> }`: from `DESIGN.md` "Layout" → Touch targets (44 pt, 48 dp).
- `gallery`: `label`, a synthetic string (never real user data), and `include`: `all` (every allowed combination) or an explicit list of `{ variant, size, state }`.
- `testId`: exactly `ds-{component}-{variant}-{size}-{state}`, for example `ds-button-primary-large-enabled`. It is the iOS `accessibilityIdentifier` and the Android `testTag`, the same literal on both.
- `approved`: `pending`, or the date (`yyyy-mm-dd`) the owner approved the contract in chat. `ui-designer` writes it when the lead relays the owner's words. Silence is not approval, and neither is an agent's own opinion.

Comments may explain a choice (usage rules, a token gap, a board-versus-screen choice, a question still open for the owner); they never add a field.

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
