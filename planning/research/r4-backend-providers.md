# Backend Stack Research: Current Options & Recommendations (August 2025 – 2026)

**Compiled:** August 24, 2026 | **Scope:** Modular monolith + isolated workers, PostgreSQL, TypeScript, 2–3 dev team | **Scale:** Launch (1–5k users)

---

## 1. Backend Framework: NestJS vs Fastify vs Hono vs AdonisJS

### Overview

Four viable TypeScript frameworks occupy different points on the opinionated-vs-lightweight spectrum:

| Framework | Philosophy | Performance | DX | Maturity | Best For |
|-----------|-----------|-------------|----|---------|----|
| **NestJS** | Opinionated, enterprise | 15K req/s | Excellent DI + decorators | Very mature | Structure, teams, modules |
| **Fastify** | Mid-weight, performance | 15K+ req/s | Minimal magic | Mature | Raw speed, schema validation |
| **Hono** | Lightweight, edge-native | Fast | Minimal DSL | Growing | Workers, Vercel Edge, Bun |
| **AdonisJS** | Batteries-included, Laravel-like | Good | Excellent (Rails-like) | Mature | Rapid development, monolithic |

### Recommendation: **NestJS (primary) or Fastify (if prioritizing performance)**

**NestJS wins for this project because:**
- **Module boundary enforcement** via `@Module()` — enforces separation in a modular monolith
- **DI system** — clean provider/injector pattern scales with team size
- **OpenAPI generation** — `@nestjs/swagger` decorators → automatic docs + client codegen
- **Ecosystem** — first-party modules for auth, queues, config, validation
- **AI-agent familiarity** — Well-documented, widely used in agent-assisted development

**NestJS + Fastify adapter** is the sweet spot: NestJS structure + Fastify's raw speed (both achieve 15K+ req/s).

**Fastify alternative**: If performance benchmarks show contention and OpenAPI codegen feels optional, `@fastify/autoload` + Typebox provides schema validation + structured plugin loading without NestJS's complexity.

**Skip AdonisJS/Hono at this stage**: AdonisJS excellent for monoliths but overkill for modular architecture with separate workers; Hono shines on edge/Workers, not traditional servers.

---

## 2. API Contract Strategy: OpenAPI Codegen vs tRPC vs GraphQL

### Overview

| Strategy | Type Safety | Mobile Codegen | Schema Required | Complexity | DX |
|----------|-------------|--------|-----|-----------|-----|
| **tRPC** | Full (TypeScript-to-TS) | ✓ via OpenAPI | No schema file | Low | Excellent |
| **OpenAPI + Codegen** | Partial (JSON schema) | ✓ (multiple generators) | YAML/JSON | Medium | Good |
| **GraphQL** | Full (introspection) | ✓ (apollo-codegen) | .graphql schema | High | Excellent for large teams |

### Recommendation: **tRPC with OpenAPI bridge for mobile**

**Why tRPC for this project:**
- **No schema duplication** — Type truth lives in TypeScript, not a separate file
- **Mobile client generation** — `@trpc/openapi` generates valid REST/OpenAPI from tRPC routers, then use `@hey-api/openapi-ts` to generate React Native clients
- **Small team fit** — Reduces ceremony; one language (TypeScript) across server + client
- **Code generation example**:
  ```typescript
  // Generate OpenAPI from tRPC router
  const doc = await generateOpenAPIDocument(routerPath, {
    title: 'AI Stylist API', version: '1.0.0'
  });
  // Then codegen React Native client with hey-api
  await createClient({
    input: 'openapi.json',
    output: 'client/generated',
    plugins: [{ name: '@hey-api/typescript' }]
  });
  ```

**React Native support**: tRPC has a dedicated `httpBatchStreamLink` for React Native with streaming + Expo fetch polyfills.

**GraphQL trade-off**: Excellent for multi-client scenarios (web + mobile + third-party) but adds resolver complexity; skip unless you need a public API or very large team.

---

## 3. Job Queue/Workers: BullMQ vs Inngest vs Trigger.dev vs Temporal

### Comparison

