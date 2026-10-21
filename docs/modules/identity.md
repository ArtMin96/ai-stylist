# Module Contract — `identity`

> Module names are canonical per [SPINE §3](../../planning/SPINE.md). Path: `apps/api/src/modules/identity`. This contract is the module's source of truth; code that contradicts it is wrong until a DEC entry says otherwise.

- **Responsibility (one sentence):** Accounts, sessions, auth providers, account recovery, consent records, the age gate, and the data-export and account-deletion requests (export and deletion: owner decision 2026-10-13).
- **Owner:** @ArtMin96 (see `CODEOWNERS`) · **Status:** skeleton (P02) · **Last updated:** 2026-10-21

## Public interface

Public interface: `index.ts` only. P02 skeleton: the sole export is the empty NestJS `IdentityModule` class (composition-root wiring, imported by `tests/identity.smoke.test.ts`); no domain service, command, query, type, or port is exported yet. Everything under `internal/` is blocked by the `public-api-only` boundary rule (`just arch-check`, `just lint`).

| Export | Kind (service/command/query/type/port) | Purpose  |
| ------ | -------------------------------------- | -------- |
| —      | —                                      | none yet |

HTTP contract (`packages/contracts/openapi/modules/identity.yaml`, P03-T02). No server code serves it yet: P03-T03 to P03-T05, P03-T09 and P03-T10 implement it. better-auth 1.7.12 with `@better-auth/passkey` 1.7.12 serves `/v1/auth/*` at basePath `/v1/auth`. Only the operations listed here are served under that path.

- **Sign-in and sessions:** `signInWithIdToken` (Apple or Google), `completeSignUp`, `getPasskeySignInOptions`, `signInWithPasskey`, `getPasskeyRegistrationOptions`, `registerPasskey`, `getSession`, `refreshSession`, `signOut`, `listDeviceSessions` and `signOutAllDevices`. A sign-in answers one `SignInResult`: `session`, `sign_up_required` (the age gate, through `completeSignUp`) or `deletion_pending` (a cancel credential for `DELETE /v1/me/deletion`, no session). In P03 an account is created with Apple or Google only. A passkey is added to a signed-in account (`registerPasskey`) and then signs in (owner decision 2026-10-21). A session is a `SessionGrant`: a short-lived access token (`bearerAuth`, about 15 min) and a separate refresh token. `refreshSession` (`POST /v1/auth/session/refresh`, refresh token in the body) rotates both. Reuse of a rotated refresh token revokes the session family (doc 11 §4.2; owner decision 2026-10-21).
- **Account recovery:** `requestAccountRecovery` (`POST /v1/auth/sign-in/magic-link`) gives a uniform answer. The emailed link opens the app with the token in the URL fragment, and works from 24 to 48 h after the request. The app calls `completeAccountRecovery` (`POST /v1/auth/recovery/complete`, token in the body). `cancelAccountRecovery` is `DELETE /v1/me/recovery`. `completeSignUp`, `refreshSession`, `completeAccountRecovery` and `cancelAccountRecovery` are identity's own routes, not library paths.
- **Consents** (`/v1/me/consents`): `listConsents` answers one `ResolvedConsent` per `ConsentPurpose`, in enum order. Each entry has `granted` (the state the server applies), `withdrawable` and `record` (the latest consent record, absent while the server default applies). `recordConsent` appends a record (201), or answers 200 and stores nothing when the request repeats the current state. A withdrawal of a purpose with `withdrawable: false` (`core_service` today) is refused with 403 `CONSENT_REQUIRED`.
- **Data export and deletion** (owner decision 2026-10-13): `requestDataExport` (`POST /v1/me/exports`, 202) starts an export. A second request while one runs gets 429 with the running export as `current`. `getDataExport` (`GET /v1/me/exports/{id}`, `no-store`) reads it. An export is `in_progress`, `ready`, `failed` or `expired`. While it is `ready`, each read mints a download link that lives at most 10 min (DEC-44). The archive is kept until `availableUntil`, 24 h after it was built (doc 11 §13.1). `requestAccountDeletion` (`POST /v1/me/deletion`, 202) revokes every session and starts the 7-day grace window (`graceEndsAt`, DEC-65). `cancelAccountDeletion` (`DELETE /v1/me/deletion`, 204) accepts only the `deletionCancelToken` credential (header `Deletion-Cancel-Token`; the scheme lives in `identity.yaml`). It opens no session, and is refused with 410 `ACCOUNT_DELETED` once the window has ended.
- **Rules across operations:** `requestDataExport`, `requestAccountDeletion` and `getPasskeyRegistrationOptions` need a recent sign-in (`RecentSignInRequired`, 403 `FORBIDDEN`). A `refreshSession` renewal never resets that recency (export: owner decision 2026-10-21). Every bearer-authenticated operation answers the shared 410 `AccountDeleted`. The operations whose answer carries a credential are `signInWithIdToken`, `completeSignUp`, `signInWithPasskey`, `refreshSession` and `completeAccountRecovery`. They are marked `x-idempotency-replay: never` and are never answered from the idempotency store.

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: `users`, `sessions`, `consents`. Table definitions, when they exist, live in `apps/api/src/modules/identity/internal/schema.ts` and are composed from `packages/db/` (ADR-0001 §3).

