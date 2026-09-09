# SPINE — Canonical Decisions & Conventions

**Status:** Ratified for planning · **Date:** 2026-08-24 · **Amended:** 2026-09-09 (§2 fal.ai prices, §6 weighted credits — [r6](research/r6-pricing-verification-2026-09-09.md), DEC-34/35)
**Purpose:** Single source of truth for decisions, names, and conventions used across every file in `planning/`. Every planning document MUST conform to this file. If a document conflicts with the SPINE, the document is wrong unless the decision log in `16-risks-open-questions-and-decision-log.md` records a superseding decision.

Research evidence: `research/r6-pricing-verification-2026-09-09.md` (**verified prices, 2026-09-09 — supersedes r3/r4/r5 price figures**), `research/r1-linux-ios-build.md`, `research/r2-mobile-3d-stack.md`, `research/r3-ai-providers-costs.md`, `research/r4-backend-providers.md`, `research/r5-avatar-garment-3d.md`. All prices/versions cited are **as of Aug 2026** unless noted.

---

## 1. Product

- **Working name:** "AI Stylist" (final brand name TBD — open question OQ-01).
- Premium personalized AI stylist for **iOS + Android**: parametric 3D avatar adjusted from user measurements, digitized virtual closet (clothing, shoes, accessories), explainable outfit recommendations from the user's real wardrobe driven by weather/forecast/holidays/occasion, generative photo try-on, and personalized fashion intelligence. Not a random outfit generator; every suggestion is grounded, traceable, and explainable.
- **Market:** Global, English-first at launch; USD pricing modeled, store regional tiers. Localization deferred (post-launch).
- **Team:** 2–3 developers, Ubuntu Linux workstations, heavy AI-coding-agent (Claude Code) usage. No Mac owned; hosted macOS CI for iOS delivery.
- **User decisions already made (2026-08-24, from product owner):**
  1. Stack chosen on technical merit (no ecosystem bias).
  2. Monetization: **3-day full-access trial → limited Free tier + paid tiers** (not a hard paywall).
  3. Global English-first launch.
  4. Linux-first development; no Mac purchase planned — hosted macOS CI path.

## 2. Ratified technology decisions

