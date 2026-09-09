# r6 — Provider price verification & pricing-model re-baseline (2026-09-09)

**Status:** Evidence · **Date:** 2026-09-09 · **Method:** four parallel research agents fetched live pricing pages (fal.ai model pages, Gemini/Anthropic/OpenAI/Cohere/Voyage pricing, Neon/Trigger.dev/Cloudflare/Railway/PostHog/RevenueCat/Expo/GitHub/Apple/Google pricing, competitor App Store listings, RevenueCat/Adapty subscription reports). Every figure carries a source URL and a confidence level. **Supersedes** the price pins in [r3](r3-ai-providers-costs.md), [r4](r4-backend-providers.md), [r5](r5-avatar-garment-3d.md) wherever they differ; those documents are kept as dated evidence and carry a correction banner pointing here.

**Headline:** the plan's generative try-on cost assumption ($0.003–0.01/image) was wrong by ~8×. Purpose-built try-on endpoints on fal.ai bill **$0.07–0.10 per generation**. Everything else in the cost model (per-item processing ≈ $0.002, LLM explanations ≈ $0.0003) verified within range. Consequence: the v1 credit allotments (10/50/200 flat credits) made Pro break-even monthly and loss-making on annual. The pricing model was re-baselined to **weighted credits** (SPINE §6, doc 12).

---

## 1. fal.ai (generative images) — Confidence: High unless noted

Billing model: pay-as-you-go, no monthly minimum, billed only on successful outputs; queue time and server errors are free. Free signup credits are usable only in Playground/Sandbox, **not via the API**. Enterprise/volume discounts are quote-only. Source: <https://fal.ai/pricing>, <https://fal.ai/docs/documentation/model-apis/faq>.

### 1.1 Virtual try-on (G2)

| Endpoint | Price | Unit | Per 1 MP image | Notes |
|---|---|---|---|---|
| `fal-ai/fashn/tryon/v1.6` (and v1.5) | $0.075 | per generation | **$0.075** | Purpose-built; commercial; best-documented quality. <https://fal.ai/models/fal-ai/fashn/tryon/v1.6> |
| `fal-ai/kling/v1-5/kolors-virtual-try-on` | $0.07 | per generation | $0.07 | <https://fal.ai/models/fal-ai/kling/v1-5/kolors-virtual-try-on> |
| `fal-ai/leffa/virtual-tryon` | $0.10 | per generation | $0.10 | <https://fal.ai/models/fal-ai/leffa/virtual-tryon> |
| `fal-ai/flux-2-lora-gallery/virtual-tryon` | $0.021 | per processed MP | **$0.021** | LoRA on FLUX 2; quality unproven for garment fidelity — **P11 eval candidate**. <https://fal.ai/models/fal-ai/flux-2-lora-gallery/virtual-tryon> |
| `decart/lucy2-vton/realtime` | $0.02 | per streamed second | ~$0.06–0.20 | Realtime video; not our use case. Medium confidence |
| `fal-ai/idm-vton`, `fal-ai/cat-vton` | shows $0/compute-sec | — | — | CAT-VTON research-only/non-commercial; IDM-VTON pricing ambiguous. Low confidence — do not plan on them |

### 1.2 Missing-view synthesis (image-to-image / edit)

| Endpoint | Price | Unit | Per 1 MP image |
|---|---|---|---|
| `fal-ai/flux/schnell` | $0.003 | per MP (rounded up) | **$0.003** — plan said $0.025 (wrong, 8× too high) |
| `fal-ai/flux-2` (FLUX.2 [dev]) | $0.012 | per MP | **$0.012** — supports reference-image editing; default MV pick |
| `fal-ai/flux/dev` | $0.025 | per MP | $0.025 |
| `fal-ai/flux-2-pro` | $0.03 first MP + $0.015/extra MP | per MP | $0.03 |
| `fal-ai/flux-pro/kontext` (Kontext [pro]) | $0.04 | per image | $0.04 — image-edit class; MV escalation if FLUX.2 dev fails eval |
| `fal-ai/flux-pro/kontext/max` | $0.08 | per image | $0.08 |

