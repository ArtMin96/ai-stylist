# Module Contract — `context`

> Module names are canonical per [SPINE §3](../../planning/SPINE.md). Path: `apps/api/src/modules/context`. This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** Context-provider ports (weather, holiday, occasion; future calendar) and context facts with freshness, confidence, and consent.
- **Owner:** @team (placeholder — see `CODEOWNERS`) · **Status:** skeleton (P02) · **Last updated:** 2026-09-13

## Public interface

Public interface: `index.ts` only. P02 skeleton: the sole export is the empty NestJS `ContextModule` class (composition-root wiring, imported by `tests/context.smoke.test.ts`); no domain service, command, query, type, or port is exported yet. Everything under `internal/` is blocked by the `public-api-only` boundary rule (`just arch-check`, `just lint`).

| Export | Kind (service/command/query/type/port) | Purpose  |
| ------ | -------------------------------------- | -------- |
| —      | —                                      | none yet |

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: `context_facts` (cached; precise location is sensitive per doc 11). Table definitions, when they exist, live in `apps/api/src/modules/context/internal/schema.ts` and are composed from `packages/db/` (ADR-0001 §3).

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

- `packages/shared-kernel` only (doc 04 §4.1). Providers (Open-Meteo for weather; the embedded `date-holidays` library for holidays, DEC-45) sit behind ports implemented in `platform`. Consumed by `recommendation`, `assistant`.
- Ports: none declared yet. New external capability = port interface here (or in `shared-kernel`) + implementation in `apps/api/src/platform/` + fake in tests; bound only at the composition root (`apps/api/src/main.ts` / `app.module.ts`).

## Forbidden dependencies

Derived from P02 brief §5 and doc 04 §4.2; every rule has a failing fixture in `just arch-check`, and exceptions need an ADR.

- Any module edge absent from the doc 04 §4.1 graph (`allowed-edges-only`), and any edge that closes a cycle (`no-cycles`).
- `apps/api/src/modules/<other>/internal/**` of any other module (`public-api-only`); another module's tables.
- Provider SDKs — `pg-boss`, aws-sdk/R2, RevenueCat, fal.ai, Open-Meteo, FCM, PostHog SDKs (`domain-no-provider-sdk`); ports only.
- `apps/api/src/platform/**` (`modules-not-platform`); ports are bound at composition roots only.
- Creating `utils/`, `helpers/`, or `common/` directories (`no-utils-dirs`); importing `prototype/**` (`prototype-unimportable`).
- Never imports Open-Meteo or other provider clients; unknown context is reported explicitly (missing-data note / lowered confidence), never invented (doc 09).

## Tests

- Location: `apps/api/src/modules/context/tests/`
- Required levels (once behaviour exists): unit for invariants/rules · contract tests for the public interface and events · integration (Testcontainers Postgres + pgvector) where repositories or adapters exist. P02 ships a smoke test that the module loads.
- Fixtures/builders: `packages/test-support/` and `packages/seed-data/` factories; never duplicated across modules; synthetic data only.

## Extension points

- New `ContextProvider` implementations register via the provider port; new fact kinds carry freshness + confidence + consent scope by construction.

Status: skeleton (P02).
