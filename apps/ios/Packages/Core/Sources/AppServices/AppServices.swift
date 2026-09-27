// The dependency container the composition root (apps/ios/App/CompositionRoot.swift) builds once
// and hands to features. Features depend on these protocols, never on APIData or the generated
// client, so they can be tested with fakes and never see transport details.
public import Analytics
public import AppConfig
public import Foundation

/// Build identity of the running API (`GET /v1/version`), independent of the generated types.
nonisolated public struct APIVersion: Sendable, Equatable {
  public let version: String
  public let commit: String
  public let builtAt: Date

  public init(version: String, commit: String, builtAt: Date) {
    self.version = version
    self.commit = commit
    self.builtAt = builtAt
  }
}

/// Outcome of a version fetch. `failure` carries a short, user-safe message (never a stack or
/// raw response body).
nonisolated public enum VersionResult: Sendable, Equatable {
  case ok(APIVersion)
  case failure(message: String)
}

public protocol VersionFetching {
  /// Never throws: every failure is mapped to `.failure(message:)`.
  func fetchVersion() async -> VersionResult
}

/// Developer-only actions. The composition root provides them only in DEBUG builds of the app
/// target (the Dev configuration); Preview and Prod get nil, so their UI never shows debug tools.
public struct DebugTools {
  /// Crashes the app on purpose (the app target's `forceTestCrash()`), to prove crash capture and
  /// dSYM symbolication (P02 AC-6).
  public let forceTestCrash: () -> Void

  public init(forceTestCrash: @escaping () -> Void) {
    self.forceTestCrash = forceTestCrash
  }
}

public struct AppServices {
  public let config: AppConfig
  public let version: any VersionFetching
  public let analytics: any Analytics
  /// nil outside DEBUG builds of the app target.
  public let debug: DebugTools?

  public init(
    config: AppConfig,
    version: any VersionFetching,
    analytics: any Analytics,
    debug: DebugTools? = nil
  ) {
    self.config = config
    self.version = version
    self.analytics = analytics
    self.debug = debug
  }
}
