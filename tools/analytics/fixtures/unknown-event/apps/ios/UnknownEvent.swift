// Fixture (tools/analytics/fixtures/unknown-event): an event name that is not in
// packages/contracts/events/analytics/events.json must fail with `unknown-event`.
import Analytics

extension AnalyticsEvent {
  static let teleported = AnalyticsEvent(name: "outfit_teleported", properties: [:])
}
