# Swift 6 + SwiftUI quality reference

Applies to: `apps/ios/**/*.swift` only. Never cite this file for Kotlin, TypeScript, Python or shell.

**Gates (they run, so do not hand-check what they cover):** swift-format with
`apps/ios/.swift-format` (2-space indent, 120 columns, ordered imports, no force unwrap or force try,
`for … in` over `forEach`, `///` doc comments, file-scoped `private`); SwiftLint safety-only rules in
`apps/ios/.swiftlint.yml` (force unwrap, `try!`, force cast, IUOs, `unowned` captures, weak delegates,
`fatalError` without message, optional `Bool`, non-private `@State`, unhandled throwing `Task`);
`just ios-check-banned` (`apps/ios/scripts/check-banned.sh`: `@unchecked Sendable`,
`nonisolated(unsafe)`, `@preconcurrency import`, SwiftUI/UIKit in models and Core). Every package's
`strictSettings` sets Swift 6 language mode, `defaultIsolation(MainActor.self)`, `ExistentialAny`,
`InternalImportsByDefault`, `MemberImportVisibility` and `NonisolatedNonsendingByDefault`; warnings
are errors. Canonical siblings: `apps/ios/Packages/Features/Sources/HomeModel/HomeModel.swift`,
`apps/ios/Packages/Core/Sources/APIData/VersionService.swift`.

## Naming (Swift API Design Guidelines)

- Clarity at the point of use beats brevity. Read the call site aloud: `analytics.track(.appOpened(…))`,
  `items.remove(at: index)`.
- Types and protocols `UpperCamelCase`; everything else `lowerCamelCase`, including constants and
  enum cases. Acronyms keep uniform case: `apiBaseURL`, `URLSession`, `userID`.
- Protocols name a capability (`-able`, `-ing`) or what something is (`VersionService`). No `I`
  prefix, no `Protocol` suffix unless a concrete type of the same name exists.
- Booleans read as assertions: `isLoading`, `hasConsent`, `showsDebugTools`.
- Mutating/non-mutating pairs follow the `sort()`/`sorted()` and `formUnion`/`union` patterns.
- Omit needless words and getter prefixes: `fetchVersion()`, not `getVersionData()`; no type names in
  variable names (`versionState`, not `versionStateEnum`).
- Argument labels make the call a phrase; omit the first label only when the base name already says it.

## Types and state

- Value types by default: `struct` and `enum`. Use a `final class` only for identity or
  observation (`@Observable` view models), an `actor` for shared mutable state across isolation domains.
- Model screen state as an enum with associated values (`VersionState.loading / .loaded / .failed`),
  not a set of optionals and booleans that must agree.
- `private(set)` for state the view reads and the model writes; `let` for everything that never changes.
- Smallest access level that works. Under `InternalImportsByDefault`, write `public import` only when a
  module's public API exposes the imported types, as `HomeModel.swift` does.
- `ExistentialAny` is on: write `any VersionService` for existentials. Prefer generics or
  `some Protocol` when one concrete type flows through.
- Extensions group protocol conformances; keep one primary type per file, named after the file.

## Optionals and errors

- No `!`, `try!`, `as!` or IUOs (gated). Unwrap with `guard let value else { return … }` at the top, or
  `if let`, `??`, optional chaining.
- `throws` for failures the caller can handle; use typed `throws(SomeError)` when the error set is
  closed and the caller switches on it. At service boundaries follow the existing result enum shape
  (`.ok` / `.failure`) that `AppServices` protocols return, so views never see transport errors.
- `try?` only when the failure is genuinely irrelevant, and say why in a comment. Never discard an
  error that the user or telemetry should see.
- `fatalError("message")` and `preconditionFailure` only for programmer errors that cannot happen in a
  correct program; never for input, network or decoding failures.

## Concurrency (Swift 6 strict)

- Default isolation is `MainActor`. Mark only what must leave it: `nonisolated` value types that cross
  domains (see `VersionState`), `@concurrent` functions for CPU-heavy work off the main actor.
- `async`/`await` everywhere; no completion handlers, no `DispatchQueue`, no Combine for new code.
- Prefer structured concurrency: `async let`, `withTaskGroup`, and the SwiftUI `.task {}` modifier
  (cancelled when the view disappears) over unstructured `Task {}`. A stored `Task` is cancelled in
  the owner's teardown.
