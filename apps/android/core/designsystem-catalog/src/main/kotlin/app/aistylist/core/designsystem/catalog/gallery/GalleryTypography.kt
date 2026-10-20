package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.toTextStyle

/** Every type style in DESIGN.md order, each showing its own key in its own style. */
@Composable
internal fun GalleryTypography(modifier: Modifier = Modifier) {
    val textColor = AppTheme.colors.color(AppColorRole.TEXT)
    GalleryItems(modifier) {
        AppTheme.typography.all.forEach { style ->
            Text(text = style.name, style = style.toTextStyle(), color = textColor)
        }
    }
}
