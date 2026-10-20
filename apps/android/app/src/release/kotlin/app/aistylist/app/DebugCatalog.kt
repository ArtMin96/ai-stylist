package app.aistylist.app

import androidx.compose.runtime.Composable

/**
 * No design-system gallery outside the `debug` build (AI-195): the catalog module is a
 * `debugImplementation` dependency, so this build has no gallery and Home shows no gallery button.
 */
internal object DebugCatalog {
    val gallery: (@Composable (onClose: () -> Unit) -> Unit)? = null
}
