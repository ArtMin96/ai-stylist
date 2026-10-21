package app.aistylist.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.ReasonRowSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** JVM (Robolectric) tests of AppReasonRow against the C03 reason-row contract. */
class AppReasonRowTest : DesignSystemComposeTest() {
    private fun show() {
        showThemed {
            AppReasonRow(
                label = ComponentGallery.reasonRowLabel,
                fact = ComponentGallery.reasonRowFact,
                factIcon = ComponentGallery.reasonRowFactIcon,
                freshness = ComponentGallery.reasonRowFreshness,
                accessibilityLabel = ComponentGallery.reasonRowAccessibilityLabel,
                modifier = subjectTag,
            )
        }
    }

    @Test
    fun theRowIsARegionNamedByItsAccessibilityLabelWithNoAction() {
        show()

        subject()
            .assertNamed(ComponentGallery.reasonRowAccessibilityLabel)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.IsTraversalGroup, true))
            .assertLacks(SemanticsActions.OnClick)
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
    fun theRowFillsTheWidthItIsGiven() {
        showThemed {
            Box(Modifier.width(320.dp)) {
                AppReasonRow(
                    label = "Rain-ready",
                    fact = "Rain",
                    factIcon = ComponentGallery.reasonRowFactIcon,
                    freshness = "07:10",
                    accessibilityLabel = ComponentGallery.reasonRowAccessibilityLabel,
                    modifier = subjectTag,
                )
            }
        }

        subject().assertWidthIsEqualTo(320.dp)
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
