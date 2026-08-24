# Master Planning Prompt: Professional AI Stylist for iOS and Android

Copy everything below this line and send it to Fable.

---

You are the principal product architect, mobile architect, 3D/graphics architect, AI/ML architect,
security engineer, and technical program manager for a new production-grade mobile application.
Your task is to turn the complete product brief below into an implementation-ready planning package
made of detailed Markdown files, especially one comprehensive file per delivery phase.

This is a planning task. Do not begin implementing product code. Do not reduce the response to a
generic roadmap, a feature list, or an MVP checklist. Produce the durable planning files that a small
team using AI coding agents can follow across many independent work sessions without losing context,
duplicating logic, or eroding the architecture.

## 1. Product vision

Build a premium, highly personalized AI stylist application for both iOS and Android. It is inspired
by products such as Lookroom, but it must be more professional, technically credible, personalized,
feature-rich, maintainable, and extensible.

The product should help a user:

1. Create a realistic, adjustable 3D representation of themselves.
2. Digitize and continuously organize their real wardrobe, including clothing, shoes, and accessories.
3. See recommended outfits on their adjusted 3D model in multiple poses and viewing angles.
4. Receive useful outfit recommendations based on their wardrobe, body/profile data, preferences,
   weather and forecast, holidays, occasion, and other explicit context.
5. Discover relevant fashion trends, runway collections, seasonal styles, and outfit inspiration.
6. Understand why each recommendation was made and provide feedback that improves future results.

This is not a random outfit generator. Every suggestion must be grounded in known user data, actual
closet inventory, explicit context, learned preferences, and explainable recommendation rules. When
information is unknown, the system must expose the uncertainty, ask for the missing input when useful,
or clearly label the assumption. It must never silently invent personal facts.

## 2. Core user journey

Plan the entire user journey, including empty, loading, partial, failure, retry, and recovery states.

### 2.1 Onboarding and profile

On first use, guide the user through a progressive onboarding flow that collects only what is needed
at each step. The app should be useful before every optional field is complete.

The profile may include:

- Height and weight, with metric and imperial units.
- Body measurements that are genuinely useful for avatar adjustment, fit, and recommendations.
- Optional body-shape information, fit preferences, proportions, sizing by brand or region, and
  accessibility or mobility considerations.
- Gender/presentation settings that are inclusive and not unnecessarily coupled to body geometry.
- Preferred silhouettes, colors, patterns, materials, brands, style identities, modesty preferences,
  comfort priorities, dress codes, disliked items, and hard exclusions.
- Climate tolerance, such as whether the user runs hot or cold.
- Lifestyle and common occasions, without requiring calendar access in the first release.
- Budget and shopping preferences only if a later commerce feature needs them.
- Locale, language, units, timezone, region, and accessibility preferences.

Separate required fields from optional fields. Explain why sensitive data is requested. Allow every
optional field to be skipped and edited later. Include consent, correction, export, and deletion flows.

### 2.2 Optional selfie and personalized face

The user may take or upload a selfie to personalize the avatar's face. This is optional. Plan:

- Camera guidance, lighting and pose guidance, image quality validation, retake, crop, and review.
- Explicit consent for face processing and storage.
- A privacy-preserving alternative that uses a generic face.
- On-device processing where technically practical, and a documented server-side path where it is not.
- Secure upload, short-lived URLs, retention limits, deletion, account deletion, and model-asset cleanup.
- A confidence and quality indicator rather than claiming impossible accuracy.
- A fallback when one selfie is insufficient, including an optional guided multi-angle capture.
- Protection against misuse, unauthorized face creation, and processing images of another person.

Do not casually describe a single selfie as producing an exact digital twin. Distinguish between a
personalized likeness, a reconstructed head, a parametric avatar, and a scan-quality digital twin.
Define the accuracy the product can honestly promise in each release.

### 2.3 Parametric 3D avatar

The app begins with predefined, production-quality base models that cover users who select masculine,
feminine, and any additional presentation/body options supported by the product. Do not create one
rigid stereotyped male model and one rigid stereotyped female model. Plan an inclusive parametric
system with a manageable set of base meshes, shared conventions, and morph targets/blend shapes.

The selected base model must be adjusted from validated user data. The plan must cover:

- Body parameter mapping and realistic bounds.
- Height, proportions, circumference/measurement mapping, body composition approximations, and fit.
- Skeleton/rig compatibility and stable topology across morphs.
- Skin tone, hair, and optional appearance customization, with inclusive representation.
- A calibration/review screen where the user corrects the result.
- Handling incomplete, conflicting, implausible, or low-confidence measurements.
- Versioning and migrating avatar assets when the rig or mesh changes.
- At least three or four standardized poses plus rotation/multiple viewing angles.
- Neutral pose, walking/casual pose, seated or occasion-appropriate pose if feasible, and a pose that
  reveals garment fit without distorting it.
- Camera controls, lighting, material rendering, level-of-detail, texture compression, asset streaming,
  GPU/memory budgets, battery/thermal constraints, and low-end-device fallbacks.
- Accessibility alternatives for users who cannot or do not want to use a 3D view.

The recommendation engine must not be coupled to the renderer. The avatar, garments, outfit composition,
and recommendation result need stable contracts so the renderer can be replaced or upgraded later.

### 2.4 Virtual closet capture

After onboarding, users digitize their closet by photographing clothing, shoes, and accessories. Plan a
fast capture loop for one item and a batch-capture flow for many items.

Support:

- Tops, bottoms, dresses/one-pieces, outerwear, underwear where appropriate, shoes, bags, belts, hats,
  jewelry, watches, scarves, eyewear, and an extensible accessory/category taxonomy.
- Front-only capture as the minimum input.
- Optional back, side, detail, label, and material photos.
- Background removal, perspective correction, color calibration, image quality checks, deduplication,
  category detection, attribute extraction, and user confirmation.
