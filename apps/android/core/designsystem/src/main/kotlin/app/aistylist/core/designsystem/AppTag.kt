package app.aistylist.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.TagAppearance
import app.aistylist.core.designsystem.generated.TagIconSource
import app.aistylist.core.designsystem.generated.TagPart
import app.aistylist.core.designsystem.generated.TagSize
import app.aistylist.core.designsystem.generated.TagState
import app.aistylist.core.designsystem.generated.TagVariant
import kotlin.math.max
import kotlin.math.min

/**
 * The C03 tag (`.impeccable/components/tag.yaml`): it labels and never acts. Its look comes only
 * from `AppTheme.tags`; a [variant] × [size] the contract does not allow renders nothing.
 *
 * It is read as static text named [accessibilityLabel] or [label]; its icon and dot are not read.
 * It has no action, no focus stop of its own and no touch target. [leadingIcon] fills the icon slot
 * of a variant that takes the caller's glyph (unavailable).
 */
@Composable
fun AppTag(
    label: String,
    variant: TagVariant,
    size: TagSize,
    modifier: Modifier = Modifier,
    leadingIcon: AppIconName? = null,
    accessibilityLabel: String? = null,
) {
    val appearance = AppTheme.tags.appearance(variant, size, TagState.ENABLED) ?: return
    val colors = AppTheme.colors
    val shape = RoundedCornerShape(appearance.rounded.dp)
    val textColor = colors.color(appearance.textColor)
    val name = accessibilityLabel ?: label
    Row(
        modifier =
            modifier
                .clearAndSetSemantics { contentDescription = name }
                .background(colors.colorOrClear(appearance.backgroundColor), shape)
                .tagRing(appearance, colors, shape)
                .heightIn(min = appearance.height.dp)
                .padding(appearance.contentPadding()),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val icon = appearance.leadingIcon.glyph(leadingIcon)
        val iconSize = appearance.iconSize
        if (icon != null && iconSize != null) {
            CompositionLocalProvider(LocalContentColor provides textColor) { AppIcon(icon, size = iconSize) }
            Gap(appearance.iconGap)
        }
        val dotSize = appearance.dotSize
        if (TagPart.DOT in variant.parts && dotSize != null) {
            Spacer(Modifier.size(dotSize.dp).background(textColor, CircleShape))
            Gap(appearance.dotGap)
        }
        Text(text = label, color = textColor, style = appearance.typography.toTextStyle())
    }
}

/** The ring inside the tag: solid, or dashed with dashes and gaps of `borderDash` (G13). */
private fun Modifier.tagRing(
    appearance: TagAppearance,
    colors: AppColors,
    shape: RoundedCornerShape,
): Modifier {
    val dash = appearance.borderDash ?: return insideRing(colors, appearance.borderColor, appearance.borderWidth, shape)
    val role = appearance.borderColor ?: return this
    val width = appearance.borderWidth ?: return this
    val color = colors.color(role)
    return drawBehind {
        val stroke = width.dp.toPx()
        val inset = stroke / 2
        val dashLength = dash.dp.toPx()
        drawRoundRect(
            color = color,
            topLeft = Offset(inset, inset),
            size = Size(size.width - stroke, size.height - stroke),
            cornerRadius = CornerRadius(max(min(appearance.rounded.dp.toPx(), size.minDimension / 2) - inset, 0f)),
            style =
                Stroke(
                    width = stroke,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(dashLength, dashLength)),
                ),
        )
    }
}

/** The glyph the icon slot draws: its own glyph, the caller's [prop], or none. */
private fun TagIconSource?.glyph(prop: AppIconName?): AppIconName? =
    when (this) {
        is TagIconSource.Glyph -> name
        TagIconSource.Prop -> prop
        null -> null
    }

private fun TagAppearance.contentPadding(): PaddingValues =
    lookPadding(paddingTop, paddingEnd, paddingBottom, paddingStart)
