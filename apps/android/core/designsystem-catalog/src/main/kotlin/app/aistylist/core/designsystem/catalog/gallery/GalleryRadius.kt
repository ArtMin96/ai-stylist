package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppRadius
import app.aistylist.core.designsystem.generated.AppSpacing

/**
 * Every radius step in DESIGN.md order: a `surface-2` square with that corner radius and a hairline
 * `outline`, then its key. `rounded-full` clamps to a circle.
 */
@Composable
internal fun GalleryRadius(modifier: Modifier = Modifier) {
    GalleryItems(modifier) {
        AppRadius.all.forEach { step ->
            SpecimenRow(
                name = step.name,
                width = AppSpacing.space48,
                height = AppSpacing.space48,
                fill = AppColorRole.SURFACE2,
                cornerRadius = step.value,
                stroke = AppColorRole.OUTLINE,
            )
        }
    }
}
