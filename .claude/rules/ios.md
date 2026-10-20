---
paths:
  - "apps/ios/**"
  - "tools/codegen/gen-swift.sh"
---

# Native iOS app (apps/ios)

**Skill:** `ios-feature` (both platforms at once: `cross-platform-feature`, run by the main session;
endpoint or event shape: `api-contract-change` first).
Line-level quality: `code-quality` with `.agents/skills/code-quality/references/swift.md` only (its
language lock: never apply another language's idioms here).

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
10. Feature UI takes every colour, font, size, spacing, radius, elevation and motion value from the
    design-system tokens whose master is the `DESIGN.md` frontmatter; never a literal colour, font
    size, padding or corner radius in a `*Feature` target. No token for what you need → stop and ask
    `ui-designer`; never inline a value "for now" (reviewer-checked: ui-designer; generated theme code
    with a `just generate --check` drift gate; a `just ios-check-banned` ban on literal styles,
    planned). Feature UI uses the design system's base components (`AppButton`, …) and `AppTheme`,
    never a hand-rolled copy. How tokens and components are generated, where previews go
    (`DesignSystemCatalog`) and how to build without uploading symbols: `design-system.md`
    invariants 7–10.
11. No new screen or UI element without an owner-approved surface brief in
    `.impeccable/surfaces/<screen>.md` (approval date and canvas board recorded), produced by the
    `ui-prototype-first` skill before any UI code (reviewer-checked: ui-designer).
12. UI copy keeps the honesty invariants: never "digital twin", "exact" or a guaranteed fit; every
    generated image carries the AI-generated preview badge and its confidence, and confidence is
    shown as text, never by colour alone (reviewer-checked: ui-designer).
13. Every screen draws its empty, loading, error and offline states from DESIGN.md components
    (reviewer-checked: ui-designer, by hand in the debug gallery; no screenshot tests, owner 2026-10-20).
14. Accessibility: 44 pt minimum touch targets, layouts that hold at the largest Dynamic Type sizes,
    an accessibility label on every icon-only control, reduced motion respected
    (reviewer-checked: ui-designer; contrast lint on the tokens, planned).
15. `ui-designer` reviews the native code and simulator screenshots (light and dark) against
    DESIGN.md and the surface brief before merge; its findings go back to `ios-engineer`
    (reviewer-checked: ui-designer).
