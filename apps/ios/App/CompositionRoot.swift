// Composition root: the ONLY place that reads bundle configuration and constructs concrete
// adapters (API client, analytics sink). Features receive them through `AppServices`.
// Mirrors composeServices() in the retired apps/mobile/src/app/_layout.tsx.
import APIData
import Analytics
import AppConfig
import AppServices
import Foundation

enum CompositionRoot {
  /// Info.plist key holding `$(API_BASE_URL)` from Config/<Env>.xcconfig.
  static let apiBaseURLInfoKey = "AIStylistAPIBaseURL"

  static func makeServices(bundle: Bundle = .main) -> AppServices {
    let raw = RawConfig(
      apiBaseURL: bundle.object(forInfoDictionaryKey: apiBaseURLInfoKey) as? String,
      appVersion: bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    )
    let config: AppConfig
    do {
      config = try AppConfig.parse(raw)
    } catch {
      // A broken build configuration, not a runtime condition: fail loudly at launch.
      fatalError("Invalid build configuration: \(error)")
    }
    return AppServices(
      config: config,
      version: VersionService.live(baseURL: config.apiBaseURL),
      // Consent-gated, no-op sink: zero events leave the device until a real sink ships (P03).
      analytics: ConsentGatedAnalytics(sink: NoopSink())
    )
  }
}