| Option | Type | Infrastructure | Idempotency | Retries | DLQ | Python Interop | Cost (1k jobs/mo) |
|--------|------|---|---|---|---|---|---|
| **BullMQ** | Queue lib (Redis) | Self-hosted | Manual | Built-in | Manual | Via subprocess | ~$0 |
| **Inngest** | Durable functions | Managed cloud | Built-in | Built-in | Built-in | Via webhooks | Free (100k runs) |
| **Trigger.dev** | Task execution | Managed cloud | Built-in | Built-in | Built-in | Via APIs | Free ($5 credit) |
| **Temporal** | Workflow engine | Complex | Built-in | Built-in | Built-in | Via gRPC | $$$+ |

### Recommendation: **Trigger.dev v4 (primary) or Inngest (if preferring events)**

**Trigger.dev v4 (GA since August 2025) wins because:**
- **No infrastructure ops** — Platform handles scheduling, retries, state, durability
- **Pricing aligned with scale** — Free tier: $5/month credit = ~13,774 Small runs or 2,435 60-second tasks; $0.0000169/sec (Micro) to $0.0006800/sec (Large 2x)
- **Warm starts** — Execution latency 100–300ms, tasks run minutes-to-hours without platform limits
- **Image/AI pipeline support** — Designed for media processing, long-running workflows
- **Python interop** — Call Python services via REST webhooks; share schema validation via JSON (request body validation on Trigger.dev side)

**Inngest alternative** (event-driven preference): Free tier 100k executions/mo, $50 per million overages. Better for event-sourced architectures; Trigger.dev better for imperative task schedules.

**Skip BullMQ at launch**: You own Redis, worker deployments, monitoring, error recovery. Only choose if Redis is already a production requirement (caching, sessions) and you want one less managed service.

**Python worker pattern**: 
1. Store versioned ML models/configs in object storage or as Trigger.dev step outputs
2. Trigger.dev task → POST to Python worker (FastAPI or Flask) with JSON payload
3. Python worker returns result; Trigger.dev resumes in parent workflow
4. Shared schema validation: Use Pydantic on Python side, match request shape in Trigger.dev task definition

---

## 4. PostgreSQL Hosting + Vector Search + ORM/Migrations

### Postgres Hosting

| Provider | Pricing | Free Tier | Auto-scale | Branching | Best For |
|----------|---------|-----------|-----------|-----------|----------|
| **Neon** | $0.106/CU-hr (Launch), $0.222/CU-hr (Scale) | 100 CU-hrs, 0.5 GB | Scale-to-zero in 5 min | Yes (10 branches) | Serverless, dev/prod branching |
| **Supabase** | $25/mo Pro floor | 500 MB (pauses after 7d) | Manual | No | Full platform (auth + storage included) |
| **Railway** | Usage-based + $5/mo fee | No | Yes | No | Simple, bundled postgres |
| **Fly Postgres** | ~$20/mo for 2 vCPU / 4GB | No | Manual | No | Global replication, edge |
| **RDS** | $30–100+/mo | No | Manual | No | Enterprise, multi-AZ |

**Recommendation: Neon**
- **Cost**: 0.5 GB + 100 CU-hrs free per month; compute auto-suspends to zero after 5 min idle
- **Branching**: Development branches per PR or feature (Databricks acquisition drove prices down 25% post-Sept 2025)
- **Startup fit**: No monthly minimum; pay per second of compute
- **Migration path**: Managed backups, point-in-time recovery on paid plans

**Pricing math at 1k users, ~1k MAU**:
- 0.5 GB storage included free; assume 100 GB at scale → $35/mo
- ~50 compute hours/month (mostly scale-to-zero) → ~$5.30/mo (Launch)
- **Total: ~$40/mo** (vs Supabase $25/mo minimum + usage overages)

---

### Vector Search: pgvector vs Dedicated Vector DB

| Option | Storage | Performance | Ops | Cost | Latency |
|--------|---------|-------------|-----|------|---------|
| **pgvector (self-hosted Postgres)** | Native | 471 QPS @ 50M vectors (pgvectorscale) | Low | $0 extra | ~8ms avg |
| **Pinecone** | Separate | High (optimized) | Zero-ops | $0.70/hour per index + storage | ~100ms (network) |
| **Weaviate** | Separate | High (100M+ vectors) | Low (managed) | $300+/mo managed | Variable |

**Recommendation: pgvector in Neon** (startup stage)
- pgvectorscale (Timescale extension) achieves 75% lower cost vs Pinecone ($0 vs $500+/mo at scale)
- 8ms latency competitive with dedicated vector DBs
- Keep embeddings, documents, metadata in one database (no API roundtrip for joins)
- Upgrade to Pinecone only when you exceed 10M vectors or need < 50ms p99 latency

