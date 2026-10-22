package app.aistylist.feature.capture.domain

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * The live outline's numbers (capture brief "Live outline"). They equal the `params` of the shared
 * parity fixture `tools/capture-frames/parity/outline-parity.json`, which the unit test asserts,
 * until the registry gets an `outline` block.
 */
object OutlineSpec {
    const val CROP_GROW_DIVISOR: Int = 8
    const val CROP_GROW_MIN_PX: Int = 2
    const val LONG_SIDE_PX: Int = 64
    const val FOREGROUND_AT_LEAST: Double = 0.5
    const val EPSILON_PX: Double = 0.5
    const val POINT_COUNT: Int = 64
    const val KEEP_AT_LEAST_IOU: Double = 0.3
    const val SWITCH_AT_AREA_RATIO: Double = 1.5
    const val SNAP_BELOW_IOU: Double = 0.5
    const val EMA_ALPHA: Double = 0.5
    const val CLEAR_AFTER_MISSED_UPDATES: Int = 3
    const val IOU_GRID_CELLS: Int = 64
    const val MIN_OUTLINE_SIZE_PX: Int = 3
}

/** A traced outline: [points] normalised to the frame, clockwise on screen, and the vertex count after simplifying. */
data class OutlineTrace(
    val points: List<NormalizedPoint>,
    val simplifiedVertexCount: Int,
)

/**
 * The outline of a [width] × [height] mask (`true` = item), as the shared reference
 * `outline_reference.py` computes it: crop to the mask's box grown by max(2 px, long side / 8),
 * area-average to a 64 px long side, threshold, keep the largest 8-connected component, marching
 * squares at 0.5, keep the largest loop clockwise, Douglas–Peucker at 0.5 px, resample to 64 points
 * from the top crossing of the vertical through the centroid, and map to the frame. Null when the
 * mask has no foreground.
 */
fun traceOutline(
    width: Int,
    height: Int,
    mask: BooleanArray,
): OutlineTrace? {
    val crop = foregroundCrop(width, height, mask) ?: return null
    val soft = downscale(crop, OutlineSpec.LONG_SIDE_PX)
    val component = largestComponent(soft) ?: return null
    val loops = marchingSquares(paddedField(soft, component))
    if (loops.isEmpty()) return null
    var loop = loops.first()
    for (candidate in loops.drop(1)) {
        if (abs(signedArea(candidate)) > abs(signedArea(loop))) loop = candidate
    }
    if (signedArea(loop) < 0) loop = loop.reversed()
    var simple = douglasPeuckerClosed(loop, OutlineSpec.EPSILON_PX)
    if (simple.size < OutlineSpec.MIN_OUTLINE_SIZE_PX || abs(signedArea(simple)) < AREA_EPSILON) simple = loop
    val points =
        resample(simple, OutlineSpec.POINT_COUNT).map { (x, y) ->
            NormalizedPoint(
                x = (crop.x0 + (x - 1 + HALF) / soft.width * crop.width) / width,
                y = (crop.y0 + (y - 1 + HALF) / soft.height * crop.height) / height,
            )
        }
    return OutlineTrace(points, simple.size)
}

/**
 * Intersection over union of two closed polygons, both rasterised on a 64 × 64 grid over their joint
 * box at the cell centres by the even-odd rule (the measure the snap and the hysteresis read).
 */
fun polygonIou(
    a: List<NormalizedPoint>,
    b: List<NormalizedPoint>,
): Double {
    val all = a + b
    val minX = all.minOf { it.x }
    val maxX = all.maxOf { it.x }
    val minY = all.minOf { it.y }
    val maxY = all.maxOf { it.y }
    if (maxX <= minX || maxY <= minY) return 0.0
    val grid = OutlineSpec.IOU_GRID_CELLS
    val cellWidth = (maxX - minX) / grid
    val cellHeight = (maxY - minY) / grid
    var intersection = 0
    var union = 0
    for (row in 0 until grid) {
        val y = minY + (row + HALF) * cellHeight
        val inA = rowCells(a, y, minX, cellWidth)
        val inB = rowCells(b, y, minX, cellWidth)
        for (cell in 0 until grid) {
            if (inA[cell] && inB[cell]) intersection++
            if (inA[cell] || inB[cell]) union++
        }
    }
    return if (union == 0) 0.0 else intersection.toDouble() / union
}

