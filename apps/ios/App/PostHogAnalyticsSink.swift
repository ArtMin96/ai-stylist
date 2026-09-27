// AnalyticsSink over the official PostHog iOS SDK (posthog-ios, pinned in project.yml). It lives in
// the app target because posthog-ios is Apple-only; Core stays SDK-free and Linux-testable.
//
// Only ConsentGatedAnalytics calls this type, and only after the user opts in. Before the first
// grant nothing here runs: the SDK is not set up, opens no connection and installs no crash handler.
// The privacy settings come from `PostHogSettings` (Core, unit-tested); this file only copies them.
import Analytics
import Foundation
import PostHog

final class PostHogAnalyticsSink: AnalyticsSink {
  private let settings: PostHogSettings
  private var isSetUp = false

  init(settings: PostHogSettings) {
    self.settings = settings
  }

  func activate() {
    let sdk = PostHogSDK.shared
    if !isSetUp {
      isSetUp = true
      // Installs crash capture (skipped while a debugger is attached) and queues a crash stored
      // on disk by an earlier launch as a `$exception` event.
      sdk.setup(Self.makeConfig(settings))
    }
    // The consent gate owns consent. After a withdrawal (in this launch, or persisted by the SDK
    // from an earlier one) the SDK is opted out with its integrations uninstalled; optIn() clears
    // that and reinstalls them. It does nothing when the SDK is not opted out.
    sdk.optIn()
  }

  func deactivate() {
    // Drops every later capture call and uninstalls the integrations. posthog-ios cannot remove the
    // native crash handler once installed, so it stays registered until the process exits; a crash
    // in that window is stored on disk and sent only after the user opts in again.
    PostHogSDK.shared.optOut()
  }

  func send(_ event: AnalyticsEvent) {
    PostHogSDK.shared.capture(event.name, properties: event.properties.mapValues { Self.sdkValue($0) })
  }

  /// Copies every `PostHogSettings` field onto the SDK config; keep the two lists in step.
  private static func makeConfig(_ settings: PostHogSettings) -> PostHogConfig {
    let config = PostHogConfig(projectToken: settings.apiKey, host: settings.host.absoluteString)
    config.captureApplicationLifecycleEvents = settings.captureApplicationLifecycleEvents
    config.captureScreenViews = settings.captureScreenViews
    config.captureElementInteractions = settings.captureElementInteractions
    config.captureSwiftUIElementInteractions = settings.captureSwiftUIElementInteractions
    config.enableSwizzling = settings.enableSwizzling
    config.capturePushNotificationSubscriptions = settings.capturePushNotificationSubscriptions
    config.capturePushNotificationOpened = settings.capturePushNotificationOpened
    config.sessionReplay = settings.sessionReplay
    config.surveys = settings.surveys
    config.preloadFeatureFlags = settings.preloadFeatureFlags
    config.sendFeatureFlagEvent = settings.sendFeatureFlagEvent
    config.personProfiles = sdkPersonProfiles(settings.personProfiles)
    config.setDefaultPersonProperties = settings.setDefaultPersonProperties
    config.errorTrackingConfig.autoCapture = settings.errorTrackingAutoCapture
    config.errorTrackingConfig.exceptionSteps.enabled = settings.exceptionSteps
    return config
  }

  private static func sdkPersonProfiles(_ value: PostHogSettings.PersonProfiles) -> PostHogPersonProfiles {
    switch value {
    case .never:
      return .never
    case .identifiedOnly:
      return .identifiedOnly
    }
  }

  /// Event properties are enums, booleans, counts and ids only (planning/14 §9); no free-form objects.
  private static func sdkValue(_ value: AnalyticsValue) -> Any {
    switch value {
    case .string(let text):
      return text
    case .int(let number):
      return number
    case .double(let number):
      return number
    case .bool(let flag):
      return flag
    }
  }
}