- AI completion of missing sides/back only when those views were not supplied.
- No generated replacement for a real view that the user captured successfully.
- A provenance marker on every generated view and a confidence indicator.
- The ability to replace a generated view later with a real photo.
- Clear separation between a photorealistic catalog image, a 2D cutout, an inferred texture, a garment
  proxy, and a simulation-ready 3D garment.
- Failure/retry/manual-edit paths when segmentation or classification is wrong.
- Duplicate and near-duplicate detection based on visual and semantic similarity, not filename alone.
- Offline or interrupted upload queues and resumable background processing.

Be technically honest about generating a complete, physically accurate 3D garment from one front photo.
Treat missing-view synthesis, texture projection, proxy geometry, garment reconstruction, cloth simulation,
and physically accurate virtual try-on as separate capability levels. Place uncertain parts behind R&D
spikes with measurable success and kill criteria. The product must still deliver value if full 3D garment
reconstruction is not yet good enough.

### 2.5 Closet organization

The virtual closet must remain organized as it grows. Plan automatic organization plus easy manual
correction. The taxonomy must be extensible and normalized rather than stored as uncontrolled strings.

At minimum, consider:

- Category and subcategory.
- Season and climate suitability.
- Color palette, dominant and secondary colors.
- Pattern, material, texture, cut, silhouette, fit, length, sleeve, neckline, rise, heel type, and other
  category-specific attributes.
- Warmth, breathability, water resistance, layering role, formality, dress code, and activity suitability.
- Brand, size, purchase date, condition, laundry/care state, availability, favorite status, and archive.
- Outfit history, wear frequency, last worn, cost-per-wear if purchase price is supplied, and user notes.
- Custom tags, saved filters, search, sort, collections/capsules, season views, and color views.
- Items temporarily unavailable because they are in laundry, packed, lent out, being repaired, or archived.

The plan must prevent taxonomy drift, duplicate tags, inconsistent units, and repeated derivation of the
same attributes. Define the canonical source for item metadata and how corrections affect future models.

### 2.6 Daily and future outfit recommendations

Once a closet exists, recommend outfits made from items the user actually owns. The recommendation engine
must be a well-defined, versioned, explainable subsystem—not a single LLM prompt and not business logic
scattered across screens.

It must account for multiple signals, including:

- Current weather and hourly conditions.
- Forecast for a selected future day.
- Temperature, feels-like temperature, rain/snow probability, wind, humidity, UV, and indoor/outdoor plans
  when those materially affect clothing.
- Public holidays based on locale, while allowing the user to choose whether the holiday matters.
- User-selected occasion, dress code, activity, location type, time of day, travel, desired style, and
  comfort/formality goals.
- Closet availability, garment compatibility, layering, color coordination, silhouette, fit preference,
  repeat/wear history, laundry state, and user feedback.
- The user's climate tolerance and personal restrictions.
- Seasonal trends and inspiration only after hard practical constraints are satisfied.
- In future phases, user schedules, calendar events, travel plans, venue context, and other condition
  providers without redesigning the engine.

The engine must enforce hard constraints before ranking soft preferences. For example, selecting a holiday
must never cause shorts to be recommended in unsafe cold weather. Define precedence and conflict-resolution
rules. A suggested outfit must pass a final policy/compatibility validation step.

Design the engine as an extensible pipeline, such as:

1. Collect normalized context from independent providers.
2. Record source, freshness, confidence, consent, and user overrides for each context fact.
3. Evaluate hard exclusions and safety/practicality rules.
4. Generate compatible candidates from the actual closet.
5. Score candidates using deterministic rules and learned user preferences.
6. Apply controlled personalization and trend relevance.
7. Validate the complete outfit against all hard constraints.
8. Rank deterministically and return structured reasons, confidence, alternatives, and missing-data notes.
9. Render the selected outfit on the avatar without putting recommendation logic in the renderer.
10. Capture explicit and implicit feedback with suitable privacy controls.

The exact architecture may improve on this pipeline, but it must preserve modular context providers,
hard-versus-soft constraints, deterministic behavior, explainability, traceability, and future extensibility.

Do not introduce randomness disguised as personalization. If two choices tie, use a deterministic tie-break
or an explicit user-controlled “show me something different” mode that still honors all constraints.

### 2.7 Recommendation explanation and feedback

Each recommendation should state concise, concrete reasons, for example weather suitability, occasion fit,
color harmony, use of a rarely worn item, or alignment with a saved preference. Do not expose private or
sensitive inference in surprising language.

Support feedback such as:

- Like/dislike the whole outfit.
- Replace one item while keeping the rest.
- Too warm/cold, too formal/casual, uncomfortable, wrong color, wrong fit, repetitive, or unavailable.
- Save outfit, schedule for later, mark as worn, and compare alternatives.
- “Never suggest this pairing” and other durable negative constraints.

Define which feedback becomes a hard rule, a preference weight, a temporary session signal, or training/eval
data. Include undo, reset-personalization, and preference transparency.

### 2.8 Fashion intelligence

Plan a fashion-intelligence subsystem that can inform users about relevant:

- Current fashion trends.
- Runway collections.
- Seasonal styles.
- Outfit inspiration.
- Categories, designers, colors, silhouettes, and materials relevant to the user's taste and closet.

This must not be a random or generic content feed. Personalize the feed using explicit style preferences,
closet composition, region, season, climate, followed designers/brands, and feedback. Explain why content is
shown. Define freshness, source provenance, deduplication, editorial quality, licensing/copyright rules,
content safety, source attribution, ingestion jobs, moderation, and what happens when a source disappears.
Do not propose unauthorized scraping as the foundation of the business.

