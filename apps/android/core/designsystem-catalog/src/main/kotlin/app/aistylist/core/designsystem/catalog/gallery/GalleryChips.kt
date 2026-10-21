package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppChipFace
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.ComponentGallery

/**
 * C03 chips: one cell per `ComponentGallery.chip` entry, in generated order and wrapping rows, each
 * state forced and display-only, tagged with its test id. Every cell gets the gallery samples; the
 * face draws the leading-icon sample only where the look's icon is the caller's, and the prefix,
 * detail and swatch only where the variant has that part.
 */
@Composable
internal fun GalleryChips(modifier: Modifier = Modifier) {
    val chips = AppTheme.chips
    val swatch = AppTheme.colors.color(ComponentGallery.chipSwatch)
    // Non-lazy, so every cell's test tag is in the tree.
    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
    ) {
        ComponentGallery.chip.forEach { entry ->
            chips.appearance(entry.variant, entry.size, entry.state)?.let { appearance ->
                GalleryCell(testId = entry.testId) {
                    AppChipFace(
                        appearance = appearance,
                        variant = entry.variant,
                        label = ComponentGallery.chipLabel,
                        modifier = Modifier.testTag(entry.testId),
                        leadingIcon = ComponentGallery.chipLeadingIcon,
                        prefix = ComponentGallery.chipPrefix,
                        detail = ComponentGallery.chipDetail,
                        swatch = swatch,
                    )
                }
            }
        }
    }
}
