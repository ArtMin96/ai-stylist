package app.aistylist.core.designsystem

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.onNodeWithText
import app.aistylist.core.designsystem.generated.ComponentGallery
import app.aistylist.core.designsystem.generated.TagSize
import app.aistylist.core.designsystem.generated.TagSpec
import app.aistylist.core.designsystem.generated.TagVariant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/** JVM (Robolectric) tests of AppTag against the C03 tag contract. */
class AppTagTest : DesignSystemComposeTest() {
    private fun show(
        variant: TagVariant,
        size: TagSize,
        accessibilityLabel: String? = null,
    ) {
        showThemed {
            AppTag(
                label = ComponentGallery.tagLabel,
                variant = variant,
                size = size,
                modifier = subjectTag,
                leadingIcon = ComponentGallery.tagLeadingIcon,
                accessibilityLabel = accessibilityLabel,
            )
        }
    }

    @Test
    fun aTagIsReadAsItsLabelWithNoRoleNoActionAndNoFocus() {
        show(TagVariant.PLAN_PLUS, TagSize.REGULAR)

        subject()
            .assertNamed(ComponentGallery.tagLabel)
            .assertLacks(SemanticsProperties.Role)
            .assertLacks(SemanticsActions.OnClick)
            .assertLacks(SemanticsProperties.Focused)
    }

    @Test
    fun theAccessibilityLabelOverridesTheLabel() {
        show(TagVariant.LOCK, TagSize.REGULAR, accessibilityLabel = "Needs Plus")

        subject().assertNamed("Needs Plus")
    }

    @Test
    fun theKindTagDrawsItsOverlineLabelInCapitalsAndIsReadAsWritten() {
        show(TagVariant.KIND, TagSize.REGULAR)

        subject().assertNamed("Plus")
        val label = compose.onNodeWithText("Plus", useUnmergedTree = true)
        assertEquals("PLUS", label.drawnText())
        compose.onNodeWithText("PLUS", useUnmergedTree = true).assertDoesNotExist()
    }

    @Test
    fun aCombinationTheContractDoesNotAllowRendersNothing() {
        show(TagVariant.DIFFERS, TagSize.REGULAR)

        subject().assertDoesNotExist()
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
