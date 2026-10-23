---
name: litert-android
description: Use, change or debug the Android capture camera's on-device garment segmenter — LiteRT 1.4.2 (com.google.ai.edge.litert:litert, pinned) running U²-Netp (224², fp16) in `:feature:capture` — with the repo's rules: no LiteRT 2.x (Play ai-delivery), CPU and XNNPACK only, one inference in flight at the mask cadence, run-time failure falls back to ML Kit boxes, the model rebuilt by tools/capture-segmenter/convert.sh with a sha256 test and NOTICE, and the ADR-0013 size and latency budget. Use for "LiteRT", "tflite", "u2netp", "garment segmenter", "LiteRtGarmentSegmenter", "MaskCadence", "XNNPACK", "GPU delegate", "convert.sh", "SegmenterAssetTest", a slow or crashing mask, or a LiteRT bump. Not for ML Kit boxes or pose — use `mlkit-android`; not for CameraX — use `camerax-android`; not for the iOS mask — use `apple-vision-ios`; not for test frames or sweeps — use `capture-frames`; not for server-side segmentation in workers/ml — use `media-ml-pipeline`; not for screens or Gradle modules — use `android-feature`.
metadata:
  modules:
  last-reviewed: 2026-10-23
  owner-agent: android-engineer, tooling-engineer
---

# LiteRT garment segmenter on Android

## Trigger

- Changing how `:feature:capture` loads or runs the segmenter: interpreter options, threads, input
  preparation, the 0.5 cut, the small-item crop pass, or when the segmenter runs.
- A LiteRT version bump, a delegate (GPU, NNAPI, NPU), a new or bigger model, or a new on-device
  model of any kind on Android.
- Rebuilding or checking the model asset (`tools/capture-segmenter/convert.sh`, `convert.py`), a
  failing `SegmenterAssetTest`, or a licence or NOTICE question about the model.
- A slow, hot or crashing mask on a device or emulator, a mask IoU drop in the live sweep, or the
  APK size or latency budget.
- Not this skill: the ML Kit boxes that stand in on failure (`mlkit-android`), the camera feed
  (`camerax-android`), the mask and outline numbers (`packages/shared-kernel/registry/capture-rules.json`,
  `api-contract-change`), frame sets and sweeps (`capture-frames`), screens (`android-feature`).

## Required reading

1. `docs/adr/0013-on-device-garment-outline-android.md` (the whole file: options, decision, device
   gate, evidence) and `planning/10-ai-usage-cost-and-evaluation.md` §1 row 11a.
2. `.claude/plans/2026-10-22-capture-camera-brief.md` §1 (versions), §3 (mask cadence, item found,
   covered), §11 (harness masks), §12 C2, C6, C31, C32 and §17 (live outline spec).
3. The code: `apps/android/feature/capture/src/main/kotlin/app/aistylist/feature/capture/camera/LiteRtGarmentSegmenter.kt`,
   `apps/android/feature/capture/src/main/kotlin/app/aistylist/feature/capture/camera/MaskCadence.kt` and
   `apps/android/feature/capture/src/main/kotlin/app/aistylist/feature/capture/camera/CameraXObservationSource.kt`
   (`FrameAnalyzer`: `SegmenterState`, `runSegmenter`, `fallBack`, `isHot`, `close`; `analyzeStill`).
4. The domain side the mask feeds: `ItemMask.kt` (`LabelImage`, `MaskProfile`), `MaskObservation.kt`,
   `OutlineContour.kt` and `OutlineTracker.kt` in the capture module's `domain` package.
5. The asset and its build: `apps/android/feature/capture/src/main/assets/capture-segmenter/NOTICE.txt`,
   `apps/android/feature/capture/src/main/assets/capture-segmenter/u2netp-224-fp16.tflite.sha256`,
   `tools/capture-segmenter/convert.sh`, `tools/capture-segmenter/convert.py`.
6. `apps/android/gradle/libs.versions.toml` (the `litert` pin and its comment) and
   `apps/android/feature/capture/build.gradle.kts`.
