# r8 — On-device AI, 3D/generative asset sourcing, and cost per user (2026-10-04)

**Status:** Evidence (research only — no decision is changed by this file) · **Date:** 2026-10-04 · **Author:** research session on branch `claude/mobile-ai-research-iawzfe`
**Builds on:** [`planning/research/r6-pricing-verification-2026-09-09.md`](../../planning/research/r6-pricing-verification-2026-09-09.md) (prices), [`r7`](../../planning/research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md) (self-hosting audit), [`r5`](../../planning/research/r5-avatar-garment-3d.md) (3D), and the current plan in [`SPINE.md`](../../planning/SPINE.md) §2/§4/§6, [doc 07](../../planning/07-3d-avatar-and-garment-pipeline.md), [doc 10](../../planning/10-ai-usage-cost-and-evaluation.md), [doc 12](../../planning/12-pricing-entitlements-and-unit-economics.md).
**Why here and not `planning/research/`:** `planning/**` is read-only context for agents (`.claude/rules/human-only.md`). The owner may move this file to `planning/research/r8-…` when accepting it. Anything here that conflicts with a recorded decision is listed in §8 as a *proposal* for the decision log, not applied.

---

## 0. The answers, in one page

| Question | Answer |
|---|---|
| **Does the plan use fal.ai to generate 3D assets of clothing and the user model?** | **No — and that is good.** The user model is the **Anny parametric body** fitted from measurements by deterministic math, on the phone: **no AI service, $0 per user** (doc 07 §3). The face is on-device ARKit/MediaPipe landmarks ($0). fal.ai is used only for **2D images**: G2 photo try-on ($0.075) and missing back/side views ($0.012). 3D garments (G3) are *later, gated*, and planned as **authored templates + photo texture projection**, not AI generation. |
| **Can we lean on the iPhone's (and Android's) built-in AI to cut cost?** | **Yes for most of the high-volume pixel work, no for the expensive generative work.** On-device can do: background removal, image-quality checks, near-duplicate detection, colour extraction, face landmarks, body height/pose prior, avatar fitting — all $0. **New in iOS 27 (Sept 2026):** Apple's on-device Foundation Model accepts **images**, so garment category/attribute tagging can run on-device on Apple-Intelligence iPhones (iPhone 15 Pro and newer); Android's Gemini Nano Prompt API also takes images on flagships. That covers a *minority* of devices, so the server path stays. **Try-on, missing views, and real 3D garments cannot run on-device** on either platform today. |
| **Is it hard/expensive to generate on our own servers instead of fal.ai?** | **GPU cost per image is cheap; everything around it is not.** Self-hosted try-on (FASHN VTON v1.5, Apache-2.0) costs ≈ **$0.009–0.013/image** of serverless GPU time vs **$0.075** on fal — but needs ≈ **4–8 person-weeks** to build and 0.5–1 day/week to run, and cold starts make it *more* expensive at low volume. **Break-even ≈ 30–50k try-ons/month sustained.** Before that, managed wins. Licences are the real trap: many popular open models are **non-commercial** (CatVTON, IDM-VTON, OOTDiffusion, FLUX.1 Kontext dev, FLUX.2 dev, FLUX.2 klein 9B) or **exclude the EU/UK/South Korea** (Hunyuan3D 2.x). |
| **If AI-generated, which service is the best quality/price?** | **Try-on:** FASHN v1.6 (current pick, $0.075) is still the safe quality baseline; **BFL FLUX VTO (new, May 2026) ≈ $0.0475/image** on fal/BFL/Runware is the best value candidate; FASHN Try-On Max ($0.15–0.375, FASHN-direct only) is the quality ceiling. **Missing views:** keep FLUX.2 [dev] managed ($0.012/MP); Gemini "Nano Banana 2 Lite" batch (~$0.017) and Seedream/Qwen-Image-Edit (~$0.03) are eval arms. **3D (rigid accessories only, if G3 ever needs it):** Tripo v3.x ≈ $0.30/asset (clean mesh), Hunyuan3D v3.1 Pro ≈ $0.375–0.675 (top quality), SAM 3D Objects $0.02 (cheap, research-grade). **No service makes wearable, riggable 3D garments from a photo** — templates remain the right G3 plan. |
| **What does it cost per user?** | Non-generative AI: **≈ $0.01–0.15/user/month** + **≈ $0.08–0.24 once at onboarding** (unchanged from doc 10). Generative cost at **100% credit use**: Essentials **$0.13**, Plus **$1.65**, Pro **$4.13**/month on the current plan → **$0.13 / $1.04 / $2.61** if FLUX VTO passes eval → **$0.13 / ≈$0.28 / ≈$0.70** with self-hosted try-on at scale. Even the worst case keeps Pro-annual gross margin ≈ **59%** after the 15% store fee (§6). Current prices are supportable; a cheaper try-on mainly allows **relaxing try-on from 3 to 2 credits**. |

---

## 1. What the plan really does today (correcting the premise)

