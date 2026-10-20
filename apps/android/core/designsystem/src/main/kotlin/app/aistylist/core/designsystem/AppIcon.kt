package app.aistylist.core.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.toPath
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconMetrics
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconPaint
import app.aistylist.core.designsystem.generated.AppIconSize

/**
 * The C02 icon (`.impeccable/components/icon.yaml`): glyph [name] at icon-scale step [size],
 * decorative, so it adds no semantics and the host names the action. The frame is exactly the
 * rendered size with no touch target; a tappable host gives it 48 dp.
 *
 * The step grows with the user's font size, like text: its token is treated as sp (owner decision
 * 11, 2026-10-21). With [tint] null it draws in the host's `LocalContentColor`, which `AppTheme`
 * sets to the `text` role.
 */
@Composable
fun AppIcon(
    name: AppIconName,
    modifier: Modifier = Modifier,
    size: AppIconSize = AppIconMetrics.defaultSize,
    tint: AppColorRole? = null,
) {
    val color = appIconColor(tint)
    val renderedPx = with(LocalDensity.current) { size.size.sp.toPx() }.toDouble()
    val shapes = remember(name, size, renderedPx) { iconShapes(name, size, renderedPx) }
    // wrapContentSize keeps the glyph centred when the caller's modifier fixes a larger size.
    Canvas(modifier = modifier.wrapContentSize().size(size.renderedDp())) {
        shapes.forEach { shape ->
            if (shape.fills) drawPath(shape.path, color, style = Fill)
            shape.stroke?.let { drawPath(shape.path, color, style = it) }
        }
    }
}

/** The colour `AppIcon` draws in: the [tint] role in this context, else the host's content colour. */
@Composable
@ReadOnlyComposable
internal fun appIconColor(tint: AppColorRole?): Color =
    tint?.let { AppTheme.colors.color(it) } ?: LocalContentColor.current

/**
 * The rendered size of this step: the token as sp through the current `Density`, so Android's
 * (non-linear) font scaling applies. `AppIcon` and the button's spinner slot share it.
 */
@Composable
@ReadOnlyComposable
internal fun AppIconSize.renderedDp(): Dp = with(LocalDensity.current) { size.sp.toDp() }

/** One glyph shape ready to draw: fill first, then stroke (SVG paint order). */
private class IconShape(
    val path: Path,
    val fills: Boolean,
    val stroke: Stroke?,
)

private fun iconShapes(
    name: AppIconName,
    size: AppIconSize,
    renderedPx: Double,
): List<IconShape> {
    val glyph = AppIconGeometry.scaled(name.glyph, AppIconGeometry.unitScale(renderedPx))
    val stroke =
        Stroke(
            width = AppIconGeometry.strokeWidth(size, renderedPx).toFloat(),
            cap = StrokeCap.Round,
            join = StrokeJoin.Round,
        )
    return glyph.shapes.map { shape ->
        IconShape(
            path = shape.toPathNodes().toPath().apply { fillType = PathFillType.NonZero },
            fills = shape.paint != AppIconPaint.STROKE,
            stroke = stroke.takeIf { shape.paint != AppIconPaint.FILL },
        )
    }
}
