package app.aistylist.app

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsSink
import app.aistylist.core.data.config.ConfigError
import app.aistylist.core.data.config.PostHogSettings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class AppContainerTest {
    /** Fails the test if the container ever builds a PostHog sink. */
    private val noPostHog: (PostHogSettings) -> AnalyticsSink = { throw AssertionError("PostHog sink built") }

    private val appOpened = AnalyticsEvent(name = AnalyticsTaxonomy.AppOpened.NAME)

    /** Records the lifecycle calls the consent gate makes on the sink. */
    private class RecordingSink : AnalyticsSink {
        val calls = mutableListOf<String>()

        override fun activate() {
            calls += "activate"
        }

        override fun deactivate() {
            calls += "deactivate"
        }

        override fun send(event: AnalyticsEvent) {
            calls += "send:${event.name}"
        }
    }

    @Test
    fun `wires config, analytics and repositories without touching the network`() {
        val container =
            AppContainer.create(apiBaseUrl = "http://10.0.2.2:3000", appVersion = "0.1.0", postHogSink = noPostHog)

        assertEquals("http://10.0.2.2:3000", container.config.apiBaseUrl)
        assertEquals("0.1.0", container.config.appVersion)
        assertFalse(container.analytics.hasConsent())
    }

    @Test
    fun `a build without debug tools (release) gets no crash action`() {
        val container =
            AppContainer.create(
                "http://10.0.2.2:3000",
                "0.1.0",
                debugTools = false,
                postHogSink = noPostHog,
            )

        assertNull(container.forceTestCrash)
    }

    @Test
    fun `this variant's default API_BASE_URL is valid and host-only`() {
        // BuildConfig of the variant under test (AGP 9 runs unit tests for the debug build type only).
        AppContainer.create(
            apiBaseUrl = BuildConfig.API_BASE_URL,
            appVersion = BuildConfig.VERSION_NAME,
            postHogSink = noPostHog,
        )
    }

    @Test
    fun `the debug build has the debug tools, whose crash action throws the forced test crash`() {
        val container =
            AppContainer.create(
                "http://10.0.2.2:3000",
                "0.1.0",
                debugTools = BuildConfig.DEBUG_TOOLS,
                postHogSink = noPostHog,
            )
        val forceTestCrash = checkNotNull(container.forceTestCrash)

        val crash = assertThrows(ForcedTestCrash::class.java) { forceTestCrash() }
        assertEquals("Forced test crash from the debug tools", crash.message)
    }

    @Test
    fun `fails fast on an API_BASE_URL with a path`() {
        assertThrows(ConfigError::class.java) {
            AppContainer.create("https://api.ai-stylist.app/v1", "0.1.0", postHogSink = noPostHog)
        }
    }

    @Test
    fun `without a PostHog key the no-op sink is bound and no PostHog code runs`() {
        val container =
            AppContainer.create(
                apiBaseUrl = "http://10.0.2.2:3000",
                appVersion = "0.1.0",
                postHogApiKey = "",
                postHogHost = "https://posthog.example.test",
                postHogSink = noPostHog,
            )

        container.analytics.setConsent(true)
        container.analytics.track(appOpened)
        container.analytics.setConsent(false)

        assertNull(container.config.postHog)
    }

    @Test
    fun `with a PostHog key the PostHog sink is bound but untouched until consent`() {
        val built = mutableListOf<PostHogSettings>()
        val sink = RecordingSink()

        val container =
            AppContainer.create(
                apiBaseUrl = "http://10.0.2.2:3000",
                appVersion = "0.1.0",
                postHogApiKey = "phc_synthetic_test",
                postHogHost = "https://posthog.example.test",
                postHogSink = { settings -> sink.also { built += settings } },
            )
        container.analytics.track(appOpened)

        assertEquals(listOf(PostHogSettings("phc_synthetic_test", "https://posthog.example.test")), built)
        assertEquals(emptyList<String>(), sink.calls)

        container.analytics.setConsent(true)
        container.analytics.track(appOpened)

        assertEquals(listOf("activate", "send:${AnalyticsTaxonomy.AppOpened.NAME}"), sink.calls)
    }

    @Test
    fun `fails fast on a PostHog key without a host`() {
        assertThrows(ConfigError::class.java) {
            AppContainer.create(
                "http://10.0.2.2:3000",
                "0.1.0",
                postHogApiKey = "phc_synthetic",
                postHogSink = noPostHog,
            )
        }
    }
}
