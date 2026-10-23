# tools/capture-frames — test frames for the guided capture camera (`just capture-frames`)

The generator builds the frame sets that the iOS and Android debug frame source plays through the
real analysis path, lock machine and screens (capture brief
`.claude/plans/2026-10-22-capture-camera-brief.md` §11, cases §12). It is a Swift program on Core
Image and Vision. It adds no dependency.

```bash
just capture-frames   # macOS only; writes artifacts/capture-camera/frames/ (gitignored)
```

- **macOS only.** `capture-frames.sh` compiles `Sources/*.swift` with `xcrun swiftc` from the Xcode
  pinned in `apps/ios/.xcode-version` (`DEVELOPER_DIR` is set when that Xcode is installed but not
  selected). It needs macOS 14 or later, for `VNGenerateForegroundInstanceMaskRequest`. On Linux
  it stops with exit 1 and says why.
- **Idempotent.** The output is kept when nothing it depends on has changed: the Swift sources, the
  script, `packages/shared-kernel/registry/capture-rules.json` and the Xcode pin. Delete
  `artifacts/capture-camera/frames/` to force a rebuild. A run builds into `frames.partial/` and
  swaps it in, so a failed run never leaves half a set.
- **Network.** Only `images.csv`, `LICENSE` and the images the generator tries are fetched from
  `raw.githubusercontent.com` (Git LFS objects from `media.githubusercontent.com`). Each file is
  fetched once into `artifacts/capture-camera/source/clothing-dataset/`. Nothing clones the
  repository. Offline, every family uses drawn items, and `manifest.json` and the summary say so.

Why `tools/`: it is repository tooling that builds test inputs, like `tools/codegen`. It is not
product code, and it is not a shell helper (`scripts/`). Its output is never committed.

## One source for every number

Every threshold comes from `capture-rules.json` (`Sources/Rules.swift` decodes it). That covers
family minimums, the edge band, the iOS minimum instance share and edge-contact share, sharpness,
light, worn-mode keypoint bounds, body parts, hint keys and lock reasons. Nothing is restated.
`Sources/Judge.swift` `Harness` holds only the values the brief fixes for the test set itself:

- Playback (§11): 30 fps, 180 frames per segment, 30-frame gaps in sweeps and batches.
- Cut off (§11): 25 % of the item's box past the edge.
- Too small (§11): 35 % of the family minimum (box area).
- Too dark (§11): mean luma 30 (how the frame is darkened: "Too dark" below).
- Motion blur (§11): Core Image motion blur, 25 px at a 640 px long side (angle: below).
- Jitter (§11): 0.06 of the frame, as per-frame offsets the apps play (below, "Jitter").
- Worn part cut off (§11): 25 % of the torso height past the edge.
- Acceptance (§0, C1): unlock within 3000 ms; "Take photo anyway" at 10 s ± 500 ms.

The brief gives no blur angle. A blur leaves the item's edges along its own direction sharp, so the
generator tries 45° first, then 135°, 0° and 90°, and keeps the first blur that leaves the item
clearly unsharp (the margin under "How base images are chosen").

### Too dark

C13 and the owner's Q15 answer say light never locks: a dim frame of a good item shows
`cap-hint-too-dark` and the shutter still unlocks. So the too-dark frame must stay sharp enough to
pass the steady check (`steady.minSharpness`) with the usual margin. Scaling the whole good frame
down to mean luma 30 does not do that: it multiplies the Laplacian variance by the scale squared
(about 0.07 at 118 → 30), and most items then measured under 24. A phone camera in a dim room does
not behave like that either. Auto-exposure raises the sensor gain, and local tone mapping keeps
fine detail at nearly full contrast, while the overall level stays low and the gain adds noise.

The generator copies that. It splits the good frame into a local mean (a 7 × 7 px box at 640 px)
and the detail around it, scales only the local mean until the frame's mean luma is 30, keeps the
detail at full contrast, and adds seeded Gaussian luma noise with σ = 2 (`Layout.darkDetailRadiusPx`,
`Layout.darkNoiseSigma`). No threshold in `capture-rules.json` changes. The noise is mild and does
not decide the verdict. Measured with the noise off (2026-10-22), every too-dark frame kept at least
half of its good frame's sharpness, 71 or more, far above the 2 × 12 margin; the noise adds about 10.

