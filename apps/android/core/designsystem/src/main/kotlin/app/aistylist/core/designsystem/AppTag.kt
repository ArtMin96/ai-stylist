package app.aistylist.core.designsystem

import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.TagIconSource
import app.aistylist.core.designsystem.generated.TagPart
import app.aistylist.core.designsystem.generated.TagSize
import app.aistylist.core.designsystem.generated.TagState
import app.aistylist.core.designsystem.generated.TagVariant

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
    val textColor = colors.color(appearance.textColor)
    Row(
        modifier =
            modifier
                .staticText(accessibilityLabel ?: label)
                .appShape(
                    colors,
                    appearance.rounded,
                    fill = colors.colorOrClear(appearance.backgroundColor),
                    ringRole = appearance.borderColor,
                    ringWidth = appearance.borderWidth,
                    ringDash = appearance.borderDash,
                ).lookFrame(
                    appearance.height,
                    appearance.paddingTop,
                    appearance.paddingEnd,
                    appearance.paddingBottom,
                    appearance.paddingStart,
                ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LeadingIcon(appearance.leadingIcon.glyph(leadingIcon), appearance.iconSize, textColor, appearance.iconGap)
        val dotSize = appearance.dotSize
        if (TagPart.DOT in variant.parts && dotSize != null) {
            Disc(dotSize, textColor)
            Gap(appearance.dotGap)
        }
        AppText(text = label, style = appearance.typography, color = textColor)
    }
}

/** The glyph the icon slot draws: its own glyph, the caller's [prop], or none. */
private fun TagIconSource?.glyph(prop: AppIconName?): AppIconName? =
    when (this) {
        is TagIconSource.Glyph -> name
        TagIconSource.Prop -> prop
        null -> null
    }
