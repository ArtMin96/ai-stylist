"""Clone-check fixture (tools/jscpd/README.md): unrelated to every other `_clean` file."""

from collections.abc import Sequence


def median(values: Sequence[float]) -> float:
    if not values:
        raise ValueError("median of an empty sequence")
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2
