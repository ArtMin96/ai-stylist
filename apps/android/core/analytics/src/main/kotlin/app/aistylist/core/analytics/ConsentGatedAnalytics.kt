package app.aistylist.core.analytics

import java.util.concurrent.atomic.AtomicBoolean

/**
 * Consent gate: OFF by default; nothing reaches [sink] until `setConsent(true)`, and nothing
 * tracked before opt-in is buffered or replayed.
 */
class ConsentGatedAnalytics(
    private val sink: AnalyticsSink,
) : Analytics {
    private val consent = AtomicBoolean(false)

    override fun hasConsent(): Boolean = consent.get()

    override fun setConsent(granted: Boolean) {
        consent.set(granted)
    }

    override fun track(event: AnalyticsEvent) {
        if (consent.get()) {
            sink.send(event)
        }
    }
}

/**
 * P02 sink: drops every event silently (no log, no network).
 * TODO(P03): PostHog Android adapter behind this same port; do not add the SDK before then.
 */
object NoopAnalyticsSink : AnalyticsSink {
    override fun send(event: AnalyticsEvent) = Unit
}