/** The pixels of a [width] × [height] grid whose centres lie inside [polygon] (even-odd), row-major. */
fun rasterise(
    polygon: List<NormalizedPoint>,
    width: Int,
    height: Int,
): BooleanArray {
    val inside = BooleanArray(width * height)
    for (row in 0 until height) {
        val y = (row + HALF) / height
        val crossings = ArrayList<Double>()
        for (i in polygon.indices) {
            val a = polygon[i]
            val b = polygon[(i + 1) % polygon.size]
            if ((a.y > y) != (b.y > y)) crossings += (a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x)) * width - HALF
        }
        crossings.sort()
        var k = 0
        while (k + 1 < crossings.size) {
            val from = max(0, kotlin.math.ceil(crossings[k]).toInt())
            val until = min(width - 1, kotlin.math.ceil(crossings[k + 1]).toInt() - 1)
            for (column in from..until) inside[row * width + column] = true
            k += 2
        }
    }
    return inside
}

/** IoU of [polygon] with the [mask] pixels that are true, at the mask's resolution. */
fun polygonMaskIou(
    polygon: List<NormalizedPoint>,
    width: Int,
    height: Int,
    mask: BooleanArray,
): Double {
    val inside = rasterise(polygon, width, height)
    var intersection = 0
    var union = 0
    for (i in mask.indices) {
        if (mask[i] && inside[i]) intersection++
        if (mask[i] || inside[i]) union++
    }
    return if (union > 0) intersection.toDouble() / union else 0.0
}

/** [points] cyclically shifted to the least summed squared distance to [reference] (ties: the smallest shift). */
fun alignedTo(
    points: List<NormalizedPoint>,
    reference: List<NormalizedPoint>,
): List<NormalizedPoint> {
    val n = points.size
    var best = Double.MAX_VALUE
    var bestShift = 0
    for (shift in 0 until n) {
        var distance = 0.0
        for (i in 0 until n) {
            val q = points[(i + shift) % n]
            val o = reference[i]
            distance += (q.x - o.x) * (q.x - o.x) + (q.y - o.y) * (q.y - o.y)
        }
        if (distance < best) {
            best = distance
            bestShift = shift
        }
    }
    return List(n) { points[(it + bestShift) % n] }
}

private const val HALF = 0.5
private const val AREA_EPSILON = 1e-9
private const val CENTROID_DIVISOR = 6

/** A point on the downscaled grid (x, y). */
private typealias GridPoint = Pair<Double, Double>

private class Crop(
    val x0: Int,
    val y0: Int,
    val width: Int,
    val height: Int,
    val mask: BooleanArray,
)

private class SoftGrid(
    val width: Int,
    val height: Int,
    val values: DoubleArray,
) {
    operator fun get(
        x: Int,
        y: Int,
    ): Double = values[y * width + x]
}

private fun foregroundCrop(
    width: Int,
    height: Int,
    mask: BooleanArray,
): Crop? {
    var minX = width
    var maxX = -1
    var minY = height
    var maxY = -1
    for (y in 0 until height) {
        for (x in 0 until width) {
            if (!mask[y * width + x]) continue
            minX = min(minX, x)
            maxX = max(maxX, x)
            minY = min(minY, y)
            maxY = max(maxY, y)
        }
    }
    if (maxX < 0) return null
    val longSide = max(maxX + 1 - minX, maxY + 1 - minY)
    val pad = max(OutlineSpec.CROP_GROW_MIN_PX, longSide / OutlineSpec.CROP_GROW_DIVISOR)
    val x0 = max(0, minX - pad)
    val y0 = max(0, minY - pad)
    val x1 = min(width, maxX + 1 + pad)
    val y1 = min(height, maxY + 1 + pad)
    val cropWidth = x1 - x0
    val cropHeight = y1 - y0
    val cropped = BooleanArray(cropWidth * cropHeight) { mask[(y0 + it / cropWidth) * width + x0 + it % cropWidth] }
    return Crop(x0, y0, cropWidth, cropHeight, cropped)
}

