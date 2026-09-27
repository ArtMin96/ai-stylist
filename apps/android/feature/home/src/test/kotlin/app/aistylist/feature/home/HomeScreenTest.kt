package app.aistylist.feature.home

import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** JVM (Robolectric) test of the real screen + view model over a fake repository. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [37])
class HomeScreenTest {
    @get:Rule
    val compose = createComposeRule()

    private fun show(
        repository: QueuedVersionRepository,
        recording: RecordingAnalytics = RecordingAnalytics(),
        debugTools: Boolean = false,
    ): HomeViewModel {
        val viewModel = HomeViewModel(repository, recording.analytics, TEST_CONFIG, debugTools)
        compose.setContent { HomeRoute(viewModel) }
        return viewModel
    }

    @Test
    fun showsTheTitleAsAHeadingAndTheApiVersion() {
        show(QueuedVersionRepository(VERSION_OK))

        compose
            .onNodeWithText("AI Stylist")
            .assertIsDisplayed()
            .assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading))
        compose.onNodeWithTag(HomeTestTags.API_VERSION).assertTextEquals("API 1.2.3 (abcdef0)")
        compose.onNodeWithText("API: http://api.test").assertIsDisplayed()
    }

    @Test
    fun showsAFriendlyErrorAndRetries() {
        val repository = QueuedVersionRepository(VERSION_DOWN)
        show(repository)

        compose
            .onNodeWithTag(HomeTestTags.API_ERROR)
            .assertTextEquals("The API is not reachable right now: Could not reach the API")

        repository.enqueue(VERSION_OK)
        compose.onNodeWithText("Retry").performClick()

        compose.onNodeWithTag(HomeTestTags.API_VERSION).assertTextEquals("API 1.2.3 (abcdef0)")
        assertEquals(2, repository.calls)
    }

    @Test
    fun consentSwitchIsOffByDefaultAndSendsNothingAfterOptIn() {
        val recording = RecordingAnalytics()
        show(QueuedVersionRepository(VERSION_OK), recording)

        val consent = compose.onNodeWithText("Share anonymous usage data")
        consent.assertIsOff()
        compose.onNodeWithText("Off by default. Nothing is sent until you opt in.").assertIsDisplayed()

        consent.performClick()

        consent.assertIsOn()
        assertTrue(recording.analytics.hasConsent())
        assertEquals(emptyList<Any>(), recording.sent)
    }

    @Test
    fun debugToolsAreAbsentWhenTheBuildTurnsThemOff() {
        show(QueuedVersionRepository(VERSION_OK), debugTools = false)

        compose.onNodeWithTag(HomeTestTags.DEBUG_CONSENT_TOGGLE).assertDoesNotExist()
        compose.onNodeWithTag(HomeTestTags.DEBUG_FORCE_CRASH).assertDoesNotExist()
        compose.onNodeWithText("Analytics consent (debug)").assertDoesNotExist()
        compose.onNodeWithText("Force test crash").assertDoesNotExist()
    }

    @Test
    fun debugConsentToggleDrivesTheSameConsentGate() {
        val recording = RecordingAnalytics()
        show(QueuedVersionRepository(VERSION_OK), recording, debugTools = true)

        val debugConsent = compose.onNodeWithTag(HomeTestTags.DEBUG_CONSENT_TOGGLE)
        debugConsent.assertIsOff().assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Switch))
        compose.onNodeWithText("Analytics consent (debug)").assertIsDisplayed()

        debugConsent.performClick()

        debugConsent.assertIsOn()
        compose.onNodeWithText("Share anonymous usage data").assertIsOn()
        assertTrue(recording.analytics.hasConsent())

        debugConsent.performClick()

        debugConsent.assertIsOff()
        assertFalse(recording.analytics.hasConsent())
    }

    @Test
    fun forceTestCrashButtonThrowsTheForcedTestCrash() {
        show(QueuedVersionRepository(VERSION_OK), debugTools = true)

        val button = compose.onNodeWithTag(HomeTestTags.DEBUG_FORCE_CRASH)
        button.assertTextEquals("Force test crash").assertHasClickAction()

        assertThrows(ForcedTestCrash::class.java) { button.performClick() }
    }
}
