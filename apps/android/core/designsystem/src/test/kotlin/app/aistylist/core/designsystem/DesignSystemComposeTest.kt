package app.aistylist.core.designsystem

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertWidthIsAtLeast
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import org.junit.Rule
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** The test tag of the component under test. */
internal const val SUBJECT_TAG = "ds-under-test"

/** Tags the component under test, so [DesignSystemComposeTest.subject] finds it. */
internal val subjectTag: Modifier = Modifier.testTag(SUBJECT_TAG)

/**
 * A JVM (Robolectric) Compose test of a design-system component at the project's SDK. Subclasses
 * draw the component, tagged with [subjectTag], through [showThemed], and find it with [subject].
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
abstract class DesignSystemComposeTest {
    @get:Rule
    val compose = createComposeRule()

    /** [content] in the design-system theme of the system settings (light under Robolectric). */
    protected fun showThemed(content: @Composable () -> Unit) {
        compose.setContent { AppTheme(content) }
    }

    /** The component under test: in what assistive tech reads, or as drawn when [unmerged]. */
    protected fun subject(unmerged: Boolean = false): SemanticsNodeInteraction =
        compose.onNodeWithTag(SUBJECT_TAG, useUnmergedTree = unmerged)
}

/** Assistive tech names this node [name]. */
internal fun SemanticsNodeInteraction.assertNamed(name: String): SemanticsNodeInteraction =
    assert(SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf(name)))

/** Assistive tech announces this node in [role]. */
internal fun SemanticsNodeInteraction.assertRole(role: Role): SemanticsNodeInteraction =
    assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, role))

/** Assistive tech speaks [words] as this node's state. */
internal fun SemanticsNodeInteraction.assertStateWords(words: String): SemanticsNodeInteraction =
    assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, words))

/** This node's hit area is at least [minTouchTarget] dp square (a generated `<Name>Accessibility` value). */
internal fun SemanticsNodeInteraction.assertTouchTargetAtLeast(minTouchTarget: Double): SemanticsNodeInteraction =
    assertHeightIsAtLeast(minTouchTarget.dp).assertWidthIsAtLeast(minTouchTarget.dp)

/** This node does not carry [key] (a property or an action). */
internal fun SemanticsNodeInteraction.assertLacks(key: SemanticsPropertyKey<*>): SemanticsNodeInteraction =
    assert(SemanticsMatcher.keyNotDefined(key))

/** The text this text node lays out: what the user sees, which its semantics text may not be. */
internal fun SemanticsNodeInteraction.drawnText(): String {
    val layouts = mutableListOf<TextLayoutResult>()
    performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
    return layouts
        .single()
        .layoutInput.text.text
}
