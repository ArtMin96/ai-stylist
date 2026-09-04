"""Generate synthetic clothing images into ../../samples/ (Pillow only)."""
import os

from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SAMPLES = os.path.join(ROOT, "samples")
BG = (236, 236, 232)
S = 800


def tshirt(path):
    img = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(img)
    c = (30, 110, 200)
    d.polygon([(140, 200), (290, 130), (350, 130), (400, 185), (450, 130), (510, 130), (660, 200),
               (610, 320), (540, 290), (540, 700), (260, 700), (260, 290), (190, 320)], fill=c)
    # collar
    d.chord((330, 100, 470, 190), 0, 180, fill=BG)
    # slightly darker sleeve bands
    d.polygon([(140, 200), (190, 320), (240, 300), (200, 190)], fill=(22, 90, 170))
    d.polygon([(660, 200), (610, 320), (560, 300), (600, 190)], fill=(22, 90, 170))
    # chest stripe
    d.rectangle((260, 370, 540, 430), fill=(250, 210, 40))
    img.save(path)


def pants(path):
    img = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(img)
    c = (120, 40, 60)
    d.polygon([(250, 90), (550, 90), (570, 400), (560, 730), (430, 730), (410, 400), (400, 300),
               (390, 400), (370, 730), (240, 730), (230, 400)], fill=c)
    d.rectangle((250, 90, 550, 130), fill=(80, 25, 40))  # waistband
    d.line([(400, 130), (400, 300)], fill=(80, 25, 40), width=4)
    img.save(path)


if __name__ == "__main__":
    os.makedirs(SAMPLES, exist_ok=True)
    tshirt(os.path.join(SAMPLES, "tshirt-synthetic.png"))
    pants(os.path.join(SAMPLES, "pants-synthetic.png"))
    print(SAMPLES)