/** Round half to even of the exact [numerator] / [denominator] (both ≥ 0, denominator > 0). */
internal fun roundHalfEven(
    numerator: Long,
    denominator: Long,
): Long {
    val quotient = numerator / denominator
    val twiceRemainder = 2 * (numerator % denominator)
    return when {
        twiceRemainder > denominator -> quotient + 1
        twiceRemainder < denominator -> quotient
        quotient % 2 == 0L -> quotient
        else -> quotient + 1
    }
}

/** Area average of the crop to [longSide] px on its long side; cell edges round(i × size / n), half to even. */
private fun downscale(
    crop: Crop,
    longSide: Int,
): SoftGrid {
    val w = crop.width
    val h = crop.height
    val longest = max(w, h).toLong()
    val outHeight = max(OutlineSpec.MIN_OUTLINE_SIZE_PX, roundHalfEven(h.toLong() * longSide, longest).toInt())
    val outWidth = max(OutlineSpec.MIN_OUTLINE_SIZE_PX, roundHalfEven(w.toLong() * longSide, longest).toInt())
    val integral = IntArray((w + 1) * (h + 1))
    for (y in 0 until h) {
        var row = 0
        for (x in 0 until w) {
            if (crop.mask[y * w + x]) row++
            integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row
        }
    }

    fun edge(
        i: Int,
        n: Int,
        size: Int,
    ): Int = roundHalfEven(i.toLong() * size, n.toLong()).toInt()

    fun sum(
        x: Int,
        y: Int,
    ): Int = integral[y * (w + 1) + x]
    val values = DoubleArray(outWidth * outHeight)
    for (r in 0 until outHeight) {
        val y0 = min(edge(r, outHeight, h), h - 1)
        val y1 = max(edge(r + 1, outHeight, h), y0 + 1)
        for (c in 0 until outWidth) {
            val x0 = min(edge(c, outWidth, w), w - 1)
            val x1 = max(edge(c + 1, outWidth, w), x0 + 1)
            val total = sum(x1, y1) - sum(x1, y0) - sum(x0, y1) + sum(x0, y0)
            values[r * outWidth + c] = total.toDouble() / ((y1 - y0) * (x1 - x0))
        }
    }
    return SoftGrid(outWidth, outHeight, values)
}

/** The largest 8-connected component of the grid's foreground (ties: the first found in row-major order). */
private fun largestComponent(soft: SoftGrid): BooleanArray? {
    val foreground = BooleanArray(soft.values.size) { soft.values[it] >= OutlineSpec.FOREGROUND_AT_LEAST }
    val components = ConnectedComponents.of(soft.width, soft.height, foreground)
    var best = 0
    components.sizes.forEachIndexed { index, size ->
        if (size >
            components.sizes.getOrElse(best - 1) { 0 }
        ) {
            best = index + 1
        }
    }
    return if (best == 0) null else BooleanArray(foreground.size) { components.labels[it] == best }
}

/** The soft values inside [component], zero elsewhere, with a one-cell zero border. */
private fun paddedField(
    soft: SoftGrid,
    component: BooleanArray,
): SoftGrid {
    val fieldWidth = soft.width + 2
    val values = DoubleArray(fieldWidth * (soft.height + 2))
    for (r in 0 until soft.height) {
        for (c in 0 until soft.width) {
            if (component[r * soft.width + c]) values[(r + 1) * fieldWidth + c + 1] = soft[c, r]
        }
    }
    return SoftGrid(fieldWidth, soft.height + 2, values)
}

/**
 * Closed iso lines at 0.5. Edges are keyed horizontal before vertical, then by row and column; each
 * loop starts at the smallest unvisited edge, walks to its first neighbour, then on to whichever
 * neighbour it did not come from. Saddles keep the foreground corners joined.
 */
private fun marchingSquares(field: SoftGrid): List<List<GridPoint>> {
    val edges = EdgeGraph(field)
    for (r in 0 until field.height - 1) {
        for (c in 0 until field.width - 1) edges.linkCell(r, c)
    }
    return edges.loops()
}