| Area | Decision | Rejected / fallback | Evidence |
|---|---|---|---|
| Mobile framework | **React Native + Expo (SDK 55+, prebuild/dev-client), TypeScript, New Architecture** | Flutter (immature 3D), fully native (2× cost for 2–3 devs) | r2 |
| 3D renderer | **Filament via `react-native-filament` (margelo)**; glTF 2.0, morph targets, skeletal animation, PBR | Fallback: native Filament behind a JSI bridge; rejected: Unity-as-a-Library (size/license), react-three-fiber/expo-gl (dependency instability) | r2 |
| 3D asset formats | **glTF 2.0** canonical; **KTX2/Basis** textures; **Draco or meshopt** mesh compression; asset manifests versioned | USDZ only as iOS AR export if ever needed | r2, r5 |
| Parametric body model | **Anny (Naver, Apache 2.0)** — 11 interpretable shape params + local blend shapes; inclusive base set | Rejected: SMPL/SMPL-X (Meshcapade commercial licensing risk/cost); alternative kept warm: MPFB2/MakeHuman (CC0) | r5 |
| Garment MVP capability | **G0 collage + G2 generative photo try-on (fal.ai try-on-class, $0.07–0.075/image FASHN/Kling; $0.021/MP FLUX 2 LoRA eval-gated — r6)**; A1 parametric avatar for fit context; G3 template 3D garments later, gated | Cloth simulation (G4) = research non-goal for v1; single-image 3D garment reconstruction = research bet | r5 |
| Selfie→face | **On-device landmarks (ARKit / MediaPipe) → stylized likeness on avatar head (A2)**; server path documented for heavier reconstruction; generic face default | "Exact digital twin" claims forbidden | r5 |
| Backend framework | **NestJS on Fastify adapter** — modular monolith + isolated workers, TypeScript | Hono/Fastify-bare (weaker module/DI story), Go/Elixir (no decisive win for this team) | r4 |
| API contract | **OpenAPI 3.1 as the canonical contract**, generated TS client for mobile (openapi codegen); contract files owned by `packages/contracts` | tRPC rejected: couples mobile to server internals, weaker fit for future chat/admin/3rd-party clients — documented in 05 | r4 + orchestrator reconciliation |
| Database | **PostgreSQL on Neon** (serverless, scale-to-zero), **Drizzle ORM** + drizzle-kit migrations | Prisma (heavier), RDS (cost/ops at this scale) | r4 |
| Vector search | **pgvector in the same Postgres** for garment/style embeddings and dedup | Dedicated vector DB rejected until measured need | r4 |
| Jobs/queue | **Trigger.dev v4** for durable pipelines (image/AI), idempotency keys, retries, DLQ semantics | pg-boss kept as self-hosted fallback; Temporal rejected (ops weight) | r4 |
| ML workers | **Python FastAPI services in Docker** (Railway/Hetzner), called via versioned JSON schemas; separately deployable | — | r4 |
| Object storage/CDN | **Cloudflare R2** (+ Cloudflare Images transforms) — zero egress | S3+CloudFront rejected (egress cost ~70× for media-heavy app) | r4 |
| API hosting | **Railway** (usage-based, ~$15/mo at launch) | Hetzner+Coolify as cost fallback at scale | r4 |
| Auth | **better-auth** (self-hosted; Apple + Google sign-in, passkeys, MFA) | Clerk/Firebase rejected (cost/lock-in) | r4 |
| Subscriptions | **RevenueCat** (free < $2.5k MRR, then 1%) + **server-side entitlements table as source of truth**, idempotent webhooks + reconciliation | Direct StoreKit2/Play Billing rejected for v1 (team size) | r4 |
| Push | **FCM + APNs direct** (server-side), Expo notifications module client-side | OneSignal rejected (unneeded vendor) | r4 |
| Analytics / crash / flags | **PostHog** (events, session replay, error tracking, feature flags — generous free tier) + **Sentry optional** for mobile crash if PostHog insufficient | — | r4 |
| Weather | **Open-Meteo** (commercial API plan for production use; hourly forecast, global) behind a `WeatherProvider` port | Tomorrow.io as premium upgrade path | r4 |
| Holidays | **Nager.Date** (free, 200+ countries; self-hostable) behind a `HolidayProvider` port | Calendarific fallback | r4 |
| AI: background removal | **On-device first** (Apple Vision subject lift / ML Kit) → server fallback **BiRefNet/RMBG-class on fal.ai** | remove.bg rejected (per-image cost) | r3 |
| AI: classification & attributes | **Vision-LLM structured extraction (Gemini Flash-class or Claude Haiku) with JSON schema**; Google Cloud Vision for cheap coarse labels; escalate to Ximilar Fashion Tagging only if eval precision insufficient | — | r3 |
| AI: embeddings | **Multimodal embedding API (Cohere Embed v4-class)** → self-hosted SigLIP only past measured volume threshold | — | r3 |
| AI: explanations | **Templates from structured reason codes by default**; **Claude Haiku (batch + prompt caching)** for optional natural-language polish | Explanations are produced by the engine's decision trace, never hallucinated after the fact | r3 |
| AI: generative try-on / missing views | **fal.ai** (try-on $0.07–0.075/image FASHN/Kling, $0.021/MP FLUX 2 LoRA eval-gated; missing view $0.012/MP FLUX.2 dev, $0.003 Schnell; ~100ms-class latency — verified 2026-09-09, r6) | Replicate rejected for real-time (cold starts); usable for batch | r3, r5 |
| AI data policy | Default **no provider training on customer data**; prefer providers with zero/short retention (Anthropic 7-day, no training). Face/body media only to providers passing privacy review | — | r3 |
| iOS build/delivery | **Develop 100% on Linux. EAS Build (or GitHub Actions macOS M-series ~$0.12/min) for iOS builds + signing; TestFlight upload via App Store Connect API from CI; ~$30–50/mo. No Mac purchase.** xtool: not viable for RN; noted as native-only curiosity | Final EAS-vs-GHA choice = ADR in Phase P02 | r1 |
| Monorepo & tasks | **pnpm workspaces + Turborepo**; root task runner **`just`**; pinned toolchain via `mise` (or asdf); one-command bootstrap + doctor script | — | r2, r4 |
| CI | **GitHub Actions** (Linux runners for tests/lint/typecheck/arch checks; macOS runners only for iOS build lane) | — | r1 |

