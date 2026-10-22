#!/usr/bin/env python3
"""Reference implementation of the capture camera's live outline (capture brief "Live outline").

It writes and checks `outline-parity.json`, the fixture the iOS and Android unit tests both read.
Python standard library only, so it runs anywhere without a virtual environment.

    python3 tools/capture-frames/parity/outline_reference.py check
    python3 tools/capture-frames/parity/outline_reference.py write [--frames <frames dir>]

`write` rebuilds every expected value. With `--frames` it also re-reads the real masks from
`just capture-frames` output (REAL_SETS below); without it, the real masks already in the JSON are kept.
`check` recomputes everything and exits 1 when a stored value differs.

Mask -> polygon (spec steps 3-9): crop to the mask's box grown by max(2 px, long side // 8), area-average
downscale to a 64 px long side, threshold >= 0.5, keep the largest 8-connected component (ties: first in
row-major order), marching squares at 0.5 on the area-averaged values inside that component (zero-padded,
linear interpolation, saddles keep the foreground corners joined), keep the loop with the largest |area|,
orient clockwise on screen, Douglas-Peucker (epsilon 0.5 grid px, split at the vertex farthest from vertex
0; fewer than 3 vertices keeps the loop), resample to 64 points by arc length from where the vertical line
through the area centroid meets the contour at its smallest y, map to the frame (0-1, origin top-left).
Temporal (steps 2 and 10): `Tracker`.
"""
import argparse
import json
import math
import os
import struct
import sys
import zlib
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "outline-parity.json")

PARAMS = {
    "maskIntervalMs": 250,
    "cropGrowDivisor": 8,
    "cropGrowMinPx": 2,
    "longSidePx": 64,
    "foregroundAtLeast": 0.5,
    "epsilonPx": 0.5,
    "pointCount": 64,
    "keepAtLeastIou": 0.3,
    "switchAtAreaRatio": 1.5,
    "snapBelowIou": 0.5,
    "snapKeepsShapeAtLeastIou": 0.5,
    "emaAlpha": 0.5,
    "clearAfterMissedUpdates": 3,
    "iouGridCells": 64,
}
TOLERANCE = 0.005
# Real masks: 480 x 640 Vision masks from `just capture-frames`, reduced 4 x 4 by majority (>= 8 of 16).
REAL_SETS = [
    "top/top-flat-01-good",
    "shoes/shoes-flat-01-good",
    "small-item/small-item-flat-01-good",
    "long-bottom/long-bottom-flat-01-cut-left",
]
REAL_BLOCK = 4


# ---------------------------------------------------------------------------------------------- contour


def round_half_even(value):
    """Exact round-half-to-even of a Fraction (Python's round(); Kotlin's Math.round is half-up)."""
    return round(value)


def downscale(mask, w, h, long_side):
    """Area-average of a 0/1 mask to `long_side` px on the long side; cell edges round(i * size / n)."""
    nh = max(3, round_half_even(Fraction(h * long_side, max(w, h))))
    nw = max(3, round_half_even(Fraction(w * long_side, max(w, h))))
    integ = [[0] * (w + 1) for _ in range(h + 1)]
    for y in range(h):
        row = 0
        for x in range(w):
            row += 1 if mask[y][x] else 0
            integ[y + 1][x + 1] = integ[y][x + 1] + row

    def edge(i, n, size):
        return round_half_even(Fraction(i * size, n))

    out = [[0.0] * nw for _ in range(nh)]
    for r in range(nh):
        y0 = min(edge(r, nh, h), h - 1)  # the clamp matters only when upsampling a crop under 64 px
        y1 = max(edge(r + 1, nh, h), y0 + 1)
        for c in range(nw):
            x0 = min(edge(c, nw, w), w - 1)
            x1 = max(edge(c + 1, nw, w), x0 + 1)
            total = integ[y1][x1] - integ[y0][x1] - integ[y1][x0] + integ[y0][x0]
            out[r][c] = total / ((y1 - y0) * (x1 - x0))
    return out, nw, nh


