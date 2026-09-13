# P13 — Monetization and Entitlements

> Amended 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — service consolidation: pg-boss jobs, owned server + Coolify, self-managed PostgreSQL, R2 delivery model).

> File name: `phases/P13-monetization-and-entitlements.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10). Status values per [PROGRESS.md](../PROGRESS.md). All prices in this file are **PRICING HYPOTHESES** per [12](../12-pricing-entitlements-and-unit-economics.md); store-compliance statements carry `[VERIFY-P13]` and require qualified review.

## 1. Overview

- **Phase:** P13 — Monetization and entitlements
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Activate billing end-to-end — 3-day server-granted Pro trial, Free-tier limit enforcement, three paid tiers via RevenueCat, server-side entitlements at every enforcement point, the generative-credit ledger, paywall/restore/lifecycle handling, idempotent webhooks with reconciliation, and store-compliance sign-off — without refactoring feature code, because the entitlement seams have existed since P06 (REQ-BIL-130).
- **User-visible outcome:** A new user gets 3 days of full Pro access with no card; on expiry they land on a genuinely useful Free tier with all data safe and exportable; they can subscribe to Essentials/Plus/Pro (monthly or annual), restore purchases on a new device, see their credit balance, and hit clear contextual paywalls at gated actions.
- **Why now:** Hard dependency is only P03 (accounts to grant entitlements against), but P13 is sequenced after P06–P12 so every gated capability (closet caps, G2 credits, trends levels) already checks entitlements through the shared seam — P13 turns billing on, it does not retrofit it. It must precede P14 because store review, compliance checklist, and purchase E2E are launch-qualification inputs.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-BIL-010 | 3-day Pro trial, server-granted at signup, no card | AC-1 |
| REQ-BIL-020 | Auto-downgrade to genuinely useful Free tier on expiry | AC-2 |
| REQ-BIL-030 | Three paid tiers per SPINE §6, prices labeled hypotheses | AC-3 |
| REQ-BIL-040 | Server-side entitlements as source of truth, API-enforced | AC-4 |
| REQ-BIL-050 | Monthly + annual + restore via RevenueCat on both stores | AC-5 |
| REQ-BIL-060 | Grace, retry, cancel, refund, up/downgrade, family stance, regions | AC-6 |
| REQ-BIL-070 *(with P14 sign-off)* | Apple/Play billing compliance | AC-7 |
| REQ-BIL-080 | Idempotent webhooks + periodic reconciliation | AC-8 |
| REQ-BIL-090 | Generative-credit metering, non-punitive | AC-9 |
| REQ-BIL-100 | Cost-to-serve estimates + plan-level runtime guardrails | AC-10 |
| REQ-BIL-110 | Experiments, grandfathering, plan versioning | AC-11 |
| REQ-BIL-120 | Data safe + exportable on expiry; paid-derived assets predictable | AC-12 |
| REQ-BIL-130 *(completes P06–P13 arc)* | Entitlement seams activate without feature refactoring | AC-4, AC-13 |
| REQ-REC-170 *(secondary; primary P09)* | Experiments never corrupt deterministic safety constraints | AC-11 |
| NFR-PRV-030 *(secondary; primary P03)* | Full export on every tier incl. Free/expired | AC-12 |
| NFR-SEC-100 *(with P14)* | Security suites incl. webhook replay gate release | AC-8 |
| NFR-AIC-080 *(secondary; primary P06)* | AI cost metered per plan with guardrail alerts | AC-10 |

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P03** (per SPINE §5). Consumes entitlement seams built into P06+ features (flags + shared entitlement check) and the credit-consuming operations from P11; if P11/P12 shipped descoped, the corresponding entitlements stay dormant (no blocker).
- External blockers: **RISK-04** / **OQ-02** (store approval of server-granted trial — compliance review is P13-T01 and gates submission strategy); **ASM-05**; **OQ-01** (product name needed for store listing — must be decided by P13 for store metadata); **OQ-09**/BIL-O5 (family sharing — default: not in v1); **BIL-O1/O2/O6** ([12 §8](../12-pricing-entitlements-and-unit-economics.md)); **LR-08** (CCPA sale/share classification of RevenueCat/PostHog flows, [11 §12](../11-security-privacy-and-compliance.md)); Apple/Play developer accounts, RevenueCat account, store sandbox testers, Small Business Program enrollment.

## 4. In scope / out of scope

**In scope:** entitlement registry finalization in `shared-kernel` (the 17 named entitlements of [12 §3.1](../12-pricing-entitlements-and-unit-economics.md)); entitlement resolver (most-generous-wins over `plan|trial|promo|grandfather` grants); trial grant at signup + expiry job + countdown/recap UX; enforcement activation at every point in [12 §3.3](../12-pricing-entitlements-and-unit-economics.md); credit ledger (grant/consume/expire/refund, atomic, idempotent, user-visible balance/history); RevenueCat SDK + 8 SKUs + offerings; purchase/restore/upgrade/downgrade/cancel/refund/grace/retry handling; idempotent webhook handler + billing_events + nightly reconciliation with drift alert; contextual paywalls + trial-expiry recap + Settings→Subscription; pricing/paywall experiments via PostHog flags with real SKUs only; plan versioning + grandfather grants; expiry behavior (nothing deleted, over-cap read-only, export on Free); store-compliance checklist execution with every `[VERIFY-P13]` item labeled for qualified review; per-plan AI cost guardrails live; billing observability (dashboard 5) and admin billing panel.

**Stretch (build if T01–T16 land early, else v1.1):** consumable top-up SKUs 30 credits $4.99 / 100 credits $12.99 (BIL-O4; ledger `type: topup` already designed).

**Out of scope / non-goals:** credit rollover (BIL-O4 experiment); family sharing (BIL-O5 — decision recorded: not in v1); web checkout or any purchase path outside store IAP; localization of pricing pages (English-first; store regional price tiers only); store submission itself and final privacy labels (P14); changing tier structure or prices (owned by SPINE §6 / doc 12 — this phase implements, never re-prices).

## 5. Product/UX behavior

Owned journey: [02 §12](../02-user-journeys-and-information-architecture.md). Cover every state: **empty · loading · partial · failure · retry · recovery · offline · accessibility**.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Trial start (signup) | Pro entitlements granted server-side, one-line onboarding mention, "Trial · N days left" pill; T-24h reminder (consented) | n/a | Grant is part of signup transaction; signup fails atomically if grant fails | Signup requires connectivity already | Pill readable, not color-only |
| Trial expiry | Resolver stops seeing trial grant → Free; one dismissible recap screen (what you did, what changes, tiers); lands on functional Free Today tab | New user who never used trial features: recap shows tier table only | Recap fetch failure → dismissable generic recap; entitlements already correct server-side | Cached entitlements honored for offline validity window; expiry applies at next sync | Recap fully screen-reader navigable; no dismiss-blocking |
| Contextual paywall | Gated action (item 41 on Free, 2nd rec/day on Free, G2 tap on Free/Essentials) → paywall naming the trigger; tier table, monthly/annual toggle, restore link | — | Store sheet cancel/failure → return to prior screen, no repeat nag; pending/deferred purchase → "purchase pending", resolves via webhook | Paywall explains purchases need a connection | Price + period announced together; table navigable cell-by-cell ([02 §13.2](../02-user-journeys-and-information-architecture.md)) |
| Purchase success | Optimistic unlock + server entitlement refresh; `entitlements.changed` push | — | Webhook lag → "syncing your purchase" up to reconciliation window, then manual restore offer | n/a | Success announced |
| Restore purchases | Settings→Subscription→Restore; also on new-device sign-in and paywall | Nothing to restore → clear message | Store-account-mismatch guidance + support link | Requires connectivity, stated | Standard controls |
| Upgrade / downgrade | Upgrade immediate (store proration), credits re-granted per [12 §5.4](../12-pricing-entitlements-and-unit-economics.md); downgrade at period end with "until <date> you keep Plus" | — | Store errors surfaced with retry | n/a | Dates announced |
| Grace / billing retry | Payment failure → grace: features unchanged + fix-payment banner deep-linking store settings | — | Grace lapses → expiry behavior | Banner cached | Banner readable |
| Credits (Settings→Usage) | Balance + append-only history visible; exhausted-credits prompt at gated generation | Zero balance: shows next grant date + tier options | Ledger read failure → cached balance labeled stale | Cached balance shown as of last sync | History list navigable |
| Cancel / refund / expiry | Deep-link to store management; "cancelled — active until <date>"; refund webhook downgrades like expiry; data safe, export works, paid-derived assets viewable | — | Reflect store state at next webhook/reconcile | Cached status | No dark patterns: cancel path ≤ as easy as subscribe ([11 §17.8](../11-security-privacy-and-compliance.md)) |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); update each touched module's contract file.

| Module | Change | Contract update needed? |
|---|---|---|
| `billing` | Full implementation: plans + SKU map (versioned), entitlement grants/resolver, trial grant/expiry, credit ledger, billing_events, webhook projection state machine, reconciliation job, cost guardrails, paywall offering config (server-driven) | Yes — new module contract |
| `shared-kernel` | Entitlement-name registry finalized (15 names, [12 §3.1](../12-pricing-entitlements-and-unit-economics.md)); `ENTITLEMENT_REQUIRED` error code; ledger entry types | Yes (single-writer) |
| `platform` | RevenueCat SDK wrapper (webhook verify, REST refetch) behind `SubscriptionProviderPort`; no domain import of RevenueCat SDK | Yes |
| `closet` / `recommendation` / `media` / `outfit` / `fashion-intel` | No code refactoring — existing seam checks flip from trial-grant-always-Pro to real resolved entitlements; closet adds over-cap read-only candidate rule ([12 §3.4](../12-pricing-entitlements-and-unit-economics.md)) | closet: yes (over-cap rule); others: no |
| `identity` | Signup flow calls billing trial-grant service (transactional) | Yes (small) |
| `notifications` | Trial T-24h reminder + plan-updated push categories | Yes (small) |
| `admin` | Billing panel: subscription/entitlement state per user, reconcile-now, credit adjustments (audited) | Yes |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`): `GET /me/entitlements` (etag/short-TTL), `GET /me/subscription`, `GET /me/credits` + `GET /me/credits/history`, `GET /paywall/offerings` (server-driven experiment config), `POST /webhooks/revenuecat` (signed), admin: `GET /admin/users/:id/billing`, `POST /admin/users/:id/billing/reconcile`, `POST /admin/users/:id/credits/adjust` (audited). Typed error `ENTITLEMENT_REQUIRED` added to the shared error envelope.
- Event schemas added/changed: `billing.entitlement.changed.v1`, `billing.trial.granted.v1`, `billing.trial.expired.v1`, `billing.credits.granted.v1` / `consumed.v1` / `refunded.v1` / `expired.v1`, `billing.reconciliation.completed.v1`.
- DB migrations (Drizzle): `plans` (plan_version, entitlement payloads), `sku_map` (versioned), `entitlement_grants` (source: plan|trial|promo|grandfather, payloads, expires_at), `billing_events` (raw immutable, unique on RevenueCat event id), `subscription_state` (per store subscription, state machine of [12 §5.3](../12-pricing-entitlements-and-unit-economics.md)), `credit_ledger` (append-only per [12 §4.2](../12-pricing-entitlements-and-unit-economics.md), unique idempotency_key; pre-created by the P11 shadow seam if that landed — finalized here, never duplicated) + `usage_meters`. Forward + rollback plan per doc 06; ledger and billing_events are append-only (rollback = contract-phase only, never row deletion).
- Generated clients to regenerate: TS mobile client, admin client, worker models (`just generate`).

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | RevenueCat SDK integration; paywall screens + contextual triggers; trial pill + recap; Settings→Subscription + Usage/credits; restore flows; pending-purchase states; entitlement cache (etag/TTL) with fail-closed premium rendering |
| Backend | `billing` module per §6; enforcement activation at the [12 §3.3](../12-pricing-entitlements-and-unit-economics.md) points; webhook handler; identity signup hook; notifications categories |
| Workers (ML/media) | Generation jobs: entitlement double-check before spend + ledger consume/refund calls (already seamed in P11 — verify + activate) |
| Data / migrations | Tables per §7; staging test accounts per tier + mid-trial + expired-trial ([15 §11](../15-team-workflow-and-ai-agent-operations.md)) |
| Infrastructure | RevenueCat project/products/offerings (6 subscription SKUs + 2 consumable top-up SKUs if the stretch lands, both stores); store sandbox products + testers; webhook endpoint + secret in sops; pg-boss cron schedules: trial-expiry sweep, credit period grant/expire, nightly reconciliation |
| 3D / assets | None |
| Admin / internal tools | Billing panel + reconcile-now + audited credit adjustment; experiment-assignment lookup for support |

