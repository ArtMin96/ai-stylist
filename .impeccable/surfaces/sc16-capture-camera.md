# sc16-capture-camera — guided capture camera (v1)

> DRAFT for `.impeccable/surfaces/sc16-capture-camera.md`. Boards SC16–SC20 (page 6) and C11 (page 3,
> proposed) on the design canvas, version 76 (2026-10-22). The source brief is
> `.claude/plans/2026-10-22-capture-camera-brief.md`, approved 2026-10-22. Where this file and the
> brief differ, the brief wins.

## Direction contract

- Purpose: photograph one clothing item (or a batch, or import one photo) with a live guide that unlocks
  the shutter only when the item is found, whole, large enough and steady.
- Approval: 2026-10-22 · owner: "Self-review, then build" (brief §16: self-review against the UI rules,
  record the check, then build; the owner reviews at the end) · boards: SC16 Capture picker, SC17 Capture
  camera shutter lock, SC18 Capture modes anyway screen reader, SC19 Capture review back and pair, SC20
  Capture batch import permission (all "— proposal 2026-10-22"), C11 Capture camera parts — proposed
  2026-10-22 · https://claude.ai/artifact/3PfhQn2y9YKXtBz2fc1GeE. The owner has not reviewed the boards yet.
- Components used:
  - C01 buttons: primary Large 52, secondary (outlined) Large 52, tonal Large 52, tonal Compact 44, primary
    and tonal Card 48, text Compact 44, icon buttons 44.
  - C02 icons: close, info, flash, photo, collection, lock, check, capture, search, zoom-in, zoom-out,
    pose-neutral, pause, evening, sun, rotate-left, arrow-right, chevron-right, more.
    Proposed: speaker and speaker-off.
  - C03 choice chips (one per group).
  - C04 state template, banner (warning kind), progress ring (as the shutter ring).
  - C05 camera mode switch (labels Flat, Hanger, Worn), upload badge (as the batch count chip).
  - C06 toggle row and switch.
  - C07 plain list rows 52.
  - C08 item tile 110 and C10 garment art. The underwear and swimwear art is a placeholder; C10 has none.
  - C09 bottom sheet (short) and full-screen modal header 56.
  - SC04 camera chrome: preview, step pill and hint card.
  - Proposed on C11: guide outline, shutter lock states, hint catalogue.
- Tokens:
  - Colours: camera-ground, camera-track, camera-paper, camera-ink, camera-yellow, scrim,
    background-*, surface-*, surface-2-*, text-*, text-secondary-*, divider-*, outline-*, primary-*,
    on-primary-*, primary-text-*, warning-fg-*, warning-bg-*.
  - Type: headline, body, callout, subhead, subhead-medium, footnote, caption, caption-strong, label-sm,
    title-3, button.
  - Spacing: 4, 8, 12, 16, 20, 24.
  - Radius: rounded.2, rounded.16, rounded.24, rounded.full.
  - Elevation: snackbar-* (hint card), sheet-*.
  - Motion: press, sheet, reduced.
  - Components: camera-mode-switch, camera-mode-selected-*, focus-ring-*, icon-md, icon-lg, icon-xl.
  - Missing tokens are under "Proposed values".
- States:
  - Camera (cap-screen-camera):
    - warming up: "Looking for the item…", locked.
    - locked(reason): dashed guide plus the blocking hint.
    - unlocked: solid guide, ring filling, "Keep still…".
    - capturing: ring full, disc 52, "Taking photo".
    - anyway: after 10.0 s, or at once with a screen reader. Reason line plus "Take photo anyway".
    - batch cooldown: "Next item".
    - back step and pair step.
    - background: camera stops. On return it goes back to warming up.
  - Empty: no item found, hint "Point the camera at the item", then anyway with the surface tip.
  - Loading: warming up.
  - Error: permission denied (cap-screen-permission) and no camera (cap-screen-no-camera). The pose model
    failing to load uses the doc-10 fallback: the tip stays and anyway shows at once.
  - Offline: none. Capture makes no network call in v1 (C22), so offline looks the same.
  - Success: review (cap-screen-review) and batch summary (cap-screen-batch-summary).
