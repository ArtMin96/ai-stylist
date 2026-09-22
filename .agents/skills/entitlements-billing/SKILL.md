---
name: entitlements-billing
description: Change subscription plans, entitlements, trials, weighted-credit metering, RevenueCat webhook handling, restore/reconciliation, or paywall gating in the billing module — anything that decides who may use which capability or moves money through store billing. Use for a new entitlement or credit meter, a RevenueCat webhook, a trial/grace/expiry lifecycle edge case, or paywall gating logic. Not for the paywall's visual UI (`ios-feature` / `android-feature`, once the entitlement contract exists) or a price/tier experiment — pricing is a product decision recorded as a doc 12 hypothesis, out of scope for this skill.

metadata:
  modules: billing
  last-reviewed: 2026-09-13
  owner-agent: api-engineer
---

# Entitlements and Billing Changes

## Trigger

- Changes to plans/tiers, the entitlements table or checks, trial logic, generative-credit metering (weighted credits per DEC-34), RevenueCat webhook handling, restore/reconciliation, grace/expiry, or paywall gating on server or client.
- Not this skill: PostHog rollout flags (doc 15 §10 — flags are not entitlements); paywall visuals (`ios-feature` / `android-feature`, after the entitlement contract exists); a price/tier change itself (doc 12 hypothesis, product decision — this skill implements the resulting entitlement, it does not set the price).

## Required reading

1. `planning/12-pricing-entitlements-and-unit-economics.md` — tiers (hypotheses), entitlement model, metering, lifecycle, store compliance, reconciliation.
2. `planning/SPINE.md` §6 and `planning/16-risks-open-questions-and-decision-log.md` DEC-34/DEC-35 — weighted credits, grants per tier; all prices are labelled hypotheses.
3. `packages/shared-kernel/` entitlement-name and error/reason registries — canonical names used identically by server, mobile, analytics.
4. `docs/modules/billing.md` and `.agents/skills/entitlements-billing/references/billing.md` (module reference); current RevenueCat docs via context7 for webhook semantics — do not code webhooks from memory (root `CLAUDE.md` "Honesty about results").
5. `planning/phases/P13-monetization-and-entitlements.md` — the current phase's task list and acceptance criteria for this module.

## Workflow

1. Restate the entitlements/meters that change and expected behaviour per tier and per lifecycle edge: trial active, trial expired, grace, billing retry, cancelled-but-paid-through, refunded, restored, up/downgrade mid-cycle.
2. Invariants: the server-side entitlements table is the source of truth (never store receipt, RevenueCat cache, or client state); gating uses entitlements, not UI flags; webhooks are idempotent (event-id dedup via the idempotency-keys table) and out-of-order safe; reconciliation repairs drift; trial expiry downgrades but never deletes or locks data; credits decrement transactionally with the metered operation and refund on failure; store compliance per doc 12 (no external-payment steering).
3. New entitlement or meter name → `packages/shared-kernel` registry + `packages/contracts` first (`api-contract-change`), then use.
4. RevenueCat access only through a port implemented in `apps/api/src/platform/`; no SDK import in `modules/billing/**`.
5. Tests in `apps/api/src/modules/billing/tests/`: lifecycle matrix (state × capability), webhook replay/duplicate/out-of-order, reconciliation drift, metering concurrency. Store-sandbox E2E is `planning/phases/P13-monetization-and-entitlements.md`'s task P13-T17 (both platforms: purchase, restore-on-new-device, monthly↔annual, upgrade/downgrade, refund via sandbox) — this skill implements the server-side lifecycle that P13-T17 exercises end to end; it does not itself run the store-sandbox pass.

## Validation commands

```bash
just test billing
just test <gated modules>            # gating at point of use
just lint && just typecheck && just arch-check && just generate --check
just security-scan
```

Manual sandbox verification (RevenueCat sandbox + store test accounts from the sops `staging` file): state exactly which purchase/restore flows were exercised; never claim flows you did not run.

## Output

- PR with lifecycle-matrix evidence, registry/contract updates, and for any price/tier change the doc 12 hypothesis label plus the updated unit-economics note. Never present a price as validated.

Done checklist: lifecycle matrix green · webhook idempotency tests green · names in `shared-kernel` not hard-coded · `security-privacy-review` done for webhook handlers · `PROGRESS.md` updated.

## Stop / escalation

- Any path that could double-charge, strand a paying user, or delete data on downgrade → stop; human review mandatory.
- Apple/Google policy ambiguity → doc 16 legal register; do not guess.
- Production entitlement backfill/repair → destructive-data rule: explicit authorization.
- Auth/consent/webhook-handler code → `security-privacy-review` before PR (root `CLAUDE.md` mandatory list).

## Overlap

Adjacent: `backend-module` (general module mechanics), `api-contract-change` (new entitlement names on the wire), `security-privacy-review` (mandatory for webhook handlers), `ios-feature` / `android-feature` (paywall UI reads entitlements, never decides them), `release-readiness` (IAP product config check, and the P13-T17 store-sandbox pass). This skill owns `billing`'s entitlement/metering/webhook/reconciliation invariants; it never sets a price, only the entitlement that a price maps to.
