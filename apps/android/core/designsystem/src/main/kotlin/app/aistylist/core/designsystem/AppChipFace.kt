package app.aistylist.core.designsystem

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.stringResource
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.AppIconName
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
 * parts wrap, never truncate, and share the width the icons, swatch and gaps leave, so a narrow
 * chip keeps its detail and trailing icon at any font scale; the height is a minimum.
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
    val parts = ChipPartContent(prefix = prefix, detail = detail, swatch = swatch)
    Row(
        modifier =
            modifier
                .focusRing(appearance.focusRing, colors, appearance.rounded)
                .appShape(
                    colors,
                    appearance.rounded,
                    fill = animatedRoleColor(appearance.backgroundColor, "chip fill"),
                    ringRole = appearance.borderColor,
                    ringWidth = appearance.borderWidth,
                    overlay = animatedRoleColor(appearance.overlayColor, "chip overlay"),
                ).lookFrame(
                    appearance.height,
                    appearance.paddingTop,
                    appearance.paddingEnd,
                    appearance.paddingBottom,
                    appearance.paddingStart,
                ).naturalWidthWhenUnbounded(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LeadingIcon(
            name = appearance.leadingIcon.glyph(leadingIcon),
            size = appearance.iconSize,
            tint = animatedRoleColor(appearance.iconColor ?: appearance.textColor, "chip icon"),
            gap = appearance.iconGap,
        )
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
            FaceIcon(
                trailingIcon,
                trailingIconSize,
                animatedRoleColor(appearance.trailingIconColor ?: appearance.textColor, "chip trailing icon"),
            )
        }
    }
}

/**
 * Bounds an unbounded width (a horizontally scrolling row) at the content's natural width, so the
 * weighted text runs keep their widths instead of collapsing to nothing; a bounded width is kept.
 * With equal weights the row's max intrinsic width is the fixed parts plus each run's share at the
 * widest run's natural width, so every run fits on one line, as it would without weights.
 */
private fun Modifier.naturalWidthWhenUnbounded(): Modifier =
    layout { measurable, constraints ->
        val bounded =
            if (constraints.hasBoundedWidth) {
                constraints
            } else {
                val natural = measurable.maxIntrinsicWidth(constraints.maxHeight)
                constraints.copy(maxWidth = natural.coerceAtLeast(constraints.minWidth))
            }
        val placeable = measurable.measure(bounded)
        layout(placeable.width, placeable.height) { placeable.place(0, 0) }
    }

/** The caller's part values, one per `ChipPart` that takes a prop. */
private class ChipPartContent(
    val prefix: String?,
    val detail: String?,
    val swatch: Color?,
)

/** One part with its gap: after a part before the label, before a part after it. */
@Composable
private fun RowScope.ChipPartRun(
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

/**
 * A text run of the chip: the label, the prefix or the detail. Each takes an equal share of the
 * width the unweighted icons, swatch and gaps leave, and no more than it needs, so it wraps there.
 */
@Composable
private fun RowScope.ChipText(
    text: String,
    style: AppTextStyle,
    color: AppColorRole,
) {
    AppText(
        text = text,
        style = style,
        color = animatedRoleColor(color, "chip text"),
        modifier = Modifier.weight(1f, fill = false),
    )
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
    Disc(diameter, swatch, Modifier.swatchRing(appearance, colors, diameter).swatchEdge(appearance, swatch, colors))
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
    return roundedRing(colors.color(role), width, offset = gap, cornerRadius = diameter / 2)
}

/** The edge inside the swatch (a border, drawn over the fill), when the swatch needs it. */
private fun Modifier.swatchEdge(
    appearance: ChipAppearance,
    swatch: Color,
    colors: AppColors,
): Modifier {
    val minContrast = appearance.swatchEdgeMinContrast ?: return this
    val fill = appearance.backgroundColor?.let(colors::color)
    if (!needsSwatchEdge(swatch, fill, minContrast)) return this
    return insideRing(colors, appearance.swatchEdgeColor, appearance.swatchEdgeWidth, CircleShape)
}

/** The glyph an icon slot draws: its own glyph, the caller's [prop], or none. */
private fun ChipIconSource?.glyph(prop: AppIconName?): AppIconName? =
    when (this) {
        is ChipIconSource.Glyph -> name
        ChipIconSource.Prop -> prop
        null -> null
    }
