"""Build both v2 garments as flat-coloured GLBs, dress the human, render views.

usage: .venv/bin/python tools/preview_geometry.py   (from pipeline/)
Writes out/preview/{tshirt,pants}/garment.glb and out/preview/render-*.png
"""
import json
import os
import sys
import time

import numpy as np
import trimesh
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import render_dressed  # noqa: E402
from g3 import compose, human, regions, shell  # noqa: E402

ROOT = render_dressed.ROOT
OUT = os.path.join(ROOT, "out", "preview")
COLOURS = {"tshirt": (40, 90, 200), "pants": (60, 60, 65)}


def export(category, V, F, N, fr):
    t = time.time()
    verts, faces, normals, parts = shell.build_garment(V, F, N, category, fr)
    dt = time.time() - t
    d = os.path.join(OUT, category)
    os.makedirs(d, exist_ok=True)
    tex = Image.new("RGB", (4, 4), COLOURS[category])
    mat = trimesh.visual.material.PBRMaterial(baseColorTexture=tex, metallicFactor=0.0, roughnessFactor=0.9,
                                              doubleSided=True)
    vis = trimesh.visual.TextureVisuals(uv=np.full((len(verts), 2), 0.5), material=mat)
    mesh = trimesh.Trimesh(vertices=verts, faces=faces, vertex_normals=normals, visual=vis, process=False)
    mesh.export(os.path.join(d, "garment.glb"))
    with open(os.path.join(d, "garment.json"), "w") as f:
        json.dump({"id": category, "category": category, "slot": regions.CATEGORIES[category]["slot"],
                   "files": {"glb": "garment.glb"}}, f)
    print(f"{category}: {len(verts)} verts, {len(faces)} tris, parts {np.bincount(parts).tolist()}, "
          f"build {dt * 1000:.0f} ms")
    return d


def rotated(scene, deg):
    s = scene.copy()
    R = trimesh.transformations.rotation_matrix(np.radians(deg), [0, 1, 0])
    for g in s.geometry.values():
        g.apply_transform(R)
    return s


if __name__ == "__main__":
    V, F, N = human.load_human(os.path.join(ROOT, "assets", "human.glb"))
    fr = regions.frame(V)
    print("neck h =", shell.neck_height(V, fr))
    dirs = [export(c, V, F, N, fr) for c in ("tshirt", "pants")]
    dressed = os.path.join(OUT, "dressed.glb")
    compose.dress(os.path.join(ROOT, "assets", "human.glb"), dirs, dressed)
    scene = trimesh.load(dressed)
    for view in ("front", "back", "side"):
        render_dressed.render(scene, view).save(os.path.join(OUT, f"render-{view}.png"))
    render_dressed.render(rotated(scene, 45), "front").save(os.path.join(OUT, "render-3q-front.png"))
    render_dressed.render(rotated(scene, 225), "front").save(os.path.join(OUT, "render-3q-back.png"))
    print("renders in", OUT)
