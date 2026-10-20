// swift-tools-version: 6.4
// DesignSystem: the app-internal design system (DEC-87, ADR-0011 amendment). Tests live in
// tests/<Target>Tests (repo rule: tests in the owning module's tests/ directory).
//   DesignTokens  Foundation-only token values; builds and tests on Linux too. `just generate` writes
//                 them into Sources/DesignTokens/generated/ (never hand-edit that directory).
//   DesignSystem  SwiftUI base components on top of DesignTokens; Apple platforms only (left out of
//                 this manifest on Linux).
// No dependency on Core or APIData: tokens and base components know nothing of services or the
// generated client.
import PackageDescription

// jscpd:ignore-start (SwiftPM manifests cannot share code; the copies are kept in sync by hand.)
/// Same safety settings as Packages/Core/Package.swift, Packages/Features/Package.swift and
/// Config/Base.xcconfig.
let strictSettings: [SwiftSetting] = [
  .swiftLanguageMode(.v6),
  .defaultIsolation(MainActor.self),
  .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
  .enableUpcomingFeature("InferIsolatedConformances"),
  .enableUpcomingFeature("ExistentialAny"),
  .enableUpcomingFeature("MemberImportVisibility"),
  .enableUpcomingFeature("InternalImportsByDefault"),
  .treatAllWarnings(as: .error),
]
// jscpd:ignore-end

var products: [Product] = [
  .library(name: "DesignTokens", targets: ["DesignTokens"])
]
var targets: [Target] = [
  .target(name: "DesignTokens", swiftSettings: strictSettings),
  .testTarget(
    name: "DesignTokensTests",
    dependencies: ["DesignTokens"],
    path: "tests/DesignTokensTests",
    swiftSettings: strictSettings
  ),
]

#if !os(Linux)
  // SwiftUI exists only on Apple platforms.
  products.append(.library(name: "DesignSystem", targets: ["DesignSystem"]))
  targets.append(
    .target(name: "DesignSystem", dependencies: ["DesignTokens"], swiftSettings: strictSettings)
  )
  targets.append(
    .testTarget(
      name: "DesignSystemTests",
      dependencies: ["DesignSystem"],
      path: "tests/DesignSystemTests",
      swiftSettings: strictSettings
    )
  )
#endif

let package = Package(
  name: "DesignSystem",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: products,
  targets: targets
)
