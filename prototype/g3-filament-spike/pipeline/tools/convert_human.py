"""Convert a human mesh (OBJ/GLB/PLY/STL) into assets/human.glb.

Usage (from pipeline/):
    .venv/bin/python tools/convert_human.py <input mesh> [--height 1.80] [--out ../assets/human.glb]

The mesh is scaled to the given height in metres, centred in x/z, placed with its feet at
y=0, given outward normals and a plain skin-tone PBR material. The pipeline expects Y-up
and the face pointing +Z (the script prints which way the head points so you can check).
"""
import argparse
import os

import trimesh


def main():
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("--height", type=float, default=1.80, help="target height in metres")
    p.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..", "assets", "human.glb"))
    a = p.parse_args()

    m = trimesh.load(a.src, force="mesh", process=False)
    lo, hi = m.bounds
    m.apply_scale(a.height / (hi[1] - lo[1]))
    lo, hi = m.bounds
    m.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    m.fix_normals()
    m.visual = trimesh.visual.TextureVisuals(
        material=trimesh.visual.material.PBRMaterial(
            name="skin", baseColorFactor=[0.80, 0.62, 0.52, 1.0], metallicFactor=0.0, roughnessFactor=0.85))
    scene = trimesh.Scene()
    scene.add_geometry(m, node_name="human", geom_name="human")
    scene.export(a.out, include_normals=True)

    v = m.vertices
    head = v[v[:, 1] > m.bounds[1][1] - 0.22]
    faces = "+z (correct)" if abs(head[:, 2].max()) > abs(head[:, 2].min()) else "-z (rotate the mesh 180 deg about Y first)"
    print(f"wrote {os.path.abspath(a.out)}: {len(v)} vertices, {len(m.faces)} triangles, "
          f"bounds {m.bounds.round(3).tolist()}, head points {faces}")


if __name__ == "__main__":
    main()