def largest_component(soft, w, h):
    """Largest 8-connected component of soft >= 0.5 (ties: the first found in row-major order)."""
    label = [[0] * w for _ in range(h)]
    best, best_n, cur = 0, 0, 0
    for r in range(h):
        for c in range(w):
            if soft[r][c] >= PARAMS["foregroundAtLeast"] and not label[r][c]:
                cur += 1
                n = 0
                stack = [(r, c)]
                label[r][c] = cur
                while stack:
                    y, x = stack.pop()
                    n += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and soft[yy][xx] >= PARAMS["foregroundAtLeast"] and not label[yy][xx]:
                                label[yy][xx] = cur
                                stack.append((yy, xx))
                if n > best_n:
                    best, best_n = cur, n
    if best_n == 0:
        return None
    return [[label[r][c] == best for c in range(w)] for r in range(h)]


def marching_squares(field, iso=0.5):
    """Closed iso lines of `field` (rows; zero border added by the caller), as lists of (x, y)."""
    h, w = len(field), len(field[0])

    def point(e):
        kind, r, c = e
        r2, c2 = (r, c + 1) if kind == "h" else (r + 1, c)
        va, vb = field[r][c], field[r2][c2]
        t = 0.5 if va == vb else (iso - va) / (vb - va)
        return (c + t * (c2 - c), r + t * (r2 - r))

    adj = {}
    for r in range(h - 1):
        for c in range(w - 1):
            tl = field[r][c] >= iso
            tr = field[r][c + 1] >= iso
            br = field[r + 1][c + 1] >= iso
            bl = field[r + 1][c] >= iso
            top, right, bottom, left = ("h", r, c), ("v", r, c + 1), ("h", r + 1, c), ("v", r, c)
            crossed = [e for e, on in ((top, tl != tr), (right, tr != br), (bottom, bl != br), (left, tl != bl)) if on]
            if len(crossed) == 2:
                pairs = [tuple(crossed)]
            elif len(crossed) == 4:
                # saddle: the foreground corners stay joined (8-connected), so the background corners are cut off
                pairs = [(top, right), (bottom, left)] if tl else [(top, left), (right, bottom)]
            else:
                pairs = []
            for a, b in pairs:
                adj.setdefault(a, []).append(b)
                adj.setdefault(b, []).append(a)
    loops, seen = [], set()
    for start in sorted(adj):  # 'h' before 'v', then row, then column
        if start in seen:
            continue
        loop, prev, e = [], None, start
        while e not in seen:
            seen.add(e)
            loop.append(point(e))
            n1, n2 = adj[e][0], adj[e][-1]
            prev, e = e, (n2 if n1 == prev else n1)
        if len(loop) >= 3:
            loops.append(loop)
    return loops


def signed_area(p):
    s = 0.0
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        s += a[0] * b[1] - b[0] * a[1]
    return s / 2


def douglas_peucker_closed(p, eps):
    if len(p) < 4:
        return p
    far, far_d = 0, -1.0
    for i in range(len(p)):
        d = (p[i][0] - p[0][0]) * (p[i][0] - p[0][0]) + (p[i][1] - p[0][1]) * (p[i][1] - p[0][1])
        if d > far_d:
            far, far_d = i, d

    def dp(pts):
        if len(pts) < 3:
            return pts
        a, b = pts[0], pts[-1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.sqrt(dx * dx + dy * dy)
        best, bi = -1.0, 0
        for i in range(1, len(pts) - 1):
            q = pts[i]
            if n > 0:
                d = abs(dy * q[0] - dx * q[1] + b[0] * a[1] - b[1] * a[0]) / n
            else:
                d = math.sqrt((q[0] - a[0]) * (q[0] - a[0]) + (q[1] - a[1]) * (q[1] - a[1]))
            if d > best:
                best, bi = d, i
        if best > eps:
            return dp(pts[: bi + 1])[:-1] + dp(pts[bi:])
        return [a, b]

    first = dp(p[: far + 1])
    second = dp(p[far:] + [p[0]])
    return first[:-1] + second[:-1]


def top_ray_anchor(p, cum):
    """Arc length where the vertical line through the area centroid meets the contour at its smallest y."""
    a2 = signed_area(p)
    if abs(a2) < 1e-9:
        return 0.0
    cx = 0.0
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        cx += (a[0] + b[0]) * (a[0] * b[1] - b[0] * a[1])
    cx /= 6 * a2
    best = None
    for i in range(len(p)):
        a, b = p[i], p[(i + 1) % len(p)]
        if (a[0] - cx) * (b[0] - cx) <= 0 and a[0] != b[0]:
            t = (cx - a[0]) / (b[0] - a[0])
            y = a[1] + t * (b[1] - a[1])
            s = cum[i] + t * (cum[i + 1] - cum[i])
            if best is None or y < best[0]:
                best = (y, s)
    return best[1] if best else 0.0


def resample(p, n):
    m = len(p)
    cum = [0.0]
    for i in range(m):
        a, b = p[i], p[(i + 1) % m]
        cum.append(cum[i] + math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])))
    total = cum[m]
    s0 = top_ray_anchor(p, cum)
    out, j = [], 0
    for k in range(n):
        s = math.fmod(s0 + total * k / n, total)
        if s < 0:
            s += total
        guard = 0
        while not (cum[j] <= s < cum[j + 1]) and guard <= m:
            j = (j + 1) % m
            guard += 1
        t = (s - cum[j]) / (cum[j + 1] - cum[j]) if cum[j + 1] > cum[j] else 0.0
        a, b = p[j], p[(j + 1) % m]
        out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    return out


