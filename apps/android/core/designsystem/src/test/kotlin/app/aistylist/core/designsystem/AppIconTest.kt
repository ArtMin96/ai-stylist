package app.aistylist.core.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppIconName
import app.aistylist.core.designsystem.generated.AppIconSize
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val TAG = "ds-icon-under-test"

/** JVM (Robolectric) tests of AppIcon against the C02 contract, at 100 % font scale. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class AppIconTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun theFrameIsExactlyTheTokenSizeAtEveryStep() {
        compose.setContent {
            AppTheme {
                Column {
                    AppIconSize.entries.forEach { step ->
                        AppIcon(AppIconName.CHEVRON_RIGHT, Modifier.testTag(step.id), size = step)
                    }
                }
            }
        }

        AppIconSize.entries.forEach { step ->
            compose
                .onNodeWithTag(step.id)
                .assertWidthIsEqualTo(step.size.dp)
                .assertHeightIsEqualTo(step.size.dp)
        }
    }

    @Test
    fun anUntintedIconUnderAPlainColumnDrawsInTheSchemesTextRole() {
        val resolved = mutableMapOf<AppScheme, Color>()
        compose.setContent {
            AppScheme.entries.forEach { scheme ->
                AppTheme(scheme = scheme) {
                    Column { resolved[scheme] = appIconColor(tint = null) }
                }
            }
        }
        compose.waitForIdle()

        assertEquals(setOf(AppScheme.LIGHT, AppScheme.DARK, AppScheme.HC_LIGHT, AppScheme.HC_DARK), resolved.keys)
        AppScheme.entries.forEach { scheme ->
            assertEquals(scheme.name, scheme.colors.color(AppColorRole.TEXT), resolved[scheme])
        }
    }

    @Test
    fun aTintedIconIsDecorativeAndKeepsTheCallersTag() {
        compose.setContent {
            AppTheme { AppIcon(AppIconName.WARNING, Modifier.testTag(TAG), tint = AppColorRole.WARNING_FG) }
        }

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.ContentDescription))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Text))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Role))
    }
}
