# P02 — Repo Foundations and CI

> File name: `phases/P02-repo-foundations-and-ci.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); "None" is written explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P02 — Repo Foundations and CI
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Stand up the production monorepo — module skeletons with enforced boundaries, the contracts pipeline, CI in all four tiers including the iOS lane (ADR-decided), observability and security foundations, and the CLAUDE.md + skills operating contract live at repo root — so that P03's walking skeleton is built inside guardrails, not before them.
- **User-visible outcome:** None for end users. For the team (the users of this phase): a fresh Ubuntu machine reaches a green `just ci-parity` with one bootstrap command; every later feature lands inside enforced boundaries with generated contracts and a working iOS/Android delivery lane.
- **Why now:** Every convention deferred past the first feature becomes a migration. Boundaries (NFR-TEAM-030), contract generation (NFR-TEAM-080), CI tiers (NFR-TST-120), redaction lint (NFR-PRV-080), and the agent operating contract (NFR-TEAM-090/100) only work if they exist **before** P03 writes the first domain code. Depends only on P00; runs in parallel with P01.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only. P02 is the primary (first-listed) phase for each; "+"-ranged IDs are *established* here and *exercised* every later phase.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-AVA-120 | Engine ⊥ renderer: dependency-cruiser rule + renderer-independent contracts in `packages/contracts` | AC-3 |
| REQ-MED-090 | Idempotent jobs, retries, DLQ, replay via outbox (mechanism + tests; media consumers land P06) | AC-5 |
| REQ-MED-110 | Async work flows through domain events + outbox; no distributed event platform | AC-5 |
| REQ-CHT-010 | No chat implementation; application-service seams + `assistant` boundary rules exist from P02 | AC-3 |
| NFR-SEC-040 | TLS everywhere; at-rest encryption verified; secrets managed (sops/age), rotation inventory started | AC-7 |
| NFR-SEC-060 | Least-privilege scaffolding: per-env credentials, scoped CI secrets, permission matrix started | AC-7 |
| NFR-SEC-110 | Vuln + secret scanning, license/SBOM, supply-chain policy in CI | AC-7 |
| NFR-PRV-080 | Log-redaction enforced by logger + forbidden-field lint + canary test | AC-6 |
| NFR-PRV-110 | Analytics consent-gated with taxonomy schema; unknown events rejected in CI | AC-6 |
| NFR-PERF-030 | Backend SLO table wired to dashboards/alerts (targets = hypotheses) | AC-6 |
| NFR-PERF-040 | Resilience defaults: bounded queues, timeouts, retries+jitter, circuit-breaker util in `platform` | AC-5 |
| NFR-OBS-010 | Structured JSON logs + correlation IDs API→outbox→worker | AC-6 |
| NFR-OBS-020 | OTel traces across API + async jobs (skeleton flow proven) | AC-6 |
| NFR-OBS-030 | Metrics catalog bootstrapped (latency, errors, queue depth, job age) with dashboard panels | AC-6 |
| NFR-OBS-040 | Crash reporting mobile + backend with symbolication | AC-6 |
| NFR-OBS-050 | Dashboard 1, alert severity ladder, first runbooks | AC-6 |
| NFR-OBS-060 | Analytics event taxonomy owned in `packages/contracts`, CI schema check | AC-6 |
| NFR-OBS-080 | Flag registry with owner/expiry; expired-flag CI warning; rollback demoed | AC-6 |
| NFR-OBS-090 | Per-phase observability rule operational (template + DoD hook live) | AC-6 |
| NFR-TST-010 | Per-module `tests/` directories + test-support packages; placement lint | AC-4 |
| NFR-TST-030 | Contract tests: generated client/server against one OpenAPI 3.1 spec; staleness gate | AC-2 |
| NFR-TST-040 | Testcontainers integration harness (Postgres+pgvector); outbox idempotency/retry/DLQ suite | AC-5 |
| NFR-TST-110 | Regression-first, no-skip, flaky-quarantine rules enforced by lint + PR template | AC-4 |
| NFR-TST-120 | Four CI tiers live (PR fast gate <10 min, affected, nightly, pre-release skeleton) | AC-1 |
| NFR-TST-130 | Behavior-first testing rules in review checklist; ports faked at boundary | AC-4 |
| NFR-TEAM-010 | Linux-first dev proven: Ubuntu-only dev ships Android build + TestFlight build via CI; **EAS-vs-GHA ADR decided** | AC-8 |
| NFR-TEAM-020 | Monorepo layout per [04 §6](../04-architecture.md); no `utils` dumps; no large binaries in Git | AC-1 |
| NFR-TEAM-030 | ESLint boundaries + dependency-cruiser enforce module rules; module-contract files exist | AC-3 |
| NFR-TEAM-040 | Search-before-write workflow mandatory in CLAUDE.md; clone-detection in CI | AC-9 |
| NFR-TEAM-050 | File-size thresholds + exception rules documented and lint-backed | AC-4 |
| NFR-TEAM-060 | Full `just` catalog per [15 §5](../15-team-workflow-and-ai-agent-operations.md); CI runs the same recipes | AC-1 |
| NFR-TEAM-070 | mise-pinned toolchain; one-command bootstrap; `just doctor` | AC-1 |
| NFR-TEAM-080 | Single canonical owner per shared concept; generated clients; stale generation fails CI | AC-2 |
| NFR-TEAM-090 | Root CLAUDE.md operating contract live (moved from planning/, all listed rules) | AC-9 |
| NFR-TEAM-100 | `.agents/skills/` library live: one SKILL.md per listed area, six sections each | AC-9 |
| NFR-TEAM-120 | `.env.example` complete; secret scanning blocks real credentials | AC-7 |
| NFR-TEAM-130 | Migration/rollback policy implemented; dev/staging/prod isolation; safe seeds | AC-5 |
| NFR-TEAM-140 | Android + iOS CI/CD: signing, internal distribution wired (staged rollout config documented, rehearsed P14) | AC-8 |
| NFR-TEAM-150 | PROGRESS.md ledger + handoff template operational in-repo | AC-9 |
| NFR-TEAM-160 | Phase-completion evidence rules encoded in templates + DoD | AC-9 |
| NFR-AIC-090 | Provider SDK imports forbidden outside `platform` (arch-check rule); provider ports pattern established | AC-3 |

Contributing (primary delivery elsewhere): NFR-TEAM-110 (templates/ADR log — ratified P00, lands in-repo here); REQ-MED-100 (asset manifest schema in `assets/3d` from P01's ratified conventions).

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P00** ([SPINE §5](../SPINE.md)). **P01 parallel OK** — P02 must not block on the gate; the only coupling is A4/A5 (EAS × pnpm, lane cost) evidence exchange.
- External blockers:
  - Vendor accounts: GitHub org, Neon, Railway, Cloudflare (R2 + DNS/WAF), Trigger.dev, PostHog, Grafana Cloud, Expo/EAS, Apple Developer Program, Play Console. Regions per the **OQ-07 memo from P00**.
  - Apple/Google developer-program approvals can take days — request at phase start (blocks P02-T14 only).
  - ADR-P02 (OQ-04, iOS lane) needs ~2 weeks of dual-lane data (A5) — start both lanes early.

## 4. In scope / out of scope

**In scope:**
- Monorepo scaffold exactly per [04 §6](../04-architecture.md): `apps/mobile`, `apps/api`, `workers/ml`, `packages/contracts`, `packages/shared-kernel`, `packages/seed-data`, `packages/test-support`, `assets/3d`, `tools/`, `justfile`, `mise.toml`, `turbo.json`; pnpm workspaces + Turborepo.
- All 15 module skeletons (`apps/api/src/modules/<name>/{index.ts,internal/,tests/}` for every SPINE §3 name incl. `assistant` stub) + `platform` + composition roots; module-contract files in `docs/modules/` from [templates/module-contract.md](../templates/module-contract.md).
- Boundary enforcement: eslint-plugin-boundaries + dependency-cruiser rules encoding [04 §4.2](../04-architecture.md) (public-API-only, no cycles, `recommendation ⊥ avatar/renderer`, domain ⊥ provider SDKs, `platform` leaf-only, no `utils/` dirs, `prototype/` unimportable) → `just arch-check`.
- Contracts pipeline ([06 §1](../06-data-api-and-event-contracts.md)): OpenAPI 3.1 authoring layout, `@hey-api/openapi-ts` TS client, `datamodel-code-generator` Python models, event JSON Schemas + envelope, `just generate --check` staleness gate, spectral lint, oasdiff breaking-change detector. Seed content: health/version endpoint, error envelope (RFC 9457), event envelope, analytics-event schema.
- Data layer: Drizzle + drizzle-kit stream, Testcontainers Postgres+pgvector harness, **outbox table ([06 §6](../06-data-api-and-event-contracts.md)) + relay + one demo event round-trip** with idempotency/retry/DLQ tests; migration policy (expand–contract, `just db-migrate/rollback/reset/seed`); Neon projects (dev/staging/prod) + branch-per-PR.
- CI: GitHub Actions running `just` recipes only; four tiers per [13 §13](../13-testing-quality-and-performance.md); Linux runners everywhere except the iOS lane; Turborepo remote cache; `ci.pr_gate_duration` metric.
- **iOS lane + ADR-P02:** EAS free tier *and* GHA macOS lane both exercised (~2 weeks, A5); TestFlight upload via App Store Connect API from Linux; Android build/sign lane; ADR records the chosen lane (OQ-04 → DEC entry).
- Observability baseline ([14 §15 P02 row](../14-observability-operations-and-analytics.md)): pino/structlog JSON logging with schema-allowlist redaction, correlation IDs client→API→outbox→job→worker, OTel traces/metrics → Grafana Cloud (**ADR-OBS-01**), PostHog project (events/errors/flags; consent-gated client wiring lands P03), crash reporting with sourcemap/dSYM upload, dashboard 1 (service health), severity ladder + first runbooks (API down, Neon incident, queue stuck), flag registry + expiry lint.
- Security foundations: sops+age secrets ([15 §6](../15-team-workflow-and-ai-agent-operations.md)), `.env.example`, gitleaks pre-commit + CI, osv-scanner, license/SBOM (syft), Renovate, frozen lockfiles + postinstall allowlist, per-env credential isolation, Cloudflare WAF in front of the API, rate-limit middleware skeleton, **signed-URL skeleton**: `StorageProvider` port + R2 adapter minting presigned PUT/GET with TTL + namespace constraints ([11 §5.4](../11-security-privacy-and-compliance.md)) + its security tests (full media enforcement is P06/NFR-SEC-050).
- **CLAUDE.md moved from `planning/` to repo root** (verbatim policy content, paths activated) + `.agents/skills/` with one SKILL.md per NFR-TEAM-100 area (13 skills), each with trigger/required-reading/workflow/validation/output/stop-conditions; templates (issue/PR/ADR/session-handoff/module-contract) under `templates/`→repo; CODEOWNERS with real handles; PROGRESS.md operational at root.
- Mobile + workers skeletons: Expo app boots to a placeholder screen with generated client + PostHog init + crash reporting; one FastAPI worker (`workers/ml/segmentation` stub) consuming generated Pydantic models behind a versioned endpoint, containerized, hit by the demo outbox flow.
- `just` catalog complete per [15 §5](../15-team-workflow-and-ai-agent-operations.md) including `assets-validate` (adopting P01 tooling when available) and `ml-eval` stub.

**Out of scope / non-goals for this phase:**
- Any real domain behavior: auth, consent, profile → P03; media pipeline stages → P06; engine → P09. Skeleton endpoints stay at health/version + demo flow.
- 3D rendering in the product app (renderer boundary directory exists, empty) → P04; P01 owns prototype rendering.
- Store-facing releases, staged rollout execution, crash-gate rehearsal → P14 (config documented now per NFR-TEAM-140).
- RevenueCat, fal.ai, Open-Meteo, Nager.Date accounts/adapters → their owning phases (ports pattern only is established here).
- Sentry decision → end of P03 per [14 §1](../14-observability-operations-and-analytics.md).

## 5. Product/UX behavior

Cover every state: **empty · loading · partial · failure · retry · recovery · offline · accessibility**.

No user-facing product surface ships. The "users" are developers and agents; their journeys still get explicit states (link: [02 §14](../02-user-journeys-and-information-architecture.md) shared patterns apply from P03 onward):

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| `just bootstrap` (fresh Ubuntu) | One command → working env → `just doctor` green | Fresh machine (that *is* the empty state) | Fails fast with actionable per-step error; idempotent re-run continues | apt/network needed; offline prints which step needs connectivity | Script output readable, no color-only signals |
| `just doctor` | All checks green | Reports every missing piece with a fix hint | Non-zero exit, per-check hint | Distinguishes "offline" from "broken" | Same |
| PR to `main` | PR fast gate < 10 min, all `just` recipes green | n/a | Failing check names the exact local repro command (`just ci-parity`) | n/a | n/a |
| Placeholder mobile app | Boots to placeholder, health call round-trips, crash test appears symbolicated in PostHog | First-run empty screen states it is a skeleton build | Health-call failure shows retry, not a crash | Boots offline; health check reports unreachable | Placeholder screen already passes RNTL a11y label lint (rule active from day one) |
| Demo outbox flow | `POST /v1/dev/demo-events` → outbox → Trigger.dev task → worker → completion visible in trace | n/a | Injected failure → retry with backoff → DLQ + alert fires (that's the test) | n/a | n/a |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); every touched module gets its contract file created in `docs/modules/`.

| Module | Change | Contract update needed? |
|---|---|---|
| *(all 15 domain modules)* | Skeleton created: `index.ts` (empty public API), `internal/`, `tests/`; module-contract file seeded with owned data/invariants from [SPINE §3](../SPINE.md) + [doc 03](../03-domain-model-and-glossary.md) | Yes — files created |
| `shared-kernel` | Package created: ID/ULID helpers + prefixes ([06 §2](../06-data-api-and-event-contracts.md)), unit types + converters (skeleton), event envelope type, error-code registry start, reason-code/entitlement-name registry stubs | Yes |
| `platform` | Port pattern established; first adapters: `StorageProvider` (R2 signed URLs), outbox relay, logger, OTel init, PostHog server client, resilience utilities (timeout/retry+jitter/circuit-breaker) | Yes |
| `admin` | Skeleton only + DLQ-sweep ops-queue placeholder (consumer of failed outbox rows per [04 §9.2](../04-architecture.md)) | Yes |
| `assistant` | Skeleton + boundary rule (may import only public application services) — REQ-CHT-010 | Yes |
| Composition roots | `apps/api/src/main.ts`/`app.module.ts`, `apps/api/src/trigger/index.ts`, `apps/mobile/src/app/_root.tsx`, worker `main.py` — only places adapters meet ports ([04 §5](../04-architecture.md)) | n/a |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`): `GET /v1/health`, `GET /v1/version`; RFC 9457 problem envelope + `Idempotency-Key`/`If-Match` conventions encoded in the spec scaffolding and spectral rules ([06 §2](../06-data-api-and-event-contracts.md)); dev-only `POST /v1/dev/demo-events` (excluded from prod builds).
- Event schemas added/changed: `envelope.json` ([06 §4](../06-data-api-and-event-contracts.md)); `platform.demo.requested.v1` (demo/testing event, retired in P03); analytics-event taxonomy schema (NFR-OBS-060).
- DB migrations (Drizzle): `0001_platform_outbox.sql` (outbox table per [06 §6](../06-data-api-and-event-contracts.md) DDL, forward + down), `0002_platform_idempotency_keys.sql` (API idempotency store, 48 h TTL). Rollback proven on a Neon branch per [06 §7](../06-data-api-and-event-contracts.md).
- Generated clients to regenerate: TS client (`packages/contracts/gen/ts-client/`), event TS types, Python models (`workers/ml/generated/`) — all via `just generate`, committed, staleness-gated.

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Expo SDK 55+ prebuild skeleton; generated client wired; PostHog + crash reporting init; ESLint boundary config for `src/renderer/**`; Jest/RNTL harness; Maestro smoke flow (app boots) |
| Backend | NestJS/Fastify app; 15 module skeletons; DI composition root; health/version; outbox relay; rate-limit middleware skeleton; pino + OTel; contract-conformance test harness |
| Workers (ML/media) | `segmentation` FastAPI stub (versioned echo endpoint), Dockerfile, pytest + Schemathesis harness, generated Pydantic models |
| Data / migrations | Drizzle setup; outbox + idempotency migrations; Testcontainers harness; `just db-*` recipes; Neon dev/staging/prod + per-PR branches; `packages/seed-data` factories (synthetic only) |
| Infrastructure | GitHub org/repo + branch protection; Railway (API) dev/staging/prod; R2 buckets per env; Cloudflare WAF/DNS; Trigger.dev project; Grafana Cloud stack; PostHog project; sops/age + CI key; Renovate; Turborepo remote cache; both iOS lanes + Android lane |
| 3D / assets | `assets/3d/` layout + manifest JSON Schema (from [07 §9](../07-3d-avatar-and-garment-pipeline.md), P01-ratified conventions); `just assets-validate` recipe (adopts P01 tooling); Git LFS config |
| Admin / internal tools | None beyond DLQ ops-queue placeholder |

