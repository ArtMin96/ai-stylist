# 16 — Risks, Open Questions, and Decision Log

**Status:** Ratified for planning · **Date:** 2026-08-24
**Conforms to:** [SPINE.md](SPINE.md). This document owns: the risk register, the assumptions register, open questions (OQ-NN), the decision log (DEC-NN), and the prototype-needs list. Superseding a SPINE decision requires a new DEC entry here — until then, SPINE wins ([SPINE](SPINE.md) header rule).

Owner roles: **PO** product owner · **MOB** mobile lead · **BE** backend/platform lead · **ML** AI/media pipeline owner. Evidence files: `research/r1…r5` (as of Aug 2026).

---

## Risk register (ranked)

Likelihood/impact scale: Low / Medium / High. Rank = likelihood × impact × proximity (how early it can sink the plan). Every risk names the phase where it is validated or retired and a kill/stop criterion. New-phase risks are added here, not in phase files (phase files link back by RISK-NN).

| ID | Rank | Risk | L | I | Mitigation | Owner | Validated in | Kill / stop criteria |
|---|---|---|---|---|---|---|---|---|
| RISK-01 | 1 | **`react-native-filament` maturity**: wrapper is maintained by one company (margelo), no proven consumer app at scale; breakage or abandonment strands the 3D surface (r2 §2B, §Top Risks) | M | H | P01 vertical prototype on real devices before any product code depends on it; pin versions; keep native-Filament-via-JSI fallback designed ([SPINE §2](SPINE.md)); isolate renderer behind stable contracts so it is replaceable ([04-architecture.md](04-architecture.md)) | MOB | **P01** (go/no-go gate) | P01 gate fails (< 60/50 fps mid-tier, > 300 MB memory, > 100 MB app, or blocking defects with no upstream fix path) → switch to JSI-native Filament; if that also fails → native per-platform renderers; log DEC |
| RISK-02 | 2 | **Generative try-on (G2) quality/cost**: VTON output loses garment detail, produces artifacts on diverse bodies, or per-image cost breaks credit economics (r5 §4C; r3) | M | H | Entitlement-gate G2; pre-gate eval (RB-4 + try-on eval set per [10-ai-usage-cost-and-evaluation.md](10-ai-usage-cost-and-evaluation.md)); provenance markers; credits metering; fal.ai primary with batch fallback provider | ML | **P11** (eval + cost gate) | User-satisfaction eval < 80% on diverse-body slices, or unit cost > credit economics in [12](12-pricing-entitlements-and-unit-economics.md) → ship P11 disabled behind flag; MVP still valid via G0 + avatar (doc 00 §7) |
| RISK-03 | 3 | **Fashion content licensing**: no affordable licensed source for trends/runway content; unauthorized scraping is a prohibited foundation (brief §2.8) | M | H | Treat P12 as sourcing-first: identify licensable feeds/partners before building ingestion; provenance + takedown design; editorial fallback (small curated licensed set) | PO | **P12** (sourcing spike before build) | No licensable source within content budget → descope trend feed to closet-derived inspiration (deterministic, zero licensing) and log DEC; do not launch an unlicensed feed |
| RISK-04 | 4 | **App-store approval of trial/paywall model**: server-granted 3-day trial outside store-managed intro offers may draw rejection or policy friction (Apple/Play billing rules) | M | H | P13 compliance review against current App Store / Play guidelines before build; RevenueCat store-compliant configuration; no purchase flows outside store billing; design a store-native intro-offer variant as fallback | BE | **P13** | Rejection or written policy conflict → switch to store-managed free-trial intro offers (RevenueCat supports both); log DEC; pricing page copy must never promise the non-compliant variant |
| RISK-05 | 5 | **Measurement→morph accuracy and user trust**: avatar adjusted from user measurements doesn't look like the user; trust in the whole product collapses (r5 §2) | M | H | Anny interpretable params + calibration/review screen where the user corrects results (P04); confidence indicators; never claim digital twin; fairness eval slices across body shapes | ML | **P04** | < 90% "recognize my shape" in calibration testing after one tuning iteration → make manual sliders the primary path, auto-mapping assistive-only; log DEC |
| RISK-06 | 6 | **Anny production-asset readiness**: research-grade model (PyTorch) must become production glTF assets with stable topology, rig, and garment-attachment conventions — unproven pipeline | M | M | Early asset-pipeline spike inside P01/P04 (Blender headless, gltfpack/KTX2 per r5 §5); MPFB2 (CC0) kept warm as alternative ([SPINE §2](SPINE.md)) | ML | P01 (render), **P04** (full pipeline) | Export pipeline cannot produce stable morphing glTF within P04 → switch to MPFB2 base meshes; log DEC |
| RISK-07 | 7 | **Face/biometric compliance (A2)**: face processing triggers GDPR biometric rules, BIPA-class statutes, store face-data disclosures; missteps are existential, not incremental | L–M | H | A2 is optional + consented + deletable with generic-face default; legal review checklist in [11](11-security-privacy-and-compliance.md) before P05 ships; providers must pass no-training/retention policy; regional gating if needed. **Legal statements need qualified counsel review** | BE | P00 (discovery), **P05** (pre-ship review) | Counsel flags unresolvable exposure in a region → geo-gate or disable A2 there; A2 is beta and fully severable (doc 00 §9) |
| RISK-08 | 8 | **AI cost overrun**: per-user AI spend exceeds SPINE §6 anchors ($0.02–0.15/user/mo steady; $0.10–0.30 onboarding spike), destroying free-tier economics | M | M | Deterministic-before-AI rule; caching/dedup/idempotent jobs (brief §3.1); metering from P06 via `usage_meters`; cost dashboards per [14](14-observability-operations-and-analytics.md); credit limits on generative ops | ML | P06 onward, checked at **P13** | Measured cost/user > 2× anchor for a month → freeze new AI features, run doc 10 cost-reduction playbook (smaller models, batching, on-device) before any further rollout |
| RISK-09 | 9 | **Low-end Android performance**: 3D + capture unusable on cheap devices, cutting addressable market | M | M | Device-tier budgets + LOD from P01; A0/2D accessibility fallback path is a product feature, not a crutch; weekly mid-tier device testing (r2 §Top Risks) | MOB | P01, continuously; gate at **P14** | Low-tier devices can't hold budget floors → officially set a documented device floor + serve non-3D experience below it; log DEC |
| RISK-10 | 10 | **Vendor concentration (fal.ai)**: try-on, background-removal fallback, and missing-view synthesis all route through one provider | M | M | Provider ports in `platform` module; Replicate documented as batch fallback (r3); versioned job schemas make re-pointing cheap | ML | P06, **P11** | Provider outage/pricing shock → flip port to fallback; if no fallback meets quality bar, degrade features to deterministic paths (G0, front-only catalog) |
| RISK-11 | 11 | **Managed-service lock-in / small-vendor risk** (Neon, Trigger.dev, Railway, better-auth, RevenueCat) | L–M | M | Standard Postgres + Drizzle migrations (portable); pg-boss documented queue fallback; Hetzner+Coolify hosting fallback ([SPINE §2](SPINE.md)); entitlements source of truth is *our* table, not RevenueCat | BE | P02 foundations; ongoing | Any vendor EOL/price shock → execute documented fallback; SPINE lists the fallback per row, so this is operational, not architectural |
| RISK-12 | 12 | **iOS delivery without a Mac**: hosted macOS CI (EAS or GHA) is the *only* iOS build path; outages or signing issues block releases (r1) | M | M | P02 sets up the lane early and exercises it every release train; both EAS and GHA macOS documented (final choice = ADR in P02, OQ-04); TestFlight upload automated via App Store Connect API | BE | **P02**, ongoing | Persistent CI failure window > 1 week → activate the second provider lane; a Mac purchase remains the last-resort fallback (explicitly not planned) |
| RISK-13 | 13 | **Offline sync complexity** (closet capture/edit offline, conflict resolution) eats schedule in P07 | M | M | Scope offline to closet capture/edit queues only (brief §3.7); single-device-primary conflict policy first; WatermelonDB/expo-sqlite patterns (r2 §7) | MOB | **P07** | Sync defects persist at P07 exit → ship online-first with queued uploads only; full offline editing moves to later; log DEC |
| RISK-14 | 14 | **Taxonomy drift / data quality**: uncontrolled strings, duplicate tags, re-derived attributes corrupt recommendations (brief §2.5) | M | M | Normalized taxonomy owned by `closet` + `shared-kernel` registries; canonical-source rules in [08-closet-taxonomy-and-organization.md](08-closet-taxonomy-and-organization.md); migrations for taxonomy changes | BE | P06–P07 | Not killable — quality gate: correction-rate and duplicate-rate metrics (doc 00 §8.2) trigger cleanup work when rising |
| RISK-15 | 15 | **Recommendation trust at cold start**: sparse closets produce weak recommendations exactly when users judge the product | M | M | Sparse-closet strategy + honest missing-data notes in engine design ([09-recommendation-engine.md](09-recommendation-engine.md)); onboarding nudges toward the ~15-item threshold; cold-start metric (doc 00 §8.2) | PO | **P09** | Not killable — if cold-start validity stays low, gate recommendations behind a minimum-closet prompt rather than showing bad results |
| RISK-16 | 16 | **Team capacity / scope**: 16 phases with 2–3 devs; planning discipline decays across AI-agent sessions | M | M | This planning package + [PROGRESS.md](PROGRESS.md) ledger + phase DoD; phases are vertical and independently shippable; beta/later ladder (doc 00 §9) defines what to cut first | PO | Every phase exit | Sustained slip > 2 phases vs plan → cut from the bottom of the ladder (P12 feed, A2, missing-views) before touching MVP core |

