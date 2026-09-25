package app.aistylist.core.analytics

/**
 * Analytics port (planning/14 §2, P02 §11). Product code depends on this interface only; the
 * composition root (`:app` AppContainer) picks the implementation. Event and property names come
 * from the generated taxonomy ([app.aistylist.contracts.analytics.AnalyticsTaxonomy]) and never
 * carry sensitive data.
 */
interface Analytics {
    /** Consent is opt-in and defaults to off (doc 11, P02 §11). */
    fun hasConsent(): Boolean

    fun setConsent(granted: Boolean)

    /** No-op until consent is granted; never throws. */
    fun track(event: AnalyticsEvent)
}

/** Where consented events would go (PostHog in a later phase). */
fun interface AnalyticsSink {
    fun send(event: AnalyticsEvent)
}

/** One analytics event. Property values are restricted to scalars by [AnalyticsPropertyValue]. */
data class AnalyticsEvent(
    val name: String,
    val properties: Map<String, AnalyticsPropertyValue> = emptyMap(),
)

/** The only property value types the taxonomy allows: string, number, boolean. */
sealed interface AnalyticsPropertyValue {
    data class Text(
        val value: String,
    ) : AnalyticsPropertyValue

    data class Number(
        val value: Double,
    ) : AnalyticsPropertyValue

    data class Flag(
        val value: Boolean,
    ) : AnalyticsPropertyValue
}
