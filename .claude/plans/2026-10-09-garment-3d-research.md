# Garment 3D research: desk comparison (2026-10-09)

> Status: DESK COMPARISON COMPLETE (2026-10-09) — step 1 of DEC-76. Three web-research lanes
> reported; the synthesis is at the end. Step 2, the hands-on test, has not started: the owner
> picks the candidates first. Nothing here is a decision. The
> brief is `2026-10-09-open-questions-decisions-proposal.md` §L. This file moves to
> `planning/research/r8-*.md` on the owner's word.

## Question and constraints

- **Question.** Can a photo of a garment become a 3D garment that looks right on the A1 avatar, at
  a quality, cost and speed the product can ship, on every supported phone?
- **Owner's options.** (1) A 3D generator tool: image to 3D object. (2) The same, plus on-device AI
  where the phone has it, with the service as fallback. (3) A service only.
- **Hard constraints.** Works on iOS 26+ and Android 10+. Same quality on every phone. Consistent
  results. A server path is therefore mandatory; on-device AI is allowed only if its output matches.
- **Renderer is open.** The owner does not require Filament and is considering three.js
  (2026-10-09). Criteria: good quality, low cost, consistency. Filament stays the recorded choice
  (DEC-50) until a new DEC replaces it.
- **Starting pass criteria (RB-2, doc 00 §9.1).** At least 60% of results rated "acceptable on
  avatar" by blind raters; at most $0.10 per garment at scale; spike budget at most $1,000.
- **Method.** Web research only on 2026-10-09. Every fact carries a URL and a read date. Nothing
  was signed up for, purchased, installed or uploaded.

## Lane A — managed image-to-3D services

_Agent report, received 2026-10-09, reproduced as delivered. Spot-check status is recorded in the synthesis section._

No managed service turns a garment photo into a garment dressed on a rigged body; all return a static mesh. All sources read 2026-10-09; [n] points to the source list.

### 1. Bottom line

- The August conclusion still holds. Every service outputs a standalone object. None accepts a target body or skeleton [2][9][15].
- No fashion vendor offers a public photo-to-3D-garment API. Style3D's image-to-3D makes trims only [47]. WEARFITS apparel is 2D generative try-on [50].
- Few endpoints meet $0.10 at list price: fal TRELLIS v1 and SAM 3D Objects ($0.02), Stability SPAR3D ($0.04), fal Rodin 2.5 Fast ($0.10) [23][31][39][20]. Tripo and Meshy cost $0.30 or more [1][6][13].
- No vendor page states EU processing. Meshy stores in the US [12]. Tripo is a Hong Kong company [3]. fal uses "the United States and other countries" [34].
- Licence flags: Hunyuan3D 2.0/2.1 licences exclude the EU, UK and South Korea [29][30]. Meshy's terms allow training on non-Enterprise data [11]. Tripo's terms require written consent before end users get the service [3].

### 2. Candidates

| Service | Input | Output, controls | Rigging / on-body | Price per textured model | API, limits, SLA | Ownership, commercial | Data policy |
|---|---|---|---|---|---|---|---|
| Tripo API v3.1 (Holymolly Ltd, HK) | 1 image; multiview front/left/back/right, minimum 2; text [2] | GLB, FBX; PBR; `face_limit`; quad to 150k faces [2] | Auto-rig builds a new biped or creature skeleton; no target body [2] | 30 credits = $0.30; quad +5; rig 25 [1]. 2M credits for $14,000 [5] | 10 concurrent; SLA "contact sales" [1][2] | Paid users hold all rights; HK law; end-user exposure needs written consent [3] | Paid users: no training on inputs/outputs [3]; anonymised prompts/outputs may improve models [4]. Kept until deleted; SCCs; DPA and EU region not stated [4] |
| Meshy API (Meshy LLC, US) | 1 image; 1-4 images; text [7][8] | GLB/FBX/OBJ/USDZ/STL; PBR; quad or triangle; 100-300k polys [7] | "only works well with standard humanoid (bipedal) assets" [9] | 30 credits; Pro $20 per 1,000 = $0.60; lite model 15 credits [6][13] | Pro 20 req/s, 10 queued; Enterprise 99.9% SLA [10] | Paid plans own output; free is CC BY 4.0 [11] | Conflict: API page says never trained [10]; terms allow it for non-Enterprise [11]. API assets kept 3 days [10]. US storage; DPA not stated [12] |
| Rodin Gen-2.5 (Deemos Corp, Delaware) | 1-5 images; text [15] | GLB, others "depending on path"; PBR [15][19] | not stated | fal Fast (Extreme-Low tier) $0.10; fal High $0.40 [20][21]. Direct: Business $120/month, about 416 models [17] | Direct API on Business plan; limits not stated; Enterprise 99.9% SLA [17][19] | "We will not limit your use"; commercial "depending on your subscription plan" [18] | 7-day retention; no training on inputs/outputs [16]. Region, DPA not stated |
| TRELLIS.2 on fal (Microsoft) | 1 image [22] | GLB; PBR with opacity [24] | none | $0.25 / $0.30 / $0.35 by resolution [22] | fal: 2-40 concurrent; no SLA in terms [36][37] | "Commercial use" tag [22]; MIT, but nvdiffrast dependency is non-commercial [24][25] | fal: no training on client content except "Excluded Models"; DPA incorporated, SCCs; payloads stored unless `X-Fal-Store-IO: 0` [32][33][35] |
| TRELLIS v1 on fal / Replicate | 1 image | GLB | none | fal $0.02 [23]; Replicate about $0.035, 26 s [26] | Replicate deletes API data after one hour [38] | MIT [26] | fal as above; Replicate training policy not stated |
| Hunyuan3D on fal | 1 image; v3 adds back/left/right [28] | GLB, OBJ; PBR; face count [28] | none | v2 $0.48; v3 $0.375 plus $0.15 per option [27][28] | as fal | fal tags "Commercial use"; 2.0/2.1 licences exclude EU/UK/KR and cap at 1M monthly users [29][30] | as fal |
| SAM 3D Objects on fal | 1 image plus mask or prompt; handles "real-world clutter and occlusion" [31] | GLB, gaussian .ply | none | $0.02 [31] | as fal | "Commercial use permitted" [31] | as fal |
| Stability SF3D / SPAR3D | 1 image [39] | not stated | not stated | $0.10 / $0.04 [39] | not read | not read | not read |
| Sloyd API | images or text [40] | quads optional [40] | not stated | 20 credits at 75 per $1 = $0.27 [40] | not stated | not checked | not checked |
| 3D AI Studio | resells "Meshy, Tripo, Rodin & more" [41] | - | - | 20 credits = $0.34 [41] | API by email [41] | "Commercial use allowed" [41] | not checked |
| Hitem3D on fal | 1 image or multiview [42] | GLB | none | $2.10 or $9.10 [42] | as fal | "Commercial use" tag | as fal |

