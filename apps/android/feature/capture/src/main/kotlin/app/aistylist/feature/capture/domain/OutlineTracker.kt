package app.aistylist.feature.capture.domain

/** One instance the outline may follow: its mask area share and its traced polygon. */
data class OutlineCandidate(
    val areaShare: Double,
    val points: List<NormalizedPoint>,
)

/**
 * The drawn outline across mask updates (capture brief "Live outline", spec steps 8–9; the shared
 * reference's `Tracker`). Feed it once per distinct mask, never per rule evaluation:
 * - hysteresis: keep the candidate with the highest IoU ≥ 0.3 to the drawn outline, unless none
 *   qualifies or the largest is at least 1.5 × its area;
 * - snap to the new polygon on the first item or when IoU(new, drawn) < 0.5, else an EMA (α 0.5)
 *   over the cyclically aligned points;
 * - clear after three consecutive updates with no item.
 * Immutable: each update returns the next tracker.
 */
data class OutlineTracker(
    val drawn: List<NormalizedPoint>? = null,
    private val missedUpdates: Int = 0,
) {
    /** The next tracker after one mask update; [candidates] are largest first, empty when no item. */
    fun update(candidates: List<OutlineCandidate>): OutlineTracker {
        if (candidates.isEmpty()) {
            val missed = missedUpdates + 1
            return OutlineTracker(drawn.takeIf { missed < OutlineSpec.CLEAR_AFTER_MISSED_UPDATES }, missed)
        }
        val current = drawn
        val next = choose(candidates, current).points
        if (current == null || polygonIou(next, current) < OutlineSpec.SNAP_BELOW_IOU) return OutlineTracker(next)
        val alpha = OutlineSpec.EMA_ALPHA
        val blended =
            alignedTo(next, current).zip(current) { new, old ->
                NormalizedPoint(alpha * new.x + (1 - alpha) * old.x, alpha * new.y + (1 - alpha) * old.y)
            }
        return OutlineTracker(blended)
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
