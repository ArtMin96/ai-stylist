---
name: apple-vision-ios
description: Use, change or debug Apple Vision in the iOS capture camera's `CaptureFeature` target — VNGenerateForegroundInstanceMaskRequest (item mask, instances, box, edge contact, live outline) and VNDetectHumanBodyPoseRequest (worn-mode body check) — with the repo's rules: no Vision in `CaptureModel`, keypoint y flipped from Vision's bottom-left origin, newest frame every 250 ms with one request in flight and pose on the same handler, nil or `.modelUnavailable` for the doc-10 fallback, no foreground mask on the Simulator. Use for "Vision", "VNImageRequestHandler", "foreground instance mask", "body pose", "joint confidence", "y-flip", "CaptureVisionAnalysis", or a mask or keypoint mismatch on iPhone. Not for the AVCaptureSession or photo output — use `avfoundation-camera-ios`; not for the frame generator or sweeps — use `capture-frames`; not for Android — use `mlkit-android` / `litert-android`; not for screens or view models in general — use `ios-feature`.
metadata:
  modules:
  last-reviewed: 2026-10-23
  owner-agent: ios-engineer
---

# Apple Vision on iOS

## Trigger

- Changing how the `CaptureFeature` target calls Vision: the foreground instance mask, the body pose
  request, how results map into `CaptureModel` types, the failure path, or when a request runs.
- A new Vision request in the capture camera (human rectangles, hand pose, face rectangles, saliency,
  subject lift), or a move from the `VN*` classes to the Swift-only Vision API.
- On an iPhone, the item box, edge contact, covered check, live outline or body check disagrees with
  what the frame shows, or Vision stops running.
- Not this skill: the camera feed and photo output (`avfoundation-camera-ios`), the generator's own
  Vision run and the stored masks (`capture-frames`), rule thresholds
  (`packages/shared-kernel/registry/capture-rules.json`, `api-contract-change`), screens and model
  logic in general (`ios-feature`).

## Required reading

1. `.claude/plans/2026-10-22-capture-camera-brief.md` §3 (mask cadence, item found, cut off, covered,
   the worn-mode body check rows for iOS), §11 (masks and keypoints in the harness), §16 status log
   (covered feasibility) and §17 "Live outline" (input, spec, device-only notes).
2. `planning/10-ai-usage-cost-and-evaluation.md` §1 row 11: what Vision may do, on-device only, and the
   fallback.
3. The code: `apps/ios/Packages/Features/Sources/CaptureFeature/CaptureVisionAnalysis.swift`
   (`CaptureVision.foreground`, `CaptureVision.bodyPose`, `CaptureStillAnalyzer`) and
   `apps/ios/Packages/Features/Sources/CaptureFeature/LiveCaptureCamera.swift`
   (`LiveFrameProcessor.captureOutput`: the cadence plan and the shared handler).
4. The types Vision feeds: `apps/ios/Packages/Features/Sources/CaptureModel/CaptureImageMetrics.swift`
   (`CaptureInstanceLabels`, `CaptureMaskProfile`), `apps/ios/Packages/Features/Sources/CaptureModel/CaptureObservation.swift`
   (`NormalizedRect`, `CaptureKeypoint`, `CaptureBodyPose`), `apps/ios/Packages/Features/Sources/CaptureModel/CaptureLiveOutline.swift`
   and `apps/ios/Packages/Features/Sources/CaptureModel/CaptureMaskCadence.swift`.
5. The Simulator path: `apps/ios/Packages/Features/Sources/CaptureDebug/CaptureFrameSetCamera.swift`
   (header comment) and the generator's `tools/capture-frames/Sources/VisionMasks.swift`.
6. `apps/ios/README.md` "Guided capture camera" and the target comments in
   `apps/ios/Packages/Features/Package.swift`.
7. For any API claim, Apple's Vision docs (context7 library /websites/developer_apple_vision, or
   developer.apple.com/documentation/vision); note the date. Checked 2026-10-23: the instance mask
   needs iOS 17 / macOS 14, pose points are normalised with the origin at the bottom-left, and the
   Swift-only request structs need iOS 18 / macOS 15.

## Workflow

1. Copy the structure from: `CaptureVisionAnalysis.swift` (a request: a `static func` on the
   `nonisolated` `CaptureVision` enum that takes a `VNImageRequestHandler` and returns a `CaptureModel`
   value or nil), `LiveFrameProcessor.captureOutput` in `LiveCaptureCamera.swift` (a live call) and
   `CaptureStillAnalyzer.observe` (a still). First restate which request, live or still, and which
   capture rule reads the result (brief §3).
2. Search before write: `rg -n 'import Vision|VN[A-Z]' apps/ios tools/capture-frames`. Extend
   `CaptureVision`; never add a second Vision wrapper or call Vision from a view.
3. Layering. Only `CaptureFeature` imports Vision. `CaptureModel` and `CaptureDebug` never do:
   `CaptureModel` builds and tests on Linux, where Vision does not exist. Vision results become
   `CaptureGrayImage`, `CaptureMaskMeasure`, `CaptureInstance`, `CaptureOutlineCandidate`,
   `CaptureKeypoint` and `CaptureBodyPose` at once. Never let a Vision type cross into
   `CaptureObservation`, and never name Vision's own `NormalizedRect` next to the model's (fa992e8).
4. The mask. Read `observation.instanceMask` as a label image (0 background, each other value one
   instance) through `CaptureImageReader.gray(from:plane:)`, then measure with
   `CaptureInstanceLabels.instances` and `CaptureMaskProfile.measure()`. The largest instance is the
   item; the rest feed the covered rule; outlines are traced only for the live camera
   (`tracesOutlines: true`). Keep the measuring in `CaptureModel`, because the frame-set camera and the
   generator measure their stored masks the same way.
