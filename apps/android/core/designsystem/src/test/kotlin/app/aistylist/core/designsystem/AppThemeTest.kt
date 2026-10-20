package app.aistylist.core.designsystem

import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import app.aistylist.core.designsystem.generated.AppTextStyle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class AppThemeTest {
    /** Every type style of the generated scale, read from its getters so a new style is covered too. */
    private val typeStyles: List<AppTextStyle> =
        AppTheme.typography.javaClass.declaredMethods
            .filter { it.parameterCount == 0 && it.returnType == AppTextStyle::class.java }
            .map { it.invoke(AppTheme.typography) as AppTextStyle }

    @Test
    fun everyTypeStyleRendersInABundledFontAtItsOwnWeight() {
        assertTrue(typeStyles.isNotEmpty())
        typeStyles.forEach { style ->
            val textStyle = style.toTextStyle()
            assertNotEquals(style.fontFamily, FontFamily.Default, textStyle.fontFamily)
            assertTrue(style.fontFamily, textStyle.fontFamily in setOf(FigtreeFontFamily, YoungSerifFontFamily))
            assertEquals(style.fontFamily, FontWeight(style.fontWeight), textStyle.fontWeight)
        }
    }

    @Test
    fun theSchemeFollowsDarkModeAndHighContrast() {
        assertEquals(AppScheme.LIGHT, AppScheme.of(dark = false, highContrast = false))
        assertEquals(AppScheme.DARK, AppScheme.of(dark = true, highContrast = false))
        assertEquals(AppScheme.HC_LIGHT, AppScheme.of(dark = false, highContrast = true))
        assertEquals(AppScheme.HC_DARK, AppScheme.of(dark = true, highContrast = true))
    }
}
