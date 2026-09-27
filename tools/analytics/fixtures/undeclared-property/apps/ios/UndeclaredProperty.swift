// Fixture (tools/analytics/fixtures/undeclared-property): a property key that events.json does not
// declare for the event must fail with `undeclared-property`.
import Analytics

extension AnalyticsEvent {
  static let openedFromHome = AnalyticsEvent(
    name: "app_opened",
    properties: ["platform": .string("ios"), "screenName": .string("home")]
  )
}
