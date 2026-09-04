"""Lofted garments from convex body cross-sections (v2).

Every garment piece is an open tube: a stack of rings, each ring the 2D convex
hull of one body slice pushed outward by an ease, resampled to a fixed number
of points by angle around the ring centre, and consecutive rings lofted into
triangles. Fabric therefore bridges concavities (abs, spine, armpit) instead
of painting them.

tshirt = torso tube (hem -> shoulder line) + 3 collar rings + 2 sleeve tubes.
pants  = hip tube (waist -> crotch) + 2 leg tubes (crotch -> ankle).
"""
import numpy as np
from scipy.spatial import ConvexHull

from . import regions

# --- tshirt -----------------------------------------------------------------
TORSO_H = (0.50, 0.82)      # hem .. shoulder line
TORSO_RINGS = 40
TORSO_POINTS = 64
TORSO_EASE = (0.030, 0.018)  # hem .. chest, linear in h, constant above CHEST_H
CHEST_H = 0.74
TORSO_CLIP = 1.15           # |x| <= thw * TORSO_CLIP ...
CLIP_WIDEN_H = 0.76         # ... widened linearly from here ...
CLIP_WIDEN = 0.05           # ... by this much (m) at the shoulder ring, so the deltoids are inside
NECK_SCAN = (0.82, 0.87, 0.0025)  # h range/step searched for the neck
NECK_CLIP = 0.10            # neck slice: |x| < NECK_CLIP
NECK_TOL = 1.10             # collar sits at the lowest h whose neck perimeter <= NECK_TOL * min
COLLAR_RINGS = 3
COLLAR_EASE = 0.012
COLLAR_DIP = 0.02           # front of the collar sits this much lower than the back
SLEEVE_T = (-0.06, 0.34)    # along the shoulder->hand axis (fraction of its length); elbow is at ~0.43
SLEEVE_RINGS = 12
SLEEVE_POINTS = 32
SLEEVE_EASE = 0.022
SLEEVE_CLIP = TORSO_CLIP    # arm slice: |x| > thw * SLEEVE_CLIP (the torso tube covers what is inside)
SLEEVE_FLARE = 0.008        # extra ease at the sleeve end, ramped over the last SLEEVE_FLARE_T
SLEEVE_FLARE_T = 0.12
SLEEVE_RAMP_T = 0.16        # ease ramps from 0 at the inner ring to SLEEVE_EASE over this t range,
                            # so the rings on the shoulder top stay under the torso/collar tube
# --- pants ------------------------------------------------------------------
CROTCH_H = 0.46
HIP_H = (0.60, 0.415)       # waist .. 0.08 m below the crotch (covers the leg-tube tops)
HIP_RINGS = 14
HIP_POINTS = 64
HIP_EASE = (0.018, 0.011)   # waist..crotch, then tapering to the bottom ring so it tucks inside the legs
PANTS_CLIP = 0.30           # |x| <= PANTS_CLIP (hands hang at |x| > 0.40)
LEG_H = (0.443, 0.05)       # 0.03 m below the crotch .. ankle
LEG_AXIS_H = (0.42, 0.08)   # slices whose centroids define the leg axis
LEG_RINGS = 30
LEG_POINTS = 48
LEG_EASE = 0.020
LEG_TOP_EASE = 0.008        # first ring: strictly inside the hip tube; ramps to LEG_EASE by HIP_H[1]
FOOT_H = 0.07               # slices below this include the foot: those rings hang only
HANG = 0.99                 # ring radius >= HANG * previous ring radius (per angle)
SMOOTH = 3                  # moving-average window along the tube


