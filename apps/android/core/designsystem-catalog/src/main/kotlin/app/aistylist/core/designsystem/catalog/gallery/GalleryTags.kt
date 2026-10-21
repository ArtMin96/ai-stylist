package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppTag
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.ComponentGallery

/**
 * C03 tags: one cell per `ComponentGallery.tag` entry, in generated order and wrapping rows, tagged
 * with its test id. The leading-icon sample shows only where the look's icon is the caller's.
 */
@Composable
internal fun GalleryTags(modifier: Modifier = Modifier) {
    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
    ) {
        ComponentGallery.tag.forEach { entry ->
            GalleryCell(testId = entry.testId) {
                AppTag(
                    label = ComponentGallery.tagLabel,
                    variant = entry.variant,
                    size = entry.size,
                    modifier = Modifier.testTag(entry.testId),
                    leadingIcon = ComponentGallery.tagLeadingIcon,
                )
            }
        }
    }
}
