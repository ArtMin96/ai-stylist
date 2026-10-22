# ADR-0013 — On-device garment segmenter and live outline on Android (LiteRT 1.4.2 + U²-Netp)

> File name: `docs/adr/0013-on-device-garment-outline-android.md`. Index: `docs/adr/README.md`.

- **Status:** Proposed (owner-approved 2026-10-22)
- **Date:** 2026-10-22
- **Deciders:** product owner; capture camera lead
- **Decision-log entry:** none yet _(create a DEC in doc 16 when accepted)_
- **Related:** capture brief `.claude/plans/2026-10-22-capture-camera-brief.md` ("Live outline", §3, C2, C6, C32) · ADR-0012 (ML Kit usage reporting off) · doc 10 §1 row 11 · the parity fixture `tools/capture-frames/parity/` · phase P06

## Context

The capture camera draws a live outline around the garment and judges "item found", "cut off" and
"too small" from the item's shape. iOS reads both from Apple Vision's foreground instance mask.
Android had only ML Kit Object Detection boxes. Boxes cannot give an outline, and box rules disagree
with the iOS mask rules: on the stored frame sets, ML Kit boxes reached the iOS decision on 57 of 98
frames (4 of 36 cut-off frames), because ML Kit finds no object once a frame cuts the item off. The
owner approved a live outline on Android on 2026-10-22, with three conditions: nothing leaves the
phone, no Play services, and LiteRT pinned at 1.4.2.

## Options considered

| Option                                                                           | Pros                                                                                                                                                                                  | Cons                                                                                                                                                 | Evidence (primary source + as-of date)                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A (chosen): LiteRT 1.4.2 + U²-Netp (salient object, 224², fp16 weights, 2.35 MB) | Pixel mask, so the iOS rules and outline apply as they are; Apache-2.0 weights; LiteRT 1.4.2 has no dependency beyond `litert-api` and no network code; XNNPACK runs 258 of 259 nodes | +6.85 MB arm64 APK (spike); 273–299 ms median per frame on the arm64 emulator; salient-object, not garment-specific; small items at 224² lose detail | Spike 2026-10-22: rule decisions match iOS on 94 of 98 frames (33 of 36 cut-off); mask IoU 0.95–0.98 against the stored masks on good, too-dark, too-bright and too-small frames. LiteRT 1.4.2 POM (2026-03-16): no dependencies; `libtensorflowlite_jni.so` arm64 4,475,256 B |
| B: LiteRT 2.x                                                                    | Current line                                                                                                                                                                          | Pulls `com.google.android.play:ai-delivery` (Play services basement and tasks, asset delivery)                                                       | LiteRT 2.3.0 POM (2026-10-06), since 2.1.0                                                                                                                                                                                                                                     |
| C: MediaPipe Interactive Segmenter (MagicTouch)                                  | Google-maintained task                                                                                                                                                                | +19.3 MB; needs a seed point per frame; `tasks-core` always sends usage stats to Google (`TasksStatsProtoLogger`, CCT), no opt-out                   | `tasks-core` 1.1.1 classes and POM (2026-10-14); developers.google.com/edge/mediapipe/solutions/tasks (2026-06-05): "send metrics … to Google"                                                                                                                                 |
| D: MediaPipe Image Segmenter (selfie / multiclass / DeepLab)                     | Small models                                                                                                                                                                          | Same `tasks-core` telemetry; the models segment people or Pascal classes, not garments on a surface                                                  | Model cards (2026-10-22)                                                                                                                                                                                                                                                       |
| E: OpenCV GrabCut seeded by ML Kit boxes                                         | No model                                                                                                                                                                              | +25 MB (arm64 `libopencv_java4.so` 24.7 MB); needs a good box, which cut-off frames lack; slow                                                       | OpenCV 4.14.0 / 5.0.0 AARs (2026)                                                                                                                                                                                                                                              |
| F: ML Kit Subject Segmentation                                                   | Google-maintained, garment-friendly                                                                                                                                                   | Play services, model downloaded at run time (both against the owner's conditions); beta                                                              | ML Kit docs, 16.0.0-beta1 (2026-10-21)                                                                                                                                                                                                                                         |

## Decision

Android runs U²-Netp through LiteRT 1.4.2 on the CPU, behind the existing observation-source port
(`CameraXObservationSource`; the domain never imports LiteRT):

- **Model.** `u2netp-224-fp16.tflite` (2,351,420 B, sha256 `7c2a5ca4…2115`) in
  `apps/android/feature/capture/src/main/assets/capture-segmenter/`, with its licence notice. It is
  built by `bash tools/capture-segmenter/convert.sh` from rembg's U²-Netp ONNX export (release v0.0.0,
  sha256 `309c8469…ddd8`, MIT; weights U²-Net, Apache-2.0) with a pinned conversion stack; nothing
  downloaded is unpickled (the official weights are a PyTorch pickle, so the ONNX export is the only
  admitted source). Two runs from a fresh download gave the same bytes. A unit test checks the hash.
