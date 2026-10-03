// How the PostHog sink configures the posthog-ios SDK, as plain values with no SDK import, so the
// privacy settings are unit-tested on Linux too. The adapter (apps/ios/App/PostHogAnalyticsSink.swift)
// copies every field onto `PostHogConfig` and applies the withdrawal rules at the end of this type.
// Rules: planning/14 §5 (crash reports carry no screenshots, no view hierarchies, no breadcrumbs other
// than event names) and §9 (only the events the app tracks through the port, consent-gated,
// pseudonymous).
public import AppConfig
public import Foundation

// nonisolated: an immutable Sendable value (like AppConfig), usable from any isolation domain.
nonisolated public struct PostHogSettings: Sendable, Equatable {
  /// Who gets a PostHog person profile. There is deliberately no "always" case.
  nonisolated public enum PersonProfiles: Sendable, Equatable {
    case never
    /// Only after an explicit identify call; the app makes none today, so events stay anonymous.
    case identifiedOnly
  }

  /// Build setting (xcconfig or environment, never committed) holding the PostHog project key.
  public static let apiKeyKey = "POSTHOG_API_KEY"
  /// Build setting holding the ingestion host of the PostHog project's region (this project, US Cloud:
  /// https://us.i.posthog.com). Nothing here assumes a region.
  public static let hostKey = "POSTHOG_HOST"

  /// The project key (`phc_…`). It ships in the app bundle, so it is public by design; it is still
  /// kept out of the repository and read at build time.
  public let apiKey: String
  public let host: URL

  // Automatic capture: all off. Events come only from the analytics port.
  public let captureApplicationLifecycleEvents = false
  public let captureScreenViews = false
  public let captureElementInteractions = false
  public let captureSwiftUIElementInteractions = false
  /// Off: everything that needs swizzling (screen views, autocapture, replay, surveys, push,
  /// tracing headers) stays uninstalled. Crash capture does not need it.
  public let enableSwizzling = false
  public let capturePushNotificationSubscriptions = false
  public let capturePushNotificationOpened = false

  // Recording and in-app UI: off. Session replay is the SDK feature that takes screenshots.
  public let sessionReplay = false
  public let surveys = false

  // Feature flags: no preload at setup and no `$feature_flag_called` events.
  public let preloadFeatureFlags = false
  public let sendFeatureFlagEvent = false

  // People: a pseudonymous distinct id only, and no device or app *person* properties (events still
  // carry the SDK's standard device and app event properties, e.g. OS version and app version).
  public let personProfiles = PersonProfiles.identifiedOnly
  public let setDefaultPersonProperties = false

  // Error tracking: native crash capture on (it runs only after consent, like everything above).
  public let errorTrackingAutoCapture = true
  /// Off: crash reports carry no breadcrumbs ("exception steps").
  public let exceptionSteps = false

  /// Returns nil when the key is blank: analytics is off for this build, so the composition root
  /// binds `NoopSink` and no PostHog code runs. A key without a valid https host throws.
  public static func parse(apiKey: String?, host: String?) throws(ConfigError) -> PostHogSettings? {
    guard let key = AppConfig.nonBlank(apiKey) else { return nil }
    guard key.hasPrefix("phc_") else {
      throw ConfigError(
        key: apiKeyKey,
        reason: "must be a PostHog project key (phc_...); a personal API key (phx_...) is a secret and never ships"
      )
    }
    guard let hostText = AppConfig.nonBlank(host) else {
      throw ConfigError(key: hostKey, reason: "must be set when \(apiKeyKey) is set")
    }
    guard
      let url = URL(string: hostText),
      url.scheme?.lowercased() == "https",
      let name = url.host(), !name.isEmpty,
      url.query() == nil, url.fragment() == nil, url.user() == nil
    else {
      throw ConfigError(key: hostKey, reason: "must be an absolute https URL such as https://us.i.posthog.com")
    }
    return PostHogSettings(apiKey: key, host: url)
  }

  private init(apiKey: String, host: URL) {
    self.apiKey = apiKey
    self.host = host
  }

  // MARK: Consent withdrawal
  //
  // posthog-ios keeps two things across a withdrawal that must not reach PostHog: the events it has
  // queued but not sent, and a crash written to disk after the withdrawal. Both rules below mirror SDK
  // internals of the commit pinned in apps/ios/Package.resolved (posthog-ios 3.85.0): re-check them
  // against the SDK source on every posthog-ios bump.

  /// Where posthog-ios keeps the events it has not sent yet:
  /// `Application Support/<bundle id>/<project key>/posthog.queueFolder.uuid` (PostHog/PostHogStorage.swift:
  /// `applicationSupportDirectoryURL()`, `getAppFolderUrl(from:)`, `StorageKey.queue`). The SDK has no
  /// public call that empties it (`PostHogQueue.clear()` is internal), and `optOut()` leaves the queue
  /// flushing, so on a withdrawal the sink stops the queue with `close()` and deletes this directory.
  public func eventQueueDirectory(applicationSupport: URL, bundleIdentifier: String) -> URL {
    applicationSupport
      .appending(path: bundleIdentifier, directoryHint: .isDirectory)
      .appending(path: apiKey, directoryHint: .isDirectory)
      .appending(path: "posthog.queueFolder.uuid", directoryHint: .isDirectory)
  }

  /// The sink's `beforeSend` rule: whether to drop an event instead of queueing it.
  ///
  /// posthog-ios cannot remove its native crash handler once installed, so after a withdrawal a crash
  /// in the same run is still written to disk. The next SDK setup, which only follows the next grant,
  /// turns that report into a `$exception` event timestamped at the crash. `withdrawnSinceArmed` is
  /// true when consent was withdrawn after crash capture was last armed and not granted again before
  /// this setup (`setUpAt`): every `$exception` from before this setup is then such a report and is
  /// dropped. Everything else is kept.
  public static func dropsEvent(named name: String, timestamp: Date, setUpAt: Date, withdrawnSinceArmed: Bool)
    -> Bool
  {
    withdrawnSinceArmed && name == "$exception" && timestamp < setUpAt
  }
}
