# Module Contract — `profile`

> Module names are canonical per [SPINE §3](../../planning/SPINE.md). Path: `apps/api/src/modules/profile`. This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** Measurements, body data, preferences, style identity, and units/locale for a user.
- **Owner:** @team (placeholder — see `CODEOWNERS`) · **Status:** skeleton (P02) · **Last updated:** 2026-09-09

## Public interface

Public interface: `index.ts` only; nothing exported yet (P02 skeleton). Everything under `internal/` is blocked by the `public-api-only` boundary rule (`just arch-check`, `just lint`).

| Export | Kind (service/command/query/type/port) | Purpose  |
| ------ | -------------------------------------- | -------- |
| —      | —                                      | none yet |

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: `profiles`, `measurements`, `preferences` (measurements are sensitive per doc 11). Table definitions, when they exist, live in `apps/api/src/modules/profile/internal/schema.ts` and are composed from `packages/db/` (ADR-0001 §3).

## Invariants

1. No business rule lives in a controller, Drizzle schema file, pg-boss job handler, provider wrapper, or React component (doc 04 §4.2 rule 9); adapters translate, this module decides.
2. This module writes only the tables it owns (doc 04 §4.2 rule 8); cross-module behaviour goes through public application services or events.
3. Further invariants: OPEN until the first domain phase that touches this module fills them in (each needs at least one test).

## Events

| Event (published) | Payload schema (owner: `packages/contracts`) | When emitted |
| ----------------- | -------------------------------------------- | ------------ |
| —                 | —                                            | none yet     |

| Event (consumed) | From module | Reaction |
| ---------------- | ----------- | -------- |
| —                | —           | none yet |

## Dependencies (allowed)

- Public API of `identity`; `packages/shared-kernel` (units, measurement definitions). Consumed by `avatar`, `closet`, `recommendation`, `fashion-intel`, `assistant`.
- Ports: none declared yet. New external capability = port interface here (or in `shared-kernel`) + implementation in `apps/api/src/platform/` + fake in tests; bound only at the composition root (`apps/api/src/main.ts` / `app.module.ts`).

## Forbidden dependencies

Derived from P02 brief §5 and doc 04 §4.2; every rule has a failing fixture in `just arch-check`, and exceptions need an ADR.

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

Status: skeleton (P02).