## 9. AI vs deterministic decisions

For each AI use: classification (per brief §3.1), why deterministic is insufficient, contract, fallback, cost — or link the owning row in [10-ai-usage-cost-and-evaluation.md](../10-ai-usage-cost-and-evaluation.md).

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Everything shipped in P02 | **Deterministic** — build tooling, CI, scaffolds, infra | No product AI feature exists yet; [10 §1](../10-ai-usage-cost-and-evaluation.md) governs future rows | n/a | $0 product AI spend |
| AI *governance plumbing* (established now) | Deterministic infrastructure for later AI: provider-port pattern + NFR-AIC-090 arch rule (no provider SDK outside `platform`), `ai.*` metric names reserved ([14 §4](../14-observability-operations-and-analytics.md)), kill-switch flag convention ([10 §6.3](../10-ai-usage-cost-and-evaluation.md)) | Structural rules are cheaper than retrofits | n/a | n/a |
| Coding agents building P02 | Per [15 §12.5](../15-team-workflow-and-ai-agent-operations.md): cheap models for mechanical scaffolding, top-tier for contracts/CI/security config | Agent spend tracked like provider spend | n/a | Tracked in session logs |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11](../11-security-privacy-and-compliance.md)): **no user data yet.** New S3-class *operational* secrets: provider API keys, signing certs, age keys — inventoried with owners + rotation periods per [11 §5.3](../11-security-privacy-and-compliance.md); iOS signing credentials scoped to the macOS lane only.
- Consent required / consent UI changes: none shipped; PostHog client initialized **behind the consent gate stub defaulting to off** so P03 can wire the real `analytics` purpose without a compliance gap (NFR-PRV-110).
- Retention, deletion, and export impact: none (no user rows). Outbox retention (90 d dispatched / keep failed) and idempotency-key TTL (48 h) implemented per [06 §6](../06-data-api-and-event-contracts.md).
- Threat/abuse cases added to the threat model: supply-chain (lockfile/postinstall/Renovate policy), CI secret exfiltration (scoped lanes), leaked-secret response (gitleaks + same-day rotation rule) — appended to [11](../11-security-privacy-and-compliance.md) per NFR-SEC-010's "every phase that adds attack surface" rule. Signed-URL skeleton lands with its abuse tests (expired/foreign-namespace rejects).