## 9. AI vs deterministic decisions

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Entitlement checks, resolver, trial, ledger, webhooks, reconciliation | **Deterministic forever** ([10 §1 #19](../10-ai-usage-cost-and-evaluation.md)) | Money and access control must be exact, auditable, replayable | n/a | $0 marginal |
| Per-plan AI cost guardrails | Deterministic metering over `ai.cost_usd` metrics; caps per [10 §6.1](../10-ai-usage-cost-and-evaluation.md) | Arithmetic over recorded spend | Global cap + kill-switch ladder | n/a (it is the budget) |
| Paywall copy/layout experiments | Deterministic flag assignment (PostHog) | Experimentation infra, no inference | Default offering | $0 |

No new AI calls in this phase.

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11 §6](../11-security-privacy-and-compliance.md)): subscription state, plan, credit balance/history = **S2**; RevenueCat webhook payloads/subscriber ids = S2 (stored in `billing_events`); no S3.
- Consent required / consent UI changes: none new; billing notifications ride the existing `notifications` opt-in; purchase data flows to RevenueCat under its DPA — per-integration disclosure updated ([11 §7.3](../11-security-privacy-and-compliance.md)); LR-08 review item filed.
- Retention, deletion, and export impact: deletion cascade extends to RevenueCat subscriber deletion (step 2 of [11 §13.2](../11-security-privacy-and-compliance.md)); financial records required by tax law are retained (documented); export includes subscription/credit history; export verified working on Free and expired accounts (AC-12).
- Threat/abuse cases added to the threat model: entitlement tampering, webhook forgery/replay, refund-then-keep-credits, trial recycling, denial-of-wallet ([11 §3.4, §3.6](../11-security-privacy-and-compliance.md)) — each mapped to a security test (§14); admin credit adjustment is audited and role-gated.

