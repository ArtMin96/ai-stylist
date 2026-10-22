package app.aistylist.feature.capture.domain

import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * The live outline's quality bars (capture brief "Live outline"), on the real masks of the shared
 * parity fixture (`just capture-frames` Vision masks, reduced 4 × 4; jitter and noise run on them
 * scaled back to the 480 × 640 frame, so one pixel is a frame pixel):
 * - static: the polygon covers the hole-filled item mask with IoU ≥ 0.92;
 * - jitter: under playback jitter (offsets up to 0.06 of the frame) at the mask cadence, successive
 *   drawn outlines keep their shape: centroid-aligned IoU ≥ 0.95;
 * - noise: a still item with 1 px of noise per mask (shift, dilate or erode) moves the drawn outline
 *   by a normalised Hausdorff median ≤ 0.01 and p95 ≤ 0.04;
 * - an empty frame has no outline.
 */
class OutlineQualityTest {
    private val realMasks: List<Mask> =
        loadParityFixture()
            .getValue("contour")
            .jsonArray
            .map { it.jsonObject }
            .filter { it.string("name").startsWith("real-") }
            .map { Mask(it.string("name"), it.int("width"), it.int("height"), it.mask()) }

    private class Mask(
        val name: String,
        val width: Int,
        val height: Int,
        val pixels: BooleanArray,
    ) {
        fun shifted(
            dx: Int,
            dy: Int,
        ): Mask = Mask(name, width, height, BooleanArray(pixels.size) { at(it % width - dx, it / width - dy) })

        fun dilated(): Mask = Mask(name, width, height, BooleanArray(pixels.size) { any3x3(it) { inside -> inside } })

        fun eroded(): Mask = Mask(name, width, height, BooleanArray(pixels.size) { !any3x3(it) { inside -> !inside } })

        fun at(
            x: Int,
            y: Int,
        ): Boolean = x in 0 until width && y in 0 until height && pixels[y * width + x]

        private fun any3x3(
            index: Int,
            test: (Boolean) -> Boolean,
        ): Boolean {
            val x = index % width
            val y = index / width
            return (-1..1).any { dy -> (-1..1).any { dx -> test(at(x + dx, y + dy)) } }
        }

        fun outline(): List<NormalizedPoint>? = traceOutline(width, height, pixels)?.points

        /** Back to the analysis frame's size: the fixture stores the masks reduced 4 × 4. */
        fun atFrameSize(): Mask {
            val factor = FIXTURE_REDUCTION
            val w = width * factor
            return Mask(
                name,
                w,
                height * factor,
                BooleanArray(w * height * factor) {
                    at(
                        it % w / factor,
                        it / w / factor,
                    )
                },
            )
        }
    }

    /** Frame-size masks of uncut items: playback jitter moves a cut-off item's clipped part, by design. */
    private val stillItems: List<Mask> by lazy { realMasks.filterNot { "-cut-" in it.name }.map { it.atFrameSize() } }

    @Test
    fun `the fixture holds the real masks`() {
        assertEquals(REAL_MASK_COUNT, realMasks.size)
    }

    @Test
    fun `a traced outline covers the stored mask with IoU of at least 0_92`() {
        realMasks.forEach { mask ->
            val outline = requireNotNull(mask.outline()) { mask.name }
            val iou = rasterIou(outline, filledLargestComponent(mask), mask.width, mask.height)
            assertTrue("${mask.name}: IoU $iou", iou >= STATIC_MIN_IOU)
        }
    }

    @Test
    fun `under playback jitter successive outlines keep their shape`() {
        val random = Random(JITTER_SEED)
        stillItems.forEach { mask ->
            var tracker = OutlineTracker()
            var previous: List<NormalizedPoint>? = null
            val ious = ArrayList<Double>()
            repeat(UPDATES) {
                val dx = (random.nextDouble(-MAX_JITTER, MAX_JITTER) * mask.width).roundToInt()
                val dy = (random.nextDouble(-MAX_JITTER, MAX_JITTER) * mask.height).roundToInt()
                tracker = tracker.update(listOfNotNull(mask.shifted(dx, dy).candidate()))
                val drawn = requireNotNull(tracker.drawn) { mask.name }
                previous?.let { ious += polygonIou(centred(drawn), centred(it)) }
                previous = drawn
            }
            val worst = ious.min()
            assertTrue("${mask.name}: worst centroid-aligned IoU $worst", worst >= JITTER_MIN_IOU)
        }
    }

    @Test
    fun `one pixel of noise barely moves a still outline`() {
        val random = Random(NOISE_SEED)
        val distances = ArrayList<Double>()
        stillItems.forEach { mask ->
            var tracker = OutlineTracker()
            var previous: List<NormalizedPoint>? = null
            repeat(UPDATES) {
                val moved = mask.shifted(random.nextInt(-1, 2), random.nextInt(-1, 2))
                val noisy =
                    when (random.nextInt(NOISE_KINDS)) {
                        0 -> moved.dilated()
                        1 -> moved.eroded()
                        else -> moved
                    }
                tracker = tracker.update(listOfNotNull(noisy.candidate()))
                val drawn = requireNotNull(tracker.drawn) { mask.name }
                previous?.let { distances += hausdorff(drawn, it) }
                previous = drawn
            }
        }
        distances.sort()
        val median = distances[distances.size / 2]
        val p95 = distances[(distances.size * P95).toInt()]
        assertTrue("median Hausdorff $median", median <= NOISE_MAX_MEDIAN)
        assertTrue("p95 Hausdorff $p95", p95 <= NOISE_MAX_P95)
    }

