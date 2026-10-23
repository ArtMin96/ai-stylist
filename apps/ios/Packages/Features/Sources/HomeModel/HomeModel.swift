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
  /// True only when the composition root provides debug tools (DEBUG builds of the app target), so
  /// Preview and Prod never show the debug consent toggle or the crash button.
  public let showsDebugTools: Bool
  /// True only when the app root passes a gallery action (the Dev build), so Preview and Prod never
  /// show the "Design system gallery" button.
  public let showsDesignSystemGallery: Bool
  /// True only when the app root passes a capture action (the Dev build, capture brief Q-F), so Preview
  /// and Prod never show "Add item" while capture saves nothing.
  public let showsCaptureEntry: Bool

  @ObservationIgnored private let services: AppServices
  @ObservationIgnored private let openGallery: (() -> Void)?
  @ObservationIgnored private let openCaptureFlow: (() -> Void)?
  @ObservationIgnored private var didTrackOpen = false

  /// - Parameters:
  ///   - openDesignSystemGallery: presents the debug design-system gallery; nil hides its button.
  ///     Presentation, not a service, so it is not part of `AppServices`.
  ///   - openCapture: presents the guided capture camera; nil hides "Add item".
  public init(
    services: AppServices,
    openDesignSystemGallery: (() -> Void)? = nil,
    openCapture: (() -> Void)? = nil
  ) {
    self.services = services
    hasConsent = services.analytics.hasConsent
    apiBaseURLText = services.config.apiBaseURL.absoluteString
    showsDebugTools = services.debug != nil
    openGallery = openDesignSystemGallery
    showsDesignSystemGallery = openDesignSystemGallery != nil
    openCaptureFlow = openCapture
    showsCaptureEntry = openCapture != nil
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

  /// Both consent toggles (the user-facing one and the debug one) call this, so they always agree.
  public func setConsent(_ granted: Bool) {
    services.analytics.setConsent(granted)
    hasConsent = granted
  }

  /// Debug builds only: crashes the app on purpose to prove crash capture and symbolication.
  /// Does nothing when the composition root provides no debug tools.
  public func forceTestCrash() {
    services.debug?.forceTestCrash()
  }

  /// Dev build only: opens the design-system gallery. Does nothing when the app root passed no action.
  public func openDesignSystemGallery() {
    openGallery?()
  }

  /// Dev build only: opens the capture camera ("Add item"). Does nothing when the app root passed no action.
  public func openCapture() {
    openCaptureFlow?()
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
