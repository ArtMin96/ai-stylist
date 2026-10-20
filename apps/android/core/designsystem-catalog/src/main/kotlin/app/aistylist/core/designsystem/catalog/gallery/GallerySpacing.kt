package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.aistylist.core.designsystem.AppTheme

/** Every spacing step in DESIGN.md order: a `primary` bar as wide as the step, then its key. */
@Composable
internal fun GallerySpacing(modifier: Modifier = Modifier) {
    GalleryItems(modifier) {
        AppTheme.spacing.all.forEach { step ->
            SpecimenRow(name = step.name, width = step.value, height = AppTheme.spacing.space8)
        }
    }
}