Separate fashion knowledge from outfit suitability. A trend may influence a recommendation only if the
outfit still satisfies weather, occasion, availability, and hard user constraints.

### 2.9 Future AI stylist chat

A conversational AI stylist will be added later. Do not implement chat in the initial phases unless needed
for a narrow prototype, but prepare for it architecturally.

The future chat must call the same profile, closet, context, recommendation, trend, and entitlement services
as every other client. It must not create a second recommendation engine or directly query internal tables.
Plan stable application-service/tool contracts, authorization, conversation privacy, auditability, prompt
versioning, tool-call limits, model routing, cost controls, and safe deletion. Identify the earliest phase
where these seams should be established without paying the cost of a speculative chat system now.

### 2.10 Pricing and subscriptions

The app needs pricing plans. Produce a proposed tier structure grounded in user value and actual variable
costs. Do not invent exact prices and present them as validated. If exact prices are proposed, label them as
hypotheses requiring market research and store-region testing.

Plan:

- A useful free experience and paid tiers with clear value boundaries.
- Entitlements rather than UI-only feature flags.
- Monthly and annual subscriptions, trials or introductory offers if justified, restore purchases, grace
  periods, billing retry, cancellation, refunds, upgrades/downgrades, family/account questions, and regional
  availability.
- Apple App Store and Google Play billing compliance.
- A server-side source of truth for entitlement state with idempotent webhook handling and reconciliation.
- Usage metering for genuinely expensive operations such as high-quality asset reconstruction, while not
  making normal daily use feel punitive.
- Cost-to-serve estimates per capability and plan-level guardrails.
- Experiments, grandfathering, plan versioning, and a clean path to change packaging later.
- Behavior when a subscription expires: user data remains safe and exportable, and paid-derived assets are
  handled predictably.

## 3. Technical principles

### 3.1 AI is a bounded capability, not the architecture

Minimize paid and generative AI usage. If deterministic code, geometry, computer vision, a rules engine, a
database query, or a cached computation can reliably solve the problem, use it instead of an LLM.

The plan must classify each proposed AI use as one of:

- Necessary generative/reconstruction task.
- Conventional computer vision or ML inference.
- Embedding/similarity task.
- Ranking/personalization model.
- Optional natural-language explanation.
- Deterministic code or rules where AI is not appropriate.

For every AI-backed feature specify:

- Input/output contract and structured schema.
- Why deterministic code is insufficient.
- Model/provider abstraction and portability strategy.
- On-device versus server inference decision.
- Quality threshold and confidence handling.
- Evaluation dataset and success metrics.
- Latency and cost budget.
- Caching, deduplication, batching, preprocessing, and reuse strategy.
- Fallback behavior when a model/provider is slow, unavailable, expensive, or low-confidence.
- Human/user confirmation step where wrong output would harm trust.
- Prompt/model/version tracking and reproducibility.
- Data retention and whether customer data may be used for training. Default to no provider training unless
  explicit, informed consent and contracts permit it.

Avoid sending the same photo or item through expensive models repeatedly. Store derived results with lineage,
hash inputs, invalidate only affected derivatives, and make processing jobs idempotent. Use small/specialized
models before large general models. Generate natural-language explanations from structured reason codes when
templates are sufficient.

### 3.2 Recommended architecture direction

Start with a modular monolith plus isolated workers unless measured scale or deployment constraints justify
microservices. Use clear, deep modules inspired by domain boundaries, but do not impose ceremonial or overly
complex Domain-Driven Design. Optimize for a small team using AI coding agents.

At minimum, evaluate these modules/bounded areas and refine their names and responsibilities:

- Identity, Account, Consent, and Entitlements.
- User Profile, Measurements, Preferences, and Personalization.
- Avatar and Appearance.
- Closet Catalog and Taxonomy.
- Media and Asset Processing.
- Garment Representation and Outfit Composition.
- Context Providers: weather, holiday, occasion, and future calendar/schedule providers.
- Recommendation and Feedback.
- Fashion Intelligence and Content Provenance.
- Billing and Metering.
- Notifications.
- Administration, Operations, and Support.
- Future Assistant/Chat adapter.

For every module define its public interface, owned data, invariants, events, dependencies, forbidden
dependencies, tests, and extension points. Internal implementation must not be imported from other modules.
Cross-module behavior must go through explicit application services, commands/queries, events, or ports.

Use one canonical source of truth for each concept. Shared schemas, units, category identifiers, color values,
measurement definitions, entitlement names, reason codes, and event contracts must be versioned and generated
or imported from one owner—not copied by mobile, backend, workers, and admin tools.

### 3.3 Recommendation engine as a first-class domain

Provide a dedicated design for the recommendation engine, including:

- Typed context facts with provider, source time, expiry/freshness, confidence, consent scope, and override.
- A plugin/provider interface for adding calendar and other future signals.
- Hard constraints, soft constraints, weights, compatibility rules, scoring, tie-breaks, and final validation.
- Versioned rules and models so a recommendation can be reproduced and debugged.
- Candidate-generation limits and performance strategy for large closets.
- Structured recommendation results independent of UI and 3D rendering.
- Explanation/reason codes produced by the decision process, not hallucinated afterward.
- User feedback ingestion and guardrails against one accidental action overfitting the profile.
- Cold-start strategy, sparse-closet strategy, missing-context strategy, and no-valid-outfit behavior.
- Offline/cached recommendation behavior and context freshness warnings.
- Experimentation without corrupting deterministic safety constraints.
- Evaluation metrics: practical validity, acceptance/save/wear rate, constraint violation rate, diversity,
  repetition, latency, cost, and user trust.

### 3.4 Event-driven extension without premature distribution

