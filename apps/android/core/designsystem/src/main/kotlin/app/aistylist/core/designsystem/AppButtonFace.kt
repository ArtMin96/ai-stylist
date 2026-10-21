package app.aistylist.core.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.ButtonAppearance

/**
 * Draws one resolved [ButtonAppearance]: no interaction, no semantics of its own. `AppButton`
 * resolves the appearance from its state; the catalog forces each state through this view.
 *
 * For the catalog and snapshot tests only; product UI uses `AppButton` and `AppTheme {}`.
 */
@Composable
fun AppButtonFace(
    appearance: ButtonAppearance,
    label: String,
    modifier: Modifier = Modifier,
    leadingIcon: AppIconName? = null,
    showsSpinner: Boolean = false,
    fullWidth: Boolean = false,
) {
    val colors = AppTheme.colors
    val shape = RoundedCornerShape(appearance.rounded.dp)
    val background by animateColorAsState(colors.colorOrClear(appearance.backgroundColor), PressTransition, "fill")
    val overlay by animateColorAsState(colors.colorOrClear(appearance.overlayColor), PressTransition, "overlay")
    val content by animateColorAsState(colors.color(appearance.textColor), PressTransition, "label")
    // The spinner shares the icon slot, so it grows with the font scale exactly as the icon does.
    val slotSize = appearance.iconSize.renderedDp()
    Row(
        modifier =
            modifier
                .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
                .focusRing(appearance.focusRing, colors, appearance.rounded)
                .background(background, shape)
                .background(overlay, shape)
                .insideRing(colors, appearance.borderColor, appearance.borderWidth, shape)
                .heightIn(min = appearance.height.dp)
                .padding(appearance.contentPadding()),
        horizontalArrangement = Arrangement.spacedBy(appearance.iconGap.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            // The button announces "Loading" itself, so the spinner adds nothing for assistive tech.
            showsSpinner -> {
                CircularProgressIndicator(
                    modifier = Modifier.size(slotSize).clearAndSetSemantics {},
                    color = colors.color(appearance.spinnerColor ?: appearance.textColor),
                )
            }

            leadingIcon != null -> {
                CompositionLocalProvider(LocalContentColor provides content) {
                    AppIcon(leadingIcon, size = appearance.iconSize)
                }
            }
        }
        Text(
            text = label,
            color = content,
            style = appearance.typography.toTextStyle(),
            textAlign = TextAlign.Center,
        )
    }
}

private fun ButtonAppearance.contentPadding(): PaddingValues =
    lookPadding(paddingTop, paddingEnd, paddingBottom, paddingStart)
