package app.aistylist.core.designsystem

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.aistylist.core.designsystem.generated.AppTextStyle

/**
 * Figtree is one variable font whose default instance is Light 300, so each weight the type styles
 * use sets its `wght` axis explicitly.
 */
internal val FigtreeFontFamily: FontFamily =
    FontFamily(
        listOf(FontWeight.W400, FontWeight.W500, FontWeight.W600, FontWeight.W700).map { weight ->
            Font(
                resId = R.font.figtree_variable,
                weight = weight,
                variationSettings = FontVariation.Settings(FontVariation.weight(weight.weight)),
            )
        },
    )

/** Young Serif ships Regular 400 only. */
internal val YoungSerifFontFamily: FontFamily = FontFamily(Font(R.font.young_serif_regular, FontWeight.W400))

/** The bundled family for each `AppTextStyle.fontFamily` name; there is no system fallback. */
private val bundledFontFamilies: Map<String, FontFamily> =
    mapOf(
        "Figtree" to FigtreeFontFamily,
        "Young Serif" to YoungSerifFontFamily,
    )

/** This type style as a Compose [TextStyle] in its bundled font; sizes in sp, so it follows font scale. */
fun AppTextStyle.toTextStyle(): TextStyle =
    TextStyle(
        fontFamily = checkNotNull(bundledFontFamilies[fontFamily]) { "No bundled font for the family $fontFamily" },
        fontWeight = FontWeight(fontWeight),
        fontSize = fontSize.sp,
        lineHeight = lineHeight.sp,
        letterSpacing = letterSpacing.sp,
    )