- Copy (verbatim, both apps):
  - Brief §2 picker: tile labels and subtitles, "Not sure", "Many items (batch)", "Import from photos";
    underwear sub-pick "Bra or top", "Briefs or bottoms", "Swimsuit or bodysuit", "Tights", "Socks".
  - Brief §6: every hint text, spoken text and reason line.
  - Brief §6 family-instruction table.
  - Brief §7: "Is the back different?", "Same", "Different", "Take back photo", "Skip", "Retake",
    "Done", "Add a photo of the pair?", the opt-in sheet title, body and buttons, "Keep anyway",
    "Choose another", the permission body, "Open Settings".
  - Brief §8: the shutter label "Take photo, unavailable: <hint text>" and the help body.
  - Chosen on the boards (brief silent; owner to confirm):
    - Picker header: "What are you adding?".
    - Mode labels: "Flat", "Hanger", "Worn".
    - Step pills: "Back", "Pair".
    - Shoes answers: "No", "Yes". "Yes" changes the primary button to "Take pair photo".
    - Review header: "Check the photo" (reused from SC04).
    - Help sheet: title "Photo tips", button "Got it".
    - Camera menu row: "Allow worn photos", helper "Underwear and swimwear only. Saved on this phone.",
      state "Off" / "On".
    - Import tips heading: "This photo may be hard to use".
    - Batch summary: title "N items", line "Kept on this phone until you close.", tiles "Photo 1…N",
      button "Done".
    - Permission title: "Camera access is off". Modal header on permission and no-camera: "Add item".
    - No-camera screen: title "No camera found", body "You can still add an item from your photos.",
      button "Import from photos".
    - Accessibility names: "Close", "Help", "Torch", "Spoken hints, on" / "Spoken hints, off",
      "Import from photos", "More options", "Take photo".
- Accessibility:
  - Targets ≥ 44 pt / 48 dp, including the 32 pill, which is not interactive.
  - Dynamic Type and font scale up to the largest size without clipping: the hint wraps to 3 lines,
    tile labels and subtitles wrap, and the picker scrolls.
  - A label for every icon-only control.
  - Contrast checked in S1, S2 and S7. The camera ground is the same in every scheme.
  - The guide is two-tone (ink 4 under paper 2): at least 3:1 over any feed.
  - State is never shown by colour alone: dashed vs solid, the ring and the lock icon, and icon + words
    on every hint.
  - Hints use a polite live region on Android and an Announcement on iOS.
  - Speech is on with VoiceOver or TalkBack, or with the speaker toggle. Speech rules: brief §5.
  - Under reduced motion the ring fills without easing, the guide switches instantly and nothing pulses.
  - No time limit: the camera never closes on its own.
- Honesty: none. No generated image appears in this flow. Real photos never carry the AI badge.

## Measured values (canvas SC04 / C04 / C05 / C09; px = pt = dp at 390 wide)

| Part | Value |
|---|---|
| Phone chrome | camera-ground, padding 18 20 30, column gap 14; top bar 44 (buttons 44, icon lg, stroke 1.7) |
| Preview | 350 × 506, radius 24; S2 adds an inset 1 px divider-dark ring |
| Guide box | inside the preview: top 68, sides 32, bottom 104 |
| Guide stroke (proposed) | camera-paper 2 over camera-ink 4; locked dashed 6 on / 6 off, butt caps; unlocked solid, round caps and joins; no fill |
| Step pill | 32 high, padding 0 14, radius full, label-sm 13/18 600, camera-ground / camera-paper, top 18 centred |
| Hint card | left and right 16, bottom 18; padding 10 14; radius 16; gap 10; icon md 20; subhead-medium 15/20 500; up to 3 lines; camera-ground / camera-paper; elevation snackbar-* (S2 + 1 px divider-dark ring) |
| Anyway slot | 70 high, reserved; reason footnote 13/18 camera-paper centred; gap 8; button Compact 44, padding 0 20, radius full, camera-track fill, camera-paper 15/20 600 |
| Mode switch | C05: track camera-track, padding 4, gap 2; segment 36, padding 0 18; selected camera-paper (S2 camera-yellow) / camera-ink 600, others 500; hidden when only one mode |
| Bottom row | 76, columns 1fr 76 1fr, padding 0 8; import 52 circle on camera-track, icon lg photo; right slot text button 44, padding 0 12, 15/600 |
| Shutter (proposed states) | 76; ring stroke 4 (centre line r 36), track camera-track, fill camera-paper from 12 o'clock clockwise; disc 60 (capturing 52); locked disc camera-track + lock lg camera-paper |
| Count chip | C05 upload badge: 36, padding 0 14, 1.5 ring, 14/18 600, check icon md, camera-paper (S2 camera-yellow) |
| Sheets | handle 36 × 4 radius 2 outline; padding 10 20 34; top radius 24; title-3; callout; actions 52, gap 10 |
| Picker | modal header 56; tiles 110 square in 3 columns, gap 12 10, radius 16, art 64; label caption-strong; subtitle caption text-secondary |

## Proposed values (not yet in DESIGN.md; owner approval, then DESIGN.md + canvas R2)

- capture-guide: strokeWidth 2 (camera-paper), haloWidth 4 (camera-ink), dash 6 / 6.
- capture-shutter: size 76, ringWidth 4, disc 60, discCapturing 52, track camera-track, fill camera-paper.
- capture-hint-card: padding 10 14, radius 16, gap 10, iconSize icon-md, subhead-medium, camera-ground /
  camera-paper, elevation snackbar.
- capture-step-pill: height 32, padding 0 14, label-sm.
- camera-icon-button: 52 circle on camera-track (SC04 switch-camera button).
- camera-button-tonal: Compact 44 on camera-track (the anyway and next buttons).
- camera-upload-badge (count chip): 36, 1.5 ring.
- C02 glyphs speaker and speaker-off.
