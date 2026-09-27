// Consent gate behaviour (planning/11 §7.2, planning/14 §9): the sink sees nothing before the first
// grant, is activated on each grant and deactivated on each withdrawal, and never gets events tracked
// while consent was off. First ported from the retired React Native consent-stub tests (ADR-0004).
import Analytics
import Testing

/// Records every call the gate makes, in order.
private final class RecordingSink: AnalyticsSink {
  // nonisolated: a plain value compared inside #expect, like AnalyticsEvent.
  nonisolated enum Call: Equatable {
    case activate
    case deactivate
    case send(AnalyticsEvent)
  }

  private(set) var calls: [Call] = []

  func activate() {
    calls.append(.activate)
  }

  func deactivate() {
    calls.append(.deactivate)
  }

  func send(_ event: AnalyticsEvent) {
    calls.append(.send(event))
  }
}

@Suite("ConsentGatedAnalyticsTests")
struct ConsentGatedAnalyticsTests {
  private let event = AnalyticsEvent.appOpened(appVersion: "0.1.0", coldStart: true)
  private let laterEvent = AnalyticsEvent.appOpened(appVersion: "0.1.0", coldStart: false)

  @Test("is off by default: zero sink calls (no activate, no send) before consent")
  func noSinkCallsBeforeConsent() {
    let sink = RecordingSink()
    let analytics = ConsentGatedAnalytics(sink: sink)
    #expect(analytics.hasConsent == false)
    analytics.track(event)
    analytics.setConsent(false)
    analytics.track(event)
    #expect(sink.calls.isEmpty)
  }

  @Test("a grant activates the sink once, then events are sent")
  func grantActivatesOnceThenSends() {
    let sink = RecordingSink()
    let analytics = ConsentGatedAnalytics(sink: sink)
    analytics.setConsent(true)
    analytics.setConsent(true)
    analytics.track(event)
    #expect(analytics.hasConsent)
    #expect(sink.calls == [.activate, .send(event)])
  }

  @Test("a withdrawal deactivates the sink and later events are dropped")
  func withdrawalDeactivatesAndDrops() {
    let sink = RecordingSink()
    let analytics = ConsentGatedAnalytics(sink: sink)
    analytics.setConsent(true)
    analytics.track(event)
    analytics.setConsent(false)
    analytics.setConsent(false)
    analytics.track(laterEvent)
    #expect(analytics.hasConsent == false)
    #expect(sink.calls == [.activate, .send(event), .deactivate])
  }

  @Test("events tracked before consent are never replayed")
  func noReplayAfterGrant() {
    let sink = RecordingSink()
    let analytics = ConsentGatedAnalytics(sink: sink)
    analytics.track(event)
    analytics.setConsent(true)
    #expect(sink.calls == [.activate])
  }

  @Test("a re-grant activates the sink again; events from the withdrawn period stay dropped")
  func regrantActivatesAgain() {
    let sink = RecordingSink()
    let analytics = ConsentGatedAnalytics(sink: sink)
    analytics.setConsent(true)
    analytics.setConsent(false)
    analytics.track(event)
    analytics.setConsent(true)
    analytics.track(laterEvent)
    #expect(sink.calls == [.activate, .deactivate, .activate, .send(laterEvent)])
  }

  @Test("app_opened carries exactly the taxonomy properties")
  func appOpenedShape() {
    #expect(event.name == "app_opened")
    #expect(
      event.properties == [
        "platform": .string("ios"),
        "appVersion": .string("0.1.0"),
        "coldStart": .bool(true),
      ]
    )
  }

  @Test("the no-op sink accepts the whole lifecycle without side effects")
  func noopSink() {
    let analytics = ConsentGatedAnalytics(sink: NoopSink())
    analytics.setConsent(true)
    analytics.track(event)
    analytics.setConsent(false)
    #expect(analytics.hasConsent == false)
  }
}
