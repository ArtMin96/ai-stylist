# 12 — Pricing, Entitlements & Unit Economics

**Status:** Draft for ratification · **Date:** 2026-08-24 · **Amended:** 2026-09-09 (weighted credits, top-up packs, §7 recomputed on verified prices — [r6](research/r6-pricing-verification-2026-09-09.md), DEC-34/35) · **Amended:** 2026-09-13 ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — infra envelope, pg-boss priority, BIL-O3/BIL-O7) · **Owner:** Billing/monetization (`billing` module)
**Conforms to:** [SPINE.md](SPINE.md) §6 (tiers/prices/credits are fixed there — this doc elaborates, never changes them), §3 (modules), §5 (P13 delivers billing)
**Evidence:** [research/r6-pricing-verification-2026-09-09.md](research/r6-pricing-verification-2026-09-09.md) (all prices, store fees, infra envelope, market benchmarks — verified 2026-09-09), [research/r4-backend-providers.md](research/r4-backend-providers.md) (provider landscape), [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md) via [10-ai-usage-cost-and-evaluation.md](10-ai-usage-cost-and-evaluation.md) §5 — **all AI cost numbers in this doc are imported from doc 10 §5 and are not restated as new facts.**

> **PRICING HYPOTHESIS notice (binding, brief §2.10):** every price, tier boundary, credit quantity, and conversion assumption in this document is a **hypothesis requiring market research and store-region testing** before being treated as validated. Nothing here is market-validated. Store-compliance statements are engineering readings of Apple/Google policy and carry a `[VERIFY-P13]` tag where qualified review is required.

---

## 1. Tier structure & value narrative

### 1.1 Tiers (SPINE §6, PRICING HYPOTHESIS)

| Plan | Monthly | Annual | Annual = monthly-equivalent | Positioning in one line |
|---|---|---|---|---|
| **Free** | $0 | — | — | A genuinely useful digital closet + one grounded recommendation a day; the habit loop, not a crippleware demo |
| **Essentials** | $4.99 | $39.99 | $3.33/mo (−33%) | "My whole closet, unlimited daily styling" — removes the two Free ceilings people hit first (items, recs/day); 10 credits for missing views |
| **Plus** | $9.99 | $79.99 | $6.67/mo (−33%) | "See it on me" — generative photo try-on, missing views, planning ahead, personalized trends |
| **Pro** | $19.99 | $149.99 | $12.50/mo (−37%) | "Power styling" — 2.5× credits, priority processing, exports, early features, future stylist chat |
| **Top-up packs** (consumable IAP, paid tiers only) | 30 credits $4.99 · 100 credits $12.99 | — | — | Heavy users buy their own generations instead of the cap subsidising them (§4.2) — **P13 stretch, otherwise v1.1** |

**Trial:** 3-day full access at **Pro** level from signup, server-granted, no card required (§2). Trial credits: 15 (= 5 try-ons) — enough to experience G2, bounded at ≈ $0.41 provider cost per signup.

**Market context ([r6](research/r6-pricing-verification-2026-09-09.md) §4):** competitors cluster at $7.99–12.99/mo and $49.99–89.99/yr with ~100-item free tiers; Adapty 2026 median $12.99/mo, weekly plans ≈ 55% of category revenue. Our Plus sits in the cluster; Free's 40-item cap is stricter than market — both are P13 experiments (§1.3).

### 1.2 Full feature matrix

Rows name the controlling entitlement (§3); values are the entitlement payloads.

