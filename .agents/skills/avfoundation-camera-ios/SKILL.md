---
name: avfoundation-camera-ios
description: Use, change or debug the iOS capture camera's device layer in `CaptureFeature` and the Dev-only `CaptureDebug` harness — AVCaptureSession, video data output feeding Vision, photo output, preview layer, torch, CMMotionManager tilt, AVSpeechSynthesizer and VoiceOver announcements, the PhotosPicker import, camera permission and no-camera screens, NSCameraUsageDescription and the privacy manifest — with the repo's rules: the session starts off the main actor, only Sendable observations cross actors, photos stay in memory, a stalled feed is the model's job, the harness ships in Dev only. Use for "AVCaptureSession", "LiveCaptureCamera", "takePhoto crash", "startRunning", "camera permission", "no camera on the simulator", "preview rotated", "torch", "speech hints" or "CaptureFrameSetCamera". Not for the Vision requests themselves — use `apple-vision-ios`; not for Android CameraX — use `camerax-android`; not for frame sets and sweeps — use `capture-frames`; not for plain SwiftUI screens — use `ios-feature`.
metadata:
  modules:
  last-reviewed: 2026-10-23
  owner-agent: ios-engineer
---

# AVFoundation camera on iOS

## Trigger

- Changing how `LiveCaptureCamera.swift` builds, starts, stops or reads the `AVCaptureSession`: inputs,
  outputs, pixel format, rotation, the photo request, the torch, or the frame cadence.
- The `CaptureCamera` protocol, the controller that runs it (`CaptureCameraController.swift`), or the
  Dev harness camera that replaces it (`CaptureFrameSetCamera.swift`, `CaptureDebugHarness.swift`).
- Camera permission, the no-camera path, the camera usage string, the privacy manifest, CoreMotion,
  spoken hints and VoiceOver announcements, or the library import on the capture flow.
- A crash or hang in the camera: a photo on a stopped session, a frozen preview, a stuck shutter.
- Not this skill: the Vision foreground mask, body pose and still analysis in
  `CaptureVisionAnalysis.swift` (`apple-vision-ios`); rules, thresholds and the lock machine in the
  `CaptureModel` target (`ios-feature`, thresholds through `api-contract-change`); frame sets and sweeps
  (`capture-frames`); how a camera screen looks (`ui-prototype-first`).

## Required reading

1. `.claude/plans/2026-10-22-capture-camera-brief.md` §0 (nothing saved or uploaded), §1 (where the code
   lives), §7 (permission C23, no camera), §8 (accessibility), §11 (harness) and §12 C22–C26.
2. The port and its runner: `apps/ios/Packages/Features/Sources/CaptureFeature/CaptureCamera.swift`,
   `apps/ios/Packages/Features/Sources/CaptureFeature/CaptureCameraController.swift` and
   `apps/ios/Packages/Features/Sources/CaptureModel/CapturePorts.swift`.
3. The live camera: `apps/ios/Packages/Features/Sources/CaptureFeature/LiveCaptureCamera.swift` (its
   header explains the isolation) and `CaptureSessionPreview` in
   `apps/ios/Packages/Features/Sources/CaptureFeature/CaptureCameraParts.swift`.
4. The screens around it: `apps/ios/Packages/Features/Sources/CaptureFeature/CaptureCameraView.swift`
   (the `.task` lifecycle, hardware shutter), `apps/ios/Packages/Features/Sources/CaptureFeature/CaptureSupportViews.swift`
   (permission and no-camera) and `CaptureImportPickerView` in
   `apps/ios/Packages/Features/Sources/CaptureFeature/CaptureResultViews.swift`.
5. The harness: `apps/ios/Packages/Features/Sources/CaptureDebug/CaptureFrameSetCamera.swift`,
   `apps/ios/Packages/Features/Sources/CaptureDebug/CaptureDebugHarness.swift`, the "Capture test
   harness" section of `apps/ios/README.md`, and `scripts/check-capture-harness.sh`.
6. Build wiring: target comments in `apps/ios/Packages/Features/Package.swift`, the `CaptureDebug`
   entry in `apps/ios/project.yml`, `apps/ios/Config/Dev.xcconfig`, `apps/ios/App/AIStylistApp.swift`,
   `apps/ios/App/Info.plist` and `apps/ios/App/PrivacyInfo.xcprivacy`.
