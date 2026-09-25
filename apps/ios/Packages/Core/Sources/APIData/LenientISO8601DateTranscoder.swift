public import Foundation
public import OpenAPIRuntime

/// Decodes RFC 3339 / ISO 8601 date-times with OR without fractional seconds, with `Z` or a
/// numeric offset. The runtime's default `.iso8601` transcoder rejects fractional seconds, but the
/// API validates `builtAt` with `z.iso.datetime({ offset: true })`, which allows them
/// (`2026-09-10T00:00:00.123Z`). Encodes without fractional seconds, like the default.
nonisolated public struct LenientISO8601DateTranscoder: DateTranscoder {
  public init() {}

  public func encode(_ date: Date) throws -> String {
    date.formatted(.iso8601)
  }

  public func decode(_ string: String) throws -> Date {
    if let date = try? Date.ISO8601FormatStyle().parse(string) {
      return date
    }
    if let date = try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(string) {
      return date
    }
    throw DecodingError.dataCorrupted(
      .init(codingPath: [], debugDescription: "Expected an ISO 8601 date-time, got '\(string)'")
    )
  }
}