## 11. Observability and analytics added in this phase

Per [14 §15](../14-observability-operations-and-analytics.md) P13 row.

- Logs/metrics/traces: `billing.webhook.lag`, `billing.reconciliation.drift` (alert on sustained > 0; target < 0.1 % of subscribers per [12 §5.2](../12-pricing-entitlements-and-unit-economics.md)), `billing.credits.consumed{op}`, entitlement-check denial counts by entitlement, `ai.cost_per_active_user` per-plan guardrail breach alerts ([10 §6.2](../10-ai-usage-cost-and-evaluation.md)), trial funnel counters.
- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `paywall_viewed` (`surface`, `trial_state`), `subscription_started` / `subscription_restored` (`plan`, `period`), `credits_exhausted_prompt_shown` (`op`); trial→paid funnel built on these ("baseline first", [12 §7.6](../12-pricing-entitlements-and-unit-economics.md)).
- Alerts/dashboards/runbook entries: Billing dashboard (Grafana set #5); SEV1 on entitlement grants failing globally; SEV2 on reconciliation drift / webhook processing failures; runbook 8 (reconciliation-drift investigation) written; entitlement changes + manual overrides in the audit trail ([14 §10](../14-observability-operations-and-analytics.md)).

## 12. Ordered tasks

Small enough for one AI-assisted session each. Task IDs `P13-T##`.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P13-T01 | **Store-compliance spike (gate):** review every `[VERIFY-P13]` item of [12 §2/§5](../12-pricing-entitlements-and-unit-economics.md) against current Apple/Play guidelines, RevenueCat config dry run, checklist with per-item verdict **labeled for qualified review**; decide submission variant (OQ-02) + Small Business enrollment (BIL-O6); log DEC | — | 2 (human-led review) |
| P13-T02 | Contracts + shared-kernel: entitlement registry, endpoints, events, `ENTITLEMENT_REQUIRED`; `just generate` | T01 | 1 |
| P13-T03 | Migrations: all §7 tables + staging tier test accounts | T02 | 1 |
| P13-T04 | Entitlement resolver + grants model + `GET /me/entitlements` (etag) | T03 | 1 |
| P13-T05 | Trial: signup grant (transactional with identity), expiry sweep job, resolver integration | T04 | 1 |
| P13-T06 | Enforcement activation: wire resolver into every [12 §3.3](../12-pricing-entitlements-and-unit-economics.md) point; closet over-cap read-only rule; verify zero feature-code refactoring beyond the seam | T04 | 2 |
| P13-T07 | Credit ledger: grant/consume/expire/refund, `SELECT … FOR UPDATE` consume in job-acceptance transaction, idempotency_key = job_id; worker double-check + refund path | T04 | 2 |
| P13-T08 | RevenueCat infra: products/offerings (6 subscription SKUs + 2 top-up consumables if stretch, both stores), sandbox testers, SDK on mobile, purchase + restore flows | T02 | 2 |
| P13-T09 | Webhook handler: signature verify → `billing_events` idempotent upsert → subscription state machine → grant recompute → outbox `entitlements.changed`; out-of-order handling + REST refetch | T04, T08 | 2 |
| P13-T10 | Reconciliation job (nightly + on-demand) + drift metric/alert + admin reconcile-now | T09 | 1 |
| P13-T11 | Lifecycle: grace/retry/cancel/refund/upgrade/downgrade outcomes per [12 §5.4](../12-pricing-entitlements-and-unit-economics.md) table; credits on plan change; plan versioning + grandfather grants | T09 | 2 |
| P13-T12 | Mobile: contextual paywalls + trial pill/recap + Settings Subscription/Usage + restore + pending states (all §5 states) | T02, T06, T08 | 3 |
| P13-T13 | Expiry behavior verification: downgrade deletes nothing, over-cap read-only, export on Free/expired, paid-derived assets viewable with provenance | T06, T11 | 1 |
| P13-T14 | Experiments: server-driven offering config, PostHog flag assignment (real SKUs only, logged for support); guardrail: experiment schema cannot touch entitlement enforcement | T12 | 1 |
| P13-T15 | Per-plan AI cost guardrails live ([10 §6.1–6.2](../10-ai-usage-cost-and-evaluation.md)) + billing dashboard + runbook 8 + audit wiring | T07, T10 | 1 |
| P13-T16 | Security suite: webhook replay/forgery, entitlement-tamper 403s, credit double-spend, trial-recycle heuristics | T09, T07 | 1 |
| P13-T17 | Store-sandbox E2E on both platforms (purchase, restore-on-new-device, monthly↔annual, upgrade/downgrade, refund via sandbox) + admin panel + demo + docs + PROGRESS | all | 2 |

## 13. Parallelization

- Can run in parallel: **{T05, T07}** after T04 (trial code vs ledger — disjoint internal files); **{T08}** (RevenueCat infra + mobile SDK) alongside T04–T07 (server work); **{T12}** UI against generated client while T09–T11 land; **{T15, T16}** after their deps, disjoint from T12.
- Must be serial: T01 gates all (compliance verdict shapes SKUs and paywall copy); T02 (contracts/shared-kernel single-writer, lands first); T03 before persistence work; T09 → T10 → T11 (webhook machine before reconciliation before lifecycle edge cases); T06 is single-writer across many modules' seam call-sites — do not parallelize with other cross-module work; T17 last.

## 14. Test-first plan (by module and level)

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `billing` | Resolver most-generous-wins; trial expiry; state-machine transitions; lifecycle outcome table ([12 §5.4](../12-pricing-entitlements-and-unit-economics.md)) each row | Ledger invariants: balance = Σ entries, never negative, oldest-expiring consumed first; any interleaving of grant/consume/expire preserves invariants (fast-check) | RevenueCat webhook payloads (recorded fixtures per event type); endpoint schemas vs `packages/contracts` | Webhook replay = no-op; out-of-order events converge; reconciliation repairs injected drift; consume atomic with job accept (Testcontainers) | Store-sandbox purchase/restore/up/downgrade on real iOS + Android builds (NFR-TST-050 journey) |
| `closet`/`media`/`outfit`/`recommendation`/`fashion-intel` | Seam checks respond to resolved entitlements (409/403 + upsell code) | — | `ENTITLEMENT_REQUIRED` error envelope | Direct API call without entitlement → 403 regardless of client state; over-cap read-only rule | Free-tier journey: browse closet, 1 rec/day, export |
| `identity` | Signup+grant transactionality | — | — | Signup rollback if grant fails | — |
| Security (`*.sec.test.ts`) | — | — | — | Webhook forgery rejected; replay exactly-once; entitlement tamper; credit double-spend; deletion incl. RevenueCat step | — |
| Mobile `features/billing` | Paywall/pill/recap components; pending-purchase state machine | — | Generated client only | MSW flows for grace/expiry/restore errors | Maestro purchase+restore (sandbox); golden snapshots of paywall/recap states |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Webhook processing p95 ≤ 5 s ([13 §12.2](../13-testing-quality-and-performance.md)); entitlement check adds ≤ 10 ms p95 to gated endpoints; `GET /me/entitlements` p95 ≤ 250 ms | API/webhook metrics; before/after latency on one gated endpoint |
| Cost | Cost-to-serve per tier tracked vs [12 §7.2](../12-pricing-entitlements-and-unit-economics.md) (typical: Free $0.05 / Ess $0.20 / Plus $0.62 / Pro $2.20); per-plan caps + global cap live per [10 §6.1](../10-ai-usage-cost-and-evaluation.md) | `ai.cost_per_active_user` per plan; provider-bill reconciliation weekly |
| AI quality | n/a (no AI in phase) | — |
| Reliability | Reconciliation drift < 0.1 % of subscribers, sustained 0 target; restore success ≥ 99 % (hypothesis, [00 §8.3](../00-product-vision-and-scope.md)); zero double-charged credits ever | drift gauge + alert; restore funnel; ledger audit query |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): `entitlement-enforcement` (the P03/P06-registered seam flag, flipped **on** here — master switch from trial-Pro-for-all to real resolution; owner BE; expiry extended to launch + 90 d), `paywall-offering-<experiment>` (per-experiment, ≤ 90 d each, owner PO), `trial-reminder-notification` (owner PO, ≤ 90 d). Flags gate rollout only — they are never the entitlement mechanism ([14 §11](../14-observability-operations-and-analytics.md)).
- Migration/backward-compatibility plan: pre-P13 users (internal/beta) hold implicit trial-Pro; activation grants them an explicit dated trial or promo grant so no one silently loses access mid-session; all schema additive; SKU map versioned from day one (`*.v1`) so future repackaging is additive (REQ-BIL-110).
- Rollback plan: (1) `entitlement-enforcement` off → everyone resolves to trial-Pro behavior again (no purchases lost — grants persist); (2) webhook endpoint can be paused — events replay from RevenueCat + `billing_events` on resume (idempotent); (3) DB rollback contract-phase only (append-only tables never dropped with data); (4) store products can be removed from sale without app changes (server-driven offerings). Exact revert: flip flag, disable expiry sweep task, announce in PROGRESS.

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); add phase-local ones there, not here.

