package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.AppColorRole

// The layout parts the gallery sections share: an item list, wrapping rows, and the cell itself.

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
 * One component cell of the gallery: the component, then [caption] (its test id, or the glyph id
 * of an icon) written below it in `caption`.
 */
@Composable
internal fun GalleryCell(
    caption: String,
    modifier: Modifier = Modifier,
    horizontalAlignment: Alignment.Horizontal = Alignment.Start,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = horizontalAlignment,
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp),
    ) {
        content()
        GalleryLabel(text = caption, style = AppTheme.typography.caption, role = AppColorRole.TEXT_SECONDARY)
    }
}

/**
 * Gallery cells in wrapping rows, [horizontalSpacing] dp apart and `space12` between rows. Non-lazy,
 * so every cell's test tag is in the tree.
 */
@Composable
internal fun GalleryFlow(
    modifier: Modifier = Modifier,
    horizontalSpacing: Double = AppTheme.spacing.space12,
    content: @Composable FlowRowScope.() -> Unit,
) {
    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(horizontalSpacing.dp),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        content = content,
    )
}
