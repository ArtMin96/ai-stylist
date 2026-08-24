# 12 — Pricing, Entitlements & Unit Economics

**Status:** Draft for ratification · **Date:** 2026-08-24 · **Owner:** Billing/monetization (`billing` module)
**Conforms to:** [SPINE.md](SPINE.md) §6 (tiers/prices/credits are fixed there — this doc elaborates, never changes them), §3 (modules), §5 (P13 delivers billing)
**Evidence:** [research/r4-backend-providers.md](research/r4-backend-providers.md) (infra + RevenueCat), [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md) via [10-ai-usage-cost-and-evaluation.md](10-ai-usage-cost-and-evaluation.md) §5 — **all AI cost numbers in this doc are imported from doc 10 §5 and are not restated as new facts.**

> **PRICING HYPOTHESIS notice (binding, brief §2.10):** every price, tier boundary, credit quantity, and conversion assumption in this document is a **hypothesis requiring market research and store-region testing** before being treated as validated. Nothing here is market-validated. Store-compliance statements are engineering readings of Apple/Google policy and carry a `[VERIFY-P13]` tag where qualified review is required.

---

## 1. Tier structure & value narrative

### 1.1 Tiers (SPINE §6, PRICING HYPOTHESIS)

| Plan | Monthly | Annual | Annual = monthly-equivalent | Positioning in one line |
|---|---|---|---|---|
| **Free** | $0 | — | — | A genuinely useful digital closet + one grounded recommendation a day; the habit loop, not a crippleware demo |
| **Essentials** | $4.99 | $39.99 | $3.33/mo (−33%) | "My whole closet, unlimited daily styling" — removes the two Free ceilings people hit first (items, recs/day) |
| **Plus** | $9.99 | $79.99 | $6.67/mo (−33%) | "See it on me" — generative photo try-on, missing views, planning ahead, personalized trends |
| **Pro** | $19.99 | $149.99 | $12.50/mo (−37%) | "Power styling" — 4× credits, priority processing, exports, early features, future stylist chat |

**Trial:** 3-day full access at **Pro** level from signup, server-granted, no card required (§2).

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
| Missing-view synthesis — `views.missing_view` | — | — | ✓ | ✓ |
| Generative credits/mo — `credits.monthly` | 0 | 10 | 50 | 200 |
| Trends feed — `trends.level` | — | basic | personalized | personalized |
| Wardrobe analytics — `analytics.wardrobe` | — | — | ✓ | ✓ |
| Priority processing — `processing.priority` | — | — | — | ✓ |
| Multi-angle exports — `export.multi_angle` | — | — | — | ✓ |
| Early features — `features.early_access` | — | — | — | ✓ |
| Future stylist chat — `chat.stylist` (P15) | — | — | — | ✓ |
| Data export — `data.export` | ✓ always | ✓ | ✓ | ✓ |

Never gated, on any plan: capture and manual organization within the item cap, availability/laundry state, wear history, search/filter, settings, consent/deletion/export flows. **Normal daily recommendations are never credit-metered** (§4.3) — metering is only for genuinely expensive generative work (brief §2.10 "not punitive").

### 1.3 Value-boundary rationale (hypotheses to test)

- **Free→Essentials** monetizes *scale + frequency* (closet > 40 items, > 1 rec/day) — the first walls an engaged user hits, both zero-marginal-cost to serve (doc 10 §1: recs are deterministic), so Free stays genuinely useful without cost risk.
- **Essentials→Plus** monetizes the *wow capability* (G2 try-on, missing views) — exactly the features with real marginal cost, aligned to credits.
- **Plus→Pro** monetizes *intensity and priority* (200 credits, priority queue, exports, chat later). Pro is also the trial tier, so day-1 users see the ceiling product.
- Experiments to run before/at P13 (§5.8): price points per store region, 10/50/200 credit quantities, annual discount depth, trial length 3 vs 7 days.

---

## 2. Trial mechanics