Use domain/application events and an outbox where reliable asynchronous work is needed, such as media
processing, derived assets, notifications, billing webhooks, trend ingestion, and feedback aggregation.
Do not introduce a distributed event platform until real throughput requires it. Define idempotency keys,
retry limits, dead-letter handling, observability, ordering expectations, and replay/versioning policy.

### 3.5 3D and media asset pipeline

Design a versioned asset pipeline with explicit stages and state transitions. Cover:

- Original upload and immutable content hash.
- Validation and malware/content checks.
- EXIF/privacy stripping and orientation normalization.
- Background segmentation and quality scoring.
- Attribute extraction and user confirmation.
- Optional missing-view synthesis.
- Texture/material creation.
- Garment proxy or 3D reconstruction where supported.
- Rigging/skinning or attachment metadata.
- Optimization, level-of-detail generation, compression, thumbnails, and CDN publication.
- Moderation and failure/quarantine states.
- Lineage between original, generated, corrected, and superseded assets.
- Reprocessing after model upgrades without destroying user corrections.

Define canonical 3D formats and mobile delivery formats only after comparing their support across the chosen
renderer and pipeline. Address coordinate systems, units, mesh topology, skeleton version, morph-target names,
PBR materials, texture color space, animation clips, collision/cloth behavior, compression, and asset manifests.

### 3.6 Security, privacy, and safety by design

Treat body measurements, selfies, face-derived geometry, location, calendar events, and wardrobe history as
sensitive. The plan must include:

- Threat model and abuse cases.
- Least privilege and explicit consent per integration.
- Authentication, secure session storage, authorization, tenant/user isolation, and admin access controls.
- Encryption in transit and at rest, managed keys, secret rotation, signed media URLs, and upload restrictions.
- Data classification, retention, deletion, export, backup deletion limitations, and auditable access.
- Privacy choices for precise versus coarse location and manual city entry for weather.
- Calendar minimization: process only fields needed for outfit context and avoid storing full event content.
- Logging rules that prohibit sensitive photos, tokens, raw calendar text, and unnecessary personal data.
- GDPR/UK GDPR, CCPA/CPRA, app-store privacy disclosures, biometric/face-data rules, and regional legal review.
- Age policy and whether minors are supported; do not leave this implicit.
- Incident response, rate limits, abuse prevention, content moderation, and account recovery.
- No body shaming, attractiveness scoring, health diagnosis, or unsupported inference from appearance.
- Inclusive language and controls that let users correct the system.

Label legal/compliance statements that require qualified legal review; do not present the plan as legal advice.

### 3.7 Performance and reliability

Define measurable budgets rather than saying “fast”:

- App startup, interaction response, recommendation latency, camera-to-catalog time, asset download, and 3D
  first-render targets.
- Frame-rate, frame-time, memory, GPU memory, package size, battery, thermal, network, and cache budgets for
  representative low-, mid-, and high-tier devices.
- Backend availability, queue latency, job completion, API latency percentiles, error budgets, and recovery.
- Bounded queues, timeouts, retries with jitter, circuit breakers, cancellation, backpressure, and graceful
  degradation.
- Offline support and eventual synchronization for closet capture/editing.
- CDN and asset caching with safe invalidation and disk limits.
- Load testing and device performance testing before claims are accepted.

Targets must initially be hypotheses, then measured and updated. Do not fabricate benchmark results.

## 4. Technology evaluation and recommendation

Recommend a concrete stack, but first compare credible alternatives with a weighted decision matrix. Use
current official documentation and primary sources, record versions or decision dates, and identify any
assumption that needs a prototype.

At minimum evaluate:

### 4.1 Mobile application

Compare a cross-platform application shell such as React Native with Expo/prebuild, Flutter, and fully native
Swift/Kotlin against the product's demanding camera and 3D requirements. Consider:

- Smooth native UX, accessibility, camera/media APIs, background tasks, offline storage, push notifications,
  app-store release workflows, over-the-air update constraints, type safety, team size, AI-agent productivity,
  ecosystem maturity, and escape hatches to native code.
- Whether the 3D surface should be a native module, Unity-as-a-Library, a native renderer on each platform,
  a shared renderer such as Filament, or another proven approach.
- The cost and maintenance impact of embedding a game engine in a normal mobile app.
- Interop boundaries so normal screens do not depend on 3D engine internals.

Do not choose the stack only because it is popular. Run an early vertical prototype on real iOS and Android
devices: load a representative avatar and garments, switch among three or four poses, rotate/zoom, measure
frame rate/memory/startup/package size, and prove camera/upload integration.

### 4.2 Linux-first development reality

The team develops primarily on Ubuntu Linux. The plan must make Android and backend development excellent on
Linux, but it must explicitly acknowledge that production iOS builds, signing, simulator/device testing, and
App Store delivery require macOS/Xcode infrastructure. Propose the smallest reliable solution: dedicated Mac,
hosted macOS CI, or a managed build service. Never imply that the complete iOS release lifecycle can be done
locally on Ubuntu.

### 4.3 Backend and data

Compare and choose:

- A typed API/backend framework suitable for a modular monolith.
- PostgreSQL for transactional source-of-truth data and migrations.
- Object storage plus CDN for original and derived media/3D assets.
- A durable job queue and worker runtime for image/3D/AI pipelines.
- Redis only for justified cache, rate-limit, lock, or queue needs—not as a second source of truth.
- Search and vector similarity options, beginning with the simplest operationally sound choice.
- API contract strategy and generated mobile clients.
- Infrastructure as code, environments, preview deployments, backups, restore drills, and local containers.

Keep ML/media workers separately deployable when Python/native tooling requires it, but do not split every
domain into a service. Define how TypeScript or another backend language interoperates with ML workers using
versioned schemas and idempotent jobs.

### 4.4 External providers

Evaluate providers behind owned ports/interfaces for:

