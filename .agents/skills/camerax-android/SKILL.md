---
name: camerax-android
description: Use, change or debug AndroidX CameraX 1.6.2 in the capture camera's `:feature:capture` — the Compose viewfinder, the 640×480 KEEP_ONLY_LATEST ImageAnalysis stream, ImageCapture, binding on the camera's own lifecycle, the permission gate, the no-camera fallback when binding fails, the stalled feed that sends the shutter back to warming up, the accelerometer motion sensor and the debug harness camera that swaps CameraX for frame sets. Use for "CameraX", "ImageAnalysis", "ImageProxy", "bindToLifecycle", "CameraXViewfinder", "SurfaceRequest", "ResolutionSelector", "ImageCapture", "torch", "camera permission", "no-camera screen", "stuck on warming up", "frozen preview", "HarnessCamera", or a CameraX version bump. Not for ML Kit detectors — use `mlkit-android`; not for the LiteRT segmenter — use `litert-android`; not for the iOS camera — use `avfoundation-camera-ios`; not for test frame sets or sweeps — use `capture-frames`; not for screens, ViewModels or Gradle modules in general — use `android-feature`.
metadata:
  modules:
  last-reviewed: 2026-10-23
  owner-agent: android-engineer
---

# CameraX on Android

## Trigger

- Changing how `:feature:capture` opens, binds or closes the camera: use cases, resolution,
  backpressure, rotation, the viewfinder, the torch, the photo, or the analyzer thread.
- A camera that crashes, never opens, shows the wrong screen (permission, no camera) or freezes
  while the hint stays on "Keep still…".
- The phone-motion input (steady and tilt checks) or the debug harness camera.
- A CameraX version bump or a new CameraX artifact (extensions, video, mlkit-vision).
- Not this skill: what ML Kit does with a frame (`mlkit-android`), the segmenter and its cadence
  (`litert-android`), rule thresholds and timings (`packages/shared-kernel/registry/capture-rules.json`,
  `api-contract-change`), frame sets and sweeps (`capture-frames`), screens and copy (`android-feature`).

## Required reading

1. `.claude/plans/2026-10-22-capture-camera-brief.md` §1 (versions, no Play services), §3 (the
   analysis-frame and steady rows), §4 (lock states, background, the stale-feed rule), §7 (permission
   denied, no camera), §11 (harness) and §12 C22–C24, C26, C28.
2. The source: `apps/android/feature/capture/src/main/kotlin/app/aistylist/feature/capture/camera/CameraXObservationSource.kt`
   (bind, analyzer, photo, unbind), `CameraBinding.kt`, `CameraPermissionGate.kt`, `CaptureCameraView.kt`,
   `DeviceMotionSensor.kt`, `CapturePhotoStore.kt` and `MaskCadence.kt` beside it.
3. The port and its caller: `apps/android/feature/capture/src/main/kotlin/app/aistylist/feature/capture/domain/CapturePorts.kt`
   (`CameraFeedEvent`) and `apps/android/feature/capture/src/main/kotlin/app/aistylist/feature/capture/CaptureViewModel.kt`
   (`startFeed`, `onBackgrounded`, `onForegrounded`).
4. Wiring: `apps/android/app/src/main/kotlin/app/aistylist/app/capture/CaptureServices.kt` and the
   harness: `apps/android/feature/capture-debug/src/main/kotlin/app/aistylist/feature/capture/debug/HarnessCamera.kt`,
   `FrameSetSource.kt`.
5. `apps/android/feature/capture/src/main/AndroidManifest.xml`, `apps/android/feature/capture/build.gradle.kts`
   and the `camerax` row in `apps/android/gradle/libs.versions.toml`.
6. The fix history: `git show 0c7af58` (bind failure → no-camera screen) and `git show 371ab42`
   (stalled feed → warming up).
