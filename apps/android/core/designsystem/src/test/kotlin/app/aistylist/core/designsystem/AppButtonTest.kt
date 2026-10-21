package app.aistylist.core.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.ButtonAccessibility
import app.aistylist.core.designsystem.generated.ButtonSize
import app.aistylist.core.designsystem.generated.ButtonState
import app.aistylist.core.designsystem.generated.ButtonVariant
import app.aistylist.core.designsystem.generated.ComponentGallery
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

private const val LABEL = "Continue"

/** JVM (Robolectric) tests of AppButton against the C01 contract. */
class AppButtonTest : DesignSystemComposeTest() {
    private var actions = 0

    private fun show(
        variant: ButtonVariant = ButtonVariant.PRIMARY,
        size: ButtonSize = ButtonSize.LARGE,
        enabled: Boolean = true,
        loading: Boolean = false,
    ) {
        showThemed {
            AppButton(
                label = LABEL,
                variant = variant,
                size = size,
                action = { actions++ },
                modifier = subjectTag,
                enabled = enabled,
                loading = loading,
            )
        }
    }

    @Test
    fun anEnabledButtonIsFoundByItsTagAndRunsItsActionOncePerClick() {
        show()

        subject()
            .assertTextEquals(LABEL)
            .assertRole(Role.Button)
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun aClickWhileLoadingIsIgnoredAndTheButtonIsAnnouncedAsLoading() {
        show(loading = true)

        subject()
            .assertIsEnabled()
            .assertStateWords("Loading")
            .performClick()

        assertEquals(0, actions)
        compose.onNodeWithText(LABEL).assertIsDisplayed()
    }

    @Test
    fun aDisabledButtonIsNotEnabledAndIgnoresClicks() {
        show(enabled = false)

        subject().assertIsNotEnabled().performClick()

        assertEquals(0, actions)
    }

    @Test
    fun aCombinationTheContractDoesNotAllowRendersNothing() {
        show(variant = ButtonVariant.TEXT, size = ButtonSize.SMALL)

        subject().assertDoesNotExist()
        compose.onNodeWithText(LABEL).assertDoesNotExist()
    }

    @Test
    fun everySizeHasTheGeneratedTouchTargetEvenUnderASmallerAncestorMinimum() {
        val variantForSize =
            ButtonSize.entries.associateWith { size ->
                ComponentGallery.button.first { it.size == size }.variant
            }
        showThemed {
            // The button provides its own minimum from the contract, whatever the screen sets.
            CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides 0.dp) {
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
            compose.onNodeWithTag(size.id).assertTouchTargetAtLeast(ButtonAccessibility.minTouchTarget)
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

    @Test
    fun everyAllowedPairHasAPressedAndAFocusedLookInEveryScheme() {
        // So the resting-look fallback for an interaction state with no look never shows today.
        AppScheme.entries.forEach { scheme ->
            ComponentGallery.button.filter { it.state == ButtonState.ENABLED }.forEach { entry ->
                listOf(ButtonState.PRESSED, ButtonState.FOCUSED).forEach { state ->
                    assertNotNull(
                        "$scheme ${entry.testId} $state",
                        scheme.buttons.appearance(entry.variant, entry.size, state),
                    )
                }
            }
        }
    }
}
