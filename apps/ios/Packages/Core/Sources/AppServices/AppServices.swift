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

public struct AppServices {
  public let config: AppConfig
  public let version: any VersionFetching
  public let analytics: any Analytics

  public init(config: AppConfig, version: any VersionFetching, analytics: any Analytics) {
    self.config = config
    self.version = version
    self.analytics = analytics
  }
}