/** The crossed cell edges of [field] and how they join; edge ids follow the loop order above. */
private class EdgeGraph(
    private val field: SoftGrid,
) {
    private val cells = field.width * field.height
    private val first = IntArray(2 * cells) { NO_EDGE }
    private val last = IntArray(2 * cells) { NO_EDGE }

    private fun horizontal(
        r: Int,
        c: Int,
    ): Int = r * field.width + c

    private fun vertical(
        r: Int,
        c: Int,
    ): Int = cells + r * field.width + c

    private fun isOn(
        c: Int,
        r: Int,
    ): Boolean = field[c, r] >= ISO

    /** Joins the crossed edges of the cell whose top-left corner is ([c], [r]). */
    fun linkCell(
        r: Int,
        c: Int,
    ) {
        val tl = isOn(c, r)
        val tr = isOn(c + 1, r)
        val br = isOn(c + 1, r + 1)
        val bl = isOn(c, r + 1)
        val top = horizontal(r, c)
        val right = vertical(r, c + 1)
        val bottom = horizontal(r + 1, c)
        val left = vertical(r, c)
        val crossed =
            listOfNotNull(
                top.takeIf { tl != tr },
                right.takeIf { tr != br },
                bottom.takeIf { bl != br },
                left.takeIf { tl != bl },
            )
        when {
            crossed.size == 2 -> {
                link(crossed[0], crossed[1])
            }

            crossed.size == SADDLE_EDGES && tl -> {
                link(top, right)
                link(bottom, left)
            }

            crossed.size == SADDLE_EDGES -> {
                link(top, left)
                link(right, bottom)
            }
        }
    }

    fun loops(): List<List<GridPoint>> {
        val seen = BooleanArray(2 * cells)
        val loops = ArrayList<List<GridPoint>>()
        for (start in 0 until 2 * cells) {
            if (first[start] == NO_EDGE || seen[start]) continue
            val loop = ArrayList<GridPoint>()
            var previous = NO_EDGE
            var edge = start
            while (!seen[edge]) {
                seen[edge] = true
                loop += point(edge)
                val next = if (first[edge] == previous) last[edge] else first[edge]
                previous = edge
                edge = next
            }
            if (loop.size >= OutlineSpec.MIN_OUTLINE_SIZE_PX) loops += loop
        }
        return loops
    }

    private fun link(
        a: Int,
        b: Int,
    ) {
        if (first[a] == NO_EDGE) first[a] = b
        last[a] = b
        if (first[b] == NO_EDGE) first[b] = a
        last[b] = a
    }

    private fun point(edge: Int): GridPoint {
        val isVertical = edge >= cells
        val index = edge % cells
        val r = index / field.width
        val c = index % field.width
        val r2 = if (isVertical) r + 1 else r
        val c2 = if (isVertical) c else c + 1
        val va = field[c, r]
        val vb = field[c2, r2]
        val t = if (va == vb) HALF else (ISO - va) / (vb - va)
        return GridPoint(c + t * (c2 - c), r + t * (r2 - r))
    }
}

private const val SADDLE_EDGES = 4
private const val ISO = 0.5
private const val NO_EDGE = -1

private fun signedArea(points: List<GridPoint>): Double {
    var sum = 0.0
    for (i in points.indices) {
        val a = points[i]
        val b = points[(i + 1) % points.size]
        sum += a.first * b.second - b.first * a.second
    }
    return sum / 2
}

/** Douglas–Peucker on a closed loop, split at the vertex farthest from vertex 0 (ties: the first). */
private fun douglasPeuckerClosed(
    points: List<GridPoint>,
    epsilon: Double,
): List<GridPoint> {
    if (points.size < MIN_SPLIT_SIZE) return points
    var far = 0
    var farDistance = -1.0
    val origin = points[0]
    for (i in points.indices) {
        val dx = points[i].first - origin.first
        val dy = points[i].second - origin.second
        val distance = dx * dx + dy * dy
        if (distance > farDistance) {
            far = i
            farDistance = distance
        }
    }
    val firstHalf = douglasPeucker(points.subList(0, far + 1), epsilon)
    val secondHalf = douglasPeucker(points.subList(far, points.size) + points[0], epsilon)
    return firstHalf.dropLast(1) + secondHalf.dropLast(1)
}

private const val MIN_SPLIT_SIZE = 4