def build_garment(V, F, N, category, fr):
    """Loft a garment over the human mesh V, F (world metres), N unused.

    Returns (verts (n,3), faces (m,3) int, normals (n,3) unit, parts (n,) int8)
    with parts 0 = body, 1 = left sleeve (x < 0), 2 = right sleeve (x > 0).
    """
    if category == "tshirt":
        tubes = [(_torso_rings(V, fr), 0), (_sleeve_rings(V, fr, -1), 1), (_sleeve_rings(V, fr, +1), 2)]
    elif category == "pants":
        tubes = [(_hip_rings(V, fr), 0), (_leg_rings(V, fr, -1), 0), (_leg_rings(V, fr, +1), 0)]
    else:
        raise ValueError(f"unknown category {category!r}")
    verts, faces, normals, parts = [], [], [], []
    offset = 0
    for rings, part in tubes:
        v, f, n = _loft(rings)
        verts.append(v)
        faces.append(f + offset)
        normals.append(n)
        parts.append(np.full(len(v), part, dtype=np.int8))
        offset += len(v)
    return np.vstack(verts), np.vstack(faces), np.vstack(normals), np.concatenate(parts)


# --- rings ------------------------------------------------------------------
# A ring is a dict: c (3,) centre, e1, e2 (3,) unit vectors spanning its plane,
# r (n,) radii at angles 2*pi*j/n, dy (n,) optional per-point offset along y.

def _ring(P3, e1, e2, origin, n, ease):
    """Ring around the convex hull of the points P3 projected onto (e1, e2)."""
    Q = P3 - origin
    P2 = np.c_[Q @ e1, Q @ e2]
    hull = ConvexHull(P2)
    poly = P2[hull.vertices]
    cen = _polygon_centroid(poly)
    return {"c": origin + cen[0] * e1 + cen[1] * e2, "e1": e1, "e2": e2,
            "r": _hull_radii(poly, cen, n) + ease}


def _polygon_centroid(poly):
    x, y = poly[:, 0], poly[:, 1]
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    cross = x * y1 - x1 * y
    area = cross.sum() / 2
    return np.array([((x + x1) * cross).sum(), ((y + y1) * cross).sum()]) / (6 * area)


def _hull_radii(poly, center, n):
    """Distance from `center` to the convex polygon boundary at n equal angles."""
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False)
    d = np.c_[np.cos(ang), np.sin(ang)]
    a = poly - center
    e = np.roll(poly, -1, axis=0) - poly
    den = d[:, 0:1] * e[None, :, 1] - d[:, 1:2] * e[None, :, 0]  # (n, m) = d x e
    with np.errstate(divide="ignore", invalid="ignore"):
        r = (a[:, 0] * e[:, 1] - a[:, 1] * e[:, 0])[None, :] / den   # a x e / d x e
        s = (a[None, :, 0] * d[:, 1:2] - a[None, :, 1] * d[:, 0:1]) / den  # a x d / d x e
    hit = (r > 0) & (s >= -1e-9) & (s <= 1 + 1e-9)
    r = np.where(hit, r, np.inf).min(axis=1)
    if not np.isfinite(r).all():
        raise ValueError("ring centre outside its hull")
    return r


def _smooth_rings(rings, keys=("r", "c")):
    """Moving average of `keys` over SMOOTH consecutive rings; end rings are kept."""
    k = SMOOTH // 2
    out = [dict(r) for r in rings]
    for i in range(k, len(rings) - k):
        for key in keys:
            out[i][key] = np.mean([rings[j][key] for j in range(i - k, i + k + 1)], axis=0)
    return out


def _ring_points(ring):
    n = len(ring["r"])
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False)
    P = ring["c"] + ring["r"][:, None] * (np.cos(ang)[:, None] * ring["e1"] + np.sin(ang)[:, None] * ring["e2"])
    if "dy" in ring:
        P[:, 1] += ring["dy"]
    return P


def _loft(rings):
    """Triangulate consecutive rings into an open tube with outward smooth normals."""
    n = len(rings[0]["r"])
    verts = np.vstack([_ring_points(r) for r in rings])
    j = np.arange(n)
    j1 = (j + 1) % n
    faces = []
    for i in range(len(rings) - 1):
        a, b, c, d = i * n + j, i * n + j1, (i + 1) * n + j1, (i + 1) * n + j
        faces.append(np.c_[a, b, c])
        faces.append(np.c_[a, c, d])
    faces = np.vstack(faces)
    fn = np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]])
    centres = np.vstack([np.repeat(r["c"][None], n, axis=0) for r in rings])
    outward = (verts - centres)[faces[:, 0]]
    if (fn * outward).sum(axis=1).mean() < 0:
        faces = faces[:, ::-1]
        fn = -fn
    normals = np.zeros_like(verts)
    for k in range(3):
        np.add.at(normals, faces[:, k], fn)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    return verts, faces, normals


