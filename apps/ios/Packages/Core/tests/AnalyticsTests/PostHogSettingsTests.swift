// The PostHog settings the app-target adapter copies onto posthog-ios's PostHogConfig: nothing is
// captured automatically, nothing is recorded, crash capture is on, and a missing key disables the
// SDK entirely. Keys and hosts below are synthetic.
import Analytics
import AppConfig
import Foundation
import Testing

@Suite("PostHogSettings")
struct PostHogSettingsTests {
  // Short, low-entropy placeholders on purpose: nothing key-shaped for the secret scanners.
  private let key = "phc_test"
  private let host = "https://us.i.posthog.com"

  @Test("a blank or missing key turns analytics off (the composition root binds NoopSink)")
  func blankKeyDisables() throws {
    #expect(try PostHogSettings.parse(apiKey: nil, host: nil) == nil)
    #expect(try PostHogSettings.parse(apiKey: "", host: host) == nil)
    #expect(try PostHogSettings.parse(apiKey: "  \n", host: host) == nil)
  }

  @Test("autocapture, screen views, lifecycle events, replay, surveys and flag preload are off")
  func automaticCaptureOff() throws {
    let settings = try #require(try PostHogSettings.parse(apiKey: key, host: host))
    #expect(settings.captureApplicationLifecycleEvents == false)
    #expect(settings.captureScreenViews == false)
    #expect(settings.captureElementInteractions == false)
    #expect(settings.captureSwiftUIElementInteractions == false)
    #expect(settings.enableSwizzling == false)
    #expect(settings.capturePushNotificationSubscriptions == false)
    #expect(settings.capturePushNotificationOpened == false)
    #expect(settings.sessionReplay == false)
    #expect(settings.surveys == false)
    #expect(settings.preloadFeatureFlags == false)
    #expect(settings.sendFeatureFlagEvent == false)
  }

  @Test("pseudonymous only: no person profile until identify, no default person properties")
  func pseudonymousOnly() throws {
    let settings = try #require(try PostHogSettings.parse(apiKey: key, host: host))
    #expect(settings.personProfiles == .identifiedOnly)
    #expect(settings.setDefaultPersonProperties == false)
  }

  @Test("crash capture is on, without breadcrumbs")
  func errorTrackingOn() throws {
    let settings = try #require(try PostHogSettings.parse(apiKey: key, host: host))
    #expect(settings.errorTrackingAutoCapture)
    #expect(settings.exceptionSteps == false)
  }

  @Test("key and host are trimmed and kept")
  func keyAndHost() throws {
    let settings = try #require(try PostHogSettings.parse(apiKey: " \(key) ", host: " \(host) "))
    #expect(settings.apiKey == key)
    #expect(settings.host == URL(string: host))
  }

  @Test("a key without a host is a configuration error")
  func keyWithoutHost() {
    #expect(throws: ConfigError(key: "POSTHOG_HOST", reason: "must be set when POSTHOG_API_KEY is set")) {
      try PostHogSettings.parse(apiKey: key, host: "")
    }
  }

  @Test(
    "the host must be an absolute https URL",
    arguments: ["http://us.i.posthog.com", "us.i.posthog.com", "https://"]
  )
  func hostMustBeHTTPS(_ badHost: String) throws {
    let error = try #require(throws: ConfigError.self) {
      try PostHogSettings.parse(apiKey: key, host: badHost)
    }
    #expect(error.key == "POSTHOG_HOST")
  }

  @Test("a personal API key (a secret) is rejected so it can never ship in the bundle")
  func personalKeyRejected() throws {
    let error = try #require(throws: ConfigError.self) {
      try PostHogSettings.parse(apiKey: "phx_test", host: host)
    }
    #expect(error.key == "POSTHOG_API_KEY")
  }

  /// posthog-ios 3.85.0 storage layout: Application Support/<bundle id>/<project key>/posthog.queueFolder.uuid.
  @Test("a withdrawal deletes the directory where posthog-ios queues unsent events")
  func eventQueueDirectory() throws {
    let settings = try #require(try PostHogSettings.parse(apiKey: key, host: host))
    let queue = settings.eventQueueDirectory(
      applicationSupport: URL(filePath: "/sandbox/Library/Application Support", directoryHint: .isDirectory),
      bundleIdentifier: "app.aistylist.mobile.dev"
    )
    #expect(
      queue.pathComponents == [
        "/", "sandbox", "Library", "Application Support", "app.aistylist.mobile.dev", "phc_test",
        "posthog.queueFolder.uuid",
      ]
    )
    #expect(queue.hasDirectoryPath)
  }

  /// One `beforeSend` decision: event name, seconds before (-) or after (+) the SDK setup, whether
  /// consent was withdrawn after crash capture was last armed, and the expected verdict.
  // nonisolated: a plain test argument read by Swift Testing off the main actor, like AnalyticsEvent.
  nonisolated struct DropCase: Sendable, CustomTestStringConvertible {
    let name: String
    let secondsFromSetUp: Double
    let withdrawnSinceArmed: Bool
    let dropped: Bool
    let testDescription: String
  }

  @Test(
    "only a crash report written while consent was withdrawn is dropped",
    arguments: [
      DropCase(
        name: "$exception", secondsFromSetUp: -60, withdrawnSinceArmed: true, dropped: true,
        testDescription: "crash from before this setup, consent withdrawn since capture was armed: dropped"),
      DropCase(
        name: "$exception", secondsFromSetUp: -60, withdrawnSinceArmed: false, dropped: false,
        testDescription: "crash from before this setup while consent was on: sent"),
      DropCase(
        name: "$exception", secondsFromSetUp: 5, withdrawnSinceArmed: true, dropped: false,
        testDescription: "exception captured after this setup: sent"),
      DropCase(
        name: "$exception", secondsFromSetUp: 0, withdrawnSinceArmed: true, dropped: false,
        testDescription: "exception timestamped exactly at setup: sent"),
      DropCase(
        name: "app_opened", secondsFromSetUp: -60, withdrawnSinceArmed: true, dropped: false,
        testDescription: "any other event: never dropped by this rule"),
    ]
  )
  func dropsOnlyCrashesWrittenWhileWithdrawn(_ drop: DropCase) {
    let setUpAt = Date(timeIntervalSince1970: 1_800_000_000)
    let verdict = PostHogSettings.dropsEvent(
      named: drop.name,
      timestamp: setUpAt.addingTimeInterval(drop.secondsFromSetUp),
      setUpAt: setUpAt,
      withdrawnSinceArmed: drop.withdrawnSinceArmed
    )
    #expect(verdict == drop.dropped)
  }
}
