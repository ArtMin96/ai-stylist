# G3 Filament spike — shared contract (single-writer: orchestrator)

Spike code under `prototype/` per the root `CLAUDE.md` repository layout (`prototype/`: throwaway spikes, not shipped). Disposable. Findings survive, code does not get promoted wholesale.
Goal: clothing photo → template 3D garment (G3, doc 07 §6) → worn on a human GLB → rendered in **Filament** (official WebAssembly build, `filament@1.53.4`).

Honesty rule (doc 07 §1/§6): every UI surface that shows a garment labels it **"Template 3D · approximate"**. Never "your garment in 3D". Shape is the garment type's shell over the body, texture is the user's photo.

## Directory ownership (disjoint — do not write outside your dir)

| Dir | Owner | Purpose |
|---|---|---|
| `pipeline/` | Agent A | Python: image → garment mesh + texture → GLB; composition of dressed GLB. CLI + tests. |
| `viewer/` | Agent B | Vite + `filament` npm web viewer. |
| `server/` | Agent C | FastAPI glue: upload image → run pipeline CLI → serve GLBs. |
| `assets/` | orchestrator | `human.glb` (converted from the user's `FinalBaseMesh.obj`), `env/*.ktx` (Filament IBL). Read-only for agents. |
| `samples/` | orchestrator / Agent A may add synthetic test images | Test clothing images. |
| `out/` | runtime | Generated garments and dressed GLBs (gitignored). |

## 3D conventions (from doc 07 §9, unchanged)

- glTF 2.0 binary (`.glb`), **meters, Y-up, right-handed** in world space, glTF PBR metal-rough, **sRGB** base-color textures. PNG textures embedded (no KTX2/Draco in the spike — compression is a conformance step, not a prototype need).
- Garment vertex positions are emitted in the **same world space as the human mesh** (meters, Y-up, feet at y=0).

## Human input

`HUMAN = assets/human.glb` — the user's `FinalBaseMesh.obj` converted by the orchestrator: **static, unrigged**, triangulated, 24,461 vertices, T-pose, Y-up, +Z front, feet at y=0, 1.80 m tall, single node `human`, POSITION + NORMAL, no UVs. **No skeleton, so no poses in this spike.** Pipeline takes `--human`; server resolves this path. The pipeline may assume a single static mesh with an identity node transform; if the node has a transform, apply it (positions/normals) before region selection.

## Categories and regions (first version)

Regions are bands of normalized height `h = (y - ymin)/(ymax - ymin)` (0 = feet, 1 = top of head) and lateral position `|x|`, measured on the human mesh in world space. Values below are starting points; Agent A calibrates them on `assets/human.glb` (e.g. by writing a debug PNG of selected vertices, or checking against landmark heights: crotch ≈ 0.47, waist ≈ 0.60, armpit ≈ 0.72, shoulder ≈ 0.82, chin ≈ 0.87 for this mesh — verify) and records the final numbers in `pipeline/g3/regions.py`.

| category | slot | region | ease (m) |
|---|---|---|---|
| `tshirt` | `top` | torso: `h∈[0.50,0.84]` and `|x| ≤ torsoHalfWidth·1.05`, where `torsoHalfWidth` = 95th percentile of `|x|` over vertices with `h∈[0.55,0.62]` (waist band; arms are away from the body there in T-pose); plus **upper arms**: `h∈[0.70,0.85]` and `torsoHalfWidth < |x| ≤ torsoHalfWidth + 0.45·(armSpanHalf − torsoHalfWidth)`, where `armSpanHalf` = max `|x|`. | 0.012 |
| `pants` | `bottom` | `h∈[0.05,0.52]` and `|x| ≤ torsoHalfWidth·1.3` (excludes hands hanging low if any) | 0.010 |

## Garment construction (offset shell) — Agent A

1. Load human GLB with trimesh (`force='mesh'`; it is a single static mesh). Gather vertices, faces, vertex normals.
2. Select region vertices per category (above). Keep faces whose 3 vertices are all in region. Drop unused vertices (reindex).
3. Offset each kept vertex along its (area-weighted, smoothed) normal by `ease`. Recompute normals.
4. UVs by **planar projection** in world front view: `u = (x - xmin)/(xmax - xmin)`, `v = (ymax - y)/(ymax - ymin)` over the region bbox (world space, then stored). Vertices whose world normal has `z < 0` (back-facing) use the **back tile**: texture atlas is 2 tiles wide, left = front cutout, right = mirrored cutout; back-facing `u' = 0.5 + u/2`, front-facing `u' = u/2`.
5. Texture: `rembg` cutout of the input image (RGBA), cropped to alpha bbox, padded 2 %, resized so the atlas is ≤ 1024×1024. Alpha < 8 → fill with the cutout's median opaque color so holes don't show the body (garment material is opaque, `alphaMode: OPAQUE`).
6. Material: PBR metal-rough, `baseColorTexture` = atlas (sRGB), `metallicFactor 0`, `roughnessFactor 0.9`, `doubleSided: true`.
7. Write `garment.glb`: standalone, single node `garment.<category>`, world-space positions (same space as the human), PBR material with the atlas.
8. Write `garment.json` (schema below).

## Composition (dressed GLB) — Agent A

`dress` takes the human GLB and N garment dirs. Output = one GLB scene containing the human mesh node plus one node per garment (`garment.<category>`), each with its own material. Implemented as a trimesh `Scene` with the human and each `garment.glb` added as separate geometries (no merging, materials preserved). Order: `bottom` then `top`.

## `garment.json` (sidecar, schema v1)

```json
{
  "schema": 1,
  "id": "<uuid4>",
  "category": "tshirt",
  "slot": "top",
  "level": "G3",
  "label": "Template 3D · approximate",
  "sourceImageSha256": "<hex>",
  "humanSha256": "<hex>",
  "ease_m": 0.012,
  "stats": { "vertices": 0, "triangles": 0, "atlasPx": [1024, 512] },
  "files": { "glb": "garment.glb", "atlas": "atlas.png", "cutout": "cutout.png" },
  "createdAt": "<ISO-8601 UTC>"
}
```

## Pipeline CLI — Agent A (consumed by Agent C)

```
python -m g3 build   --human <glb> --image <png|jpg> --category tshirt|pants --out <dir>   # writes the files above into <dir>; exit 0
python -m g3 dress   --human <glb> --out <dressed.glb> --garment <dir> [--garment <dir> ...]  # exit 0
python -m g3 inspect --human <glb>   # prints JSON: height_m, vertices, triangles, per-category region vertex counts
```
Errors: non-zero exit, one-line JSON `{"error": "..."}` on stderr. No interactive prompts. Runs from any cwd; interpreter is `pipeline/.venv/bin/python` (uv-managed, Python 3.13; deps: numpy, pillow, scipy, trimesh, pygltflib, rembg, onnxruntime, pytest).

## Server API — Agent C (consumed by Agent B)

FastAPI on `127.0.0.1:8787`, CORS open for localhost. Subprocess-calls the pipeline CLI; never imports it.

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/human` | `{ "url": "/files/human.glb" }` — copies the human GLB into `out/` on startup. |
| POST | `/api/garments` | multipart `image` + form `category` → runs `build` → `201 {garment.json fields, "urls": {"glb": "/files/garments/<id>/garment.glb", "atlas": …, "cutout": …}}`. `400` on bad category, `500` with pipeline stderr on failure. |
| GET | `/api/garments` | list of the above. |
| POST | `/api/dress` | `{"garmentIds": ["…"]}` → runs `dress` → `{ "url": "/files/dressed/<hash>.glb", "garmentIds": […] }`. One garment per slot; later id wins per slot. Cached by (humanSha, sorted ids). |
| GET | `/files/{path}` | static from `out/`. |
| GET | `/api/health` | `{ "ok": true, "pipeline": "<python path>", "human": "<path>" }` |

## Viewer — Agent B

Vite app in `viewer/`, `npm run dev` on `5173`, proxy `/api` and `/files` → `127.0.0.1:8787`. Uses **`filament` (1.53.4) gltfio** — not three.js. Loads `assets/env/default_env_ibl.ktx` + `default_env_skybox.ktx` (KTX1; use `engine.createIblFromKtx1` / `createSkyFromKtx1`), plus a directional light.
UI: category select (`tshirt`, `pants`), image file input, "Build garment" → POST, garment list with "Wear"/"Take off" per item and the honesty label, "Show garment alone" view (loads `garment.glb`), main view loads `/api/human` GLB and, when any garment is worn, the `/api/dress` GLB instead. Orbit (drag), zoom (wheel), FPS readout. No animation (human is static). Vite `assets` are served from `../assets` via a symlink or `publicDir` config; do not copy KTX files into git-tracked viewer dirs.

## Definition of done (spike)

- `python -m g3 build` on `assets/human.glb` + a synthetic t-shirt image and a pants image produces valid GLBs (validated by re-loading with pygltflib and asserting finite positions, non-empty indices, TEXCOORD_0 + a texture present); `dress` output loads in the viewer.
- Viewer renders human + worn garments in Filament with orbit/zoom; label present.
- One real clothing photo from the user goes end-to-end in the browser (orchestrator verifies with screenshots).

---

# v2 — "professional" garment quality (2026-09-04, after user review)

User verdict on v1: "it looks like the body muscles just got colour instead of properly wearing". v2 replaces the offset shell with a **lofted garment** and the single-view atlas with **multi-view textures + a photo-derived normal map**. Same CLI shape, same server/viewer contract, three additive changes.

## File ownership for v2 (disjoint)

| Files | Owner |
|---|---|
| `pipeline/g3/shell.py`, `pipeline/g3/regions.py` | Agent A (geometry) |
| `pipeline/g3/texture.py`, `pipeline/g3/uvmap.py` (new), `pipeline/g3/export.py`, `pipeline/g3/__main__.py` | Agent D (texture + CLI) |
| `server/`, `viewer/` | Agent B |
| `pipeline/g3/human.py`, `compose.py`, `tools/` | unchanged (Agent A may add a scratch script under `pipeline/tools/`) |

## Input images

`samples/t-shirt.png` is one sheet with **front | side | back** views side by side (checkerboard baked into the pixels, no alpha). `samples/pants.png` is **front | back**. The CLI accepts `--image <front-or-sheet>` plus optional `--image-back`, `--image-side`. Sheet splitting rule (deterministic): run rembg on the sheet, label connected components of `alpha ≥ 128` (scipy.ndimage.label), keep components with area ≥ 5 % of the largest, sort by centroid x. 1 component → `front`; 2 → `front, back`; 3 → `front, side, back`. Separate `--image-back/--image-side` files override the sheet views. Views that exist are listed in `garment.json` as `"views": ["front", ...]`.

## Geometry interface (Agent A → Agent D)

```python
shell.build_garment(V, F, N, category, fr) -> (verts, faces, normals, parts)
# verts (n,3) world metres, faces (m,3) int, normals (n,3) unit, parts (n,) int8:
# 0 = body (torso for tshirt; hips+both legs for pants are ALSO 0 — parts only matter for sleeves)
# 1 = left sleeve (x < 0), 2 = right sleeve (x > 0)
```
Construction (loft from convex cross-sections, so fabric bridges concavities):
- **Torso (tshirt):** ~40 rings from hem `h=0.50` to shoulder top `h=0.84`. Each ring = body cross-section vertices in that height slice restricted to `|x| ≤ torsoHalfWidth·1.15` → 2D **convex hull** in XZ → resampled to 64 points by angle around the slice centroid → pushed outward by `ease(h)` (hem 0.030 m → chest 0.018 m, linear). Ring radii smoothed along h (moving average of 3). Consecutive rings lofted into triangles. The mesh is an open tube (hem open at the bottom).
- **Shoulder line & neck opening:** torso rings stop at the shoulder line `h≈0.82`. Widen the torso clip linearly from `thw·1.15` at `h=0.76` to `thw·1.15 + 0.05` at the shoulder ring so the deltoids stay inside. Find the neck by measurement: the `h ∈ [0.82, 0.87]` whose slice (|x| < 0.10) has the smallest hull perimeter (expect ≈0.845) — NOT a fixed 0.865, which hulls the jaw. Add 3 rings from the shoulder ring inward to the collar ring = neck hull + 0.012 m; the collar edge is open. Front of the collar dips 0.02 m lower than the back (crew neck).
- **Sleeves:** for each arm, 12 rings from `t=−0.06` (first ring inside the torso tube) to the sleeve end (`t=0.42` along the arm axis, as in v1). Arm slice vertices are selected by `|x| > thw` (never by radius from the axis, or the t≈0 plane slices the torso). Ring = convex hull of the arm cross-section perpendicular to the arm axis, resampled to 32 points, ease 0.022 m, sleeve end flares +0.008 m. Sleeves are separate open tubes that overlap the torso at the shoulder (accepted). Verify with a 3/4-view render: no skin at the armpit or shoulder.
- **Pants:** hip tube from waist `h=0.60` down to crotch `h=0.46` (rings = hull of the whole hip slice, ease 0.018 m); then per leg, 30 rings along the leg axis (hip joint → ankle, `h=0.05`) with the hull of that leg's slice, ease 0.020 m, and the **hang rule**: ring radius = max(hull-offset radius, 0.99 × previous ring's radius) (0.97 compounds to tights over 30 rings) so the trouser hangs straight instead of hugging the knee and calf; hem circumference must end ≥ 0.74 × thigh circumference. Legs overlap the hip tube at the crotch (accepted).
- Normals from the loft (outward), smooth. Verts count target < 10 k per garment.
- Provide `regions.frame(V)` as in v1 (thw, shoulder, axis, ymin, yspan); Agent D does not call `select_region`.

## Texture interface (Agent D)

```python
texture.views_from_images(front_path, back_path=None, side_path=None) -> dict[str, PIL.Image RGBA]  # keys ⊂ {front, back, side}; sheet split per rule above; each view cropped + 2 % pad + nearest-opaque fill
texture.make_atlas(views) -> (albedo RGB, normal_map RGB, tiles: dict[str, (u0,v0,u1,v1)])  # tiles laid out left→right in one row, width ≤ 2048
uvmap.assign_uv(verts, faces, normals, parts, tiles) -> (verts, faces, normals, uv)   # vertices split at view seams, so counts may grow
```
- **Face → view:** per face by its mean normal: `nz ≥ 0.35` → front; `nz ≤ −0.35` → back; otherwise side (`side` tile if present, else front for nz>0 / back for nz<0). **Sleeves (`parts != 0`) never use the side tile**: classify by sign(nz) only. Faces sharing a vertex but different views must not share UVs: split vertices per view (duplicate where needed).
- **Sheet segmentation:** two-pass rembg — coarse pass on the whole sheet to locate components, then crop each component's bbox (+10 % pad) from the ORIGINAL and run rembg again per crop at full resolution. Both mockups have soft cast shadows under each view: after the per-view cutout, trim bottom rows whose opaque coverage is < 20 % of the max row before computing the bbox. If the checkerboard leaks into a cutout, pre-whiten the two alternating background colours before rembg (only if actually needed).
- **Projection:** front/back: planar in world XY over the whole garment bbox (all parts together, so sleeves land on the photo's sleeves), mapped into the view tile; back tile is used mirrored in x so the photo's left is the wearer's left. Side: planar in world ZY over the garment's z-extent, mapped into the side tile; the same side image serves both sides (mirrored for one).
- **Normal map from the photo:** per view tile, luminance → Gaussian blur σ=1.5 → Sobel gradients → tangent-space normal `(−gx·k, −gy·k, 1)` normalised, `k` so that typical fold contrast gives ±25° tilt (tune visually: folds visible, no noise), encoded RGB. Exported as glTF `normalTexture` (trimesh `PBRMaterial(normalTexture=...)`); gltfio generates tangents. `roughnessFactor 0.85`, `metallicFactor 0`, doubleSided, OPAQUE.
- Files in the garment dir: `garment.glb`, `garment.json` (+ `"views"`), `atlas.png` (albedo), `normal.png`, `cutout.png` (front view cutout, used as the thumbnail).

## Server + viewer (Agent B)

- Server `POST /api/garments`: optional multipart `image_back`, `image_side` → `--image-back/--image-side`. Response unchanged (+ `views`).
- Viewer: three file inputs (front required; back, side optional) with the hint "or one sheet with front / side / back side by side". Rendering: enable screen-space ambient occlusion and multisample/temporal anti-aliasing if the web API exposes them (`filament.d.ts`: `View.setAmbientOcclusionOptions`, `setMultiSampleAntiAliasingOptions`, `setTemporalAntiAliasingOptions`), keep shadows, frame the camera at chest height with a slight downward angle. Show the garment's `views` in the list item.

## v2 outcome notes (orchestrator, 2026-09-04)

- **Side tile dropped from sampling** (deviation from "Face → view" above, accepted): the side photo is mostly sleeve and painted a sleeve-shaped patch on the ribs with a hard seam; on the sleeves it added a capped patch with no gain. Torso and sleeves classify front/back by sign(nz) only. The side view is still cut, stored in the atlas, and listed in `views`, but never sampled.
- Collar rings clamp to just under the photo's detected neck hole; sleeve vertices stop at 92 % of the sleeve's projected extent (cuff interiors no longer land on the garment).
- Pillow premultiplies alpha on RGBA resize; colour and alpha are resized separately (the earlier black bleed was this, not the photo).
- Geometry deviations recorded by Agent A: neck at the lowest slice within 10 % of the minimum perimeter (h=0.860); sleeve end t=0.34 (0.42 is the elbow); sleeve ease ramps from 0 at the shoulder; hip tube extends to h=0.415 with leg tubes starting inside it.
- Verified in Chrome/Filament: no skin through, no seams at hip level, no console errors. Build ≈ 4.4 s per garment (rembg dominates; geometry ≈ 60 ms).
- `pipeline/tools/render_dressed.py` predates the v2 UV convention and shows v2 textures upside down; judge orientation in the Filament viewer (or Agent D's raw-glTF raster), never with that script.
