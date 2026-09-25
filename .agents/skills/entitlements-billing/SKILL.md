---
name: entitlements-billing
description: Change subscription plans, entitlements, trials, weighted-credit metering, RevenueCat webhook handling, restore/reconciliation, or server-side paywall gating in the billing module (apps/api/src/modules/billing) — anything that decides who may use which capability or moves money through store billing. Use for a new entitlement or credit meter, a RevenueCat webhook, a trial/grace/expiry lifecycle edge case, the credit ledger, reconciliation, or gating logic at a point of use. Not for the paywall's visual UI — use `ios-feature` / `android-feature` once the entitlement contract exists; not for adding the entitlement name itself to the registry — use `api-contract-change`; not for a price/tier experiment — pricing is a product decision recorded as a doc 12 hypothesis, out of scope for this skill.
metadata:
  modules: billing
  last-reviewed: 2026-09-25
  owner-agent: api-engineer
---

# Entitlements and Billing Changes

## Trigger

- Plans/tiers, entitlement resolution or checks, trial logic, weighted-credit metering (DEC-34), the credit ledger, RevenueCat webhook handling, restore/reconciliation, grace/expiry, or server-side gating at a point of use.
- State on 2026-09-25: `apps/api/src/modules/billing/` is a P02 skeleton; P13 is `NOT_STARTED`. The entitlement names already exist in `packages/shared-kernel/registry/entitlements.json` (e.g. `closet.max_items`, `credits.monthly`, `credits.topup`).
- Not this skill: PostHog rollout flags (doc 15 §10 — flags are not entitlements); paywall visuals (`ios-feature` / `android-feature`); a price or tier change (doc 12 hypothesis, product decision — this skill implements the resulting entitlement, never the price).

## Required reading

1. `planning/12-pricing-entitlements-and-unit-economics.md` — tiers (hypotheses), entitlement model (§3), credit ledger (§4), idempotent webhooks + reconciliation (§5.2), store compliance.
2. `planning/SPINE.md` §6 and `planning/16-risks-open-questions-and-decision-log.md` DEC-34/DEC-35 — weighted credits, grants per tier; every price is a labelled hypothesis.
3. `packages/shared-kernel/registry/entitlements.json` and `packages/shared-kernel/src/entitlements.ts` — canonical entitlement and credit-meter names; generated for Swift (`AIStylistKernel`) and Kotlin (`app.aistylist.contracts.kernel`) by `just generate` (ADR-0005). `ENTITLEMENT_REQUIRED` and other error codes are TS-only in `packages/shared-kernel/src/errors.ts`.
4. `docs/modules/billing.md` and `.agents/skills/entitlements-billing/references/billing.md`; current RevenueCat docs via context7 for webhook semantics — never code webhooks from memory (root `CLAUDE.md` "Honesty about results").
5. `planning/phases/P13-monetization-and-entitlements.md` §12 — P13-T04 to T07 (resolver, trial, enforcement seam, credit ledger), T09 to T11 (webhooks, reconciliation, lifecycle), T16 (security suite), T17 (store sandbox).

## Workflow

1. Restate the entitlements/meters that change and the expected behaviour per tier and lifecycle edge: trial active, trial expired, grace, billing retry, cancelled-but-paid-through, refunded, restored, up/downgrade mid-cycle.
2. Search before write:

   ```bash
   git ls-files apps/api/src/modules/billing
   rg -n '<entitlement or meter name>' packages/shared-kernel/registry packages/shared-kernel/src apps/api/src packages/contracts
   rg -n -i 'entitlement|credit|ledger|webhook|revenuecat' apps/api/src packages/contracts packages/test-support/src
   ```

   A name must already be in the registry; if it is not, stop (Stop section).