---

### ORM/Migrations: Drizzle vs Prisma vs Kysely

| ORM | Philosophy | Migration | Edge Compatible | Bundle Size | Maturity |
|-----|-----------|-----------|-----------------|------------|----------|
| **Drizzle** | SQL-like, minimal | Via drizzle-kit | Yes (5KB) | 5KB | Growing fast |
| **Prisma** | Schema-first, opinionated | Via Prisma Migrate | No (bundles engine) | ~500KB | Very mature |
| **Kysely** | Type-safe SQL builder | Manual | Yes | Small | Mature |

**Recommendation: Drizzle**
- **SQL control** — familiar if team knows SQL; decorators map to schema
- **Edge compatibility** — NestJS can run on Vercel Edge if ever needed
- **npm downloads** (March 2026): Drizzle ~1.9M/week, crossing Prisma (~3.8M/week) due to performance + serverless fit
- **Migration pattern**: `drizzle-kit push:pg` for dev, `drizzle-kit migrate` for prod

**Prisma alternative**: If team prioritizes DX over edge compatibility and doesn't plan serverless migrations.

**Kysely alternative**: If your team wants raw SQL control + compile-time type checking but no schema management.

---

## 5. Object Storage + CDN: Cloudflare R2 vs S3+CloudFront vs Bunny

### Cost Model

Assume: **1 TB/month egress** (image-heavy stylist app with 1k users, avg 1 GB per user/month).

| Provider | Storage | Operations | Egress | CDN | Total/mo |
|----------|---------|-----------|--------|-----|----------|
| **Cloudflare R2** | $0.015/GB | $4.50/M writes, $0.36/M reads | **$0** | Included | **$15** |
| **S3 + CloudFront** | $0.023/GB | $5/M writes, $0.40/M reads | $0.085/GB | $0.085/GB | **~$170** |
| **Bunny Edge Storage** | $0.01/GB/region | Flat $0.01/GB ops | $0.005/GB | $0.005/GB | **~$15** |

**Recommendation: Cloudflare R2**
- **Zero egress** — largest cost lever for image-heavy apps
- **Built-in CDN** — R2 buckets expose via Cloudflare's global network (same as Bunny performance, cheaper than S3+CloudFront)
- **Image transformations** — Cloudflare Image Resizing ($0.50/10k transforms) for responsive images
- **Signed URLs** — For private uploads (user profile pictures)

**Real-world 1 TB/mo savings**: S3+CloudFront ~$170/mo → R2 ~$15/mo (71× cheaper per search result).

---

## 6. App Hosting: Railway vs Fly.io vs Render vs Hetzner

### Pricing at Launch Scale (1–5k users, ~2 vCPU / 4GB baseline)

| Platform | Compute | DB Managed | Egress | Monthly Est. | Key Feature |
|----------|---------|-----------|--------|------------|-------------|
| **Railway** | Usage-based (~$10–15/mo typical) | $12+/mo | $0.1/GB | **$25–30/mo** | Simple, usage-based |
| **Fly.io** | ~$2.02/mo (shared 256MB), +$5/GB RAM | None | $0.02/GB | **$20–40/mo** | Global edge, no free tier |
| **Render** | $7+/mo instance, $25 team plan | PITR, read replicas | $0.1/GB | **$35–45/mo** | Best Postgres, team plan flat |
| **Hetzner VPS** | €7.99/mo (CPX22: 2vCPU/4GB) | None | Unlimited | **$10–15/mo + DB** | Raw compute, cheapest |

**Recommendation: Railway (primary) or Fly.io (if global edge needed)**

**Railway**:
- No monthly minimum; billing per second
- Built-in PostgreSQL option ($12+/mo managed)
- Private networking between API + DB
- **Estimated monthly: API $15 + DB $15 + storage $5 = ~$35/mo at launch**

**Fly.io alternative** (if you need edge replication for low latency):
- Deploy globally with one `fly deploy`
- Pricing: Compute ~$2–5/mo + egress $0.02/GB + managed Postgres separate
- **Estimated monthly: API $5 + DB $20 + egress $5 = ~$30/mo**

**Hetzner** (if self-hosting Docker Compose):
- Dedicated VPS €7.99/mo (~$9.49/mo); pay separately for managed Postgres or self-host PostgreSQL
- Total: ~$10 compute + $20–30 managed DB = **$30–40/mo** (or $10 + $5 self-hosted DB = $15/mo with ops burden)
- Only choose if team has DevOps experience; Railway/Fly are PaaS