private fun douglasPeucker(
    points: List<GridPoint>,
    epsilon: Double,
): List<GridPoint> {
    if (points.size < OutlineSpec.MIN_OUTLINE_SIZE_PX) return points
    val a = points.first()
    val b = points.last()
    val dx = b.first - a.first
    val dy = b.second - a.second
    val length = sqrt(dx * dx + dy * dy)
    var best = -1.0
    var bestIndex = 0
    for (i in 1 until points.size - 1) {
        val q = points[i]
        val distance =
            if (length > 0) {
                abs(dy * q.first - dx * q.second + b.first * a.second - b.second * a.first) / length
            } else {
                val ex = q.first - a.first
                val ey = q.second - a.second
                sqrt(ex * ex + ey * ey)
            }
        if (distance > best) {
            best = distance
            bestIndex = i
        }
    }
    if (best <= epsilon) return listOf(a, b)
    return douglasPeucker(points.subList(0, bestIndex + 1), epsilon).dropLast(1) +
        douglasPeucker(points.subList(bestIndex, points.size), epsilon)
}

/** Arc length where the vertical through the area centroid meets the contour at its smallest y. */
private fun topRayAnchor(
    points: List<GridPoint>,
    cumulative: DoubleArray,
): Double {
    val area2 = signedArea(points)
    if (abs(area2) < AREA_EPSILON) return 0.0
    var cx = 0.0
    for (i in points.indices) {
        val a = points[i]
        val b = points[(i + 1) % points.size]
        cx += (a.first + b.first) * (a.first * b.second - b.first * a.second)
    }
    cx /= CENTROID_DIVISOR * area2
    var bestY = Double.MAX_VALUE
    var bestS: Double? = null
    for (i in points.indices) {
        val a = points[i]
        val b = points[(i + 1) % points.size]
        if ((a.first - cx) * (b.first - cx) <= 0 && a.first != b.first) {
            val t = (cx - a.first) / (b.first - a.first)
            val y = a.second + t * (b.second - a.second)
            if (bestS == null || y < bestY) {
                bestY = y
                bestS = cumulative[i] + t * (cumulative[i + 1] - cumulative[i])
            }
        }
    }
    return bestS ?: 0.0
}

private fun resample(
    points: List<GridPoint>,
    count: Int,
): List<GridPoint> {
    val m = points.size
    val cumulative = DoubleArray(m + 1)
    for (i in 0 until m) {
        val a = points[i]
        val b = points[(i + 1) % m]
        val dx = b.first - a.first
        val dy = b.second - a.second
        cumulative[i + 1] = cumulative[i] + sqrt(dx * dx + dy * dy)
    }
    val total = cumulative[m]
    val start = topRayAnchor(points, cumulative)
    var j = 0
    return List(count) { k ->
        var s = (start + total * k / count).rem(total)
        if (s < 0) s += total
        var guard = 0
        while (!(cumulative[j] <= s && s < cumulative[j + 1]) && guard <= m) {
            j = (j + 1) % m
            guard++
        }
        val span = cumulative[j + 1] - cumulative[j]
        val t = if (span > 0) (s - cumulative[j]) / span else 0.0
        val a = points[j]
        val b = points[(j + 1) % m]
        GridPoint(a.first + t * (b.first - a.first), a.second + t * (b.second - a.second))
    }
}

/** The grid cells of one IoU row whose centre lies inside [polygon] at height [y] (even-odd). */
private fun rowCells(
    polygon: List<NormalizedPoint>,
    y: Double,
    minX: Double,
    cellWidth: Double,
): BooleanArray {
    val crossings = ArrayList<Double>()
    for (i in polygon.indices) {
        val a = polygon[i]
        val b = polygon[(i + 1) % polygon.size]
        if ((a.y > y) != (b.y > y)) crossings += a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x)
    }
    crossings.sort()
    val inside = BooleanArray(OutlineSpec.IOU_GRID_CELLS)
    var k = 0
    while (k + 1 < crossings.size) {
        for (cell in 0 until OutlineSpec.IOU_GRID_CELLS) {
            val x = minX + (cell + HALF) * cellWidth
            if (crossings[k] <= x && x < crossings[k + 1]) inside[cell] = true
        }
        k += 2
    }
    return inside
}
