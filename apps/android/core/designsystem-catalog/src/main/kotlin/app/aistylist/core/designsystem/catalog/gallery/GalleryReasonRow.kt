package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.aistylist.core.designsystem.AppReasonRow
import app.aistylist.core.designsystem.generated.ComponentGallery

/**
 * C03 reason row: one cell per `ComponentGallery.reasonRow` entry, its label and the samples, tagged
 * with its test id.
 */
@Composable
internal fun GalleryReasonRow(modifier: Modifier = Modifier) {
    GalleryItems(modifier) {
        ComponentGallery.reasonRow.forEach { entry ->
            GalleryCell(caption = entry.testId) {
                AppReasonRow(
                    label = entry.label,
                    fact = ComponentGallery.reasonRowFact,
                    factIcon = ComponentGallery.reasonRowFactIcon,
                    freshness = ComponentGallery.reasonRowFreshness,
                    accessibilityLabel = ComponentGallery.reasonRowAccessibilityLabel,
                    modifier = Modifier.testTag(entry.testId),
                )
            }
        }
    }
}
