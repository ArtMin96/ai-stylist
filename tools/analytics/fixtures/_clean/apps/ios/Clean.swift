// Fixture (tools/analytics/fixtures/_clean): the call shapes the iOS app uses must pass with no
// finding. A comment that mentions AnalyticsEvent(name: "not_an_event") is ignored.
/* So is a block comment, /* nested */ or not: AnalyticsEvent(name: "also_not_an_event") */
import Analytics
import PostHog

extension AnalyticsEvent {
  public static func appOpened(appVersion: String, coldStart: Bool) -> AnalyticsEvent {
    AnalyticsEvent(
      name: "app_opened",
      properties: [
        "platform": .string("ios"),
        "appVersion": .string("v\(appVersion)"),
        "coldStart": .bool(coldStart),
      ]
    )
  }

  static let bare = AnalyticsEvent(name: "app_opened")
  static let empty = AnalyticsEvent.init(name: #"app_opened"#, properties: [:])
}

let text = "AnalyticsEvent(name: \"inside_a_string\")"

final class ForwardingSink {
  // The sink forwards a name that was checked where the event was built.
  func send(_ event: AnalyticsEvent) {
    PostHogSDK.shared.capture(event.name, properties: [:])
  }
}