**Skip Render** for pure cost; PITR/replicas excellent for mature apps, overkill at 1k users.

---

## 7. External Providers: Auth, Weather, Holidays, Push, Subscriptions, Analytics, Flags

### Authentication

| Provider | Free Tier | Apple/Google Sign-In | Pricing | Best For |
|----------|-----------|-----|---------|----------|
| **better-auth** | Unlimited (self-hosted) | Yes (OAuth + passkeys) | Free (open-source) | Full control, mobile-first |
| **Clerk** | 50k MAU | Yes (drop-in React components) | $25/mo base | Best DX, enterprise SLA |
| **Supabase Auth** | Included with DB | Yes | $25/mo (with DB) | Postgres-native, full stack |
| **Firebase Auth** | 50k MAU | Yes (Google-native) | Free tier generous | Fast global scaling |

**Recommendation: better-auth (primary) or Clerk (if DX/managed preferred)**

**better-auth (2025 status: Active, production-ready)**:
- Open-source, self-hosted on your own infrastructure
- Support for OAuth (Apple, Google, Discord, etc.), passkeys, MFA, organizations
- **Mobile support**: Native SDKs for React Native, Flutter
- **Cost**: $0 (apart from your server running it)
- **Risk**: Maintenance burden on your team if security issues arise

**Clerk alternative** (if you prefer managed auth):
- 50k free MAU; $0.02 per MAU above that
- React Native support via `@clerk/clerk-react-native`
- Drop-in UI components; handles redirects, session management

**Skip Supabase Auth + Firebase** if using better-auth; Firebase redundant for auth-only.

---

### Weather API

| Provider | Free Tier | Hourly Forecast | Pricing | Coverage |
|----------|-----------|---------|---------|----------|
| **Open-Meteo** | Unlimited (non-commercial) | Yes, 15-day hourly | $0 free, $500/mo production | Global, 30+ models |
| **OpenWeather** | 1k calls/day | 5 days / 3 hour steps | $200+/mo | Global |
| **Tomorrow.io** | Limited | Yes, sub-hourly | Custom | 80+ layers, high accuracy |
| **WeatherKit** | Apple developers | Hourly | Free (Apple ecosystem) | North America, Europe |

**Recommendation: Open-Meteo (free) → Tomorrow.io (paid, if accuracy critical)**

- **Launch**: Open-Meteo free tier non-commercial (hourly, global 15-day forecast)
- **Production**: $500/mo production tier or migrate to Tomorrow.io if pricing justified
- **Backup**: WeatherKit if majority of users are Apple iOS (free within Apple ecosystem)

---

### Public Holidays API

| Provider | Free Tier | Pricing | Coverage |
|----------|-----------|---------|----------|
| **Nager.Date** | Unlimited (free, open-source) | $0 | 200+ countries |
| **Calendarific** | 500 req/mo | $100/year | Global, religious + national |
| **Abstract API** | 1k req/mo | $15/mo | US + some intl |

**Recommendation: Nager.Date**
- No API key required; fair-use public endpoint
- Zero cost for startups
- Coverage of 200+ countries

---

### Push Notifications

| Option | Free Tier | Pricing | Setup |
|--------|-----------|---------|-------|
| **FCM (Google)** | Unlimited | $0 | ~30 min (Firebase console + APNs cert) |
| **APNs (Apple)** | Unlimited | $0 | APNs certificate (requires Apple dev account) |
| **OneSignal** | 10k subscribers | $9/mo (low tier) | SDK integration, UI-based segments |
| **Expo Push** | Included in Expo | $99/mo (Production tier) | Only if using Expo |

**Recommendation: FCM + APNs direct**
- FCM free for unlimited Android messages; relays to iOS via APNs
- APNs free for unlimited iOS messages (cert management only cost)
- **Cost: $0** (vs OneSignal $9/mo, Expo $99/mo)
- **Setup**: Firebase console (FCM) + Apple dev account (APNs cert)

---

### Mobile Subscriptions

| Option | Free Tier | Pricing | Best For |
|--------|-----------|---------|----------|
| **RevenueCat** | Free up to $2,500/mo revenue | 1% above $2,500/mo | Indie devs, easy analytics |
| **Direct StoreKit2 + Play Billing** | N/A | $0 (you build server verification) | Cost-sensitive at scale |