### 1.3 Background removal (server fallback only)

| Endpoint | Price | Per image (typical) | Confidence |
|---|---|---|---|
| `fal-ai/birefnet/v2` | $0.0008/compute-sec | ~$0.004–0.008 (5–10 s) | Medium (from fal.ai learn page) |
| `fal-ai/imageutils/rembg` | $0.00111/compute-sec | ~$0.005–0.011 | Medium |
| `fal-ai/bria/background/remove` (RMBG 2.0) | $0.018/generation | $0.018 | High; commercially licensed |

Plan assumed ~$0.001/image. Real fallback cost is ~$0.006 (BiRefNet v2) — still immaterial at a ≤10% fallback share ($0.0006/item).

### 1.4 GPU rates (self-host break-even reference)

H100 $4.50/h list ($1.89/h discounted), H200 $4.50/h ($2.10/h), B200 $6.25/h ($3.49/h), RTX PRO 6000 $2.99/h ($1.10/h). Per-second search figures (H100 ~$0.0005/s) align. Enterprise pricing quote-only.

---

## 2. Vision-LLM, embeddings, labels — Confidence: High unless noted

Per-call model used: **extraction** = one ~1024×1024 image + 1,500 cached system tokens + 100 fresh input + 300 output tokens; **explanation** = 700 cached + 100 fresh input + 100 output.

| Provider / model | Input $/M | Output $/M | Image tokens @1024² | Batch | Cache read | Extraction /item | Explanation | Source |
|---|---|---|---|---|---|---|---|---|
| **Gemini 3.5 Flash** | $0.30 | $2.50 | ~1,032 (768² tiles × 258) | −50% | $0.075/M | **$0.0012** (batch $0.00075) | $0.00033 | <https://ai.google.dev/gemini-api/docs/pricing> |
| Gemini 3.8 Flash | $0.75 (promo to 2026-12-31) | $3.75 | same | −50% | — | ~$0.0025 | — | same |
| **Claude Haiku 4.5** | $1.00 | $5.00 | ~1,370–1,400 | −50% | 10% of input | **$0.0037** (batch $0.00185) | $0.00057 | <https://platform.claude.com/docs/en/about-claude/pricing> |
| OpenAI cheapest vision (gpt-4o-mini class) | $0.15 | $0.60 | 85 low / ~765 high detail | −50% | 50% | ~$0.0005–0.0007 | $0.00013 | pricing page blocked (403) — **Medium/Low confidence**, from secondary sources |
| Gemini 2.5 Flash Image (Nano Banana) | — | — | — | — | — | $0.039 / generated image | — | Gemini pricing |
| GPT Image 2 | — | — | — | — | — | $0.006 low / $0.053 med / $0.211 high per image | — | secondary source, Medium |

| Embeddings | Price | Per 1 MP image | Confidence |
|---|---|---|---|
| **Voyage multimodal-3.5** | per-pixel; $0.00003–0.0012/image (50k–2M px); 200M free tokens | **~$0.0003** | High <https://www.mongodb.com/docs/voyageai/models/> |
| Cohere Embed v4 | $0.47/M image tokens; tokens/image undocumented | ~$0.0002–0.0009 | Low (token rule not public) |
| Jina embeddings v5 omni small | $0.02/M text; image not separately quoted | — | Medium |
| Self-hosted Nomic Embed Vision / SigLIP | GPU time only | ~$0.00002 at volume | Medium |

| Labels | Price | Source |
|---|---|---|
| Google Cloud Vision label detection | $1.50/1k images after 1k/mo free | <https://cloud.google.com/vision/pricing> |
| Ximilar Fashion Tagging | credit-based, quote only | <https://docs.ximilar.com/tagging/fashion> |