# --- slices -----------------------------------------------------------------
X, Y, Z = np.eye(3)


def _y(fr, h):
    return fr["ymin"] + h * fr["yspan"]


def _band(V, y, half):
    return np.abs(V[:, 1] - y) <= half


def _torso_clip(fr, h):
    w = fr["thw"] * TORSO_CLIP
    if h > CLIP_WIDEN_H:
        w += CLIP_WIDEN * (h - CLIP_WIDEN_H) / (TORSO_H[1] - CLIP_WIDEN_H)
    return w


def _torso_ease(h):
    return float(np.interp(h, [TORSO_H[0], CHEST_H], TORSO_EASE))


def _horizontal_ring(V, fr, h, half, xmax, n, ease):
    y = _y(fr, h)
    m = _band(V, y, half) & (np.abs(V[:, 0]) <= xmax)
    return _ring(V[m], X, Z, np.array([0.0, y, 0.0]), n, ease)


def _torso_rings(V, fr):
    hs = np.linspace(TORSO_H[0], TORSO_H[1], TORSO_RINGS)
    half = (hs[1] - hs[0]) / 2 * fr["yspan"]
    rings = [_horizontal_ring(V, fr, h, half, _torso_clip(fr, h), TORSO_POINTS, _torso_ease(h)) for h in hs]
    rings = _smooth_rings(rings)
    return rings + _collar_rings(V, fr, rings[-1], half)


def neck_height(V, fr):
    """h of the collar: lowest slice (|x| < NECK_CLIP) in NECK_SCAN whose hull
    perimeter is within NECK_TOL of the smallest one (the smallest sits right
    under the jaw; the neck column starts a little lower)."""
    lo, hi, step = NECK_SCAN
    hs = np.arange(lo, hi + step / 2, step)
    per = []
    for h in hs:
        m = _band(V, _y(fr, h), step * fr["yspan"]) & (np.abs(V[:, 0]) < NECK_CLIP)
        hull = ConvexHull(V[m][:, [0, 2]])
        q = V[m][hull.vertices][:, [0, 2]]
        per.append(np.linalg.norm(np.roll(q, -1, axis=0) - q, axis=1).sum())
    per = np.array(per)
    return float(hs[np.argmax(per <= NECK_TOL * per.min())])


def _collar_rings(V, fr, shoulder, half):
    """COLLAR_RINGS rings from the shoulder ring inward to the crew-neck collar.

    The collar ring is the neck hull + COLLAR_EASE at neck_height. Rings in
    between blend linearly from shoulder to collar but never go inside the
    body slice at their height (+ chest ease), so the fabric lies on the
    trapezius. The front dips COLLAR_DIP lower than the back, ramped in."""
    hn = neck_height(V, fr)
    collar = _horizontal_ring(V, fr, hn, half, NECK_CLIP, TORSO_POINTS, COLLAR_EASE)
    ang = np.linspace(0, 2 * np.pi, TORSO_POINTS, endpoint=False)
    front = (1 + np.sin(ang)) / 2  # 1 at +z (front), 0 at the back
    rings = []
    for k in range(1, COLLAR_RINGS + 1):
        f = k / COLLAR_RINGS
        h = TORSO_H[1] + f * (hn - TORSO_H[1])
        ring = {"c": (1 - f) * shoulder["c"] + f * collar["c"], "e1": X, "e2": Z,
                "r": (1 - f) * shoulder["r"] + f * collar["r"], "dy": -f * COLLAR_DIP * front}
        if k < COLLAR_RINGS:
            body = _horizontal_ring(V, fr, h, half, _torso_clip(fr, TORSO_H[1]), TORSO_POINTS, TORSO_EASE[1])
            ring["r"] = np.maximum(ring["r"], _radii_about(body, ring["c"]))
        rings.append(ring)
    return rings


