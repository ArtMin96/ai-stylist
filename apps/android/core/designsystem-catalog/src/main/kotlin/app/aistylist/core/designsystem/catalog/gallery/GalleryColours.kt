package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.AppColorRole

/** Every colour role in generated order: a swatch filled with the role, then its DESIGN.md key. */
@Composable
internal fun GalleryColours(modifier: Modifier = Modifier) {
    val side = AppTheme.spacing.space40
    GalleryItems(modifier) {
        AppColorRole.entries.forEach { role ->
            SpecimenRow(
                name = role.id,
                width = side,
                height = side,
                fill = role,
                cornerRadius = AppTheme.radius.radius8,
                stroke = AppColorRole.DIVIDER,
            )
        }
    }
}