- **Storage.** A plain git blob (2.35 MB). Git LFS covers only `assets/3d/**` and no CI job fetches
  LFS objects, so an LFS pointer would ship and the camera would silently fall back to boxes;
  `just assets-validate` is a 3D-only stub.
- **Cadence.** One inference in flight, on the newest frame, at most every 250 ms (the iOS mask
  cadence), once a second at thermal status moderate or worse. Every analysis frame still measures
  light, sharpness and motion and carries the newest mask with its timestamp.
- **Mask.** Input stretched to 224², divided by its brightest channel, ImageNet mean and deviation;
  output probability > 0.5, raw (no min-max), upsampled nearest to the 480 × 640 analysis frame. A
  mask box under 10 % of the frame is segmented again on a crop twice its size (small items).
- **Rules.** Item found, cut off, too small and the box come from the mask with the iOS measure
  (`CaptureMaskProfile` → `MaskProfile`), so both apps apply the same rule. Steady compares box
  motion only across distinct mask timestamps and keeps the last verdict while a mask is reused; while
  locked, a passing evaluation that reuses the last counted mask holds the streak, so an unlock needs
  three distinct passing masks (as on iOS).
- **Covered (C32).** The other objects are the mask's other connected components, not ML Kit boxes:
  measured below, components never lock a frame falsely; ML Kit boxes do.
- **Fallback.** If the model cannot load, or fails at run time, ML Kit object detection boxes and the
  box rules run, as before (doc-10 fallback). Pose stays ML Kit (worn mode).
- **Device gate.** Before release, a Galaxy A12-class phone must segment at p50 ≤ 700 ms per mask,
  and the camera must not heat the phone into throttling within a 5-minute batch session. Above that,
  the cadence drops further or the model moves to 160².

## Rationale

Option A is the only one that meets all three owner conditions and gives a pixel mask, which is what
makes the outline and iOS rule parity possible. Its cost is size and latency; both are bounded
(+6.85 MB, a 250 ms cadence on a separate thread so the 100 ms rule loop never waits for it).

## Evidence (this lane, private arm64 emulator `outlineprobe`, API 36)

Private emulator `outlineprobe` (API 36 arm64, `google_apis`), 2026-10-22; frames from `just capture-frames`
(683 sets, 783 segments); iOS reference: the iOS Simulator sweep of the same frames (run 2026-10-22-1150).

- **Rules on the stored masks** (the scored sweep): rule outcome equal to iOS on 783/783 segments, both
  with a fresh mask per frame and at the phone's 250 ms mask cadence. Scorer: 778/783 with a fresh
  mask, 0 misses, 0/299 false locks, 0 false unlocks; the 5 failures are `small-item-*-too-small`, whose
  expected file names the box rule (`too-small`) for Android and the mask rule (`no-item`, the item is
  under the instance minimum) for iOS only.
  At the phone's 250 ms mask cadence (the sweeps' default) the same 783/783 and 778/783 hold, with 0
  false unlocks, once each mask counts once toward the unlock; before that fix the cadence sweep
  unlocked 44 of 51 jitter sets. A still item now unlocks at 900 ms (all 45 good sets).
- **Live segmenter on the frame PNGs** (information): rule outcome equal to iOS on 599/619 comparable
  segments against 576/619 for the earlier live ML Kit box sweep; on the cut-off sets 182/187 against
  173/187. Not comparable by design: the 48 `-weak` sets (their stored mask is empty on purpose; a real
  model finds the item), the 26 covered sets (U²-Netp merges the object into the item, as Vision does)
  and 18 batch-gap segments. Mask IoU against the stored masks (mean): good 0.981, too-dark 0.977,
  too-bright 0.979, too-small 0.963, cut-* 0.960–0.984, two-items 0.953, patterned 0.954; weak spots:
  motion blur 0.633 (locks as `no-item` instead of `not-steady`; still locked), glare-window 0.233.
