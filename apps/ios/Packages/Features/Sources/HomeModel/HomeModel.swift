// View model of the placeholder home screen: proves the generated client reaches the API and that
// analytics stays off until consent. Parity with the retired React Native home screen (ADR-0004) and with apps/android.
import Analytics
import AppConfig
public import AppServices
import Foundation
public import Observation

@Observable
public final class HomeModel {
  nonisolated public enum VersionState: Equatable, Sendable {
    case loading
    /// "API <version> (<commit prefix 7>)"
    case loaded(String)
    /// "The API is not reachable right now: <message>"
    case failed(String)
  }

  public private(set) var versionState: VersionState = .loading
  public private(set) var hasConsent: Bool
  /// The configured API host, shown under the title.
  public let apiBaseURLText: String

  @ObservationIgnored private let services: AppServices
  @ObservationIgnored private var didTrackOpen = false

  public init(services: AppServices) {
    self.services = services
    hasConsent = services.analytics.hasConsent
    apiBaseURLText = services.config.apiBaseURL.absoluteString
  }

  /// Called when the screen appears: records `app_opened` once (dropped by the gate unless the
  /// user has opted in), then loads the API version.
  public func onAppear() async {
    if !didTrackOpen {
      didTrackOpen = true
      services.analytics.track(.appOpened(appVersion: services.config.appVersion, coldStart: true))
    }
    await loadVersion()
  }

  public func retry() async {
    await loadVersion()
  }

  public func setConsent(_ granted: Bool) {
    services.analytics.setConsent(granted)
    hasConsent = granted
  }

  private func loadVersion() async {
    versionState = .loading
    switch await services.version.fetchVersion() {
    case .ok(let api):
      versionState = .loaded("API \(api.version) (\(api.commit.prefix(7)))")
    case .failure(let message):
      versionState = .failed("The API is not reachable right now: \(message)")
    }
  }
}
