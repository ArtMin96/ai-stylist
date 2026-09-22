// GET /v1/version through the GENERATED client (packages/contracts/gen/swift-client), mapped to a
// result the home screen can render. This target is the only place that imports the generated
// client or the OpenAPI runtime (enforced by apps/ios/scripts/check-banned.sh).
import AIStylistAPI
public import AppServices
public import Foundation
import HTTPTypes
public import OpenAPIRuntime
import OpenAPIURLSession

public struct VersionService: VersionFetching {
  static let unreachableMessage = "Could not reach the API"

  private let client: Client

  /// - Parameters:
  ///   - baseURL: the HOST-ONLY base URL from `AppConfig.apiBaseURL`. Deliberately NOT the
  ///     generated `Servers` URLs: those end in `/v1` while the operation paths also start with
  ///     `/v1`, which would request `/v1/v1/version`.
  ///   - transport: the HTTP transport (tests pass an in-memory fake).
  public init(baseURL: URL, transport: any ClientTransport) {
    client = Client(
      serverURL: baseURL,
      configuration: Configuration(dateTranscoder: LenientISO8601DateTranscoder()),
      transport: transport
    )
  }

  /// The production service: URLSession transport against `baseURL`.
  public static func live(baseURL: URL) -> VersionService {
    VersionService(baseURL: baseURL, transport: URLSessionTransport())
  }

  public func fetchVersion() async -> VersionResult {
    do {
      switch try await client.getVersion() {
      case .ok(let ok):
        let info = try ok.body.json
        return .ok(APIVersion(version: info.version, commit: info.commit, builtAt: info.builtAt))
      case .default(let statusCode, let problem):
        let title = try? problem.body.applicationProblemJson.title
        return .failure(message: title ?? "API responded with \(statusCode)")
      }
    } catch let error as ClientError {
      // A response arrived but could not be decoded (wrong content type, bad JSON, bad date).
      if let response = error.response {
        return .failure(message: "API responded with \(response.status.code)")
      }
      return .failure(message: Self.unreachableMessage)
    } catch {
      return .failure(message: Self.unreachableMessage)
    }
  }
}
