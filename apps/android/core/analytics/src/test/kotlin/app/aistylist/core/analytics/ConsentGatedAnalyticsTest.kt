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
}
