package app.aistylist.core.designsystem

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.ChipAccessibility
import app.aistylist.core.designsystem.generated.ChipPart
import app.aistylist.core.designsystem.generated.ChipSelection
import app.aistylist.core.designsystem.generated.ChipSize
import app.aistylist.core.designsystem.generated.ChipTestId
import app.aistylist.core.designsystem.generated.ChipVariant
import app.aistylist.core.designsystem.generated.ComponentGallery
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.robolectric.RuntimeEnvironment

private const val LABEL = "Wool"

/**
 * JVM (Robolectric) tests of AppChip against the C03 chip contract: its roles and semantics, its
 * layout and touch target, and its copy. The state rule is in [AppChipStateRuleTest].
 */
class AppChipTest : DesignSystemComposeTest() {
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
        showThemed {
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
        showThemed {
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
        AppChip(
            label = LABEL,
            variant = variant,
            size = size,
            action = { actions++ },
            modifier = subjectTag,
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

    @Test
    fun aButtonChipIsFoundByItsTagNamedByItsLabelAndRunsItsActionOncePerClick() {
        show(ChipVariant.WEATHER, ChipSize.SMALL)

        subject()
            .assertNamed(LABEL)
            .assertRole(Role.Button)
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

        subject().assertNamed("Group by category")
        // Drawn (unmerged tree) but not in what assistive tech reads (merged tree).
        compose.onNodeWithText("Group:", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Group:").assertDoesNotExist()
        compose.onNodeWithText(LABEL).assertDoesNotExist()
    }

    @Test
    fun theDetailIsDrawnAfterTheSeparatorAndNotReadSeparately() {
        showWithText(ChipVariant.FILTER, ChipSize.MEDIUM, detail = "12")

        subject().assertNamed(LABEL)
        compose.onNodeWithText("· 12", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("· 12").assertDoesNotExist()
    }

    @Test
    fun atTwiceTheFontScaleANarrowChipKeepsItsDetailAndItsTrailingIcon() {
        // An override chip: a leading icon, the label, a detail and a trailing icon.
        val cell = ComponentGallery.chip.first { it.testId == ChipTestId.overrideSmallEnabled }
        val look = checkNotNull(AppScheme.LIGHT.chips.appearance(cell.variant, cell.size, cell.state))
        showThemed {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 2f)) {
                Box(Modifier.width(120.dp)) {
                    AppChipFace(
                        appearance = look,
                        variant = cell.variant,
                        label = "Water-resistant wool overcoat with a detachable hood",
                        modifier = subjectTag,
                        leadingIcon = ComponentGallery.chipLeadingIcon,
                        detail = "12",
                    )
                }
            }
        }

        val chip = subject().fetchSemanticsNode().boundsInRoot
        val detail =
            compose
                .onNodeWithText("· 12", useUnmergedTree = true)
                .assertIsDisplayed()
                .fetchSemanticsNode()
                .boundsInRoot
        // The trailing icon sits between the detail and the end padding, after its gap.
        val endInset = with(compose.density) { (look.paddingEnd + checkNotNull(look.trailingIconGap)).dp.toPx() }
        val trailingIconWidth = chip.right - endInset - detail.right
        assertTrue("trailing icon width $trailingIconWidth px", trailingIconWidth > 0f)
    }

    @Test
    fun inAHorizontallyScrollingRowTheLabelAndDetailKeepTheirWidth() {
        showThemed {
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                ChipUnderTest(ChipVariant.FILTER, ChipSize.MEDIUM, detail = "12")
            }
        }

        // The row leaves the width unbounded; the text runs must not collapse to nothing.
        compose.onNodeWithText(LABEL, useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithText("· 12", useUnmergedTree = true).assertIsDisplayed()
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

        subject().assertIsNotEnabled().performClick()

        assertEquals(0, actions)
    }

    @Test
    fun aSelectedDisabledChipStaysCheckedAndIgnoresClicks() {
        show(ChipVariant.FILTER, ChipSize.MEDIUM, selected = true, enabled = false)

        subject()
            .assertIsNotEnabled()
            .assertIsOn()
            .performClick()

        assertEquals(0, actions)
    }

    @Test
    fun aMultipleSelectionChipIsACheckboxToggle() {
        show(ChipVariant.CHOICE, ChipSize.LARGE, selected = true, selection = ChipSelection.MULTIPLE)

        subject()
            .assertRole(Role.Checkbox)
            .assertIsOn()
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun anUnselectedMultipleSelectionChipIsOff() {
        show(ChipVariant.SWATCH, ChipSize.LARGE)

        subject().assertIsOff().assertIsEnabled()
    }

    @Test
    fun aSingleSelectionChipIsARadioButton() {
        show(ChipVariant.FILTER, ChipSize.MEDIUM, selected = true, selection = ChipSelection.SINGLE)

        subject()
            .assertRole(Role.RadioButton)
            .assertIsSelected()
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun aCollapsedReasonChipSaysCollapsedAndOffersOnlyExpand() {
        show(ChipVariant.REASON, ChipSize.COMPACT)

        subject()
            .assertRole(Role.Button)
            .assertStateWords("Collapsed")
            .assertLacks(SemanticsActions.Collapse)
            .performSemanticsAction(SemanticsActions.Expand)

        assertEquals(1, actions)
    }

    @Test
    fun anExpandedReasonChipSaysExpandedAndOffersOnlyCollapse() {
        show(ChipVariant.REASON, ChipSize.COMPACT, expanded = true)

        subject()
            .assertStateWords("Expanded")
            .assertLacks(SemanticsActions.Expand)
            .performSemanticsAction(SemanticsActions.Collapse)

        assertEquals(1, actions)
    }

    @Test
    fun aMenuChipIsADropDownListMarkedSelectedOnlyWhileSelected() {
        show(ChipVariant.FILTER_MENU, ChipSize.MEDIUM, selected = true)

        subject()
            .assertRole(Role.DropdownList)
            .assertIsSelected()
            .performClick()

        assertEquals(1, actions)
    }

    @Test
    fun anUnselectedMenuChipHasNoSelectedState() {
        showWithText(ChipVariant.GROUP_SORT, ChipSize.MEDIUM, prefix = "Group:")

        subject()
            .assertRole(Role.DropdownList)
            .assertLacks(SemanticsProperties.Selected)
            .assertIsEnabled()
    }

    @Test
    fun aDisallowedSizeRendersNothing() {
        show(ChipVariant.WEATHER, ChipSize.LARGE)

        subject().assertDoesNotExist()
    }

    @Test
    fun aToggleTheVariantDoesNotTakeRendersNothing() {
        show(ChipVariant.CHOICE, ChipSize.LARGE, expanded = true)

        subject().assertDoesNotExist()
    }

    @Test
    fun disablingAVariantThatIsNeverDisabledRendersNothing() {
        show(ChipVariant.WEATHER, ChipSize.SMALL, enabled = false)

        subject().assertDoesNotExist()
    }

    @Test
    fun everySizeHasTheGeneratedTouchTargetEvenUnderASmallerAncestorMinimum() {
        val variantForSize =
            ChipSize.entries.associateWith { size -> ComponentGallery.chip.first { it.size == size }.variant }
        showThemed {
            // The chip provides its own minimum from the contract, whatever the screen sets.
            CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides 0.dp) {
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
            compose.onNodeWithTag(size.id).assertTouchTargetAtLeast(ChipAccessibility.minTouchTarget)
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
}
