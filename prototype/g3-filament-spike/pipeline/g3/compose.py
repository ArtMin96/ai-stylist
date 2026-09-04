"""dress: human + garments as separate geometries in one GLB scene."""
import json
import os

import trimesh

SLOT_ORDER = {"bottom": 0, "top": 1}


def dress(human_path, garment_dirs, out_path):
    scene = trimesh.load(human_path)
    if isinstance(scene, trimesh.Trimesh):
        scene = trimesh.Scene({"human": scene})
    garments = []
    for d in garment_dirs:
        with open(os.path.join(d, "garment.json")) as f:
            meta = json.load(f)
        garments.append((SLOT_ORDER.get(meta["slot"], 99), meta, d))
    garments.sort(key=lambda g: g[0])
    for _, meta, d in garments:
        name = f"garment.{meta['category']}"
        g = trimesh.load(os.path.join(d, meta["files"]["glb"]), force="mesh")
        scene.add_geometry(g, node_name=name, geom_name=name)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    scene.export(out_path, include_normals=True)
    return [m["id"] for _, m, _ in garments]