**Recommendation: RevenueCat**
- Free up to $2,500/mo revenue; covers launch scale completely
- Handles renewal grace periods, involuntary churn recovery, cross-platform entitlements
- Analytics dashboard
- **30-min integration** via mobile SDK

**Direct alternative** (only if revenue >$5k/mo or strict compliance needs):
- Build server verification for Apple/Google receipts yourself
- Lower cost at scale, but higher ops burden (WWDC 2023+: StoreKit 2 is the modern approach)

---

### Analytics & Crash Reporting

| Provider | Free Tier | Features | Best For |
|----------|-----------|----------|----------|
| **PostHog** | 1M events/mo, 5k replays, **100k errors** | Analytics + feature flags + session replay | All-in-one, generous free tier |
| **Sentry** | Limited | Error tracking, source maps, session replay | Error-focused teams |

**Recommendation: PostHog**
- 100k errors/mo in free tier (most generous)
- Includes feature flags, A/B testing, surveys (bonus)
- Usage-based billing above free tier with up to 82% volume discount
- **Cost at launch: $0** (stays free until 1M events/mo threshold)

---

### Feature Flags

| Provider | Free Tier | Pricing | Hosting |
|----------|-----------|---------|----------|
| **PostHog Flags** | Included with analytics | Included in PostHog pricing | Managed |
| **Unleash** | Self-hosted free; Cloud starts $75/mo | $75/mo (Cloud) or $0 (self-hosted) | Both options |
| **Flagsmith** | Self-hosted free; Cloud $45/mo | $45/mo (Cloud) or $0 (self-hosted) | Both options |

**Recommendation: PostHog Flags**
- Bundled with analytics (one platform)
- Unlimited flags in free tier
- No separate bill at launch

**Self-hosted alternative**: Unleash or Flagsmith if you self-host and want to avoid SaaS dependency.

---

## 8. Infrastructure as Code + Environments

### IaC Tooling for Small Teams

| Tool | Language | K8s Required | Learning Curve | State Management | Best For |
|------|----------|--|----|----|------|
| **Terraform** | HCL | No | Medium | State file | Standard, multi-cloud |
| **Coolify (Docker-based)** | YAML (UI) | No (Docker Swarm) | Low | Database | Small teams, Railway alternative |
| **Pulumi** | Python/Go/TS | No | Medium | State backend | Code-as-IaC teams |

**Recommendation: Terraform for structure + Coolify for local Docker dev/small prod**

**Workflow**:
1. **Local dev**: `docker compose` for API + PostgreSQL + Redis (if needed)
2. **Staging/Prod on Railway/Fly**: Use Railway UI (no IaC needed) or Terraform providers (`terraform-provider-railway`)
3. **Self-hosted (if choosing Hetzner)**: Coolify + Terraform for infra-as-code
   - Example: Terraform provisions Hetzner VPS, Coolify manages Docker Swarm deployments
   - Coolify Terraform provider (v2.0+ August 2026) supports 33+ resources

**Skip K8s**: Not justified at 1–5k users; Docker Compose or managed PaaS sufficient.

---

## Estimated Monthly Infrastructure Cost @ Launch Scale (1–5k users)

Assuming: **API + Worker + Database + Storage + Auth + Analytics**

### Recommended Stack

| Component | Service | Cost |
|-----------|---------|------|
| **API (NestJS)** | Railway | $15/mo |
| **Background Jobs** | Trigger.dev | Free ($5 credit, <2k tasks/mo) |
| **Database** | Neon (Postgres) | $10–15/mo (0.5 GB included + compute hours) |
| **Object Storage** | Cloudflare R2 | $5/mo (1 TB/mo images @ $0/egress) |
| **CDN** | Included in R2 | $0 |
| **Authentication** | better-auth (self-hosted) | $0 |
| **Push Notifications** | FCM + APNs | $0 |
| **Analytics/Errors** | PostHog | $0 (free tier: 1M events/mo) |
| **Feature Flags** | PostHog Flags | $0 (included) |
| **Weather** | Open-Meteo | $0 (free tier) |
| **Holidays** | Nager.Date | $0 (free) |
| **Subscriptions** | RevenueCat | $0 (free <$2.5k revenue) |
| **Custom Domain/DNS** | Cloudflare | $0/mo (included with R2) |

