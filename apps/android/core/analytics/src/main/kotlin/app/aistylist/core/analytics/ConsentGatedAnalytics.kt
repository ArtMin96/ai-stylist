package app.aistylist.core.analytics

/**
 * Consent gate: OFF by default; the [sink] receives no call at all until `setConsent(true)`, and
 * nothing tracked before opt-in is buffered or replayed. Each consent change is forwarded once:
 * grant → [AnalyticsSink.activate], withdrawal → [AnalyticsSink.deactivate]. Consent changes and
 * sends are serialised, so the sink never sees a send outside an activate/deactivate window.
 */
class ConsentGatedAnalytics(
    private val sink: AnalyticsSink,
) : Analytics {
    private val lock = Any()

    @Volatile
    private var consent = false

    override fun hasConsent(): Boolean = consent

    override fun setConsent(granted: Boolean) {
        synchronized(lock) {
            if (granted == consent) return
            if (granted) {
                sink.activate()
                consent = true
            } else {
                consent = false
                sink.deactivate()
            }
        }
    }

    override fun track(event: AnalyticsEvent) {
        synchronized(lock) {
            if (consent) {
                sink.send(event)
            }
        }
    }
}

/**
 * Drops every event silently (no log, no network). Bound by the composition root when no PostHog
 * key is configured, so no PostHog code runs.
 */
object NoopAnalyticsSink : AnalyticsSink {
    override fun send(event: AnalyticsEvent) = Unit
}
