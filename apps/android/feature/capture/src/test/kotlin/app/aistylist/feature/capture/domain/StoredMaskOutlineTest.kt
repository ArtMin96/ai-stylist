package app.aistylist.feature.capture.domain

import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import javax.imageio.ImageIO

/**
 * The outline on every flat single-item stored mask of `just capture-frames` (the iOS selection; opt-in
 * as on iOS). Set `CAPTURE_FRAMES_DIR` to the frames folder to run it; otherwise it is skipped. Each
 * mask is traced, and
 * the outline must cover that instance's hole-filled largest component with IoU ≥ 0.92 (the static bar
 * of the fixture test; an object lying inside the item leaves a hole the outer outline covers).
 */
class StoredMaskOutlineTest {
    private val framesDir: File? = System.getenv(FRAMES_ENV)?.let(::File)?.takeIf { it.isDirectory }

    @Test
    fun `every stored item mask is outlined with IoU of at least 0_92`() {
        assumeTrue(
            "$FRAMES_ENV is not set to a just capture-frames folder: stored-mask test skipped",
            framesDir != null,
        )
        val ious =
            requireNotNull(framesDir)
                .walkTopDown()
                .filter { it.name == MASK_FILE && FLAT in it.path.substringBeforeLast('/').substringAfterLast('/') }
                .filterNot { File(it.path.substringBeforeLast('/'), INSTANCES_FILE).isFile }
                .mapNotNull(::itemIou)
                .toList()
        assertTrue("no stored masks under $framesDir", ious.isNotEmpty())
        val worst = ious.minBy { it.second }
        println(
            "stored masks: ${ious.size}, IoU min ${worst.second} (${worst.first}), median ${ious
                .map { it.second }
                .sorted()[ious.size / 2]}",
        )
        assertTrue("worst ${worst.first}: ${worst.second}", worst.second >= STATIC_MIN_IOU)
    }

    /** The traced item's IoU with its own instance mask; null for an empty mask. */
    private fun itemIou(file: File): Pair<String, Double>? {
        val image = ImageIO.read(file)
        val raster = image.raster
        val labels =
            ByteArray(image.width * image.height) { raster.getSample(it % image.width, it / image.width, 0).toByte() }
        val isInstances = file.name == INSTANCES_FILE
        val image8 =
            LabelImage(
                image.width,
                image.height,
                ByteArray(labels.size) { if (isInstances || labels[it].toInt() == 0) labels[it] else 1 },
            )
        val item = image8.instances().firstOrNull() ?: return null
        val mask = BooleanArray(labels.size) { image8.isLabel(it % image.width, it / image.width, item.label) }
        val outline = traceOutline(image.width, image.height, mask)?.points ?: return file.path to 0.0
        val filled = filledLargestComponent(image.width, image.height, mask)
        return file.path.substringBeforeLast('/').substringAfterLast('/') to
            polygonMaskIou(outline, image.width, image.height, filled)
    }

    private companion object {
        const val FRAMES_ENV = "CAPTURE_FRAMES_DIR"
        const val MASK_FILE = "frame.mask.png"
        const val FLAT = "-flat-"
        const val INSTANCES_FILE = "frame.instances.png"
        const val STATIC_MIN_IOU = 0.92
    }
}
