"""Clone-check fixture (tools/jscpd/README.md).

The body of `describe_parcel` is copied into parcel_label_copy.py on purpose, so
`just clone-check --fixtures` must report a python clone.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Parcel:
    parcel_id: str
    weight_grams: int
    length_mm: int
    width_mm: int
    height_mm: int
    fragile: bool


def describe_parcel(parcel: Parcel) -> str:
    volume_litres = parcel.length_mm * parcel.width_mm * parcel.height_mm / 1_000_000
    weight_kg = parcel.weight_grams / 1000
    density = 0.0 if volume_litres == 0 else weight_kg / volume_litres
    size = "standard"
    if volume_litres > 60:
        size = "oversize"
    elif volume_litres > 20:
        size = "large"
    handling = "normal"
    if parcel.fragile:
        handling = "fragile"
    elif density > 2:
        handling = "heavy"
    parts = [
        f"parcel {parcel.parcel_id}",
        f"{weight_kg:.2f} kg",
        f"{volume_litres:.1f} l",
        f"size {size}",
        f"handling {handling}",
    ]
    if density > 5:
        parts.append("check declared weight")
    return " | ".join(parts)
