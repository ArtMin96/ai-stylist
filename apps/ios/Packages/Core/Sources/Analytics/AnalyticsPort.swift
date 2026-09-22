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

/// Where consented events go (PostHog in a later phase, behind this same port).
public protocol AnalyticsSink {
  func send(_ event: AnalyticsEvent)
}