**Derived per-item processing cost:** extraction $0.0012 (Gemini Flash standard) + embedding $0.0003 (Voyage) + server segmentation fallback 10% × $0.006 = **$0.0021/item** (plan: ~$0.002 — confirmed). Worst case (Haiku standard + Cohere upper + Bria fallback): **$0.006/item**.

---

## 3. Infrastructure & platform fees — Confidence: High unless noted

| Service | Verified price (2026-09-09) | Source |
|---|---|---|
| Neon | Free 100 CU-h + 0.5 GB; Launch $0.106/CU-h, **storage $0.35/GB-mo**; Scale $0.222/CU-h | <https://neon.com/pricing> |
| Trigger.dev v4 | Hobby $10/mo (incl. $10 credit, 50 concurrent); Pro $50/mo (incl. $50, 200 concurrent, +$10 per extra 50); Small-2x machine $0.0000675/s; $0.000025 per run | <https://trigger.dev/pricing> |
| Cloudflare R2 | 10 GB-mo free; $0.015/GB-mo; Class A $4.50/M, Class B $0.36/M; egress $0 | <https://developers.cloudflare.com/r2/pricing/> |
| Cloudflare Images | 5k transforms/mo free, then $0.50/1k; $5/100k stored; $1/100k delivered | <https://developers.cloudflare.com/images/pricing/> |
| Railway | Hobby $5/mo incl. $5 usage; vCPU $0.00000772/s (~$0.028/h), RAM $0.00000386/GB-s; egress $0.05/GB; Pro $20/mo | <https://railway.com/pricing> |
| PostHog | Free 1M events, 5k replays, 100k errors, 1M flag requests; then $0.00005/event (1–2M) stepping down to $0.0000343 (2–10M) | <https://posthog.com/pricing> (step-downs via secondary, Medium) |
| RevenueCat | Free < $2,500 MTR; then 1% of tracked revenue | <https://www.revenuecat.com/pricing> |
| Open-Meteo commercial | **Standard $29/mo (1M calls), Professional $99/mo (5M)** — r4's "$500/mo" is stale | <https://open-meteo.com/en/pricing> (USD; EUR not shown) |
| WeatherAPI.com / OpenWeatherMap / Apple WeatherKit | $7/mo (3M) / 1k calls/day free then €0.14 per 100 / 500k included with dev program then $49.99/mo per 1M | respective pricing pages |
| Expo EAS | Free 15 iOS + 15 Android builds/mo; **Starter $19/mo** + per-build overage ($1–4); Production $199/mo; EAS Update free < 3k MAU then $0.005/MAU | <https://expo.dev/pricing> |
| GitHub Actions | Linux 2-core $0.006/min; macOS 3–4 core $0.062/min (M-series large $0.12/min per r1); Free 2k / Pro 3k min per month (macOS 10× multiplier) | GitHub billing docs |
| Apple Developer Program / Google Play | $99/yr / $25 once | official |
| Sentry | Developer free 5k errors/mo; Team $26/mo | <https://sentry.io/pricing/> |
| Transactional email | Resend free 3k/mo, Pro $20 (50k); Postmark free 100/mo, Pro $16.50 (10k) | pricing pages |

**Store commissions (load-bearing, verify at P13):**

- Apple: Small Business Program **15%** (< $1M prior-year revenue); standard 30% year 1 → 15% year 2+ for subscriptions. <https://developer.apple.com/app-store/small-business-program/>
- Apple EU (DMA), effective **2026-10-01**: 26% in-app IAP baseline; 15% for SBP / year-2 subscriptions; ~20% with link-out / alternative payments (2% acquisition + 13% store + 5% Core Technology Commission). Medium confidence — final structure pending EU sign-off at research time. Source: RevenueCat DMA update blog.
- Google Play: reported change **June 2026** — **10%** on first $1M/yr and 10% on auto-renewing subscriptions at any revenue level; 20% above $1M (15% in Apps/Games programs). **Secondary source only (Prism News) — verify on Play Console policy before modeling below 15%.**

