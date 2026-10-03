// Composition root: the ONLY place that reads bundle configuration and constructs concrete
// adapters (API client, analytics sink, debug tools). Features receive them through `AppServices`.
// Mirrors composeServices() in the retired React Native app (ADR-0004); same shape as apps/android's AppContainer.
import APIData
import Analytics
import AppConfig
import AppServices
import Foundation

enum CompositionRoot {
  /// Info.plist key holding `$(API_BASE_URL)` from Config/<Env>.xcconfig.
  static let apiBaseURLInfoKey = "AIStylistAPIBaseURL"
  /// Info.plist keys holding `$(POSTHOG_API_KEY)` / `$(POSTHOG_HOST)`. The values are never committed:
  /// they come from the gitignored Config/Local.xcconfig or the environment at build time.
  static let postHogAPIKeyInfoKey = "AIStylistPostHogAPIKey"
  static let postHogHostInfoKey = "AIStylistPostHogHost"

  static func makeServices(bundle: Bundle = .main) -> AppServices {
    let raw = RawConfig(
      apiBaseURL: bundle.object(forInfoDictionaryKey: apiBaseURLInfoKey) as? String,
      appVersion: bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    )
    let config: AppConfig
    let postHog: PostHogSettings?
    do {
      config = try AppConfig.parse(raw)
      postHog = try PostHogSettings.parse(
        apiKey: bundle.object(forInfoDictionaryKey: postHogAPIKeyInfoKey) as? String,
        host: bundle.object(forInfoDictionaryKey: postHogHostInfoKey) as? String
      )
    } catch {
      // A broken build configuration, not a runtime condition: fail loudly at launch.
      fatalError("Invalid build configuration: \(error)")
    }
    return AppServices(
      config: config,
      version: VersionService.live(baseURL: config.apiBaseURL),
      // Consent-gated: the sink gets no call at all until the user opts in.
      analytics: ConsentGatedAnalytics(sink: makeAnalyticsSink(postHog)),
      debug: makeDebugTools()
    )
  }

  /// No PostHog key in this build: `NoopSink`, so no PostHog code ever runs.
  private static func makeAnalyticsSink(_ settings: PostHogSettings?) -> any AnalyticsSink {
    guard let settings else { return NoopSink() }
    return PostHogAnalyticsSink(settings: settings)
  }

  /// Debug tools exist only in DEBUG builds (the Dev configuration); Preview and Prod get nil.
  private static func makeDebugTools() -> DebugTools? {
    #if DEBUG
      return DebugTools(forceTestCrash: { forceTestCrash() })
    #else
      return nil
    #endif
  }
}