## How base images are chosen

1. **Dataset families.** Candidates come from the CC0 dataset
   [alexeygrigorev/clothing-dataset](https://github.com/alexeygrigorev/clothing-dataset), in
   image-id order, at most 40 per family. They are tried until 5 pass. `Dataset.familyLabels` maps
   the labels to families: `top` (T-Shirt, Shirt, Longsleeve, Polo, Top, Blouse, Hoodie),
   `long-bottom` (Pants), `short-bottom` (Shorts, Skirt), `one-piece` (Dress), `outerwear` (Outwear,
   Blazer), `shoes` (Shoes) and `small-item` (Hat). The licence is not assumed: the generator reads
   the dataset's `LICENSE` file and records the line that states CC0 (`CC0 1.0 Universal`). The
   README does not name the licence. Without that line the dataset is not used.
2. **A photo is used only when** Vision finds no face, human body or hand in it. This is the
   mechanical "no real person" check. The photo must also hold exactly one foreground instance
   that touches no edge band and covers at least 3 % of the photo.
3. **Every variant must hold up.** The finished frame is measured the way the iOS rules read it:
   the Vision mask, box, edge contact, the sharpness of the 3×3 Laplacian at a 320 px long side,
   mean luma and clipped share. A check before the deciding one must pass with a margin. The
   deciding check must fail with a margin. The margins are 2× or 0.5× the sharpness minimum,
   1.1× or 0.9× the size minimum, contact over 1.25× or under 0.5× the threshold, and luma
   10 inside the light limits. Otherwise the base is rejected, and `manifest.json` records why. The
   margins keep a small difference between the Mac's Vision and a phone's detector from flipping
   a verdict.
4. **Drawn items.** `Sources/Shapes.swift` draws items in flat colour with a plaid texture (a
   checkerboard repeats along the 45° blur and stays sharp). They
   fill `bag`, which has no dataset label. They fill any family with fewer than 5 passing photos,
   and every family when the dataset is unreachable. They are marked `synthetic` in the index and
   the manifest.
5. **`generic`** reuses the first base of each other family, drawn at the generic minimum.

## Variants

Flat mode, per base image, one set each: `good`, `cut-top`, `cut-bottom`, `cut-left`, `cut-right`,
`too-small`, `too-dark`, `motion-blur`, `jitter` and `two-items`. `jitter` plays the good frame with
playback jitter. `two-items` places the next base beside this one, and ships only when Vision finds
both as separate instances. The first base also gets two extra sets, built after base selection so
a rejection drops only that set: `too-big` (C11: the item scaled up until 25 % of its box lies past
the two edges it reaches first, split evenly, so it touches two or more edges and locks with
`cap-hint-cut-off-multiple`; at 25 % past each edge it fills the frame and Vision finds no item)
and, for `small-item` only, every base gets `too-small-found` (C5: the box midway between the size at
which iOS clearly finds the mask, 1.1 × `mask.minInstanceAreaShare` ÷ coverage, and 0.9 × the family
minimum; it locks with `cap-hint-too-small` on both platforms, where brief §11's 35 % too-small reads
as no item on iOS) and `too-bright` (the good item on a white surface: everything but the
item is clipped white, so the clipped share is clearly over the limit while the item stays found and
sharp; it unlocks with `cap-hint-too-bright`). The first base also gets the light and tilt hard cases (`overexposed`,
`glare-spots`, `glare-window`, `tilt`, `tilt-under`; below, "Hard cases"), and the first two bases of
every family but `generic` the surface and covered cases. Per family there is also one
`empty` set (the shared plain background) and one `sweep` set: every good frame in turn, with 1 s
of empty background between them. One `batch-<n>` set (C20) holds up to 10 different items judged
under the `generic` family, with empty gaps between them.

Worn mode, per family that offers it (`modes` in the registry): `whole`, `shoulders-cut`,
`hips-cut`, `knees-cut`, `ankles-cut`, `too-small` and `jitter`. The person is drawn from simple
shapes (`Figure` in `Sources/Shapes.swift`) and wears the family's first base whose worn variants
all hold up (`generic` takes only bases from a family that is worn, placed where that family's
garment sits). The generator places
the keypoints itself, so the keypoint file is ground truth. Shoulders and ankles move past the top
or bottom edge. Hips and knees are "camera too close". When the part sits below the middle of the
garment, the shoulders stay at 10 % from the top and the body is scaled until the part ends past
the bottom edge; at that scale the shoulders of a top also leave the sides, and the keypoint file
says so. When it sits above the middle (the hips of `long-bottom` and `short-bottom`), the ankles
stay at 10 % from the bottom and the part ends past the top edge, so the garment stays in view.
Joints are named by the subject's
side. The subject faces the camera, so `leftShoulder` is on the image's right.

## Hard cases

The owner asked for strict frame sets for the hard capture cases (brief §12 C8–C11, C32, tilt and
glare; 2026-10-22). Every one is drawn here (`Sources/HardCases.swift`): procedural textures and plain
shapes on the CC0 cut-outs, never a photo of a person or a real hand.

- **Surfaces (C8–C10).** The good item on dark twill fabric (`dark-on-dark`: the garment toned to
  mean luma 64 on fabric at 62), on white bedding with soft folds (`white-on-white`: 196 on 192) or on
  a striped floral sheet (`patterned`: the garment in its own colours). Toning keeps the detail at full
  contrast, as for "Too dark", keeps 30 % of the garment's saturation and erodes its outline by 2 px,
  so no fringe of the photo's own white background is left. Each image ships twice, as two sets:
  `<surface>` stores the true mask, as a good detector would see it (unlocks, `cap-hint-ready`), and
  `<surface>-weak` stores no instance, as a weak detector would (locked `no-item`, anyway at 10 s with
  the surface tip). The light stays inside the light limits plus the usual margin, so the case is
  contrast, not light.
- **Vision on the surfaces.** The generator also runs the Mac's Vision foreground instance mask on
  every surface composite of every base, and records in the segment `metrics.vision` and in
  `manifest.json` `hardCaseVision` whether it found the item (an instance with IoU ≥ 0.5 against the
  true mask). The stored masks never come from that run. First run, 2026-10-22: Vision found the item
  in 40 of 40 composites on each surface. Clean cut-outs on drawn textures are easier than real
  fabric under real light, so the weak flavour stays: a phone's detector is device-only evidence.
- **Partly covered (C32).** A plain object lies on the good item: a grey or skin-neutral rounded
  shape, a phone, a book or a mug, 30 % of the box width wide, fully inside the item's box
  (`covered-inside`) or across its right edge with 80 % of its width inside (`covered-edge`). The
  stored instances are the ground truth, item and object apart; both apps lock with
  `cap-hint-covered`. Vision merged the object into the item in 66 of 66 composites (2026-10-22): on
  iOS the rule's input is device-unverified, and a merged object unlocks (a miss, not a false lock).
  `small-item` has no covered set: an object 30 % of a ring's box is smaller than the rule's minimum,
  and a larger one hides the ring.
- **C11 coat too big** is the `too-big` set above; its expected file names the "Try hanger mode"
  reason line.
- **Tilt.** `tilt` plays the good frame with a stored phone tilt 5° over `tilt.hintAboveDegrees`
  (unlocks with `cap-hint-tilt`: tilt is a hint, never a lock), `tilt-under` 2° under it (unlocks with
  `cap-hint-ready`). The segment's `tiltDegrees` is fed as the gravity angle on both platforms.
- **Glare.** `overexposed` lifts the whole frame to mean luma 235 with its detail kept (unlocks with
  `cap-hint-too-bright`). `glare-spots` puts three small clipped highlights on the garment, far too
  small a share for the hint (unlocks with `cap-hint-ready`). `glare-window` lays a patch of direct
  sun over the surface and part of the item (clipped share over 31 %, `cap-hint-too-bright`). Vision
  lost the item or cut it short under that patch in 7 of 9 families, so only 2 ship; the clipped-share
  path is also covered by `too-bright`.

## Edge grazes

Two cases where an item touches an edge band on purpose and still unlocks (brief §12 C2, C6). Both
store the mask they draw as the ground truth (one instance: the item and what it carries) and record
what the Mac's Vision found in `metrics.vision` and `manifest.json` `hardCaseVision`.

- **C2 hanger hook.** The first base of every family that offers hanger mode hangs on a drawn wire
  hanger (a triangle across the shoulders; for a bag only the neck, down into the strap). Its hook
  reaches into the top edge band until the top contact is midway between clearly over the flat limit
  (1.25 × `mask.cutOffAboveEdgeContactShare`) and the most a graze may touch under the hanger limit
  (`Layout.grazePassFactor` 0.75 × `mask.hangerTopCutOffAboveEdgeContactShare`): about 6.25 % of the
  top edge. One image ships as two sets: `<family>-hanger-01-hook` (variant `hanger-hook`, hanger mode,
  unlocks with `cap-hint-ready`) and `<family>-flat-01-hook` (variant `hook`, flat mode, locked
  `cap-hint-cut-off-top` with "Try hanger mode"). The flat set proves the hook counts as part of the
  item, the hanger set that hanger mode tolerates it.
- **C6 bag strap.** Every bag base moves up until its top grazes the top edge band with half the most
  a graze may touch under the flat limit (0.5 × 0.75 × 4 % = 1.5 % of the top edge), the rest of the
  bag clear of every band: `bag-flat-0N-strap-graze`, unlocks with `cap-hint-ready`. A bag without a
  strap touches far more at once and is rejected (the manifest says why).

`Layout.grazePassFactor` (0.75) is wider than `contactPassFactor` (0.5) only for these deliberate
grazes: with 0.5 the hook could not be clearly over the flat limit and clearly under the hanger limit
at once (both bounds would be 5 %). The stored masks are what both apps read, so no detector
difference applies in the simulator; a real hook or strap on a phone is device-only. No threshold in
`capture-rules.json` changes.

## Output: `artifacts/capture-camera/frames/`

```text
index.json                      every frame set; what the apps' debug frame source reads
manifest.json                   dataset licence evidence, chosen image ids and hashes, rejections
summary.txt                     the counts `just capture-frames` prints
contact/<family>.png            every frame of a family with its mask tinted red, for review by eye
common/empty/frame.png          the plain background (+ .mask.png, .box.json)
<family>/<set id>/frame.png     the frame, 480 × 640 portrait (the analysis frame from the registry)
<family>/<set id>/frame.mask.png   Vision foreground mask: 8-bit grey, 0 background, 255 foreground
<family>/<set id>/frame.instances.png   two or more instances only: 8-bit labels, 0 background,
                                1 the largest instance, 2 the next, … (like Vision's label mask)
<family>/<set id>/frame.box.json   instances from that mask: the stored-box fallback
<family>/<set id>/frame.keypoints.json   worn frames only: ground-truth keypoints
<family>/<set id>/expected.json the expected result
batch/expected-NN.json          the batch set's expected results, one per item, and expected-gap.json
```

Set ids are test-ID safe (`cap-debug-frameset-<set id>`): `<family>-flat-<nn>-<variant>`,
`<family>-flat-empty`, `<family>-flat-sweep`, `<family>-hanger-01-hook`, `<family>-worn-<variant>` and `batch-<n>`.

### `index.json`

All paths are relative to the frames folder. A segment plays `frame` for `frames` frames at
`playback.fps`. A jittered segment moves frame `n` by `offsets[n % offsets.count]` (`[dx, dy]`,
shares of the frame), so both apps play the same path and a run repeats exactly; a segment without
`offsets` does not move. The last segment loops until the screen closes.
Each segment names its own `expected` file, so a sweep or batch set is judged item by item.
`metrics` is what the generator measured, for debugging; on a ground-truth frame `metrics.vision`
says what the Mac's Vision made of the same image. A segment with `tiltDegrees` plays with the phone
tilted by that angle (the tilt hint); without it there is no gravity sensor.

```json
{
  "acceptance": { "anywayAtMs": 10000, "anywayToleranceMs": 500, "maxUnlockMs": 3000 },
  "frame": { "heightPx": 640, "origin": "top-left", "orientation": "portrait", "widthPx": 480 },
  "manifest": "manifest.json",
  "playback": { "fps": 30, "gapFrames": 30, "segmentFrames": 180 },
  "rules": {
    "path": "packages/shared-kernel/registry/capture-rules.json",
    "sha256": "<sha-256 of the registry the frames were judged with>"
  },
  "schemaVersion": 1,
  "sets": [
    {
      "baseImages": ["<dataset image id>"],
      "family": "top",
      "id": "top-flat-01-cut-left",
      "kind": "single",
      "mode": "flat",
      "segments": [
        {
          "box": "top/top-flat-01-cut-left/frame.box.json",
          "expected": "top/top-flat-01-cut-left/expected.json",
          "frame": "top/top-flat-01-cut-left/frame.png",
          "frames": 180,
          "jitter": 0,
          "jitterSeed": 1735924466,
          "mask": "top/top-flat-01-cut-left/frame.mask.png",
          "metrics": {
            "boxAreaShare": 0.3,
            "clippedShare": 0,
            "edgeContact": { "bottom": 0, "left": 0.52, "right": 0, "top": 0 },
            "instances": 1,
            "maskAreaShare": 0.21,
            "meanLuma": 118.4,
            "sharpness": 96.2
          }
        }
      ],
      "source": "dataset",
      "variant": "cut-left"
    }
  ]
}
```

A segment whose frame holds two or more instances also names `instances`, the label PNG: the iOS
frame source then takes the largest instance as the item, as the phone does, and gives the others'
boxes to the covered rule (the merged mask alone would make two separate items one item that
"covers" the other).

`kind` is `single`, `sweep` or `batch`. `source` is `dataset`, `synthetic` or `mixed`. A worn
segment also has `"keypoints": "<path>"`, a tilt segment `"tiltDegrees": 25`.

### Jitter

C14 says a jittered frame never unlocks: shaky hands never hold still. Offsets drawn independently
for each frame do hold still now and then. About one jittered set in 25 drew three evaluations in a
row within `steady.maxCentreShift`, and the shutter unlocked as brief §4 says it must (first iOS
sweep, 2026-10-22). Each app also drew from its own random generator, so the two platforms played
different paths from the same seed.

So the generator draws the path itself (`JitterPath` in `Sources/Output.swift`) and writes it into
the index. It draws each frame's offset uniformly within ±`jitter` from SplitMix64 seeded with
`jitterSeed`. It redraws until the offset differs by more than 1.25 × `steady.maxCentreShift`
(`Layout.jitterStepFailFactor`) on at least one axis from every frame that two consecutive reads may
see: one `evaluation.intervalMs` apart (consecutive evaluations) or one `mask.intervalMs` apart
(consecutive masks at the phone's cadence), each up to one frame late, with the segment looping. Only
those distances are constrained; requiring every distance up to the mask interval left some seeds with
no possible offset. No threshold changes.

### `expected.json`

This is the brief §11 schema, plus `lockReason` and `anywayReason`. It is derived from the variant's geometry and
`capture-rules.json`, never from running an app. The lock order is that of brief §4 and §6: no
item, cut off (not in worn mode), body parts missing (worn mode only), covered (not in worn mode),
too small, then not steady. When nothing locks, the hint is `cap-hint-too-dark`,
`cap-hint-too-bright`, `cap-hint-tilt` (flat mode, a stored tilt over the hint angle) or
`cap-hint-ready`. A frame must also show its covered verdict clearly: another instance's box overlaps
the item's box by over 1.25 × `covered.aboveOverlapShare` of the smaller box on a covered frame, and
by at most 0.5 × it on every other frame.

- `shutter`: `unlocked` or `locked`. `either-or-anyway` is not used: each surface case ships one
  strict set per flavour ("Hard cases").
- `hint`: the hint test ID shown while locked, or at unlock for an unlocked frame.
- `lockReason`: a registry lock reason; absent when unlocked.
- `maxUnlockMs`: present when unlocked; the clock starts at the segment's first frame.
- `anywayAtMs`: present when locked: `timing.anywayDelayMs`, ± `acceptance.anywayToleranceMs`.
- `anywayReason`: present when locked, the reason line under "Take photo anyway" (brief §6):
  `surface-tip` for no item, `try-hanger-mode` for a flat cut-off where the family offers hanger mode,
  else the blocking hint's test ID. Both apps' results logs write the same value as `anywayReason`.
- `platform`: per-platform overrides, `{}` when both platforms expect the same. Today it is always
  `{}`: both apps measure the item from a foreground mask the same way (iOS Vision, Android LiteRT;
  owner's mask decision 2026-10-22), so a drawn item whose mask covers less than
  `mask.minInstanceAreaShare`, such as `small-item` too small, locks with `no-item` on both.

```json
{
  "anywayAtMs": 10000,
  "hint": "cap-hint-cut-off-left",
  "lockReason": "cut-off",
  "platform": {},
  "shutter": "locked"
}
```

### `frame.box.json`

The instances of the stored mask, largest first. The Android harness reads them only on the box path
(`captureMasks=none`, the camera's fallback when the segmenter cannot load); by default it reads the
mask PNGs, like iOS. The iOS reader pairs them with the mask PNG for the instance
count, and feeds every box after the first to the covered rule. `source` is
`vision-foreground-instance-mask`, or `ground-truth` for the hard cases' drawn masks. `box` is normalised, with the origin at the top left. `edgeContact` follows the
iOS rule: the share of each edge whose 2 % band holds mask pixels.

```json
{
  "frameHeightPx": 640,
  "frameWidthPx": 480,
  "objects": [
    {
      "box": { "height": 0.5469, "width": 0.5458, "x": 0, "y": 0.2266 },
      "boxAreaShare": 0.2996,
      "edgeContact": { "bottom": 0, "left": 0.52, "right": 0, "top": 0 },
      "maskAreaShare": 0.2104
    }
  ],
  "source": "vision-foreground-instance-mask"
}
```

### `frame.keypoints.json` (worn frames)

Every body part in the registry's `bodyParts`, normalised with the origin at the top left. `present`
applies `worn.keypointMinCoordinate`…`keypointMaxCoordinate`. The frame source feeds `present`
parts as `bodyParts` when the live pose model cannot run.

```json
{
  "parts": {
    "leftAnkle": { "present": true, "x": 0.5877, "y": 0.86 },
    "leftShoulder": { "present": true, "x": 0.6376, "y": 0.2234 }
  }
}
```

## Simulator runs (`just capture-sim-ios`, `just capture-sim-android`, `just capture-sim`)

`capture-sim.sh` runs the loop of brief §15 step 6 in one command. It builds the frames, then per
platform:

1. Builds and installs the Dev app. iOS: `just ios-build --config dev` with the `POSTHOG_CLI_*` keys
   unset, on the iPhone 18 Pro on the newest iOS runtime (or `IOS_SIMULATOR_ID`). Android:
   `just android-run`, which boots the AVD `aistylist-dev` when no device is online, then
   `apps/android/tools/capture-frames.sh push`. No Gradle build runs after that point.
2. Sweeps every frame set on the harness's virtual clock and pulls `capture-results.jsonl`. Both apps
   play masks at the phone's cadence: observations every evaluation interval, a new mask only every
   250 ms (iOS `-captureMaskCadenceMs`, Android `-e captureMaskCadenceMs`; 0 gives every frame a fresh
   mask), so the sweeps exercise the steady rule's mask timestamps. Android is scored on stored masks
   and keypoints, read with the iOS mask measure. A second Android sweep with the live LiteRT
   segmenter on every frame PNG (and live ML Kit pose) is information only; it also pulls
   `capture-segmenter.jsonl` (latency and mask IoU per image).
3. Sweeps the locked sets `top-flat-01-jitter`, `top-flat-01-cut-top`, `top-flat-empty` and
   `top-worn-shoulders-cut` again with the screen-reader flag.
4. Runs every flow in `e2e/capture/` in light, then in dark (`simctl ui appearance`,
   `cmd uimode night`), and keeps their screenshots. On Android, before each flow, it closes any
   system screen a failed flow left open and pushes the frames again if a flow's `clearState` wiped
   the app's external files. Maestro's device logs are dropped: the Simulator's system log trips the
   working-tree secret scan. The Android flows run with the emulator's Wi-Fi and mobile data off
   (C22); the runner turns them back on when it ends.
5. Scores the logs (`capture-score.mjs`) and writes `summary.md` and the scoreboard row
   (`capture-report.mjs`). It exits 1 unless every case, flow and finish-line measure passes.

```text
artifacts/capture-camera/runs/<yyyy-mm-dd-hhmm>/
  raw/<platform>/sweep.jsonl, screen-reader.jsonl   the pulled results logs
  results/<platform>/<case id>.json                 expected, observed, pass, reason
  results/<platform>.summary.json                   counts and lists for the report
  maestro/<platform>/<theme>/<flow>.log, .status    each flow's output and exit code
  screenshots/<platform>/<theme>/<flow>-<shot>.png  every guidance state, light and dark
  summary.md                                        verdicts, numbers, definitions, device-only list
artifacts/capture-camera/scoreboard.md              one row per run; BLOCKED cases; threshold changes
```

### Scoring

One scorer for both apps. It reads the iOS line shape (`events[].shutter` such as
`locked:cut-off`, `anywayMs`) and the Android one (`events[].phase`, `anywayAtMs`,
`finalLockReason`). A case is one segment: a single set, or `<set id>-sNN` in a sweep or batch. The
expected file's `platform.<platform>` block applies first. `summary.md` states the definitions:

- **Unlocked:** first unlock within `maxUnlockMs`, the expected hint shown at the unlock (the
  meaning of `hint` in `expected.json`), and at least one capture.
- **Locked:** never unlocks. The final hint and lock reason are the expected ones. On a single set,
  "Take photo anyway" shows at `anywayAtMs` ± `acceptance.anywayToleranceMs`, with the reason line
  the expected `anywayReason`. With the screen-reader flag it shows within one evaluation interval of
  the start. Fields the scorer does not know (such as a segment's `tiltDegrees`) pass through.
- **Live outline** (on results lines that log it; iOS now, Android after its outline lane): a
  segment that shows an item has an outline by its first mask (`mask.intervalMs`); an empty,
  weak-surface, no-item or gap segment shows none; flat jitter sets keep outline stability ≥ 0.95.
  The outline's IoU with the stored mask is reported per variant as information.
- `summary.md` adds a hard-cases table: pass counts per variant beyond the brief §11 variants.
- **Gap** (the empty second between sweep or batch items): locked or in cooldown within
  `relockAfterFailingEvaluations × evaluation.intervalMs`, plus one mask interval when the sweep
  played the phone's mask cadence (the item's last mask lingers that long), stays locked, nothing
  captured. The hint
  and the anyway timing are not judged, because the gap opens on the previous item's state and is
  shorter than the anyway delay.
- **Miss:** an unlocked case that never unlocks in time. **False lock:** unlocked straight back to
  locked, not through capturing; the rate is over should-unlock cases. **False unlock:** a locked
  case that unlocks or auto-captures, listed on its own.

## Live-outline parity fixture (`parity/`)

`parity/outline-parity.json` is the committed fixture both apps' unit tests read for the live outline
(brief "Live outline"): masks with their expected polygons, IoU pairs and tracker sequences, plus every
spec number. `parity/outline_reference.py` (Python standard library) generates and checks it; four of
its masks come from this generator's output. `parity/README.md` has the commands and the details both
apps must follow.
