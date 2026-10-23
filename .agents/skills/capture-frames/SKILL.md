---
name: capture-frames
description: Build, change or debug the capture camera's test-frame tooling — `just capture-frames` (the macOS-only Swift generator: frame sets, masks, boxes, keypoints, expected results), the live-outline parity fixture, the simulator loops `just capture-sim-ios`, `just capture-sim-android` and `just capture-sim` (sweeps, scoring, scoreboard, finish line) and the debug harnesses that play the frames (iOS CaptureDebug, Android :feature:capture-debug launch extras). Use for "capture frames", "frame set", "new variant", "expected.json", "capture-sim", "sweep", "scoreboard", "finish line", "false lock", "outline parity", "captureFrameSet", "captureSweep", "captureMasks", or a failing case in summary.md. Not for live ML Kit — use `mlkit-android`; not for the LiteRT segmenter — use `litert-android`; not for Vision on the phone — use `apple-vision-ios`; not for writing a Maestro flow — use `e2e-device-testing`; not for a rule threshold — use `api-contract-change`; not for other recipes or CI — use `tooling-ci`.
metadata:
  modules:
  last-reviewed: 2026-10-23
  owner-agent: tooling-engineer, ios-engineer, android-engineer
---

# Capture test frames, harness and simulator loop

## Trigger

- Adding or changing a frame family, variant, hard case or expected result in the generator
  (`tools/capture-frames/Sources/Generator.swift` and its neighbours), or the output layout
  (`index.json`, `expected.json`, `frame.box.json`, `frame.keypoints.json`).
- A harness change on either app: a launch extra, the frame source, the sweep clock, the results
  log (`capture-results.jsonl`), or the debug panel.
- Running, reading or fixing a simulator loop: a failing case, a miss, a false lock or unlock, the
  anyway timing, the scoreboard, or the finish line.
- The live-outline parity fixture `tools/capture-frames/parity/outline-parity.json` or either app's
  parity test.
- Not this skill: live detectors (`mlkit-android`, `litert-android`, `apple-vision-ios`), the camera
  feed (`camerax-android`, `avfoundation-camera-ios`), the flows themselves (`e2e-device-testing`),
  rule numbers (`api-contract-change`), screens and copy (`ios-feature`, `android-feature`).

## Required reading

1. `tools/capture-frames/README.md`, whole: sources of every number, base-image choice, variants,
   hard cases, edge grazes, output layout, simulator runs and scoring.
2. `.claude/plans/2026-10-22-capture-camera-brief.md` §0 (finish line and what simulators prove),
   §11 (harness), §12 (cases C1–C32) and §16 (owner answers: hard limits, BLOCKED, thresholds).
3. `packages/shared-kernel/registry/capture-rules.json` and `tools/capture-frames/Sources/Rules.swift`
   (what the generator decodes), then `Harness` and `Layout` in `tools/capture-frames/Sources/Judge.swift`.
4. The loop: `tools/capture-frames/capture-sim.sh`, `tools/capture-frames/capture-score.mjs`,
   `tools/capture-frames/capture-report.mjs`, `apps/android/tools/capture-frames.sh`.
5. The harnesses: `apps/ios/Packages/Features/Sources/CaptureDebug/CaptureDebugOptions.swift`,
   `apps/ios/Packages/Features/Sources/CaptureDebug/CaptureFrameIndex.swift`,
   `apps/ios/Packages/Features/Sources/CaptureDebug/CaptureFrameSetCamera.swift`, and in
   `apps/android/feature/capture-debug/src/main/kotlin/app/aistylist/feature/capture/debug/`
   the files `CaptureHarnessArgs.kt`, `FrameIndex.kt`, `FrameSetSource.kt`, `SweepRunner.kt` and
   `DetectorProbe.kt`; the feature/capture-debug row of `apps/android/README.md`.
6. For the outline: `tools/capture-frames/parity/README.md` ("Pinned details").

## Workflow

1. Copy the structure from: a new frame set — `tools/capture-frames/Sources/Generator.swift`,
   `tools/capture-frames/Sources/Judge.swift` and `tools/capture-frames/Sources/Renderer.swift` as
   commit 1cee431 changed them (C2 hook, C6 strap), hard cases in
   `tools/capture-frames/Sources/HardCases.swift`; a launch extra — `CaptureHarnessArgs.kt` and
   `CaptureDebugOptions.swift` together; a scoring rule — `capture-score.mjs` plus the definitions
   text in `capture-report.mjs`. First restate the case (brief §12 C-number), the family and
   variant, the platforms and the expected result.
