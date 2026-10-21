package app.aistylist.core.designsystem.catalog

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import app.aistylist.core.designsystem.AppTag
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.GalleryComponent
import app.aistylist.core.designsystem.generated.TagSize
import app.aistylist.core.designsystem.generated.TagState
import app.aistylist.core.designsystem.generated.TagVariant

@Preview(name = "AppTag states, light", heightDp = 1200)
@Composable
private fun AppTagStatesLightPreview() {
    StateGrid(GalleryComponent.TAG, dark = false)
}

@Preview(name = "AppTag states, dark", heightDp = 1200)
@Composable
private fun AppTagStatesDarkPreview() {
    StateGrid(GalleryComponent.TAG, dark = true)
}

/** The playground's props: every AppTag parameter it controls. */
private data class TagProps(
    val variant: TagVariant = TagVariant.PLAN_PLUS,
    val size: TagSize = TagSize.REGULAR,
    val label: String = ComponentGallery.tagLabel,
)

/** Live controls for Android Studio's interactive preview mode. */
@Preview(name = "AppTag playground", showBackground = true)
@Composable
private fun AppTagPlaygroundPreview() {
    Playground(TagProps()) { props, update ->
        // Only the sizes the contract allows for the variant.
        val sizes = TagSize.entries.filter { AppTheme.tags.appearance(props.variant, it, TagState.ENABLED) != null }
        val shownSize = sizes.shownSize(props.size)
        AppTag(
            label = props.label,
            variant = props.variant,
            size = shownSize,
            leadingIcon = ComponentGallery.tagLeadingIcon,
        )
        PlaygroundOptions(TagVariant.entries, props.variant, TagVariant::id) { update(props.copy(variant = it)) }
        PlaygroundOptions(sizes, shownSize, TagSize::id) { update(props.copy(size = it)) }
        PlaygroundTextField("label", props.label) { update(props.copy(label = it)) }
    }
}