**Design (SPINE §1, §6):** at account creation, `billing` grants a **server-side trial entitlement**: Pro-level payloads, `expires_at = signup + 72h`, `source = trial_grant`. No card, no store transaction, no store dependency.

- **Why server-granted:** works identically on iOS/Android/web-signup; no store intro-offer eligibility rules; we control timing and UX; one per person (abuse limits: one trial per verified account identity; device+identity heuristics in doc 11 abuse cases).
- **Expiry:** at `expires_at`, the entitlement resolver (§3.3) simply stops seeing the trial grant → user resolves to **Free**. No destructive action occurs: data, photos, generated assets all retained (§6). In-app: expiry countdown from T-24h, post-expiry paywall shows what was lost (e.g. "your 37 try-ons are kept — Plus reactivates try-on").
- **Win-back path:** post-expiry sequence (push + in-app, consented): D0 paywall, D3 "styling recap" with value evidence, D14 seasonal hook. A single **one-time 24h Pro re-taste** grant is a supported experiment lever (server grant, flagged).
- **Coexistence with store intro offers `[VERIFY-P13]`:** the server trial is *not* a store offer, so store intro-offer eligibility remains unused; we may additionally attach store-side intro pricing (e.g. first-month discount) later. Compliance readings to verify with current store policy in P13: (a) subscriptions must be purchasable via IAP — ours are (RevenueCat → StoreKit2/Play Billing); (b) a server-side free trial that never charges is not a "subscription offer" requiring store mechanics; (c) paywall must not reference external purchase paths except where regional rulings allow; (d) price display localization per store region. Each is an item in P13's compliance checklist, labeled for qualified review.

---

## 3. Entitlement model

### 3.1 Named entitlements (canonical registry in `shared-kernel`)

The strings in §1.2 (`closet.max_items`, `recs.daily_limit`, `recs.context.full`, `recs.future_planning`, `avatar.level`, `tryon.generative`, `views.missing_view`, `credits.monthly`, `trends.level`, `analytics.wardrobe`, `processing.priority`, `export.multi_angle`, `features.early_access`, `chat.stylist`, `data.export`) are the **only** entitlement identifiers. They live in `shared-kernel` (SPINE §3) as a versioned registry; mobile, backend, workers, and admin import them — never copy them. Payload types: boolean, integer limit, or enum level.

### 3.2 Source of truth

`billing.entitlements` table (server) is the single source of truth (SPINE §2). A user's effective entitlements = **resolution** over active grants: `plan_grant` (from subscription state) ∪ `trial_grant` ∪ `promo_grant` ∪ `grandfather_grant`, most-generous-wins per entitlement. RevenueCat is an *input* (webhooks + reconciliation, §5), never the authority the app reads at request time.

### 3.3 Enforcement points — **server-side, not UI flags**

| Entitlement | Enforced at |
|---|---|
| `closet.max_items` | `closet` application service on item create (409 + upsell code); capture UI shows remaining count (advisory only) |
| `recs.daily_limit` | `recommendation` service per request (server counts, per user per local day) |
| `tryon.generative`, `views.missing_view` | job enqueue in `media`/`outfit` services — worker double-checks before spending money |
| `credits.monthly` | credit ledger consume (§4) inside the same transaction as job acceptance |
| `processing.priority` | queue priority assignment in Trigger.dev job submit |
| `recs.*`, `trends.level`, `analytics.wardrobe`, `export.*`, `chat.stylist` | owning application service per call |

Mobile caches the resolved entitlement set (with `etag`/short TTL) for **rendering** paywalls and hiding buttons; every mutating or costly request is re-checked server-side. A UI that fails to hide a button must still be safe: the server returns a typed `ENTITLEMENT_REQUIRED` error the client renders as a contextual paywall.

### 3.4 Downgrade handling on limits

