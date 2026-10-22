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
            val grid = Grid(width, height, foreground, labels, IntArray(width * height))
            for (start in labels.indices) {
                if (foreground[start] && labels[start] == 0) sizes += fill(grid, start, sizes.size + 1)
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
                val x = index % grid.width
                val y = index / grid.width
                for (direction in 0 until NEIGHBOURS) {
                    top = push(grid, x + DX[direction], y + DY[direction], label, top)
                }
            }
            return size
        }

        /** Labels and stacks ([x], [y]) when it is an unlabelled foreground pixel; returns the new stack top. */
        private fun push(
            grid: Grid,
            x: Int,
            y: Int,
            label: Int,
            top: Int,
        ): Int {
            if (x !in 0 until grid.width || y !in 0 until grid.height) return top
            val next = y * grid.width + x
            if (!grid.foreground[next] || grid.labels[next] != 0) return top
            grid.labels[next] = label
            grid.stack[top] = next
            return top + 1
        }

        private val DX = intArrayOf(-1, 0, 1, -1, 1, -1, 0, 1)
        private val DY = intArrayOf(-1, -1, -1, 0, 0, 1, 1, 1)
        private const val NEIGHBOURS = 8
    }
}
