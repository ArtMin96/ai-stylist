// Fixture (tools/analytics/fixtures/_clean): the call shapes the Android app uses must pass with no
// finding. A comment that mentions AnalyticsEvent(name = "not_an_event") is ignored.
package fixture

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import com.posthog.PostHog

/** The port's declaration is not a construction. */
data class AnalyticsEvent(
    val name: String,
    val properties: Map<String, Any> = emptyMap(),
)

val opened =
    AnalyticsEvent(
        name = AnalyticsTaxonomy.AppOpened.NAME,
        properties =
            mapOf(
                AnalyticsTaxonomy.AppOpened.PLATFORM to "android",
                "appVersion" to "0.1.0-${'$'}{BUILD}",
                AnalyticsTaxonomy.AppOpened.COLD_START to (1 > 0),
            ),
    )

val positional = AnalyticsEvent("app_opened", mapOf<String, Any>("coldStart" to false))
val bare = AnalyticsEvent(name = AnalyticsTaxonomy.AppOpened.NAME, properties = emptyMap())
val quote = '"'
val text = "AnalyticsEvent(name = \"inside_a_string\")"

class ForwardingSink {
    // The sink forwards a name that was checked where the event was built.
    fun `send forwards the checked name`(event: AnalyticsEvent) {
        PostHog.capture(event = event.name, properties = event.properties)
    }
}