def contour(mask, W, H):
    """mask: rows of 0/1, W x H. Returns (points, simplified vertex count) or (None, 0)."""
    xs = [x for y in range(H) for x in range(W) if mask[y][x]]
    ys = [y for y in range(H) for x in range(W) if mask[y][x]]
    if not xs:
        return None, 0
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    pad = max(PARAMS["cropGrowMinPx"], max(x1 - x0, y1 - y0) // PARAMS["cropGrowDivisor"])
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    w, h = x1 - x0, y1 - y0
    crop = [row[x0:x1] for row in mask[y0:y1]]
    soft, sw, sh = downscale(crop, w, h, PARAMS["longSidePx"])
    comp = largest_component(soft, sw, sh)
    if comp is None:
        return None, 0
    fw, fh = sw + 2, sh + 2
    field = [[0.0] * fw for _ in range(fh)]
    for r in range(sh):
        for c in range(sw):
            if comp[r][c]:
                field[r + 1][c + 1] = soft[r][c]
    loops = marching_squares(field)
    if not loops:
        return None, 0
    loop = loops[0]
    for candidate in loops[1:]:
        if abs(signed_area(candidate)) > abs(signed_area(loop)):
            loop = candidate
    if signed_area(loop) < 0:  # clockwise on screen = positive area with y down
        loop = loop[::-1]
    simple = douglas_peucker_closed(loop, PARAMS["epsilonPx"])
    if len(simple) < 3 or abs(signed_area(simple)) < 1e-9:
        simple = loop
    pts = resample(simple, PARAMS["pointCount"])
    # padded grid: the centre of downscaled cell (c, r) sits at padded index (c + 1, r + 1)
    mapped = [((x0 + (x - 1 + 0.5) / sw * w) / W, (y0 + (y - 1 + 0.5) / sh * h) / H) for x, y in pts]
    return mapped, len(simple)


# ---------------------------------------------------------------------------------------------- temporal


def iou(p, q):
    """IoU of two polygons, rasterised on a G x G grid over their joint box, cell centres, even-odd."""
    g = PARAMS["iouGridCells"]
    xs = [v[0] for v in p] + [v[0] for v in q]
    ys = [v[1] for v in p] + [v[1] for v in q]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    if maxx <= minx or maxy <= miny:
        return 0.0
    cw, ch = (maxx - minx) / g, (maxy - miny) / g

    def row_cells(poly, y):
        crossings = []
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            if (a[1] > y) != (b[1] > y):
                crossings.append(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]))
        crossings.sort()
        inside = set()
        for k in range(0, len(crossings) - 1, 2):
            for c in range(g):
                x = minx + (c + 0.5) * cw
                if crossings[k] <= x < crossings[k + 1]:
                    inside.add(c)
        return inside

    inter = union = 0
    for r in range(g):
        y = miny + (r + 0.5) * ch
        a, b = row_cells(p, y), row_cells(q, y)
        inter += len(a & b)
        union += len(a | b)
    return inter / union if union else 0.0


def align(new, old):
    """`new` cyclically shifted to the least summed squared distance to `old` (ties: smallest shift)."""
    n = len(new)
    best, bk = None, 0
    for k in range(n):
        d = 0.0
        for i in range(n):
            q, o = new[(i + k) % n], old[i]
            d += (q[0] - o[0]) * (q[0] - o[0]) + (q[1] - o[1]) * (q[1] - o[1])
        if best is None or d < best:
            best, bk = d, k
    return [new[(i + bk) % n] for i in range(n)]