| Asset / capability | Plan today | AI? | Where it runs | Marginal cost |
|---|---|---|---|---|
| User body model (A1) | Anny parametric mesh; measurements → shape params by a fitted linear/low-order regression (doc 07 §3.3) | **No** | Phone (render) + fit coefficients shipped | $0 |
| Stylised face (A2) | ARKit face blendshapes / MediaPipe Face Landmarker → head blend shapes (doc 07 §5.1) | CV, on-device | Phone | $0 |
| Closet item cutout (G0) | Apple Vision subject lift / ML Kit Subject Segmentation; server fallback ≤10% | CV, on-device first | Phone (+ server fallback) | ≈ $0.0006/item |
| Category/attributes | Vision-LLM (Gemini 3.5 Flash / Claude Haiku 4.5 / self-hosted Qwen3-VL eval arm) | CV/LLM | Server | ≈ $0.0012/item |
| Embeddings | Voyage multimodal-3.5 / self-hosted SigLIP eval arm | EMB | Server | ≈ $0.0003/item |
| **G2 photo try-on** | fal.ai FASHN v1.6 / Kling Kolors; FLUX 2 LoRA + self-hosted FASHN VTON v1.5 as P11 eval arms | GEN | Server (fal.ai) | $0.075/image |
| **Missing back/side view** | fal.ai FLUX.2 [dev] (managed only — weights non-commercial) | GEN | Server (fal.ai) | $0.012/MP |
| G3 3D garment | Template meshes (outsourced, ~$50–500 each) + photo texture projection; later, gated by SPK-3 | No (authoring) | Build time + small server job | ~$0 runtime |
| G4 reconstructed 3D + cloth sim | Research bet with kill criteria | — | — | — |

So **fal.ai is not a 3D-asset service in this plan**; it is a 2D generative service for two credit-metered premium features. The 3D renderer (Filament) is itself deferred (DEC-50).

---

## 2. On-device AI: what iPhone and Android can take over

### 2.1 Platform state, October 2026

