package app.aistylist.core.designsystem

import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.TagSize
import app.aistylist.core.designsystem.generated.TagSpec
import app.aistylist.core.designsystem.generated.TagVariant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val TAG = "ds-tag-under-test"

/** JVM (Robolectric) tests of AppTag against the C03 tag contract. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class AppTagTest {
    @get:Rule
    val compose = createComposeRule()

    private fun show(
        variant: TagVariant,
        size: TagSize,
        accessibilityLabel: String? = null,
    ) {
        compose.setContent {
            AppTheme {
                AppTag(
                    label = ComponentGallery.tagLabel,
                    variant = variant,
                    size = size,
                    modifier = Modifier.testTag(TAG),
                    leadingIcon = ComponentGallery.tagLeadingIcon,
                    accessibilityLabel = accessibilityLabel,
                )
            }
        }
    }

    @Test
    fun aTagIsReadAsItsLabelWithNoRoleNoActionAndNoFocus() {
        show(TagVariant.PLAN_PLUS, TagSize.REGULAR)

        compose
            .onNodeWithTag(TAG)
            .assert(
                SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf(ComponentGallery.tagLabel)),
            ).assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Role))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsProperties.Focused))
    }

    @Test
    fun theAccessibilityLabelOverridesTheLabel() {
        show(TagVariant.LOCK, TagSize.REGULAR, accessibilityLabel = "Needs Plus")

        compose
            .onNodeWithTag(TAG)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf("Needs Plus")))
    }

    @Test
    fun aCombinationTheContractDoesNotAllowRendersNothing() {
        show(TagVariant.DIFFERS, TagSize.REGULAR)

        compose.onNodeWithTag(TAG).assertDoesNotExist()
    }

    @Test
    fun everyGalleryEntryResolvesInAllFiveContextsWithAUniqueTestIdOfThePattern() {
        listOf(TagSpec.light, TagSpec.dark, TagSpec.brand, TagSpec.hcLight, TagSpec.hcDark).forEach { spec ->
            ComponentGallery.tag.forEach { entry ->
                assertNotNull(entry.testId, spec.appearance(entry.variant, entry.size, entry.state))
            }
        }
        val ids = ComponentGallery.tag.map { it.testId }
        assertEquals(12, ids.toSet().size)
        ComponentGallery.tag.forEach { entry ->
            assertEquals("ds-tag-${entry.variant.id}-${entry.size.id}-${entry.state.id}", entry.testId)
        }
    }
}
