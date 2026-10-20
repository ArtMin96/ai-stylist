package app.aistylist.core.designsystem.catalog.gallery

import android.content.res.Resources
import androidx.annotation.StringRes
import app.aistylist.core.designsystem.catalog.R
import app.aistylist.core.designsystem.generated.GalleryComponent

/** One gallery section: its test tag, its title and what it renders. */
internal data class GallerySection(
    val id: String,
    val title: String,
    val kind: GallerySectionKind,
)

/**
 * The gallery's sections in display order: the four token categories (a fixed list), then one
 * section per generated [GalleryComponent], in board order.
 */
internal fun gallerySections(resources: Resources): List<GallerySection> {
    fun tokenSection(
        slug: String,
        @StringRes title: Int,
        kind: GallerySectionKind,
    ) = GallerySection(sectionId(slug), resources.getString(title), kind)

    return listOf(
        tokenSection("colours", R.string.ds_gallery_section_colours, GallerySectionKind.Colours),
        tokenSection("typography", R.string.ds_gallery_section_typography, GallerySectionKind.Typography),
        tokenSection("spacing", R.string.ds_gallery_section_spacing, GallerySectionKind.Spacing),
        tokenSection("radius", R.string.ds_gallery_section_radius, GallerySectionKind.Radius),
    ) +
        GalleryComponent.entries.map { component ->
            GallerySection(sectionId(component.slug), component.title, GallerySectionKind.Component(component))
        }
}

private fun sectionId(slug: String): String = GalleryTestTags.SECTION_PREFIX + slug
