# Kotlin + Jetpack Compose quality reference

Applies to: `apps/android/**/*.kt` and `apps/android/**/*.kts` only. Never cite this file for Swift,
TypeScript, Python or shell.

**Gates (they run, so do not hand-check what they cover):** ktlint (`ktlint_official`, 120 columns,
4-space indent) through Spotless, configured in `apps/android/.editorconfig`; detekt with
`apps/android/config/detekt.yml` (coroutine misuse, swallowed and generic exceptions, `!!`,
`lateinit`, unsafe casts, ignored return values, and complexity limits: cyclomatic 12, 80 lines per
function, 7 parameters, nesting depth 4) failing on any finding; Android Lint plus compose-lint-checks
with `warningsAsErrors` and no baseline (`apps/android/config/lint.xml`); Kotlin
`allWarningsAsErrors`; Compose stability config `apps/android/config/compose-stability.conf`.
Canonical siblings: `apps/android/feature/home/src/main/kotlin/app/aistylist/feature/home/HomeViewModel.kt`,
`apps/android/feature/home/src/main/kotlin/app/aistylist/feature/home/HomeScreen.kt`,
`apps/android/core/data/src/main/kotlin/app/aistylist/core/data/version/VersionRepository.kt`.

## Naming (Kotlin coding conventions)

- Classes, interfaces, objects and `@Composable` functions `PascalCase`; functions, properties and
  locals `camelCase`; `const val` and top-level immutable constants `UPPER_SNAKE_CASE`.
- No Hungarian or `m` prefixes. A private mutable backing property and its public read-only view
  follow the sibling (`private val state` / `val uiState: StateFlow<…>`).
- Booleans read as predicates: `isLoading`, `hasConsent`. Functions are verbs; properties are nouns.
- An interface with a default implementation: name the implementation for what makes it different
  (`ApiVersionRepository`, `FakeVersionRepository`), not `…Impl`.
- Packages are lowercase, no underscores, under `app.aistylist.<area>`.

## Types, nullability and immutability

- No `!!`, no `lateinit` (gated). Use `?.`, `?:` (including `?: return`), `let` for a nullable value,
  and `requireNotNull(x) { "why" }` / `checkNotNull` for a real invariant.
- `val` over `var`; read-only `List`/`Map`/`Set` in signatures; never a `var` holding a mutable
  collection (gated).
- UI state is a `data class` copied with `copy(...)` through `MutableStateFlow.update { }`, exposed as
  `StateFlow` with `asStateFlow()`.
- Closed sets are `sealed interface` hierarchies (results, UI states) or `enum class` (plain
  constants). `when` over a sealed type is exhaustive without `else`, so a new case breaks the build.
- Wrap primitive identifiers with `@JvmInline value class` when two IDs of the same primitive type
  could be swapped.
- Mark state classes `@Immutable` or keep them in modules listed in the stability config, so Compose
  can skip recomposition.

## Functions

- Expression bodies for single expressions. Named arguments at call sites for Booleans and for
  adjacent parameters of the same type.
- Default parameters instead of overloads or builders.
- Top-level or extension functions instead of `Utils` objects; keep an extension next to the type it
  serves and make it `private` or `internal` unless shared.
- Scope functions sparingly: `let` for nullables, `apply` to configure an object, `also` for a side
  effect. Never nest them, and never use one only to avoid a local variable name.

## Coroutines and Flow

- Launch from a lifecycle scope (`viewModelScope`); never `GlobalScope` (gated). Keep a `Job` when the
  work must be cancellable or restartable, as `HomeViewModel` does for retry.
- Inject dispatchers; never hard-code `Dispatchers.IO` in a class (gated). Suspend functions are
  main-safe: the callee switches context, not the caller.
- Never swallow `CancellationException` (gated). Avoid `runCatching` in suspend code because it catches
  cancellation; catch the specific exceptions instead.
- `delay`, never `Thread.sleep` (gated). A function that returns `Flow` is not `suspend` (gated).
- Convert a cold `Flow` to UI state with `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initial)`.

## Errors

- Catch specific exception types (gated), map them to the repository's sealed result at the data
  boundary (`VersionResult`), and let the ViewModel map that to UI state.
- Throw with a message or cause (gated); never `printStackTrace` (gated); never log sensitive data.

## Compose

- State hoisting: screen-level composable collects state with `collectAsStateWithLifecycle()` and
  passes plain values and lambdas to stateless children. Never pass a ViewModel below the screen.
- Every reusable composable takes `modifier: Modifier = Modifier` as its first optional parameter and
  applies it to its root only.
- `remember` for derived objects, `rememberSaveable` for user input that must survive recreation,
  `derivedStateOf` for values computed from frequently changing state.
- Lazy lists give items a stable `key`. No side effects in composition; use `LaunchedEffect` with
  the right keys.
- User-visible text comes from string resources; asserted strings stay byte-identical to iOS, and
  e2e targets use `Modifier.testTag` values equal to the iOS accessibility identifiers.
- Content descriptions on meaningful icons and images; `null` only for decorative ones.

## Gradle Kotlin DSL

- Shared build logic lives in convention plugins under `apps/android/build-logic/`; module build files
  stay declarative. Versions only in `apps/android/gradle/libs.versions.toml`, never inline.

## Tests

- JVM and Robolectric tests in the module's src/test/kotlin directory; `runTest` from
  kotlinx-coroutines-test with a test dispatcher injected through the constructor.
- Fakes that implement the real interface over mocking frameworks; assert on emitted `StateFlow`
  values, not on call order. Test names in backticks describe behaviour.

## Suppression syntax

`@Suppress("RuleId") // reason` on the narrowest declaration, or `@SuppressLint("IssueId")` for Android
Lint with the reason beside it. Never a file-level `@file:Suppress`, and never for `!!`, `lateinit`,
`GlobalScope` or swallowed cancellation.

## Do not import from other languages

| Habit from         | Leaks in as                                                        | Kotlin instead                                                                     |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Swift              | `guard let` emulation with nested `if (x != null)`                 | `val x = y ?: return`                                                              |
| Swift              | IUO-style `lateinit var`                                           | constructor injection, `val`                                                       |
| Java               | getters/setters, `static` utility classes, builders, `Optional<T>` | properties, top-level functions, named/default arguments, nullable types           |
| Java / RxJava      | `LiveData`, `Observable`, callbacks                                | `StateFlow` / `Flow`, `suspend`                                                    |
| TypeScript         | `IFoo` interfaces, `any`-typed maps, string unions                 | descriptive interface names, typed data classes, `sealed interface` / `enum class` |
| Python             | snake_case, dicts as records, broad `except`                       | camelCase, `data class`, specific catches                                          |
| Swift / TypeScript | a generic `Result` wrapper on every function                       | exceptions inside a layer; sealed result types only at the repository boundary     |

## Checklist

No `!!`/`lateinit` · `val` and read-only collections · sealed types for closed sets, exhaustive `when` ·
named arguments for Booleans · coroutines scoped, dispatchers injected, cancellation rethrown ·
specific catches mapped at the data boundary · stateless composables with `modifier` first and hoisted
state · stable keys in lazy lists · strings from resources, `testTag` parity with iOS · versions only in
the catalog · `runTest` with fakes.
