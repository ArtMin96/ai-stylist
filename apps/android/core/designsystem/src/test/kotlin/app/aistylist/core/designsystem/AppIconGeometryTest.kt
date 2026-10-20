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

// PathNode holds Float; one float ulp near 10 is about 1e-6.
private const val FLOAT_EPSILON = 1e-5f

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

    @Test
    fun `the Today glyph's first cubic replays with its literal control and end points at xs`() {
        val scaled = AppIconGeometry.scaled(AppIconGlyphs.Today.glyph, AppIconGeometry.unitScale(AppIconSize.XS.size))

        val curve =
            scaled.shapes
                .flatMap { it.toPathNodes() }
                .filterIsInstance<PathNode.CurveTo>()
                .first()

        val expected = listOf(9.5785f, 2.5f, 10.25f, 3.1715f, 10.25f, 4.0f)
        val actual = listOf(curve.x1, curve.y1, curve.x2, curve.y2, curve.x3, curve.y3)
        expected.zip(actual).forEach { (want, got) -> assertEquals(want, got, FLOAT_EPSILON) }
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

    // A segment's points are SVG order: `x y` for move and line; first control, second control,
    // then end point for a cubic.
    private fun AppIconSegment.expectedNode(): PathNode {
        val p = points.map(Double::toFloat)
        return when (command) {
            AppIconCommand.MOVE -> PathNode.MoveTo(x = p[0], y = p[1])
            AppIconCommand.LINE -> PathNode.LineTo(x = p[0], y = p[1])
            AppIconCommand.CUBIC -> PathNode.CurveTo(x1 = p[0], y1 = p[1], x2 = p[2], y2 = p[3], x3 = p[4], y3 = p[5])
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
