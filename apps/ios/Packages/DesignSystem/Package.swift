// swift-tools-version: 6.4
// DesignSystem: the app-internal design system (DEC-87, ADR-0011 amendment). Tests live in
// tests/<Target>Tests (repo rule: tests in the owning module's tests/ directory).
//   DesignTokens  Foundation-only token values; builds and tests on Linux too. `just generate` writes
//                 them into Sources/DesignTokens/generated/ (never hand-edit that directory). Beside
//                 generated/ it also holds the hand-written C02 icon geometry (AppIconGeometry), UI-free
//                 so it tests on Linux.
//   DesignSystem  SwiftUI base components on top of DesignTokens (AppButton C01, AppIcon C02, AppChip,
//                 AppTag, AppBadge and AppReasonRow C03); Apple platforms only (left out of this manifest
//                 on Linux). System core: no previews, no dev tools. Its copy lives in the String Catalog
//                 Resources/Localizable.xcstrings (source language en, `defaultLocalization` below).
//   DesignSystemCatalog  dev-only: the Xcode previews and the debug "Design system gallery" (AI-195).
//                 Apple platforms only. Only the app target's Dev configuration links it (project.yml,
//                 Config/Dev.xcconfig); production code never imports it.
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
  // Resources/Fonts: the bundled Figtree and Young Serif fonts (OFL 1.1), registered by AppFonts.
  // Resources/Localizable.xcstrings: the components' copy, read through AppStrings.
  targets.append(
    .target(
      name: "DesignSystem",
      dependencies: ["DesignTokens"],
      resources: [.process("Resources")],
      swiftSettings: strictSettings
    )
  )
  targets.append(
    .testTarget(
      name: "DesignSystemTests",
      dependencies: ["DesignSystem", "DesignTokens"],
      path: "tests/DesignSystemTests",
      swiftSettings: strictSettings
    )
  )
  products.append(.library(name: "DesignSystemCatalog", targets: ["DesignSystemCatalog"]))
  targets.append(
    .target(
      name: "DesignSystemCatalog",
      dependencies: ["DesignSystem", "DesignTokens"],
      swiftSettings: strictSettings
    )
  )
  targets.append(
    .testTarget(
      name: "DesignSystemCatalogTests",
      dependencies: ["DesignSystemCatalog", "DesignSystem", "DesignTokens"],
      path: "tests/DesignSystemCatalogTests",
      swiftSettings: strictSettings
    )
  )
#endif

let package = Package(
  name: "DesignSystem",
  defaultLocalization: "en",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: products,
  targets: targets
)
