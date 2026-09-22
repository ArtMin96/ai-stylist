// Port of apps/mobile/src/lib/analytics/tests/consent-stub.test.ts.
import Analytics
import Testing

private final class RecordingSink: AnalyticsSink {
  private(set) var sent: [AnalyticsEvent] = []

  func send(_ event: AnalyticsEvent) {
    sent.append(event)
  }
}

@Suite("ConsentGatedAnalytics")
struct ConsentGatedAnalyticsTests {
  private let event = AnalyticsEvent.appOpened(appVersion: "0.1.0", coldStart: true)

  @Test("is off by default and records nothing")
  func offByDefault() {
    let sink = RecordingSink()
    let analytics = ConsentGatedAnalytics(sink: sink)
    #expect(analytics.hasConsent == false)
    analytics.track(event)
    analytics.track(event)
    #expect(sink.sent.isEmpty)
  }

  @Test("forwards events only after consent is granted and stops when revoked")
  func forwardsOnlyWithConsent() {
    let sink = RecordingSink()
    let analytics = ConsentGatedAnalytics(sink: sink)
    analytics.setConsent(true)
    analytics.track(event)
    analytics.setConsent(false)
    analytics.track(event)
    #expect(sink.sent == [event])
  }

  @Test("does not replay events tracked before opt-in")
  func noReplay() {
    let sink = RecordingSink()
    let analytics = ConsentGatedAnalytics(sink: sink)
    analytics.track(event)
    analytics.setConsent(true)
    #expect(sink.sent.isEmpty)
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

  @Test("the no-op sink accepts events without side effects")
  func noopSink() {
    let analytics = ConsentGatedAnalytics(sink: NoopSink())
    analytics.setConsent(true)
    analytics.track(event)
    #expect(analytics.hasConsent)
  }
}
