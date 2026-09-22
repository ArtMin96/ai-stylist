// Ported from the retired React Native home-screen tests (ADR-0004), at the view-model level:
// version success/error states, retry, and zero analytics while consent is off.
import Analytics
import AppConfig
import AppServices
import Foundation
import HomeModel
import Testing

/// Returns queued results in order; the last one repeats.
private final class StubVersionFetcher: VersionFetching {
  private var results: [VersionResult]
  private(set) var calls = 0

  init(_ results: VersionResult...) {
    self.results = results
  }

  func fetchVersion() async -> VersionResult {
    calls += 1
    return results.count > 1 ? results.removeFirst() : results[0]
  }
}

private final class RecordingSink: AnalyticsSink {
  private(set) var sent: [AnalyticsEvent] = []

  func send(_ event: AnalyticsEvent) {
    sent.append(event)
  }
}

private let version = APIVersion(
  version: "1.2.3",
  commit: "abcdef0123456789",
  builtAt: Date(timeIntervalSince1970: 1_788_998_400)
)

private func makeModel(_ fetcher: StubVersionFetcher) throws -> (HomeModel, ConsentGatedAnalytics, RecordingSink) {
  let sink = RecordingSink()
  let analytics = ConsentGatedAnalytics(sink: sink)
  let config = try AppConfig.parse(RawConfig(apiBaseURL: "http://api.test", appVersion: "0.1.0-test"))
  let services = AppServices(config: config, version: fetcher, analytics: analytics)
  return (HomeModel(services: services), analytics, sink)
}

@Suite("HomeModel")
struct HomeModelTests {
  @Test("starts loading and shows the configured API host")
  func initialState() throws {
    let (model, _, _) = try makeModel(StubVersionFetcher(.ok(version)))
    #expect(model.versionState == .loading)
    #expect(model.apiBaseURLText == "http://api.test")
    #expect(model.hasConsent == false)
  }

  @Test("shows the API version and short commit on success")
  func success() async throws {
    let (model, _, _) = try makeModel(StubVersionFetcher(.ok(version)))
    await model.onAppear()
    #expect(model.versionState == .loaded("API 1.2.3 (abcdef0)"))
  }

  @Test("shows a friendly error when the API is down, and Retry recovers")
  func errorThenRetry() async throws {
    let fetcher = StubVersionFetcher(.failure(message: "Could not reach the API"), .ok(version))
    let (model, _, _) = try makeModel(fetcher)
    await model.onAppear()
    #expect(model.versionState == .failed("The API is not reachable right now: Could not reach the API"))
    await model.retry()
    #expect(model.versionState == .loaded("API 1.2.3 (abcdef0)"))
    #expect(fetcher.calls == 2)
  }

  @Test("sends zero analytics events while consent is off, even after opting in later")
  func consentGating() async throws {
    let (model, analytics, sink) = try makeModel(StubVersionFetcher(.ok(version)))
    await model.onAppear()
    #expect(analytics.hasConsent == false)
    #expect(sink.sent.isEmpty)

    model.setConsent(true)
    #expect(model.hasConsent)
    #expect(analytics.hasConsent)
    // Only events tracked after opt-in may flow; app_opened from before it is not replayed.
    #expect(sink.sent.isEmpty)
  }

  @Test("tracks app_opened once per model when consent is on")
  func appOpenedOnce() async throws {
    let (model, analytics, sink) = try makeModel(StubVersionFetcher(.ok(version)))
    analytics.setConsent(true)
    await model.onAppear()
    await model.onAppear()
    #expect(sink.sent == [.appOpened(appVersion: "0.1.0-test", coldStart: true)])
  }
}
