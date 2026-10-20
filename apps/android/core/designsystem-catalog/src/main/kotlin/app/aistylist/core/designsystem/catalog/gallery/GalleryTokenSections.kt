package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.toTextStyle

// The parts the token sections share. Every size is a DESIGN.md token value (dp) and every colour a
// role, so a section passes tokens, never literals.

/** A section's item list: one column, the items `space12` apart. */
@Composable
internal fun GalleryItems(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp)) {
        content()
    }
}

/**
 * One drawn token, then its DESIGN.md key in `footnote`: a [width] × [height] box filled with
 * [fill], with [cornerRadius] corners (Compose scales them down to fit, so `rounded-full` draws a
 * circle) and, when [stroke] is set, a hairline in that role.
 */
@Composable
internal fun SpecimenRow(
    name: String,
    width: Double,
    height: Double,
    modifier: Modifier = Modifier,
    fill: AppColorRole = AppColorRole.PRIMARY,
    cornerRadius: Double = 0.0,
    stroke: AppColorRole? = null,
) {
    val colors = AppTheme.colors
    val shape = RoundedCornerShape(cornerRadius.dp)
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(width = width.dp, height = height.dp)
                    .background(colors.color(fill), shape)
                    .then(stroke?.let { Modifier.border(Dp.Hairline, colors.color(it), shape) } ?: Modifier),
        )
        Text(
            text = name,
            style = AppTheme.typography.footnote.toTextStyle(),
            color = colors.color(AppColorRole.TEXT),
        )
    }
}
