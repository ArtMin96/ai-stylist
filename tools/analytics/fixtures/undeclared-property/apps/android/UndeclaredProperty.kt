// Fixture (tools/analytics/fixtures/undeclared-property): a property key that events.json does not
// declare for the event must fail with `undeclared-property`, even next to generated constants.
package fixture

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import app.aistylist.core.analytics.AnalyticsEvent
import app.aistylist.core.analytics.AnalyticsPropertyValue

val openedFromHome =
    AnalyticsEvent(
        name = AnalyticsTaxonomy.AppOpened.NAME,
        properties =
            mapOf(
                AnalyticsTaxonomy.AppOpened.PLATFORM to AnalyticsPropertyValue.Text("android"),
                "screen_name" to AnalyticsPropertyValue.Text("home"),
            ),
    )