- Risks in play: **RISK-04** (store approval of trial/paywall model — primary), RISK-08 (AI cost vs anchors, checked at P13 per register), RISK-11 (RevenueCat vendor risk — entitlement truth is our table), ASM-05, ASM-09 (closed 2026-09-13 per DEC-48); OQ-01, OQ-02, OQ-09; LR-08.
- **Stop/kill criteria for this phase:**
  - T01 compliance review or store rejection finds a written policy conflict with the server-granted trial → **switch to store-managed intro-offer variant** (RevenueCat supports both; fallback per RISK-04), log DEC; pricing copy never promises the non-compliant variant.
  - Reconciliation drift alert fires persistently (> 0.1 % for 3 consecutive days) in beta → halt paid rollout (`entitlement-enforcement` stays limited to internal) until root-caused.
  - Any security-suite failure in webhook replay/entitlement tamper/double-spend → release-blocking defect; phase cannot reach `DONE`.
  - Measured cost/user > 2× SPINE §6 anchors for a month (RISK-08) → freeze new AI features, run doc 10 cost-reduction playbook before further rollout.

## 18. Demo script

Staging + store sandboxes, real iOS and Android devices, seeded tier accounts:

1. Create a fresh account → show server-side Pro entitlements with `expires_at` = signup + 72 h (`GET /me/entitlements`), trial pill in UI, no payment sheet anywhere.
2. Fast-forward trial expiry (staging sweep with test clock) → app shows recap once → Free Today tab still functional: browse closet, get the 1 daily basic recommendation, run a full data export.
3. On Free, capture item #41 → 409 + contextual paywall naming the closet cap; call the API directly with a tampered client claiming Pro → 403 `ENTITLEMENT_REQUIRED`.
4. Purchase Plus monthly via sandbox on iOS → webhook arrives → entitlements update → G2 try-on unlocks; generate a try-on → credit balance decrements atomically; show ledger entry with `idempotency_key = job_id`; replay the same webhook via admin tool → zero state change.
5. Restore on the second (Android) device via Restore purchases → Plus active there.
6. Upgrade Plus→Pro in sandbox → immediate entitlement change + credit re-grant per [12 §5.4](../12-pricing-entitlements-and-unit-economics.md); then cancel → "active until <date>"; sandbox-expire → Free with all data intact and prior try-on images still viewable with provenance badges.
7. Inject entitlement drift in staging DB → run reconcile-now from admin → drift repaired + `billing.reconciliation.drift` metric and audit entry shown.
8. Show billing dashboard (webhook lag, drift=0, credits, paywall funnel) and the completed compliance checklist with reviewer labels.