def _radii_about(ring, centre):
    """Radii of `ring` re-measured around another centre in the same plane."""
    P = _ring_points(ring) - centre
    return _hull_radii(np.c_[P @ ring["e1"], P @ ring["e2"]], np.zeros(2), len(ring["r"]))


def _sleeve_rings(V, fr, side):
    """Tube along the shoulder->hand axis of the arm on `side` (-1 left, +1 right)."""
    axis = np.array([side * fr["axis"][0], fr["axis"][1], 0.0])
    L = np.linalg.norm(axis)
    u = axis / L
    origin = np.array([side * fr["shoulder"][0], fr["shoulder"][1], 0.0])
    e1 = np.cross(Z, u)
    e1 /= np.linalg.norm(e1)
    arm = side * V[:, 0] > fr["thw"] * SLEEVE_CLIP
    t = ((V - origin) @ u) / L
    ts = np.linspace(SLEEVE_T[0], SLEEVE_T[1], SLEEVE_RINGS)
    half = (ts[1] - ts[0]) / 2
    rings = []
    for tk in ts:
        m = arm & (np.abs(t - tk) <= half)
        ease = SLEEVE_EASE * min(1.0, (tk - SLEEVE_T[0]) / SLEEVE_RAMP_T)
        ease += SLEEVE_FLARE * max(0.0, (tk - (SLEEVE_T[1] - SLEEVE_FLARE_T)) / SLEEVE_FLARE_T)
        rings.append(_ring(V[m], e1, Z, origin + tk * L * u, SLEEVE_POINTS, ease))
    return _smooth_rings(rings)


def _hip_rings(V, fr):
    hs = np.linspace(HIP_H[0], HIP_H[1], HIP_RINGS)
    half = (hs[0] - hs[1]) / 2 * fr["yspan"]
    return _smooth_rings([_horizontal_ring(V, fr, h, half, PANTS_CLIP, HIP_POINTS, _hip_ease(h)) for h in hs])


def _hip_ease(h):
    return float(np.interp(h, [HIP_H[1], CROTCH_H], HIP_EASE[::-1]))


def _leg_rings(V, fr, side):
    """Rings centred on the straight thigh->ankle axis of one leg, hang rule applied.

    The leg ease ramps from LEG_TOP_EASE at the first ring (inside the hip tube)
    to LEG_EASE at the hip tube's bottom, while the hip ease tapers the other
    way, so the two surfaces cross at a shallow angle under the hip tube and
    neither open edge shows at the crotch."""
    hs = np.linspace(LEG_H[0], LEG_H[1], LEG_RINGS)
    half = (hs[0] - hs[1]) / 2 * fr["yspan"]
    leg = (side * V[:, 0] > 0) & (np.abs(V[:, 0]) <= PANTS_CLIP)
    a, b = (V[leg & _band(V, _y(fr, h), half)].mean(axis=0) for h in LEG_AXIS_H)
    rings = []
    for h in hs:
        y = _y(fr, h)
        centre = a + (b - a) * (y - a[1]) / (b[1] - a[1])
        P = V[leg & _band(V, y, half)]
        ease = float(np.interp(h, [HIP_H[1], LEG_H[0]], [LEG_EASE, LEG_TOP_EASE]))
        ring = _ring(P, X, Z, np.array([0.0, y, 0.0]), LEG_POINTS, ease)
        ring["r"] = _radii_about(ring, centre)
        ring["c"] = centre
        rings.append(ring)
    rings = _smooth_rings(rings, keys=("r",))
    for k in range(1, LEG_RINGS):
        hang = HANG * rings[k - 1]["r"]
        rings[k]["r"] = hang if hs[k] < FOOT_H else np.maximum(rings[k]["r"], hang)
    return rings
