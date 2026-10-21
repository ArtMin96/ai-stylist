# Proposal: add `just capture-frames` to the doc 15 §5 recipe catalog (human-applied)

> Status: PROPOSED (2026-10-22). Branch `feat/capture-camera-harness`, for the guided capture
> camera's harness (brief `.claude/plans/2026-10-22-capture-camera-brief.md` §11, §15 step 5).

**Why:** this branch adds the recipe `capture-frames` to the root `justfile`
(`tools/capture-frames/capture-frames.sh`, `tools/capture-frames/README.md`). DC-15 compares the
§5 catalog with `just --summary`. It now reports a finding: a warning in `just docs-check`, and an
error under `--strict`, which `just ci-parity` runs:

```text
WARN DC-15 planning/15-team-workflow-and-ai-agent-operations.md:1 recipe 'capture-frames' (just --summary) missing from the §5 catalog
```

`planning/15-*.md` is human-only (root `CLAUDE.md`; the path guard denies agents), so a human
applies the line below with `AGENT_MAY_EDIT_POLICY=1`, or by hand.

## Diff

In `planning/15-team-workflow-and-ai-agent-operations.md` §5, insert one row after the
`just android-run` row (the same order as the `justfile`):

```diff
 | `just android-run` | Install and launch the debug build on a running emulator, else the connected phone, else the AVD it creates and boots (`apps/android/tools/device.sh run`) |
+| `just capture-frames` | Build the guided capture camera's test frames into `artifacts/capture-camera/frames/` (macOS only, pinned Xcode; Core Image + Vision): CC0 dataset product shots plus drawn items and a drawn person, every brief §11 variant, Vision masks, stored boxes, ground-truth keypoints, expected results and `index.json` for the apps' debug frame source; fetches only the dataset images it tries; unchanged inputs keep the last output (`tools/capture-frames/README.md`) |
 | `just assets-validate` | 3D asset gate: glTF 2.0 validity, KTX2 encoding, poly/texture budgets, manifest schema, morph-target names (doc 07) |
```

## Check after applying

```bash
just docs-check --strict   # no DC-15 finding for capture-frames
```