Downgrade below current usage (e.g. 300 items on Free's 40-cap) never deletes data: items over the cap become **read-only** (visible, searchable, exportable; excluded from new recommendations candidate pool beyond the cap by deterministic rule: most-recently-worn first). Documented user-facing rule; see §6.

---

## 4. Metering: generative-credit ledger

### 4.1 What is metered vs never metered

| Metered (1 credit each) | Never metered |
|---|---|
| G2 try-on image (doc 10 §2.5) | Daily recommendations (deterministic, ~$0) |
| Missing-view synthesis image (doc 10 §2.4) | Capture pipeline: segmentation/classification/embeddings |
| Priority re-processing of an item at Pro (only when it triggers regeneration) | Explanations, trends feed, avatar rendering, search |

Provider cost per credit: ~$0.01 blended, $0.025 worst (doc 10 §5.2).

### 4.2 Ledger design (`billing.usage_meters` + `billing.credit_ledger`)

Append-only ledger; balance is a materialized sum. Entry: `{id, user_id, type: grant|consume|expire|refund|topup, amount, reason, job_id?, entitlement_source, idempotency_key, created_at, expires_at?}`.

- **Grant:** on billing-period start (aligned to subscription renewal date), grant `credits.monthly` with `expires_at` = period end. **No rollover** (v1; rollover is a pricing experiment lever, not a promise).
- **Consume:** 1 per generated image, written in the same transaction that accepts the generation job; `idempotency_key = job_id` so retries/duplicate webhooks can never double-charge. Job failure or discarded output → compensating `refund` entry (doc 10 §2.4–2.5 rules).
- **Expire:** period-end job writes `expire` entries for unused grant remainder; deterministic, auditable.
- **Top-up (future option):** schema supports consumable IAP top-up packs (`type: topup`, no expiry or 90-day expiry — decide at experiment time). Not built in P13 v1; ledger design means adding it is additive only. `[PRICING HYPOTHESIS]`
- **Ordering/concurrency:** consume uses `SELECT … FOR UPDATE` on the balance row (or serializable retry); balance may never go negative; oldest-expiring credits consumed first.
- Balance and history are user-visible (Settings → Usage) — predictability over surprise.

---

## 5. Billing lifecycle

### 5.1 RevenueCat integration

RevenueCat (free < $2.5k MTR, then 1% — r4 §subscriptions) fronts StoreKit 2 + Play Billing: SDK on mobile for purchase/restore UI-flow, webhooks to `billing` for state. Products: 8 SKUs (4 paid tiers × monthly/annual — Free has no SKU) mapped in RevenueCat offerings; SKU→plan mapping table owned by `billing`, versioned (§5.7).

### 5.2 Idempotent webhooks + reconciliation

- Webhook handler: verify signature → upsert `billing.billing_events` keyed by RevenueCat event id (**idempotency**: duplicate delivery = no-op) → project event onto subscription state machine → recompute entitlement grants → outbox event `entitlements.changed` (mobile picks up on next sync/push).
- Ordering: events can arrive out of order; state machine transitions are guarded by event timestamp + type precedence, conflicts resolved by full refetch from RevenueCat REST API.
- **Reconciliation job** (nightly + on-demand): for every user with a subscription in either system, diff RevenueCat subscriber state vs our entitlement grants; auto-heal divergence toward RevenueCat (store truth for *purchase* state) while our table stays the runtime authority; emit metric `billing.reconciliation.divergence_count` (doc 14; alert > 0.1% of subscribers).

### 5.3 Subscription state machine (per store subscription)

`trialless_purchase → active → (billing_retry → grace → expired) | (cancelled_pending → expired) | (paused[Play only] → active|expired)` plus `refunded`, `upgraded`, `downgraded_pending`. Grace period and billing retry honor store-configured windows (Apple Billing Grace Period, Play account-hold/grace) — during grace, entitlements **remain active**; during account-hold/after expiry they lapse to Free. `[VERIFY-P13]` exact store window configs.

### 5.4 User-facing flows

- **Restore purchases:** RevenueCat restore + server re-resolution; must work after reinstall/device change; E2E-tested (brief §6).
- **Upgrade (e.g. Plus→Pro):** store-native proration (Apple: immediate with proration; Play: chosen proration mode = immediate_with_time_proration). Credits: immediate re-grant to the higher tier's monthly amount minus credits already consumed this period (never negative). `[VERIFY-P13]`
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
4. Unused credits expire at period end (§4.2); they have no cash value. `[PRICING HYPOTHESIS: rollover experiment]`
5. Account deletion (any tier, incl. Free/expired) deletes everything per doc 11 — subscription status never blocks deletion.

---

## 7. Unit economics

Inputs: AI cost/user/mo from **doc 10 §5** (light ≈ $0.02, medium ≈ $0.06, heavy ≈ $0.12–0.16 annualized; credits ~$0.01 blended, $0.025 worst per image; onboarding $0.10–0.30 once). Infra from r4: **$30–35/mo total at launch, ~$150–180/mo at 5k users** → ~$0.03–0.04 infra per active user at scale. Store commission: **15% base case** (Apple Small Business Program + Play's reduced rate on first $1M/yr — we qualify at launch; 30% shown as sensitivity `[VERIFY-P13]`). RevenueCat: $0 under $2.5k MTR, then 1% of tracked revenue (modeled as 1% throughout for conservatism).

### 7.1 Net revenue per subscriber per month

| Plan | Gross | −15% store | −1% RC | **Net (15%)** | Net (30% case) |
|---|---|---|---|---|---|
| Essentials monthly | $4.99 | $4.24 | $0.05 | **$4.19** | $3.44 |
| Plus monthly | $9.99 | $8.49 | $0.10 | **$8.39** | $6.89 |
| Pro monthly | $19.99 | $16.99 | $0.20 | **$16.79** | $13.79 |
| Essentials annual (/mo) | $3.33 | $2.83 | $0.03 | **$2.80** | $2.30 |
| Plus annual (/mo) | $6.67 | $5.67 | $0.07 | **$5.60** | $4.60 |
| Pro annual (/mo) | $12.50 | $10.62 | $0.13 | **$10.50** | $8.62 |

(Apple's 30% tier drops to 15% after year 1 of a subscription anyway, so 15% is also the long-run rate under the standard program.)

### 7.2 Cost-to-serve per subscriber per month (typical usage per tier)

| Component | Free | Essentials (medium user) | Plus (medium-heavy) | Pro (heavy) |
|---|---|---|---|---|
| AI steady (doc 10 §5.4/5.6) | $0.02 | $0.06 | $0.08 | $0.15 |
| Credits consumed × $0.01 (doc 10 §5.5; typical utilization: 100% / ~100% / ~100% of 10/50/200 assumed **conservatively full**) | $0 | $0.10 | $0.50 | $2.00 |
| Infra share | $0.03 | $0.04 | $0.04 | $0.05 |
| **Cost-to-serve (typical)** | **$0.05** | **$0.20** | **$0.62** | **$2.20** |
| Worst case (credits @ $0.025, heavy AI) | $0.10 | $0.45 | $1.50 | **$5.25** |

Onboarding adds a one-time $0.10–0.30 in month 1 (all tiers, incl. trial users who never convert — a real CAC-like cost of the trial funnel: ≈ $0.20 per signup, budgeted in §7.6).

### 7.3 Contribution margin per subscriber per month

| Plan | Net rev (15%) | Typical cost | **Margin $ (monthly)** | Margin % | Annual-plan margin $ | Worst-case margin (monthly) |
|---|---|---|---|---|---|---|
| Free | $0 | $0.05 | **−$0.05** | — | — | −$0.10 |
| Essentials | $4.19 | $0.20 | **$3.99** | 95% of net / 80% of gross | $2.60 | $3.74 |
| Plus | $8.39 | $0.62 | **$7.77** | 93% / 78% | $4.98 | $6.89 |
| Pro | $16.79 | $2.20 | **$14.59** | 87% / 73% | $8.30 | **$11.58** |

**Headline sensitivity (brief-required):** a heavy Pro user who burns all 200 credits costs **$2.15–$5.25/mo against $19.99 gross** — worst case still leaves **$11.58/mo contribution (58% of gross)** at 15% commission, and **$8.54/mo (43%)** even at 30% commission. The credit cap is the load-bearing guardrail: cost exposure per Pro is bounded at 200 × $0.025 + AI + infra ≈ $5.25 by construction (doc 10 §6.1 hard caps back this up).

### 7.4 Break-even

Fixed monthly at launch: infra $30–35 (r4) + hosted iOS CI $30–50 (r1/SPINE) ≈ **$60–85/mo** (Open-Meteo free tier at launch; its commercial plan — listed at $500/mo in r4, needs re-quote — is a flagged step-cost before scale: OQ below). Assumed subscriber mix hypothesis 60% Essentials / 30% Plus / 10% Pro → **blended margin ≈ $6.18/mo per paid subscriber** (monthly prices). Free-user drag: at 20 free users per paid, −$1.00/paid → **net blended ≈ $5.18**.

- **Launch break-even: ≈ 12–17 paying subscribers** cover $60–85 fixed.
- **At 5k MAU** (fixed ≈ $200–230 + free-user costs ≈ $240 at ~4,850 free × $0.05): break-even ≈ **85–95 paying subscribers ≈ 1.8% paid conversion**. At a 3% conversion hypothesis (150 paid), monthly contribution ≈ 150 × $6.18 − $470 ≈ **+$460/mo**.
- All-annual worst mix (blended ≈ $3.90): break-even ≈ 120 paid at 5k MAU ≈ 2.4% conversion. Still inside a plausible conversion range — the model is robust to the annual mix.

### 7.5 Sensitivity table (margin per Pro monthly subscriber)

| Scenario | Commission | Credit util. | Credit unit cost | Margin |
|---|---|---|---|---|
| Base | 15% | 100% of 200 | $0.01 | $14.59 |
| Expensive images | 15% | 100% | $0.025 | $11.58 |
| Standard commission | 30% | 100% | $0.01 | $11.59 |
| Both worst | 30% | 100% | $0.025 | $8.54 |

Even the double-worst case holds > 40% of gross. Essentials/Plus scale the same direction with smaller credit exposure.

### 7.6 LTV & funnel placeholders — **"baseline first"**

Conversion (trial→paid), retention curves, ARPU mix, and refund rates have **no honest prior** — they are instrumented in P13/P14 (PostHog events per doc 14) and this section is filled from measurement, not invented now. Only cost-side placeholder budgeted today: trial-funnel cost ≈ $0.20/signup (onboarding AI) — at 3% conversion that is ≈ $6.70 of AI cost per acquired subscriber, < 1 month of blended margin. LTV target-setting deferred to first cohort data.

### 7.7 Guardrail linkage

Plan-level cost caps, alerting, and the degradation ladder that keep §7.2 true under abuse/outage live in **doc 10 §6** (single owner — not duplicated here). Billing metrics/alerts (reconciliation divergence, refund rate, credit-consumption anomalies) are registered in doc 14.

---

## 8. Open items

| ID | Item | Owner phase |
|---|---|---|
| BIL-O1 | Store compliance verification checklist (§2, §5 `[VERIFY-P13]` items) with qualified review | P13 |
| BIL-O2 | Regional price-tier sheet + store-suggested local prices | P13 |
| BIL-O3 | Open-Meteo commercial-plan quote vs Tomorrow.io before scale (fixed-cost step) | P08/P14 |
| BIL-O4 | Credit top-up packs & rollover experiments | post-launch |
| BIL-O5 | Family sharing product decision | post-launch |
| BIL-O6 | Small Business Program enrollment (Apple) / Play reduced-rate confirmation | P13 |

Requirement IDs delivered by this doc are registered in [01-requirements-and-traceability.md](01-requirements-and-traceability.md) under `BIL` / `NFR-BIL`.
