package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.aistylist.core.designsystem.generated.GalleryComponent

/**
 * The cells of one component's gallery section. The gallery screen and every component's state-grid
 * preview draw them through here, so both show the same cells.
 */
@Composable
internal fun GalleryComponentCells(
    component: GalleryComponent,
    modifier: Modifier = Modifier,
) {
    // Exhaustive: a new component contract fails the build until it has a renderer.
    when (component) {
        GalleryComponent.BUTTON -> GalleryButtons(modifier)
        GalleryComponent.ICON -> GalleryIcons(modifier)
        GalleryComponent.BADGE -> GalleryBadges(modifier)
        GalleryComponent.CHIP -> GalleryChips(modifier)
        GalleryComponent.REASON_ROW -> GalleryReasonRow(modifier)
        GalleryComponent.TAG -> GalleryTags(modifier)
    }
}
