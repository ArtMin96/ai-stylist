package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.aistylist.core.designsystem.AppButtonFace
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.ButtonState
import app.aistylist.core.designsystem.generated.ComponentGallery

/**
 * C01: one cell per `ComponentGallery.button` entry, in generated order, each state forced and
 * display-only with the entry's label, tagged with its test id, with that id written below it.
 */
@Composable
internal fun GalleryButtons(modifier: Modifier = Modifier) {
    val buttons = AppTheme.buttons
    GalleryItems(modifier) {
        ComponentGallery.button.forEach { entry ->
            buttons.appearance(entry.variant, entry.size, entry.state)?.let { appearance ->
                GalleryCell(caption = entry.testId) {
                    AppButtonFace(
                        appearance = appearance,
                        label = entry.label,
                        modifier = Modifier.testTag(entry.testId),
                        showsSpinner = entry.state == ButtonState.LOADING,
                    )
                }
            }
        }
    }
}