class Tracker:
    """One update per distinct mask. candidates: [(areaShare, points)], largest first."""

    def __init__(self):
        self.drawn, self.missed = None, 0

    def choose(self, candidates):
        largest = candidates[0]
        if self.drawn is None:
            return largest
        kept, kept_iou = None, -1.0
        for cand in candidates:
            v = iou(cand[1], self.drawn)
            if v >= PARAMS["keepAtLeastIou"] and v > kept_iou:
                kept, kept_iou = cand, v
        if kept is None or largest[0] >= PARAMS["switchAtAreaRatio"] * kept[0]:
            return largest
        return kept

    def update(self, candidates):
        if not candidates:
            self.missed += 1
            if self.missed >= PARAMS["clearAfterMissedUpdates"]:
                self.drawn = None
            return self.drawn
        self.missed = 0
        new = self.choose(candidates)[1]
        if self.drawn is None:
            self.drawn = list(new)
            return self.drawn
        # Position and shape blend apart, so a moving item keeps its shape: centroid = vertex mean, shape =
        # the points around it, the new shape cyclically aligned to the drawn shape.
        a = PARAMS["emaAlpha"]
        (cx, cy), shape = split(new)
        (dx, dy), drawn_shape = split(self.drawn)
        shape = align(shape, drawn_shape)
        if iou(new, self.drawn) >= PARAMS["snapBelowIou"]:
            cx, cy = a * cx + (1 - a) * dx, a * cy + (1 - a) * dy
        elif iou(shape, drawn_shape) < PARAMS["snapKeepsShapeAtLeastIou"]:
            self.drawn = list(new)  # snap to another shape: replaced
            return self.drawn
        # else: snap to the same shape moved far: the position jumps, the shape still blends
        self.drawn = [(cx + a * x + (1 - a) * px, cy + a * y + (1 - a) * py) for (x, y), (px, py) in zip(shape, drawn_shape)]
        return self.drawn


def split(points):
    """(centroid, shape): the vertex mean, and the points relative to it."""
    cx = sum(x for x, _ in points) / len(points)
    cy = sum(y for _, y in points) / len(points)
    return (cx, cy), [(x - cx, y - cy) for x, y in points]


# ---------------------------------------------------------------------------------------------- inputs


def blank(w, h):
    return [[0] * w for _ in range(h)]