Not usable today: CSM (domain dead; Google acquired it, January 2026 [45]); Luma (API docs list video and image only [46]); Kaedim ($400/month for 20 credits, API not stated [43]); Masterpiece X (API "early access" [44]).

On fal, Tripo matches direct prices; Meshy 7.1 costs $1.20 against $0.60 direct [56].

### 3. What matters for garments

- **Static or dressable?** All static. Tripo and Meshy rigging builds a fresh skeleton for a humanoid or creature mesh [2][9]. Meshy's marketing says "Auto-rig and animate your garments"; its API docs restrict rigging to bipedal characters [53][9].
- **Extra step (my inference, not a vendor claim):** align and scale the mesh to the canonical Anny body; open sealed cuffs, hem and neck; remove inner faces; transfer skin weights and morph-target deltas from body to garment; fix intersections. Cloth simulation is the alternative.
- **Open surfaces:** only TRELLIS.2's authors claim "open surfaces (e.g., clothing, leaves)" [24]. An ECCV 2026 paper says TRELLIS v1 "produces inherently watertight meshes without open boundaries" with "excessive thickness on thin-shell garments" [52].
- **Wearability:** GarmentX reports InstantMesh and LGM "tend to produce closed garments that cannot be worn directly". TRELLIS "generates double-layer meshes" and "completely closes" on T-shirt images [51].
- **Unseen back:** Meshy's docs say one image gives no back information [14]. Tripo, Meshy, Rodin and Hunyuan v3 accept a back photo [2][8][15][28].
- **Mesh weight and prints:** the paper measures 380K vertices for TRELLIS.2 [52]; Tripo and Meshy expose face limits [2][7]. I found no evidence on prints or logos. Tripo offers `texture_alignment=original_image` and `delight` [2].
- **Fashion vendors:** Style3D Studio's Image-to-3D Trim makes accessories, 40 credits each, desktop only [47]; its site lists no generation API [48]. WEARFITS photo-to-3D covers "footwear, bags, and backpacks"; apparel needs "no 3D models" [50].
- **Jev by TypeSafeAI:** a structured-decision model, not a 3D tool (search summary of [55]).

### 4. Capture practice found

- Meshy: "clear subject, simple background, resolution ≥ 512×512"; even light; shadows cause black patches [14].
- Meshy: avoid perspective distortion with near-orthographic or telephoto shots; crop to one object [14].
- Meshy multi-view: "Front + Side + Back + 3/4 view", same object, similar lighting [14].
- Tripo: at least 256 px, "clean background and minimal occlusion"; multiview needs the front plus one more view under "consistent lighting" [2].
- Rodin: the first of up to five images drives materials [15].
- No vendor publishes garment-specific guidance. My inference: shoot hung or on a form, front and back, sleeves spread, background removed server-side. Flat-lay risks a flat mesh; test it.

### 5. Hands-on test: top 3

1. **TRELLIS.2 on fal.** Only model claiming open surfaces. MIT model licence; self-hosting depends on the nvdiffrast question below. 30 photos x 2 resolutions x $0.30 = $18 [22].
2. **Tripo v3.1 multiview, direct API.** Explicit front and back inputs, quad and face limits, written no-training clause. 30 x (single + front/back) x $0.30 = $18 [1]. Fallback if Tripo refuses end-user consent: Meshy multi-image, Pro plan $20 [13].
3. **Rodin Gen-2.5 via fal.** Compares its lowest tier at budget price against its High tier. 30 x ($0.10 + $0.40) = $15 [20][21].

Add two $0.02 baselines for $1.20: fal TRELLIS v1, and SAM 3D Objects on worn photos [23][31]. One pass costs about $55; three repeats about $170.

The test must measure:
- Openings: cuffs, hem and neck open or sealed.
- Wall: single or double layer; thickness.
- Back side against a real back photo, single view versus front plus back.
- Print and logo legibility; baked shadows.
- Triangle count, glTF validity, conversion to KTX2 and meshopt.
- Time and failure rate per photo type (flat-lay, hanger, worn).
- Effort to dress one result on Anny and pose it.

### 6. Could not confirm

- EU processing or region choice for any vendor. Looked at [4][12][16][33][34].
- A DPA for Tripo, Meshy or Rodin [4][12][16][18].
- Whether Meshy trains on paid API data; [10] and [11] conflict.
- Whether fal's TRELLIS, Rodin or Hunyuan endpoints are "Excluded Models" outside its DPA [32]. fal's sub-processor page did not render.
- fal's payload retention period; [35] gives no number.
- Whether Tencent's exclusion binds fal-hosted use. I did not read a Hunyuan3D v3 licence or Tencent Cloud API pricing.
- Whether nvdiffrast's non-commercial licence affects self-hosted TRELLIS.2 [24][25].
- Stable Fast 3D weights: a search summary reports a $1M annual-revenue cap; licence page not opened. Stability's API terms need JavaScript.
- Rodin direct price per model: [15] says 0.5 credits, [19] says "from 1 credit"; subscriber credit price not stated [17].
- Generation times for Tripo, Meshy, Rodin and fal endpoints. TRELLIS.2 lists 3-60 s on an H100 [24].
- CSM's shutdown, Kaedim API access, Luma Genie's retirement: no official statement found [43][45][46].
- Fashion vendors: Style3D's August 2026 announcement and Marvelous Designer's AI Pattern Drafter returned 403. PICTOFiT's sites failed with a TLS error. For CLO, Browzwear, VNTANA and MetaTailor I have search summaries only; none showed a photo-to-3D-garment API.
- Garment quality of Tripo, Meshy, Rodin, Hunyuan and TRELLIS.2: no independent evidence found.

Method note: I read [1][3][4][39] through the Chrome extension because plain fetching was blocked; no sign-in, no cookie consent.

### Sources

