/// Current sink: drops every event silently (no logging, no network).
/// TODO(P03): PostHog iOS SDK adapter behind `AnalyticsSink`; do not add the dependency before.
public struct NoopSink: AnalyticsSink {
  public init() {}

  public func send(_ event: AnalyticsEvent) {}
}

/// Consent gate: OFF by default; nothing reaches `sink` until `setConsent(true)`, and nothing
/// tracked before opt-in is replayed afterwards.
public final class ConsentGatedAnalytics: Analytics {
  private let sink: any AnalyticsSink
  public private(set) var hasConsent = false

  public init(sink: any AnalyticsSink) {
    self.sink = sink
  }

  public func setConsent(_ granted: Bool) {
    hasConsent = granted
  }

  public func track(_ event: AnalyticsEvent) {
    guard hasConsent else { return }
    sink.send(event)
  }
}

extension AnalyticsEvent {
  /// `app_opened` from the taxonomy (packages/contracts/events/analytics/events.json);
  /// `consentRequired: true`, so the gate drops it until the user opts in.
  public static func appOpened(appVersion: String, coldStart: Bool) -> AnalyticsEvent {
    AnalyticsEvent(
      name: "app_opened",
      properties: [
        "platform": .string("ios"),
        "appVersion": .string(appVersion),
        "coldStart": .bool(coldStart),
      ]
    )
  }
}
