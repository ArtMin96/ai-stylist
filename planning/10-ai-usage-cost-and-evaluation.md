# 10 — AI Usage, Cost & Evaluation

**Status:** Draft for ratification · **Date:** 2026-08-24 · **Owner:** AI/ML architecture
**Conforms to:** [SPINE.md](SPINE.md) §2 (AI decisions), §4 (capability codes), §6 (pricing anchors)
**Evidence:** [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md) (all provider prices, as of Aug 2026), [research/r5-avatar-garment-3d.md](research/r5-avatar-garment-3d.md) (VTON), [research/r4-backend-providers.md](research/r4-backend-providers.md) (infra)
**Consumed by:** [12-pricing-entitlements-and-unit-economics.md](12-pricing-entitlements-and-unit-economics.md) (unit economics use §5 numbers verbatim — do not restate them elsewhere), [09-recommendation-engine.md](09-recommendation-engine.md), [07-3d-avatar-and-garment-pipeline.md](07-3d-avatar-and-garment-pipeline.md), phases P06/P11/P12.

Principle (brief §3.1, binding): **AI is a bounded capability, not the architecture.** If deterministic code, geometry, conventional CV, a rules engine, a database query, or a cached computation reliably solves the problem, we use that. Every AI call goes through a port owned by `platform`; the domain never imports a provider SDK.

---

## 1. AI / non-AI decision table

Classification vocabulary is the brief's §3.1 taxonomy:
`GEN` necessary generative/reconstruction · `CV` conventional computer vision/ML inference · `EMB` embedding/similarity · `RANK` ranking/personalization model · `NL` optional natural-language explanation · `DET` deterministic code or rules — AI not appropriate.

| # | Feature / capability | Class | AI involved? | Notes |
|---|---|---|---|---|
| 1 | Background removal / garment segmentation | CV | Yes (on-device first) | Apple Vision / ML Kit on device = $0; server fallback only on failure |
| 2 | Clothing category + attribute extraction | CV | Yes | Vision-LLM structured extraction with JSON schema; user confirms |
| 3 | Item embeddings: near-duplicate detection, visual/semantic search | EMB | Yes | Exact duplicates caught first by content hash (DET) — embedding only for *near*-dupes |
| 4 | Missing-view synthesis (back/side never photographed) | GEN | Yes | Only when the view was never supplied; provenance-marked; credit-metered |
| 5 | G2 generative photo try-on | GEN | Yes | fal.ai VTON-class; credit-metered; MVP premium feature |
| 6 | Selfie → stylized face likeness (A2) | CV | Yes (on-device) | ARKit/MediaPipe landmarks → parametric stylization; no generative provider in v1 |
| 7 | Outfit recommendation: candidate generation, hard constraints, scoring, ranking, tie-breaks | DET/RANK | **No LLM** | Deterministic rules engine + learned preference *weights* (simple, inspectable model — logistic/linear over reason-code features, versioned). Never a generative model |
| 8 | Recommendation explanations | NL | Optional | Templates from structured reason codes by default; Claude Haiku polish is an optional layer |
| 9 | Trend/runway summarization & feed personalization | NL + EMB | Partially | Ingested licensed content summarized server-side once per item (not per user); feed matching via embeddings + rules |
| 10 | Future stylist chat | NL | Yes (deferred) | Seam only until P15; calls same application services |
| 11 | Image quality checks (blur, exposure, framing) | DET | No | Laplacian variance / histogram heuristics on device |
| 12 | EXIF strip, orientation normalization, perspective correction | DET | No | Pure image math |
| 13 | Color extraction (dominant/secondary palette) | DET | No | k-means / median-cut in a perceptual color space on the segmented cutout |
| 14 | Color harmony scoring | DET | No | Deterministic math over LCh hue relationships (complementary/analogous/neutral rules) from `shared-kernel` color values |
| 15 | Taxonomy (categories, subcategories, attributes) | DET | No | Normalized, versioned tables owned by `closet` — never free-text from a model. Model output must map to canonical IDs or it is rejected |
| 16 | Unit conversion & measurement validation | DET | No | `shared-kernel` measurement definitions; property-tested |
| 17 | Weather/holiday/occasion context → clothing constraints | DET | No | Rules mapping context facts to warmth/water/formality requirements |
| 18 | Availability/laundry logic, wear history, cost-per-wear | DET | No | State machine + arithmetic |
| 19 | Entitlement checks, credit ledger | DET | No | See doc 12 |
| 20 | Deduplication by content hash | DET | No | SHA-256 of normalized image bytes before any paid processing |

