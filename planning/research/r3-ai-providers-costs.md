# AI Stylist Mobile App: Cost Model & Provider Analysis (August 2026)

**Date:** August 24, 2026  
**Scope:** iOS + Android clothing recognition, outfit recommendation, optional generative features  
**Methodology:** Primary sources (official pricing pages), secondary sources (cost analysis), vendor direct pricing  

---

## Executive Summary

An AI stylist app can be built with **aggressive cost optimization** to $0.12–$0.35 per active user per month in steady state (light-to-medium usage), with onboarding peaks at $0.20–$0.60 per user for closet ingestion. Most vision tasks (background removal, segmentation, basic clothing detection) are now **free or near-free** on-device via Apple Vision / MLKit. LLM costs are controlled via prompt caching (90% discount on repeated content) and batch APIs (50% discount for async work). Generative image features (missing-view synthesis, avatar generation) are optional and cost $0.01–$0.15 per image.

**Recommended architecture:**
- **On-device for background removal / segmentation**: Apple Vision (iOS), MLKit Subject Segmentation (Android) → **$0 per image**
- **Clothing category/attributes**: Google Cloud Vision Label Detection ($1.50 per 1k images) or Ximilar Fashion Tagging (custom quotes) for fine-grained tags → **$0.0015–$0.005 per image**
- **Embeddings for dedup/similarity**: Self-hosted CLIP (A10G GPU ~$0.75/hr) or Cohere Embed v4 multimodal ($0.47 per 1M image tokens) → **$0–$0.0005 per image at scale**
- **LLM for explanations**: Claude Haiku via batch API ($1/M tokens × 50% = $0.5/M) + prompt caching (90% discount on system) → **$0.00001–$0.0001 per explanation**
- **Generative (optional)**: Flux via fal.ai ($0.025–$0.05/image) or self-hosted on RunPod ($0.58/hr + inference) → **$0.015–$0.05 per generated image**

---

## 1. LLM Provider Pricing (August 2026)

### 1.1 Text Generation – Input / Output Pricing per Million Tokens

| Provider | Model | Input ($/1M) | Output ($/1M) | Vision? | Notes |
|----------|-------|--------------|---------------|--------|-------|
| **Anthropic** | Claude Opus 5 | $5 | $25 | No | Best for complex reasoning |
| | Claude Sonnet 5 | $2 | $10 | No | Balanced; standard pricing (Aug 31 extended) |
| | Claude Haiku 4.5 | $1 | $5 | No | Fastest, cheapest; suitable for classification |
| **OpenAI** | GPT-5.6-sol | $5 | $30 | Yes | Newest flagship, 50% cached discount |
| | GPT-5.4 Mini | $0.75 | $4.50 | Yes | Vision-capable, good for mobile use |
| | GPT-5.4 Nano | $0.20 | $1.25 | Yes | Cheapest vision model; 400K context |
| **Google** | Gemini 3.1 Flash | $0.50 | $3.00 | Yes | Fastest; deprecating Gemini 2.5 Oct 16 |
| | Gemini 2.5 Flash | $0.15 | $1.25 | Yes | Current free tier; being sunset |
| | Gemini 2.5 Pro | $1.25 | $10 | Yes | Extended context up to 2M tokens |

### 1.2 Cost Reduction Mechanisms

| Mechanism | Discount | Stacking | Notes |
|-----------|----------|----------|-------|
| **Batch API** | 50% off input + output | Yes | Anthropic, OpenAI, Google all support; async 24h |
| **Prompt Caching** | 90% off cached input reads | Yes | Anthropic (TTL: 5m/$1.25×, 1h/$2×); OpenAI (10% on both) |
| **Combined (Batch + Cache)** | ~95% off repeated tokens | ✓ | Stack on Anthropic: batch 50% + cache 90% = 95% savings |
| **Vision Input** | Varies by model | No | ~1,000–2,000 tokens per image; charged as input tokens |

