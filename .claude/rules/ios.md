---
paths:
  - "apps/ios/**"
  - "tools/codegen/gen-swift.sh"
  - "packages/contracts/gen/swift-client/**"
---

# Native iOS app (apps/ios)

**Skill:** `ios-feature` (both platforms at once: `cross-platform-feature`).

**Agent:** `ios-engineer`.

**Proof:** `just ios-check` (on Linux: lint, format, bans + fixtures, package tests; Xcode steps print a
skip). App target, SwiftUI or `project.yml` changes also need `just ios-build` + `just ios-test` on a Mac
or a green `ios` workflow run; a macOS step you did not run is reported as "Not run", never assumed.

**Invariants that bite here:**
1. Never edit `packages/contracts/gen/swift-client/**` or a `.xcodeproj`: run `just generate` and
   `just ios-project`.
2. Only `apps/ios/Packages/Core/Sources/APIData` imports `AIStylistAPI`, `OpenAPIRuntime` or `HTTPTypes`;
   features depend on `AppServices` protocols — `just ios-check-banned`.
3. No SwiftUI/UIKit in `Core` or in any `*Model` target; screen logic lives in the model so it is
   unit-testable on Linux — `just ios-check-banned`.
4. No `@unchecked Sendable`, `nonisolated(unsafe)`, `@preconcurrency import`, force unwraps, `try!` or
   implicitly unwrapped optionals. Prefer actors, value types and `Mutex`; opt out of the MainActor
   default with `nonisolated`/`@concurrent` only with a reason.
5. `async`/`Task {}` over completion handlers; a closure stored on or escaping from `self` captures
   `[weak self]`; a view owns the model it creates (`@State` / `@StateObject`), `@ObservedObject` is only
   for a model passed in.
6. `API_BASE_URL` is host-only; never use the generated `Servers.*` URLs (they end in /v1). No secrets
   in xcconfigs: everything in the bundle is public.
7. A new safety setting goes in both `apps/ios/Config/Base.xcconfig` and every `Package.swift` `strictSettings`;
   never relax Swift 6 mode, complete concurrency checking or warnings-as-errors.
8. Strings and accessibility ids asserted by `e2e/smoke.yaml` stay byte-identical to Android. No 3D.
