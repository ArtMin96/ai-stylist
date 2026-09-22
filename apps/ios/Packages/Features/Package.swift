// swift-tools-version: 6.2
// Features: one pair of targets per screen.
//   <Name>Model    @Observable view model; no SwiftUI, so it builds and tests on Linux too.
//   <Name>Feature  the SwiftUI view; Apple platforms only (left out of this manifest on Linux).
// Features depend on Core's AppServices/Analytics/AppConfig protocols and values, never on
// APIData or the generated client (enforced by apps/ios/scripts/check-banned.sh).
import PackageDescription

/// Same safety settings as Packages/Core/Package.swift and Config/Base.xcconfig.
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

let core: [Target.Dependency] = [
  .product(name: "AppConfig", package: "Core"),
  .product(name: "Analytics", package: "Core"),
  .product(name: "AppServices", package: "Core"),
]

var products: [Product] = [
  .library(name: "HomeModel", targets: ["HomeModel"])
]
var targets: [Target] = [
  .target(name: "HomeModel", dependencies: core, swiftSettings: strictSettings),
  .testTarget(
    name: "HomeModelTests",
    dependencies: ["HomeModel"] + core,
    path: "tests/HomeModelTests",
    swiftSettings: strictSettings
  ),
]

#if !os(Linux)
  // SwiftUI exists only on Apple platforms.
  products.append(.library(name: "HomeFeature", targets: ["HomeFeature"]))
  targets.append(
    .target(name: "HomeFeature", dependencies: ["HomeModel"] + core, swiftSettings: strictSettings)
  )
#endif

let package = Package(
  name: "Features",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: products,
  dependencies: [
    .package(path: "../Core")
  ],
  targets: targets
)