## 19. Acceptance criteria

Objectively verifiable statements — no "works well".

- AC-1: A new account holds Pro-payload entitlement grants with server-side `expires_at` = signup + 72 h, `source = trial_grant`; no payment UI is reachable before opt-in (UI test + API assertion).
- AC-2: The expiry sweep downgrades a past-expiry trial account to Free on its next resolution; the Free account demonstrably browses closet, receives 1 basic recommendation/day (2nd request → 403/paywall), and completes export.
- AC-3: Plans table matches [SPINE §6](../SPINE.md) exactly (payload diff test against the registry); every price string in app copy and store metadata carries the hypothesis label until validated (copy audit checklist).
- AC-4: For each enforcement point in [12 §3.3](../12-pricing-entitlements-and-unit-economics.md), a direct API call without the entitlement returns 403/409 with `ENTITLEMENT_REQUIRED` regardless of client state (generated authZ-matrix test); no gated feature's code changed beyond its pre-existing seam call (diff review evidence).
- AC-5: Sandbox purchase (monthly and annual), monthly↔annual switch, and restore-on-new-device succeed on both iOS and Android test builds (Maestro/store-sandbox evidence).
- AC-6: Every lifecycle event in the [12 §5.4](../12-pricing-entitlements-and-unit-economics.md) outcome table has a webhook-driven test asserting its entitlement outcome; family-sharing decision (not in v1) recorded as DEC.
- AC-7: The compliance checklist covers every `[VERIFY-P13]` item with a verdict and a named qualified-review label; unresolved conflicts have a decided fallback (OQ-02 closed by DEC). Final store sign-off completes in P14 (REQ-BIL-070).
- AC-8: Replaying any recorded webhook produces zero state change (test); nightly reconciliation repairs injected drift and raises the drift alert (test + staging demo); webhook forgery/tamper tests pass.
- AC-9: Credit grants match SPINE §6 per tier (0 / 10 / 60 / 150; trial 15); **consume debits the task weight from `credits.weights` (try-on 3, missing view 1) and rejects a job whose weight exceeds the balance** (test); capture/recommendation/browsing consume zero credits (test); consume is atomic with job acceptance and double-delivery cannot double-charge (idempotency test); failed jobs refund the full weight.
- AC-9b: Store fee assumptions in doc 12 §7 re-verified against live Apple SBP / Google Play policy and recorded — Google Play 15% for auto-renewing subscriptions (10% service + 5% billing fee in the EEA/UK/US program from 2026-06-30; 15% elsewhere), verified 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)); base case 15% unchanged; BIL-O7 resolved 2026-09-13 but re-verified at P13 kickoff; provider prices re-verified against r6 at phase kickoff (AIC-O6).
- AC-10: Per-capability cost tables exist in doc 12/10 (as-of dated); per-plan soft/hard caps from [10 §6.1](../10-ai-usage-cost-and-evaluation.md) are enforced in staging (breach test triggers alert + degrade).
- AC-11: Plans carry versions; a simulated repackaging keeps an existing subscriber's payloads via `grandfather_grant` (test); experiment config schema contains no entitlement-enforcement fields (schema test) and hard-constraint stages remain un-experimentable (REQ-REC-170 check re-run).
- AC-12: Downgrade/expiry deletes nothing (row-count + media assertion), over-cap items are read-only but visible/searchable/exportable, export succeeds on Free and expired accounts, paid-derived assets remain viewable with provenance.
- AC-13: Turning `entitlement-enforcement` off restores pre-P13 behavior with zero code deploy (staging demo).