### **Total Estimated Monthly: $30–35/mo at launch**

**Breakdown**:
- API + DB: $25–30/mo
- Storage: $5/mo (R2 with 1 TB/mo egress)
- Everything else: $0

**At 5k users (assuming 10x traffic)**:
- API: $40/mo (Railway scales smoothly)
- Database: $40–50/mo (Neon compute + storage)
- Storage: $15–20/mo (10 TB/mo egress)
- Everything else: ~$50/mo (PostHog approaches paid tier, RevenueCat 1% above $2.5k)
- **Total: ~$150–180/mo**

---

## Summary of Recommendations

| Decision | Recommendation | Runner-up | Rationale |
|----------|---|---|---|
| **Backend Framework** | NestJS (+ Fastify adapter) | Fastify bare | Module boundaries, DI, OpenAPI, ecosystem |
| **API Contract** | tRPC + OpenAPI bridge | GraphQL | No schema duplication, mobile codegen, small team fit |
| **Job Queue** | Trigger.dev v4 | Inngest | Managed compute, image/AI workflow support, warm starts 100–300ms |
| **PostgreSQL** | Neon | Supabase | Serverless, scale-to-zero, no minimum, cost-effective |
| **Vector Search** | pgvector in Neon | Pinecone | 75% cost savings, 8ms latency, single database |
| **ORM** | Drizzle | Prisma | SQL control, edge-compatible, growing ecosystem |
| **Object Storage** | Cloudflare R2 | Bunny | Zero egress, built-in CDN, image transforms |
| **App Hosting** | Railway | Fly.io | Simple setup, usage-based, managed Postgres optional |
| **Authentication** | better-auth | Clerk | Free, mobile-native, full control |
| **Weather** | Open-Meteo | Tomorrow.io (paid) | Free tier unlimited, global coverage |
| **Holidays** | Nager.Date | Calendarific | Free, 200+ countries |
| **Push** | FCM + APNs direct | OneSignal | $0 cost, full control |
| **Subscriptions** | RevenueCat | Direct StoreKit2 | Free <$2.5k revenue, analytics included |
| **Analytics** | PostHog | Sentry | 100k errors/mo free, flags + replay included |
| **Feature Flags** | PostHog Flags | Unleash (self-hosted) | Bundled, no separate bill |
| **IaC** | Terraform (Railway) | Coolify (Hetzner) | Standard, minimal ops at PaaS scale |

---

## Key Decisions & Migration Paths

### Decision 1: Python ML Workers (if needed)
**Pattern**: Trigger.dev task → POST to Python FastAPI service with versioned schema
- Schema validation: Pydantic on Python, match in Trigger.dev task definition
- Deployment: Separate Docker image, Railway or Hetzner container
- No gRPC/protobuf needed; JSON over HTTP sufficient for launch scale

### Decision 2: When to Upgrade From Free Tiers
1. **PostHog analytics** → paid (~$30–50/mo) when events exceed 1M/mo
2. **RevenueCat** → 1% commission when revenue exceeds $2.5k/mo
3. **Open-Meteo** → $500/mo production tier if non-commercial free no longer fits (unlikely)
4. **Neon compute** → Monitor CU hours; add reserved capacity if >500 hrs/mo
5. **Cloudflare R2** → Upgrade to Bunny only if egress hits 50+ TB/mo (unlikely at 5k users)

### Decision 3: When to Add Redundancy
- **Database**: Neon → managed Fly Postgres for replication (10k+ users)
- **Job queue**: Trigger.dev → Temporal or k8s if workflows > 1M/mo
- **Auth**: better-auth → Clerk managed if team prefers zero-maintenance
- **Storage**: R2 → backup to S3 only if loss unacceptable (rare at startup stage)

---

## Sources & Dates

### Primary (Official Docs & Pricing Pages)
1. **NestJS Documentation** (2025-2026) — https://docs.nestjs.com
   - Module system, DI, OpenAPI: https://github.com/nestjs/docs.nestjs.com

2. **tRPC Documentation** (2025-2026) — https://trpc.io
   - OpenAPI bridge, React Native: https://github.com/trpc/trpc (main/www/docs)

3. **Drizzle ORM Documentation** (2025-2026) — https://orm.drizzle.team
   - Migrations, PostgreSQL support: https://drizzle-team.github.io/drizzle-orm

