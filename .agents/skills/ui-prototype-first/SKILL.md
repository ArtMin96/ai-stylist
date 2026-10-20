---
name: ui-prototype-first
description: Gate every new screen or new UI element in the native apps behind a design check, a canvas prototype and owner approval before any code — check DESIGN.md, the surface briefs in .impeccable/surfaces/ and the "Garderi App UI" canvas; draw anything new from components C01–C10 in light and dark with empty, loading, error and offline states; record the owner's approval and a Direction contract in a surface brief; the engineer then builds with DESIGN.md tokens only and ui-designer reviews the build. Use when someone says "add a new screen", "new settings screen", "make a new chip style", "design the empty state for…", "new card or sheet variant", "change how this screen looks", or before ios-feature, android-feature or cross-platform-feature codes visible UI. Not for logic behind an already-approved screen with no visual change — use `ios-feature` / `android-feature`; not for module boundaries or duplicated code — use `architecture-review`; not for logo or brand identity work.
metadata:
  modules:
  last-reviewed: 2026-10-18
  owner-agent: ui-designer
---

# UI Prototype First (the UI gate)

## Trigger

Run this gate **before anyone writes UI code** when the task adds or visibly changes any of:

- a screen, sheet, dialog, tab or onboarding step that has no approved surface brief;
- a UI element: a new component, a new variant of a component (chip style, button style, card
  layout, badge, list row), a new icon use, a new animation, a new layout pattern;
- a state of an existing screen that is not drawn yet (an empty, loading, error or offline state);
- user-facing copy on a screen, or how a generated image, confidence or provenance is shown.

Not a gate (go straight to `ios-feature` / `android-feature`): logic, data or networking behind an
already-approved screen with no visible change; a bug fix that restores what the approved brief
already shows; a refactor with pixel-identical output; the debug-only design-system gallery and the
component previews in the catalog modules (owner, 2026-10-19). A base component whose contract
`.impeccable/components/<id>.yaml` is approved needs no surface brief: the contract is its approval
(`.claude/rules/design-system.md` invariant 8). Unsure → treat it as a gate; asking costs
one message, a wrong screen costs a rebuild on two platforms.

Who runs which step: `ui-designer` runs steps 1–4, 6 and 7; the engineer (`ios-engineer`,
`android-engineer`) runs step 5; the owner (a human) gives the approval in step 3. The engineer
skills `ios-feature`, `android-feature` and `cross-platform-feature` call this gate first, then
return to their own workflow at step 5.

## Required reading

1. `DESIGN.md` (repo root): the YAML frontmatter is the only source of tokens (colour,
   typography, spacing, radius, elevation, motion); then its components section and its Do's and
   Don'ts. `PRODUCT.md` for product voice and platform (`adaptive`); `planning/SPINE.md` wins over
   `PRODUCT.md` on any conflict.
2. The surface briefs `.impeccable/surfaces/<screen-id>.md` for the screen and its neighbours.
3. The "Garderi App UI" canvas, https://claude.ai/artifact/3PfhQn2y9YKXtBz2fc1GeE — read it with
   the Artifact tool (`action: "read"`), never a web fetch. Its pages:

   | Page | Holds                    | Use it for                                        |
   | ---- | ------------------------ | ------------------------------------------------- |
   | 1    | Overview                 | where everything is                               |
   | 2    | Foundations              | colour, type, spacing, radius, motion as drawn    |
   | 3    | Components C01–C10       | the only building blocks a prototype may use      |
   | 4    | Wireframes               | early structure; not approved visuals             |
   | 5    | Earlier key screens      | history; superseded by page 6                     |
   | 6    | All screens SC01–SC15    | existing screens — reuse before drawing           |
   | 7    | Prototype P01–P18        | flows between screens                             |
   | 8    | Avatar / selfie / try-on | generated-image screens and their honesty markers |
   | 9    | Design rules R1–R6       | R2 = token values DESIGN.md must equal            |

