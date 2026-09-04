"""Write garment.glb and garment.json."""
import datetime as dt
import hashlib
import json

import numpy as np
import trimesh
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

LABEL = "Template 3D · approximate"


def garment_mesh(verts, faces, uv, normals, albedo, normal_map, category):
    """uv is glTF convention (v = 0 at the image top); trimesh keeps v bottom-up and flips on export."""
    mat = PBRMaterial(name=f"garment.{category}", baseColorTexture=albedo, normalTexture=normal_map,
                      metallicFactor=0.0, roughnessFactor=0.85,
                      doubleSided=True, alphaMode="OPAQUE")
    mesh = trimesh.Trimesh(vertices=verts, faces=faces, vertex_normals=normals, process=False)
    mesh.visual = TextureVisuals(uv=np.c_[uv[:, 0], 1.0 - uv[:, 1]], material=mat)
    return mesh


def write_glb(mesh, category, path):
    scene = trimesh.Scene()
    scene.add_geometry(mesh, node_name=f"garment.{category}", geom_name=f"garment.{category}")
    scene.export(path, include_normals=True)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sidecar(garment_id, category, slot, ease, image_path, human_path, n_verts, n_tris, atlas_size, views):
    return {
        "schema": 1,
        "id": garment_id,
        "category": category,
        "slot": slot,
        "level": "G3",
        "label": LABEL,
        "sourceImageSha256": sha256(image_path),
        "humanSha256": sha256(human_path),
        "ease_m": ease,
        "views": list(views),
        "stats": {"vertices": int(n_verts), "triangles": int(n_tris), "atlasPx": list(atlas_size)},
        "files": {"glb": "garment.glb", "atlas": "atlas.png", "normal": "normal.png", "cutout": "cutout.png"},
        "createdAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


def write_json(obj, path):
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
