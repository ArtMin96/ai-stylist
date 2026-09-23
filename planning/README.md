# AI Stylist — Planning Package

**Status:** Planning complete, audited, ready for implementation · **Date:** 2026-08-24 · **Amended:** 2026-09-22 (native iOS/Android clients replace React Native + Expo — [ADR-0004](../docs/adr/0004-native-ios-and-android-clients.md), DEC-49–54) · **Files:** 63 · Product working name TBD (OQ-01 in [doc 16](16-risks-open-questions-and-decision-log.md)).

A premium, personalized AI stylist for iOS + Android: a parametric 3D avatar adjusted from the user's real measurements, a digitized virtual closet (clothing, shoes, accessories), explainable outfit recommendations from the clothes the user actually owns — driven by weather, forecast, holidays, and occasion — generative photo try-on, and personalized fashion intelligence. Built by a 2–3 dev team on Linux (plus one Mac for iOS) with heavy AI-coding-agent use, as native Swift/SwiftUI and Kotlin/Compose apps on one backend. Every suggestion is grounded, traceable, and explainable; nothing is random.

## Reading order

1. **[SPINE.md](SPINE.md)** — canonical decisions & conventions. Read first, always. Conflicts resolve in SPINE's favor.
2. **[00-product-vision-and-scope.md](00-product-vision-and-scope.md)** — vision, MVP, metrics, research bets.
3. **[01-requirements-and-traceability.md](01-requirements-and-traceability.md)** — 215 requirement IDs + brief-coverage matrix.
4. Docs **02–16** in numeric order (each owns one concern; they link rather than repeat):
   journeys/IA → domain model → architecture → technology decisions → data/API/event contracts → 3D avatar & garment pipeline → closet taxonomy → recommendation engine → AI usage & cost → security/privacy → pricing & unit economics → testing/performance → observability/ops → team & AI-agent workflow → risks/decisions.
5. **[PROGRESS.md](PROGRESS.md)** — status ledger; where the next session starts.
6. **[phases/](phases/)** — P00–P15, one implementation-ready file each.
7. **[CLAUDE.md](CLAUDE.md)** + **[.agents/skills/](.agents/skills/)** (13 skills) — historical copies; the live contract is [`../CLAUDE.md`](../CLAUDE.md) and the live skills are [`../.agents/skills/`](../.agents/skills/) (23 skills) since P02.
8. **[research/](research/)** — r1–r5 evidence reports (read-only; versions as of Aug 2026) + **[r6](research/r6-pricing-verification-2026-09-09.md)** (prices verified 2026-09-09 — supersedes r3/r4/r5 price figures; basis for DEC-34/35) + **[r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md)** (third-party services and self-hosting audit, 2026-09-13; basis for DEC-41–48 and [ADR-0003](../docs/adr/0003-self-hosted-infrastructure-baseline.md)).
9. **[templates/](templates/)** — ADR, module contract, phase, issue, PR, session handoff.

## Phase map

| Wave | Phases | Notes |
|---|---|---|
| Validate | P00 → P01 ∥ P02 | P01 = Anny asset pipeline + measurement harness now; a native Filament real-device spike when 3D resumes (*the original react-native-filament go/no-go gate is moot since 2026-09-22, DEC-50*) |
| Skeleton | P03 | Account, consent, profile, onboarding E2E |
| Core value | P04→P05 ∥ P06→P07 ∥ P08 | Avatar track, closet track, and context track run in parallel |
| Engine | P09 → P10 → P11 | Deterministic recommendations → outfit-on-avatar → gated generative try-on |
| Business | P12 ∥ P13 | Fashion intelligence; 3-day trial + Free/Essentials/Plus/Pro |
| Ship | P14 → P15 | Hardening/launch → post-launch learning, chat foundations |

**Critical path:** P00 → P01/P02 → P03 → P06 → P07 → P09 → P10 → P13 → P14.

## Most important architecture decisions (full rationale in [doc 05](05-technology-decisions.md), log in [doc 16](16-risks-open-questions-and-decision-log.md))

