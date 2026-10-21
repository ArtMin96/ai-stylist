// swift-tools-version: 6.4
// Features: one pair of targets per screen.
//   <Name>Model    @Observable view model; no SwiftUI, so it builds and tests on Linux too.
//   <Name>Feature  the SwiftUI view; Apple platforms only (left out of this manifest on Linux).
// Features depend on Core's AppServices/Analytics/AppConfig protocols and values, never on
// APIData or the generated API client (enforced by apps/ios/scripts/check-banned.sh). The generated
// package's AIStylistKernel product (registry constants, no network code; ADR-0005) is allowed: the
// capture rules come from it. *Feature targets draw with the DesignSystem package (AppButton,
// `\.appTheme`).
import PackageDescription

// jscpd:ignore-start (SwiftPM manifests cannot share code; the copies are kept in sync by hand.)
/// Same safety settings as Packages/Core/Package.swift, Packages/DesignSystem/Package.swift and
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

let core: [Target.Dependency] = [
  .product(name: "AppConfig", package: "Core"),
  .product(name: "Analytics", package: "Core"),
  .product(name: "AppServices", package: "Core"),
]

/// Generated shared-kernel constants (capture rules, reason codes); never edit, run `just generate`.
let kernel: Target.Dependency = .product(name: "AIStylistKernel", package: "swift-client")

var dependencies: [Package.Dependency] = [
  .package(path: "../Core"),
  .package(path: "../../../../packages/contracts/gen/swift-client"),
]
var products: [Product] = [
  .library(name: "HomeModel", targets: ["HomeModel"]),
  .library(name: "CaptureModel", targets: ["CaptureModel"]),
]
var targets: [Target] = [
  .target(name: "HomeModel", dependencies: core, swiftSettings: strictSettings),
  .testTarget(
    name: "HomeModelTests",
    dependencies: ["HomeModel"] + core,
    path: "tests/HomeModelTests",
    swiftSettings: strictSettings
  ),
  // Guided capture camera logic (capture brief §3–§7): rules, lock machine, timers, flow. No UI, no
  // camera or Vision import, no analytics (owner, 2026-10-22), so it needs only the kernel.
  .target(name: "CaptureModel", dependencies: [kernel], swiftSettings: strictSettings),
  .testTarget(
    name: "CaptureModelTests",
    dependencies: ["CaptureModel", kernel],
    path: "tests/CaptureModelTests",
    swiftSettings: strictSettings
  ),
]

#if !os(Linux)
  // SwiftUI exists only on Apple platforms. The design system goes to *Feature targets only, so
  // *Model targets stay UI-free.
  dependencies.append(.package(path: "../DesignSystem"))
  let designSystem: [Target.Dependency] = [
    .product(name: "DesignSystem", package: "DesignSystem"),
    .product(name: "DesignTokens", package: "DesignSystem"),
  ]
  products.append(.library(name: "HomeFeature", targets: ["HomeFeature"]))
  targets.append(
    .target(
      name: "HomeFeature",
      dependencies: ["HomeModel"] + core + designSystem,
      swiftSettings: strictSettings
    )
  )
#endif

let package = Package(
  name: "Features",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: products,
  dependencies: dependencies,
  targets: targets
)
