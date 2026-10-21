package app.aistylist.core.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import kotlin.math.max
import kotlin.math.min

/** The WCAG 2.x flare term added to both luminances in the contrast ratio. */
private const val WCAG_FLARE = 0.05

/**
 * The WCAG 2.x contrast ratio of [first] and [second], 1 to 21. `Color.luminance()` is the WCAG
 * relative luminance: 0.2126 R + 0.7152 G + 0.0722 B on linear sRGB.
 */
internal fun contrastRatio(
    first: Color,
    second: Color,
): Double {
    val a = first.luminance().toDouble()
    val b = second.luminance().toDouble()
    return (max(a, b) + WCAG_FLARE) / (min(a, b) + WCAG_FLARE)
}

/** Whether a swatch needs its edge: its contrast with the chip's [fill] is below [minContrast]. */
internal fun needsSwatchEdge(
    swatch: Color,
    fill: Color,
    minContrast: Double,
): Boolean = contrastRatio(swatch, fill) < minContrast
