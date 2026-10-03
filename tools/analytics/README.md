# tools/analytics — the analytics taxonomy check (`just lint`)

`check-events.mjs` rejects any analytics event the native apps build that is not in the taxonomy,
`packages/contracts/events/analytics/events.json` (planning/14 §9, NFR-PRV-110, P02-T09 AC-9). It
scans every `*.swift` under `apps/ios/` and every `*.kt` under `apps/android/`, tests included
(tests may only use real names too), and skips build output, hidden directories and generated code.
`just lint` runs it first (Node built-ins only, no `pnpm install` needed); `just lint --fixtures`
runs `check-fixtures.sh`. Both run in `just ci-parity`, and on macOS in `portability.yml`.

Output: one `<file>:<line>: <rule>: <detail>` line per finding; exit 1 on any finding, 0 when clean,
2 when the taxonomy cannot be read.

## What is checked

- `AnalyticsEvent(…)` and `AnalyticsEvent.init(…)`, the analytics port's event type in both apps:
  the name must be a plain string literal or an `AnalyticsTaxonomy.<Event>.NAME` constant, and
  registered; every property key must be a literal or an `AnalyticsTaxonomy` constant declared for
  that event. The property map must be a map literal (`mapOf(…)`, `mutableMapOf(…)`, `emptyMap()`,
  Swift `[k: v]` or `[:]`) or absent.
- A direct PostHog capture (`PostHog.capture(event = …)` in Kotlin,
  `PostHogSDK.shared.capture(…)` in Swift): checked only where the name, the map and the key are
  literals. The sinks forward `event.name` from an `AnalyticsEvent` that was checked where it was
  built.

Kotlin constants resolve through the generated `AnalyticsTaxonomy.kt` under
`packages/contracts/gen/kotlin-client/analytics/`, the file the app compiles against, so no naming
rule is copied here. Swift names are hand-written literals (ADR-0005 accepted debt), which is the
main reason the check exists.

## Rules

- `unknown-event`: the event name is not in `events.json`, or is an `AnalyticsTaxonomy` constant
  that the generator never wrote.
- `undeclared-property`: a property key is not declared for that event in `events.json`.
- `not-static`: an `AnalyticsEvent` name, property map or key is anything else (a variable, an
  interpolated string, a map built at runtime). A name built at runtime could be anything, so the
  gate asks for literals instead of trusting it.

Known limits: a Swift `.init(…)` whose type is inferred (`let e: AnalyticsEvent = .init(…)`) is not
recognised. The scanner understands comments (nested block comments too), string and character
literals, interpolation, raw strings and `quoted` identifiers, not the full Swift or Kotlin grammar.

## Fixtures (`just lint --fixtures`)

Each case is a small tree with `apps/ios/` and `apps/android/`, scanned with `--root` against the
repo's own taxonomy (never a copy). A failing case must report its rule for every Swift and Kotlin
file in it and no other rule; `_clean/` must pass.

- `_clean`: the call shapes the apps use (literals, taxonomy constants, comments, strings, the
  sinks' pass-through) produce no finding.
- `unknown-event`: an unregistered literal, a constant that was never generated and a literal
  PostHog capture.
- `undeclared-property`: an undeclared key next to declared ones (a Swift literal; a Kotlin
  constant and a literal).
- `not-static`: an interpolated Swift name, a Kotlin parameter as the name, a runtime property map.

A new rule gets a new case here and a line in `expected_rule` in `check-fixtures.sh`.