## Assumptions register

Validation column names the phase or artifact that confirms/refutes each. Failed assumptions become DEC entries.

| ID | Assumption | Confidence | Validated by | If wrong |
|---|---|---|---|---|
| ASM-01 | `react-native-filament` sustains our avatar workload on mid-tier devices | Medium (r2) | P01 gate | RISK-01 fallback ladder |
| ASM-02 | Anny meshes/morphs are production-quality after our asset pipeline pass | Medium (r5) | P01 render + P04 pipeline | RISK-06 → MPFB2 |
| ASM-03 | G2 try-on clears quality + cost gates at ~$0.003–0.025/image (as of Aug 2026, r3/r5) | Medium | P11 gate | RISK-02 → ship without G2 |
| ASM-04 | Licensable fashion content exists at viable cost | Low–Medium | P12 sourcing spike (OQ-05) | RISK-03 → closet-derived inspiration only |
| ASM-05 | Server-granted 3-day trial passes store review | Medium | P13 compliance review | RISK-04 → store-managed intro offers |
| ASM-06 | 2–3 devs + AI agents sustain the phase cadence | Medium | PROGRESS.md across P02–P05 | RISK-16 → cut ladder |
| ASM-07 | On-device background removal (Apple Vision / ML Kit) is good enough for most items, keeping server AI as fallback only | Medium (r3) | P06 eval | Costs shift toward RISK-08; re-run doc 10 cost model |
| ASM-08 | Open-Meteo commercial plan + Nager.Date give adequate global weather/holiday coverage | Medium–High (r4) | P08 | Swap providers behind ports (Tomorrow.io / Calendarific) |
| ASM-09 | SPINE §6 unit-economics anchors hold within ~2× at real usage | Medium (r3/r4) | P13 measurement | Reprice tiers; doc 12 owns recalculation |
| ASM-10 | Users will grant photo/measurement data given honest consent UX | Medium | P03/P06 funnel metrics | Strengthen progressive onboarding; more value before asking |