3. Copy the structure from the `backend-module` sibling table (`.agents/skills/backend-module/SKILL.md` Workflow step 4): controller `apps/api/src/platform/version.controller.ts`; RevenueCat port type + token shape `apps/api/src/platform/ports/health-probe.port.ts` (declared in `billing`'s `index.ts`); adapter `apps/api/src/platform/pg-health-probe.ts` (`platform-engineer`); fake `packages/test-support/src/clock.ts`; `ENTITLEMENT_REQUIRED` responses through `apps/api/src/platform/problem.filter.ts`; module test `apps/api/src/modules/billing/tests/billing.smoke.test.ts`.
4. Invariants: the server-side entitlements state is the source of truth (never a receipt, the RevenueCat cache, or client state); gating uses entitlements, never UI flags; webhooks verify the signature, then upsert `billing_events` keyed by the RevenueCat event id so a duplicate delivery is a no-op, and handle out-of-order events (doc 12 §5.2); reconciliation repairs drift; trial expiry downgrades but never deletes or locks data; credits decrement in the same transaction that accepts the metered job (`idempotency_key` = job id) and refund on failure; no external-payment steering.
5. RevenueCat is reached only through the port; no SDK import in `modules/billing/**`. Time-dependent rules (trial expiry, grace) take `now` as a parameter.
6. Tests in `apps/api/src/modules/billing/tests/`: lifecycle matrix (state × capability), webhook replay/duplicate/out-of-order, reconciliation drift, metering concurrency. P13-T17 (store sandbox, both platforms) exercises this end to end; this skill does not run it.

## Validation commands

```bash
just test billing
just test <gated module>              # gating at the point of use
just test-regression <test-file>      # bug fix: fails at merge-base, passes at HEAD
just lint && just typecheck && just arch-check
just generate --check                 # only if an entitlement name or contract changed in a prior step
just security-scan
just ci-parity                        # before PR
```

Store sandbox test accounts are not provisioned: the staging secrets file (`staging.enc.yaml`) arrives with P03 and only CI syncs it (`secrets/README.md`). A human runs the sandbox pass; never sync staging secrets on a workstation, and never claim a purchase or restore flow you did not run.

## Output

- PR with lifecycle-matrix evidence and registry/contract references; for any price/tier change, the doc 12 hypothesis label and the updated unit-economics note. Never present a price as validated. Report in the `agent-operating-contract` format.

Done checklist: lifecycle matrix green · webhook duplicate/out-of-order tests green · every name comes from the registry, none hard-coded · no RevenueCat SDK in `modules/billing/**` · `security-privacy-review` done for webhook handlers · `PROGRESS.md` line suggested.

## Stop / escalation

- A new entitlement name or credit meter → `packages/shared-kernel/registry/entitlements.json` via `api-contract-change` (single-writer) first; stop until it lands.
- The task needs `plans`, `entitlement_grants`, `billing_events` or the ledger table → no module `schema.ts` exists yet; route to `db-migration`, which has its own first-table stop.
- Webhook fan-out (`entitlements.changed` on the outbox) or a reconciliation job needs the outbox relay / pg-boss → P02-T08 is `NOT_STARTED`; stop and name it.
- A module wants to read billing state but has no `billing` edge in `ALLOWED_EDGES` (`tools/depcruise/rules.cjs`; only `admin` and `assistant` import `billing`) → stop; gating at that point of use needs a design decision, never a table read.
- Any path that could double-charge, strand a paying user, or delete data on downgrade → stop; human review mandatory.
- Apple/Google policy ambiguity → doc 16 legal register; do not guess.
- Production entitlement backfill/repair → destructive-data rule: explicit authorization.
- Auth/consent/webhook-handler code → `security-privacy-review` before PR (root `CLAUDE.md`).

## Overlap

Adjacent: `backend-module` (sibling table and the other modules), `api-contract-change` (entitlement names, meters, endpoints, events), `db-migration` (billing tables), `data-lifecycle` (ledger retention and RevenueCat subscriber deletion follow its cascade order), `security-privacy-review` (mandatory for webhook handlers), `ios-feature` / `android-feature` (paywall UI reads entitlements, never decides them), `release-readiness` (IAP product config, the P13-T17 sandbox pass). This skill owns `apps/api/src/modules/billing/**` and billing's entitlement, metering, webhook and reconciliation invariants; it never sets a price.
