package app.aistylist.feature.capture.analysis

import app.aistylist.contracts.kernel.CaptureRules
import app.aistylist.feature.capture.domain.LightSample
import app.aistylist.feature.capture.domain.NormalizedRect
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * One frame's luma (0–255), row-major, top-left origin. The camera fills it from the Y plane of an
 * `ImageProxy`, the test-frame source and imported stills from Rec. 601 luma of a bitmap, so every
 * source is measured by the same code (capture brief §3).
 */
class LumaPlane(
    val width: Int,
    val height: Int,
    private val values: FloatArray,
) {
    init {
        require(width > 0 && height > 0 && values.size == width * height) { "luma plane size mismatch" }
    }

    fun at(
        x: Int,
        y: Int,
    ): Float = values[y * width + x]

    /** Mean luma and the share of pixels at or above the clipped luma (too-dark and too-bright hints). */
    fun light(): LightSample {
        var sum = 0.0
        var clipped = 0
        for (value in values) {
            sum += value
            if (value >= CaptureRules.Light.CLIPPED_MIN_LUMA) clipped++
        }
        return LightSample(meanLuma = sum / values.size, clippedShare = clipped.toDouble() / values.size)
    }

    /**
     * The steady-check sharpness: luma scaled (area average) so the long side is the rules' sharpness
     * size, then the variance of the 4-neighbour 3×3 Laplacian over the pixels inside [box]; 0 when the
     * box holds no inner pixel.
     */
    fun sharpness(box: NormalizedRect): Double {
        val small = scaledToLongSide(CaptureRules.Steady.SHARPNESS_LONG_SIDE_PX)
        val left = box.left.coerceIn(0.0, 1.0)
        val top = box.top.coerceIn(0.0, 1.0)
        val right = box.right.coerceIn(0.0, 1.0)
        val bottom = box.bottom.coerceIn(0.0, 1.0)
        val minX = max(1, (left * small.width).toInt())
        val maxX = min(small.width - 2, kotlin.math.ceil(right * small.width).toInt() - 1)
        val minY = max(1, (top * small.height).toInt())
        val maxY = min(small.height - 2, kotlin.math.ceil(bottom * small.height).toInt() - 1)
        if (maxX < minX || maxY < minY) return 0.0
        var sum = 0.0
        var sumOfSquares = 0.0
        var count = 0
        for (y in minY..maxY) {
            for (x in minX..maxX) {
                val laplacian =
                    small.at(x - 1, y) + small.at(x + 1, y) + small.at(x, y - 1) + small.at(x, y + 1) -
                        4 * small.at(x, y)
                sum += laplacian
                sumOfSquares += laplacian.toDouble() * laplacian
                count++
            }
        }
        val mean = sum / count
        return sumOfSquares / count - mean * mean
    }

    /** This plane averaged down so its long side is [longSide] (unchanged when already that small). */
    fun scaledToLongSide(longSide: Int): LumaPlane {
        val scale = longSide.toDouble() / max(width, height)
        if (scale >= 1.0) return this
        val newWidth = max(3, (width * scale).roundToInt())
        val newHeight = max(3, (height * scale).roundToInt())
        val out = FloatArray(newWidth * newHeight)
        for (y in 0 until newHeight) {
            val y0 = y * height / newHeight
            val y1 = max(y0 + 1, (y + 1) * height / newHeight)
            for (x in 0 until newWidth) {
                val x0 = x * width / newWidth
                val x1 = max(x0 + 1, (x + 1) * width / newWidth)
                var sum = 0f
                for (sy in y0 until y1) for (sx in x0 until x1) sum += values[sy * width + sx]
                out[y * newWidth + x] = sum / ((y1 - y0) * (x1 - x0))
            }
        }
        return LumaPlane(newWidth, newHeight, out)
    }

    /** This plane turned clockwise by [degrees] (0, 90, 180 or 270): the camera's sensor frame made upright. */
    fun rotated(degrees: Int): LumaPlane =
        when (normalizedDegrees(degrees)) {
            0 -> this
            90 -> LumaPlane(height, width, FloatArray(values.size) { i -> at(i / height, height - 1 - i % height) })
            180 -> LumaPlane(width, height, FloatArray(values.size) { i -> values[values.size - 1 - i] })
            else -> LumaPlane(height, width, FloatArray(values.size) { i -> at(width - 1 - i / height, i % height) })
        }

    companion object {
        /** Rec. 601 luma of packed ARGB pixels (an Android `Bitmap.getPixels` array). */
        fun fromArgb(
            width: Int,
            height: Int,
            argb: IntArray,
        ): LumaPlane = LumaPlane(width, height, FloatArray(argb.size) { i -> rec601(argb[i]) })

        /**
         * The Y plane of a camera frame: [rowStride] bytes per row, [pixelStride] bytes per pixel,
         * read from [bytes] (unsigned).
         */
        fun fromYPlane(
            width: Int,
            height: Int,
            bytes: ByteArray,
            rowStride: Int,
            pixelStride: Int,
        ): LumaPlane =
            LumaPlane(
                width,
                height,
                FloatArray(width * height) { i ->
                    (bytes[(i / width) * rowStride + (i % width) * pixelStride].toInt() and BYTE_MASK).toFloat()
                },
            )

        private const val BYTE_MASK = 0xFF
        private const val RED_SHIFT = 16
        private const val GREEN_SHIFT = 8
        private const val RED_WEIGHT = 0.299f
        private const val GREEN_WEIGHT = 0.587f
        private const val BLUE_WEIGHT = 0.114f

        private fun rec601(argb: Int): Float =
            RED_WEIGHT * (argb shr RED_SHIFT and BYTE_MASK) +
                GREEN_WEIGHT * (argb shr GREEN_SHIFT and BYTE_MASK) +
                BLUE_WEIGHT * (argb and BYTE_MASK)
    }
}

private const val FULL_TURN = 360
private const val RIGHT_ANGLE = 90

private fun normalizedDegrees(degrees: Int): Int =
    ((degrees % FULL_TURN + FULL_TURN) % FULL_TURN) / RIGHT_ANGLE * RIGHT_ANGLE

/**
 * Maps a box from a sensor frame of [width] × [height] pixels, turned clockwise by [rotationDegrees]
 * to be upright, into the upright frame's 0–1 space (capture brief §3: portrait, top-left origin).
 * Detectors that already report upright coordinates pass 0.
 */
fun uprightBox(
    left: Float,
    top: Float,
    right: Float,
    bottom: Float,
    width: Int,
    height: Int,
    rotationDegrees: Int,
): NormalizedRect {
    val l = (left / width).toDouble()
    val t = (top / height).toDouble()
    val r = (right / width).toDouble()
    val b = (bottom / height).toDouble()
    return when (normalizedDegrees(rotationDegrees)) {
        0 -> NormalizedRect(l, t, r, b)
        90 -> NormalizedRect(1 - b, l, 1 - t, r)
        180 -> NormalizedRect(1 - r, 1 - b, 1 - l, 1 - t)
        else -> NormalizedRect(t, 1 - r, b, 1 - l)
    }.clamped()
}

/** [this] box clipped to the frame (0–1); detector boxes may reach past an edge. */
fun NormalizedRect.clamped(): NormalizedRect {
    val l = left.coerceIn(0.0, 1.0)
    val t = top.coerceIn(0.0, 1.0)
    return NormalizedRect(l, t, right.coerceIn(l, 1.0), bottom.coerceIn(t, 1.0))
}
