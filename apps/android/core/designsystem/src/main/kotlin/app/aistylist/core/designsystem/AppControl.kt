package app.aistylist.core.designsystem

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp

// What the tappable components (AppButton, AppChip) share: their interaction state and touch target.

/** A control's interaction source and the press and focus it reports. */
internal class ControlInteraction(
    val source: MutableInteractionSource,
    val pressed: Boolean,
    val focused: Boolean,
)

/** The interaction source of one control, remembered, with its current press and focus. */
@Composable
internal fun rememberControlInteraction(): ControlInteraction {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val focused by source.collectIsFocusedAsState()
    return ControlInteraction(source, pressed = pressed, focused = focused)
}

/**
 * [content] with the contract's minimum touch target, [minTouchTarget] dp (the generated
 * `<Name>Accessibility.minTouchTarget`). `Modifier.minimumInteractiveComponentSize()` inside reads it
 * through `LocalMinimumInteractiveComponentSize`, so the hit area grows to it and the look does not.
 */
@Composable
internal fun ProvideTouchTarget(
    minTouchTarget: Double,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides minTouchTarget.dp, content = content)
}