7. For any API claim, the current CameraX guides (context7 library /websites/developer_android_media,
   or developer.android.com/media/camera/camerax; checked 2026-10-23); note the date.

## Workflow

1. Copy the structure from: `CameraXObservationSource.kt` (`openCamera` for the feed, `bind` for use
   cases, `FrameAnalyzer` for per-frame work, `takePhoto` for a still), `CameraBinding.kt` with
   `apps/android/feature/capture/src/test/kotlin/app/aistylist/feature/capture/camera/CameraBindingTest.kt`
   (a CameraX failure turned into a testable value) and `HarnessCamera.kt` (forwarding a new capability).
   First restate which use case changes and which `CameraFeedEvent` or port member carries the result.
2. Search before write: `rg -n 'androidx.camera|ProcessCameraProvider|ImageProxy' apps/android`.
   Extend `CameraXObservationSource`; never add a second camera class or call CameraX from a screen.
3. Layering. CameraX types stop in the `camera` package. The `domain` package sees only the port
   (`CaptureObservationSource`, `CameraFeedEvent`, `CaptureObservation`); screens see only
   `CaptureCameraView`. Only `CaptureServices.kt` constructs the source.
4. Lifecycle. The camera binds to its own `CameraLifecycleOwner`, never the Activity: collecting
   `feed` opens it and cancelling closes it, so the ViewModel alone decides when it runs (background,
   leaving the step, C24). Bind on the main dispatcher after `unbindAll()`; unbind in the feed's
   `finally` under `NonCancellable` on main, so a cancelled collector still releases the camera.
5. Failure is a value. Every way the camera cannot run ends in `CameraFeedEvent.Unavailable`: no
   `FEATURE_CAMERA_ANY`, no back camera, permission denied, or `bindToLifecycle` throwing (an
   unsupported use-case combination throws `IllegalArgumentException`, a camera that cannot open
   `IllegalStateException`). Route a new failure through `bindOrUnavailable` and add a
   `CameraBindingTest` case; never let it crash the app or show a black preview (0c7af58).
6. Permission. `CameraPermissionGate` is shared: the source suspends in `awaitAnswer()` and
   `CaptureRoute.kt` asks the system and reports through `onResult`. A path that comes back from
   Settings must call `refresh()`. The manifest keeps `android.hardware.camera.any` with
   `required="false"`, so phones without a camera still install the app.
7. Analysis stream. One `ImageAnalysis` at 640×480 from `CaptureRules.AnalysisFrame`
   (`ResolutionSelector`, 4:3, closest-higher-then-lower fallback), `STRATEGY_KEEP_ONLY_LATEST`, one
   single-thread executor. Do all work inside `image.use { }`: take what outlives the frame (the
   rotated bitmap for the segmenter, the Y-plane bytes) before the proxy closes, and never close the
   wrapped `Media.Image`. Pass `imageInfo.rotationDegrees` on; measurements are on the upright image.
   Resolution and timings are capture rules: change them in `capture-rules.json`, never as literals.
8. Ready and stall. The first analysed frame emits `CameraFeedEvent.Ready`, which starts the anyway
   timer. If frames stop, the session's tick sends `locked` or `unlocked` back to warming up after
   `CaptureRules.Evaluation.STALE_FEED_AFTER_MS` (`LockState.onFeedStalled` in `LockMachine.kt`, 371ab42).
   Never emit repeated or synthetic frames to keep the screen alive; find why the analyzer stopped.
9. Photo, preview, torch. `ImageCapture` uses `CAPTURE_MODE_MINIMIZE_LATENCY` and 4:3; rotate by
   `rotationDegrees` inside the callback, then store in `CapturePhotoStore` (memory only, scaled to
   1600 px, nothing written to disk in v1). An `onError` returns `PhotoResult.Failed`, never a throw.
   The preview is `CameraXViewfinder` fed by the `SurfaceRequest` flow, centre-cropped. Torch shows
   only when `hasFlashUnit()`; reset torch state on unbind.
