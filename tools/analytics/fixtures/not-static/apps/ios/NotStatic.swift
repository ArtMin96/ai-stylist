// Fixture (tools/analytics/fixtures/not-static): an event name the check cannot resolve (here an
// interpolated string) must fail with `not-static`: it could be anything at runtime.
import Analytics

extension AnalyticsEvent {
  static func screenViewed(_ screen: String) -> AnalyticsEvent {
    AnalyticsEvent(name: "screen_\(screen)_viewed")
  }
}
