"""Clothing photo(s) -> per-view RGBA cutouts -> albedo atlas + photo-derived normal map.

UV/tile coordinates are glTF convention: u right, v down (v = 0 at the image top).
"""
import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import binary_erosion, distance_transform_edt, gaussian_filter, label, sobel

MAX_ATLAS_W = 2048
MAX_TILE_H = 1024
ALPHA_FG = 128       # component labelling / row coverage threshold
ALPHA_MIN = 8        # bbox threshold
ALPHA_SOLID = 250    # rembg edge pixels are premultiplied (dark); only fully opaque ones seed the fill
PAD = 0.02           # bleed margin around each view, excluded from the tile rect
CROP_PAD = 0.10      # component bbox pad before the full-resolution rembg pass
MIN_COMPONENT = 0.05  # keep components with area >= 5 % of the largest
SHADOW_ROW = 0.20    # trim bottom rows whose opaque coverage < 20 % of the max row
FILL_ERODE = 0.03    # fraction of the view height eroded off the opaque rim before it seeds the fill
VIEW_ORDER = ["front", "back", "side"]
# normal map
NORMAL_SIGMA = 1.5
NORMAL_TILT_DEG = 25.0   # tilt reached by a strong (95th percentile) fold gradient
NORMAL_TILT_MAX = 60.0   # hard edges (collar rim, seams) are clamped to this tilt
NORMAL_NOISE = 0.15      # gradients below this fraction of the 95th percentile are flat
FLAT = np.array([128, 128, 255], np.uint8)
# neck hole: dark interior at the top-centre of the front/back photo (a mannequin-less shirt shows
# its inside through the hole); mesh vertices projecting into it must sample fabric below it
NECK_DARK = 0.5      # luminance below this x the median opaque luminance counts as hole interior ...
NECK_DROP = 40       # ... and at least this much (0-255) below it, so black fabric has no "hole"
NECK_ROWS = 0.30     # look for the hole only in the top part of the view
NECK_COLS = (0.30, 0.70)  # ... and in the central columns
NECK_BELOW = 0.02    # sample this far (fraction of view height) below the hole bottom

_session = None


def _rembg(img):
    global _session
    from rembg import new_session, remove
    if _session is None:
        _session = new_session("u2net")
    return remove(img, session=_session)


def _load(path):
    return ImageOps.exif_transpose(Image.open(path)).convert("RGBA")


