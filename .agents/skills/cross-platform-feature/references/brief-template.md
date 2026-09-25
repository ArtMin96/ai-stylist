# Cross-platform brief — template

Last reviewed: 2026-09-25

Copy the block below to `.claude/plans/<yyyy-mm-dd>-<slug>-brief.md`, fill every field, and paste
the filled brief verbatim into each lane prompt. `Base:` is not in the brief (the brief may be part
of the base commit); each prompt carries it. `templates/linear/01-feature.md` holds the same Scope,
acceptance-criteria and search-before-write fields for the issue; this brief adds what two parallel
lanes need to build identical apps without reading each other's code.

```markdown
# <Feature> — cross-platform brief (<yyyy-mm-dd>, slug <slug>)

Phase task: P##-T## (planning/phases/P##-*.md) · Journey: planning/02 §<n>, States §<n.m>
Branch: feat/<slug> · Lanes: iOS, Android[, API][, contract]

## Outcome and scope

- User outcome: <one sentence>
- Acceptance criteria: AC-1 <behaviour> — proof: <command> → <expected line>
- Non-goals: <what this feature will not do>
- Search done: <rg terms + dirs → existing screens/ids/events/operations found and reused>

## Entry point and navigation

- iOS: <reachable from: apps/ios/App/AIStylistApp.swift | a control on an existing screen>
- Android: <reachable from: MainActivity.kt setContent | a control on an existing screen>
- Doc 02 §2.1 tab or route: <…>. No navigation shell exists yet: a second screen needs the
  nav-shell task on both apps first.

## Contract

- Operations (generated operationId — method path — module): <getX — GET /v1/… — closet>
- Contract lane changes: none | <exact schema/event/registry change for contracts-engineer>
- Analytics events (events.json name — properties): none | <closet_item_viewed — itemCount:int>
- Registry values: none | <RC-… from reason-codes.json, entitlement key from entitlements.json>
- Kernel wiring (only when registry values are used; decided here, once, for both lanes):
  - iOS: target <Name> in <apps/ios/Packages/Core/Package.swift | apps/ios/Packages/Features/Package.swift>
    adds .product(name: "AIStylistKernel", package: "swift-client") (Features also needs the
    same .package(path:) line Core uses)
  - Android: module <:core:data | :feature:x> adds
    packages/contracts/gen/kotlin-client/kernel/src/main/kotlin as a kotlin.srcDir, copying the
    block in apps/android/core/analytics/build.gradle.kts; a new module also needs its
    ALLOWED_MODULE_EDGES entry

## Parity table (identical on both apps; each lane reports against it)

| State   | Trigger              | Exact visible strings | Id (a11y id == testTag) | Analytics event | Operation | Error → this state      |
| ------- | -------------------- | --------------------- | ----------------------- | --------------- | --------- | ----------------------- |
| loading | screen appears       | "…"                   | <id>                    | —               | getX      | —                       |
| loaded  | 200 with items       | "…"                   | <id>                    | <event>         | getX      | —                       |
| empty   | 200 with no items    | "…"                   | <id>                    | —               | getX      | —                       |
| failure | network, 5xx, decode | "…" and "Retry"       | <id>, <id>-retry        | —               | getX      | unreachable/5xx/invalid |
| offline | no connectivity      | "…"                   | <id>                    | —               | —         | no network → offline    |

Accessibility: labels and traits/roles per state; 44 pt (iOS) / 48 dp (Android) targets; Dynamic
Type / font scale; reduced motion. Consent: analytics off until opt-in.

## Lanes

| Lane    | Agent             | Isolation                 | Scope                       | Files expected  | Sibling to copy                                                                 | Checks                                        |
| ------- | ----------------- | ------------------------- | --------------------------- | --------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| iOS     | ios-engineer      | worktree                  | apps/ios/**                 | <paths>         | HomeModel.swift, HomeScreen.swift, VersionService.swift, HomeModelTests.swift   | just ios-check, just test ios                 |
| Android | android-engineer  | worktree                  | apps/android/**             | <paths>         | HomeViewModel.kt, HomeUiState.kt, HomeScreen.kt, VersionRepository.kt, Fakes.kt | just android-check, just test android         |
| API     | <owning engineer> | lead checkout             | apps/api/src/modules/<m>/** | <paths>         | <from the backend-module skill>                                                 | its Verification block                        |
| e2e     | test-engineer     | lead checkout, after both | e2e/**                      | e2e/<flow>.yaml | e2e/smoke.yaml                                                                  | just ios-e2e / just android-e2e with the flow |

## Intended differences

none | <item — reason — accepted by <human> on <date>>
```

## Filling rules

- Strings are the exact user-visible text, including punctuation and the ellipsis character. A
  string with a runtime value is written once with a named placeholder (`API: {baseUrl}`); each
  platform uses its own format syntax.
- Ids are kebab-case literals shared by iOS `accessibilityIdentifier` and Android `testTag`
  (Android keeps them in a `<Name>TestTags` object, as `HomeTestTags` in
  `apps/android/feature/home/src/main/kotlin/app/aistylist/feature/home/HomeScreen.kt` does).
- Events are names that already exist in `packages/contracts/events/analytics/events.json`, or the
  contract lane adds them first.
- Operations are generated operationIds from `packages/contracts/openapi/modules/`; the lanes never
  hand-write request or response types.
- Every state row comes from doc 02 §1.1's coverage rule and the journey's States subsection; a
  state the feature does not need is written as `N/A — <reason>`, never dropped.
