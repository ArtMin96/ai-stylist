# tools/capture-frames/parity — live-outline parity fixture

The capture camera draws a live outline that traces the item (capture brief
`.claude/plans/2026-10-22-capture-camera-brief.md`, "Live outline"). iOS and Android compute it in
their own languages. Both unit-test suites read `outline-parity.json` and must match it, so the two
outlines stay the same.

- `outline-parity.json` is generated. Never edit it by hand.
- `outline_reference.py` is the reference implementation (Python standard library only). It is a port
  of the feasibility spike's `contour.py`, with the fixes listed under "Pinned details".

```bash
python3 tools/capture-frames/parity/outline_reference.py check   # exit 1 when the JSON is stale
python3 tools/capture-frames/parity/outline_reference.py write \
  --frames artifacts/capture-camera/frames                         # --frames only to re-read real masks
pnpm exec prettier --write tools/capture-frames/parity/outline-parity.json
```

## What the JSON holds

- `params`: every number of the spec. Each platform's test asserts that its constants equal these.
- `tolerance`: 0.005 of the frame, per point and per coordinate. Never bit equality.
- `contour`: masks as `rows` (`#` is foreground) with `width` and `height`, and the `expected`
  64-point polygon (normalised 0–1, origin top-left, clockwise on screen), or `null` for no outline.
  - Hand-made masks: square, wide rectangle, a 4 × 4 item (the crop is upsampled), L-shape, a ring
    with a hole, two equal blobs (the first in row-major order wins), two unequal blobs, two squares
    touching at a corner (a saddle), and a checkerboard.
  - Real masks: five `frame.mask.png` files from `just capture-frames`, reduced 4 × 4 by majority.
    Their sets are named in each case's `note`. `bag-flat-01-good` keeps its handle hole.
  - `staticIouFilled` is the static test's number for the case, and `staticIouRaw` the same against
    the raw mask (information only); see "Pinned details" item 8.
- `iou`: polygon pairs and the IoU the snap and hysteresis rules read.
- `temporal`: sequences of mask updates. Each step lists the candidates (largest first, each with its
  `areaShare` and polygon) and the outline `expected` after that update, or `null` once it is cleared.
  `translation-jitter` is a real item (`one-piece-flat-02-jitter`) moved by its stored offsets at the
  mask cadence; both apps also assert that successive drawn outlines keep a centroid-aligned IoU ≥ 0.95.

## Pinned details

The tolerance does not absorb a different choice in any of these, so both apps must follow them.

1. **Downscale cell edges.** Cell `i` of `n` over `size` pixels starts at `round(i × size / n)` and
   ends at `max(round((i + 1) × size / n), start + 1)`. `round` is round-half-to-even on the exact
   value (Python `round`, Swift `.toNearestOrEven`). Kotlin's `Math.round` rounds half up, so it must
   not be used. The start is clamped to `size − 1`. The clamp only matters when a crop under 64 px is
   upsampled; the spike's `contour.py` indexed past the crop there.
2. **Output size.** `max(3, round(side × 64 / longSide))` with the same rounding.
3. **Crop growth.** `max(2, longSide / 8)` with integer (truncating) division, then clamped to the
   frame.
4. **Loop order.** Crossed edges are ordered horizontal before vertical, then by row, then by
   column. Each loop starts at the smallest unvisited edge and walks to its first neighbour; it then
   moves to whichever neighbour it did not come from. A clockwise flip reverses the loop in place.
   Vertex 0, and so the Douglas–Peucker split, depends on this.
5. **Ties.** The largest component, the largest loop, the farthest vertex, the Douglas–Peucker split
   and the topmost crossing each keep the first one found. The cyclic alignment keeps the smallest
   shift.
6. **IoU.** Both polygons are rasterised on a 64 × 64 grid over their joint bounding box. A cell
   counts when its centre is inside by the even-odd rule. An edge crosses a row's centre line when
   exactly one of its ends lies below it.
7. **Blend.** Position and shape blend apart. The centroid is the vertex mean; the shape is the points
   minus the centroid. The new shape is cyclically aligned to the drawn shape (least summed squared
   distance, smallest shift on a tie). With IoU(new, drawn) ≥ 0.5 both the centroid and the shape take
   the EMA (α 0.5). Below it the outline snaps: with the two shapes' IoU ≥ 0.5
   (`snapKeepsShapeAtLeastIou`) the centroid jumps to the new one and the shape still takes the EMA;
   otherwise the new outline replaces the drawn one. Changed 2026-10-22 (capture-sim run
   `2026-10-22-1502`): blending absolute points and replacing the outline on every snap let a purely
   translated item change shape between masks (centroid-aligned IoU 0.932 against the 0.95 bar).
8. **Static IoU reference.** The stored-frame static test (≥ 0.92) rasterises the outline at the
   mask's resolution (a pixel counts when its centre is inside, even-odd) and compares it with the
   filled outer boundary of the mask's largest 8-connected component: holes filled, where a hole is
   background not reachable 4-connected from the border. Never the raw mask: the outline fills holes by
   spec, so an item with a hole scores low against it (`bag-flat-01-good` at full size: 0.986 filled,
   0.879 raw). The results log's `outlineIou*` fields do use the raw mask, as information.