## 11. Observability and analytics added in this phase

- Logs/metrics/traces for what this phase introduces: JSON logs (pino/structlog) with schema-allowlist redaction + forbidden-field denylist ([11 §8](../11-security-privacy-and-compliance.md)); correlation IDs propagated client→API→outbox→Trigger.dev→worker (one demo-flow trace proves it — NFR-OBS-010/020); metrics `api.request.*`, `queue.*`, `ci.pr_gate_duration`, `ci.flake_rate` live ([14 §4](../14-observability-operations-and-analytics.md)); **ADR-OBS-01** (OTel → Grafana Cloud) recorded.
- Product analytics events (taxonomy per [14](../14-observability-operations-and-analytics.md)): taxonomy schema + CI check live; **zero events emitted** until the P03 consent gate — deliberate.
- Alerts/dashboards/runbook entries: dashboard 1 (service health: latency, errors, queue depth/age, error-budget burn); SEV1/2/3 ladder + alert budget configured; runbooks #1 (API down), #2 (Neon incident), #4 (queue/DLQ) written; crash reporting proven by a forced test crash on both platforms, symbolicated (NFR-OBS-040); flag registry + expired-flag CI report; one flag-off rollback demoed (NFR-OBS-080).

## 12. Ordered tasks

Small enough for one AI-assisted session each (~half-day). Task IDs `P02-T##` are referenced by handoff entries.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P02-T01 | Repo scaffold: pnpm workspaces + Turborepo + `mise.toml` pins + `justfile` skeleton + directory layout per [04 §6](../04-architecture.md); branch protection + Conventional-Commit hooks | — | 1 |
| P02-T02 | Bootstrap + doctor: `scripts/` per [15 §4](../15-team-workflow-and-ai-agent-operations.md); `.env.example`; direnv; verified on a clean Ubuntu VM | P02-T01 | 2 |
| P02-T03 | `shared-kernel` package: IDs/ULID prefixes, unit types + converters, event envelope, error-code registry, registry stubs (reason codes, entitlement names) + tests | P02-T01 | 1 |
| P02-T04 | Contracts pipeline: `packages/contracts` layout, OpenAPI scaffold (health/version, problem+json), envelope + event schemas, all four generators, `just generate --check`, spectral + oasdiff | P02-T03 | 2 |
| P02-T05 | API skeleton: NestJS/Fastify, 15 module skeletons + composition root, health/version controllers validated against the contract, rate-limit middleware skeleton | P02-T04 | 2 |
| P02-T06 | Boundary enforcement: eslint-plugin-boundaries + dependency-cruiser rules ([04 §4.2–4.3](../04-architecture.md) incl. `recommendation⊥avatar`, provider-SDK ban, `prototype/` ban, no-`utils` lint) → `just arch-check` + violation tests (each rule proven by a fixture that fails) | P02-T05 | 1 |
| P02-T07 | Data layer: Drizzle + migrations 0001/0002 (outbox, idempotency), Testcontainers harness, `just db-*` recipes, Neon envs + PR branches, seed-data package | P02-T05 | 2 |
| P02-T08 | Outbox relay + Trigger.dev + worker stub: relay (SKIP LOCKED poll), demo event → task → FastAPI stub round-trip; idempotency/retry/DLQ/replay test suite (NFR-TST-040, REQ-MED-090/110); resilience utils in `platform` | P02-T07 | 2 |
| P02-T09 | Observability: pino/structlog + redaction allowlist/denylist + forbidden-field lint + canary test; OTel wiring API/worker/task; Grafana Cloud + dashboard 1 + SEV alerts; ADR-OBS-01 | P02-T08 | 2 |
| P02-T10 | Mobile skeleton: Expo prebuild app, generated client round-trip to health, PostHog init (consent-stub off) + crash reporting + sourcemap upload, Jest/RNTL + Maestro smoke, renderer-boundary lint | P02-T04 | 2 |
| P02-T11 | CI tiers: GitHub Actions invoking `just` recipes only; PR fast gate (<10 min budget, measured), affected-module, nightly, pre-release skeleton; Turborepo remote cache; `ci.*` metrics | P02-T05, P02-T06, P02-T07 | 2 |
| P02-T12 | Security lane: sops+age setup + CI key; gitleaks (pre-commit + CI + nightly history), osv-scanner, pnpm audit, syft SBOM, license gate, Renovate, postinstall allowlist → `just security-scan` | P02-T01 | 1 |
| P02-T13 | Signed-URL skeleton: `StorageProvider` port + R2 adapter (presigned PUT/GET, TTL, namespace + content-type/size constraints) + `*.sec.test.ts` (expired/foreign-key rejects); R2 buckets per env; Cloudflare WAF in front of API | P02-T05 | 1 |
| P02-T14 | iOS/Android lanes: EAS free-tier profile **and** GHA macOS lane both building + signing; TestFlight upload from Linux via App Store Connect API; Android debug/release lane; `just mobile-*-build` | P02-T10 | 2 |
| P02-T15 | ADR-P02 (OQ-04): after ~2 weeks of dual-lane data (cost, flake rate — A5) decide EAS vs GHA; DEC entry; deactivate the losing lane's schedule (config retained as fallback per RISK-12) | P02-T14 | 1 |
| P02-T16 | Operating contract live: move CLAUDE.md `planning/` → repo root (paths activated, content per NFR-TEAM-090); `.agents/skills/` — 13 SKILL.md files per NFR-TEAM-100 with all six sections + overlap review; templates + CODEOWNERS (real handles) + PROGRESS.md at root | P02-T01 | 2 |
| P02-T17 | Assets scaffolding: `assets/3d` manifest schema (P01-ratified conventions, [07 §9](../07-3d-avatar-and-garment-pipeline.md)), Git LFS, `just assets-validate` (adopt P01 tooling), `just ml-eval` stub | P02-T04 (+P01 tooling when available) | 1 |
| P02-T18 | Close-out: `just ci-parity` green on two machines + CI; module-contract files complete; docs/PROGRESS/handoff; A4 (pnpm×EAS) outcome recorded | all | 1 |

