---
name: mlkit-android
description: Use, change or debug Google ML Kit on Android — Object Detection (bundled model, com.google.mlkit:object-detection) and Pose Detection (bundled base model, com.google.mlkit:pose-detection, beta) in the capture camera's `:feature:capture` and `:feature:capture-debug` — with the repo's rules: bundled models only, no Play-services API, the CCT usage-reporting backend removed from the manifest (ADR-0012), the okhttp constraint, one frame in flight, null on model failure and the doc-10 fallback. Use for "ML Kit", "mlkit", "object detection", "pose detection", "PoseLandmark", "inFrameLikelihood", "DetectedObject", "InputImage", "STREAM_MODE", "datatransport", "CctBackendFactory", an ML Kit version bump, or a box/keypoint mismatch in a capture sweep. Not for the LiteRT garment segmenter — use `litert-android`; not for CameraX binding or ImageAnalysis — use `camerax-android`; not for Apple Vision on iOS — use `apple-vision-ios`; not for screens, ViewModels or Gradle modules in general — use `android-feature`.
metadata:
  modules:
  last-reviewed: 2026-10-23
  owner-agent: android-engineer
---

# ML Kit on Android

## Trigger

- Changing how `:feature:capture` calls ML Kit Object Detection or Pose Detection: detector options,
  the box or landmark mapping, the failure path, or when a detector runs.
- An ML Kit version bump, a new ML Kit API (barcode, text, segmentation…), or a transitive
  dependency ML Kit drags in (`play-services-*`, `datatransport`, okhttp, okio).
- A capture sweep where live ML Kit boxes or keypoints disagree with the stored ones
  (`captureBoxes=live`, `capturePose=live`), or ML Kit stops running on a device or emulator.
- Not this skill: the segmenter that draws the outline (`litert-android`), the camera feed
  (`camerax-android`), the rule thresholds (`packages/shared-kernel/registry/capture-rules.json`,
  `api-contract-change`), screens and module wiring (`android-feature`).

## Required reading

1. `docs/adr/0012-ml-kit-usage-reporting-off.md` (why the CCT backend is removed) and
   `docs/adr/0013-on-device-garment-outline-android.md` (why ML Kit boxes are only the fallback).
2. `planning/10-ai-usage-cost-and-evaluation.md` §1 rows 11 and 11a: what ML Kit may do, the data
   rule and the fallback.
3. `.claude/plans/2026-10-22-capture-camera-brief.md` §1 (versions), §3 (box and keypoint rules,
   pose thresholds, fallback) and §12 C22, C31, C32.
4. The code: `apps/android/feature/capture/src/main/kotlin/app/aistylist/feature/capture/camera/MlKitDetectors.kt`
   (both detectors), `apps/android/feature/capture/src/main/kotlin/app/aistylist/feature/capture/camera/CameraXObservationSource.kt`
   (`FrameAnalyzer.analyze`, `analyzeBitmap`), `apps/android/feature/capture/src/main/AndroidManifest.xml`
   (the CCT removal) and `apps/android/feature/capture/build.gradle.kts` (dependencies, okhttp constraint).
5. The harness probe: `apps/android/feature/capture-debug/src/main/kotlin/app/aistylist/feature/capture/debug/DetectorProbe.kt`.
6. `apps/android/gradle/libs.versions.toml` (`mlkit-object-detection`, `mlkit-pose-detection`).
7. For any API claim, the current ML Kit Android guides (context7 library
   /websites/developers_google_ml-kit, or developers.google.com/ml-kit/vision); note the date.

## Workflow

1. Copy the structure from: `MlKitDetectors.kt` (a detector: options in the constructor, a
   blocking `detect` that returns domain types or null, `Closeable`), `FrameAnalyzer.analyze` in
   `CameraXObservationSource.kt` (a live call inside `image.use { }`) and `analyzeBitmap` in the
   same file (a still). First restate which detector, which mode (live or still) and which capture
   rule reads the result (brief §3).
2. Search before write: `rg -n 'mlkit|MlKit|InputImage' apps/android`. Extend `MlKitItemDetector`
   or `MlKitPoseDetector`; never create a second detector wrapper or call ML Kit from the
   `domain` package.
3. Layering. ML Kit types stop at the `camera` package and `:feature:capture-debug`. The detectors
   return the domain's `NormalizedRect` and `PoseSample`, normalised to the **upright** image
   (`uprightSize()` swaps width and height for 90° and 270°). The `domain` package stays plain JVM
   Kotlin with no Android or ML Kit import.
4. Models are bundled. Use `com.google.mlkit:object-detection` and `com.google.mlkit:pose-detection`
   (base), never the `play-services-mlkit-*` unbundled artifacts, a downloadable custom model, or
   any Play-services API (brief C31: the only Play code linked is `play-services-tasks`). The app
   must run with no network (C22).
