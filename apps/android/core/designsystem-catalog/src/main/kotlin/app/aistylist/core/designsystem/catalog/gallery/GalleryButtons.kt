package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppButtonFace
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.ButtonState
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.toTextStyle

/**
 * C01: one cell per `ComponentGallery.button` entry, in generated order, each state forced and
 * display-only, tagged with its test id, with that id written below it.
 */
@Composable
internal fun GalleryButtons(modifier: Modifier = Modifier) {
    val buttons = AppTheme.buttons
    val captionColor = AppTheme.colors.color(AppColorRole.TEXT_SECONDARY)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp)) {
        ComponentGallery.button.forEach { entry ->
            buttons.appearance(entry.variant, entry.size, entry.state)?.let { appearance ->
                Column(verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp)) {
                    AppButtonFace(
                        appearance = appearance,
                        label = ComponentGallery.buttonLabel,
                        modifier = Modifier.testTag(entry.testId),
                        showsSpinner = entry.state == ButtonState.LOADING,
                    )
                    Text(
                        text = entry.testId,
                        style = AppTheme.typography.caption.toTextStyle(),
                        color = captionColor,
                    )
                }
            }
        }
    }
}
