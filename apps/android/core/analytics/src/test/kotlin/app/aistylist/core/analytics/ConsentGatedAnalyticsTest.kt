package app.aistylist.core.analytics

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConsentGatedAnalyticsTest {
    private val event =
        AnalyticsEvent(
            name = AnalyticsTaxonomy.AppOpened.NAME,
            properties = mapOf(AnalyticsTaxonomy.AppOpened.PLATFORM to AnalyticsPropertyValue.Text("android")),
        )

    private val sendAppOpened = "send:${AnalyticsTaxonomy.AppOpened.NAME}"

    /** Records every call the gate makes, in order (the lifecycle hooks included). */
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
    fun `is off by default and records nothing`() {
        val sent = mutableListOf<AnalyticsEvent>()
        val analytics = ConsentGatedAnalytics { sent += it }

        assertFalse(analytics.hasConsent())
        analytics.track(event)
        analytics.track(event)

        assertEquals(emptyList<AnalyticsEvent>(), sent)
    }

    @Test
    fun `forwards events only after consent is granted and stops when revoked`() {
        val sent = mutableListOf<AnalyticsEvent>()
        val analytics = ConsentGatedAnalytics { sent += it }

        analytics.setConsent(true)
        assertTrue(analytics.hasConsent())
        analytics.track(event)
        analytics.setConsent(false)
        analytics.track(event)

        assertEquals(listOf(event), sent)
    }

    @Test
    fun `does not replay events tracked before opt-in`() {
        val sent = mutableListOf<AnalyticsEvent>()
        val analytics = ConsentGatedAnalytics { sent += it }

        analytics.track(event)
        analytics.setConsent(true)

        assertEquals(emptyList<AnalyticsEvent>(), sent)
    }

    @Test
    fun `P02 sink is a silent no-op`() {
        val analytics = ConsentGatedAnalytics(NoopAnalyticsSink)
        analytics.setConsent(true)

        analytics.track(event)

        assertTrue(analytics.hasConsent())
    }

    @Test
    fun `the sink receives no call at all before the first grant`() {
        val sink = RecordingSink()
        val analytics = ConsentGatedAnalytics(sink)

        analytics.track(event)
        analytics.setConsent(false)
        analytics.track(event)

        assertFalse(analytics.hasConsent())
        assertEquals(emptyList<String>(), sink.calls)
    }

    @Test
    fun `granting consent activates the sink once, then sends`() {
        val sink = RecordingSink()
        val analytics = ConsentGatedAnalytics(sink)

        analytics.setConsent(true)
        analytics.setConsent(true)
        analytics.track(event)

        assertEquals(listOf("activate", sendAppOpened), sink.calls)
    }

    @Test
    fun `withdrawing consent deactivates the sink and drops later events`() {
        val sink = RecordingSink()
        val analytics = ConsentGatedAnalytics(sink)
        analytics.setConsent(true)
        analytics.track(event)

        analytics.setConsent(false)
        analytics.setConsent(false)
        analytics.track(event)

        assertFalse(analytics.hasConsent())
        assertEquals(listOf("activate", sendAppOpened, "deactivate"), sink.calls)
    }

    @Test
    fun `events tracked before opt-in are never replayed to the sink`() {
        val sink = RecordingSink()
        val analytics = ConsentGatedAnalytics(sink)
        analytics.track(event)
        analytics.track(event)

        analytics.setConsent(true)

        assertEquals(listOf("activate"), sink.calls)
    }

    @Test
    fun `re-granting consent activates the sink again and sends only new events`() {
        val sink = RecordingSink()
        val analytics = ConsentGatedAnalytics(sink)
        analytics.setConsent(true)
        analytics.setConsent(false)
        analytics.track(event)

        analytics.setConsent(true)
        analytics.track(event)

        assertTrue(analytics.hasConsent())
        assertEquals(listOf("activate", "deactivate", "activate", sendAppOpened), sink.calls)
    }
}
