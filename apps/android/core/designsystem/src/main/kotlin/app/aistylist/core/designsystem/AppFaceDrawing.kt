package app.aistylist.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSize
import app.aistylist.core.designsystem.generated.AppMotion
import app.aistylist.core.designsystem.generated.FocusRingTokens
import kotlin.math.min
import kotlin.math.roundToInt

// Drawing shared by the component faces (AppButtonFace, AppChipFace, AppTag, AppBadge, AppReasonRow).
// Each face draws through these helpers and keeps no private copy of them.

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

/**
 * A face's shape within corners of [rounded]: [fill], then [overlay] over it (the pressed layer),
 * then a ring of [ringRole] at [ringWidth] inside the edge, dashed with dashes and gaps of [ringDash]
 * when set (G13). No ring unless the look sets both its colour and width.
 */
internal fun Modifier.appShape(
    colors: AppColors,
    rounded: Double,
    fill: Color,
    ringRole: AppColorRole?,
    ringWidth: Double?,
    overlay: Color = Color.Transparent,
    ringDash: Double? = null,
): Modifier {
    val shape = RoundedCornerShape(rounded.dp)
    val filled = background(fill, shape).background(overlay, shape)
    if (ringDash == null) return filled.insideRing(colors, ringRole, ringWidth, shape)
    val role = ringRole ?: return filled
    val width = ringWidth ?: return filled
    return filled.roundedRing(colors.color(role), width, offset = -width, cornerRadius = rounded, dash = ringDash)
}

/** A label-only element (tag, trial badge): read as static text named [name], its content not read. */
internal fun Modifier.staticText(name: String): Modifier = clearAndSetSemantics { contentDescription = name }

/**
 * Assistive tech reads nothing inside this element. Semantics set before it on the same element stay
 * (the chip's role, name and state); an element with none (the dot, the count, the spinner) is not
 * read at all.
 */
internal fun Modifier.hideContentSemantics(): Modifier = clearAndSetSemantics {}

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

/** A look's padding, each side in dp. */
internal fun Modifier.lookPadding(
    top: Double,
    end: Double,
    bottom: Double,
    start: Double,
): Modifier = padding(start = start.dp, top = top.dp, end = end.dp, bottom = bottom.dp)

/** The frame a face's content sits in: at least [height] tall (a minimum, so text can wrap), then the padding. */
internal fun Modifier.lookFrame(
    height: Double,
    top: Double,
    end: Double,
    bottom: Double,
    start: Double,
): Modifier = heightIn(min = height.dp).lookPadding(top, end, bottom, start)

/** The focus ring: [ring]'s width at its offset outside the shape, following the shape's corners. */
internal fun Modifier.focusRing(
    ring: FocusRingTokens?,
    colors: AppColors,
    cornerRadius: Double,
): Modifier {
    if (ring == null) return this
    return roundedRing(colors.color(ring.color), width = ring.width, offset = ring.offset, cornerRadius = cornerRadius)
}

/**
 * A ring of [width] whose inner edge lies [offset] outside the bounds (an offset of minus [width]
 * puts it just inside), following corners of [cornerRadius] capped at a circle, dashed with dashes
 * and gaps of [dash] when set. It does not change the layout.
 */
internal fun Modifier.roundedRing(
    color: Color,
    width: Double,
    offset: Double,
    cornerRadius: Double,
    dash: Double? = null,
): Modifier =
    drawBehind {
        val stroke = width.dp.toPx()
        val outset = offset.dp.toPx() + stroke / 2
        val radius = (min(cornerRadius.dp.toPx(), size.minDimension / 2) + outset).coerceAtLeast(0f)
        val dashLength = dash?.dp?.toPx()
        drawRoundRect(
            color = color,
            topLeft = Offset(-outset, -outset),
            size = Size(size.width + outset * 2, size.height + outset * 2),
            cornerRadius = CornerRadius(radius),
            style =
                Stroke(
                    width = stroke,
                    pathEffect = dashLength?.let { PathEffect.dashPathEffect(floatArrayOf(it, it)) },
                ),
        )
    }

/** A horizontal gap of [width] dp between two parts of a face; none when the look sets none. */
@Composable
internal fun Gap(width: Double?) {
    width?.let { Spacer(Modifier.width(it.dp)) }
}

/** A decorative icon in [tint], which may be animated; it grows with the font scale (`AppIcon`). */
@Composable
internal fun FaceIcon(
    name: AppIconName,
    size: AppIconSize,
    tint: Color,
    modifier: Modifier = Modifier,
) {
    CompositionLocalProvider(LocalContentColor provides tint) { AppIcon(name, modifier, size = size) }
}

/** A face's leading icon in [tint], then the [gap] after it; nothing while [name] or [size] is null. */
@Composable
internal fun RowScope.LeadingIcon(
    name: AppIconName?,
    size: AppIconSize?,
    tint: Color,
    gap: Double?,
) {
    if (name == null || size == null) return
    FaceIcon(name, size, tint)
    Gap(gap)
}

/** A filled circle of [diameter] dp in [color]: the tag's dot, the chip's swatch. */
@Composable
internal fun Disc(
    diameter: Double,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Spacer(modifier.size(diameter.dp).background(color, CircleShape))
}
