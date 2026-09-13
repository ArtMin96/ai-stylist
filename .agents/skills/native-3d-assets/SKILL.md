---
name: native-3d-assets
description: Work on the 3D layer — the Filament boundary in apps/mobile/src/render/, parametric avatar meshes/morphs, poses, garment representations G0–G4, the glTF/KTX2 asset pipeline under assets/3d/, and manifests — including real-device validation. Use for "react-native-filament", "glTF", "KTX2", "Draco", "morph target", "skeleton rename", or any file under assets/3d/. Not for which outfit to render — use `recommendation-rules`; not for server-side image generation — use `media-ml-pipeline`; not for 2D closet photos or screens outside the render boundary — use `mobile-feature`.

metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: render-3d-engineer
---

# 3D Rendering and Asset Changes

## Trigger

- Any change under `apps/mobile/src/render/`, `react-native-filament` usage, designated 3D screens under `apps/mobile/src/features/avatar/**`, avatar morph/pose logic, garment attachment, or any file under `assets/3d/`.
- Adding or regenerating glTF, KTX2 textures, Draco/meshopt meshes, or asset manifests.
- Not this skill: which outfit to render (`recommendation-rules`); server-side image generation (`media-ml-pipeline`); 2D closet photos (`mobile-feature`).

## Required reading

1. `planning/07-3d-avatar-and-garment-pipeline.md` — formats, A0–A3 / G0–G4 ladders, rig/morph conventions, budgets, versioning; `planning/SPINE.md` §2 and §4.
2. `assets/3d/` manifest schema and the morph-target/skeleton name registry. The directory does not exist on disk yet: it is registered in `tools/docs/planned-paths.txt` as created by `P04-T01` (`planning/phases/P04-parametric-avatar-v1.md`), so referencing paths under it before that task lands is legal — treat them as forward-looking until P04-T01 ships the pipeline.
3. `apps/mobile/src/render/README.md` (boundary directory; empty until the P04-gated 3D work lands) and `docs/modules/avatar.md`, `docs/modules/outfit.md`.
4. Current `react-native-filament` / Filament docs via context7; note the doc version in the PR.

## Workflow

1. Restate the capability level (A*/G*) served and the budgets that apply (frame time, GPU memory, asset size — doc 07 / doc 13).
2. Renderer isolation (`render-boundary`): render code consumes structured outfit/avatar descriptions from `packages/contracts`; it never imports recommendation, profile, or closet logic, and nothing outside `apps/mobile/src/render/` except the designated 3D screens in `apps/mobile/src/features/avatar/**` imports Filament types. `recommendation` never imports anything here.
3. Assets: glTF 2.0 canonical; KTX2/Basis textures; Draco or meshopt meshes; correct colour space for PBR maps. Morph/skeleton names match the registry exactly — a rename is an asset-version bump with a migration note. Binaries go through Git LFS (`.gitattributes`), never plain commits. Every manifest entry carries version + provenance (authored vs generated) — honesty invariant.
4. Rendering code: deterministic morph application, pose switching, camera controls; no per-frame allocations in hot paths.
5. Measure before any performance claim: frame time and memory on a real low-tier and mid-tier Android device (doc 13 matrix) for avatar + outfit, pose switch, rotate/zoom. Same procedure before and after.
6. `docs/modules/avatar.md` carries some prose this skill's agent (`render-3d-engineer`) edits directly — the rig/morph/versioning invariants and the Extension points section — while `api-engineer` owns the rest of the file; never run both edits in the same wave to avoid clobbering each other's hunks.

## Validation commands

```bash
just assets-validate                  # glTF validity, KTX2, budgets, manifest schema, morph names (KTX2/budget checks are a known stub until P04-T01 ships the pipeline)
just test mobile
just lint && just typecheck && just arch-check
just dev-mobile --android             # on-device run; record FPS/memory via the doc 13 procedure
just mobile-ios-build --profile dev   # cloud lane only; iOS verified via TestFlight, never locally
```

## Output

- PR: asset diff summary (counts, sizes, budget deltas), device measurement table (device, scene, FPS, memory) with real numbers, Android-verified / iOS-pending status stated explicitly, manifest + version bumps, doc 07 update if conventions changed.

Done checklist: `assets-validate` green · LFS used for binaries · registry names unchanged or version-bumped · measurements attached · no Filament import outside the boundary · `PROGRESS.md` updated.

## Stop / escalation

- Budget exceeded after in-task optimisation → stop; report numbers and options (LOD, compression, scope cut).
- Rig/topology change that breaks existing avatar configs → migration plan per doc 07 before code.
- Outfit-selection logic creeping into the renderer → SPINE invariant violation; restructure or ask.
- `assets-validate` depends on the `P04-T01` asset pipeline, which is `NOT_STARTED` before that task lands → ship what exists, open an issue for the rest; never claim a check ran that did not.

## Overlap

Adjacent: `mobile-feature` (screens outside the boundary), `media-ml-pipeline` (server-generated views feeding the renderer), `performance-profiling` (this skill uses its measurement procedure), `recommendation-rules` (produces the structured results rendered here).
