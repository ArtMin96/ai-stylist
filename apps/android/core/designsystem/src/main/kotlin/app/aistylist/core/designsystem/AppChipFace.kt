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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSize
import app.aistylist.core.designsystem.generated.AppTextStyle
import app.aistylist.core.designsystem.generated.ChipAppearance
import app.aistylist.core.designsystem.generated.ChipIconSource
import app.aistylist.core.designsystem.generated.ChipPart
import app.aistylist.core.designsystem.generated.ChipPartPosition
import app.aistylist.core.designsystem.generated.ChipVariant

/**
 * Draws one resolved [ChipAppearance] with its content: no interaction, no semantics of its own.
 * `AppChip` resolves the appearance from its state; the catalog forces each state through this view.
 *
 * In order: the leading icon, the parts of `variant.parts` before the label, the label, the parts
 * after it, the trailing icon. A part is drawn only when [variant] lists it and its value is set;
 * an icon whose source is the caller's prop is left out while [leadingIcon] is null. The label and
 * parts wrap, never truncate, and the height is a minimum.
 *
 * For the catalog and snapshot tests only; product UI uses `AppChip` and `AppTheme {}`.
 */
@Composable
fun AppChipFace(
    appearance: ChipAppearance,
    variant: ChipVariant,
    label: String,
    modifier: Modifier = Modifier,
    leadingIcon: AppIconName? = null,
    prefix: String? = null,
    detail: String? = null,
    swatch: Color? = null,
) {
    val colors = AppTheme.colors
    val shape = RoundedCornerShape(appearance.rounded.dp)
    val parts = ChipPartContent(prefix = prefix, detail = detail, swatch = swatch)
    Row(
        modifier =
            modifier
                .focusRing(appearance.focusRing, colors, appearance.rounded)
                .background(animatedRoleColor(appearance.backgroundColor, "fill"), shape)
                .background(animatedRoleColor(appearance.overlayColor, "overlay"), shape)
                .insideRing(colors, appearance.borderColor, appearance.borderWidth, shape)
                .heightIn(min = appearance.height.dp)
                .padding(appearance.contentPadding()),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        appearance.leadingIcon.glyph(leadingIcon)?.let { name ->
            ChipIcon(name, appearance.iconSize, appearance.iconColor ?: appearance.textColor)
            Gap(appearance.iconGap)
        }
        variant.parts.filter { it.position == ChipPartPosition.BEFORE_LABEL }.forEach { part ->
            ChipPartRun(part, appearance, parts)
        }
        ChipText(label, appearance.typography, appearance.textColor)
        variant.parts.filter { it.position == ChipPartPosition.AFTER_LABEL }.forEach { part ->
            ChipPartRun(part, appearance, parts)
        }
        // The chip's only icon prop is leadingIcon, so a trailing slot that names a prop takes it too.
        val trailingIcon = appearance.trailingIcon.glyph(leadingIcon)
        val trailingIconSize = appearance.trailingIconSize
        if (trailingIcon != null && trailingIconSize != null) {
            Gap(appearance.trailingIconGap)
            ChipIcon(trailingIcon, trailingIconSize, appearance.trailingIconColor ?: appearance.textColor)
        }
    }
}

/** The caller's part values, one per `ChipPart` that takes a prop. */
private class ChipPartContent(
    val prefix: String?,
    val detail: String?,
    val swatch: Color?,
)

/** One part with its gap: after a part before the label, before a part after it. */
@Composable
private fun ChipPartRun(
    part: ChipPart,
    appearance: ChipAppearance,
    content: ChipPartContent,
) {
    when (part) {
        ChipPart.PREFIX -> {
            content.prefix?.let { prefix ->
                ChipText(
                    text = prefix,
                    style = appearance.prefixTypography ?: appearance.typography,
                    color = appearance.prefixColor ?: appearance.textColor,
                )
                Gap(appearance.prefixGap)
            }
        }

        ChipPart.SWATCH -> {
            content.swatch?.let { swatch ->
                ChipSwatch(swatch, appearance)
                Gap(appearance.swatchGap)
            }
        }

        ChipPart.DETAIL -> {
            content.detail?.let { detail ->
                Gap(appearance.detailGap)
                ChipText(
                    text = stringResource(R.string.ds_chip_detail_separator) + detail,
                    style = appearance.detailTypography ?: appearance.typography,
                    color = appearance.detailColor ?: appearance.textColor,
                )
            }
        }
    }
}

@Composable
private fun ChipText(
    text: String,
    style: AppTextStyle,
    color: AppColorRole,
) {
    Text(text = text, color = animatedRoleColor(color, "text"), style = style.toTextStyle())
}

/** A decorative icon in [tint]; it grows with the font scale (`AppIcon`). */
@Composable
private fun ChipIcon(
    name: AppIconName,
    size: AppIconSize,
    tint: AppColorRole,
) {
    CompositionLocalProvider(LocalContentColor provides animatedRoleColor(tint, "icon")) {
        AppIcon(name, size = size)
    }
}

/**
 * The garment colour: a circle of `swatchSize`, the `swatchRing` outside it when the look sets one,
 * and the `swatchEdge` inside it when the colour lacks contrast with the chip's fill.
 */
@Composable
private fun ChipSwatch(
    swatch: Color,
    appearance: ChipAppearance,
) {
    val diameter = appearance.swatchSize ?: return
    val colors = AppTheme.colors
    Spacer(
        modifier =
            Modifier
                .swatchRing(appearance, colors, diameter)
                .size(diameter.dp)
                .background(swatch, CircleShape)
                .swatchEdge(appearance, swatch, colors),
    )
}

/** The ring outside the swatch, `swatchRingGap` away; none unless the look sets one. */
private fun Modifier.swatchRing(
    appearance: ChipAppearance,
    colors: AppColors,
    diameter: Double,
): Modifier {
    val role = appearance.swatchRingColor ?: return this
    val width = appearance.swatchRingWidth ?: return this
    val gap = appearance.swatchRingGap ?: 0.0
    return outsideRing(colors.color(role), width, offset = gap, cornerRadius = diameter / 2)
}

/** The edge inside the swatch, only when the swatch does not stand off the chip's fill on its own. */
private fun Modifier.swatchEdge(
    appearance: ChipAppearance,
    swatch: Color,
    colors: AppColors,
): Modifier {
    val minContrast = appearance.swatchEdgeMinContrast ?: return this
    // Every swatch look sets a fill; without one nothing is known behind the swatch, so it keeps its edge.
    val fill = appearance.backgroundColor?.let(colors::color)
    if (fill != null && !needsSwatchEdge(swatch, fill, minContrast)) return this
    return insideRing(colors, appearance.swatchEdgeColor, appearance.swatchEdgeWidth, CircleShape)
}

/** The glyph an icon slot draws: its own glyph, the caller's [prop], or none. */
private fun ChipIconSource?.glyph(prop: AppIconName?): AppIconName? =
    when (this) {
        is ChipIconSource.Glyph -> name
        ChipIconSource.Prop -> prop
        null -> null
    }

private fun ChipAppearance.contentPadding(): PaddingValues =
    lookPadding(paddingTop, paddingEnd, paddingBottom, paddingStart)