1. **Native clients: Swift 6 + SwiftUI (`apps/ios`) and Kotlin + Jetpack Compose (`apps/android`)**, one backend and one OpenAPI contract with generated clients. 3D is deferred; when it returns, it uses Filament's C++ engine directly on both platforms (DEC-49/50, 2026-09-22). *Superseded original: React Native + Expo with `react-native-filament`.*
2. **Anny (Apache 2.0) parametric body model** — avoids the SMPL commercial-licensing trap; zero licensing cost.
3. **Honest capability ladders (A0–A3, G0–G4)** — MVP ships A1 avatar + G0 collage + G2 generative photo try-on; 3D garment reconstruction and cloth simulation are gated R&D, not promises.
4. **NestJS modular monolith + pg-boss jobs + self-managed PostgreSQL (pgvector) + Cloudflare R2, on owned servers with Coolify** — module boundaries enforced in CI; no microservices/Kubernetes until measured need (self-hosting baseline 2026-09-13: [r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), [ADR-0003](../docs/adr/0003-self-hosted-infrastructure-baseline.md)).
5. **OpenAPI 3.1 canonical contracts, generated clients** — one source of truth for schemas, taxonomy, reason codes, entitlements; future chat reuses the same application services.
6. **Deterministic recommendation engine** — hard constraints before soft preferences, reason codes from the decision trace, zero-hidden-randomness; AI only at bounded edges (~$0.02–0.16/user/mo).
7. **Linux-first development; the team's Mac for iOS work; the GitHub Actions macOS runner as the only iOS CI lane** (DEC-51; EAS removed, ADR-0002 superseded, OQ-04 resolved). *Superseded original: no Mac purchase; EAS or GHA macOS.*
8. **Server-side entitlements + 3-day Pro-level trial → Free tier + 3 paid tiers** (prices are hypotheses; see [doc 12](12-pricing-entitlements-and-unit-economics.md)).

## Five highest risks (register in [doc 16](16-risks-open-questions-and-decision-log.md))

| Risk | Validated in |
|---|---|
| Native review capacity: two UI codebases, no Swift/Kotlin experience yet (RISK-18; replaces the retired `react-native-filament` risk, RISK-01) | **P03–P05** (measured), every phase exit |
| Generative try-on quality/cost fails user expectations | **P11** (eval gate + kill criteria) |
| Fashion content licensing unavailable/expensive (no scraping allowed) | **P12** (source contracts before build) |
| App-store approval friction for trial/paywall model | **P13** (compliance checklist) |
| Measurement→morph mapping erodes user trust | **P04** (calibration UX + correction metrics) |

## First implementation session — start here

1. Read `SPINE.md`, `PROGRESS.md`, and `phases/P00-product-validation-and-decisions.md` in full.
2. Execute P00 task T1 onward as written (ADR ratification of SPINE decisions, metric baseline definitions, legal-review register kickoff).
3. P01 (prototype) and P02 (repo foundations) may start in parallel once P00's decisions are ratified; P02's first task creates the monorepo and moves `CLAUDE.md` + `.agents/skills/` to the repo root.
4. Update `PROGRESS.md` before ending the session (protocol in [doc 15](15-team-workflow-and-ai-agent-operations.md)).

## Coverage statement

The traceability matrix in [doc 01](01-requirements-and-traceability.md) maps every section of the product brief to requirement IDs (215 total) and phases; a three-agent audit verified the §14 checklist across all documents. No requirement is uncovered. Items **deliberately left open** — each tracked with an owner and due phase in [doc 16](16-risks-open-questions-and-decision-log.md): product name (OQ-01); ~~EAS vs GitHub Actions iOS lane~~ (resolved 2026-09-22, DEC-51); ~~shared-kernel constants for Swift/Kotlin (OQ-15)~~ (resolved 2026-09-23, DEC-55, [ADR-0005](../docs/adr/0005-shared-kernel-registries-for-native-clients.md)); ~~the contract's double `/v1` (OQ-16)~~ (resolved 2026-09-23); ~~staging host (OQ-17)~~ (resolved 2026-09-23); native signing/store lanes (OQ-18); fashion-content source contracts (due before P12); all pricing figures (hypotheses pending market/store testing, P13); all legal/compliance statements (qualified legal review required — register in [doc 11](11-security-privacy-and-compliance.md)); research bets RB-1–RB-5 (gated, with kill criteria, in [doc 00](00-product-vision-and-scope.md)).