## Invariants

1. No business rule lives in a controller, Drizzle schema file, pg-boss job handler, provider wrapper, or React component (doc 04 §4.2 rule 9); adapters translate, this module decides.
2. This module writes only the tables it owns (doc 04 §4.2 rule 8); cross-module behaviour goes through public application services or events.
3. Further invariants: OPEN until the first domain phase that touches this module fills them in (each needs at least one test).

## Events

| Event (published)                        | Payload schema (owner: `packages/contracts`)                                  | When emitted                                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `identity.account.created.v1`            | `packages/contracts/events/identity.account.created.v1.event.json`            | `completeSignUp` created the account, in the same transaction. Schema only (P03-T02.4); the producer is P03-T03.6          |
| `identity.consent.changed.v1`            | `packages/contracts/events/identity.consent.changed.v1.event.json`            | `recordConsent` appended a consent record (201; not when it answers 200 unchanged). Schema only; the producer is P03-T05.1 |
| `identity.account.deletion_requested.v1` | `packages/contracts/events/identity.account.deletion_requested.v1.event.json` | `requestAccountDeletion` accepted a request, and the 7-day grace window starts. Schema only; the producer is P03-T10.3     |
| `identity.account.export_requested.v1`   | `packages/contracts/events/identity.account.export_requested.v1.event.json`   | `requestDataExport` accepted a request, which starts the export job chain. Schema only; the producer is P03-T09.6          |

Payloads carry ids, enums and timestamps only, and every example sets the envelope's `subjectUserId` to the payload's `userId`.

| Event (consumed) | From module | Reaction |
| ---------------- | ----------- | -------- |
| —                | —           | none yet |

## Dependencies (allowed)

- `packages/shared-kernel` only (doc 04 §4.1: `identity` is a leaf among domain modules). Consumed by `profile`, `billing`, `notifications`, `admin`.
- Ports: none declared yet. New external capability = port interface here (or in `shared-kernel`) + implementation in `apps/api/src/platform/` + fake in tests; bound only at the composition root (`apps/api/src/main.ts` / `app.module.ts`).

## Forbidden dependencies

Derived from P02 brief §5 and doc 04 §4.2; every rule has a failing fixture (`just arch-check --fixtures`, which also fails when a rule has none), and exceptions need an ADR.

- Any module edge absent from the doc 04 §4.1 graph (`allowed-edges-only`), and any edge that closes a cycle (`no-cycles`).
- `apps/api/src/modules/<other>/internal/**` of any other module (`public-api-only`); another module's tables.
- Provider SDKs — `pg-boss`, aws-sdk/R2, RevenueCat, fal.ai, Open-Meteo, FCM, PostHog SDKs (`domain-no-provider-sdk`); ports only.
- `apps/api/src/platform/**` (`modules-not-platform`); ports are bound at composition roots only.
- Creating `utils/`, `helpers/`, or `common/` directories (`no-utils-dirs`); importing `prototype/**` (`prototype-unimportable`).
- Auth/authorization and consent changes require the `security-privacy-review` skill before PR (CLAUDE.md, Security and privacy rules). Age policy: 16+ at launch (DEC-60, pending LR-09). Sign-in at launch is Apple, Google and passkeys, with no email+password (DEC-64). The account-deletion grace window is 7 days (DEC-65). No foreign key crosses a module boundary (ADR-0009, DEC-67), and `users` carries `home_region` (DEC-61).

## Tests

- Location: `apps/api/src/modules/identity/tests/`
- Required levels (once behaviour exists): unit for invariants/rules · contract tests for the public interface and events · integration (Testcontainers Postgres + pgvector) where repositories or adapters exist. P02 ships a smoke test that the module loads.
- Fixtures/builders: `packages/test-support/` and `packages/seed-data/` factories; never duplicated across modules; synthetic data only.

## Extension points

- New auth providers register behind an auth-provider port; consent purposes are named in `shared-kernel` (`CONSENT_PURPOSES`), not hard-coded here.

Status: skeleton (P02): no domain code yet. P03-T02 added the HTTP contract and the four published event schemas in `packages/contracts`.
