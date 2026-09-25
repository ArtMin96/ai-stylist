---
name: ios-feature
description: Build or change native iOS features in apps/ios/ — SwiftUI screens, @Observable view models in Packages/Features, Core services behind AppServices protocols, APIData calls through the generated Swift client, config/xcconfig/project.yml changes, analytics and consent wiring, and the Swift codegen script tools/codegen/gen-swift.sh — with Swift 6 strict concurrency and Linux-testable models. Use for "iOS screen", "SwiftUI", "view model", "Swift package", "xcconfig", "project.yml", "just ios-check", or any path under apps/ios/, including the iOS lane of a cross-platform brief. Not for Android — use `android-feature`; not for starting a feature on both platforms — use `cross-platform-feature`; not for a missing or changed endpoint shape — use `api-contract-change` first; not for implementing the endpoint itself — use `backend-module`; not for the shared Maestro flows in e2e/ — use `e2e-device-testing`.
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: ios-engineer
---

# iOS Feature Development

## Trigger

- Adding or changing a screen, view model, Core service, config key, build setting or project
  definition under `apps/ios/` (Swift 6 + SwiftUI, XcodeGen, local SwiftPM packages).
- Wiring an existing endpoint through the generated client `packages/contracts/gen/swift-client/`,
  or changing `tools/codegen/gen-swift.sh` (this skill's; the generated output is never edited).
- Running as the iOS lane of `cross-platform-feature`: the brief is the only parity source, and the
  base and worktree rules of `agent-operating-contract` apply.
- Not this skill: Android (`android-feature`); starting a two-platform feature
  (`cross-platform-feature`); endpoint or event shape (`api-contract-change` first); the endpoint
  (`backend-module`); Maestro flows (`e2e-device-testing`); 3D (none yet; never RealityKit).

## Required reading

1. `PROGRESS.md`, the current phase file, and
   `planning/02-user-journeys-and-information-architecture.md` §1.1 (state coverage rule), the
   journey's own States subsection and §2.1 (navigation). In a lane, the brief replaces them.
2. `apps/ios/README.md` (layout, environments, safety settings, commands).
3. Composition: `apps/ios/App/CompositionRoot.swift`, `apps/ios/App/AIStylistApp.swift`,
   `apps/ios/Packages/Core/Sources/AppServices/AppServices.swift`,
   `apps/ios/Packages/Features/Package.swift`, `apps/ios/project.yml`.
4. The siblings to copy:
   - screen: `apps/ios/Packages/Features/Sources/HomeModel/HomeModel.swift`,
     `apps/ios/Packages/Features/Sources/HomeFeature/HomeScreen.swift`,
     `apps/ios/Packages/Features/tests/HomeModelTests/HomeModelTests.swift`;
   - endpoint service: `apps/ios/Packages/Core/Sources/APIData/VersionService.swift`,
     `apps/ios/Packages/Core/tests/APIDataTests/VersionServiceTests.swift`, and its protocol in
     `apps/ios/Packages/Core/Sources/AppServices/AppServices.swift`;
   - analytics: `apps/ios/Packages/Core/Sources/Analytics/ConsentGatedAnalytics.swift` and
     `packages/contracts/events/analytics/events.json`.
5. The generated operations you will call in `packages/contracts/gen/swift-client/Sources/AIStylistAPI/`;
   never hand-write request or response types.

## Workflow

1. Restate the user-visible outcome and every UI state in scope (doc 02 §1.1 plus the journey's
   States subsection, or the brief's parity table in a lane).
2. Search before write (`agent-operating-contract` step 4):
   `rg -n -i '<term>|<synonym>' apps/ios/Packages packages/contracts/gen/swift-client/Sources`.
   Reuse or extend; one copied look-alike view or service is a defect.
3. Contract missing or wrong → stop BLOCKED for `contracts-engineer` (`api-contract-change`);
   resume after the regenerated client is committed.
4. Layering:
   - API access only in `apps/ios/Packages/Core/Sources/APIData`, behind a protocol in
     `AppServices`; copy `VersionService.swift` and `VersionServiceTests.swift` for a new endpoint.
   - Screen logic in a `<Name>Model` target (`@Observable`, `@MainActor`, no SwiftUI import) so it
     is unit-testable on Linux; the `<Name>Feature` target only renders model state.
   - Adapters are built only in `apps/ios/App/CompositionRoot.swift`; features receive `AppServices`.
   - No business rules in the client: decisions come from the API.
5. A new screen: add `<Name>Model`, `<Name>Feature` and a `tests/<Name>ModelTests` target to
   `apps/ios/Packages/Features/Package.swift`, with `<Name>Feature` inside the `#if !os(Linux)`
   block; add `<Name>Feature` to the `AIStylist` target's Features products and the test target
   to the `AIStylist-Dev` scheme in `apps/ios/project.yml`; then `just ios-project` on a Mac.
   Never edit the generated `.xcodeproj`. The entry point is `apps/ios/App/AIStylistApp.swift`,
   which shows only `HomeScreen`; there is no navigation shell, so a second reachable screen needs
   the nav-shell task first (Stop).
6. Strictness: Swift 6 mode, complete concurrency, warnings as errors, MainActor default. Never add
   `@unchecked Sendable`, `nonisolated(unsafe)`, `@preconcurrency import`, force unwraps, `try!` or
   IUOs, and never relax a setting, lint rule or ban (not even temporarily); a new safety setting
   goes in `apps/ios/Config/Base.xcconfig` and every `Package.swift` `strictSettings`.
7. Accessibility: labels, traits, Dynamic Type, 44 pt targets, reduced motion. Accessibility
   identifiers and asserted strings equal Android's `testTag`s and strings byte for byte, taken
   from the brief; never read `apps/android/**` for parity (in a worktree it is the pre-feature
   base). List every new id and string in the report's Parity block.
8. Analytics: no Swift taxonomy is generated. Add a factory next to `AnalyticsEvent.appOpened` in
   `apps/ios/Packages/Core/Sources/Analytics/ConsentGatedAnalytics.swift`, with `name` copied byte
   for byte from `packages/contracts/events/analytics/events.json`; a new event needs the contract
   lane first. Consent defaults OFF; no sensitive data in events, logs or fixtures.
   `API_BASE_URL` stays host-only; config holds no secrets.
9. Registry values (reason codes, entitlements, units): import the generated `AIStylistKernel`
   through `.product(name: "AIStylistKernel", package: "swift-client")` in the target the brief
   or task names; never copy a value (DEC-55). No target consumes it yet: if the task does not say
   which target gets it, stop and ask.
10. Tests: Swift Testing in `apps/ios/Packages/<Pkg>/tests/<Target>Tests/`, behaviour-level, fakes
    of the `AppServices` protocols, synthetic data. A bug fix is test-first: `just test-regression`
    cannot run Swift, so write the test, run `just test ios` and keep the failing line, fix, rerun
    and keep the passing line.
11. `tools/codegen/gen-swift.sh` changed → stop after the edit and report it: `just generate`
    rewrites every generated tree, so the lead or `contracts-engineer` runs it.
12. Self-review before reporting (the bugs a reviewer will not see): model ownership (`@State` for
    an `@Observable` model the view creates, `@StateObject` for a legacy `ObservableObject`,
    `@ObservedObject` only for a passed-in model); `[weak self]` in stored or escaping closures;
    stored `Task`s cancelled with their owner (or `.task {}`), `CancellationError` not shown as a
    failure; UI mutations on the main actor; no ignored `try?` on user-visible work.

## Validation commands

```bash
just ios-check                 # worktree or main checkout: lint, format --check, bans (+ fixtures), package tests; macOS adds build + simulator tests
just test ios                  # fast loop: swift test for the Core and Features packages
just lint-file <path>          # one edited .swift or apps/ios/scripts/*.sh file
just ios-project               # macOS only: XcodeGen after project.yml or new files
just ios-build --config dev    # macOS only: compiles the app target and SwiftUI views
just ios-test                  # macOS only: package tests on the simulator
# main checkout only (need node_modules); in a worktree they go under Not run and the lead runs them:
just generate --check          # after a contract or gen-swift.sh change
just arch-check && just docs-check
```

On Linux the SwiftUI views and the app target are never compiled (Xcode steps print a skip).
`just lint` and `just ci-parity` run in the lead's checkout before the PR.

## Output

The `agent-operating-contract` report. Self-review lists step 12's items. Parity block: yes for a
client feature. Simulator screenshots only when a Mac run exists (never real user photos or
measurements).

Done checklist: every journey state handled · types from the generated client · logic in the model
target · strictness untouched · tests in the package tests/ dir · self-review done · macOS steps
reported as run or Not run · `Suggested PROGRESS.md line` given.

## Stop / escalation

- Contract missing or wrong → `contracts-engineer` (`api-contract-change`).
- New remote Swift package or version bump → only when the task grants it (the `Package.resolved`
  diff goes under `Must be committed together:`).
- A second screen with no navigation shell → stop; the lead sequences a nav-shell task on both
  apps.
- Registry value needed and no target named for `AIStylistKernel` → stop; the brief decides.
- Behaviour must differ from Android → `Parity: Intended differences`; the lead decides.
- Needs Xcode verification and no Mac run exists → implement, report `Not run: no Mac`, never
  claim the result.
- Anything 3D → stop; 3D is deferred for the native apps.

## Overlap

Adjacent: `android-feature` (same states, strings and ids on Android; in a lane, never read its
sources), `cross-platform-feature` (the lead's brief and parity review win), `api-contract-change`
(shape first; regenerates the Swift client), `backend-module` (the endpoint), `e2e-device-testing`
(flows in `e2e/`, run by `test-engineer`), `release-readiness` (TestFlight is human-only),
`performance-profiling` (device traces). This skill owns `apps/ios/**` and
`tools/codegen/gen-swift.sh`.
