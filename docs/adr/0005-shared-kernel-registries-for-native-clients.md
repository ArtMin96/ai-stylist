# ADR-0005 — Shared-kernel registries as language-neutral JSON, generated for TS, Swift and Kotlin

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** owner (human choice between options A–C, 2026-09-23 session); BE
- **Decision-log entry:** DEC-55 in [16-risks-open-questions-and-decision-log.md](../../planning/16-risks-open-questions-and-decision-log.md)
- **Related:** OQ-15 (resolved by this ADR) · [ADR-0004](0004-native-ios-and-android-clients.md) · DEC-53 (generated native clients) · phase P02

## Context

`CLAUDE.md` makes `packages/shared-kernel` the single source of truth for constants, units, reason codes and entitlement names, and forbids copying them into the iOS/Android apps. Since ADR-0004 the clients are native Swift and Kotlin, and they cannot import TypeScript. The registries only existed as TS literals (`src/reason-codes.ts`, `src/entitlements.ts`, `src/units.ts`), so the first native feature that shows a reason code or checks an entitlement (P03/P09) would have had to hand-copy them. The Kotlin generator already emits the analytics taxonomy from a JSON source, which gives a proven pattern to extend.

## Options considered

| Option                                                                         | Pros                                                                                                                                                                                                                          | Cons                                                                                                                                                                                             | Evidence (primary source + as-of date)                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| A (chosen) JSON registries inside `shared-kernel`, generated for all languages | One language-neutral source; JSON Schema validation at generate time; Python can be added as a fourth emitter; stays in `shared-kernel`, so `CLAUDE.md`'s ownership rule is unchanged; mirrors the analytics-taxonomy emitter | Registry values are no longer authored in TS; the TS data file becomes generated; the types and helpers (`convert`) stay hand-written next to it                                                 | `tools/codegen/gen-kotlin.sh` analytics-taxonomy emitter (repo, 2026-09-23) |
| B Generate Swift/Kotlin from the TS sources                                    | Smallest change; TS authoring unchanged                                                                                                                                                                                       | Every non-TS consumer depends on a Node evaluation of TS; only runtime values are visible (no types); logic such as conversion factors must be re-emitted by hand; Python needs yet another path | —                                                                           |
| C Carry the registries as OpenAPI enums                                        | No new generator                                                                                                                                                                                                              | Metadata (params, stage, kind, description) lost or pushed into `x-` extensions; units/factors not expressible; every registry addition becomes an API-versioning/oasdiff event                  | —                                                                           |

## Decision

The reason-code, entitlement and unit registries live as JSON in `packages/shared-kernel/registry/*.json`, each validated by a sibling `*.schema.json` (JSON Schema 2020-12). `just generate` (`tools/codegen/gen-kernel.mjs`) emits:

- **TS:** `packages/shared-kernel/src/gen/*.ts` (`as const` data). The hand-written `src/{reason-codes,entitlements,units}.ts` keep the types, `satisfies` checks and `convert`, and import their data from `./gen`. The public API of `@ai-stylist/shared-kernel` is unchanged.
- **Swift:** the `AIStylistKernel` product/target in `packages/contracts/gen/swift-client/` (String-backed, `CaseIterable`, `Sendable` enums; Swift 6 language mode).
- **Kotlin:** package `app.aistylist.contracts.kernel` under `packages/contracts/gen/kotlin-client/kernel/`.

`just generate --check` covers all three outputs. An invalid registry (schema failure, or a cross-reference such as an undeclared kind/namespace) fails the generator and writes nothing. Generated files are never hand-edited. Scope is reason codes, entitlement names + credit meters, and units + conversion factors; `errors.ts`, `ids.ts` and `envelope.ts` stay TS-only until a native consumer needs them.

## Rationale

A is the only option where the source is readable by every language without going through another language's runtime, and it keeps the ownership rule in `CLAUDE.md` intact without an edit. B keeps TS as the source but pushes a Node dependency and hand re-emission onto every other consumer. C couples registry growth to API versioning and cannot express units or metadata. The registries are small and append-only, so losing TS authoring ergonomics for the data costs little. The type-level guarantees (`satisfies`) stay in the hand-written TS.

## Consequences and revisit triggers

- Positive: native apps can import reason codes, entitlements and units instead of copying them; the staleness gate catches drift in all three languages (verified: changing one entitlement description flagged the TS, Swift and Kotlin outputs as stale).
- Negative/accepted debt: no app target consumes `AIStylistKernel` or the Kotlin `kernel` sources yet; that wiring lands with the first feature that needs it (P03/P09). Python workers have no kernel emission yet. Swift analytics names are still hand-written (ADR-0004).
- **Revisit when:** a registry needs a shape JSON Schema cannot express, or a fourth consumer language needs emission and the emitter layout no longer fits. Reversal requires a new DEC entry.
