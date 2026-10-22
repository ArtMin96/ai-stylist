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
    /** The item when it is large enough to count as found (`mask.minInstanceAreaShare`). */
    val foundItem: MaskMeasure?
        get() = item?.takeIf { it.maskAreaShare >= CaptureRules.Mask.MIN_INSTANCE_AREA_SHARE }
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
    private val outlined =
        instances
            .filter {
                it.pixelCount.toDouble() / (labels.width * labels.height) >=
                    CaptureRules.Mask.MIN_INSTANCE_AREA_SHARE
            }.take(MAX_OUTLINE_CANDIDATES)

    /** The candidates per pixel offset, traced on the moved mask (clipped at the frame edge), as the camera would see it. */
    private val candidatesByOffset = HashMap<Pair<Int, Int>, List<OutlineCandidate>>()

    private fun candidates(
        offsetX: Int,
        offsetY: Int,
    ): List<OutlineCandidate> =
        candidatesByOffset[offsetX to offsetY] ?: traceCandidates(offsetX, offsetY).also {
            if (candidatesByOffset.size < MAX_CACHED_OFFSETS) candidatesByOffset[offsetX to offsetY] = it
        }

    private fun traceCandidates(
        offsetX: Int,
        offsetY: Int,
    ): List<OutlineCandidate> {
        val width = labels.width
        val height = labels.height
        return outlined.mapNotNull { instance ->
            val mask =
                BooleanArray(width * height) {
                    val x = it % width - offsetX
                    val y = it / width - offsetY
                    x in 0 until width && y in 0 until height && labels.isLabel(x, y, instance.label)
                }
            val area = mask.count { on -> on }
            traceOutline(width, height, mask)?.let { OutlineCandidate(area.toDouble() / (width * height), it.points) }
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
            outlineCandidates = candidates(offsetX, offsetY),
        )
    }

    private companion object {
        /** At most this many outlines per mask (iOS `maxCandidates`): a cost bound, not a parity value. */
        const val MAX_OUTLINE_CANDIDATES = 3
        const val MAX_CACHED_OFFSETS = 256
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
