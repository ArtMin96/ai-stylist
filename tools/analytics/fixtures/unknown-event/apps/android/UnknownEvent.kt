// Fixture (tools/analytics/fixtures/unknown-event): a raw event name that is not in
// packages/contracts/events/analytics/events.json must fail with `unknown-event`, and so must a
// taxonomy constant that the generator never wrote and a literal name sent straight to PostHog.
package fixture

import app.aistylist.contracts.analytics.AnalyticsTaxonomy
import app.aistylist.core.analytics.AnalyticsEvent
import com.posthog.PostHog

val teleported = AnalyticsEvent(name = "outfit_teleported")

val invented = AnalyticsEvent(name = AnalyticsTaxonomy.OutfitTeleported.NAME)

fun ping() {
    PostHog.capture(event = "debug_ping")
}
