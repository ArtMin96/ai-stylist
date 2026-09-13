# 13 — Testing, Quality, and Performance

**Status:** Draft for ratification · **Date:** 2026-08-24 · **Conforms to:** [SPINE.md](SPINE.md) · **Amended:** 2026-09-13 ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — pg-boss job tests, pgBackRest restore drills, Coolify staging load tests, `date-holidays`)
**Owns:** test organization rules, per-subsystem test pyramid + tooling, quality rules (regression-first, no-skip, flaky policy), CI tiers, security test suite, AI/ML evaluation strategy, recommendation simulations, performance budget table, load testing, device matrix.
**Requirement IDs delivered:** `NFR-TST-*`, `NFR-PERF-*` (defined in [01-requirements-and-traceability.md](01-requirements-and-traceability.md)).
**Referenced by:** every phase file (each phase's "test-first plan" and "budgets" sections cite this doc); [11-security-privacy-and-compliance.md](11-security-privacy-and-compliance.md) (security tests §8); [14-observability-operations-and-analytics.md](14-observability-operations-and-analytics.md) (error budgets §12); [10-ai-usage-cost-and-evaluation.md](10-ai-usage-cost-and-evaluation.md) (eval datasets, cost gates).

---

## 1. Non-negotiable quality rules

1. **Regression tests fail first.** Every bug fix ships with a test that demonstrably failed before the fix (the failing run is linked or pasted in the PR). "Trust me it would have failed" does not count.
2. **No skipped tests to make CI green.** `it.skip`/`xit`/`@pytest.mark.skip` without an attached issue ID fails the lint. A skip with an issue is a quarantine (rule 3), not a fix.
3. **Flaky tests are defects.** A test that fails intermittently is quarantined (moved to the quarantine lane, still runs nightly, excluded from PR gate) with an **owner and a deadline (≤ 2 weeks)** recorded in the tracker. Silent auto-retry-forever is forbidden; PR-gate retries are capped at 1 and every retry is logged as a flake event (14 §4 metric `ci.flake_rate`).
4. **Tests assert observable behavior, not implementation call shapes.** Mock at module/port boundaries only (the ports defined in [04-architecture.md](04-architecture.md)); never mock a module's own internals. Prefer fakes/testcontainers over mocks for adapters.
5. **No fabricated results.** Performance numbers, device results, and eval metrics come from actual runs with stored artifacts (see §12, §6). Budgets stay labeled "hypothesis" until measured.
6. **Privacy-safe fixtures.** No real user data, real faces, or real measurements in fixtures/datasets. Synthetic or explicitly consented data only ([11 §6](11-security-privacy-and-compliance.md)); eval datasets are versioned and consent-safe (§10, doc 10).
7. **Coverage is a signal, not a gate-game.** Per-module line coverage is reported; the enforced gate is on the **domain packages** (recommendation, closet taxonomy, billing entitlement logic ≥ 90% branch), not on UI glue.

## 2. Test organization

- **Every module owns a `tests/` directory** next to its source: `apps/api/src/modules/<name>/tests/`, `apps/mobile/src/features/<name>/tests/`, `workers/<name>/tests/`, `packages/<name>/tests/`. **No test files scattered in production directories** — no `*.test.ts` beside source files.
- **Test-support packages, not copy-paste fixtures.** Each module exposes `tests/support/` (builders, factories, fakes) importable by its own tests and — via the module's public test-support export — by other modules' integration tests. Shared cross-cutting builders (users, consents, entitlements) live in `packages/test-support`. Duplicating a builder instead of importing it fails review (semantic-reuse rule, [15-team-workflow-and-ai-agent-operations.md](15-team-workflow-and-ai-agent-operations.md)).
- **Documented framework exceptions:**
  - *React Native / Jest*: Jest discovers via config, not location, so the `tests/` rule holds. Maestro E2E flows live in `apps/mobile/e2e/` (device-level, not module-owned) — documented exception #1.
  - *Detox/native build test harness files* if ever needed: same `e2e/` home — covered by exception #1.
  - *Drizzle migration tests* run against the composed schema and live in `apps/api/tests/migrations/` (app-level, since migrations cross modules) — documented exception #2.
  - No other exceptions. Adding one requires a decision-log entry.
- **Naming:** `*.test.ts` (unit/integration), `*.contract.test.ts`, `*.pbt.test.ts` (property-based), `*.sec.test.ts` (security suite), `*_test.py` (workers). CI lanes select by suffix + path.

## 3. Test pyramid per subsystem (tooling is binding)

| Subsystem | Unit | Property-based | Contract | Integration | E2E / device |
|---|---|---|---|---|---|
| **Backend domain modules** (NestJS) | **Vitest** — pure domain rules, state machines, scoring, normalization; no DI container needed for pure logic | **fast-check** — see §4 | OpenAPI-generated contract tests — see §5 | **Testcontainers** (Postgres w/ pgvector) for repositories/adapters; outbox + event tests | via API-level E2E in nightly (Testcontainers + real HTTP) |
| **Mobile app** (RN/Expo) | **Jest + React Native Testing Library** — components, hooks, view-models | fast-check for shared logic packages | consumes generated client; contract drift caught in §5 | RNTL integration (navigation flows w/ mocked network via MSW) | **Maestro** flows on device/emulator (§7); golden renders (§6) |
| **ML/media workers** (Python FastAPI) | **pytest** — pure functions, schema validation (Pydantic) | **hypothesis** — parsing/geometry invariants | Schemathesis against worker OpenAPI; versioned JSON schema round-trip tests vs `packages/contracts` | pytest + Testcontainers (Postgres) where workers touch state; golden-file pipeline tests on fixture images | eval suites (§10) on nightly GPU lane |
| **Jobs/pipelines** (pg-boss) | handler logic extracted to pure functions → Vitest | — | payload schemas from `packages/contracts` | **Idempotency/retry/DLQ suite** (the P02-T08 acceptance suite that gates pg-boss vs the self-hosted Trigger.dev fallback, DEC-41): run job twice with same singleton key → one effect; inject failure at each step → retry then DLQ; resume-after-crash replays safely; cancellation mid-pipeline leaves no orphan asset (media state machine, doc 07) | pipeline E2E on staging nightly |
| **Recommendation engine** | Vitest on rules/scoring/tie-breaks | ranking + constraint invariants (§4) | recommendation result schema contract | simulations (§11) with seeded closets | latency measured in §12 budgets |
| **3D/avatar/garments** | param-mapping math (Vitest) | morph-bound invariants (§4) | asset-manifest schema tests | asset validation CLI on every committed asset (formats per SPINE) | **golden/visual regression** (§6) + device perf (§7) |
| **Billing/entitlements** | Vitest on entitlement logic | metering arithmetic invariants | RevenueCat webhook payload contracts (recorded fixtures) | webhook idempotency/replay (also in security suite §8); reconciliation-drift tests | purchase/restore E2E on store sandbox (P13) |

## 4. Property-based testing (fast-check / hypothesis) — required invariant sets

- **Units & conversions** (`shared-kernel`): metric↔imperial round-trips within tolerance; no negative/NaN escapes; locale formatting round-trips.
- **Measurements**: validation accepts the full plausible human range and rejects implausible values symmetrically; measurement→morph mapping stays within rig bounds for *any* valid input (doc 07 owns the bounds).
- **Taxonomy** (doc 08): every item maps to exactly one canonical category; attribute normalization is idempotent (`normalize(normalize(x)) = normalize(x)`); no orphan subcategory.
- **Ranking invariants** (doc 09): determinism — same inputs + same rule/model version ⇒ identical ordering; hard-constraint dominance — no candidate violating a hard constraint ever outranks a valid one (stronger: never appears); tie-break totality — scoring never returns an ambiguous order; monotonicity — worsening a candidate's soft score never improves its rank.
- **Constraint combinations**: arbitrary sets of hard constraints never produce a violating outfit; conflicting soft preferences degrade gracefully to a ranked result or an explicit "no valid outfit" (never a crash or a silent violation).

## 5. Contract tests (generated from OpenAPI)

- `packages/contracts` owns OpenAPI 3.1 (SPINE). CI regenerates the TS client + types and **fails on diff** (stale-generation gate, brief §5.5).
- Backend: schema-conformance tests generated from the spec (Schemathesis or Vitest harness) run against the app booted in-process — every documented endpoint, auth required where declared, error envelope shape verified.
- Mobile: builds only against the generated client; a spec-version handshake test verifies additive-only changes within a major version (versioning policy owned by [06-data-api-and-event-contracts.md](06-data-api-and-event-contracts.md)).
- Events: outbox event payloads validate against versioned event schemas in `packages/contracts`; a replay test feeds each recorded historical version to current consumers (doc 06 replay/versioning policy).
- Provider ports: recorded-fixture contract tests per provider (Open-Meteo, RevenueCat webhooks, fal.ai job callbacks) so a provider format change breaks a test, not production. `date-holidays` is an embedded library with no network call: its tests are per-country-year fixture cross-checks against the hosted Nager.Date API (P08), not contract tests.

## 6. Golden / visual regression (avatar poses + garment rendering)

- **What:** screenshot-diff suite rendering a fixed matrix — base meshes × representative morph presets (min/mid/max + 6 diverse body presets) × 4 poses × 2 camera angles; garment overlays (G0 collage compositions; G2 sample outputs are eval-gated in §10 instead, since generative output isn't pixel-stable).
- **How:** deterministic render harness (fixed seed, fixed lighting, fixed viewport) on the Filament pipeline; screenshots diffed with a perceptual metric (SSIM/pixelmatch with anti-aliasing tolerance); baselines stored in LFS/artifact store, updated only via an explicit `just golden-accept` commit that names the visual change in the PR.
- **Where:** emulator-based render lane nightly; a 3-config smoke subset on PR when `avatar`/`outfit`/asset files change (affected-module rule §13). Real-device render spot-checks in the pre-release tier.
- Also golden-tested: color-calibration output (known color-card fixture images → expected palette extraction, doc 08) and key UI states (empty/error/loading screens via RNTL snapshot images — kept small and intentional).

## 7. Mobile E2E and real-device performance

- **Maestro** flows (CI on emulators/simulators; nightly on a device farm) covering: onboarding incl. consent choices; profile/measurement entry with unit switching; closet single + batch capture (camera mocked in emulator, real on device); recommendation request → explanation → feedback; purchase/restore (store sandbox, P13); account export + deletion; degraded-provider behavior (weather down → cached context warning, doc 09).
- **Device tiers** (representative matrix — hypothesis, revisit yearly; final selection is a P01 output):

| Tier | Android | iOS | Rationale |
|---|---|---|---|
| Low | Samsung Galaxy A16 / Moto G-class (4 GB RAM, Mali/Adreno low) | iPhone SE 3rd gen / iPhone 11 | 3D floor, memory floor |
| Mid | Pixel 8a / Galaxy A56 | iPhone 14 / 15 | volume segment |
| High | Pixel 10 Pro / Galaxy S25 | iPhone 16/17 Pro | headroom + thermal ceiling |

- **Runner:** EAS Build artifacts driven on a device farm for the nightly perf lane; local devices for P01 prototype measurements. Performance runs collect the §12 metrics with stored raw traces (no summarizing by hand — rule 5 in §1).
- **Accessibility:** automated — RNTL a11y queries (labels/roles on every interactive element), contrast lint on the design tokens, touch-target size lint; **manual checklist per release** (owned here, executed in P14 and every release after): VoiceOver + TalkBack full pass of the five core journeys, dynamic type at max, reduced motion honored (esp. 3D viewer), color-blind review of color-coded closet views, keyboard/switch-access smoke. The 3D avatar screen must have a non-3D accessible alternative (brief §2.3) — its presence is an automated check.

## 8. Security test suite (`*.sec.test.ts`, verifies [doc 11](11-security-privacy-and-compliance.md))

### 8.1 Automated (PR/affected + full run nightly)
- **AuthZ matrix / user isolation:** generated test that walks every OpenAPI endpoint × {anonymous, user A, user B, support, moderator, engineer-oncall} asserting the expected allow/deny; user B must never read/write user A's rows or media (11 §4.3). New endpoints without a matrix entry fail CI.
- **Signed uploads/reads:** presigned PUT constrained to own namespace/content-type/size; expired URL rejected; user A's signed URL minted then account deleted → URL dead; URL for A's object never mintable by B (11 §5.4).
- **Webhook replay:** RevenueCat (and any provider) webhook with valid signature replayed → exactly-once effect; tampered signature rejected; out-of-order events reconcile (11 §3.4).
- **Rate limits:** each limit in 11 §14 has a test driving it over threshold → structured 429 + metric emitted; limits are per-user not global (user B unaffected by A's storm).
- **Deletion:** seeded account with data in every module + R2 objects + PostHog stub → run cascade → assert zero rows/objects/analytics-links remain except the documented retained set (11 §13.2); deletion is idempotent and resumable mid-cascade.
- **Redaction canary:** marker values planted in every forbidden-field category (11 §8) flow through real request paths → assert absent from captured log sink; forbidden-field lint (14 §2) runs as a CI check.
- **Upload hostile-file corpus:** polyglots, decompression bombs, wrong magic bytes, oversized dimensions → all land in quarantine, never in downstream states (11 §5.5).
- Dependency/secret scanning and SBOM gates are CI-level, owned by doc 15.
- **Consent gating:** calls requiring `face_processing`/`ai_generative`/`analytics` consent fail closed without a granted record; withdrawal halts the pipeline mid-flight (11 §7).

### 8.2 Manual / periodic
P14: external penetration test (or structured internal one if budget-blocked, recorded as risk); secret-rotation drill (11 §5.3); social-engineering tabletop for the recovery flow (11 §15). Annually thereafter.

## 9. Migration, backup, and restore tests

- Every Drizzle migration: forward-apply on a Testcontainers snapshot of the previous schema seeded with representative data; rollback (or documented irreversibility + expand/contract plan per doc 06 policy); data-preservation assertions for destructive changes.
- **Restore drills** (cadence + runbook owned by 14 §13, verification owned here): quarterly — restore a pgBackRest PITR point to a scratch database (14 §13), run the full migration test suite + row-count/invariant checks against it; restore R2 sample set and verify asset manifests resolve. A drill that has not run in > 1 quarter is a red release-gate item.
- Backup of the deletion guarantee: post-restore re-deletion replay test (11 §13.3).

## 10. AI/ML evaluation suites (gates defined here; datasets & metrics detail in [doc 10](10-ai-usage-cost-and-evaluation.md))

- **Datasets:** versioned, consent-safe (synthetic, licensed, or explicit-opt-in only — 11 §6), stored in the eval artifact store with dataset cards (source, license, version, known gaps). No scraped personal photos.
- **Slices:** every vision/generative eval reports per-slice metrics across skin tone (e.g., Monk scale buckets), body shape/size presets, and garment categories; a model change that regresses any slice > threshold fails the gate even if the aggregate improves. Slice definitions avoid inferring protected traits from real users — slices come from dataset labels, not user data (11 §17.4).
- **Suites & gates** (thresholds are hypotheses set in each capability's phase, then ratcheted):
  - Segmentation/background removal: IoU vs golden masks; failure-rate by garment type.
  - Classification/attributes: precision/recall per category vs labeled set; **user-correction rate in production is the online metric** (14 §4).
  - Dedup/embeddings: precision@k on known duplicate pairs.
  - Missing-view synthesis & G2 try-on: human-rated rubric sample + automated checks — provenance marker present, garment color/pattern fidelity (ΔE bound), no anatomy alterations (body shape must match avatar params), **hallucination/invalid-output checks** (output must contain exactly the input garment; reject-and-fallback on failure).
  - Explanation text (templates from reason codes, DEC-46 — no LLM polish): faithfulness — every sentence maps to an engine reason code (no invented reasons — SPINE honesty rules); ethics blocklist from 11 §17 (no body commentary).
  - **Cost/latency regression gates:** each AI call type has a per-call cost + p95 latency budget (anchors from [r3](research/r3-ai-providers-costs.md), owned by doc 10); nightly eval runs fail if a model/prompt change exceeds budget.
- Every eval run records model id, prompt/template version, dataset version, and git SHA — reproducible per SPINE §3.1 (brief) requirements.

## 11. Recommendation simulations (zero hard-constraint violations)

Nightly simulation harness (also PR-gated when `recommendation`/`context` change): generate N≥10,000 scenarios = seeded closets (sparse 3-item → 500-item; skewed categories; all-in-laundry) × context grids (temperature −30…45 °C, precipitation, wind; holidays; occasions; dress codes; future-day forecasts) × preference profiles (incl. contradictory ones).

**Hard assertions (any failure blocks merge):**
- Zero hard-constraint violations — including the canonical **cold-weather-holiday case**: holiday context must never produce shorts/summer-wear below the safety temperature threshold (brief §2.6).
- Unavailable/laundry/packed/lent/repair/archived items never appear (availability states per SPINE §8).
- Determinism: identical scenario + engine version ⇒ identical result; "show me something different" still satisfies all hard constraints.
- No-valid-outfit scenarios return the explicit structured response (never a padded invalid outfit).
- Every result carries reason codes from the registry and a reproducible engine version.

**Tracked (non-blocking) metrics:** diversity, repetition rate, sparse-closet success rate, latency distribution — reported to 14 §6 dashboards; targets set in doc 09.

## 12. Performance budgets (ALL values are hypotheses → measured at the phase noted, then ratified or revised in the decision log; brief §3.7)

Measurement rules: real devices per §7 matrix, cold vs warm distinguished, raw traces archived, p50/p95 reported. "Budget" = release-gate threshold once ratified.

### 12.1 Mobile

| Metric | Low tier | Mid tier | High tier | Status |
|---|---|---|---|---|
| Cold start → interactive home | ≤ 4.0 s | ≤ 2.5 s | ≤ 1.8 s | hypothesis → measure P02 (skeleton), gate P14 |
| Warm start | ≤ 1.5 s | ≤ 1.0 s | ≤ 0.7 s | hypothesis → P02/P14 |
| Interaction response (tap → feedback) | ≤ 100 ms | ≤ 100 ms | ≤ 100 ms | hypothesis → P02 |
| Recommendation request → results rendered (warm context) | ≤ 3.5 s | ≤ 2.5 s | ≤ 2.0 s | hypothesis → P09 |
| Camera capture → item visible in catalog (processing async; this is capture→queued+thumbnail) | ≤ 6 s | ≤ 4 s | ≤ 3 s | hypothesis → P06 |
| Full item processing (upload→classified, server-side, p95) | ≤ 60 s | — | — | hypothesis → P06 |
| 3D first render (avatar visible) | ≤ 5 s | ≤ 3 s | ≤ 2 s | hypothesis → **P01 prototype gate** |
| 3D viewer frame rate (rotate/pose-switch) | ≥ 30 fps | ≥ 60 fps | ≥ 60 fps | hypothesis → **P01 gate** (P01 go/no-go thresholds are doc 05 §2.3: 60 fps iPhone 13-class / 50 fps Galaxy A52-class, < 50 ms touch, < 100 MB prototype package, < 300 MB prototype memory; the full-app budgets in this table apply from P04 onward) |
| App memory (3D screen, RSS) | ≤ 700 MB | ≤ 900 MB | ≤ 1.2 GB | hypothesis → P01/P04 |
| GPU memory (avatar + outfit) | ≤ 250 MB | ≤ 400 MB | ≤ 600 MB | hypothesis → P01/P04 |
| App download size (store) | ≤ 150 MB target, 200 MB hard cap | same | same | hypothesis → P02, gate P14 |
| Battery: 10-min 3D session drain | ≤ 4% | ≤ 3% | ≤ 3% | hypothesis → P04 device lane |
| Thermal: no sustained throttle in 10-min 3D session | required | required | required | measure P01/P04 |
| Offline: closet browse + capture queue works with no network | required (functional, not a number) | — | — | verified from P07 |

### 12.2 Backend & pipeline

| Metric | Budget | Status |
|---|---|---|
| API latency p50 / p95 / p99 (CRUD reads) | 80 / 250 / 600 ms | hypothesis → P03 |
| Recommendation endpoint p50 / p95 (200-item closet) | 400 ms / 1.5 s | hypothesis → P09 (candidate-gen strategy in doc 09) |
| Availability (API, monthly) | ≥ 99.5% (error budget 3.6 h/mo — 14 §12) | hypothesis → P14 ratification |
| Queue: job pickup latency p95 | ≤ 30 s | hypothesis → P06 |
| Queue: media pipeline completion p95 | ≤ 60 s (single item), ≤ 15 min (50-item batch) | hypothesis → P06 |
| Job max age before alert (oldest unfinished) | 15 min | hypothesis → P06 (alert in 14 §7) |
| Webhook processing p95 | ≤ 5 s | hypothesis → P13 |
| Signed URL mint p95 | ≤ 100 ms | hypothesis → P02 |
| 5xx error rate | ≤ 0.5% of requests (part of error budget, 14 §12) | hypothesis → P03 |
| Custom-domain asset cache hit rate (public delivery assets) | ≥ 90% | hypothesis → P04 |

AI per-call cost/latency budgets live in doc 10 (owned there; gated here via §10). Cost-per-active-user guardrails live in doc 12; the alert lives in 14 §7.

### 12.3 Load testing
- Tooling: k6 against the staging environment on Coolify with a scratch database restored from the latest staging backup (doc 15). Profiles: steady (5k-user launch model from [r4](research/r4-backend-providers.md)), morning spike (recommendation burst 8–9 am local), onboarding burst (new-user batch capture: 50 uploads/user), webhook storm (RevenueCat replay).
- Run: before P09, P13, and P14 gates; then before any launch-scale change. Pass = budgets in §12.2 hold at target load with bounded queues (no unbounded growth) and graceful backpressure (429s, not timeouts).

## 13. CI tiers

| Tier | Trigger | Contents | Budget |
|---|---|---|---|
| **PR fast gate** | every PR | lint (+ no-skip, forbidden-field, a11y, boundary/dep-cruiser checks), typecheck, unit + pbt (affected), contract tests, sec suite (affected), stale-generation check | **< 10 min wall clock** |
| **Affected-module** | PR touching matched paths | module integration (Testcontainers), golden smoke (3D paths), simulation subset (recommendation/context paths), migration tests (schema paths) | < 25 min |
| **Nightly** | schedule | full integration, full simulations (§11), golden full matrix (§6), Maestro on emulators + device-farm run, ML eval suites w/ cost/latency gates (§10), load smoke, quarantined-flaky lane, full sec suite |—|
| **Pre-release qualification** | release branch | everything nightly + device matrix perf runs (§12.1 evidence), store-build checks (size gate), accessibility manual checklist sign-off, restore-drill freshness check (§9), release-gate checklist in doc 15 |—|

Turborepo remote caching + affected-graph selection keeps the PR gate under budget; the 10-min budget is itself a monitored metric (`ci.pr_gate_duration`, 14 §4).

---

**Phase hooks:** P01 owns the first real 3D measurements (§12.1 gate). P02 stands up all CI tiers, the sec-suite skeleton, and the perf-measurement harness. Every subsequent phase adds its module's tests per §3 and measures the budgets marked with its phase ID. P14 ratifies budgets, runs manual a11y + pen-test + drills, and converts remaining hypotheses to gates.
