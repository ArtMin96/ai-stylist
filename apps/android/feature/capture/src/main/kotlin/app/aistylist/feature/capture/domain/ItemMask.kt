package app.aistylist.feature.capture.domain

import app.aistylist.contracts.kernel.CaptureRules
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * A label image in the analysis frame, rows top to bottom: 0 is background, every other value one
 * foreground instance (the segmenter's connected components, or the frame generator's
 * `frame.instances.png`). A plain mask is a label image with one label.
 */
class LabelImage(
    val width: Int,
    val height: Int,
    private val labels: ByteArray,
) {
    init {
        require(
            width > 0 && height > 0 && labels.size == width * height,
        ) { "A label image needs width × height labels" }
    }

    /** The label at ([x], [y]), 0–255. */
    fun labelAt(
        x: Int,
        y: Int,
    ): Int = labels[y * width + x].toInt() and LABEL_MASK

    /**
     * Every instance, largest first (ties: the smaller label first), so the item is the first and
     * the rest are the other objects the covered rule reads (capture brief §4, C32). Mirrors iOS
     * `CaptureInstanceLabels.instances`.
     */
    fun instances(): List<MaskInstance> {
        val count = IntArray(LABEL_COUNT)
        val minX = IntArray(LABEL_COUNT) { Int.MAX_VALUE }
        val minY = IntArray(LABEL_COUNT) { Int.MAX_VALUE }
        val maxX = IntArray(LABEL_COUNT) { -1 }
        val maxY = IntArray(LABEL_COUNT) { -1 }
        for (y in 0 until height) {
            for (x in 0 until width) {
                val label = labelAt(x, y)
                if (label == 0) continue
                count[label]++
                minX[label] = min(minX[label], x)
                maxX[label] = max(maxX[label], x)
                minY[label] = min(minY[label], y)
                maxY[label] = max(maxY[label], y)
            }
        }
        return (1 until LABEL_COUNT)
            .filter { count[it] > 0 }
            .map { label ->
                MaskInstance(
                    label = label,
                    pixelCount = count[label],
                    box =
                        NormalizedRect(
                            left = minX[label].toDouble() / width,
                            top = minY[label].toDouble() / height,
                            right = (maxX[label] + 1).toDouble() / width,
                            bottom = (maxY[label] + 1).toDouble() / height,
                        ),
                )
            }.sortedWith(compareByDescending<MaskInstance> { it.pixelCount }.thenBy { it.label })
    }

    /** True when ([x], [y]) holds [label]. */
    fun isLabel(
        x: Int,
        y: Int,
        label: Int,
    ): Boolean = labelAt(x, y) == label

    companion object {
        private const val LABEL_COUNT = 256
        private const val LABEL_MASK = 0xFF

        /**
         * The 8-connected components of [foreground] as labels 1, 2, … from the largest down (ties:
         * the first found in row-major order); components past label 255 are dropped. The segmenter's
         * single saliency mask becomes instances this way.
         */
        fun components(
            width: Int,
            height: Int,
            foreground: BooleanArray,
        ): LabelImage {
            val components = ConnectedComponents.of(width, height, foreground)
            val raw = components.labels
            val sizes = components.sizes
            val order = sizes.indices.sortedWith(compareByDescending<Int> { sizes[it] }.thenBy { it })
            val newLabel = IntArray(sizes.size + 1)
            order.take(LABEL_COUNT - 1).forEachIndexed { rank, id -> newLabel[id + 1] = rank + 1 }
            return LabelImage(width, height, ByteArray(raw.size) { newLabel[raw[it]].toByte() })
        }
    }
}

/** One foreground instance of a [LabelImage]: its label, pixel count and box. */
data class MaskInstance(
    val label: Int,
    val pixelCount: Int,
    val box: NormalizedRect,
)

/**
 * For each frame edge, the share of that edge's length the item mask spans inside the edge band
 * ([CaptureRules.EDGE_BAND_SHARE] of the frame). Edges as the user sees the screen.
 */