- Types that cross isolation are `Sendable` by construction (immutable value types, actors), never by
  `@unchecked Sendable` (gated).
- A closure stored on or escaping from `self` captures `[weak self]`; never `unowned` (gated).
- Check `Task.isCancelled` / `try Task.checkCancellation()` in long loops.

## SwiftUI

- Views are thin: layout and bindings only. Formatting, decisions and state transitions live in the
  `*Model` target so they are unit-testable on Linux (`.claude/rules/ios.md`).
- A view that creates its model owns it with `@State private var model`; a model passed in is a plain
  `let`, or `@Bindable` when the view binds to it. Use the Observation framework (`@Observable`), not
  `ObservableObject`/`@Published`.
- Extract a subview into its own `struct` when it has a name, state or reuse; a computed property
  returning `some View` is fine for a small, stateless fragment.
- No `AnyView`; use `@ViewBuilder`, `Group` or generics. `ForEach` uses stable identity
  (`Identifiable` or an explicit `id:` key path), never array indices for mutable lists.
- Every interactive or asserted element gets an accessibility label; e2e targets use
  `.accessibilityIdentifier` values equal to the Android `testTag`.
- User-visible strings live where the screen's siblings keep them; smoke-asserted strings stay
  byte-identical to Android.

## Collections and control flow

- `for … in` over `.forEach` (gated); `map`, `filter`, `compactMap`, `reduce(into:)` for transforms.
- `isEmpty` over `count == 0`; `first(where:)`, `contains(where:)`, `allSatisfy`.
- Exhaustive `switch` over enums with no `default` when the enum is yours, so a new case is a compile error.
- `guard` for preconditions; avoid nesting deeper than about three levels.

## Documentation and comments

- `///` doc comments on public API, starting with a one-line summary of what it does or returns; no
  block comments (gated).
- Comments explain why: the invariant, the doc or ADR that decided it, the platform quirk.

## Tests (Swift Testing)

- `import Testing`, `@Test` functions with descriptive names, `#expect` and `#require` (not XCTest
  asserts). Parameterize with `@Test(arguments:)` instead of copy-paste tests.
- Fake `AppServices` dependencies with small structs that conform to the protocol; test the model's
  observable state, not call order.
- Tests live in `apps/ios/Packages/<Pkg>/tests/<Target>Tests/` (path guard).

## Suppression syntax

`// swiftlint:disable:next <rule> - <reason>` on the one line, or `// swift-format-ignore: <Rule>` above
one declaration with the reason in a comment beside it. Never `swiftlint:disable` for a file, and never
for a safety rule (force unwrap, `try!`, force cast, `@unchecked Sendable`).

## Do not import from other languages

| Habit from          | Leaks in as                                                            | Swift instead                                                                                                              |
| ------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Kotlin              | a generic `Result<T>` or sealed class for every call                   | `throws` / typed throws; enums with associated values; the existing service result enum only at the `AppServices` boundary |
| Kotlin              | `companion object` constants, `object` singletons                      | `static let` on the type; injection through the composition root, no `.shared` singletons                                  |
| Kotlin / Java       | `getX()` methods, builder classes                                      | properties; memberwise initializers with default arguments                                                                 |
| Kotlin              | `lateinit` thinking → IUO `var x: T!`                                  | non-optional `let` set in `init`, or a real optional                                                                       |
| TypeScript          | `IFooService` interfaces, `.forEach` chains, `any`                     | protocol named for the capability, `for … in`, generics or `any Protocol`                                                  |
| TypeScript / Python | stringly-typed state (`"loading"`)                                     | an enum                                                                                                                    |
| Python              | snake_case names, dictionaries as records                              | lowerCamelCase, a `struct`                                                                                                 |
| Legacy Swift        | `ObservableObject`, `@Published`, `DispatchQueue`, completion handlers | `@Observable`, `async`/`await`, actors                                                                                     |

## Checklist

Names read as English at the call site · state is an enum, not flag soup · no optional `Bool` · no
`!`/`try!`/`as!` · errors surface, never vanish in `try?` · only `Sendable` values cross isolation ·
structured concurrency, `.task {}` in views · view has no logic, model is testable on Linux · stable
`ForEach` identity · accessibility label on interactive elements · `///` on public API · Swift Testing
with `#expect`.
