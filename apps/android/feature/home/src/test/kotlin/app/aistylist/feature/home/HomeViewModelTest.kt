package app.aistylist.feature.home

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import app.aistylist.core.analytics.AnalyticsPropertyValue
import app.aistylist.core.data.model.FailureReason
import app.cash.turbine.test
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setMainDispatcher() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun resetMainDispatcher() {
        Dispatchers.resetMain()
    }

    @Test
    fun `starts loading, then shows the API version`() =
        runTest(dispatcher) {
            val viewModel =
                HomeViewModel(QueuedVersionRepository(VERSION_OK), RecordingAnalytics().analytics, TEST_CONFIG)

            viewModel.uiState.test {
                val initial = awaitItem()
                assertEquals(VersionUiState.Loading, initial.version)
                assertEquals("http://api.test", initial.apiBaseUrl)
                assertEquals(VersionUiState.Loaded(version = "1.2.3", shortCommit = "abcdef0"), awaitItem().version)
            }
        }

    @Test
    fun `shows the failure, and retry loads again`() =
        runTest(dispatcher) {
            val repository = QueuedVersionRepository(VERSION_DOWN)
            val viewModel = HomeViewModel(repository, RecordingAnalytics().analytics, TEST_CONFIG)

            viewModel.uiState.test {
                assertEquals(VersionUiState.Loading, awaitItem().version)
                assertEquals(VersionUiState.Failed(FailureReason.Unreachable), awaitItem().version)

                repository.enqueue(VERSION_OK)
                viewModel.retry()

                assertEquals(VersionUiState.Loading, awaitItem().version)
                assertEquals(VersionUiState.Loaded(version = "1.2.3", shortCommit = "abcdef0"), awaitItem().version)
            }
            assertEquals(2, repository.calls)
        }

    @Test
    fun `consent is off by default and nothing is sent, even after opting in`() =
        runTest(dispatcher) {
            val recording = RecordingAnalytics()
            val viewModel = HomeViewModel(QueuedVersionRepository(VERSION_OK), recording.analytics, TEST_CONFIG)

            assertFalse(viewModel.uiState.value.analyticsConsent)
            viewModel.onAnalyticsConsentChange(true)

            assertTrue(viewModel.uiState.value.analyticsConsent)
            assertTrue(recording.analytics.hasConsent())
            // app_opened was tracked before opt-in, so it was dropped and is never replayed.
            assertEquals(emptyList<Any>(), recording.sent)
        }

    @Test
    fun `tracks app_opened from the taxonomy when consent was already granted`() =
        runTest(dispatcher) {
            val recording = RecordingAnalytics()
            recording.analytics.setConsent(true)

            HomeViewModel(QueuedVersionRepository(VERSION_OK), recording.analytics, TEST_CONFIG)

            val event = recording.sent.single()
            assertEquals(AnalyticsTaxonomy.AppOpened.NAME, event.name)
            assertEquals(
                mapOf(
                    AnalyticsTaxonomy.AppOpened.PLATFORM to AnalyticsPropertyValue.Text("android"),
                    AnalyticsTaxonomy.AppOpened.APP_VERSION to AnalyticsPropertyValue.Text("0.1.0-test"),
                    AnalyticsTaxonomy.AppOpened.COLD_START to AnalyticsPropertyValue.Flag(true),
                ),
                event.properties,
            )
        }
}