**Deliberately NOT AI (restated as a commitment):** recommendation rules and ranking, the taxonomy, unit conversion, color harmony math, availability logic, context-fact mapping, quality gates, dedup-by-hash, and entitlements are deterministic forever. An LLM is never in the recommendation decision path; reason codes come from the engine's decision trace and NL text is generated *from* those codes, never the reverse (SPINE §2).

---

## 2. Per-feature specifications

Common policies (apply to every feature below; exceptions noted inline):

- **Ports & versioning:** each task has a port in `platform` (e.g. `SegmentationPort`, `AttributeExtractionPort`, `EmbeddingPort`, `ImageGenPort`, `ExplanationPort`). Every stored derived result records `{provider, model_id, prompt_id+version, port_version, input_content_hash, created_at, confidence}` — the lineage row in `media.derivations`. Reproducibility = replay inputs against the recorded versions.
- **Caching/dedup/batch:** inputs are content-hashed **before** any paid call; identical hash + same model/prompt version → serve stored result, never reprocess. Jobs are idempotent (idempotency key = `hash + task + model_version`, enforced by Trigger.dev). Derived results are stored with lineage and invalidated only when their specific input or model version changes. Async work uses provider Batch APIs (−50%) wherever the user is not waiting.
- **Retention/no-training:** default **no provider training on customer data**; prefer zero/short retention (Anthropic 7-day, no training on API data — r3 §1.3). Face/body media may only go to providers passing the doc 11 privacy review; selfies never leave the device in v1 (feature 6). We keep originals + derivations in R2 under our own retention policy (doc 11).

### 2.1 Segmentation / background removal (CV)

| Field | Decision |
|---|---|
| Contract | In: item photo (device-normalized JPEG/HEIC, ≤4K). Out: alpha-matted cutout PNG + mask + `confidence ∈ [0,1]` + `method: on_device \| server` |
| Why not deterministic | Garments on varied backgrounds cannot be separated by classical thresholding/GrabCut reliably; learned salient-object segmentation is the standard tool. (It *is* conventional CV, not generative.) |
| Provider → fallback | **Apple Vision subject lift (iOS) / ML Kit Subject Segmentation (Android), $0** → server **BiRefNet/RMBG-class on fal.ai** (~$0.001/image GPU-time class) for failures/low-confidence. remove.bg rejected ($0.20–1.00/image). r3 §2.1 |
| On-device vs server | On-device first, always. Server only when on-device confidence < threshold or device unsupported |
| Quality threshold | Mask confidence ≥ 0.85 auto-accept; 0.60–0.85 show cutout with "check the edges" prompt; < 0.60 auto-retry on server, then manual crop tool |
| Eval | 300-image consent-safe eval set (garments on floors/beds/hangers/worn, dark-on-dark, lace/mesh, shoes, jewelry); metric: mask IoU ≥ 0.92 mean, catastrophic-failure rate < 2% |
| Latency / cost budget | On-device < 1.5s; server fallback p95 < 6s; cost budget $0 blended target, ≤ $0.001 × ~10% fallback share |
| Caching | Content hash; a re-uploaded identical photo never reprocesses |
| Degraded mode | Segmentation unavailable → store original, item usable un-cutout, queue for later processing |
| User confirmation | Cutout preview in capture review; manual mask edit/crop path (brief §2.4 failure path) |

### 2.2 Classification & attribute extraction (CV)