- Weather and forecast.
- Locale-aware public holidays.
- Authentication.
- Push notifications.
- Subscriptions and entitlement reconciliation.
- Object storage/CDN.
- Product analytics, crash reporting, tracing, and feature flags.
- AI/vision inference and GPU jobs.
- Fashion content sources.

For each, record data rights, coverage, pricing driver, rate limits, privacy, reliability, vendor lock-in,
fallback, caching, and replacement cost. Never place provider-specific types in the domain core.

## 5. Codebase and repository standards

Design a codebase with a recognizable architectural signature: predictable locations, clear module contracts,
few ways to do the same thing, and low cognitive load.

### 5.1 Repository structure

Recommend a monorepo structure appropriate to the chosen stack. It should visibly separate:

- Mobile app and platform-native bridges.
- Backend application and composition root.
- ML/media workers.
- Shared API/event schemas and generated clients.
- Domain modules and application services.
- Infrastructure adapters.
- 3D source assets, optimized delivery assets, asset schemas, and tooling, with large binaries handled through
  an appropriate artifact store rather than casually committed to Git.
- Admin/internal tools if needed.
- Documentation, ADRs, phase plans, scripts, test fixtures, and evaluation datasets.

Do not create a generic `utils` dumping ground. Utilities should live with the concept they serve or in a
small, explicitly owned foundation module.

### 5.2 Deep modules and dependency rules

Use domain-oriented modular separation without excessive DDD ceremony. Each module must have a small public
entry point and hide internal implementation. Enforce dependency direction through tooling in CI. Business
logic must not live in UI components, controllers, database models, provider SDK wrappers, or background-job
handlers.

Specify:

- Allowed dependency graph.
- Public versus internal imports.
- Composition roots.
- Repository/port ownership.
- Transaction boundaries.
- Module-level events and contracts.
- How the mobile application shares contracts without sharing server internals.
- How renderer/engine code stays isolated from profile and recommendation logic.

### 5.3 No duplication and semantic reuse checks

AI agents must search before writing. A name-only search is insufficient. Require a workflow that searches by
behavior and structure using repository search, symbol/LSP navigation, AST or semantic similarity tooling,
clone detection, dependency graphs, and review of neighboring modules.

Before adding a function, hook, component, service, mapper, validator, schema, constant, test fixture, or job,
the agent must:

1. Describe the behavior it intends to add.
2. Search for equivalent or overlapping behavior, including differently named implementations.
3. Read the complete candidates.
4. Reuse or extend the canonical implementation when appropriate.
5. If a new implementation is necessary, explain why existing ones do not fit.
6. Run duplication/architecture checks before completion.

Avoid speculative generic abstractions, but never copy-and-diverge. One requirement should have one obvious
place to change.

### 5.4 File and script discipline

- Keep production files small and single-purpose. Establish review thresholds and documented exceptions; do
  not split coherent code merely to satisfy an arbitrary line count.
- Put tests in a dedicated `tests/` directory inside each domain/module, as requested. Do not scatter test
  files throughout production source directories. Define the narrow exceptions required by a framework, if
  any, and document them.
- Keep fixtures/builders in module-owned test support packages instead of duplicating them.
- Wrap long or error-prone commands in short, readable, cross-team task-runner commands.
- Use a root task runner such as `just` (or justify a better choice) with memorable commands for bootstrap,
  dev, test, lint, typecheck, format, architecture checks, generation, migrations, mobile builds, 3D asset
  validation, ML evaluation, security checks, and CI parity.
- Scripts must be readable, idempotent where practical, fail fast, print actionable errors, and avoid hiding
  important behavior in enormous shell one-liners.
- Pin critical tool versions and automate Ubuntu setup with a documented bootstrap script.

### 5.5 Schema and generation discipline

Pick canonical owners for API schemas, event schemas, category taxonomy, measurement units, asset manifests,
recommendation reason codes, and feature entitlements. Generate clients/types when it reduces drift. Generated
files must be clearly marked and checked for reproducibility. CI must fail on stale generation.

## 6. Testing and quality strategy

Testing is required from the first walking skeleton. Every domain/module has its own `tests/` directory and
test support. Build a test pyramid appropriate to each subsystem:

- Pure domain unit tests for rules, constraints, scoring, normalization, and state transitions.
- Property-based tests for measurements, unit conversions, taxonomy, ranking invariants, and constraint
  combinations.
- Contract tests for mobile/backend APIs, events, providers, model outputs, and version compatibility.
- Repository and adapter integration tests against real disposable dependencies where useful.
- Job idempotency, retry, cancellation, dead-letter, and reprocessing tests.
- Mobile component and integration tests.
- End-to-end tests for onboarding, closet capture, recommendation, purchase/restore, deletion, and degraded
  external providers.
- Golden/visual regression tests for avatar poses, garment rendering, colors, and important UI states.
- Real-device performance tests for representative iOS and Android tiers.
- Accessibility tests plus manual screen-reader, dynamic-text, contrast, reduced-motion, and touch-target checks.
- Security tests for authorization, user isolation, signed uploads, webhook replay, rate limits, and deletion.
- Migration, backup, and restore tests.
- AI/ML evaluation suites with versioned, consent-safe datasets; precision/recall or task-specific metrics;
  demographic/skin-tone/body-shape slices where ethically and legally appropriate; hallucination/invalid-output
  checks; and cost/latency regression gates.
- Recommendation simulations proving hard constraints are never violated, including cold-weather holiday
  cases, unavailable/laundry items, conflicting dress codes, sparse closets, and future forecasts.

Tests must assert observable behavior, not implementation call shapes. New bug fixes require a regression
test that demonstrably fails before the fix. No skipped tests to make CI green. Flaky tests are product defects
and must be fixed or quarantined with an owner and deadline, never silently retried forever.