## 13. Parallelization

- Can run in parallel (disjoint file sets, one worktree per agent per [15 §12.3](../15-team-workflow-and-ai-agent-operations.md)):
  - **Wave 1** (after T01): {T02}, {T03}, {T12}, {T16} — scripts/ vs packages/shared-kernel vs security config vs root docs/skills.
  - **Wave 2** (after T04): {T05→T06}, {T10}, {T17} — api vs mobile vs assets.
  - **Wave 3** (after T05/T07): {T08}, {T09 partially}, {T13} — trigger+worker vs observability vs platform storage (T09 finishes after T08's flow exists).
  - {T14} runs alongside Wave 3 once T10 exists; {T11} once T05/T06/T07 exist.
- Must be serial: T01 first (everything); T03→T04 (envelope before generators); T04 before T05/T10/T17 (producers before consumers); T07→T08→T09-completion; T14→T15 (data before ADR); T18 last. **Single-writer files:** `packages/contracts`, `shared-kernel`, lockfiles, `mise.toml`, `justfile`, CI workflows, CLAUDE.md — never two agents on these concurrently (CLAUDE.md parallel-sessions rule).

## 14. Test-first plan (by module and level)

Tooling per [13 §3](../13-testing-quality-and-performance.md); tests live in each owner's `tests/` directory; the *harnesses themselves* are P02 deliverables.

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `shared-kernel` | Vitest: ID prefixes, error codes, envelope helpers | fast-check: unit-converter round-trips (metric↔imperial within tolerance, no NaN) — first NFR-TST-020 suite | Envelope type ↔ `envelope.json` round-trip | — | — |
| `platform` | Relay batching/backoff logic; resilience utils | Retry-jitter bounds | `StorageProvider` port contract test (fake + R2 recorded fixtures) | **Outbox suite**: same idempotency key twice → one effect; injected failure → retry → DLQ; replay preserves idempotency (Testcontainers) | — |
| API (cross-module) | Controller mapping | — | Schema-conformance harness: every documented endpoint, auth flags, problem+json shape; `just generate --check` | Boot-in-process + Testcontainers; demo-flow trace assertion (correlation ID end-to-end) | — |
| Security suite | — | — | — | `*.sec.test.ts`: signed-URL constraints (expired, foreign namespace, wrong content-type), redaction canary (planted markers never reach sink) | — |
| Mobile | Jest/RNTL placeholder-screen + client-wiring tests | — | Generated-client round-trip vs contract | MSW-mocked health flow | Maestro smoke: app boots on emulator (CI) + one real device |
| Worker | pytest: schema validation | hypothesis: payload parsing invariants | Schemathesis vs worker OpenAPI; Pydantic ↔ contracts fixtures | Docker-composed round-trip from T08 | — |
| Migrations | — | — | Drizzle schema ↔ migration drift check | Forward + rollback on Neon branch with seeded data ([13 §9](../13-testing-quality-and-performance.md)) | — |

New bug fixes require a regression test that fails before the fix; the no-skip lint and quarantine lane (13 §1) are activated in this phase.

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | PR fast gate **< 10 min** wall clock (measured from day one); signed-URL mint p95 ≤ 100 ms; API health p95 ≤ 250 ms; mobile cold start ≤ 2.5 s mid-tier (first skeleton measurement per [13 §12](../13-testing-quality-and-performance.md)) | `ci.pr_gate_duration` metric; k6 smoke on staging; cold-start timer on one mid-tier device (archived trace) |
| Cost | Infra ≤ ~$35/mo launch envelope (Railway ~$15, Neon ~$10–15, R2/Trigger.dev/PostHog/Grafana free tiers); iOS lane ≤ $50/mo (A5 measurement decides ADR-P02) | Provider billing dashboards, screenshots archived monthly; lane cost sheet in ADR-P02 |
| AI quality | n/a this phase (eval harness stub `just ml-eval` exists, empty) | n/a |
| Reliability | Outbox: zero lost events across kill/retry tests; relay oldest-unprocessed age < 60 s in demo load; CI flake rate baseline recorded | Outbox test suite; `queue.job.age_oldest` panel; `ci.flake_rate` |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): flag *infrastructure* ships (PostHog, registry, expiry lint). One flag created: `demo-outbox-flow` (owner: BE lead, expiry: P03 start) used to demo flag rollback (NFR-OBS-080). No product flags yet.
- Migration/backward-compatibility plan: migrations 0001/0002 are greenfield; expand–contract policy ([06 §7](../06-data-api-and-event-contracts.md)) is enforced from the first migration (review checklist + Neon-branch test). Contract versioning starts at `/v1` additive-only.
- Rollback plan: infra is declarative/config-controlled — revert = git revert + redeploy via CI; `just db-rollback` proven against staging for both migrations; iOS lane rollback = the ADR-P02 losing lane retained as documented fallback (RISK-12); dashboard/alert config exported and version-controlled.

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); phase-local ones are added there, not here.