10. Motion. `DeviceMotionSensor` starts after a good bind and stops in `awaitClose`: accelerometer at
    `SENSOR_DELAY_GAME`, gravity low-pass with α from `CaptureRules.Android.GRAVITY_LOW_PASS_ALPHA`,
    `latest` null without an accelerometer. Keep that null path: the live checks skip the motion part
    when it is null (emulator, tablet).
11. Harness. A new camera capability goes on `CaptureCameraView` or `CaptureObservationSource`, and
    `HarnessCamera` forwards it to the real camera or gives the frame-set answer, so test frames still
    play through the same port. The harness is `debugImplementation` only; `just android-check` runs
    `scripts/check-capture-harness.sh` and fails if it reaches the preview or release APK.
12. Dependencies. All four artifacts share the `camerax` version in the catalog. A bump: change the
    catalog, run `just android-deps-lock`, keep the lockfiles and
    `apps/android/gradle/verification-metadata.xml` in the same change, read the diff for new
    Play-services or network artifacts (brief C31, C22), then `just security-scan`.
13. Evidence. Unit tests never open a camera: pull the decision into a pure function and test it
    (`CameraBindingTest.kt`), and test feed-level behaviour in the domain
    (`apps/android/feature/capture/src/test/kotlin/app/aistylist/feature/capture/domain/CaptureCameraSessionTest.kt`).
    A bug fix pastes the failing Kotlin test run before the fix. The emulator sweeps play frame sets,
    not CameraX; the real camera, bind failures and sensors are device-only, so report them as Not run
    unless you ran them on a phone (`just android-run`).

## Validation commands

```bash
just test android              # unit + Robolectric tests (bind failure, stale feed, lock machine)
just android-check             # full gate, including the harness-absent check on preview and release
just android-deps-lock         # after a granted CameraX bump; review the lockfile diff
just security-scan             # after any dependency change
just capture-sim-android       # emulator: frame-set sweeps and the e2e/capture flows (no real camera)
just android-run               # install the debug build on a phone for device-only checks
```

## Output

The `agent-operating-contract` report. Add one line per use case touched: resolution, thread, what
happens on failure. For a bump: the old and new versions, new transitive artifacts from the lockfile
diff, and the `just security-scan` result. Device results only if a phone ran them.

Done checklist: CameraX types stay in the `camera` package · camera bound to its own lifecycle and
released in `finally` · every failure ends in `CameraFeedEvent.Unavailable` · proxy closed after the
frame's work, nothing used after close · no synthetic frames · numbers from `CaptureRules` · harness
forwards the new capability and stays out of release · device results reported as run or Not run.

## Stop / escalation

- A rule number (analysis size, stale-feed time, motion α, intervals) must change →
  `api-contract-change` on `capture-rules.json`; it changes iOS too.
- A new screen, overlay or visible control (focus ring, zoom slider) → `ui-prototype-first` first.
- A Play-services, Firebase or network dependency, or photos written to disk or the gallery → stop;
  it breaks C22/C31 and brief §0, and needs the owner and `security-privacy-review`.
- A version bump the task does not grant → stop; lockfiles and checksums are reviewed changes.
- A frame-rate or memory budget in question → `performance-profiling` with before/after numbers.

## Overlap

Loaded next to `android-feature`, which owns `apps/android/**`; this skill owns no paths. Adjacent:
`mlkit-android` (the detectors that read each `ImageAnalysis` frame), `litert-android` (the segmenter
and `MaskCadence` timing), `avfoundation-camera-ios` (the iOS counterpart; parity comes from the brief,
never from iOS sources), `capture-frames` (frame sets, sweeps and `just capture-sim-android`),
`e2e-device-testing` (the flows in `e2e/capture/permission.yaml` and `e2e/capture/background.yaml`),
`api-contract-change` (capture-rules values), `security-privacy-review` (any new data path for photos).
