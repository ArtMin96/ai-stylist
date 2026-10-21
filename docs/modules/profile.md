# Module Contract — `profile`

> Module names are canonical per [SPINE §3](../../planning/SPINE.md). Path: `apps/api/src/modules/profile`. This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** Measurements, body data, preferences, style identity, units/locale, and onboarding progress for a user (onboarding progress: owner decision 2026-10-13).
- **Owner:** @ArtMin96 (see `CODEOWNERS`) · **Status:** skeleton (P02) · **Last updated:** 2026-10-21

## Public interface

Public interface: `index.ts` only. P02 skeleton: the sole export is the empty NestJS `ProfileModule` class (composition-root wiring, imported by `tests/profile.smoke.test.ts`); no domain service, command, query, type, or port is exported yet. Everything under `internal/` is blocked by the `public-api-only` boundary rule (`just arch-check`, `just lint`).

| Export | Kind (service/command/query/type/port) | Purpose  |
| ------ | -------------------------------------- | -------- |
| —      | —                                      | none yet |

HTTP contract (`packages/contracts/openapi/modules/profile.yaml`, P03-T02.2). No server code serves it yet: P03-T06 and P03-T11.2 implement it.

- **Operations:** `getProfile` / `updateProfile` (`/v1/me/profile`), `getMeasurements` / `replaceMeasurements` (`/v1/me/measurements`), `getPreferences` / `updatePreferences` (`/v1/me/preferences`) and `getOnboardingProgress` / `updateOnboardingProgress` (`/v1/me/onboarding-progress`).
- **Versioning:** profile, measurements and preferences carry `version`; `0` means nothing is stored yet. Every write to one of them sends `If-Match`. A stale version is answered 409 `VERSION_MISMATCH` with the stored state in `current`.
- **Partial updates:** PATCH is a partial update in plain JSON. A present member replaces its value, an absent member is unchanged, and `null` is not accepted. `clear` removes `climateTolerance` or `typicalDay`.
- **Measurements:** SI only, and `PUT` replaces the whole set. A value outside its registry bounds is refused with 400 `MEASUREMENT_IMPLAUSIBLE`. An `estimated` or `derived` value without `confidence` is refused by the schema. Responses carry `Cache-Control: no-store`.
- **Onboarding progress:** one status per doc 02 §3.2 step that P03 runs (step 10, the selfie, joins in P05); a step only moves forward. The server names `nextRequiredStep`, and no If-Match is needed.

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: `profiles`, `measurements`, `preferences` (measurements are sensitive per doc 11). Table definitions, when they exist, live in `apps/api/src/modules/profile/internal/schema.ts` and are composed from `packages/db/` (ADR-0001 §3).

## Invariants

1. No business rule lives in a controller, Drizzle schema file, pg-boss job handler, provider wrapper, or React component (doc 04 §4.2 rule 9); adapters translate, this module decides.
2. This module writes only the tables it owns (doc 04 §4.2 rule 8); cross-module behaviour goes through public application services or events.
3. Further invariants: OPEN until the first domain phase that touches this module fills them in (each needs at least one test).

## Events

| Event (published)                 | Payload schema (owner: `packages/contracts`)                           | When emitted                                                                                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile.measurements.updated.v1` | `packages/contracts/events/profile.measurements.updated.v1.event.json` | `replaceMeasurements` stored a set that sets, replaces or removes at least one measurement. The payload names each changed measurement and its unit, never a value. Schema only (P03-T02.4); the producer is P03-T06.4 |

| Event (consumed) | From module | Reaction |
| ---------------- | ----------- | -------- |
| —                | —           | none yet |

## Dependencies (allowed)

- Public API of `identity`; `packages/shared-kernel` (units, measurement definitions). Consumed by `avatar`, `closet`, `recommendation`, `fashion-intel`, `assistant`.
- Ports: none declared yet. New external capability = port interface here (or in `shared-kernel`) + implementation in `apps/api/src/platform/` + fake in tests; bound only at the composition root (`apps/api/src/main.ts` / `app.module.ts`).

## Forbidden dependencies

Derived from P02 brief §5 and doc 04 §4.2; every rule has a failing fixture (`just arch-check --fixtures`, which also fails when a rule has none), and exceptions need an ADR.

- Any module edge absent from the doc 04 §4.1 graph (`allowed-edges-only`), and any edge that closes a cycle (`no-cycles`).
- `apps/api/src/modules/<other>/internal/**` of any other module (`public-api-only`); another module's tables.
- Provider SDKs — `pg-boss`, aws-sdk/R2, RevenueCat, fal.ai, Open-Meteo, FCM, PostHog SDKs (`domain-no-provider-sdk`); ports only.
- `apps/api/src/platform/**` (`modules-not-platform`); ports are bound at composition roots only.
- Creating `utils/`, `helpers/`, or `common/` directories (`no-utils-dirs`); importing `prototype/**` (`prototype-unimportable`).
- Body measurements never appear in logs, fixtures, seed data, prompts, or error messages (CLAUDE.md, Security and privacy rules).

## Tests

- Location: `apps/api/src/modules/profile/tests/`
- Required levels (once behaviour exists): unit for invariants/rules · contract tests for the public interface and events · integration (Testcontainers Postgres + pgvector) where repositories or adapters exist. P02 ships a smoke test that the module loads.
- Fixtures/builders: `packages/test-support/` and `packages/seed-data/` factories; never duplicated across modules; synthetic data only.

## Extension points

- Unit definitions and conversions come from `shared-kernel`; new preference kinds extend the preferences model without a second store.

Status: skeleton (P02): no domain code yet. P03-T02 added the HTTP contract and the published event schema in `packages/contracts`.
