"""Body measurements (frame) and v1 region masks for garment categories.

v2 garments are lofted in shell.py from `frame(V)`; `select_region` is the v1
vertex mask, kept only for `inspect` region counts.

Heights are normalised h = (y - ymin)/(ymax - ymin), lateral position is |x|,
measured in world space on the human mesh.

Calibrated on assets/human.glb (1.80 m, 24,461 verts). NOTE: that mesh is an
A-pose (arms angled ~45 deg down, hands at h~0.45-0.52, |x|~0.4-0.5), not a
horizontal T-pose, so two contract formulas were adapted:
  * torsoHalfWidth: the waist band contains arm vertices, so the 95th
    percentile of |x| is replaced by the largest gap between the torso cluster
    and the arm cluster of |x| in that band.
  * upper-arm cut: a plain |x| threshold gives a slanted sleeve on a diagonal
    arm, so arm vertices are projected onto the shoulder->hand axis and kept
    for t <= SLEEVE_FRACTION of that axis length.
Measured landmarks (h): crotch ~0.46, waist ~0.60, armpit ~0.72, shoulder
~0.82, neck base ~0.86 (shell.neck_height), chin ~0.87, elbow ~0.67, ankle ~0.05.
"""
import numpy as np

CATEGORIES = {  # ease_m is the nominal body ease reported in garment.json (shell.py holds the real ones)
    "tshirt": {"slot": "top", "ease_m": 0.018},
    "pants": {"slot": "bottom", "ease_m": 0.020},
}

WAIST_BAND = (0.55, 0.62)      # band used to measure torsoHalfWidth
TORSO_WIDTH_FACTOR = 1.15      # tshirt torso: |x| <= torsoHalfWidth * factor (covers hips at the hem)
TSHIRT_H = (0.50, 0.84)        # hem .. top of shoulders
SLEEVE_H_MIN = 0.62            # arm vertices below this are never sleeve
SLEEVE_FRACTION = 0.42         # sleeve length as fraction of shoulder->hand axis
SHOULDER_H = 0.80              # arm axis origin height
NECK_H = 0.815                 # neck hole: h > NECK_H and |x| < NECK_HALF_WIDTH
NECK_HALF_WIDTH = 0.085
PANTS_H = (0.05, 0.52)         # ankle .. hips
PANTS_WIDTH_FACTOR = 1.6       # pants: |x| <= torsoHalfWidth * factor (outer shin reaches 0.214; hands start at 0.40)


def normalized_height(V):
    ymin, ymax = V[:, 1].min(), V[:, 1].max()
    return (V[:, 1] - ymin) / (ymax - ymin)


def frame(V):
    """Measurements of the human needed by shell.build_garment / select_region."""
    h = normalized_height(V)
    ax = np.abs(V[:, 0])
    y = V[:, 1]
    thw = torso_half_width(V, h)
    shoulder = np.array([thw, y.min() + SHOULDER_H * (y.max() - y.min())])
    hand = np.array([ax.max(), y[np.argmax(ax)]])
    return {"ymin": y.min(), "yspan": y.max() - y.min(), "thw": thw,
            "shoulder": shoulder, "axis": hand - shoulder}


def _arm_t(P, fr):
    """Parameter along the shoulder->hand axis for points P (N,3)."""
    q = np.c_[np.abs(P[:, 0]), P[:, 1]] - fr["shoulder"]
    return (q @ fr["axis"]) / (fr["axis"] @ fr["axis"])


def torso_half_width(V, h):
    """Max |x| of the torso cluster in the waist band (largest-gap split)."""
    ax = np.sort(np.abs(V[(h >= WAIST_BAND[0]) & (h < WAIST_BAND[1]), 0]))
    gaps = np.diff(ax)
    i = int(np.argmax(gaps))
    if gaps[i] < 0.03:  # no arm cluster in band (true T-pose): fall back to p95
        return float(np.percentile(ax, 95))
    return float(ax[i])


def select_region(V, category, fr=None):
    """Boolean vertex mask for a category. V is world-space (N,3)."""
    fr = fr or frame(V)
    h = normalized_height(V)
    ax = np.abs(V[:, 0])
    thw = fr["thw"]
    if category == "tshirt":
        torso = (h >= TSHIRT_H[0]) & (h <= TSHIRT_H[1]) & (ax <= thw * TORSO_WIDTH_FACTOR)
        arm = (ax > thw * TORSO_WIDTH_FACTOR) & (h >= SLEEVE_H_MIN) & (h <= TSHIRT_H[1])
        sleeve = arm & (_arm_t(V, fr) <= SLEEVE_FRACTION)
        neck = (h > NECK_H) & (ax < NECK_HALF_WIDTH)
        return (torso | sleeve) & ~neck
    if category == "pants":
        return (h >= PANTS_H[0]) & (h <= PANTS_H[1]) & (ax <= thw * PANTS_WIDTH_FACTOR)
    raise ValueError(f"unknown category {category!r}")