Define CI tiers: fast pull-request gates, targeted affected-module tests, nightly device/render/ML suites, and
pre-release full qualification. Include test-data factories and privacy-safe fixtures.

## 7. Observability, analytics, and operations

Plan privacy-conscious observability from the beginning:

- Structured logs with correlation IDs and strict redaction.
- Traces across API requests and asynchronous asset jobs.
- Metrics for latency, errors, queue depth, job age, provider failures, cache effectiveness, recommendation
  validity, 3D asset failures, billing reconciliation, and cost per active user.
- Crash reporting for mobile and backend.
- Dashboards, alerts, runbooks, on-call expectations suitable for a small team, and incident reviews.
- Product analytics based on an explicit event taxonomy and consent, with no raw sensitive payloads.
- Audit trails for admin access, consent, asset deletion, recommendation versions, and entitlement changes.
- Feature flags with ownership, expiry dates, and safe rollout/rollback.

Every phase must add the observability needed to operate what it introduces.

## 8. Small team and AI-assisted development setup

The project will be built by a small team working on Ubuntu and using AI coding agents heavily. Produce a
complete collaboration setup, not merely a tool list.

Include:

- Required local tools, pinned versions, Ubuntu packages, Android tooling, containers, editor/LSP setup, and
  the macOS/Xcode path for iOS.
- One-command bootstrap and environment doctor.
- Secrets strategy and `.env.example` with no real secrets.
- Branching and review model optimized for small tracer-bullet changes.
- Commit and pull-request conventions.
- Ownership boundaries and CODEOWNERS where useful.
- ADR template and decision log.
- Definition of ready and definition of done.
- Issue/ticket template that includes scope, non-goals, dependencies, acceptance criteria, test plan,
  observability, rollout, and rollback.
- Dependency update, vulnerability scan, license/SBOM, secret scan, and supply-chain policy.
- Database migration and rollback policy.
- Feature flag and release-channel policy.
- Android and iOS CI/CD, signing, internal distribution, staged rollout, crash gates, and rollback strategy.
- Dev/staging/production data isolation and safe seed data.

### 8.1 Required `CLAUDE.md`

Generate a strict but usable root `CLAUDE.md` tailored to the selected stack and architecture. It must force AI
agents to:

- Read the product, architecture, current phase, progress ledger, and relevant module contract before work.
- Restate scope and acceptance criteria before changing code.
- Search semantically for existing behavior before adding anything.
- Preserve module boundaries and use only public module APIs.
- Keep domain behavior out of UI, framework, database, provider, and job adapters.
- Maintain a single source of truth and never duplicate schemas, constants, validators, or mappings.
- Prefer deterministic code over AI calls.
- Consult current official documentation instead of guessing fast-moving APIs.
- Make the smallest coherent change and avoid speculative abstractions.
- Add tests in the owning module's `tests/` directory and prove regressions fail before fixes.
- Run the appropriate scoped checks and required full gates.
- Measure performance before and after performance work.
- Never fabricate test, benchmark, or device results.
- Protect sensitive data in logs, fixtures, prompts, screenshots, and debugging output.
- Avoid destructive Git/database/cloud actions without explicit authorization.
- Update the progress ledger and relevant docs before ending a work session.
- Leave the repository buildable or report the precise failure and evidence.

The file must include source-of-truth priority, architectural invariants, search-before-write workflow, standard
commands, testing rules, security rules, completion checklist, and handoff protocol. Keep permanent rules in
`CLAUDE.md`; keep phase-specific details in phase files.

### 8.2 Project-specific AI skills

Design a small, focused skill library for the AI agents based on the chosen languages, frameworks, and tools.
Do not create vague skills that overlap completely. For each skill, define its trigger, required reading,
workflow, validation commands, output, and stop/escalation conditions.

Consider skills for:

- Mobile feature development and platform-native bridges.
- 3D avatar/garment asset changes and real-device performance validation.
- Backend domain-module changes.
- Recommendation rules and evaluations.
- Media/ML pipeline development and model evaluation.
- Database schema/migrations.
- API/event schema changes and client regeneration.
- Security/privacy review.
- Subscription/entitlement changes.
- Testing and regression validation.
- Performance profiling.
- Release readiness.
- Architecture and duplicate-code review.

Generate the actual proposed `SKILL.md` files or complete templates, not just their names. Keep each one narrow
enough that an agent knows exactly when it applies.

## 9. Required planning deliverables

Create a planning directory with a clear numbered reading order. If the repository already has unrelated
content, place this new product plan in a self-contained directory and do not modify unrelated files.

At minimum produce:

1. `README.md` — planning index, reading order, product summary, current status, and phase map.
2. `00-product-vision-and-scope.md` — users, value proposition, goals, non-goals, assumptions, constraints,
   success metrics, MVP definition, and later vision.
3. `01-requirements-and-traceability.md` — uniquely identified functional and non-functional requirements
   mapped to phase files and acceptance criteria. Include every requirement in this prompt.
4. `02-user-journeys-and-information-architecture.md` — onboarding, avatar, capture, closet, recommendations,
   inspiration, settings, billing, privacy, errors, recovery, and accessibility.
5. `03-domain-model-and-glossary.md` — canonical terminology, module ownership, aggregates/entities/value
   objects where helpful, invariants, state machines, and ambiguous terms that need a decision.
6. `04-architecture.md` — system context, containers, module boundaries, dependency diagram, data flows,
   composition roots, sync/offline design, job/event flow, and future chat seam.
7. `05-technology-decisions.md` — weighted decision matrices, selected stack, rejected alternatives, ADR links,
   prototype gates, provider evaluation, Linux/macOS build reality, and version/date notes.
8. `06-data-api-and-event-contracts.md` — source-of-truth strategy, API style, schemas, versioning, generated
   clients, events/outbox, idempotency, migrations, consistency, and deletion propagation.