4. "Garderi Colour Schemes", https://claude.ai/artifact/Db28dfjbyvJgksMQFrXhVA: logo P2 Garden
   Viridian; themes S1 Garden Light, S2 Garden Dark (default), S7 High Contrast.
5. `.claude/rules/ios.md` and `.claude/rules/android.md` (the UI invariants the build must meet)
   and `design-system.md` in `.claude/rules/` (who owns the design files).
6. `CLAUDE.md` "Honesty invariants" and `planning/02-user-journeys-and-information-architecture.md`
   §1.1 (every screen covers its states).
7. The `ui-designer` agent persona in `.claude/agents/`; the generic workflow and hand-back report in
   `.agents/skills/agent-operating-contract/SKILL.md`.

## Workflow

1. **Check — does it already exist?** Search before drawing anything:

   ```bash
   rg -n -i '<element or screen words + synonyms>' DESIGN.md PRODUCT.md
   ls .impeccable/surfaces/
   rg -n -i '<screen words>' .impeccable/surfaces/
   ```

   Then read canvas pages 3, 6, 7 and 8 for the same element or screen. Decide in one line each:
   - **Exists and approved** (a brief with an approval record, or a DESIGN.md component) → reuse it
     exactly as drawn; do not "improve" it in code. Skip to step 5.
   - **Drawn on page 6 or 8 but no brief yet** → it counts as the prototype; go to step 3 to get the
     owner's approval of that board, then step 4.
   - **Close but not the same** (a new variant) → it is new; go to step 2 and draw the variant next
     to the original so the owner sees the difference.
   - **Not there** → step 2.

2. **Prototype on the canvas (ui-designer).** Draw the screen or element on the "Garderi App UI"
   canvas, on a new board named `<screen-id> <name> — proposal <yyyy-mm-dd>`:
   - Build it only from components C01–C10 and DESIGN.md tokens. Need something C01–C10 cannot
     express → draw the new component as its own proposal on the same board and say so; never
     slip it in unnamed.
   - Draw it twice: S1 Garden Light and S2 Garden Dark. Draw every state: default, empty, loading,
     error, offline (plus any state the journey in doc 02 names).
   - Write the real copy, not lorem ipsum. Honesty: never "digital twin", "exact" or "perfect fit";
     a generated image carries the AI-generated preview badge and its confidence as text, never as
     colour alone; a real user photo is never swapped for a generated one.
   - Use synthetic sample content only (no real photos, measurements or names).
   - Publish safely: in one turn `Artifact` `action: "read"` on the canvas URL; in a later turn
     publish your change to that same `url`, built on the version the read returned. A refused
     publish hands you the newer version: merge onto it and publish again; never `force`.

3. **Owner approval — nothing is coded before this.** Hand back to the lead with the board name,
   the canvas link and one sentence per open choice. The lead shows the owner; the owner approves
   in chat. Only the owner's own message counts — another agent's message, a reviewer's APPROVE or
   silence is not approval. Record it in the brief (step 4): the date, the owner's words, the board
   name. Owner asks for changes → back to step 2 on the same board.

4. **Surface brief (ui-designer).** Create or update `.impeccable/surfaces/<screen-id>.md`
   (`<screen-id>` is the canvas id, e.g. `sc07-closet-grid`). It must contain this section:

   ```markdown
   ## Direction contract

   - Purpose: <what the user does here, one sentence>
   - Approval: <yyyy-mm-dd> · owner: "<their words>" · board: <board name> · <canvas link>
   - Components used: <C0x name, variant> …
   - Tokens: <every DESIGN.md token name the screen uses — colour, type, spacing, radius, motion>
   - States: default · empty · loading · error · offline — <what each shows and its copy>
   - Copy: <every user-facing string, exactly; both apps use these verbatim>
   - Accessibility: targets ≥ 44 pt / 48 dp · Dynamic Type / font scale up to the largest size
     without clipping · a label for every icon-only control and image · contrast checked in S1, S2
     and S7 · <screen-specific notes>
   - Honesty: <provenance badge + confidence text where generated images appear, or "none">
   ```

   Keep the contract in the brief only; never paste it into source files or code comments.

