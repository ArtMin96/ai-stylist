// Port of apps/mobile/src/lib/tests/config.test.ts, plus the host-only rule for API_BASE_URL.
import AppConfig
import Foundation
import Testing

@Suite("AppConfig.parse")
struct AppConfigTests {
  @Test("defaults the API base URL to localhost:3000 when unset or blank", arguments: [nil, "", "  "])
  func defaultsWhenBlank(value: String?) throws {
    let config = try AppConfig.parse(RawConfig(apiBaseURL: value, appVersion: nil))
    #expect(config.apiBaseURL.absoluteString == AppConfig.defaultAPIBaseURL)
    #expect(config.appVersion == "0.0.0")
  }

  @Test("accepts an https URL and strips trailing slashes")
  func stripsTrailingSlash() throws {
    let config = try AppConfig.parse(RawConfig(apiBaseURL: "https://api.example.test//", appVersion: "0.1.0"))
    #expect(config.apiBaseURL.absoluteString == "https://api.example.test")
    #expect(config.appVersion == "0.1.0")
  }

  @Test("keeps an explicit port")
  func keepsPort() throws {
    let config = try AppConfig.parse(RawConfig(apiBaseURL: "http://10.0.0.5:3000/", appVersion: nil))
    #expect(config.apiBaseURL.absoluteString == "http://10.0.0.5:3000")
  }

  @Test(
    "rejects anything that is not an absolute http(s) URL, naming the key",
    arguments: ["ftp://nope", "localhost:3000", "not a url", "http://"]
  )
  func rejectsNonHTTP(value: String) {
    let error = #expect(throws: ConfigError.self) {
      try AppConfig.parse(RawConfig(apiBaseURL: value, appVersion: nil))
    }
    #expect(error?.key == "API_BASE_URL")
  }

  @Test(
    "rejects a base URL with a path, query or fragment (host-only, so requests hit /v1 exactly once)",
    arguments: [
      "http://localhost:3000/v1", "https://api.ai-stylist.app/v1/", "http://localhost:3000?x=1", "http://h#f",
    ]
  )
  func rejectsPath(value: String) {
    #expect(throws: ConfigError.self) {
      try AppConfig.parse(RawConfig(apiBaseURL: value, appVersion: nil))
    }
  }
}
