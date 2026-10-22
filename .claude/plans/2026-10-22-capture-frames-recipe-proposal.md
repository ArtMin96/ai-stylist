# Proposal: add `just capture-frames` to the doc 15 §5 recipe catalog (human-applied)

> Status: `capture-frames` row APPLIED (2026-10-22, owner-approved); the three `capture-sim` rows are
> applied with the capture camera app change. Originally PROPOSED (2026-10-22). Branch `feat/capture-camera-harness`, for the guided capture
> camera's harness (brief `.claude/plans/2026-10-22-capture-camera-brief.md` §11, §15 step 5).

**Why:** this branch adds the recipes `capture-frames`, `capture-sim-ios`, `capture-sim-android` and
`capture-sim` to the root `justfile`
(`tools/capture-frames/capture-frames.sh`, `tools/capture-frames/README.md`). DC-15 compares the
§5 catalog with `just --summary`. It now reports a finding: a warning in `just docs-check`, and an
error under `--strict`, which `just ci-parity` runs:

```text
WARN DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'capture-frames' (just --summary) missing from the §5 catalog
```

`planning/15-*.md` is human-only (root `CLAUDE.md`; the path guard denies agents), so a human
applies the line below with `AGENT_MAY_EDIT_POLICY=1`, or by hand.

## Diff

In `planning/15-team-workflow-and-ai-agent-operations.md` §5, insert four rows after the
`just android-run` row (the same order as the `justfile`):

```diff
 | `just android-run` | Install and launch the debug build on a running emulator, else the connected phone, else the AVD it creates and boots (`apps/android/tools/device.sh run`) |
+| `just capture-frames` | Build the guided capture camera's test frames into `artifacts/capture-camera/frames/` (macOS only, pinned Xcode; Core Image + Vision): CC0 dataset product shots plus drawn items and a drawn person, every brief §11 variant, Vision masks, stored boxes, ground-truth keypoints, expected results and `index.json` for the apps' debug frame source; fetches only the dataset images it tries; unchanged inputs keep the last output (`tools/capture-frames/README.md`) |
+| `just capture-sim-ios` | The capture camera's iOS simulator loop (macOS; iPhone 18 Pro or `IOS_SIMULATOR_ID`): frames, Dev build without symbol upload, harness sweep + screen-reader sweeps, every `e2e/capture` flow in light and dark, scoring; writes `artifacts/capture-camera/runs/<yyyy-mm-dd-hhmm>/summary.md` and the scoreboard row; exits 1 unless the finish line holds (`tools/capture-frames/README.md` "Simulator runs") |
+| `just capture-sim-android` | The same loop on the Android emulator (AVD `aistylist-dev` through `just android-run`, or `ANDROID_SERIAL`): frames pushed, stored-box sweep (scored) and live ML Kit sweep (information only), screen-reader sweeps, every `e2e/capture` flow in light and dark, scoring |
+| `just capture-sim` | Both capture simulator loops in one run folder: iOS, then Android |
 | `just assets-validate` | 3D asset gate: glTF 2.0 validity, KTX2 encoding, poly/texture budgets, manifest schema, morph-target names (doc 07) |
```

## Check after applying

```bash
just docs-check --strict   # no DC-15 finding for capture-frames or the capture-sim recipes
```
