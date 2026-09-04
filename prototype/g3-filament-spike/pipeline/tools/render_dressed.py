"""Orthographic z-buffer software render of a dressed GLB (front/back/side) for eyeballing.

usage: python tools/render_dressed.py [dressed.glb] [out_dir]
"""
import os
import sys

import numpy as np
import trimesh
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VIEWS = {"front": (0, 2, 1), "back": (0, 2, -1), "side": (2, 0, 1)}  # (screen-x axis, depth axis, sign)


def render(scene, view, W=800, H=1440):
    xa, za, sign = VIEWS[view]
    ppm = (H - 40) / 1.8
    img = np.full((H, W, 3), 255, np.uint8)
    zbuf = np.full((H, W), -np.inf)
    for g in scene.geometry.values():
        Vv, Fv = g.vertices, g.faces
        sx = W / 2 + sign * Vv[:, xa] * ppm
        sy = H - 20 - Vv[:, 1] * ppm
        sz = sign * Vv[:, za]
        mat = getattr(g.visual, "material", None)
        tex = getattr(mat, "baseColorTexture", None)
        A = np.asarray(tex.convert("RGB")) if tex is not None else None
        uv = g.visual.uv if A is not None else None
        # simple lambert shading from the view direction
        shade = 0.55 + 0.45 * np.abs(g.face_normals[:, za])
        for fi, f in enumerate(Fv):
            xs, ys, zs = sx[f], sy[f], sz[f]
            x0, x1 = int(np.floor(xs.min())), int(np.ceil(xs.max()))
            y0, y1 = int(np.floor(ys.min())), int(np.ceil(ys.max()))
            if x1 < 0 or y1 < 0 or x0 >= W or y0 >= H:
                continue
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
            px, py = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            det = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(det) < 1e-9:
                continue
            w0 = ((ys[1] - ys[2]) * (px - xs[2]) + (xs[2] - xs[1]) * (py - ys[2])) / det
            w1 = ((ys[2] - ys[0]) * (px - xs[2]) + (xs[0] - xs[2]) * (py - ys[2])) / det
            w2 = 1 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any():
                continue
            z = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
            zb = zbuf[y0:y1 + 1, x0:x1 + 1]
            hit = inside & (z > zb)
            if not hit.any():
                continue
            zb[hit] = z[hit]
            if A is not None:
                u = (w0 * uv[f[0], 0] + w1 * uv[f[1], 0] + w2 * uv[f[2], 0])[hit]
                v = (w0 * uv[f[0], 1] + w1 * uv[f[1], 1] + w2 * uv[f[2], 1])[hit]
                col = A[np.clip((v * A.shape[0]).astype(int), 0, A.shape[0] - 1),
                        np.clip((u * A.shape[1]).astype(int), 0, A.shape[1] - 1)]
            else:
                col = np.full((int(hit.sum()), 3), 200)
            img[y0:y1 + 1, x0:x1 + 1][hit] = (col * shade[fi]).astype(np.uint8)
    return Image.fromarray(img)


if __name__ == "__main__":
    glb = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "out", "dressed", "test.glb")
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "out")
    scene = trimesh.load(glb)
    for view in VIEWS:
        p = os.path.join(out, f"render-{view}.png")
        render(scene, view).save(p)
        print(p)
