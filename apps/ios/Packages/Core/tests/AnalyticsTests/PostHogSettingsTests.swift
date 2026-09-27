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
  private let host = "https://eu.i.posthog.com"

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
    arguments: ["http://eu.i.posthog.com", "eu.i.posthog.com", "https://"]
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
}
