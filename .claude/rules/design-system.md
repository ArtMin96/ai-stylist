---
paths:
  - "DESIGN.md"
  - "PRODUCT.md"
  - ".impeccable/**"
---

# Design system (DESIGN.md, PRODUCT.md, .impeccable)

**Skill:** `ui-prototype-first` (the gate for any new screen or UI element: check, canvas prototype,
owner approval, surface brief, build, review). The impeccable plugin's commands (`init`, `document`,
`shape`, `critique`, `audit`, `adapt`, `polish`) serve this skill.

**Agent:** `ui-designer`. It never writes app code: `apps/ios/**` stays with `ios-engineer` and
`apps/android/**` with `android-engineer` (`ios.md`, `android.md`). The visual source of truth is the
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
