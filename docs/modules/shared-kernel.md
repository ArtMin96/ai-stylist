# Module Contract — `shared-kernel`

> Module names are canonical per [SPINE §3](../../planning/SPINE.md). Path: `packages/shared-kernel`. This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** Pure types, constants, and registries shared by every module: ULID prefixes, units, event envelope type, error/reason/entitlement registries, forbidden log keys, the log and span error-shape rules, and the feature-flag and owners registries.
- **Owner:** @team (placeholder — see `CODEOWNERS`) · **Status:** skeleton (P02) · **Last updated:** 2026-10-04

## Public interface

Public interface: `index.ts` only, which re-exports every file below in full. The data behind `reason-codes.ts`, `entitlements.ts` and `units.ts` comes from `registry/*.json` (JSON Schema-validated) through the generated `src/gen/*.ts`; the same registries generate the Swift `AIStylistKernel` target and the Kotlin `app.aistylist.contracts.kernel` package (`just generate`, [ADR-0005](../adr/0005-shared-kernel-registries-for-native-clients.md)). Edit the JSON, never `src/gen`. `forbidden-log-keys.ts`, `log-redaction.ts`, `owners.ts` and `feature-flags.ts` are TS-only: they import `registry/forbidden-log-keys.json`, `registry/log-redaction.json`, `registry/owners.json` and `registry/feature-flags.json` directly (no generated output, no Swift/Kotlin), and non-TS readers (lint rules, worker drift tests, the expired-flag report) read those JSON files. `registry/forbidden-log-keys.examples.json` holds the word-split examples for that list: `forbidden` keys (camel, snake, kebab and UPPER variants) every matcher must treat as forbidden, and `allowed` keys (the doc 14 §2 required ids and near-misses such as `latency` or `tokenizerVersion`) it must not. A key is forbidden when the whole key, or any of its words, is a registry word. TS tests import `FORBIDDEN_LOG_KEY_EXAMPLES` and the worker pytest reads the JSON; any other matcher of the list (such as the forbidden-field lint) must be tested against this same file, never a copy. `registry/log-redaction.json` holds the error-shape rules every logger and span sanitizer applies (doc 11 §8, doc 14 §2–3): `errorNameShape` (an error class name kept in a log `err.type` or a span `exception.type`, else `Error`), `codeShape` (a SQLSTATE or system code kept in `err.code` or `exception.type`), `maxCauseDepth` (cause links followed, 5) and `nestContextShape` (a Nest logger `context` kept only when it is a PascalCase class name, else redacted), plus `vectors`: `exceptionType.kept` / `.replaced` and `nestContext.kept` / `.redacted`. Each shape is an anchored, ASCII-only regex source that compiles unchanged in JavaScript (no flags) and Python (`re.ASCII`, full match). TS code imports `LOG_REDACTION_RULES` (compiled, frozen `RegExp`s and the depth) and its tests `LOG_REDACTION_EXAMPLES`; the Python workers read the JSON. Their schemas are checked by `packages/contracts/tests/kernel-registries.test.ts`, and the cross-references by `tests/feature-flags.test.ts`, `tests/forbidden-log-keys.test.ts` (every `forbidden` example matches a registry word, no `allowed` one does) and `tests/log-redaction.test.ts` (every vector matches its shape as labelled). Everything is importable by every module; nothing here may import anything back (`shared-kernel-pure`; the only dependency is `ulid`).