2. Search before write: `rg -n '<variant or extra>' tools/capture-frames apps/ios/Packages/Features/Sources/CaptureDebug apps/android/feature/capture-debug`.
   Extend the existing variant list, reader or scorer; never add a second frame reader or scorer.
3. One source for every number. Thresholds come only from `capture-rules.json`, decoded in
   `Rules.swift`. `Harness` holds only the test-set values the brief §11 fixes (30 fps, 180 frames,
   25 % past the edge, 35 % of the minimum, luma 30, 25 px blur, jitter 0.06); `Layout` holds only
   placement and margins. A new or changed rule number goes through `api-contract-change`, never a
   literal in Swift, Kotlin or the scorer.
4. Expected results come from geometry and the rules (`Judge.swift`), never from running an app.
   The `platform` block stays `{}`: both apps measure the item from a mask the same way (4a03994).
5. A frame must show what its variant claims. Every check before the deciding one passes with a
   margin and the deciding one fails with a margin, so a Mac-versus-phone detector difference
   cannot flip it; a base that misses is rejected and `manifest.json` says why. Never shrink a
   margin to ship a set. Check the contact sheets by eye after a change (74c8064: frames shipped
   that did not match their expected results).
6. Running the generator. It is macOS 14+ only, built with the Xcode pinned in
   `apps/ios/.xcode-version`; on Linux it exits 1, so report it as Not run. It is idempotent: the
   fingerprint covers the sources, the script, `capture-rules.json` and the Xcode pin; delete
   artifacts/capture-camera/frames to force a rebuild. The output lives under artifacts/ (gitignored):
   never commit it, copy it into an app or a test, or hand-edit it.
