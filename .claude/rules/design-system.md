---
paths:
  - "DESIGN.md"
  - "PRODUCT.md"
  - ".impeccable/**"
  - "apps/ios/Packages/DesignSystem/**"
  - "apps/android/core/designsystem/**"
  - "apps/android/core/designsystem-catalog/**"
  - "tools/codegen/gen-tokens.mjs"
  - "tools/codegen/tokens/**"
---

# Design system (DESIGN.md, PRODUCT.md, .impeccable)

**Skill:** `ui-prototype-first` (the gate for any new screen or UI element: check, canvas prototype,
owner approval, surface brief, build, review). The impeccable plugin's commands (`init`, `document`,
`shape`, `critique`, `audit`, `adapt`, `polish`) serve this skill.

**Agent:** `ui-designer` for `DESIGN.md`, `PRODUCT.md` and `.impeccable/**`. It never writes app code:
`apps/ios/**` stays with `ios-engineer` and `apps/android/**` with `android-engineer` (`ios.md`,
`android.md`), and the token and component generator `tools/codegen/gen-tokens.mjs` +
`tools/codegen/tokens/**` with `tooling-engineer` (`tooling-ci.md`). This rule also loads on those
paths so every one of them follows the pipeline below. A base component on both apps is run by the
main session through `cross-platform-feature`. The visual source of truth is the
Claude Design canvas "Garderi App UI" (https://claude.ai/artifact/3PfhQn2y9YKXtBz2fc1GeE); colours and
logo come from "Garderi Colour Schemes" (https://claude.ai/artifact/Db28dfjbyvJgksMQFrXhVA).

**Proof:** `just docs-check`.

**Invariants that bite here:**
1. The `DESIGN.md` YAML frontmatter is the only master for design tokens (colours, typography,
   spacing, radius, elevation, motion), and its values equal the canvas R2 board (page 9, Design
   rules). A token change updates both in the same change; native code never holds a copy
   (reviewer-checked: ui-designer; native theme code emitted by `just generate` with a
   `just generate --check` drift gate).
2. Never rename, reorder or drop the eight section headings of `DESIGN.md`: impeccable parses them
   by name. New content goes under an existing heading (reviewer-checked: ui-designer).
3. `PRODUCT.md` is derived from `planning/SPINE.md` and says so at its top; SPINE wins on any
   conflict. A conflict is fixed in `PRODUCT.md`; SPINE is human-only (`human-only.md`)
   (reviewer-checked: ui-designer).
4. Every surface brief `.impeccable/surfaces/<screen>.md` records the owner's approval date, the
   canvas board it was approved from and its Direction contract; no brief exists without that
   approval, and no engineer starts the UI without the brief (reviewer-checked: ui-designer).
5. impeccable's automatic hooks are disabled per project in `.impeccable/config.json`
   (`hook.enabled: false`, set with `/impeccable hooks off`) because they scan only web files and
   download an engine binary; never turn them back on without the owner. Never enable them in
   `.claude/settings.json` either — `permissions.ask` prompts the human on any settings edit
   (`agent-authoring.md`).
6. No generated images under artifacts/ and no image-generator scripts: brand visuals and
   prototypes live in the Claude Design canvas, and docs here link to its boards
   (reviewer-checked: ui-designer).
7. **The pipeline.** Two inputs, one command, two outputs:
   - Inputs: the `DESIGN.md` frontmatter (tokens), and one contract per base component at
     `.impeccable/components/<id>.yaml`, with its fields defined in `.impeccable/components/README.md`.
   - Command: `just generate`. It writes `ReferenceTokens`, `SchemeTokens`, `ComponentTokens` and
     the component API (`ComponentAPI.swift` / `ComponentApi.kt`) into
     `apps/ios/Packages/DesignSystem/Sources/DesignTokens/generated/` and
     `apps/android/core/designsystem/src/main/kotlin/app/aistylist/core/designsystem/generated/`.
   - The component API holds the variant, size and state enums, the test IDs, the gallery list and one
     merged look per allowed combination and scheme (`<Name>Spec` → `<Name>Appearance`).
   - Generated files are never hand-edited. Only `contracts-engineer` or the main session runs
     `just generate`; every other agent runs `just generate --check`.
   - When a value or field is missing, add it to `DESIGN.md` or the contract and to the generator.
     Never put a literal in app code, and never put a value in a contract. How the generator works:
     `tools/codegen/tokens/README.md`.
   - Enforced by `just generate --check` (the PR gate) and the token suite
     `scripts/test/design-tokens.test.sh` (validator TK rules, contract checker CC rules,
     Swift/Kotlin parity test).
8. **A new base component goes through these steps in order:**
   1. It is drawn on a C01–C10 canvas board.
   2. Its contract is written with `approved: pending`, and any missing tokens go into `DESIGN.md`.
   3. The owner approves it in chat, and `approved: <date>` is recorded.
   4. `just generate` runs.
   5. A brief is written (`.claude/plans/<date>-<slug>-brief.md`; sibling
      `.claude/plans/2026-10-20-app-button-brief.md`).
   6. The iOS and Android lanes run in parallel through `cross-platform-feature`, both built only on
      the generated API.
   7. The parity review runs, then the PR.

   The approved contract is the UI-gate approval for a base component, and no surface brief is
   needed. The canvas screens and prototype win over a component board ("Which drawing wins" in
   `.impeccable/components/README.md`). Shipped components match the screens as drawn. Sizes,
   heights, label sizes, paddings and colours are measured from the canvas, never asked of the
   owner. Undrawn states (pressed, disabled, loading) are derived from the existing variants'
   rule. The owner is asked only real product choices (reviewer-checked: ui-designer,
   architecture-reviewer).
9. **Core vs catalog** (owner, 2026-10-20: "Previews are for development while base components are
   system core").
   - The core modules hold tokens, theme, fonts and base components only, never a `#Preview`,
     `@Preview`, playground or gallery: iOS `DesignSystem` / `DesignTokens`, Android
     `:core:designsystem`.
   - Previews (a state grid plus a live-control playground per component) and the debug gallery live
     in the dev-only catalog: iOS `DesignSystemCatalog`, Android `:core:designsystem-catalog`.
   - Production code never depends on the catalog. On Android only `:app` reaches it, as
     `debugImplementation`. On iOS the app target lists the product with `link: false`, and only
     `apps/ios/Config/Dev.xcconfig` links its object file.
   - Enforced by Android `checkModuleGraph` (`ALLOWED_MODULE_EDGES`). On iOS it is reviewer-checked:
     after `just ios-build --config prod`, `strings -a` and `nm -m` on the Prod `AIStylist` binary
     find no catalog code.
10. **Builds that upload symbols.** When the `POSTHOG_CLI_*` keys are set (the local `.env`), these
    builds upload R8 mappings or dSYMs to PostHog:
    - `just ios-build`, and so `just ios-check` on a Mac;
    - Android `assemblePreview` / `assembleRelease`, and so `just android-check` and
      `just android-deps-lock`.

    Run them as `env -u POSTHOG_CLI_API_KEY -u POSTHOG_CLI_HOST -u POSTHOG_CLI_PROJECT_ID just …`
    until the owner's dev setup for PostHog lands. An agent whose Bash guard cannot unset them runs
    only non-uploading tasks (lint, format, unit tests, debug builds) and leaves the full gate and
    any lockfile refresh to the main session (reviewer-checked).
