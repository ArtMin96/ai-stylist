package app.aistylist.feature.capture.domain

/**
 * The 8-connected components of a foreground grid: [labels] holds 1, 2, … in the order the
 * components are first met in row-major order (0 is background), and [sizes] their pixel counts by
 * label − 1. Shared by the segmenter's instances and the outline's largest-component step.
 */
class ConnectedComponents private constructor(
    val labels: IntArray,
    val sizes: List<Int>,
) {
    companion object {
        fun of(
            width: Int,
            height: Int,
            foreground: BooleanArray,
        ): ConnectedComponents {
            val labels = IntArray(width * height)
            val sizes = ArrayList<Int>()
            val stack = IntArray(width * height)
            for (start in labels.indices) {
                if (foreground[start] && labels[start] == 0) {
                    sizes += fill(Grid(width, height, foreground, labels, stack), start, sizes.size + 1)
                }
            }
            return ConnectedComponents(labels, sizes)
        }

        private class Grid(
            val width: Int,
            val height: Int,
            val foreground: BooleanArray,
            val labels: IntArray,
            val stack: IntArray,
        )

        /** Labels the component of [start] with [label] (depth-first); returns its size. */
        private fun fill(
            grid: Grid,
            start: Int,
            label: Int,
        ): Int {
            var top = 0
            grid.stack[top++] = start
            grid.labels[start] = label
            var size = 0
            while (top > 0) {
                val index = grid.stack[--top]
                size++
                for (next in neighbours(grid, index)) {
                    if (grid.foreground[next] && grid.labels[next] == 0) {
                        grid.labels[next] = label
                        grid.stack[top++] = next
                    }
                }
            }
            return size
        }

        /** The up to eight in-grid neighbours of [index]. */
        private fun neighbours(
            grid: Grid,
            index: Int,
        ): List<Int> {
            val x = index % grid.width
            val y = index / grid.width
            val result = ArrayList<Int>(NEIGHBOURS)
            for (dy in -1..1) {
                for (dx in -1..1) {
                    val nx = x + dx
                    val ny = y + dy
                    if ((dx != 0 || dy != 0) && nx in 0 until grid.width && ny in 0 until grid.height) {
                        result += ny * grid.width + nx
                    }
                }
            }
            return result
        }

        private const val NEIGHBOURS = 8
    }
}