## 3. Modules (modular monolith + workers)

Names are canonical — use exactly these identifiers everywhere (docs, diagrams, repo paths `apps/api/src/modules/<name>`).

| Module | Responsibility | Owns (data) |
|---|---|---|
| `identity` | Accounts, sessions, auth providers, consent records, age gate | users, sessions, consents |
| `profile` | Measurements, body data, preferences, style identity, units/locale | profiles, measurements, preferences |
| `avatar` | Parametric avatar params, calibration, poses, avatar asset versions | avatar_configs, avatar_assets |
| `closet` | Item catalog, taxonomy, attributes, availability/laundry, collections, wear history | items, categories(taxonomy), item_states, wear_events |
| `media` | Upload, asset pipeline state machine, derived assets, lineage, provenance | media_assets, derivations, processing_jobs metadata |
| `outfit` | Garment representation levels, outfit composition, saved outfits | outfits, outfit_items, garment_representations |
| `context` | Context-provider ports (weather, holiday, occasion; future calendar), context facts w/ freshness/confidence/consent | context_facts (cached) |
| `recommendation` | Engine pipeline: hard/soft constraints, candidate gen, scoring, validation, reason codes, feedback ingestion | recommendations, reason_traces, feedback, rule/model versions |
| `fashion-intel` | Trend/runway/seasonal content ingestion, provenance, personalization of feed | content_items, sources, personalization signals |
| `billing` | Plans, entitlements (source of truth), metering/credits, RevenueCat webhooks, reconciliation | entitlements, plans, usage_meters, billing_events |
| `notifications` | Push/scheduling, notification preferences | notification_prefs, deliveries |
| `admin` | Support tooling, moderation queues, audit trails, ops dashboards | audit_log, moderation_queue |
| `assistant` *(future)* | Chat adapter calling the same application services; no own business logic | conversations (future) |
| `shared-kernel` | Units, IDs, color values, measurement definitions, reason-code registry, entitlement names, event envelope | (types/constants only — no tables) |
| `platform` | Infra adapters: storage, queue, email, provider SDK wrappers (implements ports) | (no domain data) |

Dependency rules: modules expose a small public API (`index.ts`); internals not importable (enforced by ESLint boundaries + dependency-cruiser in CI). Domain never imports provider SDKs; `platform` implements ports. `recommendation` must not depend on `avatar`/renderer. `assistant` may only call application services.

## 4. Capability ladders (use these codes everywhere)

**Avatar:** A0 generic base · A1 parametric-adjusted from measurements (MVP) · A2 personalized stylized face from selfie (optional, consented) · A3 scan-grade digital twin (**explicit non-goal**).
**Garment/try-on:** G0 2D flat-lay/collage outfit view (always available fallback) · G1 2.5D overlay on avatar · G2 generative photo try-on (MVP premium) · G3 template 3D garment + texture projection (later, gated) · G4 reconstructed 3D + cloth simulation (**research bet, kill criteria required**).
MVP = A1 + G0 + G2 (G2 entitlement-gated). Provenance marker + confidence required on every generated view; a real user photo is never replaced by a generated one.

## 5. Phases (P00–P15)

One file per phase in `phases/` named `P00-product-validation-and-decisions.md` etc. (table slugs below are canonical). Every phase file follows `templates/phase.md` and must include all sections required by the brief §10.

