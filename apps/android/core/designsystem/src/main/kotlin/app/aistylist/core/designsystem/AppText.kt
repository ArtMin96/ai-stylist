package app.aistylist.core.designsystem

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.toUpperCase
import app.aistylist.core.designsystem.generated.AppTextStyle
import app.aistylist.core.designsystem.generated.AppTextTransform

/**
 * [text] in the type style [style] and its bundled font, in [color] (unspecified: the host's content
 * colour, which `AppTheme` sets to the `text` role). The style's `textTransform` changes only the
 * drawn glyphs (the overline draws in capitals); assistive tech reads [text] as given. Every
 * design-system text goes through it, so no caller can drop the transform.
 */
@Composable
fun AppText(
    text: String,
    style: AppTextStyle,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    textAlign: TextAlign? = null,
) {
    Text(
        text = style.textTransform.drawn(text),
        // Outside Text's own semantics, so the caller's string replaces the drawn one for assistive tech.
        modifier = modifier.semantics { this.text = AnnotatedString(text) },
        color = color,
        style = style.toTextStyle(),
        textAlign = textAlign,
    )
}

/** [text] as this transform draws it, cased for the user's locale. */
internal fun AppTextTransform.drawn(text: String): String =
    when (this) {
        AppTextTransform.NONE -> text
        AppTextTransform.UPPERCASE -> text.toUpperCase(LocaleList.current)
    }
