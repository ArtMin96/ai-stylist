package app.aistylist.feature.capture.domain

/**
 * The largest 8-connected component of a [width] × [height] mask with its holes filled: the area an
 * outline (outer loop only) can trace, so the static IoU bar is measured against it.
 */
internal fun filledLargestComponent(
    width: Int,
    height: Int,
    pixels: BooleanArray,
): BooleanArray {
    val components = ConnectedComponents.of(width, height, pixels)
    if (components.sizes.isEmpty()) return BooleanArray(pixels.size)
    val largest = components.sizes.indices.maxBy { components.sizes[it] } + 1
    val isItem = BooleanArray(pixels.size) { components.labels[it] == largest }
    val outside = BooleanArray(pixels.size)
    val stack = ArrayDeque<Int>()
    pixels.indices.filter { isBorder(it, width, height) && !isItem[it] }.forEach {
        outside[it] = true
        stack += it
    }
    while (stack.isNotEmpty()) {
        fourNeighbours(stack.removeLast(), width, height).filter { !outside[it] && !isItem[it] }.forEach {
            outside[it] = true
            stack += it
        }
    }
    return BooleanArray(pixels.size) { !outside[it] }
}

private fun isBorder(
    index: Int,
    width: Int,
    height: Int,
): Boolean {
    val x = index % width
    val y = index / width
    return x == 0 || y == 0 || x == width - 1 || y == height - 1
}

private fun fourNeighbours(
    index: Int,
    width: Int,
    height: Int,
): List<Int> {
    val x = index % width
    val y = index / width
    return listOf(x - 1 to y, x + 1 to y, x to y - 1, x to y + 1)
        .filter { (nx, ny) -> nx in 0 until width && ny in 0 until height }
        .map { (nx, ny) -> ny * width + nx }
}
