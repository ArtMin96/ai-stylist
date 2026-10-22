package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureRules

/**
 * What one segmenter mask shows (capture brief §3 on the mask path, the iOS measure): the item (the
 * largest instance), the other instances' boxes for the covered rule, and the outline candidates.
 * [timestampMs] is when the mask's frame was analysed; a mask reused across frames keeps it, so the
 * rules and the outline can tell a new mask from a repeated one.
 */
data class MaskObservation(
    val timestampMs: Long,
    /** The largest instance, measured; null when the mask is empty. */
    val item: MaskMeasure?,
    val instanceCount: Int,
    /** Boxes of the other objects in the frame (covered rule, C32). */
    val otherBoxes: List<NormalizedRect>,
    /** The largest few instances, each with its traced polygon, largest first (outline hysteresis). */
    val outlineCandidates: List<OutlineCandidate>,
) {
    /** The item when it is large enough to count as found (iOS `minInstanceAreaShare`). */
    val foundItem: MaskMeasure?
        get() = item?.takeIf { it.maskAreaShare >= CaptureRules.Ios.MIN_INSTANCE_AREA_SHARE }
}

/**
 * One label image measured once — every instance's profile and outline — then read at any pixel
 * offset (playback jitter moves the whole mask). The live segmenter builds one per mask; the debug
 * frame source one per stored mask.
 */
class MaskAnalysis(
    private val labels: LabelImage,
) {
    private val instances = labels.instances()
    private val itemProfile = instances.firstOrNull()?.let { MaskProfile.of(labels, it.label) }
    private val candidates: List<OutlineCandidate> =
        instances
            .filter {
                it.pixelCount.toDouble() / (labels.width * labels.height) >=
                    CaptureRules.Ios.MIN_INSTANCE_AREA_SHARE
            }.take(MAX_OUTLINE_CANDIDATES)
            .mapNotNull { instance ->
                val mask =
                    BooleanArray(labels.width * labels.height) {
                        labels.isLabel(
                            it % labels.width,
                            it / labels.width,
                            instance.label,
                        )
                    }
                traceOutline(labels.width, labels.height, mask)?.let { trace ->
                    OutlineCandidate(instance.pixelCount.toDouble() / (labels.width * labels.height), trace.points)
                }
            }

    /** The observation of the mask moved by ([offsetX], [offsetY]) pixels, stamped [timestampMs]. */
    fun at(
        timestampMs: Long,
        offsetX: Int = 0,
        offsetY: Int = 0,
    ): MaskObservation {
        val dx = offsetX.toDouble() / labels.width
        val dy = offsetY.toDouble() / labels.height
        val item = itemProfile?.measure(offsetX, offsetY)
        return MaskObservation(
            timestampMs = timestampMs,
            item = item,
            instanceCount = instances.size,
            otherBoxes = instances.drop(1).mapNotNull { it.box.shifted(dx, dy) },
            outlineCandidates =
                if (offsetX == 0 && offsetY == 0) {
                    candidates
                } else {
                    candidates.map { candidate ->
                        candidate.copy(points = candidate.points.map { NormalizedPoint(it.x + dx, it.y + dy) })
                    }
                },
        )
    }

    private companion object {
        const val MAX_OUTLINE_CANDIDATES = 3
    }
}

/** [this] box moved by ([dx], [dy]) and clipped to the frame; null when nothing is left inside. */
private fun NormalizedRect.shifted(
    dx: Double,
    dy: Double,
): NormalizedRect? {
    val left = (left + dx).coerceIn(0.0, 1.0)
    val top = (top + dy).coerceIn(0.0, 1.0)
    val right = (right + dx).coerceIn(0.0, 1.0)
    val bottom = (bottom + dy).coerceIn(0.0, 1.0)
    return if (right > left && bottom > top) NormalizedRect(left, top, right, bottom) else null
}
