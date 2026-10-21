package app.aistylist.core.designsystem.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppChip
import app.aistylist.core.designsystem.AppScheme
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.gallery.GalleryChips
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.ChipSelection
import app.aistylist.core.designsystem.generated.ChipSize
import app.aistylist.core.designsystem.generated.ChipState
import app.aistylist.core.designsystem.generated.ChipVariant
import app.aistylist.core.designsystem.generated.ComponentGallery

// 84 wrapped cells (face + test id) need about this much height.
@Preview(name = "AppChip states, light", heightDp = 6000)
@Composable
private fun AppChipStatesLightPreview() {
    AppChipStates(scheme = AppScheme.LIGHT)
}

@Preview(name = "AppChip states, dark", heightDp = 6000)
@Composable
private fun AppChipStatesDarkPreview() {
    AppChipStates(scheme = AppScheme.DARK)
}

/** The gallery's C03 chips section: every `ComponentGallery.chip` cell, each state forced. */
@Composable
private fun AppChipStates(
    scheme: AppScheme,
    modifier: Modifier = Modifier,
) {
    AppTheme(scheme = scheme) {
        GalleryChips(
            modifier =
                modifier
                    .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                    .padding(AppTheme.spacing.space16.dp),
        )
    }
}

/**
 * Live controls for Android Studio's interactive preview mode. A toggle or `enabled = false` the
 * variant does not take renders nothing, as the contract says.
 */
@Preview(name = "AppChip playground", showBackground = true)
@Composable
private fun AppChipPlaygroundPreview() {
    var variant by remember { mutableStateOf(ChipVariant.FILTER) }
    var size by remember { mutableStateOf(ChipSize.MEDIUM) }
    var selected by remember { mutableStateOf(false) }
    var expanded by remember { mutableStateOf(false) }
    var enabled by remember { mutableStateOf(true) }
    var selection by remember { mutableStateOf(ChipSelection.MULTIPLE) }
    var label by remember { mutableStateOf(ComponentGallery.chipLabel) }
    var prefix by remember { mutableStateOf(ComponentGallery.chipPrefix) }
    var detail by remember { mutableStateOf(ComponentGallery.chipDetail) }
    AppTheme {
        // Only the sizes the contract allows for the variant.
        val sizes = ChipSize.entries.filter { AppTheme.chips.appearance(variant, it, ChipState.ENABLED) != null }
        val shownSize = if (size in sizes) size else sizes.first()
        Column(
            modifier = Modifier.padding(AppTheme.spacing.space16.dp),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            AppChip(
                label = label,
                variant = variant,
                size = shownSize,
                action = {},
                leadingIcon = ComponentGallery.chipLeadingIcon,
                selected = selected,
                expanded = expanded,
                enabled = enabled,
                selection = selection,
                prefix = prefix,
                detail = detail,
                swatch = AppTheme.colors.color(ComponentGallery.chipSwatch),
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                ChipVariant.entries.forEach { option ->
                    FilterChip(
                        selected = option == variant,
                        onClick = { variant = option },
                        label = { Text(option.id) },
                    )
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                sizes.forEach { option ->
                    FilterChip(selected = option == shownSize, onClick = { size = option }, label = { Text(option.id) })
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                ChipSelection.entries.forEach { option ->
                    FilterChip(
                        selected = option == selection,
                        onClick = { selection = option },
                        label = { Text(option.id) },
                    )
                }
            }
            PlaygroundSwitch(label = "selected", checked = selected, onCheckedChange = { selected = it })
            PlaygroundSwitch(label = "expanded", checked = expanded, onCheckedChange = { expanded = it })
            PlaygroundSwitch(label = "enabled", checked = enabled, onCheckedChange = { enabled = it })
            OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("label") })
            OutlinedTextField(value = prefix, onValueChange = { prefix = it }, label = { Text("prefix") })
            OutlinedTextField(value = detail, onValueChange = { detail = it }, label = { Text("detail") })
        }
    }
}
