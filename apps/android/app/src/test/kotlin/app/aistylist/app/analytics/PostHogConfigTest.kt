package app.aistylist.app.analytics

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsPropertyValue
import app.aistylist.core.data.config.PostHogSettings
import com.posthog.PersonProfiles
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The SDK configuration is built on the plain JVM: no SDK call, no Android, no network. */
class PostHogConfigTest {
    private val queueDirectory = File("build/synthetic-posthog-queue")

    private val config =
        postHogConfig(
            PostHogSettings(apiKey = "phc_synthetic_test", host = "https://posthog.example.test"),
            queueDirectory,
        )

    @Test
    fun `reports to the configured project`() {
        assertEquals("phc_synthetic_test", config.apiKey)
        assertEquals("https://posthog.example.test", config.host)
    }

    @Test
    fun `queues events in the directory the sink empties on withdrawal`() {
        assertEquals(queueDirectory.absolutePath, config.storagePrefix)
    }

    @Test
    fun `error-tracking autocapture is on, NDK crash capture off`() {
        assertTrue(config.errorTrackingConfig.autoCapture)
        assertFalse(config.errorTrackingConfig.captureNativeCrashes)
        assertTrue(config.errorTrackingConfig.inAppIncludes.contains("app.aistylist"))
    }

    @Test
    fun `every other automatic capture is off`() {
        assertFalse(config.captureApplicationLifecycleEvents)
        assertFalse(config.captureScreenViews)
        assertFalse(config.captureDeepLinks)
        assertFalse(config.captureElementInteractions)
        assertFalse(config.captureRageClicks)
        assertFalse(config.captureDeadClicks)
        assertFalse(config.capturePushNotificationSubscriptions)
        assertFalse(config.capturePushNotificationOpened)
    }

    @Test
    fun `no session replay, screenshots, logcat or surveys`() {
        assertFalse(config.sessionReplay)
        assertFalse(config.sessionReplayConfig.screenshot)
        assertFalse(config.sessionReplayConfig.captureLogcat)
        assertFalse(config.sessionReplayConfig.captureTouches)
        assertFalse(config.surveys)
    }

    @Test
    fun `feature flags are neither preloaded nor reported`() {
        assertFalse(config.preloadFeatureFlags)
        assertFalse(config.sendFeatureFlagEvent)
    }

    @Test
    fun `person profiles for identified users only, no default person properties`() {
        assertEquals(PersonProfiles.IDENTIFIED_ONLY, config.personProfiles)
        assertFalse(config.setDefaultPersonProperties)
    }

    @Test
    fun `no breadcrumbs and no debug logging`() {
        assertFalse(config.errorTrackingConfig.exceptionSteps.enabled)
        assertFalse(config.debug)
    }

    @Test
    fun `port properties map to PostHog scalars`() {
        val event =
            AnalyticsEvent(
                name = AnalyticsTaxonomy.AppOpened.NAME,
                properties =
                    mapOf(
                        AnalyticsTaxonomy.AppOpened.PLATFORM to AnalyticsPropertyValue.Text("android"),
                        AnalyticsTaxonomy.AppOpened.COLD_START to AnalyticsPropertyValue.Flag(true),
                    ),
            )

        assertEquals(
            mapOf(
                AnalyticsTaxonomy.AppOpened.PLATFORM to "android",
                AnalyticsTaxonomy.AppOpened.COLD_START to true,
            ),
            event.postHogProperties(),
        )
    }

    // Per value, without an event: no taxonomy event has a number property yet, and an event
    // built here must use only declared names and keys (packages/contracts/events/analytics/events.json).
    @Test
    fun `each port value maps to its PostHog scalar`() {
        assertEquals("android", AnalyticsPropertyValue.Text("android").postHogValue())
        assertEquals(2.0, AnalyticsPropertyValue.Number(2.0).postHogValue())
        assertEquals(true, AnalyticsPropertyValue.Flag(true).postHogValue())
    }
}
