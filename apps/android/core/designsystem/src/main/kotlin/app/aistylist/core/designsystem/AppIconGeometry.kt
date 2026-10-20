package app.aistylist.core.designsystem

import androidx.compose.ui.graphics.vector.PathNode
import app.aistylist.core.designsystem.generated.AppIconCommand
import app.aistylist.core.designsystem.generated.AppIconGlyph
import app.aistylist.core.designsystem.generated.AppIconMetrics
import app.aistylist.core.designsystem.generated.AppIconSegment
import app.aistylist.core.designsystem.generated.AppIconShape
import app.aistylist.core.designsystem.generated.AppIconSize

/**
 * The C02 icon maths (icon.yaml), free of Compose state so plain JUnit reaches it. Every size is
 * the final rendered size in px: the token size after the system font scale.
 */
internal object AppIconGeometry {
    /** How many px one viewBox unit covers at [renderedSize]. */
    fun unitScale(renderedSize: Double): Double = renderedSize / AppIconMetrics.viewBox

    /** The stroke of [step] at [renderedSize]: it is in viewBox units, so it grows with the icon. */
    fun strokeWidth(
        step: AppIconSize,
        renderedSize: Double,
    ): Double = step.strokeWidth * renderedSize / AppIconMetrics.viewBox

    /** [glyph] with every point multiplied by [factor]; shapes, paints and commands keep their order. */
    fun scaled(
        glyph: AppIconGlyph,
        factor: Double,
    ): AppIconGlyph = AppIconGlyph(shapes = glyph.shapes.map { it.scaled(factor) })

    private fun AppIconShape.scaled(factor: Double): AppIconShape = copy(segments = segments.map { it.scaled(factor) })

    private fun AppIconSegment.scaled(factor: Double): AppIconSegment = copy(points = points.map { it * factor })
}

/** This shape as Compose path commands, one per segment, in segment order. */
internal fun AppIconShape.toPathNodes(): List<PathNode> = segments.map(AppIconSegment::toPathNode)

private fun AppIconSegment.toPathNode(): PathNode {
    val p = points.map(Double::toFloat)
    return when (command) {
        AppIconCommand.MOVE -> PathNode.MoveTo(p[0], p[1])
        AppIconCommand.LINE -> PathNode.LineTo(p[0], p[1])
        AppIconCommand.CUBIC -> PathNode.CurveTo(p[0], p[1], p[2], p[3], p[4], p[5])
        AppIconCommand.CLOSE -> PathNode.Close
    }
}