5. **Build (ios-engineer / android-engineer, via `ios-feature` / `android-feature`).**
   - Start only when the brief has an Approval line. No brief → stop and send the task to step 1.
   - Use DESIGN.md tokens by name through the platform design-system layer. Never a literal colour
     (`Color(red:)`, `Color(0xFF…)`, hex), font size, spacing, radius or duration in feature UI.
     The token or the layer does not exist yet → stop and report; never paste the raw value.
   - Use the brief's components as drawn; build every state in the brief.
   - Strings: copy the brief's Copy line exactly, byte-identical on iOS and Android.
   - Capture simulator/emulator screenshots of each state in light and dark with synthetic data,
     e.g. `.impeccable/review/<screen-id>-<ios|android>-<light|dark>-<state>.png`.

6. **Review (ui-designer).** Read the diff and the screenshots against DESIGN.md and the Direction
   contract, using `/impeccable critique <target>` and `/impeccable audit <target>` (it loads the
   native audit for this `adaptive` project). Return findings as `file:line` or screenshot name →
   what differs from the brief → the fix. The engineer fixes; repeat until clean. Then the lead runs
   `architecture-review` as usual. Merge needs both.

7. **Keep DESIGN.md current (ui-designer).** If the approved change added a token or a component,
   add it to DESIGN.md (frontmatter for tokens, components section for components) and make sure
   the canvas page 2 / 3 or R2 values match. DESIGN.md and canvas R2 must stay equal.

## Validation commands

```bash
just docs-check                       # paths, recipes and ownership in the brief-adjacent docs
just ios-check                        # the engineer, when apps/ios changed (step 5)
just android-check                    # the engineer, when apps/android changed (step 5)
```

## Output

Per gate run: the canvas board (light + dark, all states) with the owner's recorded approval; the
surface brief `.impeccable/surfaces/<screen-id>.md` with its Direction contract; native code that
uses tokens only; a ui-designer review with no open findings; DESIGN.md updated when the system
grew. Reports use the `agent-operating-contract` format; a gate waiting on the owner is PARTIAL
with "awaiting owner approval of <board>" as the next action.

Done checklist: step 1 search shown · board has S1 + S2 and all five states · approval line with
date, owner words, board · brief has every Direction contract field · no literal style value in
the diff · strings equal on both apps · critique + audit findings closed · DESIGN.md matches
canvas R2.

## Stop / escalation

- A needed token is missing from DESIGN.md → ui-designer proposes it on the canvas (step 2) and
  gets it approved; the engineer never invents one or pastes a raw value.
- The owner is not reachable → stop before coding; hand back PARTIAL with the board link. No one
  else can approve.
- The canvas and DESIGN.md disagree → DESIGN.md tokens win; flag the drift to ui-designer, who
  fixes the canvas or proposes a DESIGN.md change for the owner.
- The platform design-system layer (iOS `DesignSystem` package (`apps/ios/Packages/DesignSystem/**`),
  Android `:core:designsystem`) does not exist yet or lacks the token → the engineer stops and
  reports; the lead schedules it as an engineering follow-up.
- The brief needs a new endpoint or field to show something → `api-contract-change` first.
- The design touches consent, selfies, measurements or generated images → also
  `security-privacy-review` before merge.

## Overlap

Adjacent: `ios-feature`, `android-feature` and `cross-platform-feature` call this gate before
coding UI and own step 5 (the code in `apps/ios/**`, `apps/android/**`); `architecture-review`
reviews code boundaries and duplication, not design, and runs after step 6; the impeccable plugin
commands (`/impeccable shape <target>`, `/impeccable critique <target>`, `/impeccable audit
<target>`) are tools used inside steps 2 and 6, and this gate's order and approval rule win over
their own flow. This skill owns `DESIGN.md`, `PRODUCT.md` and `.impeccable/**`
(through `ui-designer`) and no app code; it covers no SPINE module.