[1] https://developers.tripo3d.com/en/pricing
[2] https://developers.tripo3d.com/llms-full.txt
[3] https://www.tripo3d.ai/terms
[4] https://www.tripo3d.ai/privacy
[5] https://aws.amazon.com/marketplace/pp/prodview-hwlbvx7vubh7c
[6] https://docs.meshy.ai/en/api/pricing
[7] https://docs.meshy.ai/en/api/image-to-3d
[8] https://docs.meshy.ai/en/api/multi-image-to-3d
[9] https://docs.meshy.ai/en/api/rigging-and-animation
[10] https://www.meshy.ai/api
[11] https://www.meshy.ai/terms-of-use
[12] https://www.meshy.ai/privacy-policy
[13] https://help.meshy.ai/en/articles/12062933-what-are-your-prices-and-plans-offered-and-do-you-have-monthly-annual-plans
[14] https://docs.meshy.ai/en/webapp/image-to-3d
[15] https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5
[16] https://docs.hyper3d.ai/en/legal/data-retention-policy
[17] https://hyper3d.ai/pricing?lang=en
[18] https://hyper3d.ai/legal/terms
[19] https://hyper3d.ai/features/api
[20] https://fal.ai/models/fal-ai/hyper3d/rodin/v2.5/fast
[21] https://fal.ai/models/fal-ai/hyper3d/rodin/v2.5
[22] https://fal.ai/models/fal-ai/trellis-2
[23] https://fal.ai/models/fal-ai/trellis
[24] https://github.com/microsoft/TRELLIS.2
[25] https://raw.githubusercontent.com/NVlabs/nvdiffrast/main/LICENSE.txt
[26] https://replicate.com/firtoz/trellis
[27] https://fal.ai/models/fal-ai/hunyuan3d/v2
[28] https://fal.ai/models/fal-ai/hunyuan3d-v3/image-to-3d
[29] https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2/main/LICENSE
[30] https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2.1/main/LICENSE
[31] https://fal.ai/models/fal-ai/sam-3/3d-objects
[32] https://fal.ai/legal/api-services
[33] https://fal.ai/legal/data-processing-addendum
[34] https://fal.ai/privacy
[35] https://fal.ai/docs/documentation/model-apis/inference/payloads
[36] https://fal.ai/docs/model-apis/faq
[37] https://fal.ai/terms
[38] https://replicate.com/docs/topics/predictions/data-retention
[39] https://platform.stability.ai/pricing
[40] https://www.sloyd.ai/api/pricing
[41] https://www.3daistudio.com/Pricing
[42] https://fal.ai/models/hitem3d/hi3d/v3.0/image-to-3d
[43] https://www.kaedim3d.com/plans
[44] https://www.masterpiecex.com/pricing
[45] https://the-decoder.com/google-deepmind-goes-on-acquisition-spree-with-three-ai-deals-in-one-week/
[46] https://docs.lumalabs.ai/docs/api
[47] https://help.style3d.com/studio/en/1f8f/e9e2
[48] https://www.style3d.com/
[50] https://wearfits.com/product/apparel , https://wearfits.com/photo-to-ar
[51] https://arxiv.org/html/2504.20409
[52] https://arxiv.org/html/2607.13365
[53] https://www.meshy.ai/use-cases/clothing-design
[55] https://www.vktr.com/ai-platforms/chatgpt-cocreator-launches-typesafe-ai-with-jev/
[56] https://fal.ai/models/tripo3d/tripo/v2.5/image-to-3d , https://fal.ai/models/tripo3d/p2/image-to-3d , https://fal.ai/models/meshy/v7.1/image-to-3d

## Lane B — self-hostable models, and fitting a garment to the avatar

_Agent report, received 2026-10-09, reproduced as delivered. Spot-check status is recorded in the synthesis section._

**The August 2026 conclusion still holds: template mesh plus texture remains the practical path; some claims stay unconfirmed (section 7).** I read every URL below on 2026-10-09, with GitHub licence files and READMEs read through the GitHub API.