- **Latency** (emulator CPU, wall clock per image, 596 images): p50 292 ms, p90 525 ms, max 846 ms;
  one pass p50 288 ms / p90 322 ms; with the small-item crop pass p50 524 ms / p90 570 ms (129 images).
  The mask measure and outline add p50 10 ms / p90 14 ms. This replaces the earlier live ML Kit figure.
- **Small-item crop pass:** on the 129 images it ran, mask IoU 0.877 → 0.891 on average; the cut-off
  ring frames that scored 0.46–0.47 at one pass score 0.968–0.981.
- **Covered (C32), live masks:** components lock 0 of 26 covered sets and 0 other segments; ML Kit
  "other" boxes (the item's own box removed) lock 6 of 26 but also 13 segments that are not covered (4
  good, 5 two-items, 4 jitter). Components chosen: a miss, never a false lock.
- **Outline** (stored masks, 250 ms cadence, position and shape blended apart): every segment with an
  item showed an outline at its first mask; drawn outline against the stored item mask (raw), median
  0.972; jitter stability (centroid-aligned IoU of successive outlines) min 0.952 flat, 0.939 worn;
  small and narrow items snap often under jitter (up to 34 times), as the spec says. Static bar on all
  444 flat single-item stored masks, against the filled largest component: min 0.932, median 0.978.
- **APK** (release, unsigned, `apkanalyzer`): universal file size 135,077,758 → 157,485,645 B
  (+22.4 MB: `libtensorflowlite_jni.so` for four ABIs, the model, +35 KB dex); download size
  49,375,475 → 59,701,135 B. An arm64 device gets +6.86 MB (4,475,256 B native library, 2,353,047 B
  assets, 35,332 B dex). The merged release manifest has no new permission and no `CctBackendFactory`;
  the LiteRT 1.4.2 AARs hold no `java.net`, socket or `datatransport` class and request no permission.

## Consequences and revisit triggers

- Positive: an outline on Android from the same polygon spec as iOS (shared fixture); one rule set
  for both apps; ML Kit object detection leaves the live loop unless the segmenter fails.
- Negative/accepted: +6.86 MB on an arm64 phone (+22.4 MB universal APK); one more native library; a salient-object model may
  outline a covering object together with the garment (C32 is a miss, not a false lock); emulator
  latency is not device latency.
- **Revisit when:** the device gate fails; LiteRT 1.x stops receiving fixes or a 2.x line drops Play
  delivery; a garment-specific on-device model under ~5 MB appears; real-scene quality on devices
  falls short of the frame-set numbers.
- Reversal requires a new ADR and a new DEC entry.

## Proposed doc-10 entry

Planning docs are human-only, so this ADR carries the text; the lead applies it to
`planning/10-ai-usage-cost-and-evaluation.md` §1.

- Row 11, replace "Google ML Kit Object Detection, bundled, single object, stream mode" with "on Android
  the on-device garment segmenter of row 11a, with Google ML Kit Object Detection (bundled, multiple
  objects, stream mode) as its fallback".
- New row after 11:

| 11a | Live garment outline and item mask (Android capture camera) | CV | Yes (on-device) | In: the upright 480 × 640 analysis frame, on the phone. Out: a foreground mask (U²-Netp salient-object probability > 0.5 at 224², upsampled) → the item's box, area share and edge contact for the capture rules, and a 64-point outline (shared spec, `tools/capture-frames/parity/`). Deterministic code is not enough: separating an arbitrary garment from beds, floors and fabric has no reliable rule, and ML Kit boxes miss cut-off items (box rules matched iOS on 4 of 36 cut-off frames, the mask on 33 of 36). Cost: $0, no provider; +6.86 MB on arm64. Latency budget: p50 ≤ 700 ms per mask on a Galaxy A12-class phone; at most every 250 ms (1 s when the phone is hot), one inference in flight, off the rule thread. Caching: none (live frames). Fallback: model fails to load → ML Kit Object Detection boxes and the box rules, no outline. Data: nothing leaves the phone; LiteRT 1.4.2, no Play services (ADR-0013). Eval: the capture frame sets — rule parity with iOS per segment, mask IoU per variant against the stored masks, latency p50/p90; the outline's parity fixture and static, jitter and noise bars in the unit tests; the device gate above. iOS: Apple Vision (row 11) |
