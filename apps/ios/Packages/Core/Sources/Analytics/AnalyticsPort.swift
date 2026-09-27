// Analytics port (planning/14 §2). Product code depends on these protocols only; the composition
// root picks the implementation. Every event must exist in the taxonomy
// (packages/contracts/events/analytics/events.json) and must never carry sensitive data.

/// A property value an analytics event may carry. No free-form objects, by design.
nonisolated public enum AnalyticsValue: Sendable, Equatable {
  case string(String)
  case int(Int)
  case double(Double)
  case bool(Bool)
}

nonisolated public struct AnalyticsEvent: Sendable, Equatable {
  public let name: String
  public let properties: [String: AnalyticsValue]

  public init(name: String, properties: [String: AnalyticsValue] = [:]) {
    self.name = name
    self.properties = properties
  }
}

/// What features talk to. Consent is opt-in and off by default (doc 11).
public protocol Analytics: AnyObject {
  var hasConsent: Bool { get }
  func setConsent(_ granted: Bool)
  /// Does nothing until consent is granted; never throws.
  func track(_ event: AnalyticsEvent)
}

/// Where consented events go: `NoopSink`, or the PostHog adapter in the app target. Only
/// `ConsentGatedAnalytics` calls a sink, so a sink never decides consent itself. Before the first
/// grant a sink receives no call at all, so it must not set anything up in its initializer.
public protocol AnalyticsSink {
  /// Consent was granted (the first grant or a later re-grant). Set up or resume here.
  func activate()
  /// Consent was withdrawn after a grant. Stop capturing and stop sending here.
  func deactivate()
  /// Called only between `activate()` and `deactivate()`.
  func send(_ event: AnalyticsEvent)
}
