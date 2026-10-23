# Build brief — guided capture camera, version 1

> Status: APPROVED by the owner (2026-10-22), with the answers in §16. Branch `feat/capture-camera`.
> Written at the owner's request (task step 3). Drafted 2026-10-21. Build order: §15; the canvas
> prototype comes first (§16).
> Sources: 3D research artifact (claude.ai/artifact/EQxFSEvXcBBJFFDAavWxHj) §17 (cases §17.14, live checks §17.4, rule set §17.6),
> the owner's answers Q5, Q8, Q14–Q19 and the underwear opt-in (artifact §14), the camera notes
> cam-2 (iOS), cam-3 (Android), cam-6 (UX). Planning changes: the companion proposal
> `.claude/plans/2026-10-22-capture-camera-plan-changes-proposal.md` (applied 2026-10-22 on this branch).

## 0. Scope and finish line

**In scope (v1):** category picker, 8 shape-family guides, live checks, shutter lock, auto-capture,
"Take photo anyway", back-photo step, batch mode, single-photo library import with tips, the
underwear/swimwear worn-mode opt-in, accessibility, analytics events, and a debug-only test
harness. Both apps.

**Not in scope:** the upload queue (P06-T03), segmentation and cut-out preview (P06-T04 second
half), the confirm card and category confirmation (P06-T09), the batch review stack and multi-select
import (P06-T10), any server work. In v1 the photo ends on a local review screen and is dropped when
the flow closes. Nothing is written to the photo library or uploaded.

**Finish line:** the exit criteria in the task (step 8): every simulator-testable case below passes
on both platforms in two consecutive `just capture-sim` runs; 0 misses; false locks ≤ 10 %;
"Take photo anyway" at 10.0 s ± 0.5 s; `just ios-check` and `just android-check` green; branch pushed.

**What the simulators prove:** the rules, the state machine and the screens, fed by recorded
outlines and keypoint files. They do not prove the camera, Vision on an iPhone, ML Kit speed on a
Galaxy A12, the body-pose models on real bodies, heat or real VoiceOver/TalkBack. Those stay
"device-only" until the phone test (artifact §13).

## 1. Where the code lives

| Part | iOS | Android | Copied from |
|---|---|---|---|
| Pure rules + lock state machine | `CaptureModel` target (Features package, no Apple UI imports, builds on Linux) | `:feature:capture`, package `app.aistylist.feature.capture.domain` (pure Kotlin, no Android imports) | `HomeModel` / `:feature:home` |
| View model | `CaptureModel` (`@Observable`) | `CaptureViewModel` (StateFlow) | same |
| Screens + camera plumbing | `CaptureFeature` target (SwiftUI, AVFoundation, Vision foreground mask + body pose) | `:feature:capture` (Compose, CameraX, LiteRT garment mask + ML Kit Pose; ML Kit ODT only as the fallback) | same |
| Debug harness (test frames, screen-reader flag, results log) | `CaptureDebug` target, linked only in the Dev configuration | `:feature:capture-debug`, `debugImplementation` only | the design-system catalog (Dev-only link on iOS, `debugImplementation(project(":core:designsystem-catalog"))` on Android) |
| Thresholds, timings, hint keys, family ids | generated `CaptureRules.swift` | generated `CaptureRules.kt` | `reason-codes` registry |
| Entry point | "Add item" button on the Home placeholder, Dev builds only (Q-F) | same | Home debug tools |

**One source for every number.** CLAUDE.md puts shared constants in `shared-kernel`. The rules have
three readers (iOS, Android, the frame generator), so they live in
`packages/shared-kernel/registry/capture-rules.json` (+ `.schema.json`) and reach the apps through
the existing kernel generator (`tools/codegen/gen-kernel.mjs`, `just generate`). Wiring needed: the
Features package depends on the generated `AIStylistKernel` product (no network code in it), and
`:core:data` already compiles `packages/contracts/gen/kotlin-client/kernel` as a `srcDir`, so
`:feature:capture` depends on `:core:data` (module-graph rule update). The mask numbers both apps
share are the `mask` block, and the live-outline numbers are the `outline` block (§17). Copy (button labels, hints) is UI text and lives in each app's string resources,
byte-identical, keyed by the registry's hint keys.

**Dependencies.** iOS: none new (AVFoundation and Vision are system frameworks). Android, from
Google Maven, checked 2026-10-22: CameraX (`androidx.camera`, 1.6.2 stable), ML Kit Object Detection
(`com.google.mlkit:object-detection:17.0.2`, bundled model), and ML Kit Pose Detection, base model
(`com.google.mlkit:pose-detection:18.0.0-beta5`; beta, no SLA; about +10.1 MB; owner-approved
2026-10-22, Q-A), and LiteRT (`com.google.ai.edge.litert:litert:1.4.2`) with the U²-Netp model for
the item mask (owner-approved 2026-10-22, ADR 0013). No Play-services API. The final report lists every addition with its version.

## 2. Category picker and shape families

The picker opens first in single capture. Batch and import skip it (Q16, Q17).

| Tile (label / subtitle) | Family id | Default mode | Modes offered | Test ID |
|---|---|---|---|---|
| Top / T-shirts, shirts, knitwear, hoodies | `top` | flat | flat, hanger, worn | `cap-picker-family-top` |
| Trousers / Jeans, trousers, leggings, joggers | `long-bottom` | flat | flat, hanger, worn | `cap-picker-family-long-bottom` |
| Shorts and skirts | `short-bottom` | flat | flat, hanger, worn | `cap-picker-family-short-bottom` |
| Dress or jumpsuit | `one-piece` | flat | flat, hanger, worn | `cap-picker-family-one-piece` |
| Jacket or coat | `outerwear` | flat | flat, hanger, worn | `cap-picker-family-outerwear` |
| Shoes | `shoes` | flat | flat | `cap-picker-family-shoes` |
| Bag | `bag` | flat | flat, hanger | `cap-picker-family-bag` |
| Accessory / Hats, belts, scarves, glasses, watches, jewellery | `small-item` | flat | flat | `cap-picker-family-small-item` |
| Underwear and swimwear | (sub-pick) | flat | flat, hanger; worn only after opt-in | `cap-picker-family-underwear` |
| Not sure | `generic` | flat | flat, hanger, worn | `cap-picker-not-sure` |

Also on the picker: "Many items (batch)" `cap-picker-batch`, "Import from photos"
`cap-picker-import`, close `cap-picker-close`.

**Underwear sub-pick** (after the opt-in sheet on first use): Bra or top → `top`; Briefs or
bottoms → `short-bottom`; Swimsuit or bodysuit → `one-piece`; Tights → `long-bottom`; Socks →
`small-item`. Test IDs `cap-picker-underwear-top`, `-bottoms`, `-swimsuit`, `-tights`, `-socks`.

These are shape families, not taxonomy ids, so no category list is copied into the apps. When the
P06-T01 registry lands, each registry category gets a `captureFamily` field and the picker reads it.

## 3. Live checks: exact starting values

All values are in `capture-rules.json`. Coordinates are normalised to the analysis frame (0–1,
portrait, origin top-left). "Box" = the item's bounding box, from the item mask on both apps: the
Vision foreground instance mask on iOS, the LiteRT segmenter mask split into connected components on
Android. Only if the Android segmenter cannot load do ML Kit object boxes stand in (doc-10 fallback).

