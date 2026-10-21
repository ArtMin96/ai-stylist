package app.aistylist.core.designsystem.catalog

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import app.aistylist.core.designsystem.AppButton
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonState
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.GalleryComponent

// One column of 100 cells (face + test id) needs about this much height.
@Preview(name = "AppButton states, light", heightDp = 9600)
@Composable
private fun AppButtonStatesLightPreview() {
    StateGrid(GalleryComponent.BUTTON, dark = false)
}

@Preview(name = "AppButton states, dark", heightDp = 9600)
@Composable
private fun AppButtonStatesDarkPreview() {
    StateGrid(GalleryComponent.BUTTON, dark = true)
}

/** The playground's props: every AppButton parameter it controls. */
private data class ButtonProps(
    val variant: ButtonVariant = ButtonVariant.PRIMARY,
    val size: ButtonSize = ButtonSize.LARGE,
    val enabled: Boolean = true,
    val loading: Boolean = false,
    val fullWidth: Boolean = false,
    val label: String = ComponentGallery.buttonLabel,
    val leadingIcon: AppIconName? = null,
)

/** Live controls for Android Studio's interactive preview mode. */
@Preview(name = "AppButton playground", showBackground = true)
@Composable
private fun AppButtonPlaygroundPreview() {
    Playground(ButtonProps()) { props, update ->
        // Only the sizes the contract allows for the variant.
        val sizes =
            ButtonSize.entries.filter { AppTheme.buttons.appearance(props.variant, it, ButtonState.ENABLED) != null }
        val shownSize = sizes.shownSize(props.size)
        AppButton(
            label = props.label,
            variant = props.variant,
            size = shownSize,
            action = {},
            leadingIcon = props.leadingIcon,
            fullWidth = props.fullWidth,
            enabled = props.enabled,
            loading = props.loading,
        )
        PlaygroundOptions(ButtonVariant.entries, props.variant, ButtonVariant::id) { update(props.copy(variant = it)) }
        PlaygroundOptions(sizes, shownSize, ButtonSize::id) { update(props.copy(size = it)) }
        // leadingIcon: none, or any C02 glyph.
        PlaygroundOptions(
            listOf(null) + AppIconName.entries,
            props.leadingIcon,
            { it?.id ?: "none" },
            title = stringResource(R.string.ds_button_playground_leading_icon),
        ) { update(props.copy(leadingIcon = it)) }
        PlaygroundSwitch("enabled", props.enabled) { update(props.copy(enabled = it)) }
        PlaygroundSwitch("loading", props.loading) { update(props.copy(loading = it)) }
        PlaygroundSwitch("fullWidth", props.fullWidth) { update(props.copy(fullWidth = it)) }
        PlaygroundTextField("label", props.label) { update(props.copy(label = it)) }
    }
}