## Open questions

Owner drives each to a DEC entry by the due phase. OQ-NN never reuse numbers.

| ID | Question | Owner | Due | Notes |
|---|---|---|---|---|
| OQ-01 | **Product name/brand** (working name "AI Stylist") | PO | P13 (needed for store listing) | Trademark + domain check before store submission |
| OQ-02 | Which app-store trial mechanics variant do we submit first (server-granted vs store intro offer)? | BE | P13 | Depends on RISK-04 compliance review |
| OQ-03 | Age policy: are minors supported, and with what gates? | PO | P00 | Brief §3.6 forbids leaving this implicit; affects consent flows (P03) and store rating |
| OQ-04 | EAS Build vs GitHub Actions macOS for the iOS lane | BE | P02 (ADR) | SPINE defers this to a P02 ADR (r1) |
| OQ-05 | Which licensed fashion-content sources/partners, at what cost? | PO | P12 sourcing spike | Gates the whole P12 build (RISK-03) |
| OQ-06 | Regional gating list for A2 face features (biometric statutes) | BE | P05 | Needs counsel input (RISK-07); legal review, not engineering judgment |
| OQ-07 | Data residency / EU hosting requirements at launch | BE | P00 discovery → P02 infra | Neon/R2/Railway region selection |
| OQ-08 | Official minimum supported device floor (Android + iOS) | MOB | P01 → ratified P14 | Driven by P01 measurements (RISK-09) |
| OQ-09 | Family/multi-account sharing for subscriptions? | PO | P13 | Brief §2.10 raises it; default assumption: not in v1 |
| OQ-10 | Which pose set (3 vs 4; which occasion pose) ships in A1 | PO | P04 | Brief §2.3 requires neutral, casual, seated/occasion-if-feasible, fit-revealing |

