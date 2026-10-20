package app.aistylist.core.designsystem.catalog.gallery

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import app.aistylist.core.designsystem.AppTheme
import app.aistylist.core.designsystem.generated.ComponentGallery
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** JVM (Robolectric) test of the gallery against the AI-195 parity table. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class GalleryTest {
    @get:Rule
    val compose = createComposeRule()

    private var closes = 0

    private fun show() {
        compose.setContent { AppTheme { DesignSystemGalleryScreen(onClose = { closes++ }) } }
    }

    @Test
    fun sectionsMatchTheParityTableInOrder() {
        val sections = gallerySections(RuntimeEnvironment.getApplication().resources)

        assertEquals(PARITY_SECTIONS, sections.map { it.id to it.title })
    }

    @Test
    fun showsTheRootTheHeaderAndEverySection() {
        show()

        compose.onNodeWithTag(GalleryTestTags.ROOT).assertExists()
        compose.onNodeWithText("Design system gallery").assertExists()
        PARITY_SECTIONS.forEach { (id, title) ->
            compose.onNodeWithTag(id).assertExists()
            compose.onNodeWithText(title).assertExists()
        }
    }

    @Test
    fun rendersEveryButtonCellExactlyOnce() {
        show()

        val ids = ComponentGallery.button.map { it.testId }
        assertEquals(ids.size, ids.toSet().size)
        ids.forEach { id ->
            compose.onAllNodesWithTag(id, useUnmergedTree = true).assertCountEquals(1)
        }
    }

    @Test
    fun closeCallsOnClose() {
        show()

        compose.onNodeWithTag(GalleryTestTags.CLOSE).assertTextEquals("Close").performClick()

        assertEquals(1, closes)
    }

    private companion object {
        val PARITY_SECTIONS =
            listOf(
                "ds-gallery-section-colours" to "Colours",
                "ds-gallery-section-typography" to "Typography",
                "ds-gallery-section-spacing" to "Spacing",
                "ds-gallery-section-radius" to "Radius",
                "ds-gallery-section-c01-buttons" to "C01 Buttons",
            )
    }
}
