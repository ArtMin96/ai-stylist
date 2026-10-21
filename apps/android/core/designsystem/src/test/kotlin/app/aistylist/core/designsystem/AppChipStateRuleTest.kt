package app.aistylist.core.designsystem

import androidx.compose.ui.graphics.Color
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.ChipSize
import app.aistylist.core.designsystem.generated.ChipSpec
import app.aistylist.core.designsystem.generated.ChipState
import app.aistylist.core.designsystem.generated.ChipVariant
import app.aistylist.core.designsystem.generated.ComponentGallery
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The five generated contexts, S3 brand included. */
private val ALL_CONTEXTS = listOf(ChipSpec.light, ChipSpec.dark, ChipSpec.brand, ChipSpec.hcLight, ChipSpec.hcDark)

/**
 * JVM tests of AppChip's state rule (contract G2), the looks it resolves in every context, and the
 * swatch-edge rule. No rendering: the roles and layout are in [AppChipTest].
 */
class AppChipStateRuleTest {
    /** [displayedChipState] with the resting defaults: no toggle, enabled, no interaction. */
    private fun stateOf(
        selected: Boolean = false,
        expanded: Boolean = false,
        enabled: Boolean = true,
        pressed: Boolean = false,
        focused: Boolean = false,
    ): ChipState? =
        displayedChipState(
            selected = selected,
            expanded = expanded,
            enabled = enabled,
            pressed = pressed,
            focused = focused,
        )

    @Test
    fun theDisplayedStateFollowsTheContractOrder() {
        assertEquals(ChipState.ENABLED, stateOf())
        assertEquals(ChipState.DISABLED, stateOf(enabled = false, pressed = true, focused = true))
        assertEquals(ChipState.PRESSED, stateOf(pressed = true, focused = true))
        assertEquals(ChipState.FOCUSED, stateOf(focused = true))
        assertEquals(ChipState.SELECTED, stateOf(selected = true))
        assertEquals(ChipState.SELECTED_PRESSED, stateOf(selected = true, pressed = true))
        assertEquals(ChipState.SELECTED_FOCUSED, stateOf(selected = true, focused = true))
        assertEquals(ChipState.SELECTED_DISABLED, stateOf(selected = true, enabled = false, pressed = true))
        assertEquals(ChipState.EXPANDED, stateOf(expanded = true))
        assertEquals(ChipState.EXPANDED_PRESSED, stateOf(expanded = true, pressed = true, focused = true))
        assertEquals(ChipState.EXPANDED_FOCUSED, stateOf(expanded = true, focused = true))
    }

    @Test
    fun combinationsNoStateCarriesHaveNoState() {
        assertNull(stateOf(selected = true, expanded = true))
        assertNull(stateOf(expanded = true, enabled = false))
    }

    @Test
    fun aRestingLookExistsExactlyWhereTheGalleryListsThatCombination() {
        val gallery = ComponentGallery.chip.mapTo(mutableSetOf()) { Triple(it.variant, it.size, it.state) }
        val pairs = ChipVariant.entries.flatMap { variant -> ChipSize.entries.map { size -> variant to size } }
        ALL_CONTEXTS.forEach { spec ->
            pairs.forEach { (variant, size) ->
                TOGGLES.forEach { (selected, expanded, enabled) ->
                    val state = stateOf(selected = selected, expanded = expanded, enabled = enabled)
                    val listed = state != null && Triple(variant, size, state) in gallery
                    val resolves = state?.let { spec.appearance(variant, size, it) } != null
                    assertEquals("$variant $size s=$selected e=$expanded on=$enabled", listed, resolves)
                }
            }
        }
    }