7. `.claude/rules/ios.md`. For any API claim, Apple's current AVFoundation docs (context7 library
   /websites/developer_apple_avfoundation, checked 2026-10-23); note the date.

## Workflow

1. Copy the structure from: `LiveCaptureCamera.swift` (a device feature: session work in
   `makeRunningGraph`, frame work in `LiveFrameProcessor`, results as `CaptureObservation`),
   `CaptureFrameSetCamera.swift` (the same feature on stored frames) and `CaptureCameraController.swift`
   (an effect the model returns, performed). First restate which side of the `CaptureCamera` port the
   change sits on.
2. Search before write: `rg -n 'AVCapture|CMMotion|AVSpeech|PhotosPicker' apps/ios/Packages`. Extend
   `LiveCaptureCamera`; never add a second session owner or a camera singleton.
3. Layering. AVFoundation, CoreMotion, AVFAudio and PhotosUI stay in the `CaptureFeature` target, inside
   `#if os(iOS)`. The `CaptureModel` target imports none of them (`just ios-check-banned` bans UI
   imports there), so it keeps building on Linux. The camera only measures and reports; every decision
   (lock, hint, speech, capture) comes from `CaptureModel`.
4. One port, two cameras. A new camera ability goes into the `CaptureCamera` protocol and into both
   `LiveCaptureCamera` and `CaptureFrameSetCamera` (and `CaptureSwitchableCamera` in the harness). The
   frame-set camera is how the simulator tests the same screens.
5. Threading. `startRunning()` blocks, so the session is built and started in `makeRunningGraph`
   (`@concurrent`, `nonisolated`) and returned as `sending` to the main actor, which keeps it for the
   preview layer. Never start it on the main actor. Frames arrive on `LiveFrameProcessor.queue`; that
   class is `nonisolated`, `Sendable`, and keeps its state in a `Mutex`. Only the Sendable
   `CaptureObservation` crosses to the main actor. The package defaults to `MainActor`, so a new type
   used off the main actor needs `nonisolated`. Never reach for `@unchecked Sendable`,
   `nonisolated(unsafe)` or `@preconcurrency import` (banned).
6. Frame budget. The delegate must return fast, or AVFoundation drops frames (Apple docs). Keep
   `alwaysDiscardsLateVideoFrames`, preview-sized buffers and the `bufferingNewest(1)` stream. Emit at
   most every `CaptureRules.Evaluation.intervalMs`, the mask on `CaptureMaskCadence` (slower when
   `thermalState` is serious or worse, commit 6a2502a), pose only in worn mode every
   `CaptureRules.Ios.poseIntervalMs`. Never hold a `CMSampleBuffer` past the callback. Timing values
   live in `packages/shared-kernel/registry/capture-rules.json`; change them through
   `api-contract-change`, never as a literal.
7. Orientation. Video, photo and preview connections use `videoRotationAngle = 90`, so normalised
   coordinates match the portrait screen with the origin top-left, and Vision reads the buffer as
   `.up`. Change all three together, or boxes and outlines drift from the preview.
8. Photos. `takePhoto()` first checks the session is running, not interrupted, and the photo
   connection is active and enabled: `capturePhoto` on a dead connection raises an Objective-C
   exception (a crash, commit 6a2502a). Throw instead; the controller maps a throw to `captureFailed`
   and ignores a cancelled task. Photos live only in `CapturePhotoStore`, which empties when the flow
   closes. Never write to the photo library, disk or network in v1 (brief §0, C22).
9. Lifecycle. The camera runs inside the view's `.task(id: scenePhase != .background)`; cancelling it
   calls `stop()`, which turns off motion, the stream, the torch and the session. `runNumber` lets only
   the latest run stop the shared camera. Keep stop and start symmetric; C24 checks the return from
   the background.
10. Stalls. A frozen or interrupted feed needs no camera timer. The camera just stops yielding; the
    model's `tick` sends the shutter back to warming up after `staleFeedAfterMs` (commit 371ab42).
11. Permission and no camera. `start(for:)` asks with `AVCaptureDevice.requestAccess` only when the
    status is `.notDetermined`. Denied or restricted returns `.permissionDenied` (the Settings screen);
    no device or a failed configuration returns `.noCamera` (the Simulator), and import still works.
