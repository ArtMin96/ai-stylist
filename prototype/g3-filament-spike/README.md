# G3 Filament spike — clothing photo → 3D garment → worn on a human, rendered in Filament

Demo/test app. You give it a human mesh and a photo of a garment (t-shirt or pants); it builds a
template 3D garment shaped by the body, textures it with the photo, puts it on the human, and
renders everything in a browser with Google Filament (the real engine, WebAssembly build).
No AI providers, no GPU needed; everything runs on CPU.

Everything shown is labeled **"Template 3D · approximate"**: the shape is a fabric tube built from
the body, the texture is your photo. It is not a physically simulated drape.

## What you need on a new machine

| Tool | Version used here | Why |
|---|---|---|
| Python | 3.13 (via `uv`) | pipeline and server |
| [`uv`](https://docs.astral.sh/uv/) | 0.8 | creates the two Python venvs and downloads Python 3.13 if missing |
| Node.js + npm | 24 | Vite dev server for the viewer |
| Chrome/Firefox with WebGL2 | any recent | Filament renders through WebGL2 |
| Internet, once | | `uv`/`npm` installs, and the background-removal model (`u2net`, ~170 MB, downloaded automatically to `~/.rembg/models/` on the first build) |

RAM: about 2 GB free while a garment builds. No CUDA, no Blender, no `unrar` needed.

## Install from zero

```sh
git clone <repo> && cd prototype/g3-filament-spike

# 1. Pipeline (garment builder)
cd pipeline
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python numpy pillow scipy trimesh pygltflib rembg onnxruntime
cd ..

# 2. Server (glue API)
cd server
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python fastapi uvicorn python-multipart
cd ..

# 3. Viewer (Filament in the browser)
cd viewer
npm install
cd ..
```

Versions that are known to work together: numpy 2.5, pillow 12.3, scipy 1.18, trimesh 5.1,
pygltflib 1.16, rembg 2.0.83, onnxruntime 1.29, filament 1.53.4 (npm), vite 6.

## The human mesh

The pipeline reads `assets/human.glb`. The one in the repo was converted from `assets/FinalBaseMesh.obj`
(a static, unrigged A-pose base mesh, 24k vertices). To use your own mesh (OBJ/GLB/PLY/STL, standing,
arms away from the body, no clothes):

```sh
cd pipeline
.venv/bin/python tools/convert_human.py /path/to/your-mesh.obj --height 1.80
```

This scales it to 1.80 m, puts the feet at y=0, centres it, and writes `assets/human.glb`. The mesh
must be Y-up with the face pointing +Z; the script prints which way the head points. The garment
regions (hem, waist, neck, sleeve length) are calibrated as fractions of body height in
`pipeline/g3/regions.py` and `pipeline/g3/shell.py`; a very different body proportion may need those
numbers adjusted. Rigged meshes are accepted but the rig is ignored (no poses in this demo).

## Run

Three processes, three terminals (or background them):

```sh
# API on 127.0.0.1:8787
cd server && .venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8787

# Viewer on http://127.0.0.1:5173 (Vite picks the next free port if 5173 is busy; watch its output)
cd viewer && npm run dev
```

Open the viewer URL. Pick a category, choose the front photo (a single sheet with front / side /
back views side by side also works as "Front"), optionally back and side photos, press
**Build garment** (about 5 s), then **Wear**. Drag to orbit, wheel to zoom, **View alone** shows the
garment by itself.

Check the API is alive: `curl http://127.0.0.1:8787/api/health`.

## Command line without the browser

```sh
cd pipeline
.venv/bin/python -m g3 build --human ../assets/human.glb --image ../samples/t-shirt.png --category tshirt --out ../out/garments/tshirt
.venv/bin/python -m g3 build --human ../assets/human.glb --image ../samples/pants.png   --category pants  --out ../out/garments/pants
.venv/bin/python -m g3 dress --human ../assets/human.glb --out ../out/dressed/demo.glb --garment ../out/garments/tshirt --garment ../out/garments/pants
.venv/bin/python -m g3 inspect --human ../assets/human.glb
```

`build` also takes `--image-back` and `--image-side`. Run it from `pipeline/` (the server does the
same). `dressed/demo.glb` is a normal glTF file: it opens in any glTF viewer.

## Directory layout

```
CONTRACT.md      the spec every part was built against (formats, regions, API, what was decided and why)
README.md        this file
assets/          human.glb (the body), FinalBaseMesh.obj (its source), env/ (Filament lighting, KTX)
samples/         test photos: t-shirt.png (front|side|back sheet), pants.png (front|back sheet), two synthetic ones
pipeline/        Python. g3/ is the package:
                   human.py    load the body GLB
                   regions.py  body measurements and category constants (hem, waist, neck, sleeve)
                   shell.py    garment geometry: tubes lofted from convex cross-sections of the body
                   texture.py  rembg cutout, sheet splitting, texture atlas, normal map from the photo
                   uvmap.py    which photo view each face uses, and the planar projection
                   export.py   glTF writing and garment.json
                   compose.py  `dress`: human + garments in one GLB
                   __main__.py CLI (build / dress / inspect)
                 tools/: convert_human.py, preview/render helpers used during development
server/          app.py: FastAPI. Uploads → runs the CLI as a subprocess → serves files from out/
viewer/          Vite + filament@1.53.4. index.html, main.js (all viewer logic), vite.config.js
                 (serves filament.js/.wasm from node_modules, proxies /api and /files to :8787)
out/             generated at runtime, safe to delete:
                   out/garments/<id>/  garment.glb, garment.json, atlas.png, normal.png, cutout.png
                   out/dressed/*.glb   human + worn garments, cached by garment set
                   out/human.glb       copy served to the viewer
```

## How it works, in one paragraph

`texture.py` removes the background (rembg/u2net, two passes for multi-view sheets) and splits the
photo into front/back(/side) views. `shell.py` slices the body into horizontal rings (torso, hips)
or rings along the arm and leg axes, takes the convex hull of each slice (fabric bridges muscle
concavities), pushes it out by an ease that grows toward the hem, and lofts the rings into open
tubes, adding a crew neck and sleeve tubes. `uvmap.py` projects the front photo onto front-facing
faces and the back photo onto back-facing ones. `export.py` writes a glTF with the photo as base
colour and a normal map derived from the photo's luminance so folds shade under light. The
server just wires uploads to that CLI; the viewer loads the resulting GLBs with Filament's gltfio.

## Things to know

- **Port**: the viewer proxies to `127.0.0.1:8787`; if you change the server port, change
  `viewer/vite.config.js` too.
- **First build is slow** (about a minute): the u2net model downloads. Later builds take ~5 s.
- **Side photos are not painted** onto the garment. They are detected and stored, but a side
  view of a shirt is mostly sleeve and looked wrong on the torso. Front and back are what matter.
- **Photo quality**: a flat, evenly lit product shot on a plain background works best. Cast
  shadows under the garment are trimmed automatically. Dark prints touching the neckline can be
  mistaken for the neck hole.
- **Categories**: `tshirt` and `pants` only. Adding one means a new ring recipe in `shell.py`
  and constants in `regions.py`.
- **Not in scope**: poses/animation (the body has no skeleton), cloth simulation, exact garment
  cut from the photo, mobile app. `pipeline/tools/render_dressed.py` predates the final UV
  convention and shows textures upside down; judge results in the viewer.
- **No tests** by decision: this is a demo.