"""Face -> view assignment and planar UVs into the atlas tiles.

UVs are glTF convention (u right, v down, v = 0 at the image top); export.py
converts to trimesh's bottom-left origin.

Only the front and back tiles are sampled. The side photo is mostly sleeve, so
projecting it onto the torso paints a sleeve-shaped patch on the ribs, and on
the sleeves themselves it only adds a hard seam against the front/back tiles.
"""
import numpy as np

CUFF_T = 0.92  # sleeve vertices never project past this fraction of the sleeve's own extent
FRONT, BACK = 0, 1


def assign_uv(verts, faces, normals, parts, tiles, necklines=None):
    """(verts, faces, normals, uv) with vertices duplicated where adjacent faces use different views.

    Faces use the front tile when their mean normal has z >= 0, else the back
    tile mirrored in x. necklines: {front/back: (w,) array} from
    texture.necklines; torso vertices (parts == 0) projecting into the photo's
    neck hole sample just below it instead.
    """
    verts, normals = np.asarray(verts, np.float64), np.asarray(normals, np.float64)
    faces, parts = np.asarray(faces, np.int64), np.asarray(parts)
    view = np.where(normals[faces].mean(axis=1)[:, 2] >= 0, FRONT, BACK)

    key = faces * 2 + view[:, None]
    uniq, inv = np.unique(key, return_inverse=True)
    src, vview = uniq // 2, uniq % 2
    nverts, nnormals, nparts = verts[src], normals[src], parts[src]

    lo, hi = verts.min(axis=0), verts.max(axis=0)
    span = np.maximum(hi - lo, 1e-9)
    xy = _clamp_cuffs(nverts[:, :2].copy(), nparts)
    u = (xy[:, 0] - lo[0]) / span[0]
    v = (hi[1] - xy[:, 1]) / span[1]
    u = np.where(vview == BACK, 1 - u, u)
    for vid, name in ((FRONT, "front"), (BACK, "back")):
        line = (necklines or {}).get(name)
        if line is not None:
            m = (vview == vid) & (nparts == 0)
            col = np.clip((u[m] * len(line)).astype(int), 0, len(line) - 1)
            v[m] = np.maximum(v[m], line[col])

    rects = {FRONT: tiles["front"], BACK: tiles.get("back", tiles["front"])}
    uv = np.empty((len(uniq), 2))
    for vid, (u0, v0, u1, v1) in rects.items():
        m = vview == vid
        uv[m, 0] = u0 + u[m] * (u1 - u0)
        uv[m, 1] = v0 + v[m] * (v1 - v0)
    return nverts, inv.reshape(faces.shape), nnormals, uv


def _clamp_cuffs(xy, parts):
    """Pull sleeve points back along the sleeve's projected axis to CUFF_T of its extent.

    The photo's cuff opening shows the sleeve's dark inside; the mesh's last ring
    would sample it, so it reuses the fabric just inside the cuff instead.
    """
    for p in np.unique(parts[parts != 0]):
        m = parts == p
        P = xy[m]
        c = P.mean(axis=0)
        d = np.linalg.svd(P - c, full_matrices=False)[2][0]
        if d[0] * np.sign(c[0]) < 0:  # point away from the body
            d = -d
        t = (P - c) @ d
        tmax = t.min() + CUFF_T * (t.max() - t.min())
        xy[m] = P - np.maximum(t - tmax, 0)[:, None] * d
    return xy