5. The body pose. Take the most confident `VNHumanBodyPoseObservation`, map only the joints in
   `CaptureBodyPart` (the registry's `bodyParts`), and store `y` as `1 - location.y`: Vision's origin is
   bottom-left, the model's is top-left. Keep the raw `confidence`; `CaptureRuleEngine` applies
   `CaptureRules.Ios.minKeypointConfidence` and the `CaptureRules.Worn` bounds.
6. Failure is a value. A thrown `perform` or no instance returns nil from `foreground` (the "no item"
   tip). A thrown pose request returns `.modelUnavailable`, which starts the doc-10 fallback (no lock
   from the body check, "Take photo anyway" at once). No person returns `.observed([:])`, which locks
   with the step-back hint. Never throw out of the frame delegate and never retry in a loop.
7. Cadence. Frames arrive on the serial analysis queue with `alwaysDiscardsLateVideoFrames`, and the
   requests run synchronously there, so the newest frame wins and one request is in flight. The mask
   runs when `CaptureMaskCadence.isDue` says so (`CaptureRules.Mask.intervalMs`, 250 ms;
   `hotIntervalMs` at thermal state serious or worse); pose runs only in worn mode, every
   `CaptureRules.Ios.poseIntervalMs`, on the same handler. Never run Vision per frame or per
   evaluation, and never add a new interval literal.
8. Keep the mask time. Evaluations between masks reuse the last result and carry `maskTimestampMs`.
   The steady check and the shutter streak count each mask once (93c84f2, 6df0190), so a change that
   drops or re-stamps it brings back false unlocks.
9. Orientation. The video and photo connections are rotated to portrait (`videoRotationAngle` 90),
   and stills are made upright by `CaptureImageReader.uprightImage`, so every handler uses `.up`.
   Passing a real orientation as well rotates twice and swaps the edges.
10. Isolation. Vision runs off the main actor: on the analysis queue, or in a `@concurrent` function
    for stills. Types stay `nonisolated` and `Sendable`; no `@unchecked Sendable`.
11. Request choice. The app uses the `VN*` classes. The deployment target allows the Swift-only API,
    but a migration is its own change: the whole `CaptureVision` enum at once, and a regenerated frame
    set when the generator moves too. `VNDetectFaceRectanglesRequest`, `VNDetectHumanRectanglesRequest`
    and `VNDetectHumanHandPoseRequest` run only in the generator, to reject photos with a person. A new
    request in the app needs the doc-10 entry and a cadence slot.
12. Keep the generator in step. `tools/capture-frames` stores masks from the same foreground request
    on the Mac. A change to how the app reads the mask (threshold, instance order, labels) changes
    what the stored masks must mean: hand it to `capture-frames` and regenerate with
    `just capture-frames`.
13. Evidence. The Simulator has no foreground mask, so live Vision returns nil there; the frame-set
    camera measures stored mask PNGs and keypoint files instead, and the iOS sweep scores those.
    Simple drawn shapes are not real bodies. Prove the mapping with `CaptureModel` tests, the build
    with `just ios-build`, the rules with `just capture-sim-ios`. Vision on real objects, real bodies,
    latency and heat stay device-only: report them as Not run unless you ran them on an iPhone.

## Validation commands

```bash
just test ios                  # Core + Features package tests (CaptureModel mapping, rules, fallback)
just ios-check                 # lint, format, bans, package tests; macOS adds the builds and simulator tests
just ios-build --config dev    # macOS only: compiles CaptureFeature, the only Vision importer
just ios-test                  # macOS only: package tests on the simulator
just capture-frames            # macOS only: after a change to how the mask is read; regenerates stored masks
just capture-sim-ios           # macOS only: harness sweep on stored masks and keypoints, scored
```

## Output

The `agent-operating-contract` report. Add one line per request touched: live or still, when it runs,
what nil or `.modelUnavailable` means for the rules. Name every `CaptureModel` type a result maps into
and the test that covers it. iPhone results only if they were run.

Done checklist: Vision imported only in `CaptureFeature` · results mapped to `CaptureModel` types ·
keypoint y flipped once · cadence from generated `CaptureRules`, one request in flight · failure
returns nil or `.modelUnavailable` and the fallback holds · `maskTimestampMs` kept · generator and
stored masks still agree · device results reported as run or Not run.

## Stop / escalation

- A rule threshold, interval or body-part set must change → `api-contract-change` on
  `capture-rules.json`; it changes Android too.
- A new Vision request, a server model, or any frame or result leaving the phone → stop; it needs the
  doc-10 entry and `security-privacy-review`.
- The mask reading changes what stored masks mean → `capture-frames` regenerates the set and checks
  the parity fixture before the app change lands.
- The covered rule seems dead on iPhone → expected: the Mac's Vision merged the object into the item
  in 66 of 66 composites (brief §16). A new detector for it is an owner decision.
- A frame-rate, latency or heat budget is in question → `performance-profiling`.

## Overlap

Loaded next to `ios-feature`, which owns `apps/ios/**`; this skill owns no paths. Adjacent:
`avfoundation-camera-ios` (the session and sample buffers Vision reads), `capture-frames` (the
generator's own Vision run, stored masks and sweeps), `mlkit-android` and `litert-android` (the
Android counterparts; parity comes from the brief and `capture-rules.json`, never from Android
sources), `api-contract-change` (capture-rules thresholds), `security-privacy-review` (any new
egress), `performance-profiling` (device latency).
