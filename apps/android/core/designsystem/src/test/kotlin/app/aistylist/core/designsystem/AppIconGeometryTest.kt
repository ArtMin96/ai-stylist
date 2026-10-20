package app.aistylist.core.designsystem

import androidx.compose.ui.graphics.vector.PathNode
import app.aistylist.core.designsystem.generated.AppIconCommand
import app.aistylist.core.designsystem.generated.AppIconGlyphs
import app.aistylist.core.designsystem.generated.AppIconMetrics
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSegment
import app.aistylist.core.designsystem.generated.AppIconSize
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private const val EPSILON = 1e-9

/** Plain JUnit tests of the C02 icon maths (brief c02-icons, "Rendering maths"). */
class AppIconGeometryTest {
    @Test
    fun `scaling multiplies every point and keeps shapes, paints and commands`() {
        val glyph = AppIconGlyphs.Today.glyph
        val rendered = AppIconSize.XS.size

        val scaled = AppIconGeometry.scaled(glyph, AppIconGeometry.unitScale(rendered))

        val firstCubic = scaled.shapes.flatMap { it.segments }.first { it.command == AppIconCommand.CUBIC }
        assertPoints(listOf(9.5785, 2.5, 10.25, 3.1715, 10.25, 4.0), firstCubic.points)
        assertEquals(glyph.shapes.size, scaled.shapes.size)
        glyph.shapes.zip(scaled.shapes).forEach { (original, result) ->
            assertEquals(original.paint, result.paint)
            assertEquals(original.segments.map { it.command }, result.segments.map { it.command })
        }
    }

    @Test
    fun `the stroke is the step's viewBox stroke scaled to the rendered size`() {
        AppIconSize.entries.forEach { step ->
            assertEquals(
                step.id,
                step.strokeWidth * step.size / AppIconMetrics.viewBox,
                AppIconGeometry.strokeWidth(step, step.size),
                EPSILON,
            )
        }
        assertEquals(1.7, AppIconGeometry.strokeWidth(AppIconSize.LG, AppIconSize.LG.size), EPSILON)
        assertEquals(1.7 * 20 / 24, AppIconGeometry.strokeWidth(AppIconSize.MD, AppIconSize.MD.size), EPSILON)
        assertEquals(1.1, AppIconGeometry.strokeWidth(AppIconSize.XS, AppIconSize.XS.size), EPSILON)
    }

    @Test
    fun `a larger text size grows the stroke with the icon`() {
        assertEquals(2.55, AppIconGeometry.strokeWidth(AppIconSize.LG, renderedSize = 36.0), EPSILON)
    }

    @Test
    fun `every glyph builds at every step and at twice its size`() {
        val renderedSizes = AppIconSize.entries.flatMap { step -> listOf(step.size, step.size * 2) }
        AppIconName.entries.forEach { name ->
            renderedSizes.forEach { rendered -> assertGlyphFits(name, rendered) }
        }
    }

    @Test
    fun `the replay yields one path node per segment, in order, with the scaled points`() {
        val rendered = AppIconSize.XL.size * 2
        AppIconName.entries.forEach { name ->
            val scaled = AppIconGeometry.scaled(name.glyph, AppIconGeometry.unitScale(rendered))
            scaled.shapes.forEach { shape ->
                val nodes = shape.toPathNodes()

                assertEquals(name.id, shape.segments.size, nodes.size)
                shape.segments.zip(nodes).forEach { (segment, node) ->
                    assertEquals(name.id, segment.expectedNode(), node)
                }
            }
        }
    }

    private fun assertGlyphFits(
        name: AppIconName,
        rendered: Double,
    ) {
        val label = "${name.id} $rendered"
        val scaled = AppIconGeometry.scaled(name.glyph, AppIconGeometry.unitScale(rendered))

        assertEquals(label, name.glyph.shapes.size, scaled.shapes.size)
        scaled.shapes.forEach { shape ->
            assertEquals(label, AppIconCommand.MOVE, shape.segments.first().command)
            shape.segments.forEach { segment -> assertSegmentFits(label, segment, rendered) }
        }
    }

    private fun assertSegmentFits(
        label: String,
        segment: AppIconSegment,
        rendered: Double,
    ) {
        val expectedCount =
            when (segment.command) {
                AppIconCommand.MOVE, AppIconCommand.LINE -> 2
                AppIconCommand.CUBIC -> 6
                AppIconCommand.CLOSE -> 0
            }
        assertEquals(label, expectedCount, segment.points.size)
        segment.points.forEach { point ->
            assertTrue("$label: $point", point.isFinite() && point in 0.0..rendered)
        }
    }

    private fun AppIconSegment.expectedNode(): PathNode {
        val p = points.map(Double::toFloat)
        return when (command) {
            AppIconCommand.MOVE -> PathNode.MoveTo(p[0], p[1])
            AppIconCommand.LINE -> PathNode.LineTo(p[0], p[1])
            AppIconCommand.CUBIC -> PathNode.CurveTo(p[0], p[1], p[2], p[3], p[4], p[5])
            AppIconCommand.CLOSE -> PathNode.Close
        }
    }

    private fun assertPoints(
        expected: List<Double>,
        actual: List<Double>,
    ) {
        assertEquals(expected.size, actual.size)
        expected.zip(actual).forEach { (want, got) -> assertEquals(want, got, EPSILON) }
    }
}
