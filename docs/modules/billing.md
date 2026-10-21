# Module Contract — `billing`

> Module names are canonical per [SPINE §3](../../planning/SPINE.md). Path: `apps/api/src/modules/billing`. This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** Plans, entitlements (source of truth), metering/credits, RevenueCat webhooks, and reconciliation.
- **Owner:** @ArtMin96 (see `CODEOWNERS`) · **Status:** skeleton (P02) · **Last updated:** 2026-10-21

## Public interface

Public interface: `index.ts` only. P02 skeleton: the sole export is the empty NestJS `BillingModule` class (composition-root wiring, imported by `tests/billing.smoke.test.ts`); no domain service, command, query, type, or port is exported yet. Everything under `internal/` is blocked by the `public-api-only` boundary rule (`just arch-check`, `just lint`).

| Export | Kind (service/command/query/type/port) | Purpose  |
| ------ | -------------------------------------- | -------- |
| —      | —                                      | none yet |

HTTP contract (`packages/contracts/openapi/modules/billing.yaml`, P03-T02.3). No server code serves it yet: P03-T07 implements it.

- `getEntitlements` (`GET /v1/me/entitlements`) answers the caller's `EntitlementState`. `state` is the doc 03 §4.3 lifecycle state: `trial`, `free`, `active_paid`, `grace` or `cancelled_active` (kernel `ENTITLEMENT_LIFECYCLE_STATES`). `stateEndsAt` says when that state ends, e.g. the end of the trial.
- `entitlements` holds one `ResolvedEntitlement` per registered entitlement, in registry order. Over the active grants the most generous value wins, per entitlement (doc 12 §3.2). `source` is the grant kind that won: `plan_grant`, `trial_grant`, `promo_grant` or `grandfather_grant` (kernel `ENTITLEMENT_GRANT_KINDS`). It is absent when the Free-plan value applies.
- One value member follows the entitlement's kind: `granted`, `limit` (`null` = unlimited) or `level`. Each `level` entitlement lists its `levels`, lowest first, in `packages/shared-kernel/registry/entitlements.json`, and `compareEntitlementLevels` orders them. TypeScript reads the order generated; Swift and Kotlin read it once the kernel emitter covers it.
- No operation lets a client set an entitlement. The apps read the answer to render only, and the server checks every gated request again.

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: `entitlements`, `plans`, `usage_meters`, `billing_events`. Table definitions, when they exist, live in `apps/api/src/modules/billing/internal/schema.ts` and are composed from `packages/db/` (ADR-0001 §3).

## Invariants

1. No business rule lives in a controller, Drizzle schema file, pg-boss job handler, provider wrapper, or React component (doc 04 §4.2 rule 9); adapters translate, this module decides.
2. This module writes only the tables it owns (doc 04 §4.2 rule 8); cross-module behaviour goes through public application services or events.
3. Further invariants: OPEN until the first domain phase that touches this module fills them in (each needs at least one test).

## Events

| Event (published) | Payload schema (owner: `packages/contracts`) | When emitted |
| ----------------- | -------------------------------------------- | ------------ |
| —                 | —                                            | none yet     |

| Event (consumed)              | From module | Reaction                                                                                                 |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `identity.account.created.v1` | `identity`  | Writes the 72 h trial grant (`trial_grant`), once per event id. Not built yet: the consumer is P03-T07.5 |

## Dependencies (allowed)

- Public API of `identity`; `packages/shared-kernel` (entitlement registry with its level order, the grant kinds and the lifecycle states). RevenueCat access via a port implemented in `platform`. Consumed by `admin`, `assistant`.
- Ports: none declared yet. New external capability = port interface here (or in `shared-kernel`) + implementation in `apps/api/src/platform/` + fake in tests; bound only at the composition root (`apps/api/src/main.ts` / `app.module.ts`).

## Forbidden dependencies

Derived from P02 brief §5 and doc 04 §4.2; every rule has a failing fixture (`just arch-check --fixtures`, which also fails when a rule has none), and exceptions need an ADR.

- Any module edge absent from the doc 04 §4.1 graph (`allowed-edges-only`), and any edge that closes a cycle (`no-cycles`).
- `apps/api/src/modules/<other>/internal/**` of any other module (`public-api-only`); another module's tables.
- Provider SDKs — `pg-boss`, aws-sdk/R2, RevenueCat, fal.ai, Open-Meteo, FCM, PostHog SDKs (`domain-no-provider-sdk`); ports only.
- `apps/api/src/platform/**` (`modules-not-platform`); ports are bound at composition roots only.
- Creating `utils/`, `helpers/`, or `common/` directories (`no-utils-dirs`); importing `prototype/**` (`prototype-unimportable`).
- Never imports the RevenueCat SDK; webhook handlers require the `security-privacy-review` skill before PR (CLAUDE.md).
- Entitlements are decided server-side here, never by client state, store receipt, or a UI flag (doc 12; doc 15 §10).

## Tests

- Location: `apps/api/src/modules/billing/tests/`
- Required levels (once behaviour exists): unit for invariants/rules · contract tests for the public interface and events · integration (Testcontainers Postgres + pgvector) where repositories or adapters exist. P02 ships a smoke test that the module loads.
- Fixtures/builders: `packages/test-support/` and `packages/seed-data/` factories; never duplicated across modules; synthetic data only.

## Extension points

- New entitlement or meter names go to the `shared-kernel` registry + `packages/contracts` first (`entitlements-billing` skill); plan changes are data, not code branches.

Status: skeleton (P02): no domain code yet. P03-T02.3 added the HTTP contract in `packages/contracts`.