| ID | Name (file slug) | Goal (one line) | Hard depends on |
|---|---|---|---|
| P00 | `P00-product-validation-and-decisions` | Measurable definitions, legal/privacy discovery, ADR ratification of SPINE decisions | — |
| P01 | `P01-3d-and-capture-prototype-gate` | RN+Filament vertical prototype on real devices: morphs, 3–4 poses, rotate/zoom, camera→upload; go/no-go gate | P00 |
| P02 | `P02-repo-foundations-and-ci` | Monorepo, module skeletons, contracts pipeline, CI/CD (incl. iOS lane), observability baseline, CLAUDE.md + skills live, security foundations | P00 (P01 parallel OK) |
| P03 | `P03-identity-consent-onboarding` | Accounts, consent, profile/measurements/preferences, onboarding walking skeleton E2E | P02 |
| P04 | `P04-parametric-avatar-v1` | Anny base models, measurement→morph mapping, calibration screen, poses, rendering (A1) | P01, P03 |
| P05 | `P05-selfie-face-personalization` | Optional consented selfie→stylized face (A2), deletion/cleanup | P04 |
| P06 | `P06-closet-capture-pipeline` | Single+batch capture, upload queue, processing state machine, segmentation, classification, manual correction; shoes+accessories | P03 (P04 not required) |
| P07 | `P07-closet-organization-and-sync` | Taxonomy views, search/filter, availability/laundry, collections, offline sync | P06 |
| P08 | `P08-context-providers` | Weather/forecast/holiday/occasion providers with freshness, confidence, overrides | P03 |
| P09 | `P09-recommendation-engine-v1` | Deterministic engine: hard/soft constraints, candidates, scoring, validation, reason codes, feedback | P07, P08 |
| P10 | `P10-outfit-on-avatar` | Outfit composition on avatar (G0 collage + avatar presentation), multi-pose viewing, graceful fallbacks | P04, P09 |
| P11 | `P11-generative-tryon-and-views` | G2 generative photo try-on + missing-view synthesis, eval+cost gated, provenance | P06, P10 |
| P12 | `P12-fashion-intelligence` | Licensed content ingestion, provenance, personalized inspiration feed, moderation | P09 |
| P13 | `P13-monetization-and-entitlements` | 3-day trial, Free tier limits, 3 paid tiers, RevenueCat, metering/credits, paywall, reconciliation | P03 (limits enforce from P06+ via flags) |
| P14 | `P14-hardening-and-launch` | Accessibility, security/privacy review, performance, device coverage, store readiness, staged beta→launch | all P03–P13 |
| P15 | `P15-post-launch-learning` | Metrics learning, calendar provider seam, AI-chat foundations (only if metrics justify) | P14 |

Notes: entitlement *seams* (feature flags + entitlement checks) are built into features from P06 onward; P13 turns on billing. Trial starts at account creation (server-granted), not at store subscription.

## 6. Pricing model (ALL prices are hypotheses requiring market testing — label them so)

**Trial:** 3-day full access at **Pro** level from signup, server-granted, no card required. After expiry → Free tier. Data never deleted on downgrade; export always available.

| Plan | Price (hypothesis) | Closet | Recommendations | Avatar/try-on | Generative credits/mo (weighted) | Extras |
|---|---|---|---|---|---|---|
| **Free** | $0 | up to 40 items | 1/day, basic context | A1 avatar, G0 collage only | 0 | export, ads-free anyway |
| **Essentials** | $4.99/mo · $39.99/yr | 500 items | unlimited, full context | A1 + poses, G0 | 10 (= 10 missing views; no try-on) | missing-view gen, trends feed (basic) |
| **Plus** | $9.99/mo · $79.99/yr | unlimited | unlimited + future-day planning | + G2 photo try-on | 60 (= 20 try-ons or 60 missing views) | personalized trends, wardrobe analytics |
| **Pro** | $19.99/mo · $149.99/yr | unlimited | everything | + priority processing, multi-angle exports | 150 (= 50 try-ons or 150 missing views) | early features, future stylist chat |
| **Top-up packs** (consumable IAP, any paid tier) | 30 credits $4.99 · 100 credits $12.99 | — | — | — | no expiry (or 90-day — decide at P13) | P13 stretch, otherwise v1.1 |

**Weighted credits (re-baselined 2026-09-09, [r6](research/r6-pricing-verification-2026-09-09.md), DEC-34):** a G2 try-on image costs **3 credits**, a missing-view image **1 credit**. Provider cost per try-on ≈ $0.075 (FASHN/Kling on fal.ai, +10% retry allowance ≈ $0.0825); per missing view ≈ $0.012 (FLUX.2 dev), i.e. ≈ $0.0275 per credit either way. The earlier flat 10/50/200 credits at an assumed ~$0.01/image would have left Pro at break-even monthly and **−$6/mo on annual** at real prices; the weighted allotments cap generative exposure at ≈ $0.13 / $1.65 / $4.13 per Essentials / Plus / Pro subscriber-month. If the cheaper FLUX 2 try-on LoRA ($0.021/MP) passes the P11 quality gate, weights may be relaxed (decision logged at P11).