def _components(img):
    """Bboxes (x0, y0, x1, y1) of foreground components in the sheet, sorted by centroid x."""
    a = np.asarray(_rembg(img))[:, :, 3] >= ALPHA_FG
    lab, n = label(a)
    if n == 0:
        raise ValueError("rembg found no foreground in the image")
    areas = np.bincount(lab.ravel())[1:]
    keep = np.nonzero(areas >= MIN_COMPONENT * areas.max())[0] + 1
    boxes = []
    for k in keep:
        ys, xs = np.nonzero(lab == k)
        boxes.append((xs.mean(), (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
    return [b for _, b in sorted(boxes, key=lambda t: t[0])]


def _cut_view(img, box):
    """Full-resolution rembg on one component crop (+10 % pad), shadow-trimmed, cropped, filled."""
    x0, y0, x1, y1 = box
    px, py = int(round((x1 - x0) * CROP_PAD)), int(round((y1 - y0) * CROP_PAD))
    crop = img.crop((max(0, x0 - px), max(0, y0 - py), min(img.width, x1 + px), min(img.height, y1 + py)))
    arr = np.asarray(_rembg(crop)).copy()
    fg = arr[:, :, 3] >= ALPHA_FG
    rows = fg.sum(axis=1)
    # soft cast shadow under the garment: drop bottom rows with little coverage
    bottom = len(rows)
    while bottom > 1 and rows[bottom - 1] < SHADOW_ROW * rows.max():
        bottom -= 1
    arr = arr[:bottom]
    ys, xs = np.nonzero(arr[:, :, 3] >= ALPHA_MIN)
    if len(xs) == 0:
        raise ValueError("rembg found no foreground in a view crop")
    bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    h, w = by1 - by0, bx1 - bx0
    px, py = int(round(w * PAD)), int(round(h * PAD))
    # transparent canvas with an exact PAD margin on every side (the bleed for texture filtering)
    out = np.zeros((h + 2 * py, w + 2 * px, 4), np.uint8)
    out[py:py + h, px:px + w] = arr[by0:by1, bx0:bx1]
    return Image.fromarray(fill_nearest(out), "RGBA")


def fill_nearest(arr):
    """Every pixel that is not fully opaque takes the colour of the nearest interior pixel.

    Interior = fully opaque eroded by FILL_ERODE of the view height, so neither the
    anti-aliased edge nor the dark collar / cuff openings at the silhouette rim
    seed the fill (the mesh samples the fill wherever it is wider than the photo).
    """
    opaque = arr[:, :, 3] >= ALPHA_SOLID
    seed = binary_erosion(opaque, iterations=max(2, int(round(FILL_ERODE * arr.shape[0]))))
    if not seed.any():
        seed = opaque
    if not seed.any():
        raise ValueError("cutout has no fully opaque pixels")
    _, (iy, ix) = distance_transform_edt(~seed, return_indices=True)
    arr = arr.copy()
    arr[:, :, :3] = arr[iy, ix, :3]
    return arr


def views_from_images(front_path, back_path=None, side_path=None):
    """{view: RGBA cutout}. The front image may be a sheet (front | back, or front | side | back)."""
    sheet = _load(front_path)
    boxes = _components(sheet)
    names = {1: ["front"], 2: ["front", "back"], 3: ["front", "side", "back"]}.get(len(boxes))
    if names is None:
        raise ValueError(f"expected 1-3 garment views in the sheet, found {len(boxes)}")
    views = {name: _cut_view(sheet, box) for name, box in zip(names, boxes)}
    for name, path in (("back", back_path), ("side", side_path)):
        if path:
            img = _load(path)
            boxes = _components(img)
            areas = [(b[2] - b[0]) * (b[3] - b[1]) for b in boxes]
            views[name] = _cut_view(img, boxes[int(np.argmax(areas))])
    return views


def _content(arr):
    """Content rect of a padded view array: the 2 % bleed margin removed."""
    h, w = arr.shape[:2]
    py, px = int(round(h * PAD / (1 + 2 * PAD))), int(round(w * PAD / (1 + 2 * PAD)))
    return arr[py:h - py, px:w - px]


def necklines(views):
    """{front/back: (w,) array} of normalised v just below the neck hole per column (0 where none)."""
    out = {}
    for name in ("front", "back"):
        if name not in views:
            continue
        arr = _content(np.asarray(views[name]))
        opaque = arr[:, :, 3] >= ALPHA_SOLID
        lum = np.asarray(arr[:, :, :3], np.float64) @ [0.299, 0.587, 0.114]
        med = np.median(lum[opaque])
        dark = opaque & (lum < min(NECK_DARK * med, med - NECK_DROP))
        h, w = dark.shape
        dark[int(NECK_ROWS * h):] = False
        dark[:, :int(NECK_COLS[0] * w)] = False
        dark[:, int(NECK_COLS[1] * w):] = False
        line = np.zeros(w)
        cols = np.nonzero(dark.any(axis=0))[0]
        if len(cols):
            last = h - 1 - np.argmax(dark[::-1, cols], axis=0)
            line[cols] = (last + 1) / h + NECK_BELOW
        out[name] = line
    return out


def make_atlas(views):
    """(albedo RGB, normal map RGB, tiles). Tiles = content rect (pad excluded) as (u0, v0, u1, v1)."""
    order = [v for v in VIEW_ORDER if v in views]
    tile_h = min(MAX_TILE_H, max(views[v].height for v in order))
    sizes = {v: (views[v].width * tile_h / views[v].height, tile_h) for v in order}
    total = sum(w for w, _ in sizes.values())
    if total > MAX_ATLAS_W:
        s = MAX_ATLAS_W / total
        sizes = {v: (w * s, h * s) for v, (w, h) in sizes.items()}
    sizes = {v: (max(1, int(round(w))), max(1, int(round(h)))) for v, (w, h) in sizes.items()}
    W, H = sum(w for w, _ in sizes.values()), max(h for _, h in sizes.values())
    albedo = Image.new("RGB", (W, H))
    normal = Image.new("RGB", (W, H), tuple(int(c) for c in FLAT))
    tiles = {}
    x = 0
    for v in order:
        w, h = sizes[v]
        # resize colour and alpha separately: Pillow premultiplies RGBA on resize, which
        # would turn the transparent (filled) bleed region black
        rgb = views[v].convert("RGB").resize((w, h), Image.LANCZOS)
        alpha = views[v].getchannel("A").resize((w, h), Image.LANCZOS)
        arr = np.dstack([np.asarray(rgb), np.asarray(alpha)])
        albedo.paste(rgb, (x, 0))
        normal.paste(Image.fromarray(normal_from_photo(arr), "RGB"), (x, 0))
        p = PAD / (1 + 2 * PAD)  # the pad is PAD of the content size, so this fraction of the padded tile
        tiles[v] = ((x + w * p) / W, p * h / H, (x + w * (1 - p)) / W, (1 - p) * h / H)
        x += w
    return albedo, normal, tiles


def normal_from_photo(arr):
    """Tangent-space normal map (glTF: +X right, +Y up) from an RGBA view: luminance as height.

    Blur -> Sobel -> normal. Strength k is set so a strong fold gradient (95th
    percentile inside the opaque area) tilts NORMAL_TILT_DEG; gradients under the
    noise floor and everything outside the opaque area are exactly flat.
    """
    lum = (np.asarray(arr[:, :, :3], np.float64) @ [0.299, 0.587, 0.114]) / 255.0
    lum = gaussian_filter(lum, NORMAL_SIGMA)
    gx = sobel(lum, axis=1) / 8.0   # d/dx, per pixel
    gy = -sobel(lum, axis=0) / 8.0  # d/dy with y up (rows grow downward)
    mag = np.hypot(gx, gy)
    opaque = arr[:, :, 3] >= ALPHA_SOLID
    inside = opaque & (distance_transform_edt(opaque) > 2 * NORMAL_SIGMA)
    ref = np.percentile(mag[inside], 95) if inside.any() else 0.0
    out = np.tile(FLAT, (*mag.shape, 1))
    if ref <= 0:
        return out
    k = np.tan(np.radians(NORMAL_TILT_DEG)) / ref
    t = np.minimum(mag * k, np.tan(np.radians(NORMAL_TILT_MAX))) / np.maximum(mag, 1e-12)
    n = np.dstack([-gx * t, -gy * t, np.ones_like(gx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    enc = np.rint(127.5 + 127.5 * n).astype(np.uint8)
    keep = inside & (mag >= NORMAL_NOISE * ref)
    out[keep] = enc[keep]
    return out
