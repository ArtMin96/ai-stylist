package app.aistylist.core.designsystem

import androidx.compose.foundation.clickable
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.ButtonAccessibility
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonState
import app.aistylist.core.designsystem.generated.ButtonVariant

/**
 * The C01 button (`.impeccable/components/button.yaml`). Its look comes only from
 * `AppTheme.buttons`; a [variant] × [size] the contract does not allow renders nothing.
 *
 * [leadingIcon] is a C02 glyph drawn at the look's icon step in the label colour, hidden from
 * assistive tech. While [loading] the label stays, a spinner takes the leading-icon slot, the
 * enabled colours stay, the button stays focusable and is announced "Loading", and every
 * activation is ignored. A disabled button cannot be activated. The hit area is at least
 * `ButtonAccessibility.minTouchTarget` (48 dp) square at every size.
 */
@Composable
fun AppButton(
    label: String,
    variant: ButtonVariant,
    size: ButtonSize,
    action: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: AppIconName? = null,
    fullWidth: Boolean = false,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val buttons = AppTheme.buttons
    val resting = displayedButtonState(loading = loading, enabled = enabled, pressed = false, focused = false)
    val restingAppearance = buttons.appearance(variant, size, resting) ?: return
    val interaction = rememberControlInteraction()
    val state =
        displayedButtonState(
            loading = loading,
            enabled = enabled,
            pressed = interaction.pressed,
            focused = interaction.focused,
        )
    val loadingDescription = stringResource(R.string.app_button_loading)
    ProvideTouchTarget(ButtonAccessibility.minTouchTarget) {
        AppButtonFace(
            // An interaction state the contract draws no look for shows the resting look.
            appearance = buttons.appearance(variant, size, state) ?: restingAppearance,
            label = label,
            modifier =
                modifier
                    .semantics { if (loading) stateDescription = loadingDescription }
                    // Loading stays enabled for focus and assistive tech; the gate drops its activations.
                    .clickable(
                        interactionSource = interaction.source,
                        indication = null,
                        enabled = state != ButtonState.DISABLED,
                        role = Role.Button,
                        onClick = { if (state.isActivatable) action() },
                    ).minimumInteractiveComponentSize(),
            leadingIcon = leadingIcon,
            showsSpinner = loading,
            fullWidth = fullWidth,
        )
    }
}

/** The state shown, first match wins (contract `states`): loading, disabled, pressed, focused, enabled. */
internal fun displayedButtonState(
    loading: Boolean,
    enabled: Boolean,
    pressed: Boolean,
    focused: Boolean,
): ButtonState =
    when {
        loading -> ButtonState.LOADING
        !enabled -> ButtonState.DISABLED
        pressed -> ButtonState.PRESSED
        focused -> ButtonState.FOCUSED
        else -> ButtonState.ENABLED
    }

/** Whether an activation in this state runs the action: never while loading or disabled. */
internal val ButtonState.isActivatable: Boolean
    get() = this != ButtonState.LOADING && this != ButtonState.DISABLED