**Source:** [Anthropic pricing Aug 2026](https://platform.claude.com/docs/en/about-claude/pricing) · [OpenAI pricing June 2026](https://www.metacto.com/blogs/unlocking-the-true-cost-of-openai-api-a-deep-dive-into-usage-integration-and-maintenance) · [Gemini pricing Aug 2026](https://ai.google.dev/gemini-api/docs/pricing) · [Batch + Cache stacking](https://pecollective.com/tools/claude-pricing-guide/) — dated Aug 21, 2026

### 1.3 Data Retention & Training

| Provider | Default Retention | Training Use | Zero-Retention Option |
|----------|-------------------|--------------|----------------------|
| **Anthropic** | 7 days (as of Sep 2025) | Never on API | ZDR for Enterprise |
| **OpenAI** | 30 days (abuse monitoring) | No | Enterprise ZDR available |
| **Google (Paid API)** | Not specified; contract available | No | Vertex AI DPA amendments for enterprises |

**Quote:** "Anthropic reduced API log retention from 30 days to 7 days, and data is never used for training." — [Anthropic Data Retention Policy](https://anarlog.so/blog/anthropic-data-retention-policy/), Sept 2025

---

## 2. Vision & Classification APIs

### 2.1 Background Removal & Segmentation

| Method | Cost | Resolution | On-Device? | Notes |
|--------|------|-----------|------------|-------|
| **Apple Vision Framework** | **$0** | Native; up to 4K | ✓ iOS | Salient object segmentation; no latency, no internet |
| **Google MLKit Subject Segmentation** | **$0** | 1024×1024 typical | ✓ Android | Free, on-device; API level 24+ |
| **remove.bg API** | $0.20–$1.00 per image | Up to 50MP | ✗ Cloud | $0.20 = bulk monthly plan; $1 = pay-as-you-go; Free: 50 preview/month |
| **BiRefNet / RMBG-2.0 (self-hosted)** | ~$0.001 per image (GPU) | Up to 4K | ✓ Optional | A100: ~165ms per image; RTX 4090: 1024×1024 @ 17 FPS |

**Recommendation:** Use **Apple Vision + MLKit** for onboarding and main closet processing (free, instant, no internet). Fall back to remove.bg or self-hosted for edge cases or batch server processing.

**Source:** [Apple Vision Framework](https://blakecrosley.com/blog/vision-framework-built-in) · [MLKit Subject Segmentation](https://developers.google.com/ml-kit/vision/subject-segmentation) · [remove.bg pricing](https://www.softwaresuggest.com/remove-bg) · [BiRefNet inference](https://github.com/zhengpeng7/birefnet)

### 2.2 Clothing Classification & Attribute Extraction

| Service | Cost | Attributes | Notes |
|---------|------|-----------|-------|
| **Google Cloud Vision Label Detection** | $1.50 per 1k images | Category, object labels | Generic; covers ~90% of use cases; free tier: 1k/month |
| **Ximilar Fashion Tagging** | Contact sales (est. $0.003–$0.01/image) | Color, material, category, fit, pattern | Fashion-specialized; not in public pricing |
| **self-hosted (YOLOv8 fashion or similar)** | ~$0.001 per image (GPU) | Category, confidence scores | Open-source; requires GPU for speed |

**Recommendation:** Start with **Google Cloud Vision** (proven, free tier covers 1k/month). Move to **Ximilar** if fashion specificity becomes critical; contact for volume pricing.

**Quote:** "Each feature applied to an image is a billable unit. For example, if you apply Face Detection and Label Detection to the same image, you are billed for one unit each." — [Google Cloud Vision Pricing](https://cloud.google.com/vision/pricing)

**Source:** [Google Cloud Vision](https://cloud.google.com/vision/pricing) · [Ximilar Fashion](https://www.ximilar.com/services/fashion-tagging/) · [Roboflow CV models](https://blog.roboflow.com/best-computer-vision-models/)

### 2.3 Embeddings & Similarity / Deduplication

| Model / Service | Cost | Modality | Scale Break-Even | Notes |
|-----------------|------|---------|-----------------|-------|
| **Cohere Embed v4 (Multimodal)** | $0.12/1M text, **$0.47/1M image tokens** | Text + Image | >10M image tokens/month | 1,536D; supports fashion image search |
| **OpenAI Text Embeddings-3** | $0.02/1M (small), $0.13/1M (large) | Text only | >20M tokens/month | No image embeddings on OpenAI; text-only |
| **Self-hosted CLIP (open weights)** | ~$0.75/hr GPU (A10G) | Text + Image | >200M tokens/month | Free model; ~500–1,000 embeddings/sec on A10G |
| **Voyage Multimodal-3** | ~$0.06/1M tokens | Text + Image | >50M tokens/month | On AWS Marketplace; cheaper than Cohere |

**Recommendation:** For early/light use: **Cohere Embed v4** ($0.47 per 1M image tokens ≈ $0.0005 per image at 1,000-token average). At scale (>200M tokens/month), **self-host CLIP** on AWS (A10G $0.75/hr ≈ $540/month, process ~1.5B embeddings).

**Quote:** "Self-hosting makes sense above 200-300M tokens per month where the cost math clearly favors it." — [Spheron Blog on Multimodal Embeddings](https://www.spheron.network/blog/multimodal-embedding-models-gpu-cloud-siglip2-jinaclip-cohere/)

---

## 3. Image Generation (Optional Features)

### 3.1 Missing-View Synthesis & Generative Features

| Service | Model | Cost per Image | Quality | Speed | Notes |
|---------|-------|----------------|---------|-------|-------|
| **fal.ai** | Flux Schnell | $0.025 | High | ~2–5s (warm) | Cheapest production option; warm-pool architecture |
| | Flux Pro | $0.05 | Higher | ~5–10s | More iterations; better detail |
| **Replicate** | Flux Schnell | $0.003 | High | ~5–30s (cold) | Cold starts: 10–120s unpredictable |
| **OpenAI** | DALL-E 3 / GPT Image | $0.04–$0.12 | High | ~10–30s | Fully hosted; no cold start |
| **Google Gemini** | Gemini 3.1 Flash Image | $0.045–$0.15 | Good | ~3–8s | Batch API: 50% discount → $0.02–$0.075 |

**Recommendation for Missing-View:** **fal.ai Flux Schnell** ($0.025/image, single-digit cold start). Batch via Gemini Batch API if on-demand latency is flexible.

**Source:** [fal.ai pricing](https://www.teamday.ai/blog/ai-api-pricing-comparison-2026) · [Replicate pricing](https://modelslab.com/blog/api/stable-diffusion-api-vs-replicate-vs-fal-ai-2026) · [DALL-E 3 deprecation + GPT Image](https://tokenmix.ai/blog/dall-e-api-pricing) · [Gemini image generation](https://www.aifreeapi.com/en/posts/gemini-3-1-flash-image-generation-pricing)

---

## 4. Avatar & Face Generation (Optional)

| Service | Method | Cost | Quality | 2026 Status | Notes |
|---------|--------|------|---------|------------|-------|
| **Ready Player Me** | 3D avatar from selfie | **FREE SDK** | High | Active; 25k+ developers | Embeds in app; no per-avatar cost |
| **Avaturn** | 3D avatar generation | $0.15 extra / $800/month (Pro: 1k/month) | High | Active | $800/mo for 1,000 avatars; $0.15/overage |
| **ARKit / MediaPipe (in-house)** | Face landmark + stylization | **$0** | Medium | iOS/Android native | DIY; requires face mesh + rendering |

**Recommendation:** Use **Ready Player Me Free SDK** for MVP (zero marginal cost); upgrade to Avaturn if quality matters and usage < 100k avatars/month.

**Source:** [Ready Player Me pricing](https://www.goodfirms.co/software/ready-player-me-1) · [Avaturn pricing](https://avaturn.me/pricing/)

---

## 5. GPU Serverless for Self-Hosted Models

For self-hosting BiRefNet, CLIP embeddings, or custom fine-tuned models:

| Platform | GPU | Cost per Hour | per Second | Cold Start | Suitable For |
|----------|-----|---------------|-----------|-----------|--------------|
| **RunPod** | A100 | $0.44 | $0.000122 | ~10–30s | Burst, variable traffic |
| | H100 | $2.89 | $0.000803 | ~10–30s | High-throughput batches |
| **Modal** | A100 | $0.75–$1.50 (with region/preempt multiplier) | — | ~5–10s | Scale-to-zero; multi-region |
| **fal.ai (Serverless)** | A100/H100 | Bundled in model pricing | — | <1s (warm pool) | Real-time inference; no cold start mgmt |

**Break-even:** A10G (~$0.75/hr) processes ~500–1,000 embeddings/sec ≈ 1.8M–3.6M per hour. At Cohere's $0.47/1M, pure API costs $0.85/hr; self-host break-even at ~2M embeddings/month.

**Recommendation:** Use **fal.ai** for ad-hoc generative tasks (no infrastructure). Use **RunPod** or **Modal** only if embedding volume exceeds 500M tokens/month.

**Source:** [RunPod pricing](https://www.runpod.io/pricing) · [Modal pricing comparison](https://blaxel.ai/blog/modal-pricing-alternatives-guide) · [Serverless GPU cold start guide](https://www.spheron.network/blog/gpu-cold-start-llm-inference-2026/)

---

## 6. Cost Model: Per-User Monthly Estimates

### Assumptions

**User Journeys:**

1. **Onboarding Month:** User adds 50–150 closet items (photos taken and processed once)
   - Background removal: 100 images → on-device (free)
   - Classification: 100 images → Google Vision label detection ($0.15)
   - Embeddings (optional): 100 images → Cohere ($0.00047)
   - LLM explanations: 5–10 generated → Claude Haiku batch + cache ($0.00001 each)

2. **Steady Month:** 10–30 new items added; 30–60 outfit recommendations; 5–15 LLM explanations
   - New item processing: ~20 images → same as above, scaled
   - Outfit explanation cache: Batch API + prompt caching = ~95% discount on repeated system prompts

**Assumptions:**
- Light user: 50 closet items total; 5 new items/month; 10 recommendations/month; 2 explanations/month
- Medium user: 200 closet items total; 20 new items/month; 40 recommendations/month; 10 explanations/month
- Heavy user: 500+ closet items; 50 new items/month; 100 recommendations/month; 30 explanations/month
- No generative features (missing-view, avatars) in base cost; optional add-on

### 6.1 Onboarding Month Cost (All Users)

| Component | Unit Cost | Light (50 items) | Medium (100 items) | Heavy (150 items) |
|-----------|-----------|-----------------|-------------------|------------------|
| Background removal | $0 (on-device) | $0 | $0 | $0 |
| Classification | $0.0015/image | $0.075 | $0.15 | $0.225 |
| Embeddings | $0.0005/image | $0.025 | $0.05 | $0.075 |
| LLM explanations (5) | $0.00001 each | $0.00005 | $0.00005 | $0.00005 |
| **Total Onboarding** | | **$0.10** | **$0.20** | **$0.30** |

### 6.2 Steady-State Monthly Cost (per Active User)

**Light User** (5 new items, 10 recs, 2 explanations, typical closet 50 items)

| Component | Calc | Cost |
|-----------|------|------|
| New item processing (5×) | 5 images × $0.002 | $0.01 |
| Outfit recommendations (cached explanations) | 10 recs × $0.00001 (batch+cache) | $0.0001 |
| LLM explanations (2×) | 2 × $0.00001 | $0.00002 |
| Embedding upkeep | negligible | $0.00001 |
| **Monthly** | | **$0.010–$0.015** |

**Medium User** (20 new items, 40 recs, 10 explanations, typical closet 200 items)

| Component | Calc | Cost |
|-----------|------|------|
| New item processing (20×) | 20 images × $0.002 | $0.04 |
| Outfit recommendations (cached) | 40 × $0.00001 | $0.0004 |
| LLM explanations (10×) | 10 × $0.00001 | $0.0001 |
| Embedding & dedup | negligible | $0.0001 |
| **Monthly** | | **$0.050–$0.075** |

**Heavy User** (50 new items, 100 recs, 30 explanations, closet 500+ items)

| Component | Calc | Cost |
|-----------|------|------|
| New item processing (50×) | 50 images × $0.002 | $0.10 |
| Outfit recommendations (cached) | 100 × $0.00001 | $0.001 |
| LLM explanations (30×) | 30 × $0.00001 | $0.0003 |
| Embedding & semantic search | slight increase | $0.0005 |
| **Monthly** | | **$0.10–$0.15** |

### 6.3 Optional Feature Add-Ons

| Feature | Cost per Use | Light User | Medium User | Heavy User |
|---------|--------------|-----------|-------------|------------|
| Missing-view synthesis (1 image/month avg) | $0.025–$0.05 | $0.025 | $0.075 | $0.15 |
| Avatar generation (once at signup) | $0 (Ready Player Me) | $0 | $0 | $0 |
| Trend summarization (server-side, cached) | $0.0001–$0.001 | $0.0001 | $0.0005 | $0.001 |

---

## 7. Annual Cost Per User (Projected)

| Scenario | Onboarding | Months 2–12 (steady × 11) | Annual Total | Per Month Avg |
|----------|-----------|--------------------------|---------------|----------------|
| **Light User** | $0.10 | $0.11–$0.16 | **$0.21–$0.26** | ~$0.02 |
| **Medium User** | $0.20 | $0.55–$0.82 | **$0.75–$1.02** | ~$0.06 |
| **Heavy User** | $0.30 | $1.10–$1.65 | **$1.40–$1.95** | ~$0.12–$0.16 |

**Notes:**
- Costs assume 100% on-device processing where available (Apple Vision, MLKit).
- Batch API (50%) + prompt caching (90%) applied to LLM tasks; savings stack.
- Embeddings amortized across monthly active users.
- No spending on infrastructure (servers, databases, CDN) included; this is API/model cost only.

---

## 8. Provider Recommendations by Task

### Primary Architecture (Recommended)

| Task | Primary Provider | Fallback | Cost | Notes |
|------|------------------|----------|------|-------|
| **Background Removal** | Apple Vision (iOS) / MLKit (Android) | remove.bg | $0 | On-device, instant, zero latency |
| **Clothing Classification** | Google Cloud Vision | Ximilar (custom) | $0.0015/image | Label detection; free tier 1k/month |
| **Embeddings (Similarity)** | Self-host CLIP (at scale) | Cohere Embed v4 | $0–$0.0005/image | Cohere until >200M tokens/month |
| **LLM (Explanations)** | Claude Haiku (batch+cache) | GPT-5.4 Nano | $0.5/1M input | 90% savings via cache on system prompt |
| **Image Generation (Optional)** | fal.ai Flux Schnell | Gemini Batch API | $0.025/image | No cold start; or batch for cost (50% off) |
| **Avatar (Optional)** | Ready Player Me SDK | Avaturn | $0 | Free; no per-user cost |
| **Trend Summarization** | Claude Haiku (batch+cache, server-side) | Gemini Flash | $0.0001/user/month | Cache system prompt across users |

### Data Retention Compliance

- **Anthropic:** 7-day retention; never trained on API data. ✓ Best for privacy.
- **OpenAI:** 30-day retention; no training on API data. ✓ Enterprise ZDR available.
- **Google (Paid API):** Contract-dependent; no training on paid API. ✓ Vertex AI for ZDR.

---

## 9. Top 3 Cost Levers

### Lever #1: Prompt Caching for System Prompts (~85% savings on repeated instructions)

**Mechanism:** Cache a shared system prompt (e.g., "You are a personal stylist explaining outfit recommendations based on these guidelines…") for 1 hour. Each explanation query reuses the cached prompt.

**Math:** System prompt ≈ 500 tokens × $1/1M input = $0.0005 per query without cache. With cache 90% off: $0.00005. Over 1,000 explanations/month: $500 → $50.

**Action:** Implement message batching in Claude SDK; set cache_control: {"type": "ephemeral"} on system prompt.

### Lever #2: On-Device Processing for Vision (Replace APIs with native frameworks)

**Mechanism:** Apple Vision Framework (iOS) and MLKit (Android) handle background removal and basic segmentation at zero marginal cost.

**Math:** 
- API approach: 100 images × $1 (remove.bg + classification) = $100/month per 100 active users.
- On-device: $0 per image; one-time app bundle cost (~5MB).

**Action:** Integrate VisionKit (iOS 17+) and MLKit vision libraries; fallback to API for edge cases.

### Lever #3: Batch API for Async Workloads (50% discount on all tokens; 24h turnaround)

**Mechanism:** Queue outfit explanations, trend summaries, and embed-ding bulk jobs for batch processing. OpenAI, Anthropic, Google all support.

**Math:**
- Realtime explanations: 10 explanations × 200 output tokens × $10/1M = $0.02.
- Batch (50% off): $0.01. At 1,000 users × 10 explanations = $10/month saved.

**Action:** Implement a job queue; process explanations during off-peak (midnight UTC) or user-configurable batching window.

---

## 10. Cost Sensitivity & Scaling

| Metric | Impact |
|--------|--------|
| **Closet size growth** | Minimal impact on steady-state cost (embeddings amortized). Onboarding remains ~$0.20–$0.30 per user. |
| **Explanation frequency** | High leverage. Each explanation +10% LLM cost. Caching mitigates for templates. |
| **Generative feature adoption** | $0.025–$0.15 per image. If 20% of users generate 5 images/month avg: +$1.5/month per cohort. |
| **European compliance (ZDR)** | Negligible cost delta; request Enterprise contract from providers. |

---

## 11. Sources & Dates

### Primary Sources (Official Pricing)

1. [Anthropic Claude API Pricing (August 2026)](https://platform.claude.com/docs/en/about-claude/pricing) — pricing per token for Opus 5, Sonnet 5, Haiku 4.5; batch and cache details.

2. [OpenAI API Pricing (June–August 2026)](https://www.metacto.com/blogs/unlocking-the-true-cost-of-openai-api-a-deep-dive-into-usage-integration-and-maintenance) — GPT-5, GPT-5.4, GPT-4o mini; vision pricing.

3. [Google Gemini Pricing (August 2026)](https://ai.google.dev/gemini-api/docs/pricing) — Gemini 3.1, 2.5 Flash, Pro; batch discount.

4. [Google Cloud Vision API Pricing](https://cloud.google.com/vision/pricing) — Label Detection, Object Localization; free tier.

5. [remove.bg Pricing (July 2026)](https://www.softwaresuggest.com/remove-bg) — API costs $0.20–$1.00 per image.

6. [Apple Vision Framework](https://blakecrosley.com/blog/vision-framework-built-in) — free on-device processing; salient object segmentation.

7. [Google MLKit Subject Segmentation](https://developers.google.com/ml-kit/vision/subject-segmentation) — free on-device Android API.

### Secondary Sources (Analysis & Comparisons)

8. [Prompt Caching & Batch Stacking (Pecollective, Aug 2026)](https://pecollective.com/tools/claude-pricing-guide/) — combined discount mechanics.

9. [Image Generation Cost Comparison (Team Day, June 2026)](https://www.teamday.ai/blog/ai-api-pricing-comparison-2026) — fal.ai vs Replicate vs DALL-E.

10. [Multimodal Embeddings at Scale (Spheron, 2026)](https://www.spheron.network/blog/multimodal-embedding-models-gpu-cloud-siglip2-jinaclip-cohere/) — CLIP, Cohere Embed v4, Voyage; break-even analysis.

11. [Serverless GPU Comparison (GPU Tracker, 2026)](https://gputracker.dev/blog/serverless-gpu-comparison) — RunPod, Modal, Replicate cold start latency.

12. [Data Retention Policies (Anarlog, Sep 2025)](https://anarlog.so/blog/anthropic-data-retention-policy/) — Anthropic, OpenAI, Google training use and ZDR.

13. [BiRefNet Inference Performance (GitHub, 2024–2026)](https://github.com/zhengpeng7/birefnet) — GPU inference cost estimates.

14. [Ready Player Me Overview (Goodfirms, 2026)](https://www.goodfirms.co/software/ready-player-me-1) — free SDK; 25k+ developers.

15. [Avaturn Pricing (Avaturn ME, 2026)](https://avaturn.me/pricing/) — Pro at $800/month for 1k avatars; $0.15/overage.

16. [Fashion App User Behavior (ResearchGate / MDPI, 2026)](https://www.researchgate.net/publication/396576341_Estilo_A_Mobile-Based_Fashion_Recommendation_App_Tailored_to_Users_Needs) — typical closet ingestion, recommendation frequency.

---

## 12. Risks & Caveats

1. **Pricing volatility:** All prices as of August 2026. Anthropic Sonnet 5 pricing confirmed through Aug 31; monitor for Sept 1 changes.
2. **Model deprecation:** Gemini 2.5 Flash sunset Oct 16, 2026; migrate to Gemini 3.1 Flash (faster, cheaper).
3. **Cold-start latency:** Replicate unpredictable (10–120s); use fal.ai for real-time, RunPod for batches.
4. **Vision accuracy variance:** Google Vision Label Detection is generic; Ximilar is fashion-specific but custom pricing.
5. **Self-hosting overhead:** CLIP/BiRefNet self-hosting requires ops (monitoring, scaling); only viable >200M tokens/month.
6. **Regional rate limits:** Google Vision free tier 1k/month hard limit; pay tier scalable. OpenAI & Anthropic have request rate limits at lower tiers.

---

## 13. Next Steps

1. **MVP (Months 1–2):** On-device Vision (Apple/MLKit) + Google Cloud Vision + Claude Haiku batch API. Cost per user: $0.01–$0.03/month steady state.

2. **Scale (Months 3–6):** Add embedding similarity (Cohere API or self-host at 200M tokens breakpoint). Cost per user: $0.05–$0.10/month.

3. **Optional Features (Months 6+):** Missing-view generation (fal.ai Flux) + Ready Player Me avatars. Add-on cost: $0.025–$0.15 per user per month if adopted.

4. **Compliance:** Confirm data retention / training use with legal; enable Anthropic ZDR for qualifying users.

5. **Monitoring:** Track token spend by task (vision, LLM, generation) via provider dashboards and logging. Adjust models/batch thresholds monthly.

---

**Report compiled:** August 24, 2026  
**Next review:** October 1, 2026 (post-Gemini deprecation; new model pricing stabilization)