- **iOS 27** released **2026-09-14** (WWDC 2026-06-08). Runs on iPhone 11 / SE 2 and later; **Apple Intelligence still requires iPhone 15 Pro, any iPhone 16, or any iPhone 17.** *(M — MacRumors, everymac)*
- **Foundation Models framework** (Apple's on-device LLM, free, "unlimited" on-device): text generation, guided generation (`@Generable` → typed Swift output), tool calling. **iOS 26: text only. iOS 27: image input** via the new `Attachment` type (`CGImage`, `CVPixelBuffer`, URL…); Apple's own article recommends `@Generable` enums for image classification. *(H — [Analyzing images with multimodal prompting](https://developer.apple.com/documentation/foundationmodels/analyzing-images-with-multimodal-prompting), [Attachment](https://developer.apple.com/documentation/foundationmodels/attachment), WWDC26 session 241; corroborated by [Classmethod](https://dev.classmethod.jp/en/articles/foundation-models-multimodal-image-analysis/))*
  - Context window: Apple's docs **conflict** (4,096 tokens in one article; `contextSize // 8192` in a WWDC26 sample). Read `contextSize` at runtime. *(H, conflicting)*
  - Press reports that the most capable iOS 27 on-device model needs **12 GB RAM** (iPhone Air / 17 Pro). **Unverified whether image input works on 8 GB Apple Intelligence iPhones** — must be tested on an iPhone 15 Pro before relying on it. *(M)*
  - New in iOS 27: **Private Cloud Compute** access for developers (32K context), free of cloud cost for Small Business Program developers under 2M first-time downloads, with per-user daily quotas and a managed entitlement. *(H)*
  - **Acceptable-use rule that bites us:** #10 forbids "classifying individuals based on biometric data to infer sensitive attributes", #11 forbids judging people by personal traits. Describing *garments* is fine; never prompt it about the user's body or face. *(H — [acceptable use requirements](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/))*
- **Vision framework:** `GenerateForegroundInstanceMaskRequest` (subject lift, already in the plan); **new in iOS 27 `GenerateIterativeSegmentationRequest`** — tap/box/scribble to fix a cutout on-device (ideal for the doc 07 "manual crop" failure path); `GenerateImageFeaturePrintRequest` (image embedding with distance — near-duplicate detection); `CalculateImageAestheticsScoresRequest` (quality gate); `DetectHumanBodyPose3DRequest` with `bodyHeight` in metres. *(H — Apple developer docs)*
- **Image Playground / `ImageCreator`:** **deprecated in iOS 27**, styles are animation/illustration/sketch only — **no photorealism**. Unusable for try-on or garment views. *(H)*
- **Object Capture** (`ObjectCaptureSession` + `PhotogrammetrySession` on iOS 17+): on-device photogrammetry of **real objects** to USDZ at "reduced" detail in a few minutes; practically needs a **LiDAR iPhone Pro**; Apple warns against soft, thin, reflective, transparent objects. → Works for **shoes, bags, hard accessories**, not for draped garments; needs a 360° multi-photo capture. *(H — WWDC23-10191, Apple capture guide)*
- **Core AI** (new in iOS 27) runs our own PyTorch-converted models on the Neural Engine. **Licence trap:** Apple's **MobileCLIP/MobileCLIP2 and SHARP weights are research-only** — cannot ship them. *(H — repo LICENSE_MODELS)*
- **Android:** Gemini Nano via ML Kit GenAI **Prompt API accepts images** (production path for Gemini Nano 4 announced at I/O '26); structured output is "upcoming"; devices are flagships only (Pixel 9/10, recent Samsung/OnePlus/Xiaomi…; Nano 4 needs 12 GB RAM). ML Kit Subject Segmentation (beta, Play-services only), MediaPipe Face Landmarker (52 blendshapes), Image Embedder, LiteRT for custom models. *(H for API existence; M/L for device lists)*
- **Coverage:** Apple does not publish it; Counterpoint estimates ≈ **450M** Apple-Intelligence-capable iPhones shipped through Q1 2026, roughly a third of active iPhones. Gemini-Nano-capable Android is a small flagship slice. *(M/L)*

### 2.2 Task-by-task verdict

| Task | Best on-device (iOS / Android) | Coverage | Replaces a paid server call? | Notes for this repo |
|---|---|---|---|---|
| Background removal | Vision subject lift + **iOS 27 tap-to-segment** / ML Kit Subject Segmentation | iOS 17+ / Play-services phones | **Yes** (already planned) | Add iOS 27 iterative segmentation to the manual-fix path (P06). |
| Category & attributes | **Foundation Models image input + `@Generable`** / Gemini Nano Prompt API | Apple-Intelligence iPhones on iOS 27 (8 GB support unverified) / flagships | **Partial** | Saves ≈ $0.0012/item on a minority of devices → **≈ $0.0004/item blended at best**. Worth it mainly for privacy + latency, not cost. Taxonomy must come from `closet`/contracts, never redefined in the apps; needs a doc-10 entry + eval. |
| Near-duplicate detection | Vision feature print / MediaPipe Image Embedder | All | **Yes** for on-device dupes | iOS and Android vectors aren't comparable; server-side search still needs one shared model (SigLIP, not MobileCLIP). |
| Quality checks, colour extraction | Vision aesthetics + our heuristics; k-means on mask | All | **Yes** | Deterministic anyway (doc 10 §1 #11, #13). |
| Selfie → face | ARKit face tracking / MediaPipe | Most | **Yes** (already planned) | Biometric — consent + no attribute inference. |
| Body measurements from photo | Vision 3D body pose (`bodyHeight`, joints) | iOS 18+ | **Partial** | Height prior only; no girths. Typed measurements remain the source. |
| Missing back/side views | none | — | **No** | Stays on server. |
| Photo try-on | none | — | **No** | Stays on server. |
| 3D shoes/bags/hard accessories | **Object Capture (LiDAR Pro iPhones)** / none built-in | Pro iPhones only | **Partial** | $0, but a 360° capture flow and USDZ→glTF conversion; only relevant once G3 + Filament resume. |
| 3D garments | none | — | **No** | Neither platform nor any service does riggable garments (§4.4). |
| Avatar | our Anny fitting code | All | n/a — already $0 | — |
| Explanations / chat | Foundation Models / Gemini Nano | AI devices | **Partial** | Explanations stay **templates from reason codes** (DEC-46). Future chat must call application services. |

**Bottom line on "use the iPhone's AI as much as possible":** the plan already puts every task that phones can do well on the phone. The one genuinely new lever is **iOS 27 multimodal Foundation Models for attribute tagging** (and Gemini Nano on Android), which is worth an eval arm in P06 — but because extraction already costs only ≈ $0.0012/item, the **cost saving is ≈ $0.0004/item blended — roughly $0.02–0.06 once at onboarding and under $0.02/month afterwards**. The money is in try-on, which no phone can do.

---

## 3. Our servers vs a paid service (build vs buy)

### 3.1 Licences decide what is even possible

| Model | Licence | Commercial use for us? |
|---|---|---|
| **FASHN VTON v1.5** (try-on, 972M) | **Apache-2.0** (human-parser dependency licence still to confirm) | **Yes** — the best self-hostable try-on *(H, repo)* |
| CatVTON, IDM-VTON, OOTDiffusion | CC BY-NC-SA 4.0 | **No** *(H)* |
| Leffa | code MIT; weight licence + VITON-HD/DressCode training data unverified | Not until verified *(L)* |
| Qwen-Image-Edit | Apache-2.0 | **Yes** (missing views) *(H)* |
| FLUX.2 [klein] 4B | Apache-2.0 | **Yes** *(H)* |
| FLUX.1 Kontext [dev], FLUX.2 [dev], FLUX.2 [klein] 9B | FLUX non-commercial | **No** (managed endpoint only) *(H)* |
| TRELLIS / TRELLIS.2 (image→3D) | weights MIT, but depend on **nvdiffrast (NVIDIA non-commercial)** | **Only after replacing the rasteriser** + legal review *(H)* |
| Hunyuan3D 2.0 / 2.1 | Tencent community licence **excluding EU, UK, South Korea**; >1M MAU needs Tencent approval | **No** for a global app *(H)* |
| Hunyuan3D 2.5 / 3.x | no open weights — API only | managed only |
| SF3D / SPAR3D (Stability) | Community licence, free under $1M annual revenue | Until $1M revenue *(H)* |
| TripoSR, TripoSG, Direct3D-S2, Hi3DGen | MIT | **Yes**, but geometry-only or low texture quality *(H)* |
| Step1X-3D | Apache-2.0 (texture stage SDXL-based) | Yes, slow (≈152 s/asset) *(H)* |
| SAM 3D Objects / Body (Meta) | SAM License — commercial allowed with use restrictions | Yes *(H)* |

### 3.2 GPU cost per image (explicit arithmetic)

Serverless rates (M): RunPod flex H100 **$0.00116/s**, Modal H100 **$0.001097/s**, Modal L4 $0.000222/s. Dedicated: Hetzner **GEX44** (RTX 4000 SFF Ada 20 GB) reported **€184–234/mo** (sources conflict; 20 GB is too small for most 3D models), **GEX131** (RTX PRO 6000 96 GB) **€889–1,199/mo** (L–M). fal.ai H100 list price $4.50/h.

**Try-on, FASHN VTON v1.5 on H100** — 5 s inference (vendor figure, M) + 2 s pre/post (assumption) = 7 s billed warm; cold start assumed 30 s, idle tail 10 s, cold-start share falling with volume (assumption):

| Try-ons / month | Billed s per job | $/try-on self-host | Self-host GPU $/mo | fal FASHN $/mo (×$0.075) | Saving/mo |
|---|---|---|---|---|---|
| 100 | 7 + 30 + 10 = 47 | $0.0545 | $5 | $8 | $2 |
| 1,000 | 27 | $0.031 | $31 | $75 | $44 |
| 10,000 | 11 | $0.0128 | $128 | $750 | $622 |
| 100,000 | 7.8 | $0.009 | $905 | $7,500 | $6,595 |

**Engineering cost (estimate, not measured):** 4–8 person-weeks for the first model (CUDA container, serverless handler + memory snapshots, pg-boss/idempotency/DLQ wiring, `just ml-eval` against fal on a golden set, observability, licence review), then 0.5–1 day/week upkeep. At an assumed $3k/person-week (6 weeks ≈ $18k): payback ≈ **29 months at 10k/mo**, **≈ 5.5 months at 50k/mo**, **≈ 2.7 months at 100k/mo**.

**3D asset (if ever needed):** TRELLIS.2 @1024 ≈ 37 s warm on H100 → ≈ $0.043 (licence problem above); Step1X-3D ≈ 152 s → $0.176; batched on a rented H100 pod at $2.99/h ≈ $0.03–0.13/asset. Versus managed SAM 3D Objects at **$0.02** and Tripo at $0.30. 3D assets are generated **once per item and cached forever**, so volume is bounded by closet growth — self-hosting 3D is not worth optimising.

### 3.3 Verdict

1. **Now and until ≈ 20–30k try-ons/month:** managed (fal.ai, or FASHN direct at volume tiers), behind the existing `platform` port, cached by input hash. This is exactly the current plan — **keep it**.
2. **At sustained ≈ 30–50k try-ons/month, or if the privacy review demands photos never reach a model vendor:** self-host **FASHN VTON v1.5** on serverless GPU (Modal/RunPod) with fal as automatic fallback. Expected ≈ $0.009–0.013/image. This is already DEC-47's P11 eval arm — this research adds the **volume trigger**.
3. **At steady 100k+/month:** a dedicated 96 GB GPU server (Hetzner GEX131-class) as the baseline worker with serverless overflow; re-check prices first.
4. For a 2–3 person team, the hidden cost is **24/7 GPU on-call**; never make self-hosting a single point of failure.

---

## 4. Best quality / price services (re-verified 2026-10-04)

### 4.1 Planned fal.ai prices — re-check

**No price changes since r6 (2026-09-09)** on any planned endpoint: FASHN v1.6 $0.075, Kling Kolors $0.07, Leffa $0.10, FLUX.2 [dev] $0.012/MP, Schnell $0.003/MP, Kontext pro $0.04, BiRefNet v2 $0.0008/compute-s, Bria RMBG $0.018. *(M — search extracts of fal.ai model pages)* One open item: the billing unit of `flux-2-lora-gallery/virtual-tryon` ($0.021 "per MP" vs "per compute-second") must be confirmed on the page. Note: **FLUX Schnell is text-to-image only** — it cannot condition on the garment photo, so it is not a real missing-view option (doc 10 §2.4 lists it as one).

### 4.2 Photo try-on

| Option | $/image (≈1 MP) | Quality evidence | Notes | Conf. |
|---|---|---|---|---|
| **FASHN v1.6** on fal (current pick) | **$0.075** | Specialist; top of fal's own 2026 ranking | Performance/Balanced/Quality modes 7–19 s | M |
| FASHN v1.6 direct, volume tiers | $0.067 → $0.060 → **$0.049** (Tier III, $1,249/mo) → "<$0.04" custom | same model | Inputs not stored; outputs deleted after 72 h | M |
| **FASHN Try-On Max** (direct only) | $0.15–0.375 | FASHN's recommended model; better fabric/logo detail | Quality ceiling | M |
| **BFL FLUX VTO** (`fal-ai/flux-pro/v1/vto`, BFL, Runware) | **≈ $0.0425–0.0475** | Specialist; <4 s; **up to 4 garments in one call**; released 2026-05-28 | Best-value candidate — three hosts reduce lock-in (RISK-10) | M |
| Kling Kolors on fal | $0.07 | specialist | — | M |
| Google Vertex AI Virtual Try-On | $0.06 | specialist | **Discontinuation date 2027-01-20 — avoid** | H (price) |
| `flux-2-lora-gallery/virtual-tryon` | ≈ $0.021 (unit to confirm) | unproven | existing P11 cost arm | M |
| Pixelcut / Perfect Corp / WaveSpeed | $0.10 / $0.096–0.11 / $0.12 | — | no reason to switch | M/L |
| Replicate IDM-VTON | ≈ $0.024 | — | **non-commercial licence — unusable** | H (licence) |
| Self-hosted FASHN VTON v1.5 | ≈ $0.009–0.013 GPU + engineering | quality vs v1.6 unmeasured | §3 | M |

There is **no independent try-on leaderboard**; 2026 papers find dedicated try-on models beat generalist editors (Nano Banana Pro, GPT Image 2) on garment and identity fidelity. → **Run the P11 blind eval with FASHN v1.6 (baseline), FLUX VTO (value), FLUX 2 LoRA (cost), self-hosted FASHN VTON v1.5 (privacy/scale).**

### 4.3 Missing back/side views

| Option | $/image | Notes | Conf. |
|---|---|---|---|
| **FLUX.2 [dev] on fal** (current pick) | $0.012/MP | managed only (non-commercial weights) | M |
| FLUX.2 [klein] on fal | $0.006/MP | 4B variant is Apache-2.0 (self-hostable) | M |
| **Gemini 3.1 Flash-Lite Image ("Nano Banana 2 Lite")** | $0.034, **batch ≈ $0.017** | new 2026-06-30; 1K max; Gemini paid tier = no training, 55-day abuse logs | H (Vertex page) |
| Gemini 2.5 Flash Image | $0.039, batch $0.0195 | — | H |
| Seedream 4.0 / 5.0 Lite | $0.03 / $0.035 | strong in a 2026 multi-garment human-preference study | M |
| Qwen-Image-Edit (fal / Runware) | ≈ $0.031 / from $0.014 | Apache-2.0 open weights | M |
| Nano Banana Pro (Gemini 3 Pro Image) | $0.134 (batch $0.067) | quality ceiling | H |
| GPT Image 2 | $0.006 low / $0.053 medium / $0.211 high | top of AA image-editing leaderboard | M |

Missing views are not latency-critical → **batch pricing (−50%) + content-hash cache** fits. Keep FLUX.2 [dev] as the pick; add Nano Banana 2 Lite (batch) and Qwen-Image-Edit as SPK-2 arms.

### 4.4 3D assets (only relevant if G3 is pursued)

| Service | $/textured asset | Strength | Conf. |
|---|---|---|---|
| **Tripo v3.x** (fal or direct at $0.01/credit) | **$0.30** standard, $0.40 HD, +$0.05 quad | clean topology, multiview input, cheapest good tier | M |
| **Hunyuan3D v3.1 Pro** (fal) | $0.375 base, **$0.525 with PBR**, $0.675 with PBR + back view | best looks in aggregator Elo; up to 8 views | M |
| Tencent Hunyuan 3D Global API (direct) | $0.34–0.50 | same family; Tencent DPA | M |
| Meshy-6 (direct) | ≈ $0.30–0.60 | rich export formats; API assets deleted after ≤3 days | M/L |
| Hyper3D Rodin Gen-1 / Gen-2 | $0.40 / ≈ $0.80 | high detail, messier mesh | M/L |
| TRELLIS.2 (fal / resellers) | sources conflict: $0.025–0.82, most say **$0.25–0.35** | MIT weights, full PBR | L |
| **SAM 3D Objects** (fal) | **$0.02** | cheap, research-grade texture; splat/mesh | M |
| Apple Object Capture | **$0 on-device** | real photogrammetry; LiDAR Pro iPhones; rigid objects only | H |

**Garments are the exception:** every image-to-3D service outputs one closed rigid shell (a flat-laid T-shirt becomes a slab). No managed API turns a photo into a separated, riggable, body-fitting garment; the research systems (ChatGarment, AIpparel, Dress-1-to-3, GarVerseLOD…) are GPU-heavy and mostly unlicensed for commerce. Precedent confirms it: Google, Zara, Alta and Doppl show "you wearing it" with **2D generative try-on**; 3D try-on in industry (Snap shoes, Zalando pilot, DressX) uses **brand-authored** 3D assets. **Doc 07's G3 template plan is the right one**: stock rigged garments cost **$2–8.50** on CGTrader before refitting to Anny; Marvelous Designer $280/yr, CLO $450/yr; freelancers $18–40/h (≈ $40–200+ per garment) — consistent with the plan's $50–500/template.

**Body-model findings that matter for P01/P04:**
- Anny code is Apache-2.0 and its assets CC0, but **its optional SMPL-X topology is non-commercial** — we must ship the native `anny` topology (doc 07 already names `anny-topo-v1`; make it explicit). *(H — github.com/naver/anny)*
- The Anny repo documents **13,718 vertices and 1,136 prototype blendshapes, PLY export, no glTF export and no mobile port**; Filament caps morph targets at **256 per renderable**. Doc 07 §3.1 says "256 local blend shapes". The P01 spike must confirm the count and pick a path: PCA to 16–64 morph targets at build time, or bake vertices on-device from ported fitting math. *(H for repo + Filament limit; M for the path)*
- **Meshcapade was acquired by Epic Games (Nov 2025)** — SMPL licensing (€5,000/yr micro tier) is now even less attractive; Anny stays the right choice. **Ready Player Me shut down 2026-01-31.** *(H/M)*
- Paid photo-to-measurement APIs cost **≈ $1–5 per scan** (3DLOOK $499/mo for 100 scans); not justified before evidence that fit precision drives retention. *(M)*

---

## 5. Privacy notes that affect the choice

| Provider | Training on API data | Retention | Conf. |
|---|---|---|---|
| fal.ai | no-training statement **not confirmed** — get DPA in writing (AIC-O2) | stores request I/O and media by default; `X-Fal-Store-IO: 0` and object-lifecycle headers reduce it | M |
| FASHN direct | not stated | inputs not stored; outputs deleted after 72 h | M |
| Gemini API (paid) | not used for training | 55-day abuse logs | M |
| OpenAI API | not by default | 30-day abuse logs; ZDR on approval | M |
| Runware | never trains | optional ZDR (outputs deleted after 60 s) | M |
| Replicate | — | API predictions deleted after 1 h | M |

Every provider must be on the doc 10/11 approved list before user photos go to it. Self-hosting removes the model vendor from the data path entirely — for an EU-facing product, **privacy may justify self-hosted try-on before cost does**.

---

## 6. Cost per user

All figures are **modelled estimates** (doc 10 §5 method), not measurements; P06/P11 telemetry replaces them. Revenue nets out a 15% store fee (SPINE §6 base case). Infra share ≈ $0.08/active user at 5k MAU (r6 upper-bound hypothesis).

### 6.1 Unit costs under three strategies

| Unit | A — current plan | B — recommended managed (if evals pass) | C — self-hosted try-on at ≥30–50k/mo |
|---|---|---|---|
| Closet item processed | $0.0021 | $0.0017–0.0021 (on-device tagging on AI-capable phones) | same as B |
| Try-on image (+10% retry) | **$0.0825** (FASHN v1.6) | **≈ $0.052** (FLUX VTO $0.0475) — or $0.054 FASHN Tier III | **≈ $0.014** GPU (+ fixed eng.) |
| Missing view (+10%) | $0.013 (FLUX.2 dev) | $0.013 (or ≈ $0.019 Nano Banana 2 Lite batch) | $0.013 |
| Cost per credit (try-on ÷ 3) | $0.0275 | $0.017 | ≈ $0.005 |

### 6.2 Monthly cost to serve one user (100% of credits used — the cap-burner case)

| Plan (net revenue/mo: monthly · annual) | Non-credit AI + infra | Credits: A | Credits: B | Credits: C | **Total A** | **Total B** | Gross margin A (monthly · annual) | Gross margin B (monthly · annual) |
|---|---|---|---|---|---|---|---|---|
| **Free** ($0) | $0.01 + $0.08 | — | — | — | **≈ $0.09** | ≈ $0.09 | — | — |
| **Essentials** ($4.24 · $2.83) — 10 views | $0.05 + $0.08 | $0.13 | $0.13 | $0.13 | **$0.26** | $0.26 | 94% · 91% | 94% · 91% |
| **Plus** ($8.49 · $5.67) — 20 try-ons | $0.15 + $0.08 | $1.65 | $1.04 | ≈ $0.28 | **$1.88** | $1.27 | 78% · 67% | 85% · 78% |
| **Pro** ($16.99 · $10.62) — 50 try-ons | $0.15 + $0.08 | $4.13 | $2.61 | ≈ $0.70 | **$4.36** | $2.84 | 74% · 59% | 83% · 73% |

At the industry-typical **30–50% credit utilisation**, Pro's credit cost is ≈ $1.24–2.07 (A) or ≈ $0.78–1.31 (B).

### 6.3 One-time costs per user

| Event | A | B |
|---|---|---|
| Onboarding (closet 50–150 items) | $0.08–0.24 | $0.07–0.24 |
| 3-day trial (15 credits = 5 try-ons) | $0.41 | $0.26 |
| *If G3 ships:* 3D model of one shoe/bag/accessory | Tripo $0.30 · Hunyuan Pro $0.53–0.68 · SAM 3D $0.02 · Object Capture $0 | same |

3D accessories are one-time per item but not small: 15 accessories × $0.30 = $4.50 per user. If G3 adopts managed image-to-3D, meter it with credits (≈ 10–12 credits/asset at today's $0.0275/credit) or offer on-device Object Capture as the free path.

### 6.4 What this means for user pricing

- The SPINE §6 price hypotheses ($4.99 / $9.99 / $19.99; $39.99 / $79.99 / $149.99) **hold up under verified costs**: the worst case (Pro annual, every credit burned, current FASHN price) still leaves ≈ 59% gross margin before fixed costs.
- A cheaper try-on that passes the P11 eval (FLUX VTO ≈ $0.052, or self-hosted ≈ $0.014) mainly creates room to **relax try-on from 3 to 2 credits** (OQ-11, DEC-34), i.e. Plus = 30 try-ons and Pro = 75, rather than to cut prices.
- Top-up packs at ≈ $0.50 retail per try-on stay ~80–90% margin under any strategy.

---

## 7. Recommendations

1. **Keep the architecture.** On-device first for pixels, deterministic avatar, managed fal.ai for 2D generation, templates for G3. The research confirms each choice; nothing calls for an ADR reversal.
2. **P06 — add one on-device eval arm:** iOS 27 Foundation Models image input (`@Generable` over the `closet` taxonomy) and Gemini Nano Prompt API for attribute tagging on capable devices, server fallback otherwise. Test on an 8 GB iPhone 15 Pro. Also use iOS 27 tap-to-segment for the manual cutout fix. Needs a doc-10 §2.2 amendment.
3. **P11 — add BFL FLUX VTO (≈ $0.0475) as a try-on arm** next to FASHN v1.6, FLUX 2 LoRA and self-hosted FASHN VTON v1.5. Add Nano Banana 2 Lite (batch) and Qwen-Image-Edit to SPK-2. Drop Schnell as a missing-view option (text-to-image only). Do not use Vertex VTO (sunset 2027-01-20).
4. **Self-hosting trigger:** move try-on to self-hosted FASHN VTON v1.5 on serverless GPU at **sustained ≥ 30–50k try-ons/month** or when the privacy review requires it; dedicated GPU only at 100k+/month. Keep fal as fallback.
5. **Licence guardrails** (add to the AI provider checklist): no CatVTON / IDM-VTON / OOTDiffusion / FLUX dev or klein-9B weights / Hunyuan3D 2.x open weights / MobileCLIP / SHARP; TRELLIS only with nvdiffrast replaced; Stability 3D models only under $1M revenue.
6. **P01/P04 — Anny:** ship the native `anny` topology (not SMPL-X); confirm the blendshape count against Filament's 256-morph cap and choose PCA vs on-device bake.
7. **G3 (later):** templates for garments; for rigid accessories evaluate Apple Object Capture ($0, Pro iPhones) vs Tripo v3.x ($0.30) vs SAM 3D Objects ($0.02), all provenance-marked.
8. **Before any money is committed:** re-confirm the Medium-confidence prices on live pages (this environment could not open vendor sites — §9) and get fal.ai's DPA/no-training terms in writing.

## 8. Proposed decision-log entries (for the owner — not applied)

`planning/16-…` is human-only. Suggested entries if the owner accepts this research:

| Proposed ID | Proposal | Touches |
|---|---|---|
| DEC-xx | P06 attribute extraction adds an **on-device arm** (iOS 27 Foundation Models image input / Gemini Nano Prompt API) on capable devices, server path unchanged for the rest | doc 10 §2.2, AIC-O1 |
| DEC-xx | P11 try-on gate adds **BFL FLUX VTO** as an arm; Vertex VTO excluded (sunset 2027-01-20) | doc 10 §2.5/§3, AIC-O5, OQ-11 |
| DEC-xx | SPK-2 adds **Gemini 3.1 Flash-Lite Image (batch)** and **Qwen-Image-Edit**; FLUX Schnell removed as a missing-view option (no image conditioning) | doc 10 §2.4 |
| DEC-xx | **Self-hosting trigger** for try-on: sustained ≥ 30–50k/month or privacy-review requirement; fal kept as fallback | DEC-47, RISK-10 |
| ASM-xx | Anny ships with native topology; blendshape count vs Filament 256 morph cap verified in P01 | doc 07 §3.1, P01 |
| OQ-xx | Confirm fal.ai DPA / no-training terms for model APIs (extends AIC-O2) | doc 11 |

## 9. Method, confidence, and what was not verified

- **Method:** five parallel research agents (on-device AI; managed image-to-3D; self-hosting + GPU prices; try-on and image-edit prices; avatar/garment 3D), plus the lead's spot checks, on 2026-10-04.
- **Constraint:** this environment's network policy **blocked direct fetches** of most vendor sites (fal.ai, fashn.ai, meshy.ai, tripo3d.ai, runpod.io, modal.com, hetzner.com, huggingface.co, ai.google.dev, openai.com…). Apple developer docs, Google Cloud's Vertex pricing page and GitHub LICENSE files **were fetched directly (High)**. Every other price comes from search-engine extracts of the vendor's own page or from secondary trackers (**Medium**), or from conflicting/secondary sources only (**Low**). Labels: **H** = official page fetched · **M** = search extract of official page or reputable secondary · **L** = secondary only or sources conflict.
- **Not verified / open:** fal.ai no-training/DPA terms; billing unit of `flux-2-lora-gallery/virtual-tryon`; TRELLIS.2 price on fal (sources range $0.025–0.82); exact Hetzner GEX44/GEX131 prices (sources conflict after 2026 price rises); FASHN VTON v1.5 VRAM and runtime on non-H100 GPUs; whether Foundation Models image input runs on 8 GB iPhones; Foundation Models context size (4K vs 8K); Gemini Nano device share; Leffa weight licence; fashn-human-parser licence; Anny blendshape count vs doc 07's "256".
- **Engineering-effort and cold-start figures are reasoned estimates**, labelled as assumptions in §3.2.

## Sources (primary links; per-row sources are inline above)

- Apple: [Foundation Models](https://developer.apple.com/documentation/foundationmodels) · [Analyzing images with multimodal prompting](https://developer.apple.com/documentation/foundationmodels/analyzing-images-with-multimodal-prompting) · [Private Cloud Compute for apps](https://developer.apple.com/documentation/foundationmodels/adding-server-side-intelligence-with-private-cloud-compute) · [Acceptable use requirements](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/) · [GenerateIterativeSegmentationRequest](https://developer.apple.com/documentation/vision/generateiterativesegmentationrequest) · [Vision updates](https://developer.apple.com/documentation/updates/vision) · [ImageCreator](https://developer.apple.com/documentation/imageplayground/imagecreator) · [Object Capture (WWDC23-10191)](https://developer.apple.com/videos/play/wwdc2023/10191/) · [Core AI](https://developer.apple.com/documentation/coreai) · [MobileCLIP model licence](https://raw.githubusercontent.com/apple/ml-mobileclip/main/LICENSE_MODELS) · [Classmethod: FM multimodal test](https://dev.classmethod.jp/en/articles/foundation-models-multimodal-image-analysis/)
- Android: [Gemini Nano](https://developer.android.com/ai/gemini-nano) · [Prompt API blog](https://developer.android.com/blog/posts/ml-kit-s-prompt-api-unlock-custom-on-device-gemini-nano-experiences) · [I/O '26 AI on Android](https://developer.android.com/blog/posts/top-ai-on-android-updates-for-building-intelligent-experiences-from-google-i-o-26)
- Try-on / image edit: [fal FASHN v1.6](https://fal.ai/models/fal-ai/fashn/tryon/v1.6) · [fal FLUX VTO](https://fal.ai/models/fal-ai/flux-pro/v1/vto) · [BFL FLUX VTO launch](https://bfl.ai/blog/flux-vto-virtual-try-on-at-catalog-scale) · [Runware FLUX VTO](https://runware.ai/docs/models/bfl-flux-virtual-try-on) · [FASHN API pricing](https://help.fashn.ai/plans-and-pricing/api-pricing) · [FASHN data retention](https://docs.fashn.ai/api-overview/data-retention-privacy) · [Vertex AI generative pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) · [fal best try-on APIs 2026](https://fal.ai/learn/tools/best-virtual-try-on-apis-2026) · [FASHN VTON v1.5 repo](https://github.com/fashn-AI/fashn-vton-1.5) · [IDM-VTON](https://github.com/yisol/IDM-VTON) · [CatVTON](https://github.com/Zheng-Chong/CatVTON) · [FLUX.2 repo](https://github.com/black-forest-labs/flux2) · [Qwen-Image](https://github.com/QwenLM/Qwen-Image)
- 3D: [fal Hunyuan3D v3](https://fal.ai/models/fal-ai/hunyuan3d-v3/image-to-3d) · [fal Tripo v2.5](https://fal.ai/models/tripo3d/tripo/v2.5/image-to-3d) · [fal SAM 3D Objects](https://fal.ai/models/fal-ai/sam-3/3d-objects) · [Tripo v3.1 API](https://developers.tripo3d.com/en/models/v3-1) · [Meshy API pricing](https://docs.meshy.ai/en/api/pricing) · [Tencent Hunyuan 3D Global billing](https://www.tencentcloud.com/document/product/1284/75281) · [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) · [nvdiffrast licence](https://raw.githubusercontent.com/NVlabs/nvdiffrast/main/LICENSE.txt) · [Hunyuan3D-2.1 licence](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2.1/main/LICENSE) · [SAM 3D Objects licence](https://raw.githubusercontent.com/facebookresearch/sam-3d-objects/main/LICENSE) · [Stable Fast 3D licence](https://raw.githubusercontent.com/Stability-AI/stable-fast-3d/main/LICENSE.md) · [TRELLIS.2 reseller prices (layer.ai)](https://www.layer.ai/models/microsoft-trellis-2) · [EmpirioLabs TRELLIS.2](https://empiriolabs.ai/models/trellis-2-4b)
- Body / garments: [Anny](https://github.com/naver/anny) · [Filament morph cap (EngineEnums.h)](https://raw.githubusercontent.com/google/filament/main/libs/filabridge/include/private/filament/EngineEnums.h) · [Meta MHR](https://github.com/facebookresearch/MHR) · [SAM 3D Body licence](https://raw.githubusercontent.com/facebookresearch/sam-3d-body/main/LICENSE) · [Meshcapade → Epic (MPG)](https://www.mpg.de/26082348/max-planck-spin-off-draws-epic-games-to-tubingen) · [Avatar platforms 2026 (Ready Player Me shutdown)](https://avatarsdk.com/blog/2026/08/31/avatar-platforms-2026-whos-alive-whos-gone) · [ChatGarment](https://github.com/biansy000/ChatGarment) · [AIpparel](https://github.com/georgeNakayama/AIpparel-Code) · [GarmentCode](https://github.com/maria-korosteleva/GarmentCode) · [CGTrader clothing example](https://www.cgtrader.com/3d-models/character/clothing/mens-puffer-jacket-3d-clothing) · [Google try-on](https://blog.google/products/shopping/virtual-try-on-google-generative-ai/) · [Snap foot tracking](https://developers.snap.com/lens-studio/features/try-on/foot-tracking)
- GPU: [Hetzner GEX131 press release](https://www.hetzner.com/pressroom/new-gex131/) · [RunPod pricing](https://www.runpod.io/pricing) · [Modal pricing tracker](https://devtune.ai/verticals/aiml-infrastructure-llm-tools/modal/pricing) · [Replicate pricing](https://replicate.com/pricing) · [Modal memory snapshots](https://modal.com/blog/comfyui-mem-snapshots)
