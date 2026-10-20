package app.aistylist.core.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonState
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.core.designsystem.generated.ComponentGallery
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val LABEL = "Continue"
private const val TAG = "ds-button-under-test"

/** JVM (Robolectric) tests of AppButton against the C01 contract. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class AppButtonTest {
    @get:Rule
    val compose = createComposeRule()

    private var actions = 0

    private fun show(
        variant: ButtonVariant = ButtonVariant.PRIMARY,
        size: ButtonSize = ButtonSize.LARGE,
        enabled: Boolean = true,
        loading: Boolean = false,
    ) {
        compose.setContent {
            AppTheme {
                AppButton(
                    label = LABEL,
                    variant = variant,
                    size = size,
                    action = { actions++ },
                    modifier = Modifier.testTag(TAG),
                    enabled = enabled,
                    loading = loading,
                )
            }
        }
    }

    @Test
    fun anEnabledButtonIsFoundByItsTagAndRunsItsActionOncePerClick() {
        show()

        compose
            .onNodeWithTag(TAG)
            .assertTextEquals(LABEL)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun aClickWhileLoadingIsIgnoredAndTheButtonIsAnnouncedAsLoading() {
        show(loading = true)

        compose
            .onNodeWithTag(TAG)
            .assertIsEnabled()
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Loading"))
            .performClick()

        assertEquals(0, actions)
        compose.onNodeWithText(LABEL).assertIsDisplayed()
    }

    @Test
    fun aDisabledButtonIsNotEnabledAndIgnoresClicks() {
        show(enabled = false)

        compose.onNodeWithTag(TAG).assertIsNotEnabled().performClick()

        assertEquals(0, actions)
    }

    @Test
    fun aCombinationTheContractDoesNotAllowRendersNothing() {
        show(variant = ButtonVariant.TEXT, size = ButtonSize.SMALL)

        compose.onNodeWithTag(TAG).assertDoesNotExist()
        compose.onNodeWithText(LABEL).assertDoesNotExist()
    }

    @Test
    fun everySizeHasATouchTargetOfAtLeast48dp() {
        val variantForSize =
            ButtonSize.entries.associateWith { size ->
                ComponentGallery.button.first { it.size == size }.variant
            }
        compose.setContent {
            AppTheme {
                Column {
                    variantForSize.forEach { (size, variant) ->
                        AppButton(
                            label = LABEL,
                            variant = variant,
                            size = size,
                            action = {},
                            modifier = Modifier.testTag(size.id),
                        )
                    }
                }
            }
        }

        ButtonSize.entries.forEach { size ->
            compose.onNodeWithTag(size.id).assertHeightIsAtLeast(48.dp).assertWidthIsAtLeast(48.dp)
        }
    }

    @Test
    fun theDisplayedStateFollowsTheContractOrder() {
        assertEquals(
            ButtonState.LOADING,
            displayedButtonState(loading = true, enabled = false, pressed = true, focused = true),
        )
        assertEquals(
            ButtonState.DISABLED,
            displayedButtonState(loading = false, enabled = false, pressed = true, focused = true),
        )
        assertEquals(
            ButtonState.PRESSED,
            displayedButtonState(loading = false, enabled = true, pressed = true, focused = true),
        )
        assertEquals(
            ButtonState.FOCUSED,
            displayedButtonState(loading = false, enabled = true, pressed = false, focused = true),
        )
        assertEquals(
            ButtonState.ENABLED,
            displayedButtonState(loading = false, enabled = true, pressed = false, focused = false),
        )
    }

    @Test
    fun onlyEnabledPressedAndFocusedStatesActivate() {
        assertEquals(
            listOf(ButtonState.ENABLED, ButtonState.PRESSED, ButtonState.FOCUSED),
            ButtonState.entries.filter { it.isActivatable },
        )
    }

    @Test
    fun aPairResolvesInEverySchemeExactlyWhenTheGalleryHasIt() {
        val galleryPairs = ComponentGallery.button.mapTo(mutableSetOf()) { it.variant to it.size }
        AppScheme.entries.forEach { scheme ->
            ButtonVariant.entries.forEach { variant ->
                ButtonSize.entries.forEach { size ->
                    val resolves = scheme.buttons.appearance(variant, size, ButtonState.ENABLED) != null
                    assertEquals("$scheme $variant $size", (variant to size) in galleryPairs, resolves)
                }
            }
        }
    }
}
