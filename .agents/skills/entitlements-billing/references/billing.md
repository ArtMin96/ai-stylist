# `billing` — module reference

Last reviewed: 2026-09-25

## Contract summary

Plans, entitlements (source of truth), metering/credits, RevenueCat webhooks, and reconciliation. Full contract: [`docs/modules/billing.md`](../../../../docs/modules/billing.md).

## Invariants that bite

- The server-side entitlements table is the source of truth — never a receipt, RevenueCat cache, or client/UI-flag state; entitlements are decided server-side here (doc 12; doc 15 §10).
- Webhook handlers require the `security-privacy-review` skill before PR (root `CLAUDE.md`), verify the signature, upsert `billing_events` keyed by the RevenueCat event id (duplicate delivery = no-op, doc 12 §5.2), and are out-of-order safe.
- This module never imports the RevenueCat SDK directly — access only through a port implemented in `apps/api/src/platform/`.

## Key files

- `apps/api/src/modules/billing/index.ts` — public API, empty until the first export lands (P02 skeleton).
- `apps/api/src/modules/<name>/internal/schema.ts` — owned tables, once they exist.
- `apps/api/src/modules/billing/tests/` — this module's test suite, including the lifecycle matrix and webhook replay tests once P13 lands.

## Owned data

None yet (P02 skeleton). Planned per SPINE §3: `entitlements`, `plans`, `usage_meters`, `billing_events`. Table definitions, when they exist, live in `apps/api/src/modules/<name>/internal/schema.ts` and are composed from `packages/db/` (ADR-0001 §3).

## Events

None yet — P02 skeleton has no rows in the contract's Events tables. P13-T02 adds the entitlement registry, endpoints, events, and `ENTITLEMENT_REQUIRED` error via `packages/contracts` first; P13-T09's webhook handler emits the outbox `entitlements.changed` event.

## Allowed / forbidden edges

Allowed: public API of `identity`; `packages/shared-kernel` (entitlement names in `packages/shared-kernel/registry/entitlements.json`). RevenueCat access via a port implemented in `platform`. Consumed by `admin`, `assistant`. Forbidden: any other module's `internal/**` or tables (`public-api-only`); provider SDKs — ports only (`domain-no-provider-sdk`); `apps/api/src/platform/**` (`modules-not-platform`); the RevenueCat SDK import ban above.

## Test command

```bash
just test billing
```

## Phase tasks that touch this module

`planning/phases/P13-monetization-and-entitlements.md` is the current domain phase for this module: P13-T04–T07 build the entitlement resolver, trial handling, enforcement seam, and credit ledger; P13-T09–T11 build the webhook state machine, reconciliation, and lifecycle edge cases; P13-T16 is the security suite (webhook replay/forgery, tamper, double-spend); P13-T17 is the store-sandbox E2E pass that exercises this module end to end. Check that phase file's §12/§19 before assuming a task id still holds.

## Escalate when

- A change could double-charge, strand a paying user, or delete data on downgrade — stop; human review mandatory per the skill's Stop / escalation section.
- Apple/Google policy ambiguity comes up — doc 16 legal register, do not guess; P13-T01 is the store-compliance gate this phase already ran.
- A production entitlement needs backfill or repair — destructive-data rule: explicit authorization required, never run unattended.
