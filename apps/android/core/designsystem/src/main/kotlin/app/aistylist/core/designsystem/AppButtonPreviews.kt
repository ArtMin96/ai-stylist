package app.aistylist.core.designsystem

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonState
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.core.designsystem.generated.ComponentGallery

@Preview(name = "AppButton states, light", heightDp = 2400)
@Composable
private fun AppButtonStatesLightPreview() {
    AppButtonStateGrid(scheme = AppScheme.LIGHT)
}

@Preview(name = "AppButton states, dark", heightDp = 2400)
@Composable
private fun AppButtonStatesDarkPreview() {
    AppButtonStateGrid(scheme = AppScheme.DARK)
}

/** One cell per `ComponentGallery.button` entry, in generated order, each state forced. */
@Composable
private fun AppButtonStateGrid(
    scheme: AppScheme,
    modifier: Modifier = Modifier,
) {
    AppTheme(scheme = scheme) {
        FlowRow(
            modifier =
                modifier
                    .background(AppTheme.colors.color(AppColorRole.BACKGROUND))
                    .padding(AppTheme.spacing.space16.dp),
            horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
            verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space12.dp),
        ) {
            ComponentGallery.button.forEach { entry ->
                AppTheme.buttons.appearance(entry.variant, entry.size, entry.state)?.let { appearance ->
                    AppButtonFace(
                        appearance = appearance,
                        label = ComponentGallery.buttonLabel,
                        modifier = Modifier.testTag(entry.testId),
                        showsSpinner = entry.state == ButtonState.LOADING,
                    )
                }
            }
        }
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
