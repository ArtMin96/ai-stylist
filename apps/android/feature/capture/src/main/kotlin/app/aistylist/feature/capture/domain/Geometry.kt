package app.aistylist.feature.capture.domain

import kotlin.math.max
import kotlin.math.min

/**
 * A box in the analysis frame, normalised to 0–1 on both axes: portrait, origin top-left, edges
 * named as the user sees the screen (capture brief §3). The camera adapter rotates detector output
 * into this space before the rules see it.
 */
data class NormalizedRect(
    val left: Double,
    val top: Double,
    val right: Double,
    val bottom: Double,
) {
    init {
        require(left <= right && top <= bottom) { "A rect needs left <= right and top <= bottom" }
    }

    val width: Double get() = right - left
    val height: Double get() = bottom - top

    /** Box area ÷ frame area. */
    val areaShare: Double get() = width * height
    val centerX: Double get() = (left + right) / 2
    val centerY: Double get() = (top + bottom) / 2

    /** Intersection over union with [other]; 0 when they do not overlap. */
    fun intersectionOverUnion(other: NormalizedRect): Double {
        val overlapWidth = (min(right, other.right) - max(left, other.left)).coerceAtLeast(0.0)
        val overlapHeight = (min(bottom, other.bottom) - max(top, other.top)).coerceAtLeast(0.0)
        val intersection = overlapWidth * overlapHeight
        val union = areaShare + other.areaShare - intersection
        return if (union > 0.0) intersection / union else 0.0
    }
}

/** A point in the same normalised space as [NormalizedRect]. */
data class NormalizedPoint(
    val x: Double,
    val y: Double,
)