## Decision log

Every ratified SPINE decision is logged here so later agents do not reopen settled choices without new evidence (brief §13.18). All entries **2026-08-24**, decided by product owner + orchestrator reconciliation, evidence as-of Aug 2026. Full matrices live in [05-technology-decisions.md](05-technology-decisions.md); ADRs use [templates/adr.md](templates/adr.md). Reversing any entry requires a new DEC referencing the old one.

| ID | Decision | Rationale (one line) | Evidence |
|---|---|---|---|
| DEC-01 | Monetization: 3-day full-access trial → limited Free + 3 paid tiers (no hard paywall) | Product-owner decision; maximizes evaluation of premium value while keeping a durable free utility | [SPINE §1, §6](SPINE.md) |
| DEC-02 | Global, English-first launch; localization deferred | Small team; store regional pricing still applies | [SPINE §1](SPINE.md) |
| DEC-03 | Linux-first development; no Mac purchase; hosted macOS CI for iOS | Team owns no Mac; hosted lane is cheaper than hardware + upkeep | [research/r1-linux-ios-build.md](research/r1-linux-ios-build.md) |
| DEC-04 | Mobile framework: React Native + Expo (SDK 55+, prebuild), TypeScript, New Architecture | Best weighted score (8.95) on 3D maturity + AI-agent productivity + hiring for a 2–3 dev team | [research/r2-mobile-3d-stack.md](research/r2-mobile-3d-stack.md) |
| DEC-05 | 3D renderer: Filament via `react-native-filament`; fallback native Filament/JSI | Only production-proven cross-platform 3D path for RN; Unity (full-screen-only, size) and expo-gl (broken deps) rejected | [research/r2-mobile-3d-stack.md](research/r2-mobile-3d-stack.md) |
| DEC-06 | Asset formats: glTF 2.0 canonical, KTX2/Basis textures, Draco/meshopt compression, versioned manifests | Universal engine support; 90–95% geometry and ~10× GPU-memory savings | [research/r2-mobile-3d-stack.md](research/r2-mobile-3d-stack.md), [r5](research/r5-avatar-garment-3d.md) |
| DEC-07 | Parametric body model: Anny (Apache 2.0) | Free, commercial-safe, 11 interpretable params + 256 blend shapes map directly to measurements; SMPL licensing risk post-Epic acquisition | [research/r5-avatar-garment-3d.md](research/r5-avatar-garment-3d.md) |
| DEC-08 | Garment MVP capability: G0 collage + G2 generative photo try-on; G3 later gated; G4 research bet | Generative VTON is the fastest path to quality without 3D asset production; cloth sim not mobile-viable in 2026 | [research/r5-avatar-garment-3d.md](research/r5-avatar-garment-3d.md) |
| DEC-09 | Selfie→face: on-device landmarks (ARKit/MediaPipe) → stylized likeness (A2); generic default; twin claims forbidden | Honest accuracy framing; on-device first for privacy; heavier reconstruction stays a research bet (RB-1) | [research/r5-avatar-garment-3d.md](research/r5-avatar-garment-3d.md) |
| DEC-10 | Backend: NestJS on Fastify adapter, TypeScript modular monolith + isolated workers | Strongest module/DI story for enforced boundaries with a small TS team | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-11 | API contract: OpenAPI 3.1 canonical, generated TS client, owned by `packages/contracts`; tRPC rejected | Keeps mobile decoupled from server internals; serves future chat/admin/3rd-party clients | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-12 | Database: PostgreSQL on Neon + Drizzle ORM/migrations | Serverless scale-to-zero fits launch economics; standard Postgres keeps portability | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-13 | Vector search: pgvector in the same Postgres | Simplest operationally sound choice; dedicated vector DB only on measured need | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-14 | Jobs/queue: Trigger.dev v4; pg-boss self-hosted fallback | Durable pipelines with idempotency/retries/DLQ without Temporal ops weight | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-15 | ML workers: Python FastAPI in Docker, separately deployable, versioned JSON schemas | Python/native tooling isolation without microservice sprawl | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-16 | Object storage/CDN: Cloudflare R2 (+ Images transforms) | Zero egress — decisive for a media-heavy app (~70× egress cost vs S3+CloudFront) | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-17 | API hosting: Railway; Hetzner+Coolify cost fallback | Usage-based ~$15/mo at launch; clean migration path | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-18 | Auth: better-auth self-hosted (Apple + Google sign-in, passkeys, MFA) | Avoids Clerk/Firebase cost and lock-in for a table-stakes capability | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-19 | Subscriptions: RevenueCat + server-side entitlements table as source of truth | Store-billing complexity outsourced; entitlement truth stays ours (idempotent webhooks + reconciliation) | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-20 | Push: FCM + APNs direct server-side; Expo notifications client-side | No extra vendor needed | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-21 | Analytics/crash/flags: PostHog (+ Sentry optional for mobile crash) | One privacy-controllable tool for events, replay, errors, flags; generous free tier | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-22 | Weather: Open-Meteo commercial plan behind `WeatherProvider` port; Tomorrow.io upgrade path | Global hourly forecast at lowest viable cost; port keeps it swappable | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-23 | Holidays: Nager.Date behind `HolidayProvider` port; Calendarific fallback | Free, 200+ countries, self-hostable | [research/r4-backend-providers.md](research/r4-backend-providers.md) |
| DEC-24 | Background removal: on-device first (Apple Vision / ML Kit) → BiRefNet/RMBG-class on fal.ai fallback | Zero marginal cost for the common case; per-image vendors rejected | [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md) |
| DEC-25 | Classification/attributes: vision-LLM structured JSON extraction (Gemini Flash-class / Claude Haiku); Ximilar only if eval precision insufficient | Schema-constrained extraction beats bespoke CV cost/effort at our scale; escalation ladder defined | [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md) |
| DEC-26 | Embeddings: multimodal API (Cohere Embed v4-class) → self-hosted SigLIP past measured volume | Managed first, self-host only past the cost crossover | [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md) |
| DEC-27 | Explanations: templates from structured reason codes; Claude Haiku (batch + prompt caching) for optional polish | Explanations come from the decision trace, never hallucinated after the fact | [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md) |
| DEC-28 | Generative try-on / missing views: fal.ai (Flux/VTON-class); Replicate for batch fallback | ~100ms-class latency vs multi-second queues; $0.003–0.025/image (as of Aug 2026) | [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md), [r5](research/r5-avatar-garment-3d.md) |
| DEC-29 | AI data policy: no provider training on customer data; prefer zero/short retention; face/body media only to privacy-reviewed providers | Trust is the product; contractual default, not per-feature choice | [research/r3-ai-providers-costs.md](research/r3-ai-providers-costs.md) |
| DEC-30 | iOS delivery: EAS Build or GHA macOS runners + App Store Connect API from CI (~$30–50/mo); final lane = P02 ADR (OQ-04) | Smallest reliable no-Mac path; xtool not viable for RN | [research/r1-linux-ios-build.md](research/r1-linux-ios-build.md) |
| DEC-31 | Monorepo/tasks: pnpm workspaces + Turborepo; `just` task runner; `mise` pinned toolchain; bootstrap + doctor scripts | 2026-default TS monorepo stack; one-command onboarding for agents and humans | [research/r2-mobile-3d-stack.md](research/r2-mobile-3d-stack.md), [r4](research/r4-backend-providers.md) |
| DEC-32 | CI: GitHub Actions (Linux runners; macOS runners only for the iOS lane) | One CI system; expensive runners scoped to the one lane that needs them | [research/r1-linux-ios-build.md](research/r1-linux-ios-build.md) |
| DEC-33 | Module map, dependency rules, and capability codes A0–A3/G0–G4 as specified in SPINE §3–§4 | Single vocabulary + enforced boundaries keep a 2–3 dev, agent-heavy codebase coherent | [SPINE §3–4](SPINE.md); brief §3.2 |