12. Usage string and privacy. `NSCameraUsageDescription` in `apps/ios/App/Info.plist` repeats the
    in-app permission copy word for word (brief §7 C23). Change it, the `Localizable.xcstrings` entry
    and the Android string together, and run `security-privacy-review`. Any new required-reason API,
    stored key or collected data goes into `apps/ios/App/PrivacyInfo.xcprivacy` in the same change.
    PhotosPicker hands over only the chosen photo, so the app holds no photo-library usage string; a
    feature that needs one is a stop.
13. Motion. `CMMotionManager` device motion runs on its own `OperationQueue` at the evaluation
    interval. The handler is built in a `nonisolated static` function and writes to the processor;
    tilt is the angle between gravity and the phone's back axis.
14. Speech. `SpeechGate` in the model decides what is spoken. `CaptureEffectPerformer` only delivers:
    with a screen reader on, an `AccessibilityNotification.Announcement`; otherwise
    `AVSpeechSynthesizer`. Never both. The harness flag `captureScreenReader` forces the screen-reader
    path; real VoiceOver is device-only.
15. Harness. `CaptureDebug` depends on `CaptureFeature`, never the reverse. The app builds it with
    `link: false`; only `apps/ios/Config/Dev.xcconfig` links it, and only `#if DEBUG` code imports it.
    `just ios-build` greps the app for `CaptureDebug`, `capture-results` and `cap-debug`: present in
    Dev, absent in Preview and Prod. Keep those names out of production targets.
16. Visual changes (a new control, preview chrome, the state screens) go through `ui-prototype-first`
    and `DESIGN.md` tokens before code, per `.claude/rules/design-system.md`.
17. Evidence. The Simulator has no camera, and Vision there has no foreground mask, so the live camera
    is device-only. Prove the shared path with `just capture-sim-ios`; report real-camera, torch,
    hardware-button, heat and VoiceOver results as Not run unless you ran them on a phone.

## Validation commands

```bash
just test ios                           # Linux and macOS: CaptureModel tests incl. offline (C22) and stalled feed
just ios-check                          # full gate; macOS adds Dev + Prod builds with the harness grep
just ios-build --config prod            # macOS: the harness must be absent from Prod
just ios-test                           # macOS: package tests on the simulator
just ios-e2e e2e/capture/permission.yaml   # macOS: C23 permission and no-camera screens
just capture-sim-ios                    # macOS: harness sweeps + every e2e/capture flow, scored
just ios-run                            # macOS: Dev build in the simulator for a manual look
```

## Output

The `agent-operating-contract` report. Add one line per camera change: which actor or queue runs it,
what crosses actors, and what the frame-set camera does for the same input. List any change to the
usage string or privacy manifest. Device evidence only if it was run.

Done checklist: no AVFoundation in `CaptureModel` · session started off the main actor · only Sendable
values cross actors · both cameras implement the port · photos in memory only · harness absent from
Prod · usage string and manifest match · device results reported as run or Not run.

## Stop / escalation

- Saving to the photo library or disk, uploading, or a new usage string (photos, microphone, location)
  → stop; it breaks brief §0 and needs the owner and `security-privacy-review`.
- A new Vision request or a change to the mask or pose output → `apple-vision-ios`.
- A timing or threshold change (`intervalMs`, `staleFeedAfterMs`, `poseIntervalMs`) →
  `api-contract-change` on `capture-rules.json`; it changes Android too.
- A new or restyled camera control → `ui-prototype-first` and `ui-designer` first.
- The harness must ship outside Dev, or the grep must loosen → stop; brief §11 forbids it.
- A remote package for camera work → stop; brief §1 allows system frameworks only.

## Overlap

Loaded next to `ios-feature`, which owns `apps/ios/**`; this skill owns no paths. Adjacent:
`apple-vision-ios` (the Vision requests that read these buffers), `camerax-android` (the Android
counterpart; parity comes from the brief, never from Android sources), `capture-frames` (frame sets,
`just capture-frames` and the simulator sweeps), `api-contract-change` (capture-rules timings),
`security-privacy-review` (usage strings, the privacy manifest, photos as sensitive data),
`ui-prototype-first` (visual changes, with `DESIGN.md`), `e2e-device-testing` (the `e2e/capture`
flows), `performance-profiling` (device traces and heat).