def fill_rect(m, x0, y0, x1, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            m[y][x] = 1
    return m


def fill_disc(m, cx, cy, r, value=1):
    for y in range(len(m)):
        for x in range(len(m[0])):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                m[y][x] = value
    return m


def hand_masks():
    """Hand-made masks (name, note, mask)."""
    out = []
    out.append(("empty", "no foreground: no outline", blank(40, 30)))
    out.append(("square", "axis-aligned square", fill_rect(blank(40, 40), 10, 12, 30, 32)))
    out.append(("rect-wide", "wide rectangle in a wide frame", fill_rect(blank(90, 50), 15, 10, 80, 38)))
    out.append(("tiny-square", "4 x 4 item: the crop is upsampled to 64 px", fill_rect(blank(12, 12), 4, 4, 8, 8)))
    m = fill_rect(blank(50, 60), 10, 8, 22, 50)
    out.append(("l-shape", "concave L", fill_rect(m, 10, 38, 40, 50)))
    m = fill_disc(blank(60, 60), 30, 30, 22)
    out.append(("ring", "disc with a hole: outer loop only, the hole is filled", fill_disc(m, 30, 30, 10, 0)))
    m = fill_rect(blank(60, 40), 4, 8, 24, 28)
    out.append(("two-blobs-equal", "equal blobs: the first in row-major order wins", fill_rect(m, 36, 8, 56, 28)))
    m = fill_rect(blank(60, 40), 4, 10, 18, 24)
    out.append(("two-blobs-unequal", "the larger blob wins", fill_rect(m, 28, 4, 56, 34)))
    m = blank(40, 40)
    for (x0, y0) in ((8, 8), (20, 20)):
        fill_rect(m, x0, y0, x0 + 12, y0 + 12)
    out.append(("diagonal-saddle", "two squares touching at one corner: the saddle joins them", m))
    m = blank(24, 24)
    for y in range(6, 18):
        for x in range(6, 18):
            if ((x - 6) // 3 + (y - 6) // 3) % 2 == 0:
                m[y][x] = 1
    out.append(("checkerboard", "3 px checkerboard: many saddles, foreground stays 8-connected", m))
    return out


def read_png_gray(path):
    """8-bit greyscale, non-interlaced PNG (what `just capture-frames` writes) as rows of ints."""
    data = open(path, "rb").read()
    pos, idat, w = 8, b"", 0
    while pos < len(data):
        (n,) = struct.unpack(">I", data[pos : pos + 4])
        kind = data[pos + 4 : pos + 8]
        body = data[pos + 8 : pos + 8 + n]
        if kind == b"IHDR":
            w, h, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", body)
            if (depth, colour, interlace) != (8, 0, 0):
                raise SystemExit(f"{path}: not an 8-bit grey non-interlaced PNG")
        elif kind == b"IDAT":
            idat += body
        pos += 12 + n
    raw = zlib.decompress(idat)
    rows, prev = [], [0] * w
    for y in range(len(raw) // (w + 1)):
        f = raw[y * (w + 1)]
        line = list(raw[y * (w + 1) + 1 : (y + 1) * (w + 1)])
        for x in range(w):
            a = line[x - 1] if x else 0
            b = prev[x]
            c = prev[x - 1] if x else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return rows


def real_mask(frames, set_path):
    full = read_png_gray(os.path.join(frames, set_path, "frame.mask.png"))
    h, w = len(full) // REAL_BLOCK, len(full[0]) // REAL_BLOCK
    out = blank(w, h)
    for y in range(h):
        for x in range(w):
            on = sum(1 for dy in range(REAL_BLOCK) for dx in range(REAL_BLOCK) if full[y * REAL_BLOCK + dy][x * REAL_BLOCK + dx] > 0)
            out[y][x] = 1 if on * 2 >= REAL_BLOCK * REAL_BLOCK else 0
    return out


def to_rows(mask):
    return ["".join("#" if v else "." for v in row) for row in mask]


def from_rows(rows):
    return [[1 if ch == "#" else 0 for ch in row] for row in rows]


def rounded(points):
    return None if points is None else [[round(x, 6), round(y, 6)] for x, y in points]


def area_share(mask):
    return sum(sum(row) for row in mask) / (len(mask) * len(mask[0]))


# A jittered real item (`just capture-frames` one-piece-flat-02-jitter): its mask moved by the stored
# offsets at the 250 ms mask cadence (frame int(k x 7.5) at 30 fps). A pure translation, yet the raw outline
# changes shape by up to 7 % from one position to the next (crop and 64 px grid quantisation).
JITTER_SET = "one-piece-flat-02-jitter"
JITTER_UPDATES = 4


def jitter_candidates(frames, previous):
    if not frames:
        old = next((c for c in (previous or {}).get("temporal", []) if c["name"] == "translation-jitter"), None)
        if old is None:
            raise SystemExit("translation-jitter: pass --frames to build it")
        return [step["candidates"] for step in old["steps"]]
    index = json.load(open(os.path.join(frames, "index.json")))
    segment = next(s for s in index["sets"] if s["id"] == JITTER_SET)["segments"][0]
    mask = [[1 if v else 0 for v in row] for row in read_png_gray(os.path.join(frames, segment["mask"]))]
    H, W = len(mask), len(mask[0])
    steps = []
    for k in range(JITTER_UPDATES):
        ox, oy = segment["offsets"][int(k * 7.5) % len(segment["offsets"])]
        dx, dy = round(ox * W), round(oy * H)
        moved = blank(W, H)
        for y in range(max(0, dy), min(H, H + dy)):
            for x in range(max(0, dx), min(W, W + dx)):
                moved[y][x] = mask[y - dy][x - dx]
        pts, _ = contour(moved, W, H)
        steps.append([{"areaShare": round(area_share(moved), 6), "points": rounded(pts)}])
    return steps


def temporal_cases(frames, previous):
    """Sequences of mask updates (candidates as polygons, largest first) and the outline drawn after each."""
    W, H = 80, 80

    def cand(mask):
        pts, _ = contour(mask, W, H)
        return {"areaShare": round(area_share(mask), 6), "points": rounded(pts)}

    sq = lambda x, y, s: fill_rect(blank(W, H), x, y, x + s, y + s)  # noqa: E731
    a, a_moved, far = cand(sq(20, 20, 30)), cand(sq(22, 21, 30)), cand(fill_rect(blank(W, H), 44, 60, 78, 70))
    a_far = cand(sq(48, 46, 30))
    left, right_same = cand(sq(6, 30, 20)), cand(sq(50, 28, 22))
    right_big = cand(sq(46, 22, 30))
    cases = [
        {
            "name": "ema-snap-clear",
            "note": "first item snaps; a small move blends (centroid and shape EMA 0.5); another shape far away replaces it; three empty updates clear",
            "steps": [[a], [a_moved], [far], [], [], [], [a]],
        },
        {
            "name": "snap-keeps-shape",
            "note": "the same shape far away (IoU under 0.5): the position jumps, the shape still blends",
            "steps": [[a], [a_moved], [a_far]],
        },
        {
            "name": "translation-jitter",
            "note": f"{JITTER_SET} at the mask cadence: successive drawn outlines keep their shape (centroid-aligned IoU >= 0.95)",
            "steps": jitter_candidates(frames, previous),
        },
        {
            "name": "hysteresis",
            "note": "the drawn item is kept while another is under 1.5 x its area, then the larger one wins",
            "steps": [[left], [right_same, left], [right_big, left]],
        },
    ]
    for case in cases:
        tracker = Tracker()
        steps = []
        for cands in case["steps"]:
            drawn = tracker.update([(c["areaShare"], [tuple(p) for p in c["points"]]) for c in cands])
            steps.append({"candidates": cands, "expected": rounded(drawn)})
        case["steps"] = steps
    return cases


def iou_cases():
    sq = lambda x0, y0, s: [(x0, y0), (x0 + s, y0), (x0 + s, y0 + s), (x0, y0 + s)]  # noqa: E731
    pairs = [
        ("same", sq(0.2, 0.2, 0.4), sq(0.2, 0.2, 0.4)),
        ("half-overlap", sq(0.2, 0.2, 0.4), sq(0.4, 0.2, 0.4)),
        ("apart", sq(0.1, 0.1, 0.2), sq(0.6, 0.6, 0.2)),
        ("inside", sq(0.1, 0.1, 0.6), sq(0.3, 0.3, 0.2)),
    ]
    return [{"name": n, "a": rounded(p), "b": rounded(q), "expected": round(iou(p, q), 6)} for n, p, q in pairs]


def build(frames, previous):
    contour_cases = [{"name": n, "note": note, "rows": to_rows(m)} for n, note, m in hand_masks()]
    old_real = {c["name"]: c for c in (previous or {}).get("contour", []) if c["name"].startswith("real-")}
    for set_path in REAL_SETS:
        name = "real-" + set_path.split("/")[1]
        if frames:
            rows = to_rows(real_mask(frames, set_path))
        elif name in old_real:
            rows = old_real[name]["rows"]
        else:
            raise SystemExit(f"{name}: pass --frames to read it")
        note = f"`just capture-frames` {set_path}/frame.mask.png, reduced {REAL_BLOCK} x {REAL_BLOCK} by majority"
        contour_cases.append({"name": name, "note": note, "rows": rows})
    for case in contour_cases:
        mask = from_rows(case["rows"])
        pts, vertices = contour(mask, len(mask[0]), len(mask))
        case["width"], case["height"] = len(mask[0]), len(mask)
        case["simplifiedVertexCount"] = vertices
        case["expected"] = rounded(pts)
    return {
        "about": "Live-outline parity fixture: capture brief 'Live outline'. Generated by outline_reference.py; never edit by hand.",
        "version": 1,
        "tolerance": TOLERANCE,
        "params": PARAMS,
        "contour": [{k: c[k] for k in ("name", "note", "width", "height", "simplifiedVertexCount", "rows", "expected")} for c in contour_cases],
        "iou": iou_cases(),
        "temporal": temporal_cases(frames, previous),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("action", choices=["write", "check"])
    parser.add_argument("--frames", help="`just capture-frames` output, to re-read the real masks")
    args = parser.parse_args()
    previous = json.load(open(FIXTURE)) if os.path.exists(FIXTURE) else None
    fixture = build(args.frames, previous)
    if args.action == "write":
        with open(FIXTURE, "w") as out:
            json.dump(fixture, out, indent=2)
            out.write("\n")
        print(f"wrote {FIXTURE}")
        return 0
    if previous != json.loads(json.dumps(fixture)):
        print("outline-parity.json is stale: run `outline_reference.py write`", file=sys.stderr)
        return 1
    print("outline-parity.json matches the reference")
    return 0


if __name__ == "__main__":
    sys.exit(main())
