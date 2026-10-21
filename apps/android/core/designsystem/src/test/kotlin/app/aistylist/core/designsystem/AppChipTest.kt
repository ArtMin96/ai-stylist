package app.aistylist.core.designsystem

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.AppColors
import app.aistylist.core.designsystem.generated.ChipPart
import app.aistylist.core.designsystem.generated.ChipSelection
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
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

private const val LABEL = "Wool"
private const val TAG = "ds-chip-under-test"

/** The five generated contexts, S3 brand included. */
private val ALL_CONTEXTS = listOf(ChipSpec.light, ChipSpec.dark, ChipSpec.brand, ChipSpec.hcLight, ChipSpec.hcDark)

/** JVM (Robolectric) tests of AppChip against the C03 chip contract. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class AppChipTest {
    @get:Rule
    val compose = createComposeRule()

    private var actions = 0

    /** A chip in its toggles and selection. */
    private fun show(
        variant: ChipVariant,
        size: ChipSize,
        selected: Boolean = false,
        expanded: Boolean = false,
        enabled: Boolean = true,
        selection: ChipSelection = ChipSelection.MULTIPLE,
    ) {
        compose.setContent {
            ChipUnderTest(
                variant,
                size,
                selected = selected,
                expanded = expanded,
                enabled = enabled,
                selection = selection,
            )
        }
    }

    /** A chip with its text parts and spoken name. */
    private fun showWithText(
        variant: ChipVariant,
        size: ChipSize,
        prefix: String? = null,
        detail: String? = null,
        accessibilityLabel: String? = null,
    ) {
        compose.setContent {
            ChipUnderTest(variant, size, prefix = prefix, detail = detail, accessibilityLabel = accessibilityLabel)
        }
    }

    @Composable
    private fun ChipUnderTest(
        variant: ChipVariant,
        size: ChipSize,
        selected: Boolean = false,
        expanded: Boolean = false,
        enabled: Boolean = true,
        selection: ChipSelection = ChipSelection.MULTIPLE,
        prefix: String? = null,
        detail: String? = null,
        accessibilityLabel: String? = null,
    ) {
        AppTheme {
            AppChip(
                label = LABEL,
                variant = variant,
                size = size,
                action = { actions++ },
                modifier = Modifier.testTag(TAG),
                leadingIcon = ComponentGallery.chipLeadingIcon,
                selected = selected,
                expanded = expanded,
                enabled = enabled,
                selection = selection,
                prefix = prefix,
                detail = detail,
                accessibilityLabel = accessibilityLabel,
            )
        }
    }

    @Test
    fun aButtonChipIsFoundByItsTagNamedByItsLabelAndRunsItsActionOncePerClick() {
        show(ChipVariant.WEATHER, ChipSize.SMALL)

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf(LABEL)))
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun theAccessibilityLabelReplacesTheLabelAndThePrefixIsNotRead() {
        showWithText(
            ChipVariant.GROUP_SORT,
            ChipSize.MEDIUM,
            prefix = "Group:",
            accessibilityLabel = "Group by category",
        )

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf("Group by category")))
        // Drawn (unmerged tree) but not in what assistive tech reads (merged tree).
        compose.onNodeWithText("Group:", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Group:").assertDoesNotExist()
        compose.onNodeWithText(LABEL).assertDoesNotExist()
    }

    @Test
    fun theDetailIsDrawnAfterTheSeparatorAndNotReadSeparately() {
        showWithText(ChipVariant.FILTER, ChipSize.MEDIUM, detail = "12")

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf(LABEL)))
        compose.onNodeWithText("· 12", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("· 12").assertDoesNotExist()
    }

    @Test
    fun aPartTheVariantDoesNotHaveIsNotDrawn() {
        showWithText(ChipVariant.CHOICE, ChipSize.LARGE, prefix = "Group:", detail = "12")

        compose.onNodeWithText("Group:", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithText("12", substring = true, useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithText(LABEL, useUnmergedTree = true).assertExists()
    }

    @Test
    fun aDisabledChipIsNotEnabledAndIgnoresClicks() {
        show(ChipVariant.CHOICE, ChipSize.LARGE, enabled = false)

        compose.onNodeWithTag(TAG).assertIsNotEnabled().performClick()

        assertEquals(0, actions)
    }

    @Test
    fun aSelectedDisabledChipStaysCheckedAndIgnoresClicks() {
        show(ChipVariant.FILTER, ChipSize.MEDIUM, selected = true, enabled = false)

        compose
            .onNodeWithTag(TAG)
            .assertIsNotEnabled()
            .assertIsOn()
            .performClick()

        assertEquals(0, actions)
    }

    @Test
    fun aMultipleSelectionChipIsACheckboxToggle() {
        show(ChipVariant.CHOICE, ChipSize.LARGE, selected = true, selection = ChipSelection.MULTIPLE)

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Checkbox))
            .assertIsOn()
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun anUnselectedMultipleSelectionChipIsOff() {
        show(ChipVariant.SWATCH, ChipSize.LARGE)

        compose.onNodeWithTag(TAG).assertIsOff().assertIsEnabled()
    }

    @Test
    fun aSingleSelectionChipIsARadioButton() {
        show(ChipVariant.FILTER, ChipSize.MEDIUM, selected = true, selection = ChipSelection.SINGLE)

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton))
            .assertIsSelected()
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun aCollapsedReasonChipSaysCollapsedAndOffersOnlyExpand() {
        show(ChipVariant.REASON, ChipSize.COMPACT)

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Collapsed"))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.Collapse))
            .performSemanticsAction(SemanticsActions.Expand)

        assertEquals(1, actions)
    }

    @Test
    fun anExpandedReasonChipSaysExpandedAndOffersOnlyCollapse() {
        show(ChipVariant.REASON, ChipSize.COMPACT, expanded = true)

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Expanded"))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.Expand))
            .performSemanticsAction(SemanticsActions.Collapse)

        assertEquals(1, actions)
    }

    @Test
    fun aMenuChipIsADropDownListMarkedSelectedOnlyWhileSelected() {
        show(ChipVariant.FILTER_MENU, ChipSize.MEDIUM, selected = true)

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.DropdownList))
            .assertIsSelected()
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun anUnselectedMenuChipHasNoSelectedState() {
        showWithText(ChipVariant.GROUP_SORT, ChipSize.MEDIUM, prefix = "Group:")

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.DropdownList))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Selected))
        compose.onNodeWithTag(TAG).assertIsEnabled()
    }

    @Test
    fun aDisallowedSizeRendersNothing() {
        show(ChipVariant.WEATHER, ChipSize.LARGE)

        compose.onNodeWithTag(TAG).assertDoesNotExist()
    }

    @Test
    fun aToggleTheVariantDoesNotTakeRendersNothing() {
        show(ChipVariant.CHOICE, ChipSize.LARGE, expanded = true)

        compose.onNodeWithTag(TAG).assertDoesNotExist()
    }

    @Test
    fun disablingAVariantThatIsNeverDisabledRendersNothing() {
        show(ChipVariant.WEATHER, ChipSize.SMALL, enabled = false)

        compose.onNodeWithTag(TAG).assertDoesNotExist()
    }

    @Test
    fun everySizeHasATouchTargetOfAtLeast48dp() {
        val variantForSize =
            ChipSize.entries.associateWith { size -> ComponentGallery.chip.first { it.size == size }.variant }
        compose.setContent {
            AppTheme {
                Column {
                    variantForSize.forEach { (size, variant) ->
                        AppChip(
                            label = LABEL,
                            variant = variant,
                            size = size,
                            action = {},
                            modifier = Modifier.testTag(size.id),
                            leadingIcon = ComponentGallery.chipLeadingIcon,
                        )
                    }
                }
            }
        }

        ChipSize.entries.forEach { size ->
            compose.onNodeWithTag(size.id).assertHeightIsAtLeast(48.dp).assertWidthIsAtLeast(48.dp)
        }
    }

    @Test
    fun theDetailSeparatorIsAMiddleDotAndASpaceUnderTheGeneratedKey() {
        val resources = RuntimeEnvironment.getApplication().resources

        val separator = resources.getString(R.string.ds_chip_detail_separator)

        assertEquals("· ", separator)
        assertEquals(2, separator.length)
        assertTrue(separator.endsWith(' '))
        assertEquals(ChipPart.DETAIL.separatorKey, resources.getResourceEntryName(R.string.ds_chip_detail_separator))
    }

    @Test
    fun theSpokenStatesAndTheLoadingWordAreTheSharedCopy() {
        val resources = RuntimeEnvironment.getApplication().resources

        assertEquals("Expanded", resources.getString(R.string.ds_chip_state_expanded))
        assertEquals("Collapsed", resources.getString(R.string.ds_chip_state_collapsed))
        assertEquals("Loading", resources.getString(R.string.app_button_loading))
    }

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