9. `07-3d-avatar-and-garment-pipeline.md` — parametric models, face path, poses, renderer boundary, garment
   capability levels, capture pipeline, asset formats, lineage, quality gates, performance, and R&D spikes.
10. `08-closet-taxonomy-and-organization.md` — extensible categories/attributes, canonical identifiers,
    automatic classification, manual correction, search/filtering, availability, history, and data quality.
11. `09-recommendation-engine.md` — context-provider contract, hard/soft constraints, candidate generation,
    ranking, explanation, feedback, validation, reproducibility, future providers, and evaluation.
12. `10-ai-usage-cost-and-evaluation.md` — AI/non-AI decision table, model abstractions, cost budgets, caching,
    data policies, evals, fallbacks, and provider/model migration.
13. `11-security-privacy-and-compliance.md` — threat model, consent, face/body/location/calendar data, auth,
    authorization, retention, deletion/export, admin controls, moderation, and legal-review register.
14. `12-pricing-entitlements-and-unit-economics.md` — tier hypotheses, entitlement model, metering, billing
    lifecycle, store compliance, reconciliation, cost-to-serve, experiments, and expiration behavior.
15. `13-testing-quality-and-performance.md` — test organization, CI layers, device matrix, 3D/visual/ML tests,
    accessibility, performance budgets, reliability, security tests, and release gates.
16. `14-observability-operations-and-analytics.md` — events, logging/redaction, metrics, tracing, alerts,
    runbooks, feature flags, audit, support/admin, backups, and disaster recovery.
17. `15-team-workflow-and-ai-agent-operations.md` — Ubuntu setup, Mac/iOS path, scripts, reviews, issue/PR
    templates, source hierarchy, session handoffs, and safe AI-agent workflow.
18. `16-risks-open-questions-and-decision-log.md` — ranked risks, assumptions, unanswered product questions,
    technical unknowns, prototype needs, dependencies, mitigations, owners, due phases, and kill criteria.
19. `CLAUDE.md` — the complete operating contract described above.
20. `.agents/skills/.../SKILL.md` — the proposed project-specific skill files.
21. `PROGRESS.md` — a durable status ledger with exact status vocabulary and “next session” instructions.
22. `phases/` — one implementation-ready Markdown file per phase.

Also create lightweight templates for ADRs, module contracts, phase files, issue/tickets, pull requests, and
session handoffs if they improve consistency.

## 10. Phase design requirements

Design the phases as vertical, testable increments. Do not organize them as “build all backend, then all
mobile, then test.” Establish architecture and risk prototypes early, then deliver end-to-end product value.

You may refine the phase count and boundaries, but the plan must explicitly cover this likely sequence:

1. Product validation, measurable definitions, legal/privacy discovery, and architecture decisions.
2. High-risk technical prototypes: mobile/3D integration, parametric morphs, poses, capture, and representative
   asset delivery on real iOS/Android hardware.
3. Repository foundations, CI/CD, module boundaries, contracts, local environment, observability baseline,
   `CLAUDE.md`, skills, and security foundations.
4. Account, consent, profile, measurements, preferences, and onboarding walking skeleton.
5. Base avatar selection, parametric adjustment, calibration, generic appearance, poses, and rendering.
6. Optional selfie/face-personalization pipeline with consent and deletion.
7. Closet capture, upload, processing state machine, segmentation, classification, manual correction, and
   shoes/accessories support.
8. Closet organization, taxonomy, search/filter, availability/laundry state, and offline synchronization.
9. Weather, forecast, holiday, and explicit occasion context providers with freshness and overrides.
10. Deterministic recommendation engine v1, compatibility rules, explanations, alternatives, and feedback.
11. Outfit-on-avatar composition and multi-pose recommendation viewing, with graceful 2D/proxy fallbacks.
12. Missing-view generation and progressively more advanced garment representation, each capability gated by
    eval quality and cost.
13. Fashion intelligence ingestion, provenance, personalized inspiration, and moderation.
14. Pricing plans, entitlements, subscriptions, metering, restore/reconciliation, and paywall experiments.
15. Hardening: accessibility, privacy/security review, performance, offline/reliability, device coverage,
    app-store readiness, support operations, backup/restore, and staged beta/launch.
16. Post-launch learning and future calendar/schedule provider plus AI chat foundations, only after metrics
    justify them.

For every phase file include all of the following sections:

- Phase number, name, status, goal, user-visible outcome, and why this phase occurs now.
- Requirements delivered, using IDs from the traceability file.
- Prerequisites and explicit blocking dependencies.
- In scope and out of scope/non-goals.
- Product/UX behavior, including failure, empty, partial, offline, retry, and accessibility states.
- Domain and architecture changes by owning module.
- Public interfaces, contracts, schemas, migrations, and events added or changed.
- Mobile, backend, worker, data, infrastructure, 3D/asset, and admin work as applicable.
- AI versus deterministic implementation decisions.
- Security/privacy/consent and data-lifecycle work.
- Observability and analytics added in the same phase.
- Detailed ordered tasks small enough for AI-assisted implementation sessions.
- Which tasks can run in parallel and which cannot.
- Test-first plan by module and test level.
- Performance, cost, AI-quality, and reliability budgets introduced or measured.
- Rollout, feature flag, migration, backward compatibility, and rollback plan.
- Risks, mitigations, assumptions, and stop/kill criteria.
- Demo script proving the vertical slice.
- Acceptance criteria written as objectively verifiable statements.
- Definition of done with exact commands/evidence required.
- Required documentation and `PROGRESS.md` updates.
- Handoff note describing precisely where the next session starts.

Do not mark a phase complete based only on code existing. Completion requires tests, evidence, documentation,
operability, privacy/security work, and a working vertical demonstration appropriate to the phase.

