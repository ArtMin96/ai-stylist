package app.aistylist.app

import androidx.compose.runtime.Composable
import app.aistylist.core.designsystem.catalog.gallery.DesignSystemGalleryScreen

/**
 * The dev-only design-system catalog, `debug` build: the gallery (AI-195). `preview` and `release`
 * declare the same object with `gallery = null` and never see `:core:designsystem-catalog`.
 */
internal object DebugCatalog {
    val gallery: (@Composable (onClose: () -> Unit) -> Unit)? =
        { onClose -> DesignSystemGalleryScreen(onClose = onClose) }
}