- Risks in play: **RISK-11** (managed-service lock-in — fallbacks documented per vendor as accounts are created), **RISK-12** (iOS-without-Mac — both lanes stood up, ADR-P02), **RISK-16** (capacity — P02 is the discipline machine itself). Assumptions under test: **A4** (pnpm × EAS build hooks), **A5** (lane cost/flake), **A11** partially (Trigger.dev free tier covers skeleton volume), **A12** setup (Neon cold-start measurement harness ready for P03).
- **Stop/kill criteria for this phase:**
  - A4 fails (pnpm monorepo cannot build via EAS after the documented build-hook workaround) → execute the recorded fallback: Yarn workspaces (tooling-local change, [05 §8](../05-technology-decisions.md)); log DEC. Do not fork the repo layout.
  - Both iOS lanes flake > 10% or exceed $50/mo at our cadence for 2 consecutive weeks → escalate per RISK-12 (second-provider activation; Mac rental is last resort, purchase stays vetoed by DEC-03).
  - PR fast gate cannot reach < 10 min after cache tuning → split tiers further (move suites to affected-tier) rather than weakening gates; a gate-weakening change requires an ADR.
  - P02 has no product kill switch — it can only complete, or block with named blockers in PROGRESS.md.

## 18. Demo script

Exact steps proving the vertical slice end-to-end on a real environment:

1. On a **clean Ubuntu VM**: `git clone … && just bootstrap` → follow printed steps → `just doctor` green.
2. `just ci-parity` → format-check, lint, typecheck, arch-check, generate --check, test, security-scan all green locally.
3. Introduce a forbidden import (`recommendation` → `avatar`) → `just arch-check` fails naming the rule; revert.
4. Edit the OpenAPI spec without regenerating → `just generate --check` fails; run `just generate`, diff shows only generated files; commit passes.
5. `just dev-api` + `curl /v1/health` → 200 with problem+json verified on a bad route; trigger the demo event → show one trace in Grafana spanning API → outbox → Trigger.dev task → Python worker, single correlation ID.
6. Kill the worker mid-task → retries visible → DLQ row + alert fires → runbook #4 linked from the alert.
7. Launch the mobile skeleton on a real device via dev-client: health round-trip on screen; force the test crash → symbolicated in PostHog.
8. Open a PR: fast gate completes < 10 min; merge; show `main` green.
9. Show the same commit built by the chosen iOS lane → TestFlight build appears; Android AAB from CI installs on device (an Ubuntu-only dev shipped both — NFR-TEAM-010).
10. Open root `CLAUDE.md`, `.agents/skills/` (13 skills), `docs/modules/` (15 contracts), PROGRESS.md at root.

