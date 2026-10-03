// AnalyticsSink over the official PostHog iOS SDK (posthog-ios, pinned by commit in
// apps/ios/Package.resolved). It lives in the app target because posthog-ios is Apple-only; Core stays
// SDK-free and Linux-testable.
//
// Only ConsentGatedAnalytics calls this type, and only after the user opts in. Before the first
// grant nothing here runs: the SDK is not set up, opens no connection and installs no crash handler.
// The gate decides; this file only translates. The privacy settings and the withdrawal rules come from
// `PostHogSettings` (Core, unit-tested); this file applies them to the SDK.
import Analytics
import Foundation
import PostHog

final class PostHogAnalyticsSink: AnalyticsSink {
  /// UserDefaults flag (holds no user data): consent was withdrawn after crash capture was armed and
  /// not granted again. Set by `deactivate()`, cleared by `activate()`, read once per SDK setup.
  private static let withdrawnSinceArmedKey = "AIStylist.analytics.withdrawnSinceCrashCaptureArmed"

  private let settings: PostHogSettings
  private var isSetUp = false

  init(settings: PostHogSettings) {
    self.settings = settings
  }

  func activate() {
    let sdk = PostHogSDK.shared
    if !isSetUp {
      isSetUp = true
      // Read before this grant clears it (below).
      let withdrawnSinceArmed = UserDefaults.standard.bool(forKey: Self.withdrawnSinceArmedKey)
      // Installs crash capture (skipped while a debugger is attached) and turns a crash stored on
      // disk by an earlier run into a `$exception` event, here or in optIn() below. The config's
      // beforeSend drops that event when the crash happened after a withdrawal.
      sdk.setup(Self.makeConfig(settings, withdrawnSinceArmed: withdrawnSinceArmed, setUpAt: Date()))
    }
    // The consent gate owns consent. deactivate() leaves the SDK opted out, and the SDK persists
    // that; optIn() clears it and installs the integrations again. It does nothing when not opted out.
    sdk.optIn()
    UserDefaults.standard.removeObject(forKey: Self.withdrawnSinceArmedKey)
  }

  func deactivate() {
    let sdk = PostHogSDK.shared
    // Recorded first. posthog-ios cannot remove the native crash handler once installed, so it stays
    // registered until the process exits and a crash in that window is still written to disk; the
    // next setup drops that report instead of sending it (makeConfig).
    UserDefaults.standard.set(true, forKey: Self.withdrawnSinceArmedKey)
    // Drops every later capture call and uninstalls the integrations.
    sdk.optOut()
    // optOut() leaves the event queue running: its timer and the flush on entering the background
    // would still send what is queued. close() stops the queue and tears the SDK instance down (the
    // next grant sets it up again); then the queued events are deleted from disk. A batch that is
    // already being uploaded when this runs is not recalled.
    sdk.close()
    isSetUp = false
    discardUnsentEvents()
  }

  func send(_ event: AnalyticsEvent) {
    PostHogSDK.shared.capture(event.name, properties: event.properties.mapValues { Self.sdkValue($0) })
  }

  /// Deletes the SDK's on-disk event queue (`PostHogSettings.eventQueueDirectory`: posthog-ios has no
  /// public call for it). Runs after `close()`, so the queue no longer reads or writes the directory;
  /// the SDK creates it again at the next setup.
  private func discardUnsentEvents() {
    let files = FileManager.default
    guard
      let applicationSupport = files.urls(for: .applicationSupportDirectory, in: .userDomainMask).first,
      let bundleIdentifier = Bundle.main.bundleIdentifier
    else {
      assertionFailure("PostHog event queue: no Application Support directory or bundle identifier")
      return
    }
    let queue = settings.eventQueueDirectory(applicationSupport: applicationSupport, bundleIdentifier: bundleIdentifier)
    do {
      try files.removeItem(at: queue)
    } catch {
      // The SDK created this directory at setup, so a failure here means its storage layout changed
      // (re-check PostHogSettings.eventQueueDirectory against the new posthog-ios) or the file system
      // refused. Debug builds stop here. A release build keeps the files: the queue is stopped, and
      // the SDK would send them only after the next grant.
      assertionFailure("Could not discard PostHog's unsent events: \(error)")
    }
  }

  /// Copies every `PostHogSettings` field onto the SDK config; keep the two lists in step.
  private static func makeConfig(_ settings: PostHogSettings, withdrawnSinceArmed: Bool, setUpAt: Date)
    -> PostHogConfig
  {
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
    // posthog-ios runs beforeSend on the thread that captures (for a restored crash report: inside
    // setup() or optIn()), before the event is queued. @Sendable keeps the closure off the main actor;
    // it reads only the two values captured here.
    let dropCrashWrittenWhileWithdrawn: BeforeSendBlock = { @Sendable event in
      let dropped = PostHogSettings.dropsEvent(
        named: event.event,
        timestamp: event.timestamp,
        setUpAt: setUpAt,
        withdrawnSinceArmed: withdrawnSinceArmed
      )
      return dropped ? nil : event
    }
    config.setBeforeSend(dropCrashWrittenWhileWithdrawn)
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