7. For any API claim, the current LiteRT docs (context7 library /websites/developers_google_edge_litert,
   or developers.google.com/edge/litert); read 2026-10-23 for this file. Note the date you read them.

## Workflow

1. Copy the structure from: `LiteRtGarmentSegmenter.kt` (a model wrapper: `load` returns null on
   failure, buffers allocated once, `segment` returns domain types, `Closeable`), `MaskCadence.kt`
   (a thread-safe gate with `tryStart` and `finish`) and `FrameAnalyzer` in
   `CameraXObservationSource.kt` (the live call on its own thread). First restate what changes:
   the model, the runtime, the cadence or the mask math, and which capture rule reads the result.
2. Search before write: `rg -n 'LiteRt|Interpreter|tflite|MaskCadence' apps/android tools`. Extend
   `LiteRtGarmentSegmenter`; never add a second interpreter wrapper or call LiteRT from the
   `domain` package.
3. Layering. LiteRT types stop at the `camera` package and `:feature:capture-debug`. `segment`
   returns a `LabelImage` of 8-connected components (largest first), so the rules and the outline
   read the same mask measure as iOS. The `domain` package stays plain JVM Kotlin.
4. The pin. Keep `com.google.ai.edge.litert:litert` at 1.4.2. Every 2.x release pulls
   `com.google.android.play:ai-delivery` (Play services basement, tasks, asset delivery), which the
   owner ruled out (ADR-0013 option B, commit b8c3175). A bump to 2.x is a stop, not a task.
5. CPU only. The interpreter runs with `Interpreter.Options().setNumThreads(4)`; XNNPACK is
   LiteRT's default CPU path and runs 258 of 259 nodes (ADR-0013). A GPU delegate needs the extra
   `litert-gpu` and `litert-gpu-api` artifacts (LiteRT docs): a new dependency, so stop for the owner.
6. Threads. `segment` is not thread-safe, so each interpreter has one caller: the live one on
   `FrameAnalyzer`'s single-thread executor, the still one (`stillSegmenter`) behind `stillLock`.
   Load off the main thread (`load` is blocking). `close` is queued on the same executor so the
   interpreter closes only when idle; keep that order.
7. Cadence. `MaskCadence.tryStart(nowMs, isHot)` allows one inference in flight, on the newest
   frame, at most every `CaptureRules.Mask.INTERVAL_MS` (250 ms), or `HOT_INTERVAL_MS` (1000 ms) at
   `THERMAL_STATUS_MODERATE` or worse. `finish` runs in a `finally`. Every frame still measures
   light, sharpness and motion with the newest mask; the rule loop never waits for the model. The
   numbers come from the `mask` block (commit 1411a8e): change them through `api-contract-change`,
   never as a Kotlin literal.
8. Mask math (ADR-0013 "Mask"). Stretch to 224², divide by the brightest channel, then ImageNet mean
   and deviation; probability > 0.5 raw, no min-max; nearest upsample to the frame. A first item
   under `SMALL_ITEM_AREA_SHARE` (0.10) is segmented again on a crop twice its box, clearing only
   the crop: clearing the whole mask dropped a second item (commit 030bd59, IoU 0.96 → 0.49–0.66).
9. Failure is a value. `load` returns null on `IOException`, `IllegalArgumentException`,
   `IllegalStateException` or `UnsatisfiedLinkError`, which makes `SegmenterState.Failed`.
   At run time `runSegmenter` catches the two exceptions LiteRT throws for native errors and
   `fallBack` sets `Failed` and clears `latestMask`; an uncaught one on the segmenter thread ended
   the app (commit 485783e). From then on ML Kit boxes and the box rules run (doc-10 fallback, no
   outline). Never throw out of the segmenter thread.
10. The asset. The model is a plain git blob, never Git LFS: CI fetches no LFS objects, so a pointer
    would ship and the camera would silently fall back (ADR-0013 "Storage"). Rebuild it with
    `bash tools/capture-segmenter/convert.sh`; prove the committed bytes with
    `bash tools/capture-segmenter/convert.sh --check`. It needs uv from mise and the network for the
    pinned ONNX file and wheels. It accepts only rembg's ONNX export, since nothing downloaded is
    ever unpickled. The model, its `.sha256` and `NOTICE.txt` change together; `SegmenterAssetTest`
    checks the hash and that the notice names Apache 2.0, MIT and the source hash.