    @Test
    fun `the first outline and every jump count as snaps, blends do not`() {
        val mask = realMasks.first { "-cut-" !in it.name }.atFrameSize()
        val first = OutlineTracker().update(listOfNotNull(mask.candidate()))
        val blended = first.update(listOfNotNull(mask.shifted(2, 2).candidate()))
        val jumped = blended.update(listOfNotNull(mask.shifted(mask.width / 2, 0).candidate()))

        assertEquals(1, first.snapCount)
        assertEquals(1, blended.snapCount)
        assertEquals(2, jumped.snapCount)
    }

    @Test
    fun `the polygon-to-mask IoU of a traced outline is high on the raw mask`() {
        stillItems.forEach { mask ->
            val iou = polygonMaskIou(requireNotNull(mask.outline()), mask.width, mask.height, mask.pixels)
            assertTrue("${mask.name}: IoU $iou", iou >= STATIC_MIN_IOU)
        }
    }

    @Test
    fun `an empty frame gives no outline`() {
        val empty = LabelImage(EMPTY_SIZE, EMPTY_SIZE, ByteArray(EMPTY_SIZE * EMPTY_SIZE))

        assertNull(traceOutline(EMPTY_SIZE, EMPTY_SIZE, BooleanArray(EMPTY_SIZE * EMPTY_SIZE)))
        assertTrue(MaskAnalysis(empty).at(0).outlineCandidates.isEmpty())
        assertNull(OutlineTracker().update(emptyList()).drawn)
    }

    private fun Mask.candidate(): OutlineCandidate? =
        outline()?.let { OutlineCandidate(pixels.count { on -> on }.toDouble() / pixels.size, it) }

    /** The largest 8-connected component of [mask] with its holes filled (what an outline can trace). */
    private fun filledLargestComponent(mask: Mask): BooleanArray {
        val components = ConnectedComponents.of(mask.width, mask.height, mask.pixels)
        val largest = components.sizes.indices.maxBy { components.sizes[it] } + 1
        val isItem = BooleanArray(mask.pixels.size) { components.labels[it] == largest }
        val outside = BooleanArray(mask.pixels.size)
        val stack = ArrayDeque<Int>()
        mask.pixels.indices.filter { mask.isBorder(it) && !isItem[it] }.forEach {
            outside[it] = true
            stack += it
        }
        while (stack.isNotEmpty()) {
            mask.fourNeighbours(stack.removeLast()).filter { !outside[it] && !isItem[it] }.forEach {
                outside[it] = true
                stack += it
            }
        }
        return BooleanArray(mask.pixels.size) { !outside[it] }
    }

    private fun Mask.isBorder(index: Int): Boolean {
        val x = index % width
        val y = index / width
        return x == 0 || y == 0 || x == width - 1 || y == height - 1
    }

    private fun Mask.fourNeighbours(index: Int): List<Int> {
        val x = index % width
        val y = index / width
        return listOf(x - 1 to y, x + 1 to y, x to y - 1, x to y + 1)
            .filter { (nx, ny) -> nx in 0 until width && ny in 0 until height }
            .map { (nx, ny) -> ny * width + nx }
    }

    /** IoU of [polygon] (pixel centres inside, even-odd) and [filled], at the mask's resolution. */
    private fun rasterIou(
        polygon: List<NormalizedPoint>,
        filled: BooleanArray,
        width: Int,
        height: Int,
    ): Double {
        var intersection = 0
        var union = 0
        for (i in filled.indices) {
            val inside = contains(polygon, (i % width + HALF) / width, (i / width + HALF) / height)
            if (inside && filled[i]) intersection++
            if (inside || filled[i]) union++
        }
        return intersection.toDouble() / union
    }

    private fun contains(
        polygon: List<NormalizedPoint>,
        x: Double,
        y: Double,
    ): Boolean {
        var inside = false
        polygon.indices.forEach { i ->
            val a = polygon[i]
            val b = polygon[(i + 1) % polygon.size]
            if ((a.y > y) != (b.y > y) && x < a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x)) inside = !inside
        }
        return inside
    }

    private fun centred(points: List<NormalizedPoint>): List<NormalizedPoint> {
        val cx = points.sumOf { it.x } / points.size
        val cy = points.sumOf { it.y } / points.size
        return points.map { NormalizedPoint(it.x - cx + HALF, it.y - cy + HALF) }
    }

    private fun hausdorff(
        a: List<NormalizedPoint>,
        b: List<NormalizedPoint>,
    ): Double = maxOf(directed(a, b), directed(b, a))

    private fun directed(
        from: List<NormalizedPoint>,
        to: List<NormalizedPoint>,
    ): Double = from.maxOf { p -> to.minOf { q -> hypot(p.x - q.x, p.y - q.y) } }

    private companion object {
        const val REAL_MASK_COUNT = 4
        const val FIXTURE_REDUCTION = 4
        const val STATIC_MIN_IOU = 0.92
        const val JITTER_MIN_IOU = 0.95
        const val NOISE_MAX_MEDIAN = 0.01
        const val NOISE_MAX_P95 = 0.04
        const val MAX_JITTER = 0.06
        const val UPDATES = 24
        const val JITTER_SEED = 11
        const val NOISE_SEED = 7
        const val NOISE_KINDS = 3
        const val P95 = 0.95
        const val HALF = 0.5
        const val EMPTY_SIZE = 32
    }
}
