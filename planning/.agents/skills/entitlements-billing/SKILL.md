---
name: entitlements-billing
description: Change subscriptions, entitlements, trials, metering/credits, RevenueCat webhooks, paywall gating, or reconciliation in the billing module. Use for anything that decides who may use which capability, or that touches money/store billing.
---

# Entitlements and Billing Changes

## Trigger

- Changes to plans/tiers, the entitlements table or checks, 3-day trial logic, generative-credit metering, RevenueCat webhook handling, restore/reconciliation, grace/expiry behavior, or paywall gating server- or client-side.

**Not this skill:** feature flags for rollout (doc 15 §10 — flags ≠ entitlements); paywall visual design (`mobile-feature`, after the entitlement contract exists).

## Required reading

1. `planning/12-pricing-entitlements-and-unit-economics.md` — tier definitions (hypotheses), entitlement model, metering rules, billing lifecycle, store compliance, reconciliation design.
2. `planning/SPINE.md` §5 note (entitlement seams from P06; trial is server-granted at signup) and §6 (tier table; all prices are labeled hypotheses).
3. Entitlement-name registry in `shared-kernel` — names are canonical, used identically by server, mobile, and analytics.
4. Current RevenueCat docs (context7/web) for webhook event semantics — do not code webhook handling from memory.

## Workflow

1. Restate which entitlement(s)/meter(s) change and the expected behavior per tier **and** per lifecycle edge: trial active, trial expired, grace period, billing retry, cancelled-but-paid-through, refunded, restored, upgraded/downgraded mid-cycle.
2. Invariants:
   - **Server-side entitlements table is the source of truth** — never the store receipt, never RevenueCat's cache, never client state. Clients read entitlements; they never decide them.
   - Capability gating uses entitlements; UI flags alone are a defect.
   - **Webhooks are idempotent** (event id dedup) and out-of-order-safe; reconciliation job repairs drift between RevenueCat and the table.
   - Trial: full Pro access, server-granted at account creation, no card; expiry downgrades entitlements but **never deletes or locks user data** — export always works (SPINE §6).
   - Metering: credits decremented transactionally with the metered operation, refunded on operation failure; limits fail soft with a clear upgrade path, not data loss.
   - Store compliance: any purchasable digital capability goes through store billing (doc 12); no external-payment steering in-app.
3. New entitlement/meter name → add to `shared-kernel` registry + contracts (`api-contract-change` step) before use.
4. Tests in `billing/tests/`: lifecycle table tests (each state × each capability), webhook replay/duplicate/out-of-order tests, reconciliation drift tests, metering concurrency tests. Sandbox-store E2E per doc 13 where the phase requires.

## Validation

```bash
just test billing
just test <gated-modules>          # gating checks at point of use
just lint && just typecheck && just arch-check && just generate --check
just security-scan
```

Manual verification against RevenueCat sandbox + store test accounts (doc 15 §11) for purchase/restore paths; state exactly which flows were exercised.

## Output

- PR with lifecycle-matrix test evidence, registry/contract updates, and — for any price/tier change — the doc-12 hypothesis label and updated unit-economics note. Never present a price as validated.

## Stop / escalate

- Anything that could double-charge, strand a paying user without access, or delete data on downgrade → stop, human review mandatory.
- Store-policy ambiguity (Apple/Google rules) → stop; flag for the doc-16 legal/compliance register, don't guess.
- Prod entitlement backfill/repair → destructive-data rule: explicit authorization required.
