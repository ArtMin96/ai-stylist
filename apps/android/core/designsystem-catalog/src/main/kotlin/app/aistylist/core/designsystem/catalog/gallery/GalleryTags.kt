package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.aistylist.core.designsystem.AppTag
import app.aistylist.core.designsystem.generated.ComponentGallery

/**
 * C03 tags: one cell per `ComponentGallery.tag` entry with its label, in generated order and
 * wrapping rows, tagged with its test id. The leading-icon sample shows only where the look's icon
 * is the caller's.
 */
@Composable
internal fun GalleryTags(modifier: Modifier = Modifier) {
    GalleryFlow(modifier = modifier) {
        ComponentGallery.tag.forEach { entry ->
            GalleryCell(caption = entry.testId) {
                AppTag(
                    label = entry.label,
                    variant = entry.variant,
                    size = entry.size,
                    modifier = Modifier.testTag(entry.testId),
                    leadingIcon = ComponentGallery.tagLeadingIcon,
                )
            }
        }
    }
}
