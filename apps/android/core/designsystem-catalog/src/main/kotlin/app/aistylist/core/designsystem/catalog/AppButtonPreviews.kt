package app.aistylist.core.designsystem.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.AppButton
import app.aistylist.core.designsystem.AppScheme
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.catalog.gallery.GalleryButtons
import app.aistylist.core.designsystem.color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonState
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.core.designsystem.generated.ComponentGallery

// One column of 100 cells (face + test id) needs about this much height.
@Preview(name = "AppButton states, light", heightDp = 9600)
@Composable
private fun AppButtonStatesLightPreview() {
    AppButtonStates(scheme = AppScheme.LIGHT)
}

@Preview(name = "AppButton states, dark", heightDp = 9600)
@Composable
private fun AppButtonStatesDarkPreview() {
    AppButtonStates(scheme = AppScheme.DARK)
}

/** The gallery's C01 section: every `ComponentGallery.button` cell, each state forced. */
@Composable
private fun AppButtonStates(
    scheme: AppScheme,
    modifier: Modifier = Modifier,
) {
    AppTheme(scheme = scheme) {
        GalleryButtons(
            modifier =
                modifier
                    .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                    .padding(AppTheme.spacing.space16.dp),
        )
    }
}

/** Live controls for Android Studio's interactive preview mode. */
@Preview(name = "AppButton playground", showBackground = true)
@Composable
private fun AppButtonPlaygroundPreview() {
    var variant by remember { mutableStateOf(ButtonVariant.PRIMARY) }
    var size by remember { mutableStateOf(ButtonSize.LARGE) }
    var enabled by remember { mutableStateOf(true) }
    var loading by remember { mutableStateOf(false) }
    var fullWidth by remember { mutableStateOf(false) }
    var label by remember { mutableStateOf(ComponentGallery.buttonLabel) }
    var leadingIcon by remember { mutableStateOf<AppIconName?>(null) }
    AppTheme {
        // Only the sizes the contract allows for the variant.
        val sizes = ButtonSize.entries.filter { AppTheme.buttons.appearance(variant, it, ButtonState.ENABLED) != null }
        val shownSize = if (size in sizes) size else sizes.first()
        Column(
            modifier = Modifier.padding(AppTheme.spacing.space16.dp),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            AppButton(
                label = label,
                variant = variant,
                size = shownSize,
                action = {},
                leadingIcon = leadingIcon,
                fullWidth = fullWidth,
                enabled = enabled,
                loading = loading,
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                ButtonVariant.entries.forEach { option ->
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
            // leadingIcon: none, or any C02 glyph.
            Column(verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space4.dp)) {
                Text(stringResource(R.string.ds_button_playground_leading_icon))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8.dp)) {
                    (listOf(null) + AppIconName.entries).forEach { option ->
                        FilterChip(
                            selected = option == leadingIcon,
                            onClick = { leadingIcon = option },
                            label = { Text(option?.id ?: "none") },
                        )
                    }
                }
            }
            PlaygroundSwitch(label = "enabled", checked = enabled, onCheckedChange = { enabled = it })
            PlaygroundSwitch(label = "loading", checked = loading, onCheckedChange = { loading = it })
            PlaygroundSwitch(label = "fullWidth", checked = fullWidth, onCheckedChange = { fullWidth = it })
            OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("label") })
        }
    }
}

@Composable
private fun PlaygroundSwitch(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .toggleable(value = checked, role = Role.Switch, onValueChange = onCheckedChange),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label)
        Switch(checked = checked, onCheckedChange = null)
    }
}