## 20. Definition of done

Exact commands and evidence required:

```bash
just test billing            # all pass, no skips
just test closet && just test recommendation && just test media   # seam activation
just test identity
just lint && just typecheck  # clean
just arch-check              # boundaries hold (no RevenueCat SDK outside platform)
just generate --check        # contracts fresh
just security-scan           # clean
just ci-parity               # green
# phase-specific: store-sandbox E2E evidence on both platforms; webhook replay
# suite output; reconciliation drift-repair test output; db migrate up/down proof
```

Evidence to attach/link: sandbox purchase/restore recordings (both platforms); webhook idempotency + reconciliation test output; ledger audit query output; compliance checklist with review labels; dashboard screenshots; demo recording per §18. Never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: new `docs/modules/billing.md` contract; `shared-kernel` registry docs; doc 12 (fill measured baselines placeholder §7.6 note, close BIL-O1/O2/O6, record `[VERIFY-P13]` outcomes); doc 16 (DEC for OQ-01/OQ-02/OQ-09 + RISK-04 outcome; update ASM-05/ASM-09); doc 11 per-integration disclosure + LR-08 status; doc 14 runbook 8; identity/closet contracts touched.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence.

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md). Expected content: next phase is **P14 — Hardening and launch** (`phases/P14-hardening-and-launch.md`, start at P14-T01; first command: `just doctor` then `just ci-parity`). Hand P14: the compliance checklist (needs final store sign-off, REQ-BIL-070/AC-7), the billing security suites now in the release gate (NFR-SEC-100), staging tier accounts, and any open `[VERIFY-P13]` items awaiting qualified review — these are P14 launch blockers, list them explicitly.
