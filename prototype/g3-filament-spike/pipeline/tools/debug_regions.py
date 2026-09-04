"""Write out/debug-<category>.png: orthographic front scatter of the region.

usage: python tools/debug_regions.py [--human glb] [--out dir]
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from g3.human import load_human  # noqa: E402
from g3.regions import CATEGORIES, normalized_height, select_region, torso_half_width  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--human", default=os.path.join(ROOT, "assets", "human.glb"))
    ap.add_argument("--out", default=os.path.join(ROOT, "out"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    V, F, N = load_human(a.human)
    h = normalized_height(V)
    thw = torso_half_width(V, h)
    W, H = 700, 1200
    ppm = (H - 40) / (V[:, 1].max() - V[:, 1].min())  # pixels per metre

    def px(v):
        return (W / 2 + v[:, 0] * ppm, H - 20 - (v[:, 1] - V[:, 1].min()) * ppm)

    for cat in CATEGORIES:
        sel = select_region(V, cat)
        img = Image.new("RGB", (W, H), (255, 255, 255))
        d = ImageDraw.Draw(img)
        for hh in np.arange(0.0, 1.01, 0.1):
            yy = H - 20 - hh * (H - 40)
            d.line([(0, yy), (W, yy)], fill=(230, 230, 230))
            d.text((4, yy - 12), f"h={hh:.1f}", fill=(120, 120, 120))
        for xx in (-thw, thw):
            d.line([(W / 2 + xx * ppm, 0), (W / 2 + xx * ppm, H)], fill=(200, 200, 255))
        xs, ys = px(V)
        for x, y in zip(xs[~sel], ys[~sel]):
            d.point((x, y), fill=(170, 170, 170))
        for x, y in zip(xs[sel], ys[sel]):
            d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(220, 40, 40))
        d.text((4, 4), f"{cat}: {int(sel.sum())} verts  torsoHalfWidth={thw:.3f}", fill=(0, 0, 0))
        p = os.path.join(a.out, f"debug-{cat}.png")
        img.save(p)
        print(p, int(sel.sum()))


if __name__ == "__main__":
    main()