**Infra envelope (from per-service estimates, medium confidence):** ~$60–70/mo at 100 MAU (EAS Starter, Railway Hobby, dev fees amortized, everything else free tier) · ~$160–200/mo at 1k MAU · ~$370–450/mo at 5k MAU · ~$870–1,100/mo at 20k MAU. Per active user: ~$0.18 (1k), **~$0.08 (5k)**, ~$0.05 (20k). r4's "$30–35 launch / $150–180 at 5k" understated by ~2×, mainly PostHog/Sentry/EAS/Trigger paid tiers.

---

## 4. Market & usage benchmarks — Confidence: Medium (published data is thin)

| Metric | Value | Source |
|---|---|---|
| Starter closet at onboarding | 20–30 items recommended; 100–150 after 3–6 months; Cladwell avg 125+ | wardrobe-app guides; digital-wardrobe stats 2025 |
| Session frequency | ~3.7 sessions/week (Closet+); 64% of Gen Z weekly; 73% monthly engagement | same |
| Trial→paid | 25.6% global median (Adapty 2026); ~40% Shopping, ~30% Social & Lifestyle (RevenueCat 2026) | <https://adapty.io/state-of-in-app-subscriptions/>, <https://www.revenuecat.com/state-of-subscription-apps> |
| Median prices | $12.99/mo, $38.42/yr, $7.48/wk; weekly plans = 55.5% of revenue; Shopping category 66% annual mix | Adapty / RevenueCat 2026 |
| Hard vs soft paywall (Lifestyle) | hard paywall +21% LTV | RevenueCat 2026 |
| Per-user try-on generations/month | **no published data** — extrapolated personas only | — |

Competitor price points (App Store listings, 2026): GetWardrobe $9.99/$49.99 (100 items free, 10 free AI outfits); Cladwell $7.99/$59.99; Indyx $7.99–12.99; Pureple $14.99/$89.99; Style DNA $7.99–9.99/$29.99–39.99; Acloset $3.99–24.99 tiered by closet size (100 items free); Whering credit packs $2.99–12.99; Stylebook $4.99 one-time; Alta Daily free (VC-subsidised); Aiuta pro tier $138.99/mo with an undisclosed monthly try-on limit. **Market clusters at $7.99–12.99/mo and $49.99–89.99/yr; free tiers cap at ~100 items; try-on quotas are almost never published.**

---

## 5. Consequences applied to the plan (2026-09-09)

1. **Credit model → weighted credits** (SPINE §6, doc 12 §1, §4): try-on = 3 credits, missing view = 1 credit; allotments Free 0 / Essentials 10 / Plus 60 / Pro 150; top-up packs 30 credits $4.99 and 100 credits $12.99 as consumable IAP (P13 stretch, else v1.1). Essentials gains `views.missing_view` so its credits buy something. Prices unchanged.
2. **Doc 10 §2.4–2.5, §3, §5, §6.1** re-priced: try-on budget ≤ $0.075/image (FASHN), optimistic $0.021 (FLUX 2 LoRA, eval-gated), worst $0.10; missing-view ≤ $0.012 (FLUX.2 dev), worst $0.04 (Kontext Pro).
3. **Doc 05 §6, §8, SPINE §2, DEC-28, ASM-03, RISK-02, P11 cost gate, P13 AC-9** updated to the verified numbers; Open-Meteo $29/$99; Google Play 10% flagged for verification; infra envelope doubled.
4. **P11 eval gate now includes a cost arm:** FLUX 2 try-on LoRA vs FASHN on the same eval set — if the LoRA passes, credit weights may be relaxed (decision logged at P11).
5. **Re-verification cadence:** all provider prices re-checked at the start of P11 and P13 (owner: PO); this file is the baseline.