## 11. MVP boundaries and progressive fidelity

Define an MVP that is valuable without depending on unsolved research. A credible MVP may use parametric base
avatars and layered/proxy garment representations while advanced reconstruction and cloth simulation mature.
Do not let a promise of perfect photorealistic try-on block delivery of closet organization and practical
recommendations.

Clearly separate:

- Production MVP.
- Beta/experimental capabilities.
- Later capabilities.
- Research bets.
- Explicit non-goals.

For each research bet, specify the user problem, hypothesis, prototype, dataset, target devices, success metric,
cost limit, privacy review, fallback, and kill decision. Important examples include single-selfie facial
reconstruction, single-view missing-side synthesis, arbitrary-garment 3D reconstruction, realistic cloth fit,
and embedding a shared 3D engine without unacceptable app size or battery impact.

## 12. Product metrics and quality bars

Define a metric tree with guardrails. Include:

- Onboarding completion and time-to-first-value.
- Avatar completion, correction rate, satisfaction, and abandonment.
- Closet items captured, processing success, correction rate, duplicate rate, and time per item.
- Recommendation practical-validity and hard-constraint violation rate.
- Outfit save, wear, replacement, rejection, and repeat rates.
- Cold-start and sparse-closet success.
- Trend-feed relevance and hide/unfollow signals.
- Paid conversion, retention, restore success, refunds, and variable cost per active/paid user.
- AI calls, tokens/GPU seconds, cache hit rate, cost per processed item, and failure/fallback rate.
- Crash-free sessions, latency, frame rate, memory, battery/thermal signals, and asset/job reliability.
- Privacy guardrails: consent, deletion completion, unauthorized access, and sensitive-data logging incidents.
- Fairness/inclusivity quality slices without inferring protected traits irresponsibly.

Every metric must have an owner, event/source, privacy classification, initial target or “baseline first,” and a
decision it informs. Do not optimize engagement at the expense of user trust, wellbeing, or privacy.

## 13. Output quality rules

Follow these rules while creating the planning package:

1. Preserve every requirement in this prompt. Use the traceability matrix to prove coverage.
2. Do not invent facts, vendor capabilities, legal conclusions, benchmark results, or market validation.
3. Verify fast-moving technical claims with current official documentation and link the primary source in the
   relevant decision or ADR.
4. State assumptions and confidence. Turn material unknowns into decisions, research spikes, or open questions.
5. Make concrete recommendations with reasons; do not leave every choice as “it depends.”
6. Prefer the simplest architecture that preserves the known growth paths.
7. Minimize AI use and operational complexity without sacrificing core product quality.
8. Do not make microservices, event streaming, vector databases, Kubernetes, or multiple AI vendors mandatory
   unless a measured requirement justifies them.
9. Do not couple business domains to frameworks or provider SDKs.
10. Do not couple recommendation logic to 3D rendering or future chat.
11. Do not duplicate schemas or rules between mobile, backend, workers, or documentation.
12. Keep filenames, module names, commands, diagrams, and terminology consistent across all files.
13. Use Mermaid diagrams where they materially clarify architecture, data flow, state, dependencies, or phase
    sequencing, and ensure the diagrams render correctly.
14. Keep each document focused and link to the canonical owner instead of repeating large sections.
15. Make phase tasks granular enough for a small AI-assisted team, but not so tiny that the plan becomes noise.
16. Use exact acceptance checks and evidence; never say only “ensure it works,” “make it scalable,” or “add tests.”
17. Call out any feature whose technical feasibility, privacy impact, content rights, or cost is uncertain.
18. Maintain a decision log so later agents do not reopen settled decisions without new evidence.

## 14. Final audit before finishing

Before declaring the planning package complete, perform and document a final audit:

- Map every paragraph of the product brief to at least one requirement ID and phase.
- Confirm clothing, shoes, and accessories are all supported.
- Confirm front-only capture, optional extra views, AI filling only missing views, provenance, confidence, and
  later replacement with real views are covered.
- Confirm predefined adjustable avatars, optional selfie face, honest accuracy levels, and three or four poses
  with multiple angles are covered.
- Confirm weather, forecast, holidays, explicit occasions, conflict resolution, and the cold-shorts example
  are covered.
- Confirm calendar/schedule and future context providers can be added without redesign.
- Confirm closet organization by season, color, category, and richer metadata is covered.
- Confirm fashion trends, runway collections, seasonal styles, inspiration, provenance, and personalization
  are covered.
- Confirm every suggestion is personalized, traceable, explainable, and never random.
- Confirm pricing plans, entitlement architecture, billing lifecycle, and cost-to-serve are covered.
- Confirm future AI chat reuses the same application services and does not fork business logic.
- Confirm AI use is minimized, measured, cached, evaluated, and replaceable.
- Confirm Linux-first setup and the real macOS requirement for iOS delivery are covered.
- Confirm module isolation, semantic reuse checks, single sources of truth, small files, readable scripts, and
  dedicated per-module `tests/` directories are covered.
- Confirm `CLAUDE.md`, project-specific AI skills, progress/handoff rules, and all standard commands are present.
- Confirm every phase has dependencies, tasks, tests, acceptance criteria, performance/cost/security work,
  rollout/rollback, demo, and definition of done.
- Confirm the plan provides a valuable fallback if advanced 3D reconstruction does not pass its R&D gate.

End with:

1. A generated-file tree.
2. A short list of the most important architecture decisions.
3. The five highest risks and their validation phase.
4. The critical path through the phases.
5. The first implementation session's exact starting instructions.
6. A coverage statement identifying any requirement not fully resolved and where the open decision is tracked.

Do not implement the application in this task. Produce the planning files, validate their internal consistency,
and leave the planning package ready for a small team and future AI coding sessions to execute.
