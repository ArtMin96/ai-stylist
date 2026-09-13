# r7 — Third-party services and self-hosting audit

**Status:** Evidence and recommendations

**Date checked:** 2026-09-13

**Scope:** Online services selected or explicitly planned in `planning/`. Open-source libraries that run inside the app are included only where they are easily confused with a hosted service. Optional fallback vendors are not exhaustively compared.

## Application context and decision criteria

These recommendations are for this application, not a generic preference for managed or self-hosted infrastructure. The planning package establishes the following constraints:

| App fact | Consequence for service choices |
|---|---|
| Global, English-first iOS and Android app; 2–3 developers on Ubuntu; no Mac owned ([SPINE §1](../SPINE.md#1-product)) | Keep the runtime stack small and portable. Hosted macOS remains necessary for iOS builds even if Linux compute is self-hosted. A service that creates a new specialist operational subsystem needs a concrete product benefit. |
| The core product is a digitized real wardrobe plus deterministic, explainable recommendations from owned items ([00 §1–3](../00-product-vision-and-scope.md#1-product-summary)) | Database integrity, media durability, sync, context freshness, and deterministic recommendation behavior are load-bearing. An LLM or generative inference vendor is not in the recommendation decision path. |
| Measurements and face-derived data are S3; photos, closet/wear history, city-level location, and subscription state are S2 ([11 §6](../11-security-privacy-and-compliance.md#6-data-classification)) | A cheaper provider is not acceptable unless access control, region/transfer review, retention, deletion, auditability, and backup behavior meet the existing privacy design. Fewer processors reduce review and deletion-propagation work. |
| Capture is local-first: uploads survive app kill, connectivity loss, and app updates; originals must not be lost ([02 §6.4](../02-user-journeys-and-information-architecture.md#64-states), [P06 §5](../phases/P06-closet-capture-pipeline.md#5-productux-behavior)) | Backend outages may delay processing but must not lose a photo. Queue and object-storage choices are judged on recovery and idempotency, not only happy-path throughput. |
| The app is media-heavy. Original uploads are irreplaceable user data; derived assets are reproducible from originals and versioned pipelines ([06 §5](../06-data-api-and-event-contracts.md#5-consistency-model)) | Object-storage durability and delivery deserve more operational protection than replaceable thumbnails or model outputs. This is why the recommendation for R2 differs from the recommendation for Cloudflare Images. |
| Capture processing, deletion/export, backfills, and billing reconciliation are durable multi-stage work; recommendation generation itself is synchronous and deterministic ([04 §7–9](../04-architecture.md#7-key-requestdata-flows)) | A durable job mechanism is essential, but it must not become the application architecture. The existing Postgres outbox, idempotency, replay, ordering, and DLQ tests are the acceptance contract for any replacement. |
| G2 try-on is a paid-tier feature, but it is eval-gated and may remain disabled; G0 collage and the core closet/recommendation loop still ship ([00 §7](../00-product-vision-and-scope.md#7-mvp-definition), [P11 §15–17](../phases/P11-generative-tryon-and-views.md#15-budgets-introduced-or-measured)) | Do not build permanent GPU capacity or accept weak privacy/quality merely to self-host G2. Compare hosted and self-hosted inference in the same P11 gate; failure falls back to G0 without invalidating the product. |
| The commercial model is a useful Free tier plus paid tiers and weighted generative credits; prices and demand are hypotheses ([12 §1](../12-pricing-entitlements-and-unit-economics.md#1-tier-structure--value-narrative)) | Optimize total cost per active and paid user, not the count of invoices. Fixed self-hosted capacity can be worse at low utilization; per-call APIs can be worse after measured sustained volume. |
| Export and deletion work on every tier; entitlements, credits, purchase restore, refunds, and reconciliation must be exact ([11 §13](../11-security-privacy-and-compliance.md#13-export-and-deletion), [12 §3–6](../12-pricing-entitlements-and-unit-economics.md#3-entitlement-model)) | Billing and deletion providers are judged by replayability, idempotency, audit evidence, and failure recovery. These are correctness domains, not ordinary deployment conveniences. |

Accordingly, each decision below uses six tests: whether the **capability** is on the core user path; the data-loss/privacy blast radius; degraded-mode behavior; total operating cost at the planned phase and usage level; reversibility through an app-owned port or standard protocol; and whether the decision is due now or belongs at P06, P08, P11, or P13. No unmeasured reliability, model-quality, latency, or cost advantage is assumed.

## User-flow and capability criticality

“Critical” below refers to the capability, not the named vendor.

| User or operational flow | Required capabilities | Failure effect designed by the app | Service implication |
|---|---|---|---|
| Sign-in, profile, measurements, consent | API, PostgreSQL, better-auth | Online account operations stop; S2/S3 authorization and consent must fail closed | Self-hosting the API/auth is already appropriate; the database needs stronger recovery than an ordinary stateless service. |
| Capture a garment online or offline | Durable local queue, signed upload, object storage, media jobs, optional CV providers | Capture remains local and resumes; provider failure stores the original and allows manual correction; nothing is silently dropped | R2/or equivalent storage and durable jobs are core. Specific transform and CV vendors are replaceable because the app owns fallbacks. |
| Browse the closet | Local cache/sync, PostgreSQL, private media delivery | Cached browse/search remains useful offline; server sync and uncached media may be delayed | Global edge delivery matters for UX, but the storage API must remain portable and private-media semantics must be explicit. |
| Get today's recommendation | PostgreSQL/pgvector, cached weather/holiday context, deterministic engine | Missing/stale context is labeled and user-overridable; hard constraints fail closed; the recommendation is not a background AI job | Do not couple the recommendation path to Trigger.dev or an LLM vendor. Weather is important but its provider is replaceable behind `WeatherProvider`. |
| Generate G2 try-on or a missing view | Media jobs, object storage, consent, credit check, inference | Feature pauses, no credit is consumed, and G0/real views remain available | Hosted inference is acceptable when it wins the P11 quality/privacy/cost gate; self-hosting is an evaluation arm, not a prerequisite. |
| Export or delete an account | Durable orchestration across PostgreSQL, object storage, analytics, billing, and pending jobs | Must be resumable, audited, provider-aware, and completed within the planned privacy SLA | Queue replacement must pass deletion/export scenarios, and every added processor increases cascade and evidence obligations. |
| Purchase, restore, downgrade, or refund | Apple/Google billing, entitlement store, webhook ingestion, reconciliation | Wrong state can deny paid access, grant unpaid access, double-charge credits, or strand a restored purchase | Keep RevenueCat through launch unless direct integrations pass the complete P13 lifecycle, replay, and reconciliation suite. |
| Detect incidents and ship builds | OTel backend, product analytics/flags, hosted macOS, Apple/Google channels | Two developers have best-effort out-of-hours coverage; monitoring must survive an app-server failure | Keep telemetry vendor-neutral; if self-hosted, use a separate failure domain. Keep only the unavoidable hosted macOS/store pieces. |

## Executive conclusion

The app needs the *capabilities* supplied by most of the planned services, but it does not need most of the named vendors.

The best changes to make now are:

1. **Replace Trigger.dev Cloud with `pg-boss`**, provided the existing P02 retry/idempotency/DLQ/replay acceptance suite passes. Durable jobs are essential; Trigger.dev is not.
2. **Replace Railway with ordinary servers plus Coolify** (or an equivalent container deployment setup). The NestJS API and Dockerized workers are portable, and the app's offline capture/cache behavior tolerates short compute interruptions without data loss; owned hosting must still provide health checks, safe deploy/rollback, patching, and capacity monitoring.
3. **Replace Neon with self-managed PostgreSQL + pgvector** if the owner accepts responsibility for tested point-in-time recovery, upgrades, monitoring, and availability. This database holds the transactional outbox, sensitive profile/closet state, recommendation snapshots, and authoritative entitlements, so this is not equivalent to moving a stateless container. Do not self-host Neon's distributed architecture; the planned app interfaces require standard PostgreSQL.
4. **Remove Cloudflare Images from the design**, generating the fixed image variants in the existing media pipeline. **Keep R2 initially**: self-hosting durable media storage safely is a different and substantially larger obligation than running the API.
5. **Self-host or embed Nager.Date** and remove optional Anthropic-generated wording from the critical path. Holiday facts are cacheable context inputs, while canonical recommendation explanations already come from deterministic reason-code templates.
6. **Add self-hosted model arms to the existing P06/P11 evaluations**: BiRefNet for background removal, SigLIP for embeddings, Qwen3-VL for attribute extraction, and FASHN VTON v1.5 for try-on. Adopt each only if it passes the same quality, privacy, latency, and cost gates. Open weights alone are not evidence of equivalence.

Keep these managed initially:

- **R2**, because durable replicated object storage and economical media delivery are valuable and its S3-compatible interface limits lock-in.
- **PostHog Cloud and Grafana Cloud while within their free allocations**. Both are replaceable; operating their data stores is unlikely to be the first useful use of infrastructure time.
- **RevenueCat through launch**, because replacing it is mobile billing-domain work, not ordinary DevOps. Reassess before it becomes paid.
- **EAS only while its free build allowance is useful**. Expo the framework is open source; EAS Cloud is optional. The existing GitHub Actions macOS lane is the exit path.
- **Specialized AI APIs only where they win measured evaluations**. Low-volume GPU APIs can be economically sensible even for a team capable of self-hosting.

Apple's and Google's store, signing, billing, and push infrastructure cannot be self-hosted away while distributing through their mainstream stores. Those are platform dependencies, not accidental SaaS choices.

## Why this decision should be made now

The repo has deliberately paused cloud work:

- `planning/PROGRESS.md:29,51,91,103` says Neon provisioning is partial and Trigger.dev, Grafana Cloud/PostHog, and R2 cloud work has not started.
- `planning/phases/P02-repo-foundations-and-ci.md:175-181` marks the relevant tasks partial or not started.
- No Neon, Trigger.dev, R2, PostHog, RevenueCat, or fal.ai SDK is currently declared in the application package manifests. `apps/api/src/trigger/` is still a placeholder.

Changing these decisions now is therefore materially cheaper than changing them after P02/P03 integrations. This is a statement about the current repo state, not an estimate of future migration effort.

## Decision matrix

Definitions:

- **Essential capability:** the application cannot meet its stated plan without it.
- **Replaceable vendor:** the named provider is an implementation choice behind a standard protocol, port, or app-owned state.
- **Free SaaS is not open source:** a free tier may change and still creates an external operational dependency.

| Planned service | What matters to this app | Vendor importance | OSS/self-host path | Recommendation |
|---|---|---|---|---|
| **Neon** | PostgreSQL, pgvector, transactions, outbox, backups/restore | PostgreSQL is critical; Neon branching, scale-to-zero, and managed PITR are conveniences | PostgreSQL + pgvector; optionally CloudNativePG if Kubernetes is ever justified | **Replace now**, conditional on a real backup/PITR and restore-drill design |
| **Trigger.dev Cloud** | Durable media/AI jobs, retries, scheduling, concurrency, failure handling | Capability is critical; vendor is not | `pg-boss` on existing PostgreSQL; self-hosted Trigger.dev if its workflow semantics are actually required | **Test pg-boss first and replace before T08** |
| **Railway** | Runs NestJS API and containerized workers | Compute is critical; Railway is not | Servers + Docker/Coolify | **Replace now** |
| **Cloudflare R2** | Original/derived media and 3D asset storage | Object storage is critical; R2 is replaceable | SeaweedFS; MinIO is AGPL and needs license review | **Keep initially**; revisit only with redundant storage, offsite backup, and delivery designed |
| **Cloudflare Images** | Responsive media transforms | Convenience only; fixed variants are already planned in the pipeline | Existing media workers, or self-hosted imgproxy for dynamic transforms | **Remove now** |
| **Cloudflare DNS/WAF** | DNS, edge filtering/rate limits | Useful defense-in-depth; not an app architecture requirement | Authoritative DNS can move; host firewall/reverse proxy can enforce basic limits | **Keep unless consolidating DNS elsewhere**; do not pretend an origin-only WAF is equivalent to an edge WAF |
| **PostHog Cloud** | Analytics, flags, replay, errors, experiments | Analytics and rollout control matter; product and hosted form are replaceable | PostHog core can be self-hosted; doing so operates ClickHouse/Postgres and loses some Cloud/enterprise functions | **Keep free Cloud during validation; set a measured exit trigger before paid use** |
| **Grafana Cloud** | OTel traces, metrics, logs, dashboards, alerting | Observability is important; backend is explicitly swappable | Grafana + Prometheus + Loki + Tempo are self-hostable | **Keep free Cloud or host on a separate failure domain**, not the app server |
| **RevenueCat** | Normalizes Apple/Google subscriptions and webhooks | Replaceable, but its domain complexity is real | Direct StoreKit 2/App Store Server API + Play Billing/RTDN; no verified drop-in OSS backend | **Keep through launch; reassess before the paid threshold** |
| **Expo / EAS Cloud** | Expo is the app framework; EAS builds/signs/submits and may serve OTA updates | Expo is important; EAS Cloud is optional | Expo SDK/EAS CLI are MIT; Android local builds; iOS on self-hosted or hosted macOS CI; open Updates protocol | **Keep Expo. Use EAS free allowance only; retain GHA macOS as exit path. Defer OTA unless needed** |
| **GitHub / Actions** | Source hosting and CI; possible macOS lane | Replaceable except that the repo already uses its control plane | Self-host Actions Linux runners; Forgejo/Gitea is a larger source-host migration | **Keep GitHub; self-host Linux runners only after measured minute pressure** |
| **Apple services** | Xcode signing/build, App Store/TestFlight, StoreKit, APNs, Sign in with Apple | Unavoidable for the planned iOS distribution channel | None that preserves App Store distribution | **Keep — unavoidable** |
| **Google services** | Play distribution/billing, FCM, Google sign-in | Play is required for the planned channel; FCM is the base Android push transport | None that replaces device delivery through FCM while preserving normal Android push behavior | **Keep direct Play/FCM APIs; do not add OneSignal/Expo Push SaaS** |
| **fal.ai / Replicate** | Hosted inference for try-on, missing views, and fallback segmentation | Features need inference, not these vendors | Self-host individual commercially usable models; no self-hosted fal/Replicate control plane equivalent was verified | **Use only for models that win an eval; never standardize on the provider itself** |
| **Gemini / Claude / Cloud Vision / Ximilar** | Assistive garment attribute extraction; optional wording | Replaceable | Evaluate Qwen3-VL for vision; deterministic templates already cover explanations | **Evaluate self-hosted extraction; remove paid explanation generation from the critical path** |
| **Voyage / Cohere** | Multimodal embeddings for similarity/deduplication | Replaceable | Evaluate SigLIP/SigLIP2 | **Evaluate self-hosting from P06; batch work makes this a good candidate** |
| **Open-Meteo managed API** | Current and forecast weather | Weather data is important; vendor is behind a port | Open-Meteo server is AGPL and self-hostable, but requires continuous forecast-data ingestion and meaningful RAM/storage | **Compare at P08; do not self-host solely to avoid a $29/month plan** |
| **Nager.Date hosted API** | Public-holiday facts | Low operational criticality and almost completely cacheable | MIT source and Docker/self-hosting | **Self-host or embed from source** |
| **Sentry** | Optional native crash symbolication if PostHog is insufficient | Not currently required | Self-hosted Sentry is source-available under FSL rather than OSI open source and has a substantial stack | **Do not provision unless P03 proves a gap** |

## Detailed findings

### 1. Database: keep PostgreSQL, not necessarily Neon

The canonical requirement is PostgreSQL + pgvector (`planning/SPINE.md:34-35` and `planning/04-architecture.md:120`). It is the source for S2/S3 profile and closet data, the transactional outbox, recommendation snapshots, media lineage, and authoritative entitlements. A database incident therefore affects user data, async recovery, recommendation reproducibility, and billing correctness at once. Neon adds managed branching and recovery (`planning/15-team-workflow-and-ai-agent-operations.md:192-193`; `planning/14-observability-operations-and-analytics.md:182`). The plan already uses standard Drizzle migrations and a normal connection URL, which is a portable design.

Neon's engine is Apache-2.0 and self-hostable, but that does not make self-hosting its distributed storage architecture the sensible replacement. Plain PostgreSQL and pgvector are independently open source and supply what this application needs. Sources: [Neon architecture and self-hosting](https://neon.com/docs/get-started/why-neon), [Neon source](https://github.com/neondatabase/neon), [PostgreSQL licence](https://www.postgresql.org/about/press/faq/), [pgvector](https://github.com/pgvector/pgvector).

A valid replacement must include WAL archiving/PITR, encrypted off-host backups, monitoring, upgrades, connection pooling, and an actually exercised restore procedure. That is the boundary between "Postgres in a container" and replacing a managed database.

**Decision:** because cloud provisioning has not happened and the owner has DevOps experience, use self-managed PostgreSQL + pgvector if those recovery obligations are accepted and demonstrated in P02/P14 restore evidence. Retain Testcontainers/temporary databases for migration isolation instead of reproducing Neon branch-per-PR. This recommendation is conditional because database recovery is more important to this app than Neon-specific features are.

### 2. Jobs: replace Trigger.dev before it becomes an application framework

Durable background processing is central to P06 capture, deletion/export, model backfills and P11 generation, plus P13 expiry and billing reconciliation. The user-visible contract includes resumable processing, no duplicate item or credit charge, bounded retry, replay, and auditable deletion completion. Trigger.dev itself is not required to satisfy that contract. It is Apache-2.0 and can be self-hosted, but its official documentation says operators own scaling, upgrades, security, reliability, and data integrity, and that some Cloud behavior is absent from self-hosting. Sources: [Trigger.dev self-hosting](https://trigger.dev/docs/self-hosting/overview), [Trigger.dev repository/licence](https://github.com/triggerdotdev/trigger.dev).

`pg-boss` is MIT-licensed, uses PostgreSQL, and supports retry/backoff, dead-letter handling, scheduling, priorities, dependencies, and concurrency policies. Source: [`pg-boss` repository](https://github.com/timgit/pg-boss).

**Decision:** implement the existing P02 acceptance behavior against pg-boss, including kill/retry, idempotency, DLQ, replay, per-user cancellation, and deletion/export scenarios. Only choose self-hosted Trigger.dev if that proof exposes a workflow requirement pg-boss cannot meet cleanly. Temporal is also open source, but its separately operated service/database conflicts with the ratified modular-monolith-and-workers scope until measured need exists.

### 3. Application hosting: Railway is the easiest service to remove

Railway is only the host for portable NestJS and Dockerized FastAPI workloads (`planning/04-architecture.md:117-119`). No official self-hostable Railway control plane was found. Its public repositories provide tooling rather than the hosted platform. Sources: [Railway terms](https://railway.com/legal/terms), [Railway public repositories](https://github.com/railwayapp).

Coolify is Apache-2.0 and provides self-hosted deployment for ordinary Docker workloads, domains, HTTPS, health checks, and rollouts. Sources: [Coolify overview](https://coolify.io/docs/core/what-is-coolify), [Coolify licence](https://github.com/coollabsio/coolify/blob/v4.x/LICENSE).

**Decision:** replace Railway with servers + Coolify (or an equivalent setup already familiar to the operator). This changes deployment operations, not application architecture. The P02 acceptance bar should remain reproducible deploys, health checks, rollback, environment isolation, and observable API/worker capacity. Offline capture protects photos during a short API outage, but recommendations, sync, and billing resolution still require the backend; self-hosting does not make availability irrelevant for a global app.

One planning statement also needs correction: `planning/05-technology-decisions.md:198` attributes "private networking to DB" to Railway, but Railway private networking connects services in the same Railway project; an external Neon database is not on that network. Source: [Railway private networking](https://docs.railway.com/networking/private-networking).

### 4. Media: keep managed object storage, remove transform SaaS

R2 and Cloudflare Images are proprietary hosted products. R2 deliberately exposes an S3-compatible API, so the application's `StorageProvider` abstraction has a credible exit. Sources: [R2 architecture](https://developers.cloudflare.com/r2/how-r2-works/), [S3 compatibility](https://developers.cloudflare.com/r2/get-started/s3/), [Cloudflare Images](https://developers.cloudflare.com/images/).

SeaweedFS is an Apache-2.0, self-hosted, S3-compatible alternative. MinIO is AGPLv3 and therefore requires a separate licence/deployment review. imgproxy is Apache-2.0 if dynamic transforms are later necessary. Sources: [SeaweedFS](https://github.com/seaweedfs/seaweedfs), [MinIO compliance](https://github.com/minio/minio/blob/master/COMPLIANCE.md), [imgproxy](https://github.com/imgproxy/imgproxy).

The media pipeline already plans fixed thumbnail/derived assets. Generate those once rather than buying an image-transform service. This fits the app's versioned lineage model: originals are immutable and valuable, while cutouts/thumbnails are reproducible outputs.

**Decision:** retain R2 initially; remove Cloudflare Images. Do not replace R2 with a single object-store process beside the API. The bucket holds irreplaceable S2 photos and may hold S3-derived media, must serve a global mobile audience, and participates in export/deletion verification. A safe replacement therefore needs redundancy, integrity checks, capacity alerts, independent backups, private signed delivery, and a deliberate edge-delivery design.

The planning claim that R2 supplies a generic "built-in CDN" is incomplete. Cloudflare caching requires a custom domain; enabling a public bucket/custom domain changes the exposure model, while private presigned S3 delivery is not automatically the same cached path. Sources: [R2/cache interaction](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/), [public bucket behavior](https://developers.cloudflare.com/r2/buckets/public-buckets/). This must be reconciled with the private-media rule in `planning/11-security-privacy-and-compliance.md:113`.

### 5. Observability and product analytics

OpenTelemetry is already the correct commitment: it makes the trace/metric/log destination replaceable (`planning/14-observability-operations-and-analytics.md:16-19`). Grafana, Loki, and Tempo are self-hostable; Prometheus and OpenTelemetry are also open source. Sources: [Grafana installation](https://grafana.com/docs/grafana/latest/setup-grafana/installation/), [Grafana licensing](https://github.com/grafana/grafana/blob/main/LICENSING.md), [Loki licensing](https://github.com/grafana/loki/blob/main/LICENSING.md), [Tempo](https://github.com/grafana/tempo), [OpenTelemetry](https://opentelemetry.io/docs/).

PostHog's core is MIT, while its `ee/` features have a proprietary licence. PostHog documents self-hosted open source as a hobby deployment with material support, recovery, feature, and scaling limitations. Sources: [PostHog licence](https://github.com/PostHog/posthog/blob/master/LICENSE), [self-hosting disclaimer](https://github.com/PostHog/posthog.com/blob/master/contents/docs/self-host/open-source/disclaimer.mdx).

**Decision:** use the two free hosted services during validation, but document an exit trigger before paid usage. PostHog measures whether capture, recommendations, G2, and pricing hypotheses work; it is not part of producing a recommendation. Grafana/OTel is operationally more important because a two-developer team needs quiet alerts for queues, deletion, billing drift, and provider failures. If self-hosting Grafana, put it on a separate failure domain; monitoring that dies with the app server cannot explain the incident. Self-host PostHog only if keeping analytics data in-house is itself a requirement, because otherwise its ClickHouse/Postgres stack adds more operations than it removes.

### 6. Billing: RevenueCat is replaceable, but not by infrastructure work

RevenueCat receives store events and normalizes purchase lifecycle behavior; the app's own entitlement table remains authoritative (`planning/SPINE.md:41`, `planning/06-data-api-and-event-contracts.md:264`). Its client SDK is MIT, but its backend is not a self-hostable product. Sources: [RevenueCat pricing](https://www.revenuecat.com/pricing), [React Native SDK licence](https://github.com/RevenueCat/react-native-purchases/blob/main/LICENSE), [webhooks](https://www.revenuecat.com/docs/integrations/webhooks).

The alternative is direct integration with StoreKit 2/App Store Server API and Play Billing/real-time developer notifications. That means owning renewal, grace-period, refund, upgrade/downgrade, fraud, replay, and reconciliation behavior on two platforms. Sources: [Apple StoreKit](https://developer.apple.com/storekit/), [Google Play billing backend](https://developer.android.com/google/play/billing/backend).

**Decision:** keep RevenueCat through P13 and launch while it is free below $2,500 monthly tracked revenue, then compare the actual fee with the engineering and support cost of direct billing. The exit gate is not deployment competence: direct StoreKit/Play implementations must pass restore-on-new-device, out-of-order and replayed events, grace/refund/upgrade/downgrade, reconciliation, deletion, and atomic credit tests on both platforms. Until then, replacing RevenueCat puts access and money correctness at risk.

### 7. Expo, CI, and unavoidable store services

Expo SDK and EAS CLI are MIT; EAS Cloud is optional SaaS. Local EAS builds are supported, but iOS still requires Xcode/macOS. Expo publishes an open Updates protocol and an MIT example server, but explicitly does not promise that example as production-ready. Sources: [Expo repository](https://github.com/expo/expo), [EAS CLI package/licence](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/package.json), [local builds](https://docs.expo.dev/build-reference/local-builds/), [Updates protocol](https://docs.expo.dev/technical-specs/expo-updates-1/), [example server](https://github.com/expo/custom-expo-updates-server).

GitHub's runner is MIT and Linux runners can be self-hosted without Actions minute charges, though this keeps the GitHub control plane. Sources: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [self-hosted runners](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners), [runner source](https://github.com/actions/runner).

Apple requires its toolchain, membership, store, billing, and APNs for the intended iOS channel; Google Play/Play Billing and FCM are likewise base platform integrations for the planned Android channel. Sources: [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/), [Apple membership](https://developer.apple.com/support/compare-memberships/), [APNs](https://developer.apple.com/documentation/usernotifications/establishing-a-connection-to-apns), [Google Play registration](https://support.google.com/android-developer-console/answer/16640817), [FCM](https://firebase.google.com/products/cloud-messaging).

**Decision:** keep Expo, not necessarily EAS Cloud. Build Android locally/self-hosted; use EAS's free allowance or GitHub-hosted macOS while the no-Mac constraint remains. Apple Developer membership ($99/year) and Play registration ($25 one-time) are unavoidable for the selected channels. Direct FCM + APNs is already the least-wrapper approach.

### 8. AI services: replace tasks, not the provider logo

fal.ai and Replicate are hosted inference platforms. fal's open SDK/runtime deploys to fal's cloud; it is not a self-hosted equivalent of the service. Sources: [fal repository](https://github.com/fal-ai/fal), [fal model API architecture](https://fal.ai/docs/documentation/model-apis/overview).

There are concrete self-host candidates:

| Task | Candidate | Verified licence/caveat | Recommended gate |
|---|---|---|---|
| Try-on | FASHN VTON v1.5 | Code and weights Apache-2.0; commercially deployable. It is **not** the same release as the managed v1.6 endpoint | Add to P11's same fidelity, diversity, latency, and unit-cost eval |
| Background removal | BiRefNet / `rembg` | MIT | Add to P06 worker eval; current manual/original fallback limits risk |
| Attribute extraction | Qwen3-VL | Apache-2.0 | Compare macro-F1, schema-valid output, latency, GPU cost, and privacy |
| Embeddings | SigLIP/SigLIP2 | Official `big_vision` code/models Apache-2.0 unless individually noted | Evaluate from P06; batch asynchronous execution |

Sources: [FASHN VTON release](https://fashn.ai/blog/fashn-vton-1-5-open-source-release), [FASHN repository](https://github.com/fashn-AI/fashn-vton-1.5), [BiRefNet licence](https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE), [`rembg` licence](https://github.com/danielgatis/rembg/blob/main/LICENSE.txt), [Qwen3-VL licence](https://github.com/QwenLM/Qwen3-VL/blob/main/LICENSE), [Google `big_vision`](https://github.com/google-research/big_vision).

FLUX.2 `[dev]` is not a free commercial self-host replacement: its published model licence is non-commercial unless separate commercial terms are obtained. Sources: [FLUX.2 dev licence](https://github.com/black-forest-labs/flux2/blob/main/model_licenses/LICENSE-FLUX-DEV), [model card](https://huggingface.co/black-forest-labs/FLUX.2-dev).

**Decision:** self-host the models that pass the same product evaluations, not merely those that are downloadable. In P06, segmentation/extraction/embeddings support the core closet flow but each has an original/manual/hash fallback, so providers may be swapped without blocking capture. Recommendations remain deterministic and must not acquire an inference dependency. In P11, G2 is premium, credit-metered, and explicitly allowed to fail its gate because G0 remains. Remove Anthropic wording polish from the critical path because deterministic reason-code templates are canonical. Keep managed AI where low utilization, specialized quality, or bursty GPU demand is the measured winner; fixed GPU ownership is not automatically cheaper for a pre-validation Free/paid user mix.

### 9. Weather and holidays

Open-Meteo's server is AGPL-3.0 and its data is CC-BY-4.0. Official self-host instructions specify at least 8 GB RAM and 100 GB storage, recommend 16 GB, and require ongoing forecast ingestion/cache operation. Its managed commercial plan starts at $29/month. Sources: [Open-Meteo self-host guide](https://github.com/open-meteo/open-meteo/blob/main/docs/getting-started.md), [pricing](https://open-meteo.com/en/pricing).

WeatherKit is already available with the unavoidable Apple developer membership and has a REST API usable by non-Apple clients, but it remains a proprietary service. Sources: [WeatherKit](https://developer.apple.com/weatherkit/), [REST API](https://developer.apple.com/documentation/weatherkitrestapi).

Nager.Date is MIT and supports local use/self-hosting; country/year results are naturally cacheable. Sources: [Nager.Date licence](https://github.com/nager/Nager.Date/blob/main/LICENSE), [repository and usage](https://github.com/nager/Nager.Date/blob/main/README.md).

**Decision:** self-host or embed Nager.Date. At P08, compare Open-Meteo managed, self-hosted Open-Meteo, and WeatherKit against actual global coverage, freshness, outage behavior, privacy review, and total operating cost. Weather influences hard clothing constraints, but the product already labels stale/missing context and accepts manual overrides; do not reserve a large forecast-ingestion host merely to avoid $29/month.

## Proposed target stack

This is the smallest coherent reduction in external paid services without turning every capability into an operations project:

| Area | Proposed target |
|---|---|
| API and workers | Owned servers + Docker/Coolify |
| Database/vector/outbox | Self-managed PostgreSQL + pgvector |
| Durable jobs | pg-boss; self-host Trigger.dev only if the acceptance suite proves pg-boss insufficient |
| Object storage | R2 initially; app-owned S3 abstraction; fixed derivatives produced by workers |
| Product analytics/flags | PostHog Cloud free tier, with measured exit trigger |
| Traces/metrics/logs | OTel → Grafana Cloud free tier, or self-hosted Grafana stack on a separate node |
| Authentication | Existing self-hosted better-auth |
| Billing | RevenueCat at launch; direct store APIs are the later exit |
| CI/builds | GitHub; self-host Linux runners if useful; hosted macOS/EAS only where Xcode requires it |
| Push | FCM + APNs direct |
| Weather/holidays | P08 comparison for weather; self-hosted Nager.Date |
| AI | Self-hosted evaluation arms; managed endpoint only where it wins measured gates |

## Order of work by phase

P02 is the only immediate infrastructure decision point. P06, P08, P11, and P13 already contain the product-specific measurements needed for later choices; deciding their providers earlier would replace evidence with prediction.

1. **Before P02-T08:** record a new ADR/decision that tests pg-boss instead of assuming Trigger.dev.
2. **Before cloud provisioning:** resolve OQ-07, then decide self-managed PostgreSQL and owned-server deployment. Write recovery and patching acceptance criteria at the same time.
3. **Before P02-T09:** keep OTel neutral; choose free Grafana Cloud or a genuinely separate observability node. Keep PostHog Cloud free unless data-location requirements reject it.
4. **Before P02-T13:** retain the S3 storage port, remove Cloudflare Images, and specify private-media delivery/caching correctly.
5. **At P06:** run BiRefNet, Qwen3-VL, and SigLIP alongside managed candidates on the existing eval sets.
6. **At P08:** self-host Nager.Date; choose weather delivery from measured coverage and total cost.
7. **At P11:** add FASHN VTON v1.5 self-hosting to the existing try-on eval. Do not treat FLUX dev weights as free commercial software.
8. **At P13:** launch with RevenueCat unless direct-store billing has separately passed the full replay/reconciliation test matrix; re-evaluate before RevenueCat becomes paid.

## Corrections to feed back into planning

This report does not edit ratified decisions. The following should be proposed through a new ADR/decision-log entry:

1. Railway private networking does not include an external Neon database.
2. R2 private presigned delivery is not automatically a cached CDN path; the private-media delivery design is incomplete.
3. The Google Play subscription statement in `planning/SPINE.md:125` and r6 should be rechecked. Google's current official table describes a 10% service fee **plus 5% billing fee** for Play-billed auto-renewing subscriptions in the referenced EEA/UK/US program, which totals 15%; other markets remain 15% until rollout. Source: [Google Play official service-fee table](https://support.google.com/googleplay/android-developer/answer/112622).
4. Replace the default Trigger.dev assumption with a pg-boss proof before vendor-specific task definitions are written.
5. Add FASHN VTON v1.5, BiRefNet, Qwen3-VL, and SigLIP as explicit self-hosted evaluation arms; do not preselect them without results.

## Confidence and limits

- Claims about licences, self-hosting, and platform requirements above link to the project's official documentation or source repository as checked on 2026-09-13.
- No provider reliability, model quality, latency, or total-cost superiority is asserted without a project measurement. Recommendations use the plan's existing evaluation gates for those decisions.
- This is not a security or legal review. AGPL/FSL/model licences and processing of photos, measurements, and face data still require the reviews already mandated by the planning package.
- Provider prices and store policies change. Recheck them at the consuming phase, as the existing planning process already requires.
