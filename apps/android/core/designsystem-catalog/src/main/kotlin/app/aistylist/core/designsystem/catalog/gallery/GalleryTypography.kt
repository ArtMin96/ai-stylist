package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.aistylist.core.designsystem.AppText
import app.aistylist.core.designsystem.AppTheme

/**
 * Every type style in DESIGN.md order, each showing its own key in its own style and the `text`
 * role (the theme's content colour), text transform included: the overline draws in capitals and
 * is read as written.
 */
@Composable
internal fun GalleryTypography(modifier: Modifier = Modifier) {
    GalleryItems(modifier) {
        AppTheme.typography.all.forEach { style ->
            AppText(text = style.name, style = style)
        }
    }
}