Unit economics anchors (r6, verified 2026-09-09): per closet item processed ≈ $0.002; AI cost/user/mo steady ≈ $0.01–0.06 (light–medium), heavy ≈ $0.10–0.15, **excluding credits**; onboarding spike $0.10–0.30; infra ≈ $60–70/mo at launch, ≈ $370–450/mo at 5k MAU (≈ $0.08 per active user). Store fee base case 15% (Apple SBP; Google Play reportedly 10% since June 2026 — verify at P13). Doc 12 owns the full calculation tables. Experiments queued for P13: Free cap 40 vs 100 items (market clusters at 100), weekly Plus SKU (weekly plans ≈ 55% of category revenue per Adapty 2026), annual discount depth, credit quantities.

## 7. Requirement ID scheme (owned by `01-requirements-and-traceability.md`)

`REQ-<AREA>-NNN` functional, `NFR-<AREA>-NNN` non-functional. Areas: ONB (onboarding/profile), AVA (avatar), FAC (face/selfie), CAP (capture), ORG (closet org), MED (media pipeline), CTX (context), REC (recommendation), EXP (explanation/feedback), TRD (fashion intel), CHT (future chat), BIL (billing/pricing), NOT (notifications), SEC (security), PRV (privacy/compliance), PERF (performance), OBS (observability), TST (testing/quality), TEAM (team/workflow), AIC (AI usage/cost). Every phase file lists the exact IDs it delivers; only IDs defined in doc 01 may be referenced.

## 8. Terminology (canonical)

closet item · outfit (composition of items) · recommendation (structured result w/ reason codes, confidence, alternatives) · reason code (stable identifier from `shared-kernel` registry) · context fact (typed, with provider/source-time/freshness/confidence/consent/override) · hard constraint vs soft preference · entitlement (server-side capability grant) · generative credit · provenance marker · availability state (`available | laundry | packed | lent | repair | archived`) · capability codes A0–A3, G0–G4 · processing state machine states (owned by doc 06/07).

## 9. File map

```
planning/
  README.md                    SPINE.md                     PROGRESS.md
  00-product-vision-and-scope.md
  01-requirements-and-traceability.md
  02-user-journeys-and-information-architecture.md
  03-domain-model-and-glossary.md
  04-architecture.md
  05-technology-decisions.md
  06-data-api-and-event-contracts.md
  07-3d-avatar-and-garment-pipeline.md
  08-closet-taxonomy-and-organization.md
  09-recommendation-engine.md
  10-ai-usage-cost-and-evaluation.md
  11-security-privacy-and-compliance.md
  12-pricing-entitlements-and-unit-economics.md
  13-testing-quality-and-performance.md
  14-observability-operations-and-analytics.md
  15-team-workflow-and-ai-agent-operations.md
  16-risks-open-questions-and-decision-log.md
  CLAUDE.md                    (proposed root operating contract)
  .agents/skills/<skill>/SKILL.md
  templates/{adr,module-contract,phase,issue,pull-request,session-handoff}.md
  phases/P00…P15 (one file each)
  research/r1…r6 (evidence; read-only — r6 holds verified prices)
```

## 10. Writing rules (binding for every author/agent)

1. Conform to SPINE names, codes, phases, tiers, modules. Never rename or renumber locally.
2. Link, don't repeat: each concept has one owning doc; others link to it (`see [09-recommendation-engine.md](09-recommendation-engine.md)`).
3. Prices/versions carry an as-of date and source (research file or primary link). No invented benchmarks, no fabricated market validation. Label hypotheses and legal statements needing counsel review.
4. Mermaid diagrams where they clarify (architecture, state machines, phase deps); verify syntax renders.
5. Honesty rules: never promise "exact digital twin"; expose uncertainty/confidence; deterministic-before-AI; provenance on generated content.
6. Phase files include every section from the brief §10 and reference requirement IDs + owning docs.
7. Keep files focused; small-team-realistic granularity.