data class EdgeContact(
    val top: Double = 0.0,
    val bottom: Double = 0.0,
    val left: Double = 0.0,
    val right: Double = 0.0,
)

/** The item one mask shows: box, mask area share and edge contact (iOS `CaptureMaskMeasure`). */
data class MaskMeasure(
    val box: NormalizedRect,
    val maskAreaShare: Double,
    val edgeContact: EdgeContact,
)

/**
 * One instance of a label image, measured once and read at any small pixel offset (playback
 * jitter). The same measure as iOS `CaptureMaskProfile`, so both apps judge a mask alike.
 */
class MaskProfile private constructor(
    private val image: LabelImage,
    private val label: Int,
    private val count: Int,
    private val minX: Int,
    private val maxX: Int,
    private val minY: Int,
    private val maxY: Int,
) {
    /**
     * The item with the mask moved by ([offsetX], [offsetY]) pixels (right and down are positive);
     * null when it moved fully out of the frame. Edge contact is exact: the share of each edge's
     * length whose band (edge band share of that dimension, at least 1 pixel) holds a mask pixel. The
     * box is the mask's box moved and clipped; the area share shrinks by the clipped part.
     */
    fun measure(
        offsetX: Int = 0,
        offsetY: Int = 0,
    ): MaskMeasure? {
        val width = image.width
        val height = image.height
        val left = max(0, minX + offsetX)
        val right = min(width - 1, maxX + offsetX)
        val top = max(0, minY + offsetY)
        val bottom = min(height - 1, maxY + offsetY)
        if (left > right || top > bottom) return null
        val fullArea = ((maxX - minX + 1) * (maxY - minY + 1)).toDouble()
        val keptArea = ((right - left + 1) * (bottom - top + 1)).toDouble()
        return MaskMeasure(
            box =
                NormalizedRect(
                    left = left.toDouble() / width,
                    top = top.toDouble() / height,
                    right = (right + 1).toDouble() / width,
                    bottom = (bottom + 1).toDouble() / height,
                ),
            maskAreaShare = count * keptArea / fullArea / (width * height),
            edgeContact = edgeContact(offsetX, offsetY),
        )
    }

    private fun edgeContact(
        offsetX: Int,
        offsetY: Int,
    ): EdgeContact {
        val width = image.width
        val height = image.height
        val bandX = max(1, (CaptureRules.EDGE_BAND_SHARE * width).roundToInt())
        val bandY = max(1, (CaptureRules.EDGE_BAND_SHARE * height).roundToInt())

        fun isSet(
            x: Int,
            y: Int,
        ): Boolean {
            val sourceX = x - offsetX
            val sourceY = y - offsetY
            return sourceX in 0 until width && sourceY in 0 until height && image.isLabel(sourceX, sourceY, label)
        }
        val top = (0 until width).count { x -> (0 until bandY).any { isSet(x, it) } }
        val bottom = (0 until width).count { x -> (0 until bandY).any { isSet(x, height - 1 - it) } }
        val left = (0 until height).count { y -> (0 until bandX).any { isSet(it, y) } }
        val right = (0 until height).count { y -> (0 until bandX).any { isSet(width - 1 - it, y) } }
        return EdgeContact(
            top = top.toDouble() / width,
            bottom = bottom.toDouble() / width,
            left = left.toDouble() / height,
            right = right.toDouble() / height,
        )
    }

    companion object {
        /** The profile of [label] in [image]; null when the label has no pixel. */
        fun of(
            image: LabelImage,
            label: Int,
        ): MaskProfile? {
            var count = 0
            var minX = image.width
            var maxX = -1
            var minY = image.height
            var maxY = -1
            for (y in 0 until image.height) {
                for (x in 0 until image.width) {
                    if (!image.isLabel(x, y, label)) continue
                    count++
                    minX = min(minX, x)
                    maxX = max(maxX, x)
                    minY = min(minY, y)
                    maxY = max(maxY, y)
                }
            }
            return if (count == 0) null else MaskProfile(image, label, count, minX, maxX, minY, maxY)
        }
    }
}
