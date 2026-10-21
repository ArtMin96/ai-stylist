package app.aistylist.core.designsystem.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppScheme
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.gallery.GalleryComponentCells
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.GalleryComponent

/**
 * A component's state-grid preview: its gallery section's cells (every `ComponentGallery` entry in
 * generated order, each state forced and tagged with its test id) in the light scheme, or the dark
 * one when [dark], on its background.
 */
@Composable
internal fun StateGrid(
    component: GalleryComponent,
    dark: Boolean,
    modifier: Modifier = Modifier,
) {
    AppTheme(scheme = AppScheme.of(dark = dark, highContrast = false)) {
        GalleryComponentCells(
            component = component,
            modifier =
                modifier
                    .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                    .padding(AppTheme.spacing.space16.dp),
        )
    }
}
