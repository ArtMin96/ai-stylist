---
name: native-3d-assets
description: Work on the 3D layer — Filament rendering integration, parametric avatar meshes/morphs, poses, garment representations (G0–G3), glTF/KTX2 asset pipeline, asset manifests — including real-device performance validation. Use whenever renderer code or 3D asset files change.
---

# 3D Rendering and Asset Changes

## Trigger

- Changes under the mobile render boundary (`apps/mobile/src/render/`), `react-native-filament` usage, avatar morph/pose logic, garment attachment/overlay, or any file in the 3D asset source/delivery trees.
- Adding or regenerating glTF assets, KTX2 textures, Draco/meshopt-compressed meshes, or asset manifests.

**Not this skill:** which outfit to render (`recommendation` owns that); server-side image generation (`media-ml-pipeline`); 2D closet photos (`mobile-feature`).

## Required reading

1. `planning/07-3d-avatar-and-garment-pipeline.md` — formats, capability ladder (A0–A3, G0–G4), rig/morph conventions, budgets, versioning.
2. `planning/SPINE.md` §2 (Filament, glTF 2.0, KTX2, Draco/meshopt) and §4 (capability codes).
3. Asset manifest schema + current avatar rig/morph-target name registry (doc 07 owns these — names are contracts).
4. Current Filament / react-native-filament docs via context7 — this stack moves fast; do not guess APIs.

## Workflow

1. Restate: which capability level (A*/G*) this serves, and which budgets apply (frame time, GPU memory, asset size — doc 07 / doc 13 numbers).
2. **Renderer isolation invariant:** render code consumes structured outfit/avatar descriptions; it never imports recommendation, profile, or closet business logic, and nothing outside the render boundary imports Filament types. `just arch-check` enforces both directions.
3. Asset changes:
   - glTF 2.0 canonical; textures KTX2/Basis; meshes Draco or meshopt; correct color space for PBR maps.
   - Morph-target and skeleton names must match the registry exactly; a rename is an asset-version bump + migration note (doc 07 versioning), never silent.
   - Large binaries go through the asset store/LFS path defined in doc 07 — never plain-committed to git.
   - Every asset entry carries manifest metadata incl. version and provenance (generated vs authored).
4. Rendering code changes: keep morph application, pose switching, and camera controls deterministic (same inputs → same frame); no per-frame allocations in hot paths.
5. Measure before claiming performance: capture frame time / memory on a real low-tier and mid-tier Android device (doc 13 matrix) for the representative scene (avatar + outfit, pose switch, rotate/zoom).

## Validation

```bash
just assets-validate            # glTF validity, KTX2, budgets, manifest schema, morph names
just test avatar && just test outfit
just lint && just typecheck && just arch-check
just dev-mobile --android       # on-device run; record FPS/memory via the doc-13 procedure
```

iOS rendering cannot be verified on Linux: trigger `just mobile-ios-build --profile dev` and verify via TestFlight/internal build before claiming cross-platform done.

## Output

- PR with: asset diffs summarized (counts, sizes, budget deltas), device measurements table (device, scene, FPS, memory) — real numbers only, and the Android-verified / iOS-pending status stated explicitly.
- Asset manifest + version bumps included; doc 07 updated if conventions changed.

## Stop / escalate

- A budget is exceeded and optimization within the task doesn't recover it → stop, report numbers, propose options (LOD, compression, scope cut); humans decide.
- Rig/topology change that breaks existing user avatar configs → stop; needs a migration plan per doc 07 before any code.
- Tempted to put outfit-selection logic in the renderer → that violates a SPINE invariant; restructure or ask.