11. A new or bigger model (another size, int8, another architecture) is a doc-10 change: new
    numbers for mask IoU, rule parity with iOS, latency and APK size from the same procedure as
    ADR-0013, plus a NOTICE with every licence. Stop for the owner before swapping it.
12. Budget. +6.86 MB on an arm64 phone (+22.4 MB universal APK). Device gate: p50 ≤ 700 ms per
    mask on a Galaxy A12-class phone, and no thermal throttling in a 5-minute batch session; above
    that, the cadence drops further or the model moves to 160². Emulator latency (p50 292 ms) is not
    device latency. Perf claims need before and after numbers (`performance-profiling`).
13. Evidence. JVM tests cover the hash, the cadence (`MaskCadenceTest`), the mask measure and the
    outline parity; Robolectric cannot run the model. Prove the model on frames with
    `just capture-sim-android`: its live sweep (`captureMasks=live`) writes `capture-segmenter.jsonl`
    with latency and mask IoU per image, information only. Real devices stay device-only: report
    them as Not run unless you ran them.

## Validation commands

```bash
just test android              # unit + Robolectric tests (asset hash, cadence, mask measure, outline parity)
just android-check             # full gate, including the release APK
just android-deps-lock         # after a granted LiteRT or dependency change; review the lockfile diff
just security-scan             # after any dependency change
just capture-sim-android       # emulator: stored-mask sweep (scored) + live LiteRT sweep (information)
just lint                      # only if convert.sh changed (shellcheck over tools/**/*.sh)
just lint-file tools/capture-segmenter/convert.py   # only if convert.py changed (ruff)
```

## Output

The `agent-operating-contract` report. Add the LiteRT version, the model file and its sha256, and
whether `bash tools/capture-segmenter/convert.sh --check` ran. For a runtime or model change: mask
IoU, rule parity and latency p50/p90 from the live sweep, and the APK size delta. Emulator or device
numbers only if they were run.

Done checklist: LiteRT still 1.4.2, no Play or GPU artifact in the lockfile · CPU only · one
inference in flight at the generated cadence · run-time failure falls back to ML Kit boxes · model,
`.sha256` and `NOTICE.txt` in step · LiteRT types stay in the `camera` package · device results
reported as run or Not run.

## Stop / escalation

- A LiteRT 2.x bump, a Play-services, Firebase or network dependency, or a downloaded model → stop;
  it breaks the owner's conditions in ADR-0013 and needs the owner and a new ADR.
- A GPU, NNAPI or NPU delegate, or a different or bigger model → stop; owner approval, a doc-10
  update and new evidence first.
- The device gate fails → `performance-profiling` measures; cadence or a 160² model is the owner's
  call (ADR-0013 "Device gate").
- A mask or outline number must change → `api-contract-change` on `capture-rules.json`.
- `convert.sh --check` differs from the committed hash, or a pinned conversion package must change
  → `tooling-ci` (tooling-engineer owns `tools/**`); never commit a model the script did not build.
- ML Kit must replace the segmenter as the main item source → stop; it reverses ADR-0013.

## Overlap

Loaded next to `android-feature`, which owns `apps/android/**`, and next to `tooling-ci`, which owns
`tools/**` and loads this skill for `tools/capture-segmenter/**`; this skill owns no paths. Adjacent:
`mlkit-android` (the boxes this segmenter falls back to, and pose), `camerax-android` (the
`ImageAnalysis` frames it reads), `apple-vision-ios` (the iOS foreground instance mask; parity comes
from the brief and the shared fixture, never from iOS sources), `capture-frames` (the frame sets,
stored masks and sweeps that score it), `api-contract-change` (the `mask` and `outline` blocks),
`media-ml-pipeline` (server-side segmentation in workers/ml, a different model and runtime),
`performance-profiling` (latency and size measurements), `security-privacy-review` (any new egress).
