package app.aistylist.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppMotion
import app.aistylist.core.designsystem.generated.ButtonAppearance
import app.aistylist.core.designsystem.generated.FocusRingTokens
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The pressed transition (`AppMotion.Press`). Compose scales animation durations by the system
 * animator scale, so "Remove animations" removes it.
 */
private val PressTransition: AnimationSpec<Color> =
    AppMotion.Press.easing.map { it.toFloat() }.let { (x1, y1, x2, y2) ->
        tween(durationMillis = AppMotion.Press.duration.roundToInt(), easing = CubicBezierEasing(x1, y1, x2, y2))
    }

/**
 * Draws one resolved [ButtonAppearance]: no interaction, no semantics of its own. `AppButton`
 * resolves the appearance from its state; the catalog forces each state through this view.
 *
 * For the catalog and snapshot tests only; product UI uses `AppButton` and `AppTheme {}`.
 */
@Composable
fun AppButtonFace(
    appearance: ButtonAppearance,
    label: String,
    modifier: Modifier = Modifier,
    leadingIcon: AppIconName? = null,
    showsSpinner: Boolean = false,
    fullWidth: Boolean = false,
) {
    val colors = AppTheme.colors
    val shape = RoundedCornerShape(appearance.rounded.dp)
    val background by animateColorAsState(colors.colorOrClear(appearance.backgroundColor), PressTransition, "fill")
    val overlay by animateColorAsState(colors.colorOrClear(appearance.overlayColor), PressTransition, "overlay")
    val content by animateColorAsState(colors.color(appearance.textColor), PressTransition, "label")
    // The spinner shares the icon slot, so it grows with the font scale exactly as the icon does.
    val slotSize = appearance.iconSize.renderedDp()
    Row(
        modifier =
            modifier
                .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
                .focusRing(appearance.focusRing, colors, appearance.rounded)
                .background(background, shape)
                .background(overlay, shape)
                .then(appearance.border(colors)?.let { Modifier.border(it, shape) } ?: Modifier)
                .heightIn(min = appearance.height.dp)
                .padding(appearance.contentPadding()),
        horizontalArrangement = Arrangement.spacedBy(appearance.iconGap.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            // The button announces "Loading" itself, so the spinner adds nothing for assistive tech.
            showsSpinner -> {
                CircularProgressIndicator(
                    modifier = Modifier.size(slotSize).clearAndSetSemantics {},
                    color = colors.color(appearance.spinnerColor ?: appearance.textColor),
                )
            }

            leadingIcon != null -> {
                CompositionLocalProvider(LocalContentColor provides content) {
                    AppIcon(leadingIcon, size = appearance.iconSize)
                }
            }
        }
        Text(
            text = label,
            color = content,
            style = appearance.typography.toTextStyle(),
            textAlign = TextAlign.Center,
        )
    }
}

private fun AppColors.colorOrClear(role: AppColorRole?): Color = role?.let(::color) ?: Color.Transparent

private fun ButtonAppearance.border(colors: AppColors): BorderStroke? {
    val width = borderWidth ?: return null
    val role = borderColor ?: return null
    return BorderStroke(width.dp, colors.color(role))
}

private fun ButtonAppearance.contentPadding(): PaddingValues =
    PaddingValues(start = paddingStart.dp, top = paddingTop.dp, end = paddingEnd.dp, bottom = paddingBottom.dp)

/** The focus ring: [ring]'s width at its offset outside the pill, following the pill's corners. */
private fun Modifier.focusRing(
    ring: FocusRingTokens?,
    colors: AppColors,
    cornerRadius: Double,
): Modifier {
    if (ring == null) return this
    val color = colors.color(ring.color)
    return drawBehind {
        val stroke = ring.width.dp.toPx()
        val outset = ring.offset.dp.toPx() + stroke / 2
        val radius = min(cornerRadius.dp.toPx(), size.minDimension / 2) + outset
        drawRoundRect(
            color = color,
            topLeft = Offset(-outset, -outset),
            size = Size(size.width + outset * 2, size.height + outset * 2),
            cornerRadius = CornerRadius(radius),
            style = Stroke(width = stroke),
        )
    }
}
