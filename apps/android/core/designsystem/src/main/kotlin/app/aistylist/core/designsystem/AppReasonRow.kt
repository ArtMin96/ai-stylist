package app.aistylist.core.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.ReasonRowAppearance
import app.aistylist.core.designsystem.generated.ReasonRowIconSource
import app.aistylist.core.designsystem.generated.ReasonRowPart
import app.aistylist.core.designsystem.generated.ReasonRowSize
import app.aistylist.core.designsystem.generated.ReasonRowState
import app.aistylist.core.designsystem.generated.ReasonRowVariant

/**
 * The C03 expanded reason row (`.impeccable/components/reason-row.yaml`), shown under its reason
 * chip while that chip is expanded. Its look comes only from `AppTheme.reasonRows`.
 *
 * Three lines, `lineGap` apart: [label], then [fact] behind [factIcon] in its disc, then
 * [freshness]. Every line wraps and grows with the font scale, the disc and its icon too. It is a
 * region named [accessibilityLabel] whose lines are read in order; the icon is not read. No action,
 * no touch target.
 */
@Composable
fun AppReasonRow(
    label: String,
    fact: String,
    factIcon: AppIconName,
    freshness: String,
    accessibilityLabel: String,
    modifier: Modifier = Modifier,
) {
    val variant = ReasonRowVariant.STANDARD
    val appearance =
        AppTheme.reasonRows.appearance(variant, ReasonRowSize.STANDARD, ReasonRowState.ENABLED) ?: return
    val colors = AppTheme.colors
    val shape = RoundedCornerShape(appearance.rounded.dp)
    Column(
        modifier =
            modifier
                .semantics {
                    contentDescription = accessibilityLabel
                    isTraversalGroup = true
                }.background(colors.color(appearance.backgroundColor), shape)
                .border(appearance.borderWidth.dp, colors.color(appearance.borderColor), shape)
                .padding(appearance.contentPadding()),
        verticalArrangement = Arrangement.spacedBy(appearance.lineGap.dp),
    ) {
        Text(text = label, color = colors.color(appearance.textColor), style = appearance.typography.toTextStyle())
        variant.parts.forEach { part ->
            when (part) {
                ReasonRowPart.FACT -> {
                    FactLine(fact, appearance.leadingIcon.glyph(factIcon), appearance)
                }

                ReasonRowPart.FRESHNESS -> {
                    Text(
                        text = freshness,
                        color = colors.color(appearance.freshnessColor),
                        style = appearance.freshnessTypography.toTextStyle(),
                    )
                }
            }
        }
    }
}

/** The fact behind its icon: a disc of `iconDiscSize` holding the glyph, `iconGap` before the text. */
@Composable
private fun FactLine(
    fact: String,
    icon: AppIconName,
    appearance: ReasonRowAppearance,
) {
    val colors = AppTheme.colors
    // The disc is sized like text (sp), so it grows with the icon it holds.
    val discSize = with(LocalDensity.current) { appearance.iconDiscSize.sp.toDp() }
    Row(
        horizontalArrangement = Arrangement.spacedBy(appearance.iconGap.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(discSize).background(colors.color(appearance.iconDiscColor), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            AppIcon(icon, size = appearance.iconSize, tint = appearance.iconColor)
        }
        Text(text = fact, color = colors.color(appearance.factColor), style = appearance.factTypography.toTextStyle())
    }
}

/** The glyph the fact line draws: its own glyph or the caller's [prop]. */
private fun ReasonRowIconSource.glyph(prop: AppIconName): AppIconName =
    when (this) {
        is ReasonRowIconSource.Glyph -> name
        ReasonRowIconSource.Prop -> prop
    }

private fun ReasonRowAppearance.contentPadding(): PaddingValues =
    lookPadding(paddingTop, paddingEnd, paddingBottom, paddingStart)
