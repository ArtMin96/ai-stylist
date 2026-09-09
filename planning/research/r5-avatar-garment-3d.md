# Research: 3D Avatar & Virtual Try-On Landscape (2025–2026)

> **⚠️ Price correction (2026-09-09):** the figures below were accurate research as of Aug 24, 2026 but several load-bearing prices were wrong or have since changed. Verified replacements live in [r6-pricing-verification-2026-09-09.md](r6-pricing-verification-2026-09-09.md), which supersedes this file wherever they differ. Known deltas: generative try-on on fal.ai costs **$0.07–0.075/image** (FASHN v1.6, Kling Kolors), not ~$0.003–0.01; only the FLUX 2 try-on LoRA is in the $0.021/MP range and its quality is unproven (P11 eval arm). The credit model was re-baselined accordingly (DEC-34).

**Date:** 2026-08-24  
**Depth:** Deep · **Sources:** 35+ (15+ primary) · **Files traced:** Benchmark data, API docs, licensing pages

---

## Executive Summary

The 3D avatar + virtual try-on space is **mature in 2D/generative methods, nascent in mobile 3D cloth simulation**. The winning strategy for a small team with limited budget is:

1. **Start with 2D outfit collage + generative photo try-on** (realistic, fast to ship, proven with Doji, BetterMirror, Fits)
2. **Use an open-source parametric body model** (Anny or MPFB2—both CC0/Apache 2.0, no licensing fees) for avatar personalization
3. **Layer in measurement→morph mapping** using 30+ anthropometric points (achieves 25-30% better accuracy than basic approaches)
4. **Defer 3D cloth simulation** to Phase 2 (not yet viable on mobile without GPU; PBD works on Meta Quest 3 but consumer phones lag)
5. **Use generative VTON backends** (fal.ai for speed, ~100ms cold starts vs Replicate's 2-3s queue latency)

---

## 1. Parametric Body Models & Licensing

### SMPL / SMPL-X (Max Planck)

**Status:** Commercial licensing available; **Cost:** Undisclosed; **Acquisition:** Epic Games acquired Meshcapade (parent company) in February 2026, closing April 2026; future licensing terms unclear.

- **Commercial path:** Contact smpl@max-planck-innovation.de; licensing through Meshcapade.com (now Epic Games subsidiary)
- **Standard license:** Prohibits commercial use; requires paid commercial license
- **Availability:** SMPL+H, SMPL-X, STAR, infant SMIL expected

Quote: "The software/data is also available for commercial licensing through Meshcapade.com" (SMPL-X Model License, Max-Planck-Gesellschaft).

**Verdict:** Not ideal for startup MVP—closed licensing, undisclosed pricing, recent acquisition creates uncertainty.

---

### MPFB2 (MakeHuman Community)

**Status:** Free & open-source; **License:** Source (GPLv3) + Assets (CC0); **First-party:** Yes

- Released 2025, runs as Blender 4.2+ plugin
- All core assets shared under Creative Commons CC0 (no attribution or payment required)
- GLB/GLTF export with morph targets natively supported
- Includes skin textures, clothing presets, and parametric adjustments
- Can generate diverse ages, genders, ethnicities, body builds

**Verdict:** Excellent for MVP. Zero licensing cost, commercial use explicitly allowed, mature Blender workflow.

Evidence: [MPFB :: MakeHuman Community](https://static.makehumancommunity.org/mpfb.html) · [License :: MakeHuman Community](https://static.makehumancommunity.org/about/license.html)

---

### Anny (Naver, 2025)

**Status:** Free & open-source; **License:** Apache 2.0; **Scope:** All ages (babies to elderly)

- Parametric body model with **11 interpretable shape parameters** (gender, age, weight, height, muscle, cup size, waist, etc.) + 256 local blend shapes
- Fully differentiable, scan-free, grounded in anthropometric data
- PyTorch-based; can export to GLTF/GLB
- Notably **does NOT restrict commercial use**
- Supports detailed measurement→avatar mapping (e.g., bust, waist, hip circumferences)

Quote: "Anny is a simple, fully differentiable, and scan-free human body model...released under a permissive Apache 2.0 open-source license" (Naver Labs Europe).

**Verdict:** Best-in-class for measurement-driven avatars. Interpretable parameters align perfectly with size/fit workflows.

Evidence: [GitHub: Naver/Anny](https://github.com/naver/anny) · [Human Mesh Modeling for Anny Body](https://arxiv.org/html/2511.03589v1)

---

### SUPR, STAR (Meta)

**Status:** Publicly available; derived from SMPL; improved with more scans (10,000+)

- STAR addresses SMPL's limited training diversity
- Both have similar 10-parameter shape spaces but broader coverage
- Open-access but check individual license terms for commercial use

---

### Ready Player Me

**Status:** Free for end users; **Cost:** Commercial licensing on negotiation; **Avatars:** CC-BY-NC-SA 4.0 (non-commercial by default)

- Avatar creation free; SDK free for developers
- **Critical:** Avatars created on RPM website are under CC-BY-NC-SA 4.0, NOT usable in commercial products without license upgrade
- Commercial use requires developer partnership agreement
- 20M+ player reach; brands can sell skins/outfits

**Verdict:** Risky for commercial app without negotiated licensing. Non-commercial default is a trap.

Evidence: [Ready Player Me Licensing & Privacy](https://docs.readyplayer.me/ready-player-me/support/terms-of-use)

---

### Avaturn

**Status:** Freemium SaaS; **Pricing:** Free (limited) → Pro ($800/month) → Enterprise (custom)

- Pro plan: 6,000 avatars/month ($0.15 per extra), API/SDK for customization
- Realistic 3D avatars; custom garment uploads supported
- Cloud-hosted avatar generation

**Verdict:** Good for outsourcing, expensive at scale ($800/month baseline).

Evidence: [Avaturn Pricing](https://avaturn.me/pricing/) · [Create avatar programmatically](https://docs.avaturn.me/docs/integration/api/create-avatar-with-api/)

---

### Daz3D

**Status:** Commercial licensing available; **Cost:** Game Dev License $2,500 (Daz Originals only)

- Commercial license required for use in games/interactive apps
- Only covers Daz-owned models; third-party vendors have separate, often restrictive licenses
- Widely used but ecosystem lock-in risk

**Verdict:** Too expensive and restrictive for startup MVP.

Evidence: [Daz 3D Licenses](https://www.daz3d.com/daz-licenses)

---

### Summary Table

| Model | License | Cost | Commercial? | Notes |
|-------|---------|------|-------------|-------|
| **Anny** | Apache 2.0 | Free | Yes | 11 params, all ages, best for fit |
| **MPFB2** | CC0/GPLv3 | Free | Yes | Blender-native, mature, diverse |
| **SMPL** | Custom | Negotiate | If licensed | Undisclosed pricing; Epic acquisition pending |
| **Avaturn** | SaaS | $800/mo | Yes | Outsourced, scales poorly |
| **Ready Player Me** | CC-BY-NC-SA 4.0 | Free* | No (trap) | Non-commercial default; licensing required |
| **Daz3D** | Custom | $2,500 | If licensed | Third-party restrictions; ecosystem lock-in |

---

## 2. Measurement → Morph Mapping

### SMPL Beta Parameters

SMPL uses a **10-parameter PCA (Principal Component Analysis) shape space** derived from 3D body scans. The coefficients β ∈ ℝ¹⁰ encode:
- Height and weight
- Muscle tone and body fat distribution
- Proportions (leg length, torso width, shoulder breadth)

Quote: "The shape parameter β ∈ ℝ¹⁰ is the linear coefficients of a PCA shape space that mainly determines individual body features such as height, weight and body proportions" (Bhipanshu Dhupar, Medium).

**Limitation:** 10 parameters is restrictive; AMASS extends to 16 parameters for finer control. Anny provides 11 interpretable + 256 local blend shapes—far superior for clothing fit.

Evidence: [What is SMPL?](https://medium.com/@bhipanshudhupar/what-is-smpl-the-3d-human-body-model-powering-modern-ai-and-animation-c654a0284800)

### Anthropometric Datasets

**ANSUR II (US Army):** Public dataset; used for equipment design. Licensing restricts redistribution; commercial use requires attribution and proper stewardship agreements.

**CAESAR Database:** Licensed access required; companies can purchase high-quality anthropometric data for commercial/academic use. Derivatives may not be subject to license restrictions.

**Practical approach:** Zalando and Bold Metrics use **30+ measurement points** (bust, waist, hip, inseam, sleeve, etc.) to map to blend shape parameters. Research shows **25–30% higher accuracy** with 30+ points vs simplified size categorization.

Quote: "Measurement accuracy is the most critical factor in virtual try-on effectiveness, with apps that capture comprehensive body dimensions performing better than those relying on simplified size categorization" (Fashion Institute of Technology).

**Error sources:**
- Manual measurement variance (measurer skill, posture variation)
- Breathing and muscle contraction (bust can vary significantly)
- Tape compression and fatigue
- Different measurement conventions by brand

Evidence: [Zalando: Virtual Fitting Room](https://corporate.zalando.com/en/technology/zalando-enhances-its-virtual-fitting-room-enabling-customers-create-3d-avatar-their-body) · [Bold Metrics & Morph 3D Partnership](https://gfxspeak.com/2017/03/31/metrics-create-dressing)

---

## 3. Selfie → Face Reconstruction (2025–2026 SOTA)

### Single-Image 3D Face Reconstruction

**FaceLift (ICCV 2025):** Feed-forward approach for **360-degree head reconstruction** from a single image.
- Uses multi-view latent diffusion to generate side/back views from single portrait
- Transformer-based reconstructor outputs 3D Gaussian Splats
- **Latency:** Not disclosed; appears to be inference-only (sub-second expected)
- **Quality:** High-fidelity 360-degree coverage, suitable for avatar creation

Quote: "FaceLift is a novel feed-forward approach for generalizable, high-quality 360-degree head reconstruction from a single image" (ICCV 2025).

**AI 3D Selfie (2025):** Real-time single-image reconstruction using triplane NeRF encoder + volumetric rendering. Enables 3D visualization in light-field displays.

**NextFace:** High-fidelity library but **slow execution; quality improves with resolution**. Cannot capture fine-detail geometry (wrinkles, pores). DeepNextFace variant faster but still not real-time.

**ARKit (iOS):**
- 52 blendshape coefficients (ARFaceAnchor)
- Real-time face tracking on-device
- Limited to topology-specific mesh; less flexible for avatar personalization

**MediaPipe Face Landmarker (Android/cross-platform):**
- Replacement for FAN landmarks detector; more stable and accurate
- RGB camera tracking; works on-device
- Better multi-view consistency than older methods

**Practical recommendation:**
- **iOS:** Use ARKit 52 blendshapes + FaceLift or AI 3D Selfie (cloud) for full-head reconstruction
- **Android:** MediaPipe Face Landmarker + cloud reconstruction backend
- **Hybrid:** Capture 2–3 selfies (front + side angles) for better reconstruction fidelity

Evidence: [FaceLift on GitHub](https://github.com/weijielyu/FaceLift) · [AI 3D Selfie – SID 2025](https://sid.onlinelibrary.wiley.com/doi/10.1002/sdtp.18377)

---

## 4. Garment Representation Capability Ladder

### (A) 2D Outfit Collage / Flat-Lay

**What it is:** User photos of garments arranged into outfit combinations; flat-lay or hanger shots layered on canvas.

**Apps:** Fits, Klodsy, PhotoGrid Outfit Generator, Pureple, FlatLay Creator

**Feasibility:** Trivial; CSS/Canvas on mobile; proven MVP for $25–150K budget.

**Limitations:** No body context; purely aspirational. No fit feedback.

Evidence: [Fits – Outfit Planner & Closet](https://www.fits-app.com/outfit-maker)

---

### (B) 2.5D Avatar Overlay (2D Garment + 3D Body)

**What it is:** Flat garment image warped/draped onto parametric avatar body using UV mapping or 2D pose warping.

**Feasibility:** Medium; requires pose estimation + 2D-to-3D mesh alignment.

**Limitations:**
- Works well for fitted garments; fails for loose-fitting clothes
- Jittering artifacts in complex poses
- Single pose or limited multi-angle support
- Occlusion/overlapping issues

Evidence: [Real-Time Per-Garment Virtual Try-On with Temporal Consistency](https://arxiv.org/abs/2506.12348)

---

### (C) Generative Photo Try-On (2D VTON)

**What it is:** Diffusion models (Stable Diffusion, FLUX-based) generate photorealistic images of user wearing a target garment. Input: user photo + garment flat-lay → output: realistic user-in-garment photo.

**Apps:** Doji, BetterMirror, Vybe, WANNA (for rigid structures)

**Feasibility:** High; APIs available (fal.ai, Replicate).

**Quality:**
- **Strengths:** Photorealistic, high-frequency detail, natural drape, multi-angle capable
- **Weaknesses:** Small pattern details lost (writing on garments); minor texture artifacts; fabric occlusion issues

**Latency:**
- **fal.ai:** ~100ms cold start, 0.5s platform overhead total
- **Replicate:** 2–3s queue latency before generation starts

Quote: "fal.ai's latency is a killer feature—most models return in seconds where Replicate would take 30+. Sub-second queue time with approximately 0.5 seconds of platform overhead." (Scopeful comparison, 2026).

**Cost on fal.ai:** Typically $0.002–$0.01 per image depending on model and resolution.

**MVP Recommendation:** Generative VTON is the **fastest path to 3D-quality results without 3D asset creation**. Use fal.ai or Replicate backend with UI to guide users.

Evidence: [HF-VTON: High-Fidelity Virtual Try-On](https://arxiv.org/pdf/2505.19638) · [fal.ai vs Replicate Comparison](https://www.scopeful.org/blog/fal-vs-replicate)

---

### (D) Full 3D Garment Mesh Reconstruction from Single Image

**What it is:** Reconstruct parametric 3D garment mesh from a single flat-lay photo (e.g., shirt on hanger → 3D shirt model).

**Feasibility:** **Research stage**; not production-ready for startups in 2025–2026.

**Issues:**
- Single-image reconstruction under-constrained; requires heavy priors
- Texture projection artifacts
- Fabric wrinkle/fold inference unreliable
- Training datasets limited

**Alternative:** **Template-based garment fitting** (pre-modeled shirt/dress templates, UV projection of user photo texture). Much simpler but requires 3D asset library per garment type.

**Budget path:** Outsource 3D modeling to freelancers (Fiverr, $50–500/garment) for core wardrobe items.

Evidence: [Photogrammetry for Garment Reconstruction](https://www.researchgate.net/publication/225308148_Photogrammetric_3D_Body_Scanner_for_Low_Cost_Textile_Mass_Customization)

---

### (E) Cloth Simulation (Full Physics)

**What it is:** Real-time dynamic cloth drape using physics (gravity, collision, wind) on parametric avatar.

**Feasibility on mobile:** **Very limited** as of 2026.

**Current state (2025):**
- **Meta Quest 3:** Position-Based Dynamics (PBD) with GPU acceleration achieves 72 FPS at 32×32 cloth resolution (low poly count)
- **Mobile phones:** GPU acceleration on-device cloth is nascent; most apps defer to cloud or simplify drastically
- **Desktop:** Full cloth sim (e.g., Marvelous Designer, CLO 3D) is mature but requires upload + render

Quote: "Real-time cloth simulation on Extended Reality devices using Position-Based Dynamics and GPU acceleration maintains 72 FPS on Meta Quest 3 at 32×32 resolution" (MDPI, June 2025).

**Verdict for MVP:** **Skip cloth simulation**. The ROI is poor; generative try-on gives better perceived quality faster.

Evidence: [Real-Time Cloth Simulation in Extended Reality](https://www.mdpi.com/2076-3417/15/12/6611)

---

## 5. Asset Pipeline & Tooling

### Blender Headless Automation

**Workflow:**
1. Author parametric body + garment templates in Blender (UI)
2. Script Blender CLI to export morph targets, LOD levels, texture atlases
3. Use GitHub Actions to automate on each asset commit

**Tools:**
- **Blender CLI:** `blender --background --python script.py` for headless batch processing
- **Shape key export:** Blender's GLTF exporter preserves morph targets by default
- **LOD generation:** Python add-ons (Blender Auto-LOD, G-Ready) for automated simplification

Quote: "GitHub Actions combined with Blender's headless rendering capabilities can transform raw 3D files into optimized, game-ready assets automatically whenever artists push changes" (DrCodes).

Evidence: [GitHub Actions & Blender Automation](https://drcodes.com/posts/github-actions-blender-automate-game-assets-in-30-minutes)

---

### Mesh & Texture Compression

**Tools:**

| Tool | Purpose | Output |
|------|---------|--------|
| **meshoptimizer (gltfpack)** | Geometry optimization, quantization, LOD generation | Smaller GLB/GLTF, faster loading |
| **Draco (Google)** | Lossy geometry compression | ~10–15× smaller; supported by glTF 2.0 |
| **KTX2 + Basis Universal** | GPU texture compression | ~6–8× smaller; native GPU unpacking |
| **glTF-Transform** | GLTF optimization framework; handles all of above | Pipeline orchestration |

**Typical pipeline:**
```
Raw GLTF/GLB → gltfpack (vertex cache, quantization, LOD) → glTF-Transform (KTX2 textures, morph target pruning) → Production GLB
```

**Expected savings:** 70–85% size reduction (e.g., 50 MB → 7–15 MB) with minimal quality loss.

Evidence: [glTF-Transform](https://gltf-transform.dev/) · [meshoptimizer/gltfpack](https://meshoptimizer.org/gltf/)

---

### Asset Versioning: DVC vs Git LFS

**Git LFS:**
- **Use when:** Binary assets <100 MB, tight Git workflow, teams already using Git
- **Pros:** Simple pointer files in Git; no external storage setup
- **Cons:** Not optimized for ML pipelines; slow at terabyte scale

**DVC (Data Version Control):**
- **Use when:** ML pipelines, experiment tracking, datasets >100 MB, reproducibility critical
- **Pros:** Designed for ML; tracks data lineage, pipeline stages, metrics; integrates with S3/GCS/Azure
- **Cons:** Learning curve; extra tooling beyond Git

**Recommendation for this project:**
- **Phase 1 (MVP):** Git LFS for morph targets, textures, GLB files (<200 MB total)
- **Phase 2+ (scaling models, A/B testing):** Migrate to DVC for experiment tracking

Quote: "DVC stores data in remote storage (S3, GCS, Azure Blob) and tracks lightweight .dvc metafiles in Git...Git LFS excels at simplicity and tight Git integration" (Medium comparison).

Evidence: [DVC vs Git LFS: ML Reproducibility](https://censius.ai/blogs/dvc-vs-git-and-git-lfs-in-machine-learning-reproducibility)

---

## 6. Competitor Snapshot (2025–2026)

### Doji

- **Model:** AI-powered avatar from selfies
- **Input:** 6 selfies + 2 full-body images
- **Avatar generation time:** ~30 minutes
- **Status:** Invite-only; live in 80+ countries
- **Funding:** $14M Series A (2025)
- **Garment tech:** AI suggests outfits based on brands + body type; appears to use generative try-on, not 3D physics

**Assessment:** Generative photo try-on at scale; fastest to market.

Evidence: [Doji on App Store](https://apps.apple.com/us/app/doji-try-on-designer-fashion/id6737292650)

---

### BetterMirror

- **Model:** 3D avatar + outfit preview
- **Pricing:** $9.99/month
- **Tech:** AI body mapping + look creation
- **What ships:** 3D avatar on-device, style recommendations

**Assessment:** Premium consumer positioning; low churn with paid model.

---

### Doppl (Google)

- **Model:** Head-to-toe try-on, body-aware avatar
- **Tech:** Full-body avatar + garment drape
- **Distribution:** Google integration

**Assessment:** Tied to Google ecosystem; leverages Google's infrastructure for VTON models.

---

### WANNA

- **Model:** AR try-on (rigid structures: shoes, watches, bags, scarves)
- **Status:** Acquired by Perfect Corp (2025)
- **Tech:** AR overlays; works well for non-fabric items
- **Used by:** Farfetch, Gucci, major global brands

**Assessment:** Best-in-class for structured accessories; not general-purpose clothing.

Evidence: [WANNA Acquisition by Perfect Corp](https://www.perfectcorp.com/business/blog/generative-AI/ai-virtual-try-on-tools)

---

### Nykaa Fashion (India)

- **Model:** Measurement-based 3D avatar
- **Tech:** User enters measurements + body type selection → 3D avatar generation
- **Scope:** Nykaa Fashion e-commerce platform

**Assessment:** Measurement-to-avatar mapping; enterprise feature, not consumer app.

Evidence: [Nykaa Fashion 3D Try-On](https://corporate.zalando.com/en/technology/zalando-enhances-its-virtual-fitting-room-enabling-customers-create-3d-avatar-their-body)

---

### **Lookroom, Alta, Style DNA, Whering, Indyx:** 

Not found in 2025–2026 search results. Apps either defunct, pivoted, or niche. **Recommendation:** These are not benchmark players; focus on Doji, BetterMirror, Doppl.

---

## 7. R&D Spikes & MVP Roadmap

### Phase 1: MVP (Months 0–3)

**Scope:** 2D collage + generative photo try-on

**Deliverables:**
- Mobile app (iOS + Android): photo upload, virtual closet (image grid)
- Avatar from selfie + ARKit/MediaPipe face + Anny body model (parameterized by height/weight/gender)
- Generative try-on: user selects garment photo → fal.ai API call → display result

**Tech stack:**
- Frontend: React Native or Flutter (cross-platform)
- Body model: Anny (open-source, Apache 2.0) + pre-built GLTF mesh
- Face: ARKit (iOS) + MediaPipe Face Landmarker (Android)
- Generative VTON: fal.ai API (latency ~100ms + 0.5s rendering)
- Asset storage: S3 for garment images; Git LFS for base meshes

**Cost estimate:** $50–80K (2–3 engineers, 3 months; excluding cloud infrastructure)

**R&D Gate 1:** Test fal.ai generative VTON quality on diverse body types + garment categories. **Pass criteria:** >80% user satisfaction on tried garments.

---

### Phase 2: Measurement-Driven Avatar (Months 3–6)

**Scope:** Collect 20+ measurements; refine morph mapping

**Deliverables:**
- On-device body measurement UI (video + pose estimation)
- Anny shape parameter regression from measurements
- Avatar customization sliders (height, weight, muscle, bust, waist, hip)

**Tech stack:**
- Body measurement: MediaPipe Pose (or third-party pose library)
- Regression model: Linear regression or lightweight neural net (Anny's parameters are interpretable)
- Comparison: vs SMPL's 10 PCA parameters; Anny's 11 interpretable + 256 local shapes should give better fit feedback

**Cost estimate:** $30–40K (1.5 engineers + data annotation)

**R&D Gate 2:** Measurement-to-avatar accuracy on 100+ diverse body types. **Pass criteria:** >90% of users recognize their shape in avatar; return-rate improvement >10% on try-on orders.

---

### Phase 3: 3D Garment Assets (Months 6–12)

**Scope:** Parametric garment templates (T-shirt, dress, jeans archetypes)

**Deliverables:**
- 10–20 template garments (3D modeled) with parameterized fit zones
- UV-projected user photo textures onto templates
- Real-time 3D preview on avatar (Three.js or Babylon.js)

**Tech stack:**
- Garment authoring: Blender + Marvelous Designer (outsourced to freelancers)
- Export: GLTF with morph targets for fit adjustment
- Compression: meshoptimizer + KTX2 textures
- Rendering: Three.js with WebGL2 or WebGPU

**Cost estimate:** $80–120K (outsourced garment modeling $50–80K + 1 engineer integration)

**R&D Gate 3:** 3D garment preview reduces returns by >15% vs 2D collage; load time <2s on 4G. **Pass criteria:** A/B test statistical significance; 80th percentile load time <2s.

---

### Phase 4+: Cloth Simulation (Deferred)

**Why not in MVP:** Cloth simulation on mobile is immature. PBD on Meta Quest 3 is 72 FPS at 32×32 (toy resolution); consumer phones lack sufficient GPU. Better to invest in generative quality first.

**Future:** Consider when:
- Consumer phone GPUs improve (2027+)
- On-device diffusion inference matures (i.e., running Flux locally)
- ROI proven via Phase 3 A/B tests

---

## 8. Open Questions & Unknowns

1. **Face reconstruction on Android:** MediaPipe Face Landmarker is landmark-only. Single-image 3D head reconstruction (FaceLift, AI 3D Selfie) is cloud-only in 2026; **on-device viability unknown by early 2027.**

2. **Lookroom, Alta, Whering tech stacks:** Not documented in public sources as of Aug 2026. Likely pivoted or acquired; competitor research should include direct outreach.

3. **Union Avatars (2026):** Limited public info; **recommend direct demo/integration assessment.**

4. **Epic Games + SMPL licensing post-acquisition:** Meshcapade licensing terms will likely change after April 2026 close. **Monitor Epic Games announcements quarterly.**

5. **Measurement accuracy on diverse body types:** 30+ point systems work for Western sizing; **inclusivity on non-Western body diversity unexplored in published research.**

---

## 9. Recommendation Summary

### Best-In-Class Path for Small Team

| Decision | Recommendation | Rationale |
|----------|-----------------|-----------|
| **Body model** | Anny (Apache 2.0) | Free, interpretable 11 params + 256 local shapes, all-age coverage, no licensing risk |
| **Face reconstruction** | ARKit (iOS) + MediaPipe (Android) + cloud FaceLift as option | Real-time on-device for basic faces; cloud for high-quality 360° avatars |
| **Measurement→avatar** | 20–30 point on-device capture + linear regression to Anny params | Faster than ML; interpretable; proven ROI in Phase 2 gate |
| **Garment tech MVP** | 2D collage + generative photo try-on (fal.ai) | Fastest to quality; no 3D asset production; ~$0.01 per try-on cost |
| **Garment tech Phase 2+** | UV-projected 3D templates (outsourced modeling) | Better ROI than full 3D reconstruction; template library scales |
| **Asset versioning** | Git LFS (Phase 1) → DVC (Phase 2+) | Simple on-ramp; scales for experiments |
| **Hosting** | S3 for user photos + garments; fal.ai/Replicate for VTON (serverless) | No GPU infrastructure needed; pay-per-use |

### Licensing & Cost Summary

| Component | Cost (Year 1) | Notes |
|-----------|---------------|-------|
| **Body model** | $0 | Anny (Apache 2.0) |
| **Face reconstruction** | $0–$5K | ARKit/MediaPipe free; cloud inference ($0.001–$0.01 per call) |
| **Generative VTON** | $5–20K | fal.ai at scale: ~$0.003–$0.01 per image |
| **3D assets** | $0 (templated) or $50–80K (custom) | MPFB2 templates free; custom garments freelanced |
| **Cloud infrastructure** | $500–5K | S3 storage + CDN + API compute |
| **Total NRE (development)** | $80–150K | 3 engineers, 6 months to Phase 2 |

---

## Sources

### Primary (Official Docs, Specs, Repos)

1. [Anny – GitHub](https://github.com/naver/anny)
2. [MPFB2 – MakeHuman Community](https://static.makehumancommunity.org/mpfb.html)
3. [SMPL-X Model License](https://smpl-x.is.tue.mpg.de/modellicense.html)
4. [Ready Player Me Licensing](https://docs.readyplayer.me/ready-player-me/support/terms-of-use)
5. [Daz 3D Licenses](https://www.daz3d.com/daz-licenses)
6. [Avaturn Pricing & API](https://avaturn.me/pricing/) · [API Docs](https://docs.avaturn.me/docs/integration/api/create-avatar-with-api/)
7. [glTF-Transform](https://gltf-transform.dev/)
8. [fal.ai Generative Media API](https://fal.ai/learn/biz/gen-ai-integration-guide)

### Secondary (Research, Benchmarks, Reviews)

9. [FaceLift: ICCV 2025](https://github.com/weijielyu/FaceLift)
10. [AI 3D Selfie – SID Symposium 2025](https://sid.onlinelibrary.wiley.com/doi/10.1002/sdtp.18377)
11. [HF-VTON: High-Fidelity Virtual Try-On](https://arxiv.org/pdf/2505.19638)
12. [Real-Time Cloth Simulation in XR – MDPI 2025](https://www.mdpi.com/2076-3417/15/12/6611)
13. [DVC vs Git LFS Comparison](https://censius.ai/blogs/dvc-vs-git-and-git-lfs-in-machine-learning-reproducibility)
14. [fal.ai vs Replicate Comparison](https://www.scopeful.org/blog/fal-vs-replicate)
15. [SMPL: 3D Human Body Modeling – Bhipanshu Dhupar, Medium](https://medium.com/@bhipanshudhupar/what-is-smpl-the-3d-human-body-model-powering-modern-ai-and-animation-c654a0284800)
16. [Zalando Virtual Fitting Room](https://corporate.zalando.com/en/technology/zalando-enhances-its-virtual-fitting-room-enabling-customers-create-3d-avatar-their-body)
17. [Doji Series A Funding](https://digitrendz.blog/newswire/artificial-intelligence/12120/)
18. [NextFace Library – GitHub](https://github.com/abdallahdib/NextFace)
19. [Virtual Try-On Limitations & Artifacts](https://arxiv.org/abs/2506.12348)
20. [Measurement Accuracy in Virtual Try-On](https://www.fytted.com/blog/virtual-try-on-apps-guide)

### Tertiary (Surveys, Tool Reviews, Community)

21. [Best Virtual Try-On Apps 2026](https://www.glamar.io/blog/best-virtual-clothing-try-on-app)
22. [Top AI Virtual Try-On Tools](https://www.perfectcorp.com/business/blog/generative-AI/ai-virtual-try-on-tools)
23. [Virtual Closet MVP Development Cost](https://richestsoft.com/blog/virtual-wardrobe-app-development-cost/)
24. [Blender Headless Automation](https://drcodes.com/posts/github-actions-blender-automate-game-assets-in-30-minutes/)
25. [Photogrammetry Software Review](https://www.guideflow.com/blog/photogrammetry-software)

---

**Report prepared:** 2026-08-24  
**Confidence levels:** High on licensing & SOTA tech (primary sources); Medium on competitor internals (limited public disclosure); Low on post-Epic acquisition SMPL terms (TBD Q3 2026).
