package app.aistylist.core.designsystem.catalog

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import app.aistylist.core.designsystem.generated.GalleryComponent

// The playground plus seven groups of wrapped cells need about this much height.
@Preview(name = "AppIcon set, light", heightDp = 2400)
@Composable
private fun AppIconSetLightPreview() {
    StateGrid(GalleryComponent.ICON, dark = false)
}

@Preview(name = "AppIcon set, dark", heightDp = 2400)
@Composable
private fun AppIconSetDarkPreview() {
    StateGrid(GalleryComponent.ICON, dark = true)
}

/** The largest font scale: every icon and its stroke grow with the text. */
@Preview(name = "AppIcon set, largest text", heightDp = 4800, fontScale = 2f)
@Composable
private fun AppIconSetLargestTextPreview() {
    StateGrid(GalleryComponent.ICON, dark = false)
}