## Prototype needs

Work that must produce evidence before dependent phases commit. Each lands as a task in its phase file; outcomes are logged as DEC entries.

| Prototype / spike | Answers | Feeds | Linked risk |
|---|---|---|---|
| **P01 vertical 3D prototype** (real devices): Anny-derived avatar, 4 morphs, 3–4 poses, rotate/zoom, batch camera→storage, fps/memory/size measured | Is RN + `react-native-filament` viable? Device floor? | Go/no-go for entire 3D surface; OQ-08 | RISK-01, RISK-06, RISK-09 (RB-5) |
| **Anny→glTF asset pipeline spike** (Blender headless, gltfpack, KTX2) | Can we produce stable production assets from Anny? | P04 | RISK-06 |
| **Measurement→morph mapping calibration test** (diverse internal/beta panel) | Does auto-mapping reach "recognize my shape" ≥ 90%? | P04 accept/rework | RISK-05 |
| **G2 try-on eval** (diverse-body, multi-category eval set; unit-cost measurement) | Does G2 clear quality + cost gates? | P11 flag-on decision | RISK-02, RB-4 |
| **Missing-view synthesis eval** (100-item set) | Useful at ≤10% artifact rate and credit economics? | P11 | RB-4 |
| **Fashion-content sourcing spike** (partner/licensing outreach, cost sheet) | Is a licensed feed viable? | P12 build/descope | RISK-03, OQ-05 |
| **Store-compliance review of trial model** (guideline analysis, RevenueCat config dry run) | Will the 3-day server-granted trial pass review? | P13 | RISK-04, OQ-02 |
| **On-device background-removal eval** (representative closet photos) | Server-AI fallback rate low enough for cost model? | P06 | ASM-07, RISK-08 |
| **iOS CI lane dry run** (EAS vs GHA build + TestFlight upload) | Which lane; is signing automatable end-to-end? | P02 ADR | RISK-12, OQ-04 |