| Field | Decision |
|---|---|
| Contract | In: cutout image + capture context (user-selected coarse category if given). Out: **JSON-schema-validated** `{category_id, subcategory_id, attributes: {color_ids, pattern, material, sleeve, neckline, …}, per-field confidence}` — every ID must exist in the `closet` taxonomy or the field is dropped as unrecognized |
| Why not deterministic | Category and fine attributes (neckline, rise, material) are perceptual judgments; no rule set over pixels achieves usable precision. Color extraction stays deterministic (§1 #13) and *overrides* model color output |
| Provider → fallback | **Vision-LLM structured extraction: Gemini Flash-class ($0.50/$3.00 per M tok) or Claude Haiku 4.5-class where vision available — pick per eval in P06**; cheap coarse pass: **Google Cloud Vision labels $1.50/1k**; escalation: **Ximilar Fashion Tagging** (custom quote, est. $0.003–0.01/img) only if eval precision insufficient. r3 §2.2, SPINE §2 |
| On-device vs server | Server (batch-friendly, model-agile). Revisit on-device small model post-launch if volume justifies |
| Quality threshold | Per-field confidence ≥ 0.80 pre-filled as accepted; below → shown as suggestion requiring tap-to-confirm; category itself < 0.60 → user must pick |
| Eval | 500-item labeled eval set across all taxonomy top-levels incl. shoes/accessories; metrics: category accuracy ≥ 92%, attribute macro-F1 ≥ 0.80, invalid-JSON/invalid-ID rate < 0.5%; skin-tone/garment-style slices per doc 13 |
| Latency / cost | Batch path (default, capture is async) < 60s to reviewed state; interactive single-item p95 < 8s. Cost budget ≤ $0.002/item blended (image ≈ 1–2k input tokens; batch −50%) |
| Caching | Per content hash + taxonomy version; taxonomy migration remaps IDs, does not re-call the model |
| Degraded mode | Vision-LLM down/over budget → Cloud Vision coarse label + "add details" prompt to user; never block capture |
| User confirmation | **Always** — extraction is a draft the user confirms in the capture review screen (brief §2.4); corrections are stored as ground truth and feed the eval set (consent-gated) |

### 2.3 Embeddings, near-dup detection, similarity search (EMB)

| Field | Decision |
|---|---|
| Contract | In: cutout image (+ optional text of confirmed attributes). Out: 1,536-D float vector, model/version tagged, stored in **pgvector** |
| Why not deterministic | Near-duplicate ("same shirt, new photo") and style-similarity require perceptual similarity; hashes only catch exact bytes |
| Provider → fallback | **Cohere Embed v4-class multimodal ($0.47/1M image tokens ≈ $0.0005/image)** → self-hosted **SigLIP/CLIP** only past measured ~200M tokens/month break-even (A10G $0.75/hr). r3 §2.3 |
| On-device vs server | Server (vectors live next to Postgres; queries are server-side) |
| Quality threshold | Near-dup: cosine ≥ 0.96 → "possible duplicate" confirmation card (never auto-merge); 0.90–0.96 flag in review only |
| Eval | 200 curated dup/near-dup/distinct triplets; metrics: dup recall ≥ 0.90 @ precision ≥ 0.95; search judged by save-through rate post-launch |
| Latency / cost | Embed within capture pipeline (< 60s async); query p95 < 150ms (pgvector HNSW). Budget ≤ $0.0005/item, one-time per item version |
| Caching | One embedding per content hash per model version. Model upgrade = background re-embed batch job (budgeted, resumable), old vectors kept until swap completes |
| Degraded mode | Provider down → skip near-dup check (exact-hash dedup still active), backfill later |
| User confirmation | Duplicate merge is always user-confirmed |

### 2.4 Missing-view synthesis (GEN, credit-metered)

| Field | Decision |
|---|---|
| Contract | In: front cutout + category/attributes + target view (`back \| side`). Out: generated view image + **provenance marker** `generated:true` + confidence + lineage to source photo. Never overwrites or replaces a real captured view; user can replace it with a real photo later (brief §2.4) |
| Why not deterministic | Inventing unseen geometry/texture is inherently generative |
| Provider → fallback | **fal.ai Flux-class ($0.025/image, warm pool, seconds-class latency)** → Gemini image Batch API (−50%, $0.02–0.075) for non-urgent bulk → Replicate ($0.003 but 10–120s cold starts) batch-only. r3 §3.1 |
| On-device vs server | Server (GPU class) |
| Quality threshold | Automated sanity checks (category classifier agrees with source ≥ 0.8; palette ΔE vs source under threshold) else auto-retry once then refund credit; user rates keep/discard — discard refunds the credit |
| Eval | 100-item set with real back photos as ground truth; metrics: attribute consistency ≥ 90%, user keep-rate ≥ 70% (R&D gate in P11; kill/hold if unmet) |
| Latency / cost | p95 < 20s job completion; **budget $0.025/image**; entitlement `credits.monthly` consumed per image (doc 12 §4) |
| Caching | One generation per (hash, view, model version); regenerate = new credit, explicit user action |
| Degraded mode | Provider down/over budget → feature "temporarily unavailable", credit **not** consumed |
| User confirmation | Provenance badge + keep/replace/discard in item detail |

### 2.5 G2 generative photo try-on (GEN, credit-metered)

| Field | Decision |
|---|---|
| Contract | In: consented user photo (or avatar render), 1–N garment cutouts, pose hint. Out: try-on image + provenance marker + confidence. Explicitly labeled a visualization, not a fit guarantee |
| Why not deterministic | Draping a real garment photo onto a real body photo is the core generative capability (G2 on the SPINE ladder); 3D simulation (G4) is a research non-goal for v1 |
| Provider → fallback | **fal.ai VTON-class, ~$0.003–0.01/image, ~100ms-class queue latency** → Replicate VTON for batch/backfill. r5 §C, r3 §3.1 |
| On-device vs server | Server |
| Quality threshold | R&D Gate (P11, from r5): ≥ 80% user satisfaction across diverse body types & garment categories; per-image auto-checks (face region untouched when photo-based; garment palette consistency) |
| Eval | Consent-safe internal photo set spanning body shapes, skin tones, garment classes; metrics: satisfaction ≥ 80%, artifact-report rate < 5%, refusal-to-show (failed auto-check) < 3% |
| Latency / cost | p95 < 15s end-to-end; **budget ≤ $0.01/image blended**; consumes `credits.monthly` |
| Caching | (user photo hash, outfit composition hash, model version) cached — re-viewing a try-on is free |
| Degraded mode | Fall back to G0 collage view (always available); credit not consumed on failure |
| User confirmation | Consent for the base photo (doc 11); provenance badge on every result |
| Privacy | User photos to fal.ai only under the doc 11 provider review; signed short-lived URLs; deletion propagates to derived try-ons |

### 2.6 Selfie → stylized face likeness A2 (CV, on-device)

| Field | Decision |
|---|---|
| Contract | In: selfie (on-device only). Out: parametric face-feature vector (landmark-derived measurements, skin-tone reference, hair class) applied to the avatar head + likeness-confidence indicator. **No "digital twin" claims** (SPINE §2) |
| Why not deterministic | Landmark detection is learned CV; the mapping landmarks→avatar morphs is deterministic math we own |
| Provider → fallback | **ARKit (iOS) / MediaPipe Face Landmarker (Android), $0, on-device** → generic face (A0 default). Server reconstruction path documented in doc 07 as a later, separately-consented capability. r5 §avatars, SPINE §2 |
| On-device vs server | **On-device only in v1** — the selfie never leaves the device; only the derived parameter vector syncs (classified sensitive, doc 11) |
| Quality threshold | Landmark confidence below threshold → guided retake (lighting/pose tips); after 2 failures offer generic face |
| Eval | Internal panel across skin tones/ages/face shapes; metric: "recognize yourself" ≥ 70% (baseline first), correction-slider usage tracked |
| Latency / cost | < 3s on-device; **$0 marginal cost** |
| Caching | Parameter vector versioned with rig version (doc 07 avatar asset migration) |
| Degraded mode / confirmation | Calibration screen with sliders; one-tap revert to generic face; delete selfie-derived data anytime |

### 2.7 NL explanations for recommendations (NL, optional layer)

| Field | Decision |
|---|---|
| Contract | In: structured reason codes + context facts from the engine's decision trace (never raw user data). Out: 1–3 short sentences per recommendation, tone-controlled, schema: `{text, reason_code_ids[]}` — every sentence must map back to a real reason code |
| Why not deterministic | It is, by default: **templates over reason codes ship first and remain the permanent fallback.** LLM polish exists only to improve fluency/variety where templates read robotic |
| Provider → fallback | **Claude Haiku 4.5-class, Batch API (−50%) + prompt caching (−90% on cached system prompt) → ~$0.00001–0.0001/explanation** → GPT-5.4 Nano-class → templates. r3 §1, §8 |
| On-device vs server | Server, batched off-peak where possible |
| Quality threshold | Post-generation validator: output must reference only supplied reason codes (no invented facts); violation → discard, serve template. Hallucination rate is a release gate: < 0.5% on eval |
| Eval | 200 decision traces incl. edge cases (cold-weather holiday, laundry conflicts, sparse closet); metrics: faithfulness (no unsupported claims) ≥ 99.5%, human preference vs template ≥ 60% |
| Latency / cost | Not latency-critical (generated with the rec, cacheable); budget ≤ $0.0001/explanation |
| Caching | Cache key = (reason-code set + context bucket); popular combinations serve cached text. System prompt under `cache_control` |
| Degraded mode | **First rung of the kill-switch ladder (§6): disable polish → templates.** Users still get full explanations |
| Version tracking | Prompt registry: `explanation-polish@vN` recorded per generated text |

### 2.8 Trend & runway summarization (NL + EMB, server-side, amortized)

| Field | Decision |
|---|---|
| Contract | In: licensed ingested content item (doc: fashion-intel provenance rules). Out: structured summary `{styles[], colors[], silhouettes[], season, region}` mapped to taxonomy IDs + short editorial blurb |
| Why not deterministic | Summarizing editorial text/images into taxonomy terms is an NL task; **matching** summaries to a user's closet/preferences is deterministic + embedding similarity |
| Provider → fallback | **Claude Haiku batch + caching, ~$0.0001–0.001 amortized per user/month** (summarize once per content item, N users share it) → Gemini Flash-class. r3 §8 |
| Latency / cost | Ingestion job, hours-class SLA; per-item cost < $0.005, amortized across all users |
| Caching | Once per content item per prompt version — never per user |
| Eval | Editor spot-check queue in `admin`; taxonomy-mapping precision ≥ 90% |
| Confirmation / provenance | Feed cards show source attribution (fashion-intel doc); "why am I seeing this" from deterministic match reasons |

### 2.9 Future stylist chat (NL, deferred to P15)

Seam only, per brief §2.9: chat calls the same application services (closet, recommendation, context, entitlements) as tool calls; no second engine, no direct table access. Decisions made **now** so the seam is cheap: prompt/version registry shared with §2.7; per-conversation token budget and tool-call limit; model routing table in config; entitlement `chat.stylist` (Pro) already named in doc 12. Cost modeling deferred to P15 — excluded from §5 consumption tables by design.

---

## 3. Provider comparison & picks ("which AI provider is best")

All prices **as of Aug 2026** from [r3](research/r3-ai-providers-costs.md) (per-section citations there). Scores: ●●● strong / ●●○ adequate / ●○○ weak. **Pick in bold.**

| Task | Option | Quality | Cost | Privacy | Lock-in risk | Verdict |
|---|---|---|---|---|---|---|
| Segmentation | **Apple Vision / ML Kit (on-device)** | ●●● | $0 | ●●● never leaves device | ●○○ OS APIs, stable | **PICK** |
| | BiRefNet/RMBG on fal.ai | ●●● | ~$0.001/img | ●●○ | low (open weights) | Server fallback |
| | remove.bg | ●●● | $0.20–1.00/img | ●●○ | med | Rejected: 200–1000× cost |
| Classification/attributes | **Gemini Flash-class vision-LLM (JSON schema)** | ●●● | ~$0.002/item | ●●○ paid API, no training | ●○○ prompt+schema portable | **PICK** (final model per P06 eval) |
| | Claude Haiku 4.5-class | ●●● | similar | ●●● 7-day, no training | ●○○ | Co-pick where vision offered; tie-break on eval |
| | Google Cloud Vision labels | ●○○ coarse | $0.0015/img | ●●○ | ●○○ | Degraded-mode + cheap pre-pass |
| | Ximilar Fashion Tagging | ●●● fashion-specific | est. $0.003–0.01 (quote) | ●●○ | ●●○ | Escalation only if eval fails |
| Embeddings | **Cohere Embed v4-class** | ●●● | $0.47/1M img tok (~$0.0005/img) | ●●○ | ●●○ vectors tied to model | **PICK** until ~200M tok/mo |
| | Self-hosted SigLIP/CLIP | ●●○ | GPU $0.75/hr | ●●● | ●○○ | Post-threshold migration target |
| | Voyage Multimodal-3 | ●●○ | ~$0.06/1M | ●●○ | ●●○ | Price fallback |
| Generative try-on / views | **fal.ai (Flux/VTON-class)** | ●●● | $0.003–0.025/img | ●●○ needs doc 11 review | ●●○ | **PICK** — warm pool, no cold-start |
| | Replicate | ●●● | $0.003/img | ●●○ | ●●○ | Batch/backfill only (10–120s cold starts) |
| | OpenAI / Gemini image | ●●○ | $0.02–0.15/img | ●●○ | ●●○ | Batch price fallback (Gemini −50%) |
| NL explanations / trends | **Claude Haiku 4.5 (batch+cache)** | ●●● | $0.5/1M in effective; ~$0.00001/expl | ●●● 7-day, never trains | ●○○ prompts portable | **PICK** |
| | GPT-5.4 Nano | ●●○ | $0.20/$1.25 per M | ●●○ 30-day | ●○○ | Fallback |
| | Gemini Flash-class | ●●○ | $0.50/$3.00 per M | ●●○ | ●○○ | Fallback |
| Face likeness | **ARKit/MediaPipe (on-device)** | ●●○ stylized | $0 | ●●● | ●○○ | **PICK** — see §2.6 |

One-line answer for the product owner: **no single provider wins everything.** The cost+quality frontier is: **on-device Apple/Google CV for pixels ($0) · Gemini-Flash-class or Claude-Haiku-class for structured vision extraction (eval decides in P06) · Cohere for embeddings · fal.ai for all generative images · Claude Haiku (batch+cache) for all natural language.** Anthropic is the privacy anchor (7-day retention, never trains on API data); fal.ai is the only latency-viable generative host.

---

## 4. Cross-cutting cost mechanics

- **Batch −50%** (Anthropic/OpenAI/Google) on everything a user isn't waiting for: classification, embeddings, explanations, trend summaries.
- **Prompt caching −90%** on repeated system prompts (Anthropic 5m/1h TTL); stacks with batch ⇒ ~95% off repeated tokens (r3 §1.2).
- **On-device first** for segmentation and face — the two highest-volume pixel tasks cost $0.
- **Hash-before-spend:** no paid call without a content-hash cache miss. Target cache-hit + on-device share ≥ 85% of all "AI-touching" operations (OBS metric, doc 14).
- **Amortize:** trend summaries per content item, not per user; explanation cache per reason-code combination.

---

## 5. Per-user consumption & cost model

Canonical numbers — doc 12 imports these; nobody restates them. Derived from r3 §6–7; assumptions labeled. **All figures are modeled estimates, not measurements** — P06/P11 telemetry replaces them ("baseline first").

### 5.1 Assumptions (usage profiles)

| Profile | Closet items at onboarding | New items/mo steady | Recs/mo | NL explanations/mo | Generative credits used/mo |
|---|---|---|---|---|---|
| Light | 50 | 5 | 10 | 2 | 0–1 |
| Medium | 100 | 20 | 40 | 10 | 5 |
| Heavy | 150+ | 50 | 100 | 30 | 20–200 (tier-capped) |

### 5.2 Unit costs (blended, from §2 budgets)

| Unit | Cost | Composition |
|---|---|---|
| **Cost per closet item processed** | **~$0.002** (≤ $0.003 with server-segmentation fallback share) | segmentation $0 (on-device) + classification ~$0.0015 + embedding ~$0.0005 |
| **Cost per generative credit** | **~$0.01 blended** (range $0.003 VTON – $0.025 missing-view; worst case $0.025) | fal.ai per-image prices, §2.4–2.5 |
| Cost per NL explanation | ~$0.00001–0.0001 | Haiku batch+cache |
| Cost per recommendation | ~$0 | deterministic engine; explanation cost counted separately |

### 5.3 Onboarding month, per user

| Component | Light (50 items) | Medium (100) | Heavy (150) |
|---|---|---|---|
| Segmentation (on-device) | $0 | $0 | $0 |
| Classification | $0.075 | $0.15 | $0.225 |
| Embeddings | $0.025 | $0.05 | $0.075 |
| Explanations (first recs) | ~$0.0001 | ~$0.0001 | ~$0.0001 |
| **Total onboarding** | **≈ $0.10** | **≈ $0.20** | **≈ $0.30** |

### 5.4 Steady-state month, per active user (excl. generative credits)

| Component | Light | Medium | Heavy |
|---|---|---|---|
| New item processing | $0.01 | $0.04 | $0.10 |
| Recs + cached explanations | ~$0.0001 | ~$0.0005 | ~$0.0013 |
| Embedding/search upkeep | ~$0 | ~$0.0001 | ~$0.0005 |
| Trend summarization share | $0.0001 | $0.0005 | $0.001 |
| **Steady monthly** | **$0.01–0.015** | **$0.05–0.075** | **$0.10–0.15** |

### 5.5 Generative add-on (credit consumption × §5.2 blended $0.01, worst $0.025)

| Credits used/mo | Blended cost | Worst case |
|---|---|---|
| 1 | $0.01 | $0.03 |
| 10 (Essentials cap) | $0.10 | $0.25 |
| 50 (Plus cap) | $0.50 | $1.25 |
| 200 (Pro cap) | $2.00 | $5.00 |

### 5.6 Annualized ($/user/month average incl. onboarding, excl. credits)

| Profile | Annual total | Avg $/user/mo |
|---|---|---|
| Light | $0.21–0.26 | **~$0.02** |
| Medium | $0.75–1.02 | **~$0.06** |
| Heavy | $1.40–1.95 | **~$0.12–0.16** |

Matches SPINE §6 anchors ($0.02–0.08 steady light–medium; $0.10–0.15+ heavy; $0.10–0.30 onboarding; ~$0.01/generative image).

---

## 6. Cost guardrails

### 6.1 Per-plan monthly AI budget caps (per user, alerting thresholds — not user-visible limits)

| Plan | Expected cost (§5 + credit cap) | Soft alert @ | Hard cap (auto-degrade) |
|---|---|---|---|
| Free | ≤ $0.03 | $0.06 | $0.10 |
| Essentials | ≤ $0.20 | $0.35 | $0.60 |
| Plus | ≤ $0.60 | $1.00 | $1.75 |
| Pro | ≤ $2.20 (worst $5.25) | $4.00 | $6.50 |

Plus a **global monthly AI spend cap** (config, initially $500/mo) with PostHog + provider-dashboard reconciliation weekly. Per-task spend metrics tagged `{task, provider, model_version, plan}` (doc 14).

### 6.2 Alerting

- 60% of global or plan-aggregate budget mid-month → notify (Slack/ops).
- 85% → page + automatic tightening: generative jobs shift to batch/off-peak, polish cache TTL extended.
- Anomaly rule: any task's day-over-day spend ×3 → alert (catches retry storms and provider price changes).

### 6.3 Kill-switch / degradation ladder (each rung a server flag; ordered by user impact, least first)

1. **Disable LLM explanation polish → templates only** (users still get full explanations).
2. Trend summarization paused (feed serves existing summaries).
3. Vision-LLM extraction → Cloud Vision coarse labels + user completes attributes.
4. Server segmentation fallback off → on-device only; failures queue for later.
5. Missing-view synthesis paused (credits not consumed; "temporarily unavailable").
6. G2 try-on paused → G0 collage fallback (credits not consumed).

Rungs 5–6 are also the automatic response to provider outage. Nothing on the ladder ever breaks capture, closet, or recommendations — the deterministic core runs at $0 marginal AI cost.

### 6.4 Provider migration playbook

1. All calls behind `platform` ports; swap = new adapter + config, no domain change.
2. Candidate must pass the task's eval suite (§2) at equal-or-better metrics and modeled cost.
3. **Shadow run** 1–2 weeks: mirror sampled traffic, compare quality/cost/latency dashboards.
4. Cut over by config flag per task; old adapter kept warm 30 days for rollback.
5. Embedding-model migrations additionally require the background re-embed job (§2.3).
6. Record as ADR; update this doc's §3 table + prices with new as-of date.

Known migration triggers already on file: Gemini 2.5 Flash sunset Oct 16 2026; Anthropic pricing review Sep 1 2026; embeddings self-host at ~200M tokens/mo (r3 §12).

---

## 7. Open items

| ID | Item | Owner phase |
|---|---|---|
| AIC-O1 | Final vision-LLM pick (Gemini Flash-class vs Claude Haiku vision-class) by eval bake-off | P06 |
| AIC-O2 | fal.ai privacy/DPA review for user photos (G2) | P11 (pre-work in P00 legal discovery) |
| AIC-O3 | Ximilar volume quote (only if AIC-O1 eval precision < targets) | P06 |
| AIC-O4 | Chat cost model | P15 |

Requirement IDs delivered by this doc are registered in [01-requirements-and-traceability.md](01-requirements-and-traceability.md) under `AIC` / `NFR-AIC`.