## 19. Acceptance criteria

Objectively verifiable statements — no "works well".

- AC-1: fresh-Ubuntu bring-up recorded: `just bootstrap && just doctor && just ci-parity` all exit 0 on a machine that had none of the toolchain (terminal transcript archived); `just --list` shows every recipe named in [15 §5](../15-team-workflow-and-ai-agent-operations.md); PR fast gate measured < 10 min on ≥ 3 consecutive PRs (`ci.pr_gate_duration` panel screenshot).
- AC-2: `just generate --check` passes on clean tree and **fails** when the spec is edited without regeneration (both runs pasted); spectral + oasdiff gates active in CI; generated TS client, event types, and Pydantic models all consumed by compiling code.
- AC-3: `just arch-check` passes on the skeleton and fails on each fixture violation: cross-module internal import, `recommendation→avatar`, provider SDK in a domain module, `assistant→internal`, a `utils/` directory, a `prototype/` import (six red runs pasted); all 15 module-contract files exist in `docs/modules/`.
- AC-4: repo lint proves test placement (a stray `*.test.ts` beside source fails), no-skip rule (a skip without issue ID fails), and file-size threshold warnings — one failing fixture run pasted per rule.
- AC-5: outbox suite green: duplicate idempotency key → exactly one effect; injected failure → ≤ configured retries → DLQ row + `queue.job.dlq` metric + alert; replay of a dispatched event produces no second effect; `just db-migrate` + `just db-rollback` proven on a Neon branch (output pasted). REQ-MED-090/110 mechanism delivered.
- AC-6: one demo-flow trace shows API → outbox → task → worker under a single correlation ID (Grafana link); redaction canary test green and the forbidden-field lint fails a fixture that logs a marker token; dashboard 1 live with owners; forced crashes on iOS + Android symbolicated in PostHog; analytics CI check rejects an unknown event fixture; flag `demo-outbox-flow` rollback demoed (before/after behavior shown).
- AC-7: `just security-scan` green; gitleaks blocks a planted fake secret in pre-commit and CI (red run pasted, secret synthetic); SBOM artifact produced; `.env.example` keys ⊇ config-schema keys (CI check); secrets exist only in sops files + platform stores (repo grep for known key patterns clean); signed-URL `*.sec.test.ts` suite green including expired-URL and foreign-namespace rejections.
- AC-8: **ADR-P02 exists** with two weeks of dual-lane data (builds, cost, flake rate) and a decision (OQ-04 → DEC entry); TestFlight build uploaded from a Linux-runner step; Android AAB built + signed in CI; both installed on physical devices from CI artifacts of the same commit.
- AC-9: root `CLAUDE.md` contains every NFR-TEAM-090 rule (checklist cross-walk in PR); `.agents/skills/` has ≥ 13 SKILL.md files covering every NFR-TEAM-100 area, each with all six sections (scripted section check) + overlap-review note; templates + CODEOWNERS (real handles) + PROGRESS.md live at root; duplication/clone check runs in CI (NFR-TEAM-040).

