package app.aistylist.feature.capture.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Rect
import android.util.Log
import androidx.core.graphics.scale
import app.aistylist.feature.capture.domain.LabelImage
import app.aistylist.feature.capture.domain.NormalizedRect
import org.tensorflow.lite.Interpreter
import java.io.Closeable
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The garment segmenter (docs/adr/0013-on-device-garment-outline-android.md): U²-Netp with float16
 * weights through LiteRT 1.4.2 on the CPU (XNNPACK). It turns an upright frame into a foreground
 * mask: the frame is stretched to the model's square input, normalised the way U²-Net was trained
 * (divided by its brightest channel value, then the ImageNet mean and deviation), and each output
 * probability above 0.5 is foreground (raw, no min-max stretch). Runs on the phone only; nothing
 * leaves it. Not thread-safe: one caller thread.
 */
class LiteRtGarmentSegmenter private constructor(
    private val interpreter: Interpreter,
) : Closeable {
    private val size = interpreter.getInputTensor(0).shape()[1]
    private val input = ByteBuffer.allocateDirect(FLOAT_BYTES * size * size * CHANNELS).order(ByteOrder.nativeOrder())
    private val output = ByteBuffer.allocateDirect(FLOAT_BYTES * size * size).order(ByteOrder.nativeOrder())
    private val pixels = IntArray(size * size)

    /**
     * The foreground of [bitmap] as labelled 8-connected components (largest first), at the bitmap's
     * size. A small item (mask box under [SMALL_ITEM_AREA_SHARE] of the frame) is segmented again on
     * a crop twice its box, so the model sees it at twice the scale ([refinesSmallItems] off: one
     * pass, for the harness's measurement of the crop).
     */
    fun segment(
        bitmap: Bitmap,
        refinesSmallItems: Boolean = true,
    ): Segmentation {
        val width = bitmap.width
        val height = bitmap.height
        val whole = Rect(0, 0, width, height)
        val mask = BooleanArray(width * height)
        val started = System.nanoTime()
        paint(bitmap, whole, mask)
        val first = LabelImage.components(width, height, mask).instances().firstOrNull()
        var refined = false
        if (refinesSmallItems && first != null && first.box.areaShare < SMALL_ITEM_AREA_SHARE) {
            // Only the crop is segmented again; the rest keeps the first pass (a second item stays).
            val crop = grownCrop(first.box, width, height)
            for (y in crop.top until crop.bottom) mask.fill(false, y * width + crop.left, y * width + crop.right)
            paint(bitmap, crop, mask)
            refined = true
        }
        val inferenceMs = (System.nanoTime() - started) / NANOS_PER_MS
        return Segmentation(LabelImage.components(width, height, mask), inferenceMs, refined)
    }

    override fun close() = interpreter.close()

    /** Runs the model on [region] of [bitmap] and marks its foreground pixels in [mask] (bitmap size). */
    private fun paint(
        bitmap: Bitmap,
        region: Rect,
        mask: BooleanArray,
    ) {
        val cropped = Bitmap.createBitmap(bitmap, region.left, region.top, region.width(), region.height())
        val scaled = cropped.scale(size, size)
        scaled.getPixels(pixels, 0, size, 0, 0, size, size)
        var brightest = 1
        for (pixel in pixels) brightest = max(brightest, max(red(pixel), max(green(pixel), blue(pixel))))
        input.rewind()
        for (pixel in pixels) {
            input.putFloat((red(pixel).toFloat() / brightest - MEAN[0]) / STD[0])
            input.putFloat((green(pixel).toFloat() / brightest - MEAN[1]) / STD[1])
            input.putFloat((blue(pixel).toFloat() / brightest - MEAN[2]) / STD[2])
        }
        input.rewind()
        output.rewind()
        interpreter.runForMultipleInputsOutputs(arrayOf(input), mapOf(0 to output))
        output.rewind()
        val probabilities = output.asFloatBuffer()
        val width = bitmap.width
        for (y in region.top until region.bottom) {
            val row = min(size - 1, (y - region.top) * size / region.height())
            for (x in region.left until region.right) {
                val column = min(size - 1, (x - region.left) * size / region.width())
                if (probabilities[row * size + column] > FOREGROUND_ABOVE) mask[y * width + x] = true
            }
        }
    }

    /** One segmented frame: the components, the model time (both passes) and whether the crop pass ran. */
    class Segmentation(
        val labels: LabelImage,
        val inferenceMs: Long,
        val isRefined: Boolean,
    )

    companion object {
        /** The model in the capture module's assets (tools/capture-segmenter/convert.sh). */
        const val MODEL_ASSET: String = "capture-segmenter/u2netp-224-fp16.tflite"

        /** Below this mask-box share of the frame the item is segmented again at twice the scale. */
        const val SMALL_ITEM_AREA_SHARE: Double = 0.10

        private const val TAG = "CaptureSegmenter"
        private const val THREADS = 4
        private const val FLOAT_BYTES = 4
        private const val CHANNELS = 3
        private const val FOREGROUND_ABOVE = 0.5f
        private const val NANOS_PER_MS = 1_000_000L
        private const val CROP_SCALE = 2.0
        private val MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
        private val STD = floatArrayOf(0.229f, 0.224f, 0.225f)

        /**
         * Loads the model; null when it cannot load (missing asset, unsupported device), so the camera
         * falls back to ML Kit object boxes (doc-10 fallback). Blocking: call it off the main thread.
         */
        fun load(context: Context): LiteRtGarmentSegmenter? =
            try {
                val bytes = context.assets.open(MODEL_ASSET).use { it.readBytes() }
                val model = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes)
                model.rewind()
                LiteRtGarmentSegmenter(Interpreter(model, Interpreter.Options().setNumThreads(THREADS)))
            } catch (error: IOException) {
                Log.w(TAG, "garment segmenter unavailable, using object boxes", error)
                null
            } catch (error: IllegalArgumentException) {
                // LiteRT reports a model or native-library problem this way.
                Log.w(TAG, "garment segmenter unavailable, using object boxes", error)
                null
            } catch (error: UnsatisfiedLinkError) {
                Log.w(TAG, "garment segmenter unavailable, using object boxes", error)
                null
            }

        /** [box] grown to [CROP_SCALE] times its size around its centre, clipped to the frame. */
        private fun grownCrop(
            box: NormalizedRect,
            width: Int,
            height: Int,
        ): Rect {
            val halfWidth = box.width * CROP_SCALE / 2
            val halfHeight = box.height * CROP_SCALE / 2
            val left = ((box.centerX - halfWidth) * width).roundToInt().coerceIn(0, width - 1)
            val top = ((box.centerY - halfHeight) * height).roundToInt().coerceIn(0, height - 1)
            val right = ((box.centerX + halfWidth) * width).roundToInt().coerceIn(left + 1, width)
            val bottom = ((box.centerY + halfHeight) * height).roundToInt().coerceIn(top + 1, height)
            return Rect(left, top, right, bottom)
        }

        private fun red(pixel: Int): Int = pixel shr RED_SHIFT and CHANNEL_MASK

        private fun green(pixel: Int): Int = pixel shr GREEN_SHIFT and CHANNEL_MASK

        private fun blue(pixel: Int): Int = pixel and CHANNEL_MASK

        private const val RED_SHIFT = 16
        private const val GREEN_SHIFT = 8
        private const val CHANNEL_MASK = 0xFF
    }
}
