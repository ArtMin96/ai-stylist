"""CLI: python -m g3 build|dress|inspect (see CONTRACT.md)."""
import argparse
import json
import os
import sys

from . import compose, export, regions, shell, texture, uvmap
from .human import load_human


def cmd_build(a):
    if a.category not in regions.CATEGORIES:
        raise ValueError(f"unknown category {a.category!r}; expected one of {sorted(regions.CATEGORIES)}")
    spec = regions.CATEGORIES[a.category]
    os.makedirs(a.out, exist_ok=True)
    V, F, N = load_human(a.human)
    fr = regions.frame(V)
    verts, faces, normals, parts = shell.build_garment(V, F, N, a.category, fr)
    views = texture.views_from_images(a.image, a.image_back, a.image_side)
    views["front"].save(os.path.join(a.out, "cutout.png"))
    albedo, normal_map, tiles = texture.make_atlas(views)
    albedo.save(os.path.join(a.out, "atlas.png"))
    normal_map.save(os.path.join(a.out, "normal.png"))
    verts, faces, normals, uv = uvmap.assign_uv(verts, faces, normals, parts, tiles, texture.necklines(views))
    mesh = export.garment_mesh(verts, faces, uv, normals, albedo, normal_map, a.category)
    export.write_glb(mesh, a.category, os.path.join(a.out, "garment.glb"))
    # id = basename of --out so the sidecar agrees with the server's out/garments/<id>/ layout
    garment_id = os.path.basename(os.path.normpath(a.out))
    meta = export.sidecar(garment_id, a.category, spec["slot"], spec["ease_m"], a.image, a.human,
                          len(verts), len(faces), albedo.size, views)
    export.write_json(meta, os.path.join(a.out, "garment.json"))
    return meta


def cmd_dress(a):
    ids = compose.dress(a.human, a.garment, a.out)
    return {"out": a.out, "garmentIds": ids}


def cmd_inspect(a):
    V, F, _ = load_human(a.human)
    return {
        "height_m": float(V[:, 1].max() - V[:, 1].min()),
        "vertices": int(len(V)),
        "triangles": int(len(F)),
    }


def main(argv=None):
    p = argparse.ArgumentParser(prog="g3")
    sub = p.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--human", required=True)
    b.add_argument("--image", required=True, help="front photo, or one sheet: front | [side |] back")
    b.add_argument("--image-back", help="back photo (overrides the sheet's back view)")
    b.add_argument("--image-side", help="side photo (overrides the sheet's side view)")
    b.add_argument("--category", required=True)
    b.add_argument("--out", required=True)
    b.set_defaults(fn=cmd_build)
    d = sub.add_parser("dress")
    d.add_argument("--human", required=True)
    d.add_argument("--out", required=True)
    d.add_argument("--garment", action="append", default=[], help="garment dir (repeatable)")
    d.set_defaults(fn=cmd_dress)
    i = sub.add_parser("inspect")
    i.add_argument("--human", required=True)
    i.set_defaults(fn=cmd_inspect)
    a = p.parse_args(argv)
    try:
        result = a.fn(a)
    except Exception as e:  # noqa: BLE001 - CLI boundary
        print(json.dumps({"error": f"{type(e).__name__}: {e}"}), file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
