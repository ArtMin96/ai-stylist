package app.aistylist.core.designsystem

import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.ReasonRowSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val TAG = "ds-reason-row-under-test"

/** JVM (Robolectric) tests of AppReasonRow against the C03 reason-row contract. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class AppReasonRowTest {
    @get:Rule
    val compose = createComposeRule()

    private fun show() {
        compose.setContent {
            AppTheme {
                AppReasonRow(
                    label = ComponentGallery.reasonRowLabel,
                    fact = ComponentGallery.reasonRowFact,
                    factIcon = ComponentGallery.reasonRowFactIcon,
                    freshness = ComponentGallery.reasonRowFreshness,
                    accessibilityLabel = ComponentGallery.reasonRowAccessibilityLabel,
                    modifier = Modifier.testTag(TAG),
                )
            }
        }
    }

    @Test
    fun theRowIsARegionNamedByItsAccessibilityLabelWithNoAction() {
        show()

        compose
            .onNodeWithTag(TAG)
            .assert(
                SemanticsMatcher.expectValue(
                    SemanticsProperties.ContentDescription,
                    listOf(ComponentGallery.reasonRowAccessibilityLabel),
                ),
            ).assert(SemanticsMatcher.expectValue(SemanticsProperties.IsTraversalGroup, true))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
    }

    @Test
    fun itsThreeLinesAreSeparateNodesReadTopToBottom() {
        show()

        val tops =
            listOf(ComponentGallery.reasonRowLabel, ComponentGallery.reasonRowFact, ComponentGallery.reasonRowFreshness)
                .map { line ->
                    compose
                        .onNodeWithText(line)
                        .fetchSemanticsNode()
                        .positionInRoot.y
                }

        assertTrue("lines out of order: $tops", tops.zipWithNext().all { (above, below) -> above < below })
    }

    @Test
    fun theOneEntryResolvesInAllFiveContextsWithItsTestId() {
        listOf(
            ReasonRowSpec.light,
            ReasonRowSpec.dark,
            ReasonRowSpec.brand,
            ReasonRowSpec.hcLight,
            ReasonRowSpec.hcDark,
        ).forEach { spec ->
            ComponentGallery.reasonRow.forEach { entry ->
                assertNotNull(entry.testId, spec.appearance(entry.variant, entry.size, entry.state))
            }
        }
        assertEquals(listOf("ds-reason-row-standard-standard-enabled"), ComponentGallery.reasonRow.map { it.testId })
    }
}
