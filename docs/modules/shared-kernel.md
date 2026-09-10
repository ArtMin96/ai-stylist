# Module Contract — `shared-kernel`

> Module names are canonical per [SPINE §3](../../planning/SPINE.md). Path: `packages/shared-kernel`. This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** Pure types, constants, and registries shared by every module: ULID prefixes, units, event envelope type, error/reason/entitlement registries.
- **Owner:** @team (placeholder — see `CODEOWNERS`) · **Status:** skeleton (P02) · **Last updated:** 2026-09-10

## Public interface

Public interface: `index.ts` only, which re-exports every file below in full. Everything is importable by every module; nothing here may import anything back (`shared-kernel-pure`; the only dependency is `ulid`).

| Export (by file)                                                                                                                                                                                                      | Kind (service/command/query/type/port) | Purpose                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ids.ts`: `ID_PREFIXES`, `IdKind`, `IdPrefix`, `Id<K>`, `ParsedId`, `IdParseError`, `IdParseResult`, `newId`, `formatId`, `parseId`, `isId`                                                                           | constant / type / pure function        | Prefixed ULID identifiers per aggregate kind: mint, format, parse, and narrow                  |
| `units.ts`: `LENGTH_UNITS`, `MASS_UNITS`, `TEMPERATURE_UNITS`, `*Unit`, `Unit`, `CANONICAL_UNITS`, `Dimension`, `UNIT_SYSTEMS`, `UnitSystem`, `MEASUREMENT_SOURCES`, `MeasurementSource`, `Measurement<U>`, `convert` | constant / type / pure function        | Canonical metric storage units, unit systems, measurement provenance, and conversions          |
| `envelope.ts`: `EventType`, `ACTOR_KINDS`, `ActorKind`, `EventAggregate`, `EventActor`, `EventEnvelope<T, P>`                                                                                                         | type / constant                        | The event envelope every outbox event and consumer shares (doc 04 §9)                          |
| `errors.ts`: `ERROR_CODES`, `ErrorCode`, `PROBLEM_TYPE_BASE`, `ProblemFieldError`, `ProblemDetails`, `ProblemOverrides`, `problem`                                                                                    | constant / type / pure function        | Error-code registry and the RFC 9457 problem-details shape the API returns                     |
| `reason-codes.ts`: `REASON_CODE_NAMESPACES`, `ReasonCodeNamespace`, `ReasonCodeStage`, `ReasonCodeDefinition`, `REASON_CODES`, `ReasonCode`                                                                           | constant / type                        | Recommendation reason-code registry (explanations come from the decision trace, never prose)   |
| `entitlements.ts`: `EntitlementValueKind`, `EntitlementDefinition`, `ENTITLEMENTS`, `EntitlementName`, `CREDIT_METERS`, `CreditMeter`                                                                                 | constant / type                        | Entitlement names/kinds and credit meters shared by billing, recommendation, and the mobile UI |

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: none — types and constants only, no tables, ever (SPINE §3). No schema file will ever exist here.

## Invariants

1. No business rule lives in a controller, Drizzle schema file, Trigger.dev task body, provider wrapper, or React component (doc 04 §4.2 rule 9); adapters translate, this module decides.
2. No tables, no I/O, no framework imports; every export is a type, constant, registry entry, or pure function with a test.
3. Further invariants: OPEN until the first domain phase that touches this module fills them in (each needs at least one test).

## Events

| Event (published) | Payload schema (owner: `packages/contracts`) | When emitted |
| ----------------- | -------------------------------------------- | ------------ |
| —                 | —                                            | none yet     |

| Event (consumed) | From module | Reaction |
| ---------------- | ----------- | -------- |
| —                | —           | none yet |

## Dependencies (allowed)

- Nothing (`shared-kernel-pure`, doc 04 §4.2 rule 6): no workspace package, no framework, no I/O. Every module and `platform` may import it.
- Ports: may host port interfaces shared by several modules (doc 04 §4.2 rule 4); never their implementations.

## Forbidden dependencies

Derived from P02 brief §5 and doc 04 §4.2; every rule has a failing fixture in `just arch-check`, and exceptions need an ADR.

- Any edge that closes a cycle (`no-cycles`); the graph must equal doc 04 §4.1.
- `apps/api/src/modules/**`, `apps/api/src/platform/**`, `packages/contracts`, and every other workspace package.
- Provider SDKs — `@trigger.dev/sdk`, aws-sdk/R2, RevenueCat, fal.ai, Open-Meteo, FCM, PostHog SDKs (`domain-no-provider-sdk`); ports only.
- Creating `utils/`, `helpers/`, or `common/` directories (`no-utils-dirs`); importing `prototype/**` (`prototype-unimportable`).
- Must not import any workspace package, NestJS, Drizzle, Node I/O, or provider SDK; pure functions only.
- Single-writer path (CLAUDE.md, Parallel sessions): sequence changes, never parallelize them; owner `@dev-lead` in `CODEOWNERS`.

## Tests

- Location: `packages/shared-kernel/tests/` (single-writer package)
- Required levels: unit + property-based (fast-check) tests for every pure function and registry (P02-T03 ships these with the package); no integration tier — there is no I/O to integrate.
- Fixtures/builders: `packages/test-support/` and `packages/seed-data/` factories; never duplicated across modules; synthetic data only.

## Extension points

- New reason codes, entitlement names, units, or ID prefixes are added to the existing registries with tests; consumers regenerate/import, never copy (`just generate` for contract-facing values).

Status: skeleton (P02).
