package app.aistylist.core.designsystem.catalog.gallery

import app.aistylist.core.designsystem.generated.GalleryComponent

/** What a gallery section renders: one token category, or one component contract. */
internal sealed interface GallerySectionKind {
    data object Colours : GallerySectionKind

    data object Typography : GallerySectionKind

    data object Spacing : GallerySectionKind

    data object Radius : GallerySectionKind

    data class Component(
        val component: GalleryComponent,
    ) : GallerySectionKind
}
