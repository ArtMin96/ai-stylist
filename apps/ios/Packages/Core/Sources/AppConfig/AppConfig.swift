// Build-time app configuration. The composition root (apps/ios/App/CompositionRoot.swift) reads
// the raw values from Info.plist (fed by Config/<Env>.xcconfig) and calls `AppConfig.parse`, the
// pure validator below. Everything here ships inside the app bundle, so it is public: never put
// a secret in an xcconfig.
public import Foundation

/// Raw, unvalidated values exactly as the bundle provides them.
nonisolated public struct RawConfig: Sendable, Equatable {
  /// Info.plist `AIStylistAPIBaseURL`, which is `$(API_BASE_URL)` from the xcconfig.
  public var apiBaseURL: String?
  /// Info.plist `CFBundleShortVersionString` (`MARKETING_VERSION`).
  public var appVersion: String?

  public init(apiBaseURL: String?, appVersion: String?) {
    self.apiBaseURL = apiBaseURL
    self.appVersion = appVersion
  }
}

/// A configuration value was invalid. `key` names the offending setting.
nonisolated public struct ConfigError: Error, Equatable, CustomStringConvertible {
  public let key: String
  public let reason: String

  public var description: String { "\(key) \(reason)" }
}

/// Validated configuration handed to the rest of the app.
nonisolated public struct AppConfig: Sendable, Equatable {
  /// Build setting name (xcconfig) of the API base URL.
  public static let apiBaseURLKey = "API_BASE_URL"
  /// Local dev default: the API listens on port 3000 (`just dev-api`); the iOS simulator shares
  /// the Mac's network, so `localhost` reaches it.
  public static let defaultAPIBaseURL = "http://localhost:3000"

  /// HOST-ONLY base URL (scheme, host, optional port; no path, no trailing slash). The API's
  /// operation paths already start with `/v1`, so requests end up at `<base>/v1/...` exactly once.
  public let apiBaseURL: URL
  public let appVersion: String

  /// Validates raw values. Blank values fall back to defaults; anything else invalid throws a
  /// `ConfigError` naming the key.
  public static func parse(_ raw: RawConfig) throws(ConfigError) -> AppConfig {
    let text = blankToNil(raw.apiBaseURL) ?? defaultAPIBaseURL
    return AppConfig(
      apiBaseURL: try parseHostOnlyURL(text),
      appVersion: blankToNil(raw.appVersion) ?? "0.0.0"
    )
  }

  private static func parseHostOnlyURL(_ text: String) throws(ConfigError) -> URL {
    var trimmed = Substring(text)
    while trimmed.hasSuffix("/") {
      trimmed = trimmed.dropLast()
    }
    guard
      let url = URL(string: String(trimmed)),
      let scheme = url.scheme?.lowercased(),
      scheme == "http" || scheme == "https",
      let host = url.host(), !host.isEmpty
    else {
      throw ConfigError(key: apiBaseURLKey, reason: "must be an absolute http(s) URL")
    }
    guard url.path().isEmpty, url.query() == nil, url.fragment() == nil, url.user() == nil else {
      throw ConfigError(
        key: apiBaseURLKey,
        reason: "must be host-only (scheme://host[:port]) with no path; API paths already start with /v1"
      )
    }
    return url
  }

  private static func blankToNil(_ value: String?) -> String? {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
      return nil
    }
    return trimmed
  }
}