## 20. Definition of done

Exact commands and evidence required:

```bash
just ci-parity          # full PR-gate sequence green locally AND in CI on main
just test               # all module suites pass, no skips
just lint && just typecheck && just arch-check   # clean
just generate --check   # contracts fresh
just security-scan      # gitleaks + osv + audit + license green
just db-migrate && just db-rollback   # proven on Neon branch (staging)
just doctor             # green on 2 developer machines + the clean VM
# + iOS lane: TestFlight build id, Android AAB artifact, ADR-P02 merged
```

Evidence to attach/link: clean-VM transcript, CI run links (all four tiers having executed at least once), Grafana dashboard + trace links, PostHog crash screenshots, lane cost sheet, red-run pastes for every negative test in §19 — never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: `docs/modules/*` (15 new contracts), `docs/adr/` (ADR-P02, ADR-OBS-01, migrated P00 ADR set), root CLAUDE.md + skills (new), [doc 16](../16-risks-open-questions-and-decision-log.md) (OQ-04 → DEC, A4/A5 outcomes, vendor-fallback notes), [doc 15](../15-team-workflow-and-ai-agent-operations.md) (any command-catalog deltas discovered), [doc 14](../14-observability-operations-and-analytics.md) (dashboard/runbook links), [doc 13](../13-testing-quality-and-performance.md) (measured PR-gate + cold-start baselines).
- [PROGRESS.md](../PROGRESS.md): moves to repo root as the live ledger; set status per its rules; `DONE` only with §20 evidence.

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md).

Next session starts: **P03-T01** (identity module: better-auth integration) once P02 is `ACCEPTED`. First commands: `just doctor && just ci-parity` (must be green before any P03 work), then read `phases/P03-identity-consent-onboarding.md` + the `identity`, `profile`, `billing` module contracts. Carry forward: LR-02/03/04/07/09 status from P00 (they gate P03 **exit**, not entry — verify counsel timeline immediately); Sentry-vs-PostHog crash decision is due **end of P03** ([14 §1](../14-observability-operations-and-analytics.md)).
