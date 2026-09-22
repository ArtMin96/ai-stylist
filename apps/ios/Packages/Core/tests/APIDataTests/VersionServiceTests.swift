// GET /v1/version through the real generated client with an in-memory transport: success, date
// formats, problem+json, non-problem errors, network failure, and the exactly-one-/v1 URL rule.
// Ported from the version cases of the retired React Native home-screen tests (ADR-0004).
import APIData
import AppConfig
import AppServices
import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing

/// Records every request and answers with a canned response (or fails like a dead network).
private actor FakeTransport: ClientTransport {
  struct Canned: Sendable {
    var status: HTTPResponse.Status
    var contentType: String
    var body: String
  }

  struct Offline: Error {}

  private let canned: Canned?
  private(set) var requestedURLs: [String] = []

  init(_ canned: Canned?) {
    self.canned = canned
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    // Transports resolve the request path against the base URL by plain concatenation.
    requestedURLs.append(baseURL.absoluteString + (request.path ?? ""))
    guard let canned else { throw Offline() }
    var headers = HTTPFields()
    headers[.contentType] = canned.contentType
    return (HTTPResponse(status: canned.status, headerFields: headers), HTTPBody(canned.body))
  }
}

private func versionJSON(builtAt: String) -> FakeTransport.Canned {
  FakeTransport.Canned(
    status: .ok,
    contentType: "application/json",
    body: #"{"version":"1.2.3","commit":"abcdef0123456789","builtAt":"\#(builtAt)"}"#
  )
}

private let apiBase = URL(string: "http://api.test")

@Suite("VersionService")
struct VersionServiceTests {
  private func fetch(_ canned: FakeTransport.Canned?) async throws -> (VersionResult, FakeTransport) {
    let transport = FakeTransport(canned)
    let service = VersionService(baseURL: try #require(apiBase), transport: transport)
    return (await service.fetchVersion(), transport)
  }

  @Test("maps a 200 to the API version")
  func success() async throws {
    let (result, _) = try await fetch(versionJSON(builtAt: "2026-09-10T00:00:00Z"))
    let expected = APIVersion(
      version: "1.2.3",
      commit: "abcdef0123456789",
      builtAt: Date(timeIntervalSince1970: 1_788_998_400)
    )
    #expect(result == .ok(expected))
  }

  @Test(
    "accepts builtAt with or without fractional seconds and with a numeric offset",
    arguments: [
      ("2026-09-10T00:00:00Z", 1_788_998_400.0),
      ("2026-09-10T00:00:00.250Z", 1_788_998_400.25),
      ("2026-09-10T02:00:00+02:00", 1_788_998_400.0),
    ]
  )
  func lenientDates(builtAt: String, epochSeconds: Double) async throws {
    let (result, _) = try await fetch(versionJSON(builtAt: builtAt))
    guard case .ok(let version) = result else {
      Issue.record("expected .ok, got \(result)")
      return
    }
    #expect(abs(version.builtAt.timeIntervalSince1970 - epochSeconds) < 0.001)
  }

  @Test("uses the problem+json title for an error response")
  func problemTitle() async throws {
    let (result, _) = try await fetch(
      FakeTransport.Canned(
        status: .serviceUnavailable,
        contentType: "application/problem+json",
        body: #"{"type":"about:blank","title":"Service Unavailable","status":503,"code":"SERVICE_UNAVAILABLE"}"#
      )
    )
    #expect(result == .failure(message: "Service Unavailable"))
  }

  @Test("falls back to the status code when the error body is not problem+json")
  func nonProblemError() async throws {
    let (result, _) = try await fetch(
      FakeTransport.Canned(status: .badGateway, contentType: "text/html", body: "<h1>Bad gateway</h1>")
    )
    #expect(result == .failure(message: "API responded with 502"))
  }

  @Test("reports an unreachable API when the transport fails (never a stack trace)")
  func unreachable() async throws {
    let (result, _) = try await fetch(nil)
    #expect(result == .failure(message: "Could not reach the API"))
  }

  @Test("requests <host-only base>/v1/version with exactly one /v1")
  func exactlyOneV1() async throws {
    let config = try AppConfig.parse(RawConfig(apiBaseURL: "http://localhost:3000/", appVersion: nil))
    let transport = FakeTransport(versionJSON(builtAt: "2026-09-10T00:00:00Z"))
    _ = await VersionService(baseURL: config.apiBaseURL, transport: transport).fetchVersion()
    let urls = await transport.requestedURLs
    #expect(urls == ["http://localhost:3000/v1/version"])
    #expect(urls.first?.components(separatedBy: "/v1").count == 2)
  }
}
