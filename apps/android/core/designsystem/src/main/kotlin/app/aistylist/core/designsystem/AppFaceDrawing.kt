package app.aistylist.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.AppMotion
import app.aistylist.core.designsystem.generated.FocusRingTokens
import kotlin.math.min
import kotlin.math.roundToInt

// Drawing shared by the component faces (AppButtonFace, AppChipFace, AppTag, AppBadge, AppReasonRow).

/**
 * The pressed transition (`AppMotion.Press`). Compose scales animation durations by the system
 * animator scale, so "Remove animations" removes it.
 */
internal val PressTransition: AnimationSpec<Color> =
    AppMotion.Press.easing.map { it.toFloat() }.let { (x1, y1, x2, y2) ->
        tween(durationMillis = AppMotion.Press.duration.roundToInt(), easing = CubicBezierEasing(x1, y1, x2, y2))
    }

/** [role] in this context, or transparent when the look has none. */
internal fun AppColors.colorOrClear(role: AppColorRole?): Color = role?.let(::color) ?: Color.Transparent

/** [role] in the active context, animated with [PressTransition]; transparent when null. */
@Composable
internal fun animatedRoleColor(
    role: AppColorRole?,
    label: String,
): Color = animateColorAsState(AppTheme.colors.colorOrClear(role), PressTransition, label).value

/** A ring drawn inside [shape]: [role] at [width] in [colors]; none unless the look sets both. */
internal fun Modifier.insideRing(
    colors: AppColors,
    role: AppColorRole?,
    width: Double?,
    shape: Shape,
): Modifier {
    val ringWidth = width ?: return this
    val ringRole = role ?: return this
    return border(ringWidth.dp, colors.color(ringRole), shape)
}

/** A horizontal gap of [width] dp between two parts of a face; none when the look sets none. */
@Composable
internal fun Gap(width: Double?) {
    width?.let { Spacer(Modifier.width(it.dp)) }
}

/** A look's padding, each side in dp. */
internal fun lookPadding(
    top: Double,
    end: Double,
    bottom: Double,
    start: Double,
): PaddingValues = PaddingValues(start = start.dp, top = top.dp, end = end.dp, bottom = bottom.dp)

/** The focus ring: [ring]'s width at its offset outside the shape, following the shape's corners. */
internal fun Modifier.focusRing(
    ring: FocusRingTokens?,
    colors: AppColors,
    cornerRadius: Double,
): Modifier {
    if (ring == null) return this
    return outsideRing(colors.color(ring.color), width = ring.width, offset = ring.offset, cornerRadius = cornerRadius)
}

/**
 * A ring of [width] drawn [offset] outside the bounds, following corners of [cornerRadius] (capped
 * at a circle). It does not change the layout.
 */
internal fun Modifier.outsideRing(
    color: Color,
    width: Double,
    offset: Double,
    cornerRadius: Double,
): Modifier =
    drawBehind {
        val stroke = width.dp.toPx()
        val outset = offset.dp.toPx() + stroke / 2
        val radius = min(cornerRadius.dp.toPx(), size.minDimension / 2) + outset
        drawRoundRect(
            color = color,
            topLeft = Offset(-outset, -outset),
            size = Size(size.width + outset * 2, size.height + outset * 2),
            cornerRadius = CornerRadius(radius),
            style = Stroke(width = stroke),
        )
    }
