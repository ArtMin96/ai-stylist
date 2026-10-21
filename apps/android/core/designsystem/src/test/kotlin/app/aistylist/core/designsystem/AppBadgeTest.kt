package app.aistylist.core.designsystem

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.onNodeWithText
import app.aistylist.core.designsystem.generated.AppColorRole
import app.aistylist.core.designsystem.generated.BadgeSize
import app.aistylist.core.designsystem.generated.BadgeSpec
import app.aistylist.core.designsystem.generated.BadgeVariant
import app.aistylist.core.designsystem.generated.ComponentGallery
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

private const val TRIAL = "Trial · 2 days left"

/** JVM (Robolectric) tests of AppBadge against the C03 badge contract. */
class AppBadgeTest : DesignSystemComposeTest() {
    private fun show(
        variant: BadgeVariant,
        size: BadgeSize,
        label: String?,
    ) {
        showThemed {
            AppBadge(
                variant = variant,
                size = size,
                modifier = subjectTag,
                label = label,
                hostSurface = AppColorRole.SURFACE2,
            )
        }
    }

    private fun assertExposesNothing() {
        subject(unmerged = true)
            .assertLacks(SemanticsProperties.ContentDescription)
            .assertLacks(SemanticsProperties.Text)
            .assertLacks(SemanticsProperties.Role)
    }

    @Test
    fun theDotExposesNoSemantics() {
        show(BadgeVariant.DOT, BadgeSize.SMALL, label = null)

        assertExposesNothing()
    }

    @Test
    fun theCountExposesNoSemanticsAndItsNumberIsNotRead() {
        show(BadgeVariant.COUNT, BadgeSize.MEDIUM, label = "2")

        assertExposesNothing()
        // Drawn (unmerged tree) but not in what assistive tech reads (merged tree).
        compose.onNodeWithText("2", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("2").assertDoesNotExist()
    }

    @Test
    fun theTrialPillIsReadAsItsLabel() {
        show(BadgeVariant.TRIAL_LAST_DAY, BadgeSize.LARGE, label = TRIAL)

        subject()
            .assertNamed(TRIAL)
            .assertLacks(SemanticsProperties.Role)
    }

    @Test
    fun aLabelledVariantWithoutALabelRendersNothing() {
        show(BadgeVariant.COUNT, BadgeSize.MEDIUM, label = null)

        subject(unmerged = true).assertDoesNotExist()
    }

    @Test
    fun aTrialWithoutALabelRendersNothing() {
        show(BadgeVariant.TRIAL, BadgeSize.LARGE, label = null)

        subject(unmerged = true).assertDoesNotExist()
    }

    @Test
    fun aCombinationTheContractDoesNotAllowRendersNothing() {
        show(BadgeVariant.DOT, BadgeSize.LARGE, label = null)

        subject(unmerged = true).assertDoesNotExist()
    }

    @Test
    fun everyGalleryEntryResolvesInAllFiveContextsWithAUniqueTestIdOfThePattern() {
        listOf(BadgeSpec.light, BadgeSpec.dark, BadgeSpec.brand, BadgeSpec.hcLight, BadgeSpec.hcDark).forEach { spec ->
            ComponentGallery.badge.forEach { entry ->
                assertNotNull(entry.testId, spec.appearance(entry.variant, entry.size, entry.state))
            }
        }
        assertEquals(
            4,
            ComponentGallery.badge
                .map { it.testId }
                .toSet()
                .size,
        )
        ComponentGallery.badge.forEach { entry ->
            assertEquals("ds-badge-${entry.variant.id}-${entry.size.id}-${entry.state.id}", entry.testId)
        }
    }
}