| Capability (entitlement) | Free | Essentials | Plus | Pro |
|---|---|---|---|---|
| Closet size — `closet.max_items` | 40 | 500 | unlimited | unlimited |
| Recommendations/day — `recs.daily_limit` | 1 | unlimited | unlimited | unlimited |
| Context richness — `recs.context.full` | basic (today's weather, manual occasion) | full (hourly, holidays, all occasion types) | full | full |
| Future-day planning — `recs.future_planning` | — | — | ✓ | ✓ |
| Avatar — `avatar.level` | A1 | A1 + all poses | A1 + all poses | A1 + all poses |
| Outfit view — `tryon.generative` (G-ladder) | G0 collage | G0 | **G2 photo try-on** | G2 |
| Missing-view synthesis — `views.missing_view` | — | ✓ | ✓ | ✓ |
| Generative credits/mo — `credits.monthly` (**weighted: try-on = 3, missing view = 1**) | 0 | 10 (= 10 views) | 60 (= 20 try-ons) | 150 (= 50 try-ons) |
| Credit top-up packs — `credits.topup` | — | ✓ | ✓ | ✓ |
| Trends feed — `trends.level` | — | basic | personalized | personalized |
| Wardrobe analytics — `analytics.wardrobe` | — | — | ✓ | ✓ |
| Priority processing — `processing.priority` | — | — | — | ✓ |
| Multi-angle exports — `export.multi_angle` | — | — | — | ✓ |
| Early features — `features.early_access` | — | — | — | ✓ |
| Future stylist chat — `chat.stylist` (P15) | — | — | — | ✓ |
| Data export — `data.export` | ✓ always | ✓ | ✓ | ✓ |

Never gated, on any plan: capture and manual organization within the item cap, availability/laundry state, wear history, search/filter, settings, consent/deletion/export flows. **Normal daily recommendations are never credit-metered** (§4.3) — metering is only for genuinely expensive generative work (brief §2.10 "not punitive").

### 1.3 Value-boundary rationale (hypotheses to test)

- **Free→Essentials** monetizes *scale + frequency* (closet > 40 items, > 1 rec/day) — the first walls an engaged user hits, both zero-marginal-cost to serve (doc 10 §1: recs are deterministic), so Free stays genuinely useful without cost risk. Essentials' 10 credits buy missing views only (cheap, ≈ $0.013 each) so the credit concept is learned before the try-on upsell.
- **Essentials→Plus** monetizes the *wow capability* (G2 try-on, missing views) — exactly the features with real marginal cost, aligned to credits.
- **Plus→Pro** monetizes *intensity and priority* (150 credits = 50 try-ons, priority queue, exports, chat later). Pro is also the trial tier, so day-1 users see the ceiling product. Beyond the cap, top-up packs price a try-on at ≈ $0.50 retail vs ≈ $0.08 cost.
- Experiments to run before/at P13 (§5.8): price points per store region, 10/60/150 credit quantities and the 3:1 weight, Free cap 40 vs 100 items, a weekly Plus SKU ($3.99/wk hypothesis), annual discount depth, trial length 3 vs 7 days, top-up pack sizes.

---

## 2. Trial mechanics

**Design (SPINE §1, §6):** at account creation, `billing` grants a **server-side trial entitlement**: Pro-level payloads **except `credits.monthly` = 15 for the 72h window** (5 try-ons — bounds provider cost at ≈ $0.41/signup), `expires_at = signup + 72h`, `source = trial_grant`. No card, no store transaction, no store dependency.

- **Why server-granted:** works identically on iOS/Android/web-signup; no store intro-offer eligibility rules; we control timing and UX; one per person (abuse limits: one trial per verified account identity; device+identity heuristics in doc 11 abuse cases).
- **Expiry:** at `expires_at`, the entitlement resolver (§3.3) simply stops seeing the trial grant → user resolves to **Free**. No destructive action occurs: data, photos, generated assets all retained (§6). In-app: expiry countdown from T-24h, post-expiry paywall shows what was lost (e.g. "your 37 try-ons are kept — Plus reactivates try-on").
- **Win-back path:** post-expiry sequence (push + in-app, consented): D0 paywall, D3 "styling recap" with value evidence, D14 seasonal hook. A single **one-time 24h Pro re-taste** grant is a supported experiment lever (server grant, flagged).
- **Coexistence with store intro offers `[VERIFY-P13]`:** the server trial is *not* a store offer, so store intro-offer eligibility remains unused; we may additionally attach store-side intro pricing (e.g. first-month discount) later. Compliance readings to verify with current store policy in P13: (a) subscriptions must be purchasable via IAP — ours are (RevenueCat → StoreKit2/Play Billing); (b) a server-side free trial that never charges is not a "subscription offer" requiring store mechanics; (c) paywall must not reference external purchase paths except where regional rulings allow; (d) price display localization per store region. Each is an item in P13's compliance checklist, labeled for qualified review.

---

## 3. Entitlement model

### 3.1 Named entitlements (canonical registry in `shared-kernel`)

The strings in §1.2 (`closet.max_items`, `recs.daily_limit`, `recs.context.full`, `recs.future_planning`, `avatar.level`, `tryon.generative`, `views.missing_view`, `credits.monthly`, `credits.topup`, `credits.weights`, `trends.level`, `analytics.wardrobe`, `processing.priority`, `export.multi_angle`, `features.early_access`, `chat.stylist`, `data.export`) are the **only** entitlement identifiers (17 as of 2026-09-09; `credits.weights` is a versioned map `{tryon: 3, missing_view: 1}` carried on the plan, not a per-user grant). They live in `shared-kernel` (SPINE §3) as a versioned registry; mobile, backend, workers, and admin import them — never copy them. Payload types: boolean, integer limit, or enum level.

### 3.2 Source of truth

`billing.entitlements` table (server) is the single source of truth (SPINE §2). A user's effective entitlements = **resolution** over active grants: `plan_grant` (from subscription state) ∪ `trial_grant` ∪ `promo_grant` ∪ `grandfather_grant`, most-generous-wins per entitlement. RevenueCat is an *input* (webhooks + reconciliation, §5), never the authority the app reads at request time.

### 3.3 Enforcement points — **server-side, not UI flags**

| Entitlement | Enforced at |
|---|---|
| `closet.max_items` | `closet` application service on item create (409 + upsell code); capture UI shows remaining count (advisory only) |
| `recs.daily_limit` | `recommendation` service per request (server counts, per user per local day) |
| `tryon.generative`, `views.missing_view` | job enqueue in `media`/`outfit` services — worker double-checks before spending money |
| `credits.monthly`, `credits.topup` | credit ledger consume (§4) of the task weight (`credits.weights`) inside the same transaction as job acceptance |
| `processing.priority` | pg-boss job priority set on enqueue |
| `recs.*`, `trends.level`, `analytics.wardrobe`, `export.*`, `chat.stylist` | owning application service per call |

Mobile caches the resolved entitlement set (with `etag`/short TTL) for **rendering** paywalls and hiding buttons; every mutating or costly request is re-checked server-side. A UI that fails to hide a button must still be safe: the server returns a typed `ENTITLEMENT_REQUIRED` error the client renders as a contextual paywall.

### 3.4 Downgrade handling on limits

Downgrade below current usage (e.g. 300 items on Free's 40-cap) never deletes data: items over the cap become **read-only** (visible, searchable, exportable; excluded from new recommendations candidate pool beyond the cap by deterministic rule: most-recently-worn first). Documented user-facing rule; see §6.

---

## 4. Metering: generative-credit ledger

### 4.1 What is metered vs never metered

| Metered (weighted) | Never metered |
|---|---|
| G2 try-on image — **3 credits** (doc 10 §2.5; ≈ $0.0825 provider cost) | Daily recommendations (deterministic, ~$0) |
| Missing-view synthesis image — **1 credit** (doc 10 §2.4; ≈ $0.013) | Capture pipeline: segmentation/classification/embeddings |
| Priority re-processing of an item at Pro — weight of whatever it regenerates | Explanations, trends feed, avatar rendering, search |

Provider cost per credit: **≈ $0.0275 blended** (try-on $0.0825 ÷ 3; missing view $0.013 ÷ 1), worst ≈ $0.044 (doc 10 §5.2). Weights live in the entitlement registry (`credits.weights = {tryon: 3, missing_view: 1}`) and are versioned with `plan_version` so a P11 outcome (cheaper FLUX 2 LoRA passing eval) can relax them without a schema change.

### 4.2 Ledger design (`billing.usage_meters` + `billing.credit_ledger`)

Append-only ledger; balance is a materialized sum. Entry: `{id, user_id, type: grant|consume|expire|refund|topup, amount, reason, job_id?, entitlement_source, idempotency_key, created_at, expires_at?}`.

- **Grant:** on billing-period start (aligned to subscription renewal date), grant `credits.monthly` with `expires_at` = period end. **No rollover** (v1; rollover is a pricing experiment lever, not a promise).
- **Consume:** the task's weight (3 try-on / 1 missing view) per generated image, written in the same transaction that accepts the generation job; a job is rejected up-front if balance < weight; `idempotency_key = job_id` so retries/duplicate webhooks can never double-charge. Job failure or discarded output → compensating `refund` entry (doc 10 §2.4–2.5 rules).
- **Expire:** period-end job writes `expire` entries for unused grant remainder; deterministic, auditable.
- **Top-up packs:** consumable IAP SKUs **30 credits $4.99** and **100 credits $12.99** (`type: topup`; no expiry or 90-day — decide at P13). Purchasable on any paid tier; consumed after monthly grant credits. Economics: 30-pack nets ≈ $4.19 at 15% commission vs ≈ $0.83 worst-case cost (10 try-ons) → ~80% margin; 100-pack nets ≈ $10.91 vs ≈ $2.75 → ~75%. **P13 stretch goal; if cut, ships in v1.1** — the ledger already supports it. `[PRICING HYPOTHESIS]`
- **Ordering/concurrency:** consume uses `SELECT … FOR UPDATE` on the balance row (or serializable retry); balance may never go negative; oldest-expiring credits consumed first.
- Balance and history are user-visible (Settings → Usage) — predictability over surprise.

---

## 5. Billing lifecycle

### 5.1 RevenueCat integration

RevenueCat (free < $2.5k MTR, then 1% — r4 §subscriptions) fronts StoreKit 2 + Play Billing: SDK on mobile for purchase/restore UI-flow, webhooks to `billing` for state. Products: 6 subscription SKUs (3 paid tiers × monthly/annual — Free has no SKU) + 2 consumable top-up SKUs (30 / 100 credits; P13 stretch) mapped in RevenueCat offerings; SKU→plan mapping table owned by `billing`, versioned (§5.7).

### 5.2 Idempotent webhooks + reconciliation

- Webhook handler: verify signature → upsert `billing.billing_events` keyed by RevenueCat event id (**idempotency**: duplicate delivery = no-op) → project event onto subscription state machine → recompute entitlement grants → outbox event `entitlements.changed` (mobile picks up on next sync/push).
- Ordering: events can arrive out of order; state machine transitions are guarded by event timestamp + type precedence, conflicts resolved by full refetch from RevenueCat REST API.
- **Reconciliation job** (nightly + on-demand): for every user with a subscription in either system, diff RevenueCat subscriber state vs our entitlement grants; auto-heal divergence toward RevenueCat (store truth for *purchase* state) while our table stays the runtime authority; emit metric `billing.reconciliation.divergence_count` (doc 14; alert > 0.1% of subscribers).

### 5.3 Subscription state machine (per store subscription)

`trialless_purchase → active → (billing_retry → grace → expired) | (cancelled_pending → expired) | (paused[Play only] → active|expired)` plus `refunded`, `upgraded`, `downgraded_pending`. Grace period and billing retry honor store-configured windows (Apple Billing Grace Period, Play account-hold/grace) — during grace, entitlements **remain active**; during account-hold/after expiry they lapse to Free. `[VERIFY-P13]` exact store window configs.

### 5.4 User-facing flows

- **Restore purchases:** RevenueCat restore + server re-resolution; must work after reinstall/device change; E2E-tested (brief §6).
- **Upgrade (e.g. Plus→Pro):** store-native proration (Apple: immediate with proration; Play: chosen proration mode = immediate_with_time_proration). Credits: immediate re-grant to the higher tier's monthly amount minus credits already consumed this period (never negative); top-up balances are untouched by plan changes. `[VERIFY-P13]`
- **Downgrade:** takes effect at period end (store-native). Entitlements stay at the higher tier until then; §3.4 rules after.
- **Cancellation:** store-managed; we show status + expiry date, run win-back (§2), never obstruct (store policy + basic decency).
- **Refunds:** store-decided; webhook `REFUND` → revoke grants from refund time, ledger keeps history (no clawback of already-consumed credits; abuse pattern monitoring in `admin`).
- **Family sharing stance:** **not enabled in v1** — entitlements are personal (closet/body data are inherently personal; a shared subscription across family members' separate accounts is a future product question, not a toggle). Revisit post-launch. `[PRICING HYPOTHESIS]`
- **Regional availability/pricing:** launch in all storefronts where compliance allows; use Apple/Google regional price tiers seeded from USD anchors with store-suggested local equivalents; treat per-region price as an experiment dimension (§5.8). `[PRICING HYPOTHESIS + VERIFY-P13]`

### 5.5 Grandfathering & plan versioning

Plans carry `plan_version` (e.g. `plus.v1`). Price/packaging changes create `plus.v2` + new SKUs; existing subscribers stay on their SKU (store-side price preserved unless we run a store price-increase flow with its consent mechanics `[VERIFY-P13]`). Entitlement payloads for old versions are kept in the registry forever; `grandfather_grant` covers cases where a new version removes a capability old subscribers had. Clean packaging changes = new version + migration offer, never silent mutation.

### 5.6 Experiments without violating store rules

Paywall/pricing experiments via **PostHog feature flags**: vary paywall copy, layout, highlighted tier, trial-expiry messaging, and *which* pre-created store SKUs are offered. Constraints: all purchasable prices are real store SKUs (no fake prices), no dark patterns, experiment assignments logged for support. Price-point tests = distinct SKUs per arm. `[VERIFY-P13]` for store rules on regional price experimentation.

### 5.7 Ownership

`billing` owns: plans, SKU mapping, entitlements, ledger, billing_events, reconciliation. Paywall UI is mobile; paywall *decisions* (which offering) are server-driven config so experiments don't need app releases.

---

## 6. Expiry & downgrade behavior (predictable-rules contract)

Published in-app verbatim (plain-language version):

1. **Your data is never deleted by a downgrade.** Closet, photos, outfits, history, preferences, avatar — all retained; export (`data.export`) is free forever (doc 11 owns export format/flows).
2. **Paid-derived assets remain viewable.** Generated try-ons, missing views, and the A2 face you created while paid stay visible in your closet/history with their provenance badges. **Regeneration** (new try-ons, new views, re-processing) is gated by the current plan's entitlements/credits.
3. Items over a lowered `closet.max_items` cap become read-only (§3.4) — never hidden, never deleted.
4. Unused **monthly** credits expire at period end (§4.2); they have no cash value. Top-up credits follow the pack's stated expiry. A try-on costs 3 credits, a missing view 1 — shown before every generation. `[PRICING HYPOTHESIS: rollover experiment]`
5. Account deletion (any tier, incl. Free/expired) deletes everything per doc 11 — subscription status never blocks deletion.

---

## 7. Unit economics

Inputs (all verified 2026-09-09, [r6](research/r6-pricing-verification-2026-09-09.md)): AI cost/user/mo from **doc 10 §5** (light ≈ $0.02, medium ≈ $0.06, heavy ≈ $0.12–0.17 annualized, excl. credits; try-on ≈ $0.0825 and missing view ≈ $0.013 incl. retry allowance; onboarding $0.10–0.30 once). Infra: **≈ $25–45/mo at launch** (owned server ~$10–25/mo per OQ-14, R2/PostHog/Grafana free tiers — [r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003); **≈ $370–450/mo at 5k MAU → ≈ $0.08 per active user** kept as the upper-bound hypothesis until re-baselined at P02 (r4's $30–35 / $150–180 was ~2× too low). Store commission: **15% base case** (Apple Small Business Program; Google Play 15% for auto-renewing subscriptions (10% service + 5% billing fee in the EEA/UK/US program from 2026-06-30; 15% elsewhere) — verified 2026-09-13 ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)); base case 15% unchanged; 30% shown as sensitivity; Apple EU DMA structure from 2026-10-01 is 15–26% by payment route). RevenueCat: $0 under $2.5k MTR, then 1% (modeled as 1% throughout).

### 7.1 Net revenue per subscriber per month (unchanged prices)

| Plan | Gross | −15% store | −1% RC | **Net (15%)** | Net (30% case) |
|---|---|---|---|---|---|
| Essentials monthly | $4.99 | $4.24 | $0.05 | **$4.19** | $3.44 |
| Plus monthly | $9.99 | $8.49 | $0.10 | **$8.39** | $6.89 |
| Pro monthly | $19.99 | $16.99 | $0.20 | **$16.79** | $13.79 |
| Essentials annual (/mo) | $3.33 | $2.83 | $0.03 | **$2.80** | $2.30 |
| Plus annual (/mo) | $6.67 | $5.67 | $0.07 | **$5.60** | $4.60 |
| Pro annual (/mo) | $12.50 | $10.62 | $0.13 | **$10.50** | $8.62 |
| Top-up 30 credits | $4.99 | $4.24 | $0.05 | **$4.19** | $3.44 |
| Top-up 100 credits | $12.99 | $11.04 | $0.13 | **$10.91** | $8.96 |

(Apple's 30% tier drops to 15% after year 1 of a subscription anyway, so 15% is also the long-run rate under the standard program.)

### 7.2 Cost-to-serve per subscriber per month

Credits modeled at **100% utilisation, all spent on the most expensive allowed task** (doc 10 §5.5) — the cap is the guardrail, not the forecast. Expected utilisation is 30–50%.

| Component | Free | Essentials (medium user) | Plus (medium-heavy) | Pro (heavy) |
|---|---|---|---|---|
| AI steady (doc 10 §5.4/5.6) | $0.02 | $0.06 | $0.08 | $0.15 |
| Credits at cap (10 views / 20 try-ons / 50 try-ons) | $0 | $0.13 | $1.65 | $4.13 |
| Infra share (≈ $0.08/MAU at 5k) | $0.08 | $0.08 | $0.08 | $0.08 |
| **Cost-to-serve at cap** | **$0.10** | **$0.27** | **$1.81** | **$4.36** |
| Expected (40% credit utilisation) | $0.10 | $0.19 | $0.82 | $1.88 |
| Worst case (Leffa/Kontext prices, heavy AI on Haiku) | $0.15 | $0.67 | $2.43 | $5.78 |
| Optimistic (FLUX 2 LoRA passes P11) | $0.10 | $0.17 | $0.62 | $1.39 |

Onboarding adds a one-time $0.10–0.30 in month 1 plus ≈ $0.41 of trial try-ons for every signup that uses them (all tiers, incl. trial users who never convert — ≈ $0.35–0.70 per signup budgeted in §7.6).

### 7.3 Contribution margin per subscriber per month

| Plan | Net rev (15%) | Cost at cap | **Margin $ (monthly)** | Margin % of net / gross | Annual-plan margin $ | Worst-case margin (monthly) | Worst-case margin (annual) |
|---|---|---|---|---|---|---|---|
| Free | $0 | $0.10 | **−$0.10** | — | — | −$0.15 | — |
| Essentials | $4.19 | $0.27 | **$3.92** | 94% / 79% | $2.53 | $3.52 | $2.13 |
| Plus | $8.39 | $1.81 | **$6.58** | 78% / 66% | $3.79 | $5.96 | $3.17 |
| Pro | $16.79 | $4.36 | **$12.43** | 74% / 62% | $6.14 | $11.01 | **$4.72** |
| Top-up 30 | $4.19 | $0.83 | **$3.36** | 80% / 67% | — | $3.09 | — |
| Top-up 100 | $10.91 | $2.75 | **$8.16** | 75% / 63% | — | $7.24 | — |

**Headline sensitivity (brief-required):** a Pro annual subscriber who burns all 150 credits on try-ons at the worst provider price still leaves **$4.72/mo (45% of net)**; the same subscriber under the retired flat-200-credit model would have cost **$16.50** against $10.50 net — a **−$6/mo loss** (DEC-34). Exposure per Pro is bounded at 50 × $0.11 + AI + infra ≈ $5.80 by construction (doc 10 §6.1 hard caps back this up); heavier users are served by top-up packs at ~75–80% margin.

### 7.4 Break-even

Fixed monthly at launch: infra ≈ $25–45 (owned server ~$10–25/mo per OQ-14, dev-program fees amortised, R2/PostHog/Grafana free tiers — r7; EAS removed 2026-09-22) + hosted iOS CI $10–30 ≈ **$35–75/mo** (Open-Meteo Standard $29/mo is added when the weather feature goes live — not $500/mo as r4 stated). Assumed subscriber mix hypothesis 60% Essentials / 30% Plus / 10% Pro at cap costs, excluding the infra share (counted in the fixed pool): margins $4.00 / $6.66 / $12.51 → **blended ≈ $5.65/mo per paid subscriber** (monthly prices). At expected 40% utilisation the blend is ≈ $6.30.

- **Launch break-even: ≈ 13–18 paying subscribers** cover $70–100 fixed.
- **At 5k MAU** (infra ≈ $400 + free-user AI ≈ 4,850 × $0.02 ≈ $100 → ≈ $500/mo pool): break-even ≈ **89 paying subscribers ≈ 1.8% paid conversion**. At a 3% conversion hypothesis (150 paid), monthly contribution ≈ 150 × $5.65 − $500 ≈ **+$350/mo** (≈ +$445 at expected utilisation).
- **All-annual worst mix** (margins $2.61 / $3.87 / $6.22 → blended ≈ $3.35): break-even ≈ 149 paid at 5k MAU ≈ **3.0% conversion**. Shopping-category apps run a 66% annual mix (RevenueCat 2026), so the realistic blend sits between the two: ≈ $4.15 → ≈ 120 paid ≈ 2.4%. Inside the 25–40% trial-to-paid range the category reports, but with less slack than the v1 model claimed — the free-user ratio and annual discount depth are the levers to watch.

### 7.5 Sensitivity table (margin per Pro monthly subscriber)

| Scenario | Commission | Credit util. | Try-on unit cost | Margin |
|---|---|---|---|---|
| Base | 15% | 100% of 150 (50 try-ons) | $0.0825 (FASHN) | $12.43 |
| Expected utilisation | 15% | 40% | $0.0825 | $14.91 |
| FLUX 2 LoRA passes P11 | 15% | 100% | $0.023 | $15.40 |
| Expensive images | 15% | 100% | $0.11 (Leffa) | $11.01 |
| Standard commission | 30% | 100% | $0.0825 | $9.43 |
| Both worst | 30% | 100% | $0.11 | $8.01 |
| **Retired v1 model (200 flat credits, monthly)** | 15% | 100% | $0.0825 | **$0.22** |
| **Retired v1 model (200 flat credits, annual)** | 15% | 100% | $0.0825 | **−$6.08** |

Even the double-worst case holds 40% of gross. Essentials/Plus scale the same direction with smaller credit exposure.

### 7.6 LTV & funnel placeholders — **"baseline first"**

Conversion (trial→paid), retention curves, ARPU mix, and refund rates have **no honest prior** — they are instrumented in P13/P14 (PostHog events per doc 14) and this section is filled from measurement, not invented now. Category priors for sanity only (r6 §4): trial-to-paid 25.6% global median, ~30% Social & Lifestyle, ~40% Shopping; hard paywalls +21% LTV in Lifestyle. Cost-side placeholder budgeted today: trial-funnel cost ≈ $0.35–0.70/signup (onboarding AI + up to 5 trial try-ons) — at 3% conversion that is ≈ $12–23 of AI cost per acquired subscriber, i.e. 2–4 months of blended margin. **This is the number the trial-credit count (15) controls; revisit if conversion lands below 3%.** LTV target-setting deferred to first cohort data.

### 7.7 Guardrail linkage

Plan-level cost caps, alerting, and the degradation ladder that keep §7.2 true under abuse/outage live in **doc 10 §6** (single owner — not duplicated here). Billing metrics/alerts (reconciliation divergence, refund rate, credit-consumption anomalies, top-up refund abuse) are registered in doc 14.

---

## 8. Open items

| ID | Item | Owner phase |
|---|---|---|
| BIL-O1 | Store compliance verification checklist (§2, §5 `[VERIFY-P13]` items) with qualified review | P13 |
| BIL-O2 | Regional price-tier sheet + store-suggested local prices | P13 |
| BIL-O3 | Open-Meteo Standard ($29/mo, 1M calls) vs WeatherAPI Starter ($7/mo) vs Apple WeatherKit (500k free) — pick at P08 (r6 §3). P08 runs the measured comparison Open-Meteo managed vs self-hosted Open-Meteo (AGPL-3.0; ≥ 8 GB RAM/100 GB disk, continuous ingestion) vs Apple WeatherKit REST on coverage, freshness, outage behaviour, privacy, total cost; do not self-host solely to avoid $29/mo ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), DEC-48) | P08 |
| BIL-O4 | Credit top-up packs (P13 stretch → v1.1) & rollover experiments | P13 / post-launch |
| BIL-O7 | **Resolved 2026-09-13** ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), DEC-48): Google Play is 15% for auto-renewing subscriptions (10% service + 5% billing fee in the EEA/UK/US program from 2026-06-30; 15% elsewhere) — §7 base case 15% unchanged. Apple EU DMA route check remains part of the P13 price re-verification (AIC-O6) | Resolved |
| BIL-O8 | Re-run §7 with P11 shadow-credit utilisation data and the FLUX 2 LoRA gate outcome (AIC-O5); relax `credits.weights` if warranted | P11 → P13 |
| BIL-O5 | Family sharing product decision | post-launch |
| BIL-O6 | Small Business Program enrollment (Apple) / Play reduced-rate confirmation | P13 |

Requirement IDs delivered by this doc are registered in [01-requirements-and-traceability.md](01-requirements-and-traceability.md) under `BIL` / `NFR-BIL`.