4. **Neon Pricing** (August 2026) — https://neon.com/pricing
   - Compute: $0.106/CU-hr (Launch), $0.222/CU-hr (Scale)
   - Storage: $0.35/GB-month; Free: 100 CU-hrs, 0.5 GB

5. **Trigger.dev Documentation** (August 2025, v4 GA) — https://trigger.dev/docs
   - Pricing: Free ($5 credit), $0.0000169/sec (Micro) to $0.0006800/sec (Large 2x)
   - Per-invocation: $0.000025 ($0.25 per 10k runs)

6. **Cloudflare R2 Pricing** (2025-2026) — https://www.cloudflare.com/pricing/r2
   - Storage: $0.015/GB-month
   - Egress: $0 (zero egress model)
   - Operations: $4.50/M Class A writes, $0.36/M Class B reads

7. **Railway Pricing** (2025-2026) — https://railway.app/pricing
   - Usage-based: ~$10–15/mo typical; no monthly minimum

8. **Supabase vs Neon Comparison** (2025-2026) — https://designrevision.com/blog/supabase-vs-neon

### Secondary (Comprehensive Comparisons)
9. **NestJS vs Fastify vs Hono 2026** — https://encore.dev/articles/nestjs-vs-fastify-vs-hono

10. **tRPC vs GraphQL vs OpenAPI 2026** — https://dev.to/pockit_tools/rest-vs-graphql-vs-trpc-vs-grpc-in-2026-the-definitive-guide-to-choosing-your-api-layer-1j8m

11. **BullMQ vs Inngest vs Trigger.dev 2026** — https://starterpick.com/guides/inngest-vs-bullmq-vs-triggerdev-boilerplans-2026

12. **Drizzle vs Prisma vs Kysely 2025-2026** — https://levelup.gitconnected.com/the-2025-typescript-orm-battle-prisma-vs-drizzle-vs-kysely-007ffdfded67

13. **pgvector vs Pinecone 2026** — https://encore.dev/articles/pgvector-vs-pinecone

14. **Cloudflare R2 vs S3 vs Bunny 2026** — https://www.kunalganglani.com/blog/cloudflare-r2-vs-aws-s3

15. **Railway vs Fly.io vs Render 2026** — https://hostim.dev/blog/render-vs-railway-vs-fly-pricing/

16. **better-auth 2026 Status** — https://vibeorigin.dev/auth-stack-guide (mentions better-auth as "2026 community darling")

17. **Open-Meteo vs OpenWeather** — https://www.tomorrow.io/blog/top-weather-apis/

18. **RevenueCat vs StoreKit 2 2026** — https://theswiftk.it.com/blog/storekit-2-vs-revenuecat-ios-subscriptions

19. **PostHog vs Sentry 2026** — https://vemetric.com/blog/posthog-vs-sentry

20. **Inngest Pricing** (May 2026) — https://hokai.io/hub/tools/inngest
    - Free: 100k executions/mo; Pro: $75/mo

21. **Feature Flags: PostHog vs Unleash vs Flagsmith** — https://www.buildmvpfast.com/api-costs/feature-flags

22. **Hetzner vs AWS vs Linode 2025-2026** — https://danieltini.dev/en/blog/sla-uptime-pricing-iaas-comparison-2026

23. **Nager.Date vs Calendarific** — https://holidaydb.com/blog/holiday-api-comparison-2026

24. **Infrastructure Cost Estimation 1000 Users** — https://danubedata.ro/blog/saas-infrastructure-budget-complete-guide-2025

---

## End Notes

This stack assumes:
- **Team**: 2–3 full-stack TypeScript devs; no DevOps specialist initially
- **Scale**: 1–5k users at launch; infrastructure scales smoothly to 10–50k
- **Operational burden**: Managed services prioritized over self-hosted to reduce ops work
- **Python integration**: Separate workers (FastAPI) via Trigger.dev webhooks, not embedded
- **Costs are estimates**: Actual usage will vary by product design, traffic patterns, media sizes

**Re-evaluate at 10k users**: Consider Temporal for complex workflows, Postgres read replicas, S3 backup strategy, or dedicated vector DB if embeddings exceed 10M.

**Git your infrastructure**: Use Terraform for Railway/Fly configs; Coolify for self-hosted.

---

*Research compiled: August 24, 2026 | Authors: Arthur, Claude Haiku 4.5 | License: Internal, Architecture Decision Record*
