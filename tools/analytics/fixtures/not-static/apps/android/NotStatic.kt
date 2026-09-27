// Fixture (tools/analytics/fixtures/not-static): an event name or a property map the check cannot
// resolve (a parameter, a map built at runtime) must fail with `not-static`.
package fixture

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsPropertyValue

fun named(eventName: String) = AnalyticsEvent(name = eventName)

fun opened(extra: Map<String, AnalyticsPropertyValue>) =
    AnalyticsEvent(name = AnalyticsTaxonomy.AppOpened.NAME, properties = extra)