| Export (by file)                                                                                                                                                                                                      | Kind (service/command/query/type/port) | Purpose                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ids.ts`: `ID_PREFIXES`, `IdKind`, `IdPrefix`, `Id<K>`, `ParsedId`, `IdParseError`, `IdParseResult`, `newId`, `formatId`, `parseId`, `isId`                                                                           | constant / type / pure function        | Prefixed ULID identifiers per aggregate kind: mint, format, parse, and narrow                      |
| `units.ts`: `LENGTH_UNITS`, `MASS_UNITS`, `TEMPERATURE_UNITS`, `*Unit`, `Unit`, `CANONICAL_UNITS`, `Dimension`, `UNIT_SYSTEMS`, `UnitSystem`, `MEASUREMENT_SOURCES`, `MeasurementSource`, `Measurement<U>`, `convert` | constant / type / pure function        | Canonical metric storage units, unit systems, measurement provenance, and conversions              |
| `envelope.ts`: `EventType`, `ACTOR_KINDS`, `ActorKind`, `EventAggregate`, `EventActor`, `EventEnvelope<T, P>`                                                                                                         | type / constant                        | The event envelope every outbox event and consumer shares (doc 04 §9; `traceparent` doc 14 §3)     |
| `errors.ts`: `ERROR_CODES`, `ErrorCode`, `PROBLEM_TYPE_BASE`, `ProblemFieldError`, `ProblemDetails`, `ProblemOverrides`, `problem`                                                                                    | constant / type / pure function        | Error-code registry and the RFC 9457 problem-details shape the API returns                         |
| `reason-codes.ts`: `REASON_CODE_NAMESPACES`, `ReasonCodeNamespace`, `ReasonCodeStage`, `ReasonCodeDefinition`, `REASON_CODES`, `ReasonCode`                                                                           | constant / type                        | Recommendation reason-code registry (explanations come from the decision trace, never prose)       |
| `entitlements.ts`: `EntitlementValueKind`, `EntitlementDefinition`, `ENTITLEMENTS`, `EntitlementName`, `CREDIT_METERS`, `CreditMeter`                                                                                 | constant / type                        | Entitlement names/kinds and credit meters shared by billing, recommendation, and the mobile UI     |
| `forbidden-log-keys.ts`: `FORBIDDEN_LOG_KEYS`, `ForbiddenLogKeyExamples`, `FORBIDDEN_LOG_KEY_EXAMPLES`                                                                                                                | constant / type                        | Forbidden log key words (doc 11 §8) for every logger and lint, and their word-split examples       |
| `log-redaction.ts`: `LogRedactionRules`, `LOG_REDACTION_RULES`, `LogRedactionExamples`, `LOG_REDACTION_EXAMPLES`                                                                                                      | constant / type                        | Error name, code and Nest context shapes and the cause depth for logs and spans, with test vectors |
| `owners.ts`: `PersonId`, `Person`, `OwnerRole`, `OwnersRegistry`, `OWNERS_REGISTRY`                                                                                                                                   | constant / type                        | People and roles that own flags, dashboards and alerts, referenced by id (ADR-0007)                |
| `feature-flags.ts`: `FEATURE_FLAG_KINDS`, `FeatureFlagKind`, `FeatureFlagDefinition`, `FeatureFlagKey`, `FEATURE_FLAG_REGISTRY`, `FeatureFlags`, `FEATURE_FLAGS`                                                      | constant / type / port                 | Flag registry (owner, expiry, rollout plan, safe off state; doc 14 §11) and its check port         |

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: none — types and constants only, no tables, ever (SPINE §3). No schema file will ever exist here.

## Invariants

1. No business rule lives in a controller, Drizzle schema file, pg-boss job handler, provider wrapper, or React component (doc 04 §4.2 rule 9); adapters translate, this module decides.
2. No tables, no I/O, no framework imports; every export is a type, constant, registry entry, or pure function with a test.
3. Registry data has one source, `registry/*.json`: TS, Swift and Kotlin are generated from it, and `just generate --check` fails when any output is stale. The TS-only registries (`forbidden-log-keys` and its `forbidden-log-keys.examples`, `log-redaction`, `owners`, `feature-flags`) are imported as JSON, not generated. Consumers read the same file and never copy the values.
4. Every feature flag names a person id from `registry/owners.json` as owner, declares a safe `offBehavior` and `defaultWhenUnavailable`, and has `expiresAt` unless it is a `kill-switch`; a `rollout` flag expires at most 90 days after `createdAt` (doc 14 §11, NFR-OBS-080). Every role member is a declared person (`tests/feature-flags.test.ts`).
5. Error-shape redaction has one source, `registry/log-redaction.json`: a logged or exported error class name, code or Nest logger context that fails its shape is replaced, never written, and at most `maxCauseDepth` cause links are followed. Every implementation (API logger and span sanitizer, worker redaction and tracing) is tested against the file's `vectors`, never a copy; loosening a shape, raising the depth or removing a vector needs a security-privacy review (`tests/log-redaction.test.ts`).
6. Further invariants: OPEN until the first domain phase that touches this module fills them in (each needs at least one test).

## Events

| Event (published) | Payload schema (owner: `packages/contracts`) | When emitted |
| ----------------- | -------------------------------------------- | ------------ |
| —                 | —                                            | none yet     |

| Event (consumed) | From module | Reaction |
| ---------------- | ----------- | -------- |
| —                | —           | none yet |

## Dependencies (allowed)

- Nothing (`shared-kernel-pure`, doc 04 §4.2 rule 6): no workspace package, no framework, no I/O. Every module and `platform` may import it.
- Ports: may host port interfaces shared by several modules (doc 04 §4.2 rule 4); never their implementations. Hosted today: `FeatureFlags` + `FEATURE_FLAGS` (the PostHog adapter lives in `platform`).

## Forbidden dependencies

Derived from P02 brief §5 and doc 04 §4.2; every rule has a failing fixture (`just arch-check --fixtures`, which also fails when a rule has none), and exceptions need an ADR.

- Any edge that closes a cycle (`no-cycles`); the graph must equal doc 04 §4.1.
- `apps/api/src/modules/**`, `apps/api/src/platform/**`, `packages/contracts`, and every other workspace package.
- Provider SDKs — `pg-boss`, aws-sdk/R2, RevenueCat, fal.ai, Open-Meteo, FCM, PostHog SDKs (`domain-no-provider-sdk`); ports only.
- Creating `utils/`, `helpers/`, or `common/` directories (`no-utils-dirs`); importing `prototype/**` (`prototype-unimportable`).
- Must not import any workspace package, NestJS, Drizzle, Node I/O, or provider SDK; pure functions only.
- Single-writer path (CLAUDE.md, Parallel sessions): sequence changes, never parallelize them; owner `@dev-lead` in `CODEOWNERS`.

## Tests

- Location: `packages/shared-kernel/tests/` (single-writer package)
- Required levels: unit + property-based (fast-check) tests for every pure function and registry (P02-T03 ships these with the package); no integration tier — there is no I/O to integrate.
- Fixtures/builders: `packages/test-support/` and `packages/seed-data/` factories; never duplicated across modules; synthetic data only.

## Extension points

- New reason codes, entitlement names, units, or ID prefixes are added to the existing registries with tests; consumers regenerate/import, never copy (`just generate` for contract-facing values).
- A new feature flag is an entry in `registry/feature-flags.json`. A new person or role is an entry in `registry/owners.json`. Neither needs a code change. A new forbidden log word is an entry in `registry/forbidden-log-keys.json`, and every logger and lint that reads the file picks it up. A new word-split example is an entry under `forbidden` or `allowed` in `registry/forbidden-log-keys.examples.json`, and every matcher's tests that read the file check it. A new error-shape test vector is an entry under `vectors` in `registry/log-redaction.json`. A new error code is an entry in `ERROR_CODES` (`errors.ts`; additive, the OpenAPI `ProblemDetails.code` is a pattern, not an enum).

Status: skeleton (P02).