### 1. Bottom line
- Generic image-to-3D is now cheap and detailed, but it still outputs a static, unrigged mesh. [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) (MIT) reports 3–60 s per object on an H100, with PBR and open surfaces.
- Garment-specific single-image methods remain research. The 2026 papers ([Image2Garment](https://image2garment.github.io/), [NGL](https://arxiv.org/abs/2602.20700), [PatternGSL](https://arxiv.org/abs/2606.24564)) have released no code.
- Licences remove most candidates. Hunyuan3D excludes the EU, UK and South Korea, and Stability caps revenue at $1M. Several "MIT" pipelines default to non-commercial dependencies.
- Two upgrades to the baseline are testable now: generating texture onto a known template, and parametric templates via GarmentCode.
- The $0.10 target is reachable for TRELLIS.2: about $0.04–0.06 per garment by my estimate.

### 2. General image-to-3D models
Cost = (model seconds + 30 s overhead, my assumption) × [RunPod serverless rate](https://www.runpod.io/pricing). Rates: H100 $4.79/h ($0.00133/s), L40S $1.75/h ($0.00049/s), RTX 4090 $1.10/h ($0.00031/s).

| Model | Licence and flags | VRAM | Time | Output | Last push | Est. cost |
|---|---|---|---|---|---|---|
| [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | MIT code and weights. Default matting is [RMBG-2.0](https://huggingface.co/briaai/RMBG-2.0) (CC BY-NC). GLB export and texturing call [nvdiffrast](https://github.com/NVlabs/nvdiffrast) (non-commercial). [DINOv3](https://github.com/facebookresearch/dinov3) is mandatory, under Meta's own licence. | ≥24 GB | 3 / 17 / 60 s at 512³ / 1024³ / 1536³ (H100) | GLB with PBR and opacity; [card](https://huggingface.co/microsoft/TRELLIS.2-4B) admits small holes | 2026-07 | 33 s × 0.00133 = $0.044; 47 s × 0.00133 = $0.063 |
| [Pixal3D](https://github.com/TencentARC/Pixal3D) (SIGGRAPH 2026, TRELLIS.2 backbone) | MIT; same RMBG-2.0 and DINOv3 [defaults](https://huggingface.co/TencentARC/Pixal3D/raw/main/pipeline.json) | not stated | not stated | GLB; multi-view input since Sep 2026 | 2026-09 | not computed |
| [TRELLIS](https://github.com/microsoft/TRELLIS) v1 | MIT; [diffoctreerast](https://github.com/JeffreyXiang/diffoctreerast) and nvdiffrast are non-commercial | ≥16 GB | not stated | mesh | 2026-06 | not computed |
| Hunyuan3D [2.0](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) / [2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) / [Omni](https://github.com/Tencent-Hunyuan/Hunyuan3D-Omni) | Excludes EU, UK, South Korea. Outputs barred outside that territory. Over 1M MAU needs a Tencent licence. | 16 / 29 GB | not stated | mesh, PBR (2.1) | 2025-10 | unusable |
| [SF3D](https://github.com/Stability-AI/stable-fast-3d) / [SPAR3D](https://github.com/Stability-AI/stable-point-aware-3d) | Stability Community: $1M annual revenue cap, registration required; no region clause found | 6 / 10.5 GB | under 1 s ([SF3D](https://huggingface.co/stabilityai/stable-fast-3d)) | low-poly UV-unwrapped GLB, roughness/metallic, delighting | 2025-01 / 2025-05 | 31 s × 0.00031 = $0.010 |
| [TripoSR](https://github.com/VAST-AI-Research/TripoSR) | MIT code and weights | ~6 GB | <0.5 s (A100) | mesh, vertex colours or baked texture | 2026-06 | about $0.009 |
| [TripoSG](https://github.com/VAST-AI-Research/TripoSG) | MIT; default RMBG-1.4 | ≥8 GB | not stated | GLB shape | 2025-04 | not computed |
| [InstantMesh](https://github.com/TencentARC/InstantMesh) | Apache-2.0, but [Zero123++ weights](https://github.com/SUDO-AI-3D/zero123plus) are CC-BY-NC | not stated | not stated | OBJ, vertex colours or texture map | 2025-01 | not computed |
| [Unique3D](https://github.com/AiuniAI/Unique3D) | MIT | not stated | 30 s | textured mesh | 2025-07 | 60 s × 0.00031 = $0.019 |
| [Direct3D-S2](https://github.com/DreamTechAI/Direct3D-S2) | MIT | 10 / 24 GB | not stated | OBJ shape | 2025-09 | not computed |
| [Step1X-3D](https://github.com/stepfun-ai/Step1X-3D) | Apache-2.0 | 27–29 GB | 152 s | textured mesh | 2025-09 | 182 s × 0.00049 = $0.089 |
| [SAM 3D Objects](https://github.com/facebookresearch/sam-3d-objects) | SAM License; no non-commercial clause found | ≥32 GB | not stated | Gaussian splat export shown | 2026-06 | not computed |

Other 2026 releases do not change the picture:
- [TripoSplat](https://github.com/VAST-AI-Research/TripoSplat) is MIT but outputs Gaussians only.
- [ReLi3D](https://github.com/Stability-AI/ReLi3D) needs posed multi-view input and carries the Stability licence.
- [UltraShape](https://github.com/PKU-YuanGroup/UltraShape-1.0) ships the Hunyuan 2.1 licence.
- [Hunyuan3D-Buffalo](https://github.com/Tencent-Hunyuan/Hunyuan3D-Buffalo1.0) has a paper but no code.
- [Stable3DGen](https://github.com/Stable-X/Stable3DGen) is a TRELLIS fork that states it removed the NVIDIA dependencies.

### 3. Garment-specific methods

| Method | Input → output | Code, weights, licence | Readiness |
|---|---|---|---|
| [GarmentCode](https://github.com/maria-korosteleva/GarmentCode) | Design parameters + body measurements → sewing pattern → draped mesh | MIT. Its [Warp fork](https://github.com/maria-korosteleva/NvidiaWarp-GarmentCode) is NVIDIA non-commercial; [upstream Warp](https://github.com/NVIDIA/warp) is Apache-2.0. Bundled bodies are SMPL-derived. | Usable building block; simulator must be replaced |
| [AIpparel](https://github.com/georgeNakayama/AIpparel-Code) (CVPR 2025) | Image or text → sewing pattern | MIT code; [weights](https://huggingface.co/georgeNakayama/AIpparel) tagged MIT, fine-tuned from LLaVA-1.5-7B | Research code |
| [ChatGarment](https://github.com/biansy000/ChatGarment) (CVPR 2025) | Image or text → GarmentCode pattern | Apache-2.0 code; weights on SharePoint, licence not stated | README admits wrong lengths and widths |
| [Design2GarmentCode](https://github.com/Style3D/design2garmentcode-impl) | Text, photo or sketch → GarmentCode program | MIT; defaults to a GPT-4o API key plus a Qwen2-VL LoRA | Research code with an external API |
| [SewFormer](https://github.com/sail-sg/sewformer) | Image of a dressed person → pattern | Code and weights, no licence file; simulation needs Maya on Windows | Research |
| [DressCode](https://github.com/IHe-KaiI/DressCode) | Text → pattern + PBR texture | No licence file | Not image-based |
| [Garment3DGen](https://github.com/nsarafianos/Garment3DGen) (Meta) | Image → template deformed to an image-to-3D target, plus texture | CC BY-NC 4.0 | Idea reusable, code not |
| [GarmageNet](https://github.com/Style3D/garmagenet-impl) | Multimodal → patterns and 3D initialisation | CC BY-NC-ND 4.0 | Not usable |
| [Dress-1-to-3](https://dress-1-to-3.github.io/) (SIGGRAPH 2025) | One image of a dressed person → separated simulation-ready garments | No code statement on the page | Research |
| [Image2Garment](https://image2garment.github.io/) (Jan 2026) | One image → garment plus fabric physics parameters | "Code (soon)" | Not released |
| [NGL](https://arxiv.org/abs/2602.20700) (Feb 2026) | Image → pattern through a large VLM, training-free | "Will be released for research use" | Not released |
| [PatternGSL](https://arxiv.org/abs/2606.24564) (Jun 2026) | One image → template-free pattern specification | [Repo](https://github.com/Lagrangeli/PatternGSL) has a one-line README | Not released |
| [ReWeaver](https://github.com/SII-LiMing/ReWeaver-Code) (CVPR 2026) | Four or more views → patterns | Code and weights, no licence file | Research, multi-view |
| [Gaussian Garments](https://github.com/eth-ait/Gaussian-Garments) / [GarmentDreamer](https://github.com/boqian-li/GarmentDreamer) | Multi-view video / text → Gaussian garments | No licence file / CC BY-NC | Research |

### 4. The fitting problem
**Established practice**
- **Skin-weight transfer from the body.** Epic's [weight inpainting](https://www.dgp.toronto.edu/~rinat/projects/RobustSkinWeightsTransfer/index.html) copies trusted weights and interpolates the rest. It targets loose garments. [Sample code](https://github.com/rin-23/RobustSkinWeightsTransferCode) is MIT.
- **Cages.** Roblox [layered clothing](https://create.roblox.com/docs/art/accessories/layered-clothing) wraps a garment by its inner cage. Its outer cage lets further layers sit on top. The engine [transfers skinning at runtime](https://create.roblox.com/docs/art/accessories/automatic-skinning-transfer).
- **Binding to the body mesh.** [MakeClothes](https://static.makehumancommunity.org/assets/creatingassets/makeclothes/introduction.html) positions each clothing vertex from three base-mesh vertices. Clothes then [deform with the basemesh](https://static.makehumancommunity.org/mpfb/docs/assets/concept_clothes_hair_bodyparts.html).
- **Relevance to Anny.** [Anny](https://github.com/naver/anny) is built on MakeHuman assets (CC0). Its README does not mention clothes. Reusing this binding on Anny is my inference.
- **Fashion CAD.** Tools resize the pattern to the avatar and re-simulate (section 7).
- **Layering.** [ContourCraft](https://github.com/Dolorousrtur/ContourCraft) (MIT) untangles multi-garment outfits, but on SMPL or SMPL-X bodies.
- **Template deformation.** [Garment3DGen](https://arxiv.org/abs/2403.18816) states image-to-3D geometries "cannot be utilized directly". It deforms a base template to match them.

**Unsolved**
- A flat-lay photo yields flat geometry; no model restores the worn shape (my inference).
- Generated meshes carry no canonical alignment, no inside/outside separation and no guaranteed neck or sleeve openings.
- Skinning alone does not reproduce drape on loose garments.
- Large body changes distort bound garments. MakeClothes says they "will not look as good" on another body.
- General multi-layer intersection handling is still heuristic.
- I found no garment method evaluated on flat-lay or hanger phone photos.

### 5. The template baseline
**How it works.** One UV-mapped template per category is bound to the body once. The photo is segmented, classified, then turned into a texture.

**Texture options**
- **Warp the photo into the template UV.** [Pix2Surf](https://github.com/miraymen/pix2surf) uses silhouette correspondences; it is non-commercial and SMPL-bound. [Cloth2Tex](https://github.com/HumanAIGC/Cloth2Tex) uses landmarks plus inpainting; it is GPL-3.0 and its landmark detector is unreleased.
- **Generate texture on the known mesh from the image.** TRELLIS.2 ships `example_texturing.py` (MIT, imports nvdiffrast). [MV-Adapter](https://github.com/huanngzh/MV-Adapter) (Apache-2.0) has an image-to-texture pipeline.
- **Extract fabric.** [FabricDiffusion](https://github.com/humansensinglab/fabric-diffusion) normalises fabric and print patches; it has no licence file.

**Limits**
- The silhouette is fixed per template.
- The unseen back is invented.
- Phone lighting and folds bake into the texture.
- Prints distort on worn photos.
- Long-tail categories need more templates.

### 6. Top 3 hands-on tests (about 30 photos)
1. **Template + generated texture** (TRELLIS.2 texturing or MV-Adapter).
   - Why: lowest risk, and it fits Anny by construction.
   - Cost: texture stage is 7 s at 1024³, so 37 s × 0.00133 ≈ $0.05 per garment.
   - Measure: colour and print fidelity, back-side plausibility, failure rate per photo type, seconds per garment.
2. **Sewing-pattern estimation** (AIpparel or Design2GarmentCode → GarmentCode → drape on Anny with upstream Warp).
   - Why: the only route where shape follows body measurements.
   - Cost: runtime not stated; budget one L40S day, 8 h × $1.75 = $14.
   - Measure: attribute accuracy (length, sleeves, neckline), drape success rate, simulation time, penetrations.
3. **TRELLIS.2 or Pixal3D direct + weight inpainting.**
   - Why: it tests whether generic output is riggable at all.
   - Cost: $0.063 per garment at 1024³.
   - Measure: openings and thickness, flat-lay flatness, triangle count after decimation, artefacts across Anny's shape and pose range.

### 7. Could not confirm
- **Unreal Outfit Asset resizing.** [Epic's page](https://dev.epicgames.com/documentation/unreal-engine/getting-started-with-parametric-clothing) rendered empty; I saw search excerpts only.
- **Marvelous Designer Auto Fitting.** The [manual](https://support.marvelousdesigner.com/hc/en-us/articles/47358335130649) returned HTTP 403; search excerpt only.
- **MakeHuman delete groups.** Search excerpt only.
- **GarmentCodeData licence.** The ETH page returned HTTP 500.
- **ChatGarment weights licence.** Not stated anywhere I could read.
- **Hunyuan3D 2.5/3.x weights.** None appear in the [Hugging Face listing](https://huggingface.co/api/models?author=tencent&search=Hunyuan3D&limit=50) or the GitHub organisation. "Hosted-only" comes from a third-party timeline.
- **TRELLIS.2 and nvdiffrast.** The maintainer says nvdiffrast is "only for visualization". The code calls it in `to_glb`. [Issue 22](https://github.com/microsoft/TRELLIS.2/issues/22) leaves this open.
- **Pixal3D NOTICE.** It lists DINOv2 (Apache-2.0), yet the code loads DINOv3.
- **Meta licences.** I found no non-commercial clause in the DINOv3 or SAM licences. That is not a legal review.
- **Licences not read.** RMBG-1.4, SDXL and Unique3D weights.
- **Timing gaps.** READMEs give no times for Hunyuan3D, InstantMesh, Direct3D-S2, TripoSG, SAM 3D and Pixal3D. The GPUs behind Step1X-3D's 152 s and Unique3D's 30 s are unstated. TRELLIS.2 speed off H100 is unstated.
- **EU GPU prices.** [Scaleway](https://www.scaleway.com/en/pricing/gpu/) showed only L4 at €0.79/h. RunPod's table and its embedded data disagree.
- **Garment quality from phone photos.** I found no primary benchmark.
- **Jev by TypeSafeAI.** Press search excerpts describe a text-free decision model for classification and routing, not a garment tool. I read no primary page.

## Lane C — on-device options, display approaches, and what the market does

_Agent report, received 2026-10-09, reproduced as delivered. It includes the three.js comparison the owner asked for mid-session. Spot-check status is recorded in the synthesis section._

No phone-side path can produce a server-comparable 3D garment, so option 2 fails the owner's own constraints. All URLs were read on 2026-10-09. "(s)" marks a page seen only as a search excerpt. Section 8 lists what I could not confirm.

### 1. Bottom line
- No system API on iOS 26/27 or Android builds a textured mesh from one photo. [1][4][7][16][18]
- **Option 2: reject.** It fails "same output as server" on every phone, new ones included. [3][5][14]
- Generate garments server-side only (option 1 or 3).
- Server-rendered turntable image sets are the only display that is identical on every phone by construction. three.js in a web view is the cheapest real-time route, but unproven on floor devices.
- No surveyed consumer app builds 3D garments from user photos.

### 2. On-device capability

| API | Produces | Devices | Source |
|---|---|---|---|
| Object Capture (iOS 17+) | USDZ mesh from a multi-image scan, never one photo. iOS supports "only the reduced detail level". Apple advises against deformable and thin objects. | "Select iOS devices with LiDAR"; iPhone 12 Pro and later models | [1][2][3] |
| Spatial scenes (`Spatial3DImage.generate()`) | In-memory 3D view of a 2D image; no export documented | visionOS 26 only | [4] |
| Apple SHARP (research) | Gaussian splats from one photo, not a mesh. Not a system API. Model licence excludes commercial use. | "Standard GPU"; iPhone not mentioned | [5][6] |
| Foundation Models | Text out; iOS 27 adds image input | Apple Intelligence: iPhone 15 Pro, 15 Pro Max, every iPhone 16 or newer | [7][8][11] |
| Image Playground | Images only; runs on Private Cloud Compute | Same | [9] |
| Core AI with your own model (iOS 27) | Apple states no iPhone memory limit. Arm's mobile TripoSR test (device unnamed): 15.3 s on CPU, vertex colours, back side "basically a guess". Hunyuan3D-2 needs 6–16 GB VRAM. | "All Apple silicon" | [10][14][15] |
| ARCore | Depth maps only; no object-mesh API | Depth on "over 88% of active devices" (May 2026) | [16][17] |
| ML Kit GenAI / Gemini Nano | Text only | Flagships: Pixel 9–11, Galaxy S25/S26, recent foldables, listed Honor, OnePlus, OPPO, vivo, Xiaomi models | [18][19] |
| Qualcomm AI Hub | No image-to-3D category listed (partial view) | Not stated | [20] |

**Share of devices.**
- **Floor:** iOS 27 runs on iPhone 11 and later. [12]
- **iPhone, shipments:** Apple publishes no Apple Intelligence share. Counterpoint counts over 450 million capable iPhones shipped to Q1 2026, which is shipments, not active phones. [21]
- **iPhone, usage sample:** TelemetryDeck (updated 2026-10-01, biased app sample) shows four capable models totalling about 41–44%, by my arithmetic. Other capable models add to that. iPhone 13 (11.24%) and iPhone 15 are not capable. [22]
- **Android, shipments:** GenAI-capable phones were 36% of 2025 shipments and 45% forecast for 2026. No installed-base figure exists. [23]
- **Android, OS version:** Android 10+ covers 90.7% of devices (Google data, December 2025, third-party mirror). [24]

**Conclusion.** No on-device path yields a server-comparable textured garment mesh. Through system APIs the share of devices is zero.

### 3. Display approaches

| Approach | Same quality on every phone | Cost | Latency, interactivity | Size, memory | Examples |
|---|---|---|---|---|---|
| Native real-time: Filament 1.77.3 | Same engine and asset; GPU and drivers vary | No running cost; C++ API on iOS, Java/JNI on Android | Instant, free rotation | Android AARs 5.3 + 5.8 MB before ABI split; iOS size not found | None found in wardrobe apps [25][26][27] |
| SceneView, Sceneform, RealityKit | SceneView uses Filament on Android but alpha RealityKit on iOS, which does not read glTF. Sceneform was archived in 2020. | – | – | – | [28][29] |
| three.js in a web view | See section 4 | | | | |
| Server-rendered turntable or image set | Identical pixels by construction | GPU time per new outfit; per-render price not found. fal lists H100 at $2.49–4.50/h. | One round trip per new outfit; rotation limited to rendered angles | Smallest client | Zalando's pilot used "renders of our products" with 360° rotation [30][31][32] |
| Server generative image or video | Same on every phone; Google warns details "may not always be accurate" | fal list: $0.04–0.15 per image, $0.025–0.14 per video second | Seconds to minutes | Smallest client | Doppl, Google "Try it on" [30][33][34] |
| Gaussian splats | Client-rendered, so GPU-dependent | No running cost | Real-time | glTF extension is a release candidate (s); three.js needs a plugin; PlayCanvas has "first-class" support | No garment example found [35][36][37] |

### 4. three.js in a web view
- **Licence and size.** MIT. The core is 736 KB minified, 185 KB gzipped (v0.186.1). Filament's Android AARs total about 11 MB. [38][39][26][27]
- **Assets.** GLTFLoader supports Draco, meshopt, `KHR_texture_basisu` and mesh quantization. It needs DRACOLoader, KTX2Loader and MeshoptDecoder. The page states no morph-target or skinning limits. [36]
- **WebGL 2.** Supported in 99% of Android and 98% of iOS survey reports. WebGPU reaches 74% and 85%. [40]
- **WebGPU on iOS.** Safari 26 ships it on iOS 26. [41] For WKWebView I found only a forum reply saying it works once default-on. [42]
- **WebGPU on Android.** Chrome 121 enabled it on Android 12+ with Qualcomm and ARM GPUs. The page does not mention WebView. [43] Android 10–11 therefore need WebGL 2.
- **One code path.** `WebGPURenderer` falls back to WebGL 2, and `forceWebGL` pins it. [44]
- **Textures.** All Android reports support 4096, but only 75% support 8192. iOS supports 8192. [45]
- **Memory on iOS.** Apple staff say the WKWebView limit "is not a set number" and cannot be raised. Developers report in-app WebGL crashes. [46]
- **Memory on Android.** The system may kill the renderer for memory. The app must destroy and recreate the WebView. [47]
- **Version drift.** Android's WebView package is user-selectable since Android 7. `getCurrentWebViewPackage()` reads its version. [47] Chrome 139+ requires Android 10, the app's exact floor. [48]
- **Offline.** `WebViewAssetLoader` serves bundled files over an https origin. `WKURLSchemeHandler` serves them through a custom scheme. [49][50]
- **Bridge.** Android's `addJavascriptInterface` runs on another thread and demands fully trusted content. [51] I found no latency figure.
- **Accessibility.** Canvas content "is not exposed to accessibility tools". Add backing markup or native labels. [52]
- **Old phones.** I found no official frame-rate or memory benchmark.
- **Production.** Avaturn's avatar editor runs as a web iframe and returns a GLB loaded by GLTFLoader. [53] Its docs list native WebView guides (s). I found no wardrobe app.
- **Alternatives.**
  - model-viewer: Google, Apache-2.0, supports the last two versions of evergreen browsers. [54]
  - PlayCanvas: MIT, WebGL 2 and WebGPU, glTF, Draco, Basis, splats. [37]
  - Babylon.js: Apache-2.0, WebGL 2 and WebGPU. [55]

### 5. Three-way verdict
Scores are my judgment from the evidence above, not measurements (5 is best).

| | Quality | Engineering cost, two developers | Running cost | Consistency, iOS 26+ and Android 10+ |
|---|---|---|---|---|
| Filament native | 5 | 2: C++ on iOS, JNI on Android | 5: none | 3: one engine, GPU-dependent |
| three.js web view | 4 | 4: one viewer, two thin hosts | 5: none | 2: WebView version, memory ceiling, texture limits |
| Server-side rendering | 4: offline-quality frames, fixed angles | 3: render worker, cache, image viewer | 3: GPU time per new outfit | 5: identical by construction |

**Best fit: server-side rendering.** It alone meets "same quality on every phone" without a device test matrix. The price is interactivity: no free rotation, and each new outfit waits for a render. three.js is the runner-up. It wins only if the owner ranks zero running cost above guaranteed sameness.

### 6. Market scan
- **Google Doppl.** It generated stills and AI video of the user in an outfit from a photo or screenshot. [33] A blog embedding the Google Labs post says it shut down on 2026-04-30. [56]
- **Google "Try it on".** It generates images on the shopper's own photo (s). [34]
- **Doji.** Diffusion-model avatar from selfies, generated try-on images, no fit simulation (s). [57]
- **Alta.** Users photograph items and get "a studio-quality image". Outfits appear "on a virtual avatar of you". The method is not stated. [58]
- **Whering.** Photos with background removal, plus a catalogue of 100 million items. [59] Its site shows no try-on; July 2026 funding lists it as planned. [60]
- **Indyx.** Background-removed photos, outfit boards and flatlays. Its paid "virtual selfies" are unexplained. [61]
- **Style DNA.** Selfie-based style profile and outfit cards. Its site shows no try-on. [62]
- **Zalando.** A 3D avatar from body measurements, captured by two photos or a video. Shoppers compare sizes. Rollout to all customers is the 2026 goal. Garments come from brands. [63][31]
- **Amazon.** Camera-based shoe try-on in the iOS app. [64] Apparel try-on on a shopper's photo appeared only in a search excerpt.
- **Per-user 3D garments.** None found. The closest is Style3D's designer tool, which builds a 3D garment from a front-view image (s). [65]
- **Pattern.** Wardrobe apps show 2D cut-outs. Try-on is server-generated imagery. Real 3D appears only with brand-supplied garments.
- **Jev by TypeSafe AI.** An early-access model that returns typed, probabilistic decisions for software; not a 3D or try-on tool (s). [66]

### 7. Recommendation
Render outfits on the server to a cached multi-angle image set. Show that set in a native image viewer.

- It looks identical on an iPhone 11 and an Android 10 phone.
- It needs no GPU budget on the client.
- It matches what the market already ships.
- Keeping the glTF pipeline leaves real-time 3D open later.
- If the decision log fixes Filament, this change needs an ADR.

A hands-on test must prove:
1. **Server cost and latency.** Render one avatar with a four-garment outfit to 24–36 frames. Record GPU-seconds, cost per outfit and tap-to-first-frame time on mobile data.
2. **Cache value.** Measure how often a repeated avatar and outfit pair hits the cache.
3. **three.js floor check.** Load the same GLB with 4096 textures in WKWebView on an iPhone 11 and in WebView on a low-memory Android 10 phone. Swap 30 outfits. Log frame rate, memory, context losses and renderer kills. Compare screenshots.
4. **Decision rule.** Adopt three.js only if the floor devices show no kills and no visible difference.

### 8. Could not confirm
- Apple Intelligence share of active iPhones, and Gemini Nano share of active Android phones. No primary figure exists.
- WebGPU in WKWebView and in Android WebView. Official pages do not say.
- iPhone memory limits for Core AI models. Apple publishes none.
- Filament's iOS binary size, three.js decoder sizes, and any frame-rate data on old phones.
- Price per deterministic server render, and small-GPU cloud prices (Google's pricing page did not load).
- Doppl's shutdown on Google's own page (`labs.google/doppl` returns 404).
- Amazon apparel try-on (HTTP 503) and App Store listings (HTTP 429).
- Where Zalando renders, and how its garments are built.
- three.js morph-target limits. I found forum posts only.
- `GaussianSplatComponent` on iPhone. Apple showed Vision Pro only. [13]
- Doji and Alta internals. I found press coverage only.
- ARKit LiDAR scene meshes, and Samsung and MediaTek SDKs. I did not check them.

### Sources
[1] https://developer.apple.com/documentation/realitykit/creating-3d-objects-from-photographs
[2] https://developer.apple.com/documentation/realitykit/photogrammetrysession
[3] https://developer.apple.com/videos/play/wwdc2023/10191/
[4] https://developer.apple.com/documentation/realitykit/imagepresentationcomponent/spatial3dimage
[5] https://github.com/apple/ml-sharp
[6] https://raw.githubusercontent.com/apple/ml-sharp/main/LICENSE_MODEL
[7] https://developer.apple.com/documentation/foundationmodels
[8] https://developer.apple.com/videos/play/wwdc2026/241/
[9] https://developer.apple.com/videos/play/wwdc2026/375/
[10] https://developer.apple.com/videos/play/wwdc2026/324/
[11] https://www.apple.com/apple-intelligence/
[12] https://www.apple.com/os/ios/
[13] https://developer.apple.com/videos/play/wwdc2026/279/
[14] https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/can-mobile-phones-generate-a-3d-object-at-game-runtime-in-unity-here-is-what-actually-happens
[15] https://github.com/Tencent-Hunyuan/Hunyuan3D-2
[16] https://developers.google.com/ar/develop/depth
[17] https://developers.google.com/ar/devices
[18] https://developers.google.com/ml-kit/genai
[19] https://developer.android.com/ai/gemini-nano
[20] https://aihub.qualcomm.com/models
[21] https://asymco.com/2026/06/09/counterpoint-research-apple-has-shipped-over-450-million-apple-intelligence-capable-iphones/
[22] https://telemetrydeck.com/survey/apple/iPhone/models
[23] https://www.mactech.com/2026/06/22/apple-and-samsung-continue-to-lead-the-genai-capable-smartphone-segment/
[24] https://composables.com/android-distribution-chart
[25] https://github.com/google/filament
[26] https://repo1.maven.org/maven2/com/google/android/filament/filament-android/1.77.3/
[27] https://repo1.maven.org/maven2/com/google/android/filament/gltfio-android/1.77.3/
[28] https://github.com/SceneView/sceneview
[29] https://github.com/google-ar/sceneform-android-sdk
[30] https://fal.ai/pricing
[31] https://corporate.zalando.com/en/fashion/rewriting-rules-fit-europe-3-key-takeaways-cphfw-aw26
[32] https://corporate.zalando.com/en/node/10672
[33] https://blog.google/technology/google-labs/doppl/
[34] https://support.google.com/googleshopping/answer/16253678 (s)
[35] https://www.khronos.org/news/permalink/khronos-announces-gltf-gaussian-splatting-extension (s)
[36] https://threejs.org/docs/pages/GLTFLoader.html
[37] https://github.com/playcanvas/engine
[38] https://github.com/mrdoob/three.js
[39] https://bundlephobia.com/api/size?package=three
[40] https://web3dsurvey.com/
[41] https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
[42] https://developer.apple.com/forums/thread/770862
[43] https://developer.chrome.com/blog/new-in-webgpu-121
[44] https://threejs.org/docs/pages/WebGPURenderer.html
[45] https://web3dsurvey.com/webgl2/parameters/MAX_TEXTURE_SIZE
[46] https://developer.apple.com/forums/thread/133449
[47] https://developer.android.com/develop/ui/views/layout/webapps/managing-webview
[48] https://9to5google.com/2025/06/26/google-chrome-android-versions-no-longer-supported-2025/
[49] https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
[50] https://developer.apple.com/documentation/webkit/wkurlschemehandler
[51] https://developer.android.com/develop/ui/views/layout/webapps/webview
[52] https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
[53] https://docs.avaturn.me/docs/integration/web/threejs/
[54] https://modelviewer.dev/
[55] https://github.com/BabylonJS/Babylon.js
[56] https://jetstream.blog/2026/03/24/google-doppl-shut-down-end-of-april-2026/
[57] https://techcrunch.com/2025/05/15/doji-raises-14m-to-make-virtual-try-ons-fun-through-ai-avatars (s)
[58] https://www.altadaily.com/
[59] https://whering.co.uk/
[60] https://www.theindustry.fashion/whering-secures-7m-to-expand-ai-powered-wardrobe-app/
[61] https://www.myindyx.com/
[62] https://styledna.ai/
[63] https://corporate.zalando.com/en/technology/how-zalando-uses-technology-help-customers-find-right-size
[64] https://www.aboutamazon.com/news/retail/amazon-makes-shopping-easier-with-virtual-try-on-for-shoes
[65] https://help.style3d.com/studio/en/c2c8/7cd2/b61b/ (s)
[66] https://www.vktr.com/ai-platforms/chatgpt-cocreator-launches-typesafe-ai-with-jev/ (s)

## Synthesis and candidates for the hands-on test

### How far the facts were checked

The lane sections above are the agents' reports, reproduced as delivered. The lead re-read eleven of
their source pages on 2026-10-09: the Hunyuan3D-2.1 licence, the TRELLIS.2 README and licence, the
Stable Fast 3D model card, the fal TRELLIS.2 price page, the Meshy rigging docs and terms of use,
the Rodin data-retention policy, Apple's `ml-sharp` model licence, Android's "Manage WebView
objects" page, and the three.js `WebGPURenderer` docs. All eleven matched the reports. Apple's Object
Capture page did not render in that check, so its row rests on the lane agent's reading. Every
other fact in the lane sections is as reported and was not re-checked.

### What the evidence says

1. **No tool turns a garment photo into a garment that dresses a rigged body.** Every managed
   service and open model returns a static, standalone object (lanes A and B). Garment-specific
   single-image methods are still research, and the 2026 papers have released no code.
2. **The hard part is fitting, not generating.** Generated meshes come sealed or double-layered,
   with no guaranteed openings, no inside and outside, and no skin weights. A flat-lay photo yields
   flat geometry.
3. **Phones cannot do it.** No system API on iOS or Android builds a textured mesh from one photo.
   Apple's single-image research model outputs splats, and its licence is research-only (checked).
4. **Generation is cheap.** Several endpoints sit at or under $0.10 per model at list price. TRELLIS.2
   on fal costs $0.25–0.35 (checked). Self-hosted TRELLIS.2 is estimated at $0.04–0.06 (lane B's
   arithmetic).
5. **Licences and data rules remove candidates.** Hunyuan3D excludes the EU, the UK and South Korea
   (checked), which rules it out for an EU-hosted product. Stability's models cap free commercial
   use at $1M annual revenue (checked). TRELLIS.2 is MIT (checked), but its export path calls a
   non-commercial library, and that question is open. Meshy's terms allow training on
   non-Enterprise content (checked). No vendor states EU processing (as reported).
6. **Display.** Server-rendered image sets are the only display that is identical on every phone by
   construction. three.js in a web view is the cheapest real-time route, but Android's WebView
   version varies per device and the system may kill its renderer for memory (checked). Filament
   gives the most control and costs the most engineering.
7. **The market does not do this.** No surveyed consumer app builds 3D garments from user photos.
   They show 2D cut-outs and server-generated try-on images, which is what this plan's MVP already
   has (G0 and G2).

### The owner's three options against that evidence

| Option | Verdict |
| --- | --- |
| 1. A 3D generator tool, on a server | Possible only as "generic mesh plus an automatic fitting step". The fitting step is unproven and is the thing to test. |
| 2. Option 1 plus on-device AI where the phone has it | Rejected by the evidence. No on-device path exists, and it would break consistency across phones. |
| 3. A service only | No service does the whole job. A service can supply the mesh for option 1. |

Against the owner's criteria:

- **Consistency:** generate on the server. For display, server-rendered images guarantee sameness;
  three.js and Filament each need a test on the oldest supported phones.
- **Cost:** template plus texture is the cheapest per garment. Server rendering adds GPU time per
  outfit, and no price for it was found.
- **Quality:** unknown until tested on real photos. Templates fix the silhouette; generic
  generation brings fitting artefacts.

### Candidates for the hands-on test (the owner picks 2–3)

| | Candidate | Why | Cost signal |
| --- | --- | --- | --- |
| A | Template mesh per category plus generated texture | The baseline to beat; fits the avatar by construction | About $0.05 per garment (lane B's estimate) |
| B | Generic image-to-3D plus automatic fitting (TRELLIS.2 on fal, or Tripo with front and back photos, then skin-weight transfer) | Tests whether direct generation is usable at all | $0.25–0.35 per model on fal (checked); $0.30 on Tripo (as reported) |
| C | Sewing-pattern estimation, then drape on the avatar | The only route where the garment follows body measurements | Research code; highest risk |
| D | Display test: one GLB shown as a server-rendered turntable, in three.js in a web view, and in Filament, on an iPhone 11 and a low-memory Android 10 phone | Settles the renderer question with measurements | Engineering time only |

One pass of the managed-service part is estimated at about $55 (lane A), far inside the $1,000
spike budget of RB-2.

### Lead's recommendation

Pick **A and B** for garments and **D** for display. A sets the bar, B shows whether the new models
beat it, and D settles Filament versus three.js versus server rendering. Leave C unless B fails on
shape. Before any spend, the owner confirms the pass criteria (RB-2: at least 60% rated acceptable
on the avatar, at most $0.10 per garment) and who supplies the 30 photos.

The product does not need 3D garments to launch: doc 07 §2 sets the MVP at A1 + G0 + G2. A no-go
here leaves the plan intact.

### Questions this research raised

- Does the non-commercial licence of `nvdiffrast` block the self-hosted TRELLIS.2 export path?
- Does any managed image-to-3D vendor offer EU processing and a DPA? None states it. DEC-29 and
  DEC-61 apply even though garment photos are less sensitive than body photos.
- What does one server-rendered outfit cost? No price was found.
- "Jev by TypeSafeAI", which the owner asked about, is a hosted text-only decision model. It does not
  apply to this question (checked on the vendor's docs and privacy policy).
