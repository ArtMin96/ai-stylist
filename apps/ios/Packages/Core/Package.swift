// swift-tools-version: 6.4
// Core: everything below the UI. No SwiftUI/UIKit here, so it builds and tests on macOS AND Linux
// (`just ios-test-packages`). Tests live in tests/<Target>Tests (repo rule: tests in the owning
// module's tests/ directory).
//
// Targets and who may import them:
//   AppConfig    build-time config (API_BASE_URL, app version); pure validator, no dependencies
//   Analytics    analytics port + consent-gated no-op stub; no dependencies
//   AppServices  the container the composition root hands to features + the service protocols
//   APIData      the ONLY target that imports the generated AIStylistAPI client / OpenAPI runtime
import PackageDescription

/// Safety settings for every target we write (never for generated code). Keep in sync with
/// apps/ios/Config/Base.xcconfig and Packages/Features/Package.swift.
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

let package = Package(
  name: "Core",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: [
    .library(name: "AppConfig", targets: ["AppConfig"]),
    .library(name: "Analytics", targets: ["Analytics"]),
    .library(name: "AppServices", targets: ["AppServices"]),
    .library(name: "APIData", targets: ["APIData"]),
  ],
  dependencies: [
    // Generated client (tools/codegen/gen-swift.sh); never edit it, run `just generate`.
    .package(path: "../../../../packages/contracts/gen/swift-client"),
    // Direct remote dependencies are pinned exactly; the transitive swift-collections is pinned by
    // the committed Package.resolved. HTTPTypes is the runtime's HTTP model.
    .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "1.12.1"),
    .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "1.3.1"),
    .package(url: "https://github.com/apple/swift-http-types", exact: "1.8.0"),
  ],
  targets: [
    .target(name: "AppConfig", swiftSettings: strictSettings),
    .target(name: "Analytics", swiftSettings: strictSettings),
    .target(name: "AppServices", dependencies: ["AppConfig", "Analytics"], swiftSettings: strictSettings),
    .target(
      name: "APIData",
      dependencies: [
        "AppServices",
        .product(name: "AIStylistAPI", package: "swift-client"),
        .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
        .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
        .product(name: "HTTPTypes", package: "swift-http-types"),
      ],
      swiftSettings: strictSettings
    ),
    .testTarget(
      name: "AppConfigTests",
      dependencies: ["AppConfig"],
      path: "tests/AppConfigTests",
      swiftSettings: strictSettings
    ),
    .testTarget(
      name: "AnalyticsTests",
      dependencies: ["Analytics"],
      path: "tests/AnalyticsTests",
      swiftSettings: strictSettings
    ),
    .testTarget(
      name: "APIDataTests",
      dependencies: [
        "APIData",
        "AppConfig",
        "AppServices",
        .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
        .product(name: "HTTPTypes", package: "swift-http-types"),
      ],
      path: "tests/APIDataTests",
      swiftSettings: strictSettings
    ),
  ]
)
