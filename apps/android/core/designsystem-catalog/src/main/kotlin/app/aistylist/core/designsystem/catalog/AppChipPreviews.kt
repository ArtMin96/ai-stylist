package app.aistylist.core.designsystem.catalog

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import app.aistylist.core.designsystem.AppChip
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.ChipSelection
import app.aistylist.core.designsystem.generated.ChipSize
import app.aistylist.core.designsystem.generated.ChipState
import app.aistylist.core.designsystem.generated.ChipVariant
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.GalleryComponent

// 84 wrapped cells (face + test id) need about this much height.
@Preview(name = "AppChip states, light", heightDp = 6000)
@Composable
private fun AppChipStatesLightPreview() {
    StateGrid(GalleryComponent.CHIP, dark = false)
}

@Preview(name = "AppChip states, dark", heightDp = 6000)
@Composable
private fun AppChipStatesDarkPreview() {
    StateGrid(GalleryComponent.CHIP, dark = true)
}

/** The playground's props: every AppChip parameter it controls; an empty prefix or detail is none. */
private data class ChipProps(
    val variant: ChipVariant = ChipVariant.FILTER,
    val size: ChipSize = ChipSize.MEDIUM,
    val selected: Boolean = false,
    val expanded: Boolean = false,
    val enabled: Boolean = true,
    val selection: ChipSelection = ChipSelection.MULTIPLE,
    val label: String = ComponentGallery.chipLabel,
    val prefix: String = ComponentGallery.chipPrefix,
    val detail: String = ComponentGallery.chipDetail,
)

/**
 * Live controls for Android Studio's interactive preview mode. A toggle or `enabled = false` the
 * variant does not take renders nothing, as the contract says.
 */
@Preview(name = "AppChip playground", showBackground = true)
@Composable
private fun AppChipPlaygroundPreview() {
    Playground(ChipProps()) { props, update ->
        // Only the sizes the contract allows for the variant.
        val sizes = ChipSize.entries.filter { AppTheme.chips.appearance(props.variant, it, ChipState.ENABLED) != null }
        val shownSize = sizes.shownSize(props.size)
        AppChip(
            label = props.label,
            variant = props.variant,
            size = shownSize,
            action = {},
            leadingIcon = ComponentGallery.chipLeadingIcon,
            selected = props.selected,
            expanded = props.expanded,
            enabled = props.enabled,
            selection = props.selection,
            prefix = props.prefix.ifEmpty { null },
            detail = props.detail.ifEmpty { null },
            swatch = AppTheme.colors.color(ComponentGallery.chipSwatch),
        )
        PlaygroundOptions(ChipVariant.entries, props.variant, ChipVariant::id) { update(props.copy(variant = it)) }
        PlaygroundOptions(sizes, shownSize, ChipSize::id) { update(props.copy(size = it)) }
        PlaygroundOptions(ChipSelection.entries, props.selection, ChipSelection::id) {
            update(props.copy(selection = it))
        }
        PlaygroundSwitch("selected", props.selected) { update(props.copy(selected = it)) }
        PlaygroundSwitch("expanded", props.expanded) { update(props.copy(expanded = it)) }
        PlaygroundSwitch("enabled", props.enabled) { update(props.copy(enabled = it)) }
        PlaygroundTextField("label", props.label) { update(props.copy(label = it)) }
        PlaygroundTextField("prefix", props.prefix) { update(props.copy(prefix = it)) }
        PlaygroundTextField("detail", props.detail) { update(props.copy(detail = it)) }
    }
}
