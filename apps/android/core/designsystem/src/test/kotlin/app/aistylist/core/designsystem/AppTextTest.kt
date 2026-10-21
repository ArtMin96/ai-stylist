package app.aistylist.core.designsystem

import androidx.compose.ui.test.assertTextEquals
import org.junit.Assert.assertEquals
import org.junit.Test

/** JVM (Robolectric) tests of AppText: a type style's text transform is drawn and never spoken. */
class AppTextTest : DesignSystemComposeTest() {
    @Test
    fun theOverlineDrawsInCapitalsAndIsReadAsWritten() {
        showThemed { AppText("Plus", AppTheme.typography.overline, subjectTag) }

        subject().assertTextEquals("Plus")
        assertEquals("PLUS", subject().drawnText())
    }

    @Test
    fun aStyleWithNoTransformDrawsTheTextAsWritten() {
        showThemed { AppText("Plus", AppTheme.typography.body, subjectTag) }

        subject().assertTextEquals("Plus")
        assertEquals("Plus", subject().drawnText())
    }
}
