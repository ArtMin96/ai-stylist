package app.aistylist.feature.capture.domain

/** One instance the outline may follow: its mask area share and its traced polygon. */
data class OutlineCandidate(
    val areaShare: Double,
    val points: List<NormalizedPoint>,
)

/** The drawn outline: its points and how many times it snapped (the screen animates only while this stays). */
data class LiveOutline(
    val points: List<NormalizedPoint>,
    val snapCount: Int,
)

/**
 * The drawn outline across mask updates (capture brief "Live outline", spec steps 8–9; the shared
 * reference's `Tracker`). Feed it once per distinct mask, never per rule evaluation:
 * - hysteresis: keep the candidate with the highest IoU ≥ 0.3 to the drawn outline, unless none
 *   qualifies or the largest is at least 1.5 × its area;
 * - position (vertex mean) and shape (points around it, cyclically aligned) blend apart, EMA α 0.5;
 *   when IoU(new, drawn) < 0.5 it snaps: the position jumps and the shape still blends while the two
 *   shapes overlap by ≥ 0.5, else the new outline replaces the drawn one (and always on the first item);
 * - clear after three consecutive updates with no item.
 * Immutable: each update returns the next tracker.
 */
data class OutlineTracker(
    val drawn: List<NormalizedPoint>? = null,
    private val missedUpdates: Int = 0,
    /** Snaps so far: the first outline and every jump to a new shape. */
    val snapCount: Int = 0,
) {
    /** The drawn outline with its snap count; null while nothing is drawn. */
    val live: LiveOutline? get() = drawn?.let { LiveOutline(it, snapCount) }

    /** The next tracker after one mask update; [candidates] are largest first, empty when no item. */
    fun update(candidates: List<OutlineCandidate>): OutlineTracker {
        if (candidates.isEmpty()) {
            val missed = missedUpdates + 1
            return copy(
                drawn = drawn.takeIf { missed < OutlineSpec.CLEAR_AFTER_MISSED_UPDATES },
                missedUpdates = missed,
            )
        }
        val current = drawn
        val next = choose(candidates, current).points
        current ?: return OutlineTracker(next, snapCount = snapCount + 1)
        // Position and shape blend apart, so a moving item keeps its shape (pinned detail 7).
        val (newCentre, newShape) = split(next)
        val (oldCentre, oldShape) = split(current)
        val shape = alignedTo(newShape, oldShape)
        val isSnap = polygonIou(next, current) < OutlineSpec.SNAP_BELOW_IOU
        // A snap to another shape replaces the outline; a snap to the same shape moved far only jumps.
        if (isSnap && polygonIou(shape, oldShape) < OutlineSpec.SNAP_KEEPS_SHAPE_AT_LEAST_IOU) {
            return OutlineTracker(next, snapCount = snapCount + 1)
        }
        val alpha = OutlineSpec.EMA_ALPHA
        val centre = if (isSnap) newCentre else blend(newCentre, oldCentre, alpha)
        val blended = shape.zip(oldShape) { new, old -> NormalizedPoint(centre.x, centre.y) + blend(new, old, alpha) }
        return OutlineTracker(blended, snapCount = if (isSnap) snapCount + 1 else snapCount)
    }

    private fun choose(
        candidates: List<OutlineCandidate>,
        current: List<NormalizedPoint>?,
    ): OutlineCandidate {
        val largest = candidates.first()
        current ?: return largest
        var kept: OutlineCandidate? = null
        var keptIou = -1.0
        for (candidate in candidates) {
            val iou = polygonIou(candidate.points, current)
            if (iou >= OutlineSpec.KEEP_AT_LEAST_IOU && iou > keptIou) {
                kept = candidate
                keptIou = iou
            }
        }
        return if (kept == null ||
            largest.areaShare >= OutlineSpec.SWITCH_AT_AREA_RATIO * kept.areaShare
        ) {
            largest
        } else {
            kept
        }
    }
}

/** The vertex mean and the points relative to it. */
private fun split(points: List<NormalizedPoint>): Pair<NormalizedPoint, List<NormalizedPoint>> {
    val centre = NormalizedPoint(points.sumOf { it.x } / points.size, points.sumOf { it.y } / points.size)
    return centre to points.map { NormalizedPoint(it.x - centre.x, it.y - centre.y) }
}

private fun blend(
    new: NormalizedPoint,
    old: NormalizedPoint,
    alpha: Double,
): NormalizedPoint = NormalizedPoint(alpha * new.x + (1 - alpha) * old.x, alpha * new.y + (1 - alpha) * old.y)

private operator fun NormalizedPoint.plus(other: NormalizedPoint): NormalizedPoint =
    NormalizedPoint(
        x + other.x,
        y + other.y,
    )
