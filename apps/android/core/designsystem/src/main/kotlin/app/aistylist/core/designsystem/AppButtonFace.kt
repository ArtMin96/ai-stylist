package app.aistylist.core.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
    val content = animatedRoleColor(appearance.textColor, "button label")
    Row(
        modifier =
            modifier
                .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
                .focusRing(appearance.focusRing, colors, appearance.rounded)
                .appShape(
                    colors,
                    appearance.rounded,
                    fill = animatedRoleColor(appearance.backgroundColor, "button fill"),
                    ringRole = appearance.borderColor,
                    ringWidth = appearance.borderWidth,
                    overlay = animatedRoleColor(appearance.overlayColor, "button overlay"),
                ).lookFrame(
                    appearance.height,
                    appearance.paddingTop,
                    appearance.paddingEnd,
                    appearance.paddingBottom,
                    appearance.paddingStart,
                ),
        horizontalArrangement = Arrangement.spacedBy(appearance.iconGap.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            // The button announces "Loading" itself, so the spinner adds nothing for assistive tech.
            // It shares the icon slot, so it grows with the font scale exactly as the icon does.
            showsSpinner -> {
                CircularProgressIndicator(
                    modifier = Modifier.size(appearance.iconSize.renderedDp()).hideContentSemantics(),
                    color = colors.color(appearance.spinnerColor ?: appearance.textColor),
                )
            }

            leadingIcon != null -> {
                FaceIcon(leadingIcon, appearance.iconSize, content)
            }
        }
        AppText(text = label, style = appearance.typography, color = content, textAlign = TextAlign.Center)
    }
}
