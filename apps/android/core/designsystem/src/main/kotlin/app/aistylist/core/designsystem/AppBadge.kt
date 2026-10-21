package app.aistylist.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.BadgeAppearance
import app.aistylist.core.designsystem.generated.BadgeIconSource
import app.aistylist.core.designsystem.generated.BadgePart
import app.aistylist.core.designsystem.generated.BadgeRole
import app.aistylist.core.designsystem.generated.BadgeSize
import app.aistylist.core.designsystem.generated.BadgeState
import app.aistylist.core.designsystem.generated.BadgeVariant

/**
 * The C03 badge (`.impeccable/components/badge.yaml`): it flags and never acts. Its look comes only
 * from `AppTheme.badges`; a [variant] × [size] the contract does not allow renders nothing, and so
 * does a variant that shows a label (count, trial, trial-last-day) while [label] is null.
 *
 * The dot is a circle; the count and the trial pill hold [label] (the count's minimum width keeps
 * one digit round). The dot and the count sit in a ring of the host's [hostSurface] colour, none
 * while it is null. The dot and the count are hidden from assistive tech (the host names them); the
 * trial pills are read as static text. No action, no touch target.
 */
@Composable
fun AppBadge(
    variant: BadgeVariant,
    size: BadgeSize,
    modifier: Modifier = Modifier,
    label: String? = null,
    hostSurface: AppColorRole? = null,
) {
    val appearance = AppTheme.badges.appearance(variant, size, BadgeState.ENABLED) ?: return
    // A look with a label style shows the label; without one (the dot) it draws no text.
    val textStyle = appearance.typography
    if (textStyle != null && label == null) return
    val colors = AppTheme.colors
    Row(
        modifier =
            modifier
                .badgeSemantics(variant.role, label)
                .hostRing(appearance, variant, hostSurface, colors)
                .badgeFrame(appearance, colors),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val textColor = appearance.textColor?.let(colors::color) ?: LocalContentColor.current
        val icon = appearance.leadingIcon.glyph()
        val iconSize = appearance.iconSize
        if (icon != null && iconSize != null) {
            CompositionLocalProvider(LocalContentColor provides textColor) { AppIcon(icon, size = iconSize) }
            Gap(appearance.iconGap)
        }
        if (textStyle != null && label != null) {
            Text(text = label, color = textColor, style = textStyle.toTextStyle(), textAlign = TextAlign.Center)
        }
    }
}

/** Decorative badges are hidden (the host names them); text badges are read as their label. */
private fun Modifier.badgeSemantics(
    role: BadgeRole,
    label: String?,
): Modifier =
    when (role) {
        BadgeRole.DECORATIVE -> clearAndSetSemantics {}
        BadgeRole.TEXT -> clearAndSetSemantics { label?.let { contentDescription = it } }
    }

/** Fill, inner ring and size: the dot's `size`, else a minimum height and width plus padding. */
private fun Modifier.badgeFrame(
    appearance: BadgeAppearance,
    colors: AppColors,
): Modifier {
    val shape = RoundedCornerShape(appearance.rounded.dp)
    return background(colors.color(appearance.backgroundColor), shape)
        .insideRing(colors, appearance.borderColor, appearance.borderWidth, shape)
        .then(appearance.size?.let { Modifier.size(it.dp) } ?: Modifier)
        .heightIn(min = appearance.height.orUnspecified())
        .widthIn(min = appearance.minWidth.orUnspecified())
        .then(appearance.contentPadding()?.let { Modifier.padding(it) } ?: Modifier)
}

/** The `outerRing` part: a ring outside the shape in [hostSurface]'s colour; none while it is null. */
private fun Modifier.hostRing(
    appearance: BadgeAppearance,
    variant: BadgeVariant,
    hostSurface: AppColorRole?,
    colors: AppColors,
): Modifier {
    if (BadgePart.OUTER_RING !in variant.parts) return this
    val host = hostSurface ?: return this
    val width = appearance.outerRingWidth ?: return this
    return outsideRing(colors.color(host), width, offset = 0.0, cornerRadius = appearance.rounded)
}

/** The badge has no icon prop, so only a glyph of the icon set is drawn. */
private fun BadgeIconSource?.glyph(): AppIconName? = (this as? BadgeIconSource.Glyph)?.name

private fun Double?.orUnspecified(): Dp = this?.dp ?: Dp.Unspecified

private fun BadgeAppearance.contentPadding(): PaddingValues? {
    val top = paddingTop ?: return null
    val end = paddingEnd ?: return null
    val bottom = paddingBottom ?: return null
    val start = paddingStart ?: return null
    return lookPadding(top, end, bottom, start)
}