| Check | Rule | Value | Locks? |
|---|---|---|---|
| Evaluation rate | The lock machine reads the latest detector result at most once per | 100 ms (10 Hz) | — |
| Analysis frame | iOS preview-sized video buffers; Android `ImageAnalysis` target | 640 × 480, KEEP_ONLY_LATEST | — |
| Mask cadence | iOS: Vision foreground instance mask. Android: LiteRT segmenter. Newest frame only, one request in flight | every 250 ms; every 1000 ms while the phone is hot (Android `THERMAL_STATUS_MODERATE` or worse; iOS `ProcessInfo.ThermalState.serious` or worse, added 2026-10-22 for parity, `CaptureMaskCadence`) | — |
| Item found | ≥ 1 mask instance (iOS: foreground instance; Android: mask component) with area ≥ 0.5 % of the frame. Android fallback: ≥ 1 ML Kit object | — | yes |
| Edge band | Width of the band along each edge | 2 % of that dimension | — |
| Cut off | Mask pixels inside an edge band span more than this share of that edge's length | > 4 % (top edge in hanger mode: > 10 %) | yes |
| Cut off (Android fallback only) | ML Kit box edge inside the edge band | any | yes |
| Too small | Box area ÷ frame area below the family minimum | `top` 0.20, `long-bottom` 0.15, `short-bottom` 0.12, `one-piece` 0.18, `outerwear` 0.20, `shoes` 0.06, `bag` 0.08, `small-item` 0.015, `generic` 0.08; worn mode, every family: 0.25 | yes |
| Steady (motion) | Box centre moves less than this between two evaluations, and box area changes less than. The boxes compared come from two different detector results: iOS reuses one mask for about 2.5 evaluations, and a reused mask keeps the verdict of its own comparison (fix 2026-10-22, §17) | Δx, Δy ≤ 0.02; area ≤ 8 % | yes |
| Steady (sharpness) | Variance of the 3×3 Laplacian on luma inside the box, luma scaled so the long side is 320 px | ≥ 12 | yes |
| Steady (device motion, phones only) | iOS user acceleration and rotation rate; Android linear acceleration (accelerometer minus low-pass gravity, α = 0.8) | ≤ 0.08 g, ≤ 0.5 rad/s; ≤ 0.8 m/s² | yes |
| Too dark | Mean luma of the whole frame (0–255) | < 45 | **no**, hint |
| Too bright | Mean luma, or share of pixels with luma ≥ 250 | > 215, or > 25 % | **no**, hint |
| Tilt (flat mode only, phones only) | Angle between gravity and the phone's back axis | hint on > 20°, clear at < 15° | **no**, hint |
| Several items | More than one mask instance, none overlapping the item | — | **no** (Q15; "Which item?" stays post-shot, P06) |
| Partly covered (C32; flat and hanger, never worn) | Another detected object's box overlaps the item's box by more than this share of the smaller box, and covers at least this share of the frame. Both apps: the boxes of the other mask instances (iOS: Vision foreground instances; Android: mask components). Android fallback: the other ML Kit boxes (multiple objects on) | > 0.5; ≥ 0.005 | yes |
| Category matches pick | — | not checked | **no** (Q15) |

**Worn mode** (Q-A, decided 2026-10-22: (b)): the edge rule is off. Item found, size ≥ 0.25 and
steady still lock. A body-part check also locks, on both apps. Its values sit in the `worn` block of
`capture-rules.json`.

