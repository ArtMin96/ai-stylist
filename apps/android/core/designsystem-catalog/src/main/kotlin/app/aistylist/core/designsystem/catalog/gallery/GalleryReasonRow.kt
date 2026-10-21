package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppReasonRow
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.ComponentGallery

/** C03 reason row: one cell per `ComponentGallery.reasonRow` entry with the samples, tagged with its test id. */
@Composable
internal fun GalleryReasonRow(modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp)) {
        ComponentGallery.reasonRow.forEach { entry ->
            GalleryCell(testId = entry.testId) {
                AppReasonRow(
                    label = ComponentGallery.reasonRowLabel,
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
