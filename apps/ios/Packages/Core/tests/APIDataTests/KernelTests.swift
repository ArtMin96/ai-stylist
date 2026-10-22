// The generated shared-kernel constants (AIStylistKernel, ADR-0005) compile in this package and keep their
// registry invariants. The tests assert relations between generated values, never a registry value itself:
// a copied bound or code here would be a second source of truth (CLAUDE.md, single source of truth).
import AIStylistKernel
import Testing

/// HTTP error statuses (RFC 9110 §15.5, §15.6): every API error code answers with one of them.
private let httpErrorStatuses = 400...599

@Suite("AIStylistKernel")
struct KernelTests {
  @Test("every measurement has a non-empty inclusive range", arguments: MeasurementId.allCases)
  func measurementBounds(id: MeasurementId) {
    #expect(id.minimum < id.maximum)
  }

  @Test("every measurement is stored in its dimension's canonical unit", arguments: MeasurementId.allCases)
  func measurementUnit(id: MeasurementId) {
    #expect(id.unit == id.dimension.canonicalUnit)
  }

  @Test("every error code round-trips through its wire value", arguments: ErrorCode.allCases)
  func errorCodeRoundTrip(code: ErrorCode) {
    #expect(ErrorCode(rawValue: code.rawValue) == code)
    #expect(httpErrorStatuses.contains(code.status))
  }

  @Test("an error code this build lacks decodes to nil")
  func unknownErrorCode() {
    #expect(ErrorCode(rawValue: "NOT_A_REGISTERED_CODE") == nil)
  }

  @Test("the default starting shape is one of the offered shapes")
  func defaultStartingShape() {
    #expect(StartingShape.allCases.contains(StartingShapes.defaultShape))
  }

  @Test("only level entitlements carry levels", arguments: EntitlementName.allCases)
  func entitlementLevels(name: EntitlementName) {
    #expect((name.kind == .level) == !name.levels.isEmpty)
  }
}