7. No real person. Dataset photos are CC0 (read from the dataset's LICENSE) and used only when
   Vision finds no face, body or hand; worn frames use the drawn `Figure` from
   `tools/capture-frames/Sources/Shapes.swift`, with generator-placed keypoints as ground truth.
8. Index changes reach both readers. A new `index.json` field is read by `CaptureFrameIndex.swift`
   and `FrameIndex.kt` in the same change. The generator writes the jitter path itself so both
   apps play the same offsets (`JitterPath`, `tools/capture-frames/Sources/Output.swift`; d442fee
   keeps it shaky at both the evaluation and the mask interval). Two or more instances ship a label
   PNG; the largest instance is the item (881229b).
9. Launch extras keep one name on both apps (`captureFrameSet`, `captureSweep`, `captureScreenReader`,
   `captureRecordOnly`, `captureMaskCadenceMs`, `captureFramesDir`, the hold switches); Android-only
   extras such as `captureMasks`, `captureBoxes`, `capturePose`, `captureCovered`,
   `captureSweepFilter` and `captureDebugPanel` are listed in the
   `apps/android/README.md` row. Update that row and the README with the code.
10. The harness ships in Dev and debug only: `link: false` in `apps/ios/project.yml` plus
    `apps/ios/Config/Dev.xcconfig`, and `debugImplementation` in `apps/android/app/build.gradle.kts`.
    `scripts/check-capture-harness.sh` greps release artefacts for `CaptureDebug`, `capture-results`,
    `cap-debug` and the debug package path: renaming one of those marks blinds the gate. The
    results log holds rule outcomes and outline scores only, never pixels, masks, boxes or photos.
11. Sweep clock parity. Sweeps run on a virtual clock, and the loop plays both apps at the phone's
    mask cadence (`mask.intervalMs`). Android's harness defaults to it in a sweep; iOS gets it only
    from `capture-sim.sh` (`-captureMaskCadenceMs`), so a hand-launched iOS sweep must pass it to
    match the loop. A new segment takes a fresh mask (3d2263f). Android ticks strictly before a
    frame stamped at the same instant, as iOS does (c4eeb3d). A timing change on one harness is
    compared against the other's results before it lands.
12. Simulator loop facts. Android uses the AVD aistylist-dev or `ANDROID_SERIAL`, never another
    agent's emulator; no Gradle build runs beside a sweep (it has wedged the emulator); the flows run
    with the network off (C22). Android is scored on stored masks and keypoints; its live LiteRT and
    ML Kit sweep is information only. `capture-sim.sh` runs every flow in `e2e/capture` in light
    and dark, so a new flow needs no runner change.
13. Never move a bar to pass. Keep `MAX_FALSE_LOCK_SHARE`, `OUTLINE_MIN_STABILITY`, the anyway
    tolerance and every `expected.json` as they are. A case stuck after three tries gets a BLOCKED
    row in the scoreboard with attempts and evidence; a sanctioned threshold or harness change gets
    a row with old, new and reason (brief §16).
14. Finish line: every simulator-testable case passes on both platforms in two consecutive
    `just capture-sim` runs, with 0 misses, 0 false unlocks, false locks ≤ 10 %, anyway at
    10.0 ± 0.5 s, the screen-reader sweeps and every flow in both themes. One green run is not it.
    Simulators never prove the camera, Vision on an iPhone, ML Kit speed, real bodies, heat or real
    VoiceOver and TalkBack: report those as device-only.
15. Parity fixture. `outline-parity.json` is committed and generated by `outline_reference.py`;
    never hand-edit it or widen its 0.005 tolerance. A spec change edits the reference, regenerates,
    and fixes both ports (`CaptureOutlineContour.swift`, `OutlineContour.kt`) in one change, so both
    parity tests (`CaptureOutlineParityTests.swift`, `OutlineParityTest.kt`) pass.
    The write and check commands are in `tools/capture-frames/parity/README.md`. Kotlin's
    `Math.round` rounds half up: use round-half-to-even (pinned detail 1).
16. The scorer and report have no unit tests; prove a change with a simulator run and quote its
    summary line. Update `tools/capture-frames/README.md` in the same change.

## Validation commands

```bash
just capture-frames            # macOS only: rebuild frames after a generator or rules change
just capture-sim-ios           # macOS: iOS loop; read the run's summary.md
just capture-sim-android       # Android loop (scored on stored masks and keypoints)
just capture-sim               # both platforms in one run folder: the finish-line run, twice
just test ios                  # CaptureDebugTests + CaptureModelTests (outline parity)
just test android              # SweepRunnerTest, HarnessTest, OutlineParityTest
just lint                      # shellcheck covers the tools/capture-frames scripts
just ios-check                 # if apps/ios touched: on macOS also the Dev/Prod harness grep
just android-check             # if apps/android touched: debug holds the harness, release does not
just docs-check                # after a README or skill change
```

## Output

The `agent-operating-contract` report. Add: the cases or variants touched (brief §12 IDs), the
run folder and its summary verdict line per platform, the scoreboard rows added (BLOCKED or
threshold change), and the device-only list marked Not run. Name any run you did not do.

Done checklist: no threshold literal outside capture-rules.json · expected results from geometry,
not from an app · nothing under artifacts/ committed · both harnesses and both readers changed
together · parity fixture regenerated, not edited · no bar or expected file moved to pass ·
finish line claimed only after two consecutive `just capture-sim` runs · device-only items
reported as Not run.

## Stop / escalation

- A case can pass only by loosening a rule number → stop; `api-contract-change` on
  `capture-rules.json`, with old, new and reason, after the owner agrees.
- A case still fails after three tries → BLOCKED row with evidence, then continue with other cases.
- The fix needs a real photo of a person or a non-CC0 image → stop; the owner decides.
- The generator needs a new dependency or a network source beyond the dataset → stop; the owner
  approves, `tooling-ci` lands it.
- A new `just` recipe → `tooling-ci`, plus a human-applied row in the doc 15 §5 catalog (DC-15).
- A live detector disagrees with the stored masks or boxes → `mlkit-android`, `litert-android` or
  `apple-vision-ios`.

## Overlap

This skill owns no paths. It loads next to the skill that owns the file being edited:
`tooling-ci` owns `tools/**`, including `tools/capture-frames`; `ios-feature` owns `apps/ios/**`;
`android-feature` owns `apps/android/**`; `e2e-device-testing` owns `e2e/**` and writes the flows
in `e2e/capture` this loop runs. Adjacent: `mlkit-android` (live ML Kit boxes and pose in the
information sweep), `litert-android` (the live-mask sweep and segmenter log), `apple-vision-ios`
(the Vision masks the generator stores), `camerax-android` and `avfoundation-camera-ios` (the real
camera the frame source replaces), `api-contract-change` (capture-rules thresholds),
`performance-profiling` (timing claims beyond the virtual clock).