| Body check | Rule | Value | Locks? |
|---|---|---|---|
| Detector (iOS) | `VNDetectHumanBodyPoseRequest` (built in), same frame and handler as the mask request, newest frame only, one request in flight, worn mode only | every 250 ms | — |
| Detector (Android) | ML Kit Pose Detection, base model, `STREAM_MODE`, on the same `ImageAnalysis` frame as the live checks, one frame in flight, worn mode only | every analysis frame | — |
| Keypoint present (iOS) | Joint `confidence` (0–1) of `VNHumanBodyPoseObservation`, and the point inside the frame minus the edge band (Vision's origin is bottom-left; flip y first) | ≥ 0.3, and 0.02 ≤ x, y ≤ 0.98 | — |
| Keypoint present (Android) | `PoseLandmark.getInFrameLikelihood()` (0–1), and `getPosition()` inside the frame minus the edge band | ≥ 0.5, and 0.02 ≤ x, y ≤ 0.98 | — |
| Required parts present | Every required keypoint of the family (below) is present. Left and right both count. No person found = every part missing | per family | yes |

| Family (worn) | Required keypoints | Hint |
|---|---|---|
| `top`, `outerwear` | both shoulders, both hips | `cap-hint-body-shoulders-hips` |
| `long-bottom` | both hips, both ankles | `cap-hint-body-hips-ankles` |
| `short-bottom` | both hips, both knees | `cap-hint-body-hips-knees` |
| `one-piece` | both shoulders, both knees (dress length is unknown, so ankles are not required) | `cap-hint-body-shoulders-knees` |
| `generic` | none: the item is unknown, so no body check | — |

Shoes, bag and small-item have no worn mode (§2), so the check never runs for them. Underwear
sub-picks use the rule of the family they map to (§2). The body check runs only after "item found"
passes, so an empty frame still reports `no-item`. Library import has no mode, so no body check.
If the pose model fails to load or errors, the doc-10 fallback applies: no lock from the body check,
the hint stays as a tip, "Take photo anyway" shows at once.

**Deviation from the artifact, on purpose.** §17.4 says light "blocks only when very dark [E]". The
owner's Q15 answer (a) says light and tilt are hints only. This brief follows Q15: light never locks.
A frame too dark to find the item locks as "no item found".

## 4. Lock state machine

Pure logic, same in both apps, unit-tested on Linux (`swift test`) and in Robolectric/JVM tests.

**Inputs**
- `Evaluation(t, item?: {box, edgeContact[top,bottom,left,right], instanceCount, sharpness}, lumaMean, clippedShare, deviceMotion?, tiltDegrees?, bodyParts?: {present: Set<Part>})`. `item = nil` means no item. `Part` is one of left/right shoulder, hip, knee, ankle; presence is decided by the §3 thresholds before the machine sees it. `bodyParts = nil` outside worn mode, or when the pose model is unavailable (fallback, §3).
- Events: `cameraReady(t)`, `tick(t)`, `shutterTapped`, `hardwareShutter`, `anywayTapped`,
  `captureFinished`, `backgrounded`, `foregrounded(t)`, `screenReaderChanged(Bool)`,
  `modeChanged(mode)`, `nextItemTapped` (batch).
- Context: family, mode (flat, hanger, worn), side (front, back, pair), flow (single, batch).

**States**
1. `idle` — not started or in the background.
2. `warmingUp` — camera ready, no evaluation yet. Locked.
3. `locked(reason)` — `reason` is the highest-priority failing blocking check: `no-item`, `cut-off`,
   `body-parts-missing` (worn mode only), `covered` (flat and hanger only), `too-small`, `not-steady`
   (order of §6).
4. `unlocked(progress)` — manual shutter on, ring fills from 0 to 1.
5. `capturing` — photo requested; all input ignored.
6. `cooldown` — batch only, after a capture; locked until the next item.

**Transitions (exact)**
- `warmingUp` → `locked` or counting on the first evaluation.
- The first evaluation that sees an item can never pass "steady" (no previous box).
- `locked` → `unlocked(0)` after **3 consecutive passing evaluations** (≥ 300 ms at 10 Hz), each
  reading a different mask: a passing evaluation that reuses the last counted mask (the phone's mask
  comes every 250 ms, evaluations every 100 ms) holds the streak, so one chance-still mask read three
  times never unlocks (2026-10-22, found with the harness's realistic mask cadence; unlock then takes
  about 800 ms at the phone's 250 ms mask cadence, on both apps).
  Haptic "unlock". Announce "ready".
- `unlocked`: each passing evaluation advances the ring. The ring is full after **500 ms** of
  passing evaluations (owner, 2026-10-22; was 1000 ms), counted from the unlock, and at least 3
  evaluations. Full ring → auto-capture
  → `capturing`.
- `unlocked`: one failing evaluation pauses the ring (no advance, no reset).
  **3 consecutive failing evaluations** → `locked(reason)`, ring reset to 0. No haptic.
- `shutterTapped` / `hardwareShutter` in `unlocked` → `capturing`. Ignored while locked unless
  "Take photo anyway" is visible, then it acts as `anywayTapped`.
- `anywayTapped` → `capturing` (trigger `anyway`, reason recorded).
- `captureFinished` → single flow: leave for the review screen. Batch: `cooldown`.
- `cooldown` → `locked` after 3 consecutive no-item evaluations, or after 3 consecutive
  evaluations whose box overlaps the captured box by IoU < 0.5, or on `nextItemTapped`.
- `backgrounded` → `idle` (camera and analysis stop; nothing half-saved). `foregrounded` →
  `warmingUp`, all counters and the anyway timer restart.
- `modeChanged` → counters reset to `locked`; the anyway timer does **not** restart.
- **Stale feed (2026-10-22, owner's reliability request):** `locked` or `unlocked` → `warmingUp` when no
  detector result arrived for `evaluation.staleFeedAfterMs` (2000 ms; an interruption, a stalled
  detector), checked on the clock tick. Counters, the ring, the previous box and the live outline reset;
  the hint shows `cap-hint-warming-up`; the anyway reason line waits for the next blocking hint; the anyway
  timer keeps running. Capturing, cooldown and idle are unaffected. Frames that return are evaluated as
  after `cameraReady`. Never fires while frames flow (sweeps feed one every frame), so the simulator
  sweeps cannot exercise it; unit tests on both apps do (`ShutterLock.feedStalled`,
  `LockState.onFeedStalled`).

Minimum time from the first good frame to auto-capture with the phone's 250 ms masks and one counted
pass per mask: unlock after about 800 ms, then the 500 ms ring, about 1.3 s in all (owner: "~1–1.5 s
steady"). With a 1000 ms ring it measured about 1.8 s (iOS harness sweep, 2026-10-22), so the owner
shortened the ring and kept the strict three-mask unlock. On a slower phone the step takes longer;
the device test measures it.

**Outputs:** `shutter` (locked, unlocked, capturing), `ringProgress` 0–1, `hint` key, `anywayVisible`,
`anywayReason`, `hardwareShutterEnabled` (= unlocked or anyway visible), and one-shot effects:
`requestCapture(trigger)`, `announce(text)`, `haptic(kind)`.

## 5. Timing

| Item | Value |
|---|---|
| "Take photo anyway" delay | **10.0 s** of foreground time since `cameraReady`, while not captured. Not reset by lock/unlock flips or mode changes. Restarts on the back step, after each batch capture and on return from the background. Once shown, it stays until the screen closes |
| With a screen reader (or the debug flag) | Visible from `cameraReady` |
| First hint | The family instruction (`guide`) shows for the first **1.5 s** after `cameraReady`, unless the shutter unlocks earlier |
| Hint change | A new hint replaces the shown one only when it held for **2 consecutive evaluations**, and the shown one has been visible ≥ **1.0 s**. `capturing` replaces at once |
| Speech | On hint change only. At least **1.5 s** between utterances. The same text is not spoken again within **5 s** |
| ML Kit warm-up | `warming-up` hint until the first evaluation, however long |

## 6. Guidance messages (priority order)

Only one shows at a time. Blocking messages come first; a non-blocking hint shows only when no
blocking check fails, and may show while the ring fills. Every hint label carries the hint's test ID.

| # | Key / test ID | Text on screen | Spoken | Vibration | Blocks |
|---|---|---|---|---|---|
| 1 | `cap-hint-warming-up` | Looking for the item… | — | — | yes |
| 2 | `cap-hint-no-item` | Point the camera at the item | No item found. Point the camera at the item. | — | yes |
| 3 | `cap-hint-cut-off-multiple` | Move back. The item is cut off. | Move back. The item is cut off. | — | yes |
| 3 | `cap-hint-cut-off-top` | Move back. The top is cut off. | same | — | yes |
| 3 | `cap-hint-cut-off-bottom` | Move back. The bottom is cut off. | same | — | yes |
| 3 | `cap-hint-cut-off-left` | Move back. The left side is cut off. | same | — | yes |
| 3 | `cap-hint-cut-off-right` | Move back. The right side is cut off. | same | — | yes |
| 3b | `cap-hint-body-shoulders-hips` | Step back so your shoulders and hips show | same | — | yes (worn) |
| 3b | `cap-hint-body-hips-ankles` | Step back so your hips and ankles show | same | — | yes (worn) |
| 3b | `cap-hint-body-hips-knees` | Step back so your hips and knees show | same | — | yes (worn) |
| 3b | `cap-hint-body-shoulders-knees` | Step back so your shoulders and knees show | same | — | yes (worn) |
| 3c | `cap-hint-covered` | Something is covering the item | same | — | yes (flat, hanger) |
| 4 | `cap-hint-too-small` | Move closer | The item is too small. Move closer. | — | yes |
| 5 | `cap-hint-not-steady` | Hold the phone still | Hold the phone still. | — | yes |
| 6 | `cap-hint-too-dark` | Too dark. Turn on a light. | same | — | no |
| 7 | `cap-hint-too-bright` | Too bright. Move out of direct light. | same | — | no |
| 8 | `cap-hint-tilt` | Hold the phone flat above the item | same | — | no |
| — | `cap-hint-guide` | the family instruction (below) | same | — | — |
| — | `cap-hint-ready` | Keep still… | Ready. Keep still. | unlock: iOS `.success`; Android `CONFIRM` (API 30+), `EFFECT_CLICK` on API 29 | — |
| — | `cap-hint-capturing` | Taking photo | Photo taken. | iOS `.impact(.medium)`; Android `EFFECT_HEAVY_CLICK` | — |
| — | `cap-hint-next-item` | Next item | Ready for the next item. | — | batch `cooldown` |

Cut-off direction: one edge touched → that edge's message; two or more → `cut-off-multiple`.
Edges are named as the user sees the screen. Body hints (3b) show only in worn mode, where cut-off
(3) is off; the family picks the row (§3). The `generic` family has no body hint.

**"Take photo anyway" reason line** (`cap-anyway-reason`), from the lock reason when the button
appears: no item → "No item found. A plain surface in a different colour helps." (C8, C9); cut off
in flat mode → "Too big to fit? Try hanger mode." (C11); otherwise the blocking hint's text.

**Family instructions** (`cap-hint-guide`):

| Family | Flat | Hanger | Worn | Back step |
|---|---|---|---|---|
| top | Lay it flat, sleeves out | Hang it on a door, front facing you | Stand back so your top fits in the frame | Turn it over. Back side up. |
| long-bottom | Lay it flat, both legs straight | Hang it by the waist | Stand back so your legs fit in the frame | Turn it over. Back side up. |
| short-bottom | Lay it flat, waistband at the top | Hang it by the waist | Stand back so it fits in the frame | Turn it over. Back side up. |
| one-piece | Lay it flat, straps or sleeves out | Hang it on a door, front facing you | Stand back so the whole length fits | Turn it over. Back side up. |
| outerwear | Lay it flat. Close the zip or buttons. | Hang it, zip or buttons closed | Stand back so the whole jacket fits | Turn it over. Back side up. |
| shoes | One shoe, side view | — | — | Pair step: Both shoes, side by side (Q-D) |
| bag | Front view, strap up | Hang it by the strap | — | Turn it around. |
| small-item | Place it on a plain surface. Move close. | — | — | Turn it over. |
| generic | Lay it flat on a plain surface | Hang it on a door | Stand back so the item fits | Turn it over. Back side up. |

## 7. Modes and paths

**Back photo (Q5).** After the front shot, the review screen (`cap-screen-review`) shows the photo
and asks "Is the back different?" with two choices: Same (default, `cap-review-back-same`) and
Different (`cap-review-back-different`). "Same" → Done (`cap-review-done`). "Different" → "Take back
photo" (`cap-review-take-back`) reopens the camera with the back guide and a "Back" step label
(`cap-step-back`); "Skip" (`cap-camera-skip-back`) returns to review. Review then shows both photos
(`cap-review-photo-front`, `cap-review-photo-back`). "Retake" (`cap-review-retake`) replaces the
front. Shoes ask "Add a photo of the pair?" instead (Q-D).

**Batch (Q16).** Generic guide, live checks, auto-capture, no category tap, no back question
(Q-C). After each capture: count chip (`cap-batch-count`, "3 items"), state `cooldown`, "Next item"
(`cap-batch-next`), "Done" (`cap-batch-done`) → a local thumbnail list (`cap-screen-batch-summary`).

**Library import (Q17).** From the picker and from the camera bottom bar (`cap-camera-import`). The
system picker, one photo in v1 (iOS `PHPickerViewController`; Android `PickVisualMedia`, part of
androidx.activity, no new dependency). The same checks run once on the still: item found, cut off,
too small, too dark, too bright. No steadiness or tilt. Each failing check shows as a tip on
`cap-screen-import-tips` (`cap-import-tip-<hint key>`), with "Keep anyway" (`cap-import-keep-anyway`)
and "Choose another" (`cap-import-choose-another`). No failing check → straight to review. An import
is never refused.

**Underwear and swimwear opt-in (C19).** Off by default, asked once. The first time the user taps
the Underwear tile, a sheet (`cap-optin-sheet`) asks:
- Title: "Photos of underwear and swimwear"
- Body: "These are photographed laid flat or on a hanger. Do you also want to take photos while
  wearing them? You can change this later."
- Buttons: "Flat and hanger only" (`cap-optin-flat-only`) and "Also allow worn photos"
  (`cap-optin-allow-worn`).
The answer is stored on the device only (UserDefaults / DataStore), never sent, never in analytics.
Until a Settings screen exists, it can be changed from the camera menu while an underwear family is
active (`cap-camera-underwear-worn-toggle`). Worn mode (`cap-mode-worn`) is absent for underwear
unless allowed. **Needs the `security-privacy-review` skill before this ships.**

**Permission denied (C23).** `cap-screen-permission`: "The camera is needed to photograph
your clothes. Photos stay on your phone until you save an item." Buttons "Open Settings" (`cap-permission-settings`) and "Import from photos"
(`cap-permission-import`). No camera at all (simulator, real-camera source):
`cap-screen-no-camera` with the import button.

**Hardware shutter (C26).** iOS `onCameraCaptureEvent(isEnabled:)` follows `hardwareShutterEnabled`,
so the volume and Camera Control buttons lock with the on-screen shutter. Android: volume keys are
consumed as shutter only when `hardwareShutterEnabled`; otherwise they keep their system behaviour.

## 8. Accessibility

- With VoiceOver/TalkBack on: "Take photo anyway" visible from the start; hints announced (iOS
  `AccessibilityNotification.Announcement`, Android polite live region on the hint label); the
  shutter's label says why it is locked: "Take photo, unavailable: <hint text>".
- Speech without a screen reader: Q-B.
- The guide outline never relies on colour: locked = dashed outline, unlocked = solid outline plus
  the ring; each hint has an icon and text. Outline is two-tone (light stroke over dark stroke) for
  3:1 contrast over any video.
- Shutter at the bottom centre, ≥ 44 pt / 48 dp; every control ≥ 44 pt / 48 dp.
- No time limit: the camera never closes on its own. Import one tap away. Help (`cap-camera-help`)
  opens a sheet with the flat-lay technique for blind users: "Lay the item flat. Hold the phone flat
  on top of it, screen up. Lift it slowly and follow the spoken hints."
- Dynamic Type / font scale: the hint label wraps to 3 lines, never truncates.
- Reduced motion: the ring fills without animation easing; no pulsing outline.

## 9. Analytics events

Through the existing consent-gated analytics port, registered in
`packages/contracts/events/analytics/events.json` (owner `closet`, `consentRequired: true`). Two
reuse the names P06 §11 already plans. Underwear picks report `shape_family: "private"` and no
`capture_mode`. No photo, mask, box or location data in any event.

| Event | Properties |
|---|---|
| `capture_started` (planned) | `mode` (single, batch, import), `shape_family`, `capture_mode` (flat, hanger, worn) |
| `item_captured` (planned) | `mode`, `retake_count`, `trigger` (auto, manual, anyway, hardware), `shape_family`, `capture_mode`, `side` (front, back, pair), `time_to_capture_ms`, `screen_reader_on` |
| `capture_shutter_unlocked` (new) | `shape_family`, `capture_mode`, `time_to_unlock_ms` (first unlock per photo only) |
| `capture_anyway_shown` (new) | `shape_family`, `capture_mode`, `lock_reason` (`no-item`, `cut-off`, `body-parts-missing`, `too-small`, `not-steady`) |
| `capture_abandoned` (new) | `shape_family`, `capture_mode`, `last_hint`, `time_open_ms` |
| `capture_back_answered` (new) | `shape_family`, `back_different` |
| `capture_import_checked` (new) | `tip_count`, `kept_anyway` |

## 10. Test IDs

Same pattern as the design system (`ds-<component>-<variant>-<state>`), prefix `cap-`. The same
string is the iOS `accessibilityIdentifier` and the Android `testTag` (resource id for Maestro).

- Screens: `cap-screen-picker`, `cap-screen-camera`, `cap-screen-review`, `cap-screen-import-tips`,
  `cap-screen-batch-summary`, `cap-screen-permission`, `cap-screen-no-camera`.
- Picker and opt-in: section 2 and section 7.
- Camera top bar: `cap-camera-close`, `cap-camera-help`, `cap-camera-torch` (phones with a torch
  only), `cap-camera-speech` (Q-B), `cap-camera-underwear-worn-toggle`.
- Mode switch: `cap-mode-flat`, `cap-mode-hanger`, `cap-mode-worn`; each with selected state in
  its accessibility value.
- Guide outline: `cap-guide-<family>-<mode>[-back|-pair]`, e.g. `cap-guide-top-flat`,
  `cap-guide-shoes-flat-pair`.
- Live outline (§17): `cap-outline`, accessibility value `locked` or `unlocked`. The guide keeps its
  `cap-guide-*` element while the live outline shows.
- Shutter: one control whose ID follows its state: `cap-shutter-locked`, `cap-shutter-unlocked`,
  `cap-shutter-capturing`. Ring: `cap-ring`, value = percent.
- "Take photo anyway": `cap-anyway-button`, reason `cap-anyway-reason`.
- Hint label: one label whose ID follows the hint (section 6).
- Steps and batch: `cap-step-back`, `cap-step-pair`, `cap-camera-skip-back`, `cap-batch-count`,
  `cap-batch-next`, `cap-batch-done`, `cap-camera-import`.
- Review and import: section 7.
- Home entry: `home-open-capture`.
- Debug only: `cap-debug-panel`, `cap-debug-source-camera`, `cap-debug-source-frames`,
  `cap-debug-frameset-<set id>`, `cap-debug-screenreader-toggle`, `cap-debug-spoken-log`,
  `cap-debug-lock-state`.

## 11. Debug harness (Dev / debug builds only)

- **Frame source switch:** real camera or a frame set. A frame set plays images through the same
  analysis path, the same lock machine and the same screens. Selected by launch argument
  (`captureFrameSet=<id>`, `captureScreenReader=1`, `captureSweep=1`; Maestro `launchApp: arguments`)
  or by the debug panel. Release, Preview and Prod builds do not contain the harness: iOS links
  `CaptureDebug` only in Dev; Android has it only in `debugImplementation`. A check in
  `just ios-check` / `just android-check` greps the release artefacts for the harness symbols.
- **Playback:** 30 frames per second into the detector; each image repeats for its segment's frame
  count (default 180 = 6 s); `jitter` moves each frame by a random offset up to the given share of
  the frame (shaky hands, default 0.06); the last segment loops until the screen closes.
- **Masks:** both apps read the mask PNG stored next to each image (made on the Mac by the same
  Vision request, `just capture-frames`) and measure it the same way. A second Android sweep runs the
  live LiteRT segmenter on every frame image, for information only.
- **Keypoints (worn frames):** each worn frame has a keypoint JSON next to it
  (`{ "parts": { "leftShoulder": {"x","y","present"}, … } }`, normalised, origin top-left). The frame
  source feeds it as `bodyParts` when the live pose model cannot run. Vision body pose on the iOS
  Simulator and ML Kit Pose on the arm64 emulator are both unverified; harness step 6.5 tries each
  live model once and the scoreboard records "live" or "keypoint file" per platform.
- **Screen-reader flag:** sets the `screenReaderChanged(true)` input; spoken text goes to
  `cap-debug-spoken-log` (last 3 lines) as well as the platform announcement.
- **Hold switches (2026-10-22):** `captureHoldFirstFrameMs` and `captureHoldCaptureMs` (real time only)
  hold back a set's first frame and make each photo take that long, so the two passing states
  `cap-hint-warming-up` and `cap-hint-capturing` stay on screen long enough for the light and dark
  screenshots (`e2e/capture/hints.yaml` shots 18 and 19). A sweep ignores them.
- **Sweep mode:** plays every good image of a family in a row, 1 s of empty background between
  them; a capture is recorded, not shown, and the camera carries on.
- **Results log:** the debug build writes one JSON line per segment (set id, family, mode, every
  state change with its time from segment start, first unlock time, anyway time, final hint) to
  `capture-results.jsonl` in the app's data folder. The recipes pull it and compare it with the
  expected-result file.
- **Expected-result file** per variant: `{ "shutter": "unlocked" | "locked" | "either-or-anyway",
  "hint": "<test ID>", "maxUnlockMs": 3000, "anywayAtMs": 10000, "platform": {…overrides} }`.
  Clock: from the first frame of the segment.
- **Frame generator:** a Swift script on macOS (Core Image + Vision; no new dependency). Base images:
  the CC0 Grigorev clothing dataset, ≥ 5 good images per family where the dataset has them, picked
  by a contact-sheet review plus a mask check (one instance, no edge contact). The dataset has no
  bags and few small items; those families use drawn silhouettes, marked "synthetic" in the
  scoreboard. Variants per base image: cut off at each of the 4 edges (25 % of the box past the
  edge), too small (35 % of the family minimum), too dark (mean luma 30), motion-blurred (Core Image
  motion blur, 25 px at 640 px), jittered (playback jitter 0.06), two items side by side, plain
  background with no item. Output: `artifacts/capture-camera/frames/` (gitignored).
- **Worn frames are synthetic.** The CC0 dataset has no people, and no real-person photo is used.
  The generator draws a plain human silhouette from simple shapes (head circle, torso and limb
  rounded rectangles) at keypoint positions it chooses, lays a garment cut-out from the dataset over
  it, and writes the keypoint JSON itself (ground truth). Variants per worn family: whole body in
  frame; shoulders cut off; hips cut off; knees cut off; ankles cut off (each: the part 25 % of the
  torso height past the edge); plus the shared too-small and jittered variants. Simple shapes are not
  real bodies, so the live pose models are not exercised on real bodies in the simulator; that part
  is device-only.

## 12. Cases C1–C31

"Sim" = simulator-testable on both the iOS Simulator and the Android emulator with the harness.
Where the platforms differ, the expectation is per platform.

| Case | Class | What the simulator run asserts |
|---|---|---|
| C1 T-shirt flat | sim | `top` flat: unlock ≤ 3 s, ring, auto-capture, review |
| C2 hanger | sim | hanger mode unlocks; a hook touching the top edge up to 10 % still unlocks, on both apps (both measure the mask the same way, owner's mask decision 2026-10-22). Frame sets (2026-10-22): `<family>-hanger-01-hook` (hook at 6.25 % of the top edge, unlocks) and the same frame as `<family>-flat-01-hook` (locked `cap-hint-cut-off-top`, "Try hanger mode"), every family with hanger mode; `tools/capture-frames/README.md` "Edge grazes" |
| C3 mirror selfie (worn) | sim (rules on keypoint files); live pose on real bodies device-only | the same frame touching the edges unlocks in worn mode and locks in flat mode. Body check (Q-A b): the whole-body synthetic frame unlocks; each variant missing a required part locks with that family's `cap-hint-body-*`, anyway at 10.0 ± 0.5 s; `generic` worn never shows a body hint |
| C4 shoes | sim | side-view guide; pair step (Q-D) |
| C5 small item | sim | `small-item` min 0.015 unlocks a ring-sized item; "Move closer" below it |
| C6 bag strap | sim | a strap grazing an edge ≤ 4 % unlocks, on both apps (mask measure, owner's mask decision 2026-10-22). Frame sets (2026-10-22): `bag-flat-0N-strap-graze`, the strap at 1.5–2.1 % of the top edge, unlocks |
| C7 back photo | sim | "Different" → back guide, `cap-step-back`, skip and capture both work |
| C8 dark on dark | sim (the detector on real fabric: device-only) | two strict sets per base: `dark-on-dark` (true mask) unlocks; `dark-on-dark-weak` (no instance) locks with `no-item` and anyway at 10.0 ± 0.5 s with the surface tip |
| C9 white on white | sim (as C8) | same as C8: `white-on-white`, `white-on-white-weak` |
| C10 patterned sheet | sim (as C8) | same as C8: `patterned`, `patterned-weak` |
| C11 coat too big | sim | `cut-off-multiple`, anyway at 10 s with "Try hanger mode" (`<family>-flat-01-too-big`) |
| C12 crumpled | not in v1 | no rule; only the guide text helps |
| C13 dim room | sim (torch: device-only) | `too-dark` hint, shutter still unlocks |
| C14 shaky hands | sim | jitter: `not-steady`, no unlock, anyway at 10 s |
| C15 two items | sim | does not lock; "Which item?" after the shot: not in v1 (P06) |
| C16 wrong category | not in v1 | server check (P06) |
| C17 Not sure | sim | generic guide, generic size minimum |
| C18 another person | not in v1 | face removal is upload-pipeline work (P06) |
| C19 underwear opt-in | sim | sheet once; worn mode absent until allowed; toggle changes it |
| C20 batch of 10 | sim | 10 items with empty gaps → 10 captures, count 10, no picker, no back question |
| C21 library import | sim (debug import of a frame-set image); the system picker by hand once | tips, keep anyway, choose another |
| C22 offline | sim | capture code makes no network call (unit test on the ports; Android run with network off) |
| C23 permission denied | sim | iOS `simctl privacy revoke camera`, Android `pm revoke`: permission screen, import works |
| C24 background | sim | home and back: camera restarts in `warmingUp`, anyway timer restarts, nothing saved half-way |
| C25 screen reader | sim (debug flag); real VoiceOver/TalkBack device-only | anyway visible at once; spoken log shows one-step hints |
| C26 motor | sim: auto-capture, target sizes, Android volume key (`adb shell input keyevent`); iOS hardware buttons device-only | — |
| C27 colour-blind | sim | screenshots: dashed vs solid outline, icon + text, contrast in light and dark |
| C28 Galaxy A12 | device-only | |
| C29 iPhone 11 / SE 2 | device-only | |
| C30 heat | device-only | |
| C32 partly covered | sim (rules on ground-truth instances); Vision and ML Kit on real objects device-only | `covered-inside` and `covered-edge`: locked `covered`, `cap-hint-covered`, anyway at 10.0 ± 0.5 s with the covered hint; the `two-items` sets still unlock |
| tilt | sim (stored `tiltDegrees`); real sensors device-only | `tilt` (25°) unlocks with `cap-hint-tilt`; `tilt-under` (18°) unlocks with `cap-hint-ready` |
| glare | sim | `overexposed` and `glare-window` unlock with `cap-hint-too-bright`; `glare-spots` unlocks with `cap-hint-ready` |
| C31 no Google Play | device-only | LiteRT with the U²-Netp model, ML Kit ODT (fallback) and ML Kit Pose (base) are all bundled in the app; no Play Services API is called in v1, and the only Play Services code linked is the `play-services-tasks` library that ML Kit depends on |

## 13. Not in v1

Category check, crumple detection, post-shot "Which item?", face removal, a body check for the
`generic` family in worn mode, iOS 27 box-seeded segmentation, lens-smudge hints, multi-select
import, the upload queue and the confirm card. (Worn-mode body checks for the other families are in
v1: Q-A decided (b), §3.)

## 14. Questions for the owner (all decided 2026-10-22, §16)

- **Q-A. Worn-mode body check on Android.** **Decided 2026-10-22: (b)**, against the recommended (a).
  ML Kit Pose (base model) is approved on Android; both apps check body parts in worn mode and a
  missing required part locks the shutter (§3, §6).
  - (a) v1 uses the same reduced worn rule on both apps (edge rule off, size, steady); the body
    check waits for a later version. Was recommended.
  - **(b) Approve ML Kit Pose on Android and check body parts on both apps. Chosen.**
  - (c) Body check on iOS only.
- **Q-B. Spoken hints.** **Decided 2026-10-22: (a).**
  - **(a) Spoken only when VoiceOver/TalkBack is on; a speaker button (`cap-camera-speech`) turns
    speech on for anyone else. Recommended**: talking cameras surprise sighted users in public.
  - (b) Always spoken.
- **Q-C. Back question in batch.** **Decided 2026-10-22: (a).**
  - **(a) Batch skips it; the batch review stack (P06-T10) asks it later. Recommended**: keeps batch
    fast.
  - (b) Ask after every batch shot.
- **Q-D. Shoes.** **Decided 2026-10-22: (a).** The artifact says "side view of one shoe, then the pair".
  - **(a) After the one-shoe shot, ask "Add a photo of the pair?" through the same step as the back
    photo. Recommended.**
  - (b) One shot only.
- **Q-F. Where the camera opens from on this branch.** **Decided 2026-10-22: (a).**
  - **(a) An "Add item" button on the Home placeholder, Dev builds only, until a Closet tab exists.
    Recommended**: v1 saves nothing yet, so it should not reach Preview or Prod users.
  - (b) Visible in every build.

## 15. Order of work after approval

1. Canvas prototype (`ui-prototype-first`), owner approval.
2. `capture-rules.json` + generator wiring + analytics events (`just generate`).
3. Lock machine + rules with unit tests, both apps.
4. Screens, camera plumbing, harness.
5. Frame generator, masks/boxes/keypoints, Maestro flows in `e2e/capture/`, the `just capture-*` recipes.
6. The loop (task step 7) until the exit criteria hold.

## 16. Owner answers (2026-10-22)

Answered by the owner through the question tool on 2026-10-22. These override earlier sections where they differ.

| Item | Answer |
|---|---|
| Brief | Approved as written. |
| Q-A worn body check | **(b) Approve ML Kit Pose.** Both apps check body parts in worn mode: iOS uses Vision body pose (built-in); Android adds ML Kit Pose Detection (base model). A missing required body part **locks the shutter**, like the cut-off rule, with a step-back hint ("Step back so your shoulders and hips show"); "Take photo anyway" still appears after 10 s, and at once with a screen reader. |
| Q-B speech | (a) Spoken only with VoiceOver/TalkBack on; speaker button `cap-camera-speech` turns it on for anyone else. |
| Q-C batch back question | (a) Batch skips it. |
| Q-D shoes | (a) After the one-shoe shot, ask "Add a photo of the pair?" through the back-photo step. |
| Q-F entry point | (a) "Add item" on the Home placeholder, Dev builds only. |
| Commits | Commit to `feat/capture-camera` and `git push -u origin feat/capture-camera` (private remote) are authorized. No PR, no merge, `main` untouched. |
| Canvas prototype | Self-review against `.claude/rules/design-system.md`, `.claude/rules/ios.md`, `.claude/rules/android.md`, the `ui-prototype-first` skill and DESIGN.md "Layout" + "Do's and Don'ts", record the check, then build. The owner reviews at the end. |
| Planning proposal | Apply the proposal diffs (updated for these answers) on this branch as one docs commit; mark the proposal APPLIED; leave the DEC wording as a draft for the owner. |
| shared-kernel + contracts | Change them on this branch, small and additive. Resolve later conflicts by merging `main` in, never by rebasing pushed commits. Record the risk in the handoff. |
| Stuck case (3 iterations, no progress) | Record it as BLOCKED in the scoreboard with attempts and evidence, then keep working on other cases. Never weaken tests or thresholds. |
| New dependencies | "Add what needed": add what the work needs and list every addition (name, version, why) in the final report for the owner to approve or revert. |
| Hard cases | 2026-10-22 owner: add hard cases C8–C11, tilt, glare and a new partly-covered rule; live outline approved pending a feasibility check; UI polish deferred. |
| Stability measure (2026-10-22) | 2026-10-22 owner: stability measure centres on the area centroid (was vertex mean); old 0.9522 / new 0.9680 (stored-frame flat jitter min; p5 0.9883); reason: vertex mean drifts with edge jaggies on an unchanged shape (0.907 vs 0.948). The tracker's blend keeps the vertex mean. |
| Hold-still ring (2026-10-22) | Shorten the ring from 1 s to 0.5 s (`lock.ringFillMs` 1000 → 500) and keep the strict unlock on three distinct masks: about 1.3 s from a steady item to the photo. |
| Scope | Owner, mid-turn: "You are allowed to do anything to make this as close as possible." Hard limits that still stand: no PR, no merge, no `main` changes, no rebase or force-push of pushed commits, no public publication of repo content, no real user or real-person photos, no weakened tests, expected files or thresholds (threshold changes only through the frame-set rule with old/new/reason). |

### Status log

- 2026-10-22: answers recorded; brief + proposal not yet committed.
- 2026-10-22: Q-A (b) folded in: worn-mode body check per family with keypoint thresholds (§3), lock
  reason `body-parts-missing` and `cap-hint-body-*` hints (§4, §6, §9), ML Kit Pose 18.0.0-beta5
  dependency (§1), synthetic worn frames + keypoint-file fallback (§11), C3/C31 (§12), Q-A–Q-F
  marked decided (§14); proposal updated and applied to docs 02, 10 and P06.
- 2026-10-22: owner narrowed scope to the camera tool only; analytics events and other non-blocking work are deferred to the owner.
- 2026-10-22: hard cases added (§3 covered row, §4, §6 row 3c, §12 C8–C10, C32, tilt, glare). New
  thresholds, `capture-rules.json` `covered` (no old value; new rule):
  - `aboveOverlapShare` 0.5. Derived from the frame set: the 41 second instances of the existing
    frames (all in `two-items` sets, 0.04 of the frame apart) overlap the item's box by 0.0 of the
    smaller box; the covered sets place the object at 1.0 (`covered-inside`) and 0.8
    (`covered-edge`) of its own box inside the item's box. 0.5 sits halfway, so loose ML Kit boxes of
    two items side by side (the shoe pair step) may overlap by up to half the smaller box before it
    locks, and the generator's margins (over 0.625 on covered sets, under 0.25 elsewhere) hold.
  - `minOtherBoxAreaShare` 0.005: the item-found minimum (`mask.minInstanceAreaShare`), so a box
    too small to count as an item never counts as a covering object either; the covered sets'
    objects cover at least 4 × that.
  - Feasibility: the Mac's Vision merged the object into the item in 66 of 66 covered composites
    (instance mask); in earlier trials it separated it in 0 of 225 (instance mask) and 0 of 225
    (objectness saliency) composites. On iOS the rule is therefore mostly a no-op on device until a detector separates the
    object; a merged object unlocks (a miss, not a false lock). Android turns ML Kit's multiple
    objects on for it; ML Kit on real objects is device-only.
- 2026-10-22 owner: live outline approved; Android uses LiteRT 1.4.2 + U²-Netp; UI polish and the canvas step deferred.
- 2026-10-22 (exit-loop session): C2 and C6 frame sets added (README "Edge grazes"; generator-only
  `Layout.grazePassFactor` 0.75 for deliberate grazes, no registry threshold changed); hold switches so
  warming up and capturing are screenshot; iOS mask cadence slows to `mask.hotIntervalMs` while the phone
  is hot (parity with Android); iOS `takePhoto` refuses an interrupted or stopped session instead of
  letting AVFoundation raise (device-only to prove).

## 17. Live outline

The on-screen outline traces the item as the camera sees it, instead of only the fixed family guide.
Approved by the owner on 2026-10-22 (§16): "Always be prepared technically before doing UI. For now I
don't care about UI or anything. You can even use native buttons. I need the core feature to be
working." The `ui-prototype-first` canvas step is deferred by the owner for this change; the design
rules still apply (below).

**Where the numbers live.** Every number below is in `capture-rules.json`: the `outline` block, and
`mask.intervalMs` for the cadence. `just generate` emits them as `CaptureRules.Outline` and
`CaptureRules.Mask` for both apps.

**Shared reference.** `tools/capture-frames/parity/outline-parity.json` repeats those numbers
(`params`) and holds expected results for hand-made and real masks, IoU pairs and tracker sequences.
Both apps' parity tests check that the generated numbers equal its `params` and that their results
match; tolerance 0.005 of the frame per coordinate, never bit equality.
`outline_reference.py` next to it generates and checks it, and its README pins the details the
tolerance does not absorb (rounding, loop order, ties, IoU).

**Spec.**
1. **Input:** the item mask at the mask cadence. iOS: the Vision foreground instance mask, every
   250 ms (`mask.intervalMs`); the largest 3 instances that count as an item (`mask.minInstanceAreaShare`)
   are traced, largest first. Android: U²-Netp, prob > 0.5, the same cadence (every 1000 ms while the
   phone is hot, `mask.hotIntervalMs`); its components are the candidates.
2. **Instance hysteresis:** of the candidates, the one with the highest IoU ≥ 0.3 against the drawn
   outline is kept, unless the largest candidate has ≥ 1.5× its area. With none at ≥ 0.3, or no drawn
   outline, the largest wins.
3. **Crop:** the item's box grown by max(2 px, long side / 8, integer division), clamped to the frame.
4. **Downscale:** area average to a 64 px long side; a cell ≥ 0.5 is foreground. Cell edges round half
   to even on the exact value; the cell start is clamped to size − 1 (needed only when a crop under 64 px
   is upsampled; the spike's `contour.py` indexed past the crop there).
5. **Component:** the largest 8-connected one; ties keep the first in row-major order.
6. **Marching squares:** iso 0.5 on the area-averaged values inside that component, zero-padded, linear
   interpolation; saddles keep the foreground corners joined; segments linked undirected; the loop with
   the largest |area| is kept (outer only, holes filled); oriented clockwise on screen.
7. **Simplify:** Douglas–Peucker, ε = 0.5 grid px, split at the vertex farthest from vertex 0; under 3
   vertices keeps the unsimplified loop.
8. **Resample:** 64 points by arc length, starting where the vertical line through the area centroid
   meets the contour at its smallest y.
9. **Map:** normalised frame coordinates, origin top-left.
10. **Temporal:** one update per new mask (a reused mask changes nothing). Position and shape blend
    apart: the centroid is the vertex mean, the shape is the points minus the centroid, and the new
    shape is cyclically shifted to the least summed squared distance to the drawn shape. With
    IoU(new, drawn) ≥ 0.5 the centroid and the shape each take an EMA, α = 0.5. Below 0.5 the outline
    snaps (no animation): when the two centred shapes have IoU ≥ 0.5 (`outline.snapKeepsShapeAtLeastIou`) the
    centroid jumps to the new one and the shape still takes the EMA; otherwise the new outline replaces
    the drawn one. The first item replaces. It clears after 3 consecutive mask updates with no item
    (750 ms; not 3 rule evaluations). IoU everywhere: both polygons rasterised on a 64 × 64 grid over
    their joint box, cell centres, even-odd.
    **Changed 2026-10-22** (capture-sim run `2026-10-22-1502` on `7c06e36`, iOS 787/788 at the 250 ms
    mask cadence: `outerwear-flat-01-jitter` outline stability min 0.9498 < 0.95). Old: one EMA on the
    absolute points after cyclic alignment, and every snap replaced the outline. New: as above. Reason:
    a purely translated item's raw outline changes shape by up to 7 % between positions (crop and
    64 px grid quantisation), and each snap showed that raw shape; with the regenerated jitter reach,
    snaps between masks became common. Splitting centroid and shape alone gave the same numbers
    (measured: the alignment did not change); keeping the shape blend through a same-shape snap is what
    holds it. Stored-frame flat jitter min, sampled as the harness samples (a mask once playback
    advances 250 ms, 44 masks over 11.5 s): 0.9378 old, 0.9522 new (worn 0.8933 → 0.9377, not under
    the bar). Sweep at the 250 ms cadence (iPhone 17 Simulator, 788 segments): 788/788, flat jitter
    stability min 0.9522 (`outerwear-flat-01-jitter`), rule outcomes identical to the run before the
    change. The 0.95 bar is unchanged. Open for the owner: the margin is thin, and most of what is
    left is the measure, not the outline. Centring on the vertex mean, raw outlines of an unchanged,
    translated mask score as low as 0.907; centred on the area centroid they score 0.948, and the
    drawn outlines 0.968 (flat). **Changed 2026-10-22 (owner):** the stability measure centres each
    outline on its area centroid (shoelace; the vertex mean only for a polygon of area under 1e-9);
    the tracker's blend keeps the vertex mean. Stored-frame flat jitter min 0.9522 → 0.9680, p5 0.9883
    (1935 pairs); the 0.95 bar is unchanged.
11. **Rate:** at most every 250 ms, one request in flight (the mask's own cadence; Android 1000 ms while hot).
12. **Draw:** before an item is found, the faint family guide only (one camera-paper 2 stroke, no
    halo). Then the live outline `cap-outline`, two-tone like the guide was (camera-paper 2 over
    camera-ink 4): dashed while `locked`, solid when `unlocked` (C27). Between masks it moves over one
    mask interval; a snap jumps; with reduced motion it never moves. When the item is lost it
    cross-fades back to the guide (150 ms, the DESIGN.md reduced-motion crossfade). The guide keeps its
    `cap-guide-*` element (transparent) while the outline shows, so flows that assert it still pass.
13. **Location:** steps 3–10 are pure code in `CaptureModel` (`CaptureOutlineContour`,
    `CaptureLiveOutline`, Linux-tested); `CaptureCameraSession` owns the tracker and publishes
    `CaptureCameraOutput.outline`. Android mirrors them in `app.aistylist.feature.capture.domain`.

**Debug harness.** Sweeps play masks at the 250 ms mask cadence by default (`mask.intervalMs`: the
Android harness uses it for sweeps, and `just capture-sim` passes it to iOS). `captureMaskCadenceMs`
overrides it; 0 gives every frame a fresh mask. The rules and the live outline read the newest mask
and reuse it in between. The outline is traced from the stored mask, or `frame.instances.png`, moved
by the jitter. The results log adds per segment:
`outlineFirstMs`, `outlinePresentAtEnd`, `outlineUpdates`, `outlineSnaps`, `outlineIouMedian`,
`outlineIouMin` (drawn outline against the stored item mask it was traced from, as stored: an item
with a hole, such as a bag handle or a covered item, scores lower because the outline fills holes), and
`outlineStabilityMedian`, `outlineStabilityMin` (IoU of successive drawn outlines, each centred on its area centroid,
snaps included, rasterised at the frame's pixels as the stored-frame test and the spike's
`stability.py` measure it; until 2026-10-22 it used the coarser 64 × 64 IoU grid and left snaps out,
which read 0.9498 where the spec's measure reads 0.9522). An outline still drawn from the previous
segment is not scored.

Sweep 2026-10-22 (iPhone 17 Simulator, 683 sets, 783 segments): the scorer passed 783/783, 0 misses,
0/299 false locks, 0 false unlocks, as before the outline. Every segment with an item showed an
outline at its first mask, and none showed one on the empty, `-weak` or gap segments. Per-segment
outline IoU median 0.972 overall; lowest by variant: good 0.878 (bags with handles), motion-blur 0.955,
cut-* 0.817–0.936, too-small 0.875, two-items 0.882, covered-inside 0.709 (the object leaves a hole in
the item's mask). Jitter sets (0.06 of the frame per frame): stability median ≥ 0.979 and min ≥ 0.952
(flat), 0.931 (worn); narrow or small items snap often (up to 34 times in 11.5 s), because a jump of
that size drops IoU(new, drawn) under 0.5.

**Tests and thresholds** (from the spike's `stability.py`; never loosened): the parity fixture always;
on the stored frames, static IoU ≥ 0.92 against the filled largest component of every flat
single-item `frame.mask.png` (holes filled, never the raw mask; `parity/README.md` item 8), and an
empty mask draws none; jitter sets, centroid-aligned IoU of
successive drawn outlines ≥ 0.95; still frames with 1 px noise, Hausdorff between successive outlines
median ≤ 0.01 and p95 ≤ 0.04; two items, IoU ≥ 0.92 with one item and hysteresis keeps it. The
stored-frame tests trace about 2000 full-size masks, which takes minutes in a debug build, so they run
only with `CAPTURE_FRAMES_DIR` set (`CAPTURE_FRAMES_DIR=$PWD/artifacts/capture-camera/frames just
ios-test-packages features`) and skip with that message otherwise. Measured 2026-10-22 (iOS, M4):
static lowest 0.932 over 507 masks; jitter min 0.961, p5 0.985 over 1035 pairs; noise median 0.0042,
p95 0.023 over 495 pairs; two items lowest 0.958 over 41 sets. Re-measured on the regenerated frames
(wider jitter reach) after the blend change: static lowest 0.932 over 512 masks; jitter min 0.952,
p5 0.987; noise median 0.0042, p95 0.023; two items lowest 0.958. With the stability measure centred
on the area centroid (owner 2026-10-22): static lowest 0.932 over 512 masks; jitter min 0.968, p5 0.988
over 1935 pairs; noise median 0.0042, p95 0.023; two items lowest 0.958.

**Steady-check fix (2026-10-22).** The spike found that the iOS rules compared each evaluation's box
with the previous evaluation's box. Evaluations run every 100 ms and the mask every 250 ms, so two of
three compared a reused mask with itself: Δ = 0, and a moving item passed the motion part of "steady"
and could unlock early. Observations now carry the mask's frame time (`maskTimestampMs`); the motion
part compares boxes only across different masks and a reused mask keeps its own comparison's verdict.
Sharpness and device motion are still checked on every evaluation. Android has the same pattern and
mirrors the fix.

**Design rules checked** (`.claude/rules/design-system.md`, `.claude/rules/ios.md`, DESIGN.md
"Layout" and "Do's and Don'ts"): colours are tokens only (camera-paper, camera-ink); widths and dash
are the existing `CaptureMetrics` guide values; state is never colour alone (dashed vs solid, plus the
ring and lock glyph); reduced motion is honoured (no outline movement; the fade is the 150 ms
crossfade); no new layout, control or touch target. One new string, `capture.a11y.outline` ("Item
outline"), the outline's accessibility label. The canvas prototype is deferred (above).

**Device-only.** Vision mask latency and heat on iPhone 11 / SE 2 (the M4 measured 14.3 ms per mask
and 0.54 ms per outline, 3.5 ms max), and the mask quality on real scenes (fabric on fabric, hands,
glare). A Dev build is unoptimised: tracing there takes tens of milliseconds, off the main actor.

