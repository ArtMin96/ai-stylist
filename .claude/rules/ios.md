---
paths:
  - "apps/ios/**"
  - "tools/codegen/gen-swift.sh"
---

# Native iOS app (apps/ios)

**Skill:** `ios-feature` (both platforms at once: `cross-platform-feature`, run by the main session;
endpoint or event shape: `api-contract-change` first).

**Agent:** `ios-engineer` (Android: `android-engineer`; contracts: `contracts-engineer`; API:
`api-engineer`; the shared Maestro flows in `e2e/`: `test-engineer`).

**Proof:** `just ios-check` (on Linux: lint, format, bans + fixtures, package tests; the Xcode steps print
a skip). App target, SwiftUI or `project.yml` changes also need `just ios-build` + `just ios-test` on a Mac
or a green `ios` workflow run; report a macOS step you did not run as "Not run". A
`tools/codegen/gen-swift.sh` change needs `just generate --check`.

**Invariants that bite here:**
1. Never edit `packages/contracts/gen/swift-client/**` or a `.xcodeproj` — the PreToolUse path guard
   `scripts/hooks/guard-protected-paths.sh` denies both. `just generate` rewrites every client, so an
   iOS task that needs regeneration stops and reports it; `just ios-project` regenerates the project.
2. Only `apps/ios/Packages/Core/Sources/APIData` imports `AIStylistAPI`, `OpenAPIRuntime` or
   `HTTPTypes`; features depend on `AppServices` protocols — `just ios-check-banned`.
3. No SwiftUI or UIKit in `Core` or in any `*Model` target; screen logic lives in the model so it is
   unit-testable on Linux — `just ios-check-banned`.
4. No `@unchecked Sendable`, `nonisolated(unsafe)` or `@preconcurrency import` — `just ios-check-banned`.
   No force unwraps, `try!`, force casts or implicitly unwrapped optionals — `just ios-lint` (SwiftLint).
5. `async`/`Task {}` over completion handlers; a closure stored on or escaping from `self` captures
   `[weak self]`; a view owns the `@Observable` model it creates (`@State private var`); a model passed
   in is a plain property, or `@Bindable` when the view binds to it (reviewer-checked).
6. `API_BASE_URL` is host-only; never use the generated `Servers.*` URLs (they end in /v1). No secrets in
   xcconfigs, because everything in the bundle is public (reviewer-checked).
7. A new safety setting goes in both `apps/ios/Config/Base.xcconfig` and every `Package.swift`
   `strictSettings`; never relax Swift 6 mode, complete concurrency checking or warnings-as-errors —
   `just ios-check` fails on a warning; a relaxed setting is reviewer-checked.
8. The strings `e2e/smoke.yaml` asserts (`AI Stylist`, `Share anonymous usage data`) stay byte-identical
   to Android, and each accessibility identifier a flow uses (`api-version`, `api-error`) equals the
   Android `testTag` — `just ios-e2e` on macOS.
9. Reason codes and entitlement names come from the generated `AIStylistKernel`; analytics event names
   equal `packages/contracts/events/analytics/events.json` byte for byte; no 3D and never RealityKit
   (reviewer-checked).
