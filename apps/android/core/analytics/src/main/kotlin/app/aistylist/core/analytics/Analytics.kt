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

/**
 * Where consented events go (PostHog, or the no-op sink when no key is configured).
 * [ConsentGatedAnalytics] is the only caller and owns the consent decision: it calls [activate]
 * when consent is granted, [send] only while consent holds, and [deactivate] when consent is
 * withdrawn. Before the first grant a sink receives no call at all, so an SDK-backed sink sets its
 * SDK up inside [activate]: no setup, network or crash handler before opt-in.
 */
fun interface AnalyticsSink {
    fun send(event: AnalyticsEvent)

    /** Consent was granted (first time or again). Called once per grant, before any [send]. */
    fun activate() = Unit

    /**
     * Consent was withdrawn: stop capturing and sending, and discard whatever was captured but not
     * sent yet (withdrawal never flushes it). [send] is not called afterwards.
     */
    fun deactivate() = Unit
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