5. Modes. The live camera uses `STREAM_MODE` (tracking across frames); stills, imports and test
   frames use `SINGLE_IMAGE_MODE` (`MlKitItemDetector(streamMode = false)`). Object detection keeps
   `enableMultipleObjects()`: the covered rule (C32) needs the other boxes. No classification.
6. One frame in flight. `analyze` blocks on `Tasks.await` inside `image.use { }`, so the
   `ImageProxy` closes only after ML Kit has finished. Keep that order: closing the proxy early
   corrupts the `InputImage`, and an async listener needs its own close. Never call
   `Tasks.await` on the main thread.
7. Failure is a value. `awaitOrNull` maps `ExecutionException` to null and re-sets the interrupt
   flag. Null means "no item" for boxes and "pose unavailable" for keypoints, which triggers the
   doc-10 fallback (no lock from the body check, "Take photo anyway" at once). Never throw out of
   the analyzer.
8. When each detector runs. Object detection runs only when the segmenter is `Failed`; pose runs
   only in worn mode and only after an item is found. Do not run ML Kit on frames the rules will not
   read: the phone budget is set by the slowest frame.
9. Thresholds and landmarks come from the generated `CaptureRules` and `CaptureBodyPart`
   (`app.aistylist.contracts.kernel`). Changing the 0.5 `inFrameLikelihood` bar or the edge band
   means editing `capture-rules.json` through `api-contract-change`, not a literal in Kotlin.
10. Usage reporting stays off. The `tools:node="remove"` on
    `backend:com.google.android.datatransport.cct.CctBackendFactory` lives in the capture module's
    manifest. A new module that brings ML Kit or `datatransport` needs the same removal; `just
android-check` fails when the release merged manifest has the registration again.
11. Dependencies. Versions live only in the catalog. Every module that adds ML Kit also adds the
    `constraints { implementation(libs.okhttp) }` block, because ML Kit's POMs ask for okhttp 3.0.0
    with known advisories. A bump: change the catalog, run `just android-deps-lock`, read the
    lockfile diff for new `play-services-*`, `firebase-*` or network artifacts, then run
    `just security-scan`. Any new Play or Firebase artifact means stop.
12. Evidence. Unit tests cannot run ML Kit (Robolectric has no model). Test the mapping with the
    domain types; prove the detector on frames with `just capture-sim-android`. Its live sweep
    (LiteRT masks, ML Kit pose) is information only; the ML Kit box path runs in a harness sweep
    with `captureMasks=none` (see the `:feature:capture-debug` row in `apps/android/README.md`).
    Real objects and real bodies stay device-only: report them as Not run unless you ran them.

## Validation commands

```bash
just test android              # unit + Robolectric tests (mapping, rules, fallback paths)
just android-check             # full gate, including the release-manifest CCT check
just android-deps-lock         # after a granted version bump; review the lockfile diff
just security-scan             # after any dependency change (okhttp/okio advisories)
just capture-sim-android       # emulator: stored masks + keypoints (scored); live LiteRT + ML Kit pose (information)
```

## Output

The `agent-operating-contract` report. Add one line per detector touched: mode, when it runs,
what null means. For a bump: the old and new versions, the new transitive artifacts from the
lockfile diff, and the `just security-scan` result. Emulator or device evidence only if it was run.

Done checklist: bundled models only, no Play-services API · ML Kit types stay in the `camera`
package · proxy closed after the task ends · failure returns null and the fallback holds · CCT
removal still in the release manifest · okhttp constraint in every ML Kit module · device results
reported as run or Not run.

## Stop / escalation

- A new Play-services, Firebase or network dependency, or an unbundled or downloaded model → stop;
  it breaks C22/C31 and needs the owner and an ADR.
- A new data flow to Google (usage reporting, model download, crash reports) → stop;
  `security-privacy-review` and docs 10 and 11 first.
- A rule threshold or landmark set must change → `api-contract-change` on `capture-rules.json`.
- A version bump the task does not grant → stop; lockfiles and checksums are reviewed changes.
- ML Kit must replace the segmenter as the main item source → stop; it reverses ADR-0013.

## Overlap

Loaded next to `android-feature`, which owns `apps/android/**`; this skill owns no paths. Adjacent:
`camerax-android` (the `ImageAnalysis` frames ML Kit reads), `litert-android` (the segmenter ML Kit
backs up), `apple-vision-ios` (the iOS counterpart; parity comes from the brief, never from iOS
sources), `capture-frames` (the frame sets and sweeps that score detectors), `api-contract-change`
(capture-rules thresholds), `security-privacy-review` (any new egress).
