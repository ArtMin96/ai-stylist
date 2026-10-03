/// Sink for builds without a PostHog key: drops every event silently (no logging, no network).
public struct NoopSink: AnalyticsSink {
  public init() {}

  public func activate() {}

  public func deactivate() {}

  public func send(_ event: AnalyticsEvent) {}
}

/// Consent gate: OFF by default. Before the first `setConsent(true)` the sink receives no call at all
/// (no `activate`, no `send`). A grant calls `sink.activate()`, a withdrawal `sink.deactivate()`;
/// repeating the current decision calls nothing. Nothing tracked while consent is off is kept or
/// replayed later.
public final class ConsentGatedAnalytics: Analytics {
  private let sink: any AnalyticsSink
  public private(set) var hasConsent = false

  public init(sink: any AnalyticsSink) {
    self.sink = sink
  }

  public func setConsent(_ granted: Bool) {
    guard granted != hasConsent else { return }
    hasConsent = granted
    if granted {
      sink.activate()
    } else {
      sink.deactivate()
    }
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
