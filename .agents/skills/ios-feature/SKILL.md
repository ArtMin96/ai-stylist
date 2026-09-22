---
name: ios-feature
description: Build or change native iOS features in apps/ios/ — SwiftUI screens, @Observable view models in Packages/Features, Core services behind AppServices protocols, APIData calls through the generated Swift client, config/xcconfig/project.yml changes, analytics and consent wiring, and the Swift codegen script tools/codegen/gen-swift.sh — with Swift 6 strict concurrency and Linux-testable models. Use for "iOS screen", "SwiftUI", "view model", "Swift package", "xcconfig", "project.yml", "just ios-check", or any path under apps/ios/. Not for Android — use `android-feature`; not for a feature on both platforms — start with `cross-platform-feature`; not for a missing or changed endpoint shape — use `api-contract-change` first; not for implementing the endpoint itself — use `backend-module`; not for the shared Maestro flows in e2e/ — use `e2e-device-testing`.
metadata:
  modules:
  last-reviewed: 2026-09-23
  owner-agent: ios-engineer
---

# iOS Feature Development

## Trigger

- Adding or changing a screen, view model, Core service, config key, build setting or project
  definition under `apps/ios/` (Swift 6 + SwiftUI, XcodeGen, local SwiftPM packages).
- Wiring an existing endpoint through the generated client `packages/contracts/gen/swift-client/`
  (regenerate with `just generate`, never edit), or changing `tools/codegen/gen-swift.sh`.
- Not this skill: Android (`android-feature`); both platforms (`cross-platform-feature` orchestrates,
  then runs this skill for the iOS half); endpoint/event shape (`api-contract-change` first); the
  endpoint implementation (`backend-module`); Maestro flows (`e2e-device-testing`); 3D (none yet;
  never RealityKit, which breaks the glTF/KTX2/Draco pipeline; future 3D is Filament C++ via ADR).

## Required reading

1. `PROGRESS.md`, the current phase file, and the journey's states in
   `planning/02-user-journeys-and-information-architecture.md`.
2. `apps/ios/README.md` (layout, environments, safety settings, commands).
3. `apps/ios/App/CompositionRoot.swift`, `apps/ios/Packages/Core/Sources/AppServices/AppServices.swift`,
   `apps/ios/Packages/Features/Package.swift`, and the closest screen
   (`apps/ios/Packages/Features/Sources/HomeModel/HomeModel.swift`,
   `apps/ios/Packages/Features/Sources/HomeFeature/HomeScreen.swift`).
4. The generated client operations you will call; never hand-write request or response types.

## Workflow

1. Restate the user-visible outcome and every UI state in scope; the journeys doc defines them.
2. Search before write: `rg` the Swift sources and the generated client by behaviour and synonyms.
   Reuse or extend; one copied look-alike view or service is a defect.
3. Contract missing or wrong → stop, `api-contract-change`, then return after `just generate`.
4. Layering:
   - API access only in `apps/ios/Packages/Core/Sources/APIData`, behind a protocol in `AppServices`.
   - Screen logic in a `<Name>Model` target (`@Observable`, `@MainActor`, no SwiftUI import) so it
     is unit-testable on Linux; the `<Name>Feature` target only renders model state.
   - Adapters are built only in `apps/ios/App/CompositionRoot.swift`; features receive `AppServices`.
   - No business rules in the client: decisions come from the API.
5. A new screen: add the `<Name>Model` / `<Name>Feature` targets and a `tests/<Name>ModelTests`
   target to `apps/ios/Packages/Features/Package.swift`, add the test target to the `AIStylist-Dev` scheme in
   `apps/ios/project.yml`, then `just ios-project` on a Mac. Never edit the generated `.xcodeproj`.
6. Strictness: Swift 6 mode, complete concurrency, warnings as errors, MainActor default. Never add
   `@unchecked Sendable`, `nonisolated(unsafe)`, `@preconcurrency import`, force unwraps, `try!` or
   IUOs, and never relax a setting, lint rule or ban (not even temporarily); a new safety setting
   goes in `apps/ios/Config/Base.xcconfig` and every `Package.swift` `strictSettings`.
7. Accessibility: labels, traits, Dynamic Type, 44pt targets, reduced motion. Accessibility
   identifiers and asserted strings match Android's Compose `testTag`s byte for byte, so the shared
   `e2e/smoke.yaml` drives both apps; list new ones for the parity review.
8. Analytics through the port with names from the contract taxonomy
   (`packages/contracts/events/analytics/`); consent defaults OFF; no sensitive data in events,
   logs or fixtures. `API_BASE_URL` stays host-only; config holds no secrets.
9. Tests: Swift Testing in `apps/ios/Packages/<Pkg>/tests/<Target>Tests/`, behaviour-level, fakes
   of the `AppServices` protocols, synthetic data. A bug fix starts with a failing test.
10. Self-review before reporting (the bugs a reviewer will not see): model ownership (`@State` for
    an `@Observable` model the view creates, `@StateObject` for a legacy `ObservableObject`,
    `@ObservedObject` only for a passed-in model); `[weak self]` in stored or escaping closures;
    stored `Task`s cancelled with their owner (or `.task {}`), `CancellationError` not shown as a
    failure; UI mutations on the main actor; no ignored `try?` on user-visible work.

## Validation commands

```bash
just ios-check                 # Linux + macOS: lint, format --check, bans (+ fixtures), package tests; macOS adds build + simulator tests
just ios-test-packages         # Linux + macOS: swift test for Core and Features models ([core|features])
just generate --check          # if a contract or gen-swift.sh change preceded this work
just ios-project               # macOS only: XcodeGen after project.yml or new files
just ios-build --config dev    # macOS only: compiles the app target and SwiftUI views
just ios-test                  # macOS only: package tests on the simulator
just ios-e2e                   # macOS only: shared Maestro smoke flow on the Dev build
```

On Linux the SwiftUI views and the app target are never compiled (Xcode steps print a skip). Report
each macOS step as run (with output) or "Not run"; `.github/workflows/ios.yml` is the macOS job.

## Output

PR with the states implemented, the verification transcript (which steps ran on Linux, which on
macOS/CI), parity notes Android must match, and simulator screenshots only when a Mac run exists
(never real user photos or measurements).

Done checklist: every journey state handled · types from the generated client · logic in the model
target · strictness untouched · tests in the package tests/ dir · self-review done · macOS/CI
evidence named honestly · `PROGRESS.md` line proposed.

## Stop / escalation

- Contract missing or wrong → `api-contract-change`. New remote Swift package or version bump → only
  when the task grants it (review the `Package.resolved` diff).
- Behaviour must differ from Android → raise it in the `cross-platform-feature` parity review.
- Needs Xcode verification and no Mac/CI run exists → implement, hand off, never claim the result.
- Anything 3D → stop; 3D is deferred for the native apps.

## Overlap

Adjacent: `android-feature`, `cross-platform-feature`, `api-contract-change`, `e2e-device-testing`,
`release-readiness` (TestFlight is human-only), `performance-profiling`.