    @Test
    fun everyInteractionStateOfAnAllowedRestingStateHasALookInEveryContext() {
        // So the resting-look fallback for an interaction state with no look never shows today.
        val resting = ComponentGallery.chip.filter { it.state in RESTING_STATES }
        ALL_CONTEXTS.forEach { spec ->
            resting.forEach { entry ->
                val selected = entry.state == ChipState.SELECTED || entry.state == ChipState.SELECTED_DISABLED
                val expanded = entry.state == ChipState.EXPANDED
                val enabled = entry.state != ChipState.DISABLED && entry.state != ChipState.SELECTED_DISABLED
                listOf(false to false, true to false, false to true).forEach { (pressed, focused) ->
                    val state =
                        stateOf(
                            selected = selected,
                            expanded = expanded,
                            enabled = enabled,
                            pressed = pressed,
                            focused = focused,
                        )
                    assertNotNull(
                        "${entry.testId} p=$pressed f=$focused",
                        state?.let { spec.appearance(entry.variant, entry.size, it) },
                    )
                }
            }
        }
    }

    @Test
    fun everyGalleryEntryResolvesInAllFiveContextsWithAUniqueTestIdOfThePattern() {
        ALL_CONTEXTS.forEach { spec ->
            ComponentGallery.chip.forEach { entry ->
                assertNotNull(entry.testId, spec.appearance(entry.variant, entry.size, entry.state))
            }
        }
        val ids = ComponentGallery.chip.map { it.testId }
        assertEquals(84, ids.size)
        assertEquals(ids.size, ids.toSet().size)
        ComponentGallery.chip.forEach { entry ->
            assertEquals("ds-chip-${entry.variant.id}-${entry.size.id}-${entry.state.id}", entry.testId)
        }
    }

    @Test
    fun onlyTheDisabledStatesBlockActivation() {
        assertEquals(
            setOf(ChipState.DISABLED, ChipState.SELECTED_DISABLED),
            ChipState.entries.filterNot { it.isActivatable }.toSet(),
        )
    }

    @Test
    fun cameraInkOnTheLightSurfaceNeedsNoEdgeAndANearWhiteSwatchDoes() {
        val surface = AppColors.light.color(AppColorRole.SURFACE)
        val cameraInk = AppColors.light.color(AppColorRole.CAMERA_INK)
        val look = checkNotNull(ChipSpec.light.appearance(ChipVariant.SWATCH, ChipSize.LARGE, ChipState.ENABLED))
        val minContrast = checkNotNull(look.swatchEdgeMinContrast)

        assertEquals(AppColorRole.SURFACE, look.backgroundColor)
        assertFalse(needsSwatchEdge(cameraInk, surface, minContrast))
        assertTrue(needsSwatchEdge(Color.White, surface, minContrast))
    }

    @Test
    fun aSwatchOnAChipWithNoFillDrawsItsEdgeAndEverySwatchLookSetsAFill() {
        val cameraInk = AppColors.light.color(AppColorRole.CAMERA_INK)

        // Nothing is known behind the swatch, so even a high-contrast colour keeps its edge.
        assertTrue(needsSwatchEdge(cameraInk, fill = null, minContrast = 1.0))
        ALL_CONTEXTS.forEach { spec ->
            ComponentGallery.chip.filter { it.variant == ChipVariant.SWATCH }.forEach { entry ->
                assertNotNull(entry.testId, spec.appearance(entry.variant, entry.size, entry.state)?.backgroundColor)
            }
        }
    }

    @Test
    fun theContrastRatioIsTheWcagRatio() {
        assertEquals(21.0, contrastRatio(Color.Black, Color.White), 0.01)
        assertEquals(1.0, contrastRatio(Color.White, Color.White), 0.0001)
    }

    private companion object {
        /** The states a chip rests in with no interaction. */
        val RESTING_STATES =
            setOf(
                ChipState.ENABLED,
                ChipState.DISABLED,
                ChipState.SELECTED,
                ChipState.SELECTED_DISABLED,
                ChipState.EXPANDED,
            )

        val FLAGS = listOf(false, true)

        /** Every (selected, expanded, enabled) the caller can pass. */
        val TOGGLES: List<Triple<Boolean, Boolean, Boolean>> =
            FLAGS.flatMap { selected -> FLAGS.flatMap { expanded -> FLAGS.map { Triple(selected, expanded, it) } } }
    }
}
