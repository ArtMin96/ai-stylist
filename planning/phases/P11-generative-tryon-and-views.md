# P11 — Generative Try-On and Views

> Amended 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — service consolidation: pg-boss jobs, owned server + Coolify, self-managed PostgreSQL, R2 delivery model).

> File name per [SPINE §5](../SPINE.md). Template: [templates/phase.md](../templates/phase.md). Status values per [PROGRESS.md](../PROGRESS.md). Capability design owned by [07-3d-avatar-and-garment-pipeline.md](../07-3d-avatar-and-garment-pipeline.md) §6–§7; AI specs/costs by [10-ai-usage-cost-and-evaluation.md](../10-ai-usage-cost-and-evaluation.md) §2.4–§2.5; on conflict, those docs win.

## 1. Overview

- **Phase:** P11 — Generative try-on and views
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Ship G2 generative photo try-on and missing-view synthesis via fal.ai behind an owned provider port — with an eval + cost gate that must pass **before** either feature is enabled, provenance markers and confidence on every generated pixel, the real-view-supremacy rules, a user replacement flow, and the credit-metering seam (flag-gated, dormant until P13).
- **User-visible outcome:** An entitled user can generate a photorealistic AI try-on preview of a recommended outfit (on their consented photo or avatar render) and generate back/side views of items they only photographed from the front — every generated image visibly badged as AI-generated with a confidence indicator, replaceable by a real photo at any time.
- **Why now:** P06 delivered the capture pipeline, lineage, and `garment_representations`; P10 delivered the `OutfitPresentation` contract with `provenance`/`confidence` plumbing already exercised. G2 slots into both without touching the engine. It is the MVP premium capability (SPINE §4: MVP = A1 + G0 + G2) and the phase RISK-02 named as the eval + cost gate.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only. *(partial)* = P11 slice of a multi-phase requirement.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-CAP-070 | AI synthesizes ONLY views the user did not supply; real captured views never replaced | AC-3 |
| REQ-CAP-080 | Provenance marker + confidence on every generated view, in UI and metadata | AC-4 |
| REQ-CAP-090 | User can replace a generated view with a real photo, which supersedes it everywhere | AC-5 |
| REQ-CAP-100 | Clear separation of representation levels G0–G4 *(partial — P06 set the ladder; P11 adds G2 records without conflation)* | AC-4 |
| REQ-CAP-140 | Uncertain capabilities behind R&D spikes with success + kill criteria; product valuable without them | AC-1, AC-2 |
| REQ-MED-070 | Full lineage original↔generated↔corrected↔superseded *(partial — P06 built lineage; P11 adds `generated` and `superseded` edges for G2/views)* | AC-3, AC-5 |
| REQ-MED-080 | Reprocessing never destroys user corrections *(partial — P11 extends the guarantee to generated-view supersession and regeneration)* | AC-5 |
| NFR-AIC-100 | Research bets specified with hypothesis/dataset/metric/cost limit/kill decision *(P11 slice: SPK-2 executed; G2 gate per RISK-02)* | AC-1, AC-2 |
| NFR-AIC-020 | Per-feature AI spec: contract, port, thresholds, eval, latency + cost budget *(P11 slice: doc 10 §2.4–2.5 implemented as specified)* | AC-1, AC-6 |
| NFR-AIC-040 | Small/specialized models before large general ones *(P11 slice: task-specific VTON/Flux-class model ladder per doc 10 §2.4–2.5; explanation templates P09)* | AC-1, AC-2 |
| NFR-TST-090 | AI eval suites: versioned consent-safe datasets, slices, hallucination checks, cost/latency gates *(P11 slice: try-on + missing-view suites)* | AC-1, AC-2 |
| REQ-BIL-130 | Entitlement seams built in before P13 activates billing *(P11 slice: `tryon.generative`, `views.missing_view`, `credits.monthly` checks + ledger consume/refund, flag-gated dormant)* | AC-7 |

Consumed, not delivered: REQ-BIL-090 metering semantics (P13 activates; doc 12 §4 owns), REQ-REC-180 presentation (P10), NFR-AIC-030 hash-before-spend (P06 machinery, reused), NFR-AIC-070 provider data policy (gate item AIC-O2 below).

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P06** (media pipeline, lineage, content-hash caching, `garment_representations`), **P10** (`OutfitPresentation`, provenance/confidence rendering, fallback chain) — per SPINE §5.
- External blockers: **AIC-O2 — fal.ai privacy/DPA review for user photos** (doc 10 §7; pre-work from P00 legal discovery) must pass before any user photo leaves our infrastructure; photo-based G2 is blocked on it (avatar-render-based G2 and missing-view synthesis of garment photos may proceed under the standard closet-processing review). fal.ai account + spend limits provisioned.

## 4. In scope / out of scope

**In scope:** `ImageGenPort` in `platform` with the fal.ai adapter (Flux/VTON-class) + Replicate batch fallback adapter (DEC-28) + a self-hosted FASHN VTON v1.5 (Apache-2.0) adapter as a G2 eval arm (DEC-47); pg-boss generation jobs (idempotent, content-hash-keyed per NFR-AIC-030); missing-view synthesis per doc 07 §7 rules (only-never-captured views, quality auto-checks, discard+refund on failure); G2 try-on per doc 10 §2.5 (consented user photo or avatar render + garment cutouts, face-region-untouched check); **the eval gate**: SPK-2 missing-view eval + G2 try-on eval on versioned consent-safe datasets with demographic/body-shape slices, run and passed **before** either flag turns on; provenance marker + confidence stored in metadata and rendered as UI badges (through P10's contract); replacement flow (real photo supersedes generated, dependents invalidated); generated-views-never-feed-extraction rule; credit seam: entitlement checks + `credit_ledger` consume/refund calls wired but **flag-gated dormant until P13** (no user is charged credits before billing activates; during P11 beta the meter records usage in shadow mode); degradation ladder rungs 5–6 (doc 10 §6.3); cost telemetry per image.

**Out of scope / non-goals:** G3 template garments (SPK-3, later, gated) and G4 cloth sim (SPK-4, research bet); G1 2.5D overlay; charging real credits or paywall UI (P13); the server-side face-reconstruction path (doc 07 §5.2 — separate future gate); generating avatar faces or altering body shape/anatomy (eval hard-fails this); training any model; batch backfill generation campaigns (explicit user action only).

## 5. Product/UX behavior

Journey anchors: [02 §6](../02-user-journeys-and-information-architecture.md) (AI-completed missing views), [02 §13](../02-user-journeys-and-information-architecture.md) (provenance announced).

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| G2 try-on (from outfit presentation) | "See it on you" action (entitled + gated): pick consented base photo or avatar render → job runs (progress state, p95 < 15 s) → try-on image with **AI-generated badge + confidence**, labeled "a visualization, not a fit guarantee" | No consented base photo → explain + offer avatar-render mode or photo consent flow; never silently uses a photo | Auto-check failure → not shown, credit not consumed (shadow mode: not recorded), "couldn't generate a good preview" + G0 remains; provider down → feature "temporarily unavailable" (rung 6), G0 fallback | Action disabled offline with explanation; previously generated images cached and viewable | Badge announced ("AI-generated preview"); alt text from structured outfit data; result never auto-replaces the collage view |
| Missing-view generation (item detail) | "Generate back view" on items lacking that view (entitled) → generated view appears in the views strip with provenance badge + confidence; keep/discard prompt | Item already has a real back photo → **control absent entirely** (REQ-CAP-070 — offer retake instead if blurry) | Auto-check fail → auto-retry once → discard + refund (shadow), honest message; provider down → rung 5 pause | Disabled offline | Views strip labels each view real vs generated; discard/keep buttons labeled |
| Replacement flow | User captures a real back photo later → generated view moves to `superseded`, real photo becomes canonical everywhere immediately; dependents invalidated and requeued | — | Upload failure → standard P06 retry queue | Queued via P06 offline upload | Supersession change announced; history visible in item detail |
| Credit seam (shadow until P13) | Entitled actions check `tryon.generative` / `views.missing_view` / `credits.monthly`; in P11 beta the flags grant internal testers; ledger writes shadow entries | Not entitled → typed `ENTITLEMENT_REQUIRED` rendered as informational card (paywall UI is P13) | Double-submit → idempotency key = job id, single ledger entry | — | Entitlement states explained in plain language |

## 6. Domain and architecture changes (by owning module)

| Module | Change | Contract update needed? |
|---|---|---|
| `platform` | **`ImageGenPort`** + fal.ai adapter + Replicate batch-fallback adapter + self-hosted FASHN VTON v1.5 adapter (eval arm, DEC-47); provider config flags; spend telemetry | Yes |
| `media` | Generation job orchestration (pg-boss): synthesis + try-on tasks with idempotency (`hash + task + model_version`), auto quality checks, lineage rows (`generated`, `supersededBy`), invalidation of dependents on supersession; enforcement that generated views never enter extraction/embedding inputs | Yes |
| `outfit` | G2 records in `garment_representations`; `OutfitPresentation` slots may now resolve `level: "G2"` assets (additive within v1, fallback chain unchanged) | Yes (minor) |
| `billing` | Entitlement checks at job-enqueue (doc 12 §3.3) + `credit_ledger` consume/refund calls in the job-acceptance transaction — **shadow mode behind flags until P13** | Yes (seam only) |
| `shared-kernel` | Provenance/confidence field constants shared since P06/P10 — add generation-failure reason enums, credit-meter names referenced from the doc 12 registry | Yes (single-writer, first) |
| `identity` | `ai_generative` consent scope for user-photo try-on (photo leaves our infra → fal.ai under AIC-O2 terms) | Yes |
| `recommendation` | **No change** — the engine neither knows nor cares about G-levels (SPINE §3 dependency rule) | No |

## 7. Public interfaces, contracts, schemas, migrations, events

- **API (OpenAPI 3.1):** `POST /v1/closet-items/{id}/views/generate` (target view `back|side`); `POST /v1/outfits/{id}/tryon` (base: `photo|avatar`, photoAssetId?); `GET /v1/media-assets/{id}` already returns provenance/lineage (doc 06 §3.3); `POST /v1/media-assets/{id}/keep|discard` for generated-view review. Idempotency keys on all; entitlement errors typed (`ENTITLEMENT_REQUIRED`, `CREDITS_EXHAUSTED` — dormant path).
- **Event schemas:** reuse `media.derivation.completed.v1` / `media.asset.processing_failed.v1`; add `billing.credits.consumed.v1` emission from the seam (shadow-flagged) per doc 06 catalog.
- **DB migrations (Drizzle, expand-only):** generation-job metadata columns on `media.derivations` (model id/version, prompt/config hash, auto-check scores); `credit_ledger` shadow-entry flag column (if P13's table pre-landed via doc 12 design, else create per doc 12 §4.2 schema now, marked seam). Rollback: additive; down paths documented; ledger rows are audit data → `-- IRREVERSIBLE` down with export note.
- **Generated clients:** TS client, event types, Python worker models — `just generate`, CI `--check`.

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Try-on entry point + base-photo picker w/ consent, generation progress states, provenance badge + confidence rendering, keep/discard review, views-strip real/generated labeling, replacement flow UX, entitlement-state cards |
| Backend | `media` job orchestration, auto-check gates, lineage/supersession, entitlement + ledger seam, `outfit` G2 resolution |
| Workers (ML/media) | Auto quality checks (category-consistency classifier call reuse, palette ΔE, face-region diff for photo-based try-on) as deterministic/CV checks in the Python worker; eval harness runners |
| Data / migrations | §7 migrations; eval dataset registration (versioned, dataset cards per doc 13 §10) |
| Infrastructure | fal.ai + Replicate credentials, optional GPU eval host for the self-hosted FASHN VTON v1.5 arm, per-provider spend caps (doc 10 §6.1 global cap config), pg-boss queue priorities |
| 3D / assets | None (avatar renders for try-on base reuse P10's static posed renders) |
| Admin / internal tools | Generation-failure/refund queue visibility; eval-report browser link; per-task spend panel |

## 9. AI vs deterministic decisions

Owning rows: [10 §1 #4–#5, §2.4–§2.5](../10-ai-usage-cost-and-evaluation.md). This phase is the plan's largest paid-AI addition — everything else stays deterministic.

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Missing-view synthesis | **GEN** (fal.ai Flux-class; Gemini image batch → Replicate as fallbacks) | Inventing unseen geometry/texture is inherently generative (doc 10 §2.4) | Feature paused (rung 5); closet fully works on real views | **$0.025/image**; p95 < 20 s |
| G2 photo try-on | **GEN** (fal.ai VTON-class; Replicate batch fallback) | Draping a real garment photo on a real body photo is the core G2 capability (doc 10 §2.5) | G0 collage (rung 6); credit not consumed on failure | **≤ $0.01/image blended**; p95 < 15 s |
| Auto quality checks (category agreement, palette ΔE, face-region untouched) | **Deterministic/CV** (existing classifier reuse + color math + pixel diff) | Gate must be cheap, reproducible, and non-generative | Reject-and-fallback | ~$0 marginal |
| Cache/dedup | **Deterministic** — one generation per (hash, view/composition, model version); re-viewing free; regenerate = explicit action + new credit | NFR-AIC-030 hash-before-spend | n/a | $0 |
| Provenance/lineage/supersession | **Deterministic** | Data rules, not inference | n/a | $0 |

## 10. Security, privacy, consent, and data lifecycle

- **New sensitive data:** user base photos sent to fal.ai (photo-based try-on) — highest-sensitivity flow of the phase. Gated on **AIC-O2** (fal.ai DPA/privacy review, NFR-AIC-070): no-training terms, short retention, signed short-lived URLs only; blocked entirely until the review passes (avatar-render mode ships regardless). Generated images classified with source media per [11](../11-security-privacy-and-compliance.md).
- **Consent:** new `ai_generative` consent scope for photo-based try-on with inline "what leaves the device/infra" explanation; consent withdrawal halts pending jobs and blocks new ones (sec-suite consent-gating test extended). Garment-photo synthesis runs under existing closet-processing consent.
- **Retention/deletion/export:** generated images follow media lineage — deleting the source item/photo deletes derived try-ons/views (doc 06 §8 step 2 + lineage edges); deletion propagation to fal.ai is nothing-to-delete by policy (zero/short retention, doc 06 §8 step 3) — verified in the AIC-O2 review evidence; generated assets included in export with provenance intact (REQ-BIL-120 behavior pre-stated).
- **Threat/abuse cases added:** generating try-ons of non-consenting third parties (mitigation: base photo must be a consented, owner-attested photo — reuse doc 07 §5.3 attestation pattern; moderation path for reports); prompt/config tampering to alter bodies (config hashes recorded, anatomy check hard-fails); credit-fraud via retry abuse (idempotency + refund audit). Registered in the doc 11 threat model.
- **Honesty invariants (CLAUDE.md):** provenance + confidence on every generated view; a real user photo is never replaced by a generated one; no fit-guarantee or digital-twin language — copy reviewed against doc 07 §1 table.

## 11. Observability and analytics added in this phase

- **Metrics:** per-task spend `{task, provider, model_version, plan}` (doc 10 §6.1), images generated/day, auto-check rejection rate (< 3% refusal target), user keep/discard rate, refund rate, generation p95 latency, provider error rate, cache-hit rate on re-views, shadow-credit consumption per plan (feeds P13 pricing validation), supersession count.
- **Product analytics (consent-gated):** `tryon_requested` (base: photo|avatar), `tryon_kept|discarded`, `view_generated`, `view_superseded_by_real`, `generation_failed` (reason enum) — no image data, ever.
- **Alerts/dashboards/runbooks:** doc 10 §6.2 alerts wired for the two generative tasks (60%/85% budget, day-over-day ×3 anomaly); provider-outage alert auto-flips rungs 5–6 flags; runbooks: "fal.ai outage" (flip to fallback/pause, credits untouched), "keep-rate collapse" (freeze model version, rerun eval, compare model_version cohorts). Per-phase observability rule 14 §15 satisfied.

## 12. Ordered tasks

The **eval gate (T08–T09) sits between build and enablement**: T10+ user-facing enablement tasks may not start their rollout until the gate report is green.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P11-T01 | Contracts + `shared-kernel`: generation endpoints, keep/discard, failure enums, consent scope, credit-meter references; regenerate | — | 1 |
| P11-T02 | `platform`: `ImageGenPort` + fal.ai adapter + Replicate fallback adapter + recorded-fixture contract tests + spend telemetry | T01 | 1–2 |
| P11-T03 | `media`: missing-view job — only-missing-view enforcement (real view present ⇒ job refused), idempotent generation keyed by (hash, view, model version), lineage `generated` rows | T02 | 2 |
| P11-T04 | `media`: G2 try-on job — avatar-render base first; photo base **code-complete but hard-gated on AIC-O2**; composition-hash caching | T02 | 2 |
| P11-T05 | Auto quality checks in worker: category agreement ≥ 0.8, palette ΔE bound, face-region-untouched diff, anatomy/body-shape check; reject → retry-once → discard path | T03, T04 | 1–2 |
| P11-T06 | Supersession + replacement flow: real photo demotes generated view (`superseded`), consumers switch immediately, dependents invalidated/requeued; generated views excluded from extraction/embedding inputs (pipeline guard + test) | T03 | 1–2 |
| P11-T07 | Billing seam: entitlement checks at enqueue (`tryon.generative`, `views.missing_view`), ledger consume/refund in job-acceptance transaction, **shadow-mode flag**, `billing.credits.consumed.v1` emission | T03, T04 | 1–2 |
| P11-T08 | **Eval datasets + harness**: SPK-2 missing-view set (100 items with real back-photo ground truth), G2 set (consent-safe, spanning body shapes/skin tones/garment classes per doc 13 §10 slices), dataset cards, `just ml-eval` wiring with cost/latency gates | T01 | 2 |
| P11-T09 | **Run the eval gate** (doc 16 SPK-2 + RISK-02): measure against §15 thresholds incl. per-slice results + unit-cost measurement; produce the gate report; **go/no-go decision logged as DEC entry** | T03–T05, T08 | 1–2 |
| P11-T10 | Mobile: missing-view generation UI (views strip, badges, keep/discard, absent-control-when-real-view-exists) | T01, T03 | 2 |
| P11-T11 | Mobile: G2 try-on UI (entry from outfit presentation, base picker + consent flow, progress, badge + confidence, disclaimer copy) | T01, T04 | 2 |
| P11-T12 | Mobile: replacement flow UX + provenance history in item detail | T06, T10 | 1 |
| P11-T13 | Degradation rungs 5–6 automation (provider-outage flag flips), chaos tests, credits-untouched-on-failure proof | T07 | 1 |
| P11-T14 | Observability, spend alerts, runbooks, admin panels | T02–T07 | 1 |
| P11-T15 | Staged rollout execution (internal → beta cohort per §16), shadow-credit data review vs doc 12 economics | T09–T13 | 1 |
| P11-T16 | Demo, docs, deletion/export coverage for generated assets, PROGRESS | all | 1 |

## 13. Parallelization

- **Can run in parallel:** after T02: {T03} ∥ {T04} (separate job files) ∥ {T08 eval datasets}; T10 ∥ T11 (separate mobile features) against T01's generated client; T05 ∥ T06 after their parents; T13 ∥ T14.
- **Must be serial:** T01 alone first (contracts/shared-kernel single-writer); T05 before T09 (gate needs checks); **T09 strictly before T15** (no enablement without the gate report); T07 before T15 (seam must be shadow-verified). Billing-seam files single-writer with any concurrent P13 prep.

## 14. Test-first plan (by module and level)

Per [13](../13-testing-quality-and-performance.md) §3, §10; tests in owning modules' `tests/`.

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `media` | only-missing-view refusal; auto-check thresholds; supersession state transitions | fast-check: a `generated` asset can never supersede a `captured` one (only the reverse — doc 06 §3.3 invariant); idempotency key stability | job payloads vs `packages/contracts`; fal.ai callback fixtures (provider format change breaks tests, not prod) | pg-boss job suite: run-twice ⇒ one generation + one ledger entry; failure at each step → retry → refund; supersession invalidates dependents; generated views absent from extraction inputs | pipeline E2E on staging nightly |
| `platform` | adapter mapping, spend tagging | — | recorded fal.ai/Replicate fixtures | provider-down → rung flags flip; fallback adapter cutover by config | — |
| `billing` (seam) | entitlement check outcomes; shadow-mode no-charge | metering arithmetic invariants (doc 13 §3): balance never negative, consume+refund = 0 | ledger entry schema | consume in job-acceptance transaction; double-webhook/duplicate-job ⇒ single entry | — |
| Mobile | badge/confidence rendering; absent-control logic | — | generated client | RNTL: progress/failure/refund states; consent flow fail-closed | Maestro: generate view → badge visible → replace with real photo → supersession; try-on avatar-base flow |
| Eval (workers) | check implementations vs golden fixtures | — | eval-run record schema (model id, prompt version, dataset version, git SHA — doc 13 §10) | — | **nightly ML lane: try-on + missing-view suites with cost/latency regression gates** |

## 15. Budgets introduced or measured

Thresholds are the **enablement gate** (doc 10 §2.4–2.5, doc 16 SPK-2/RISK-02) — not aspirations; failing them keeps the flags off.

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| AI quality (missing-view gate) | ≥ 80% of generated views pass auto-checks; attribute consistency ≥ 90% vs real-back ground truth; user keep-rate ≥ 70% (SPK-2 success: ≥ 75% keep-rate aspiration, ≥ 70% doc 10 floor); no slice regressing > threshold even if aggregate passes | `just ml-eval` gate report (T09) + beta keep-rate telemetry |
| AI quality (G2 gate) | User satisfaction ≥ 80% across diverse body types & garment categories; artifact-report rate < 5%; refusal-to-show < 3%; face region untouched; anatomy unaltered | eval suite + rated beta sample |
| Cost | Missing-view ≤ **$0.012/image** (FLUX.2 [dev] — managed endpoint only; weights are non-commercial, never self-hosted for commercial use; $0.04 Kontext escalation ceiling) = 1 credit; G2 ≤ **$0.075/image** (FASHN v1.6 / Kling managed; self-hosted FASHN VTON v1.5 arm costed per GPU-hour in the same gate, DEC-47; +10% retry allowance ≈ $0.0825; $0.11 Leffa ceiling) = 3 credits; **cost arm: FLUX 2 try-on LoRA ($0.021/MP) evaluated on the same set (AIC-O5 / OQ-11)**; per-plan monthly caps per doc 10 §6.1; global cap $500/mo config; credit economics vs doc 12 §4 (≈ $0.0275/credit) — prices verified 2026-09-09, [r6](../research/r6-pricing-verification-2026-09-09.md) | per-task spend metrics + provider-dashboard weekly reconciliation |
| Performance | Missing-view job p95 < 20 s; G2 end-to-end p95 < 15 s; re-view (cache hit) instant | job telemetry, k6 not required (async jobs) |
| Reliability | Provider outage ⇒ rungs 5–6 flip with credits untouched; 0 double-charges under duplicate delivery; refund on every discarded/failed output | chaos tests (T13) + ledger audit |

## 16. Rollout, flags, migration, compatibility, rollback

- **Feature flags (owner + expiry):** `views.missing-view-gen` and `tryon.g2` (owner ML; expiry P14 review) — **both off until the T09 gate report passes**, then staged: internal team → ~50-user beta cohort → entitled tiers; `tryon.g2.photo-base` separately gated on AIC-O2 (owner BE/legal; no enablement without the review artifact); `billing.credits.shadow` (owner BE; expiry P13 — P13 flips shadow → live, per REQ-BIL-130 no refactoring needed).
- **Migration/backward-compat:** additive throughout; `OutfitPresentation` v1 already tolerates G2 levels (P10 §16); older clients skip unknown levels down the fallback chain. Model-version bumps generate new derivations; old images keep their recorded lineage (NFR-AIC-060 reproducibility fields).
- **Rollback plan:** any quality/cost/privacy incident → flip the feature flag(s) off (rungs 5–6 — G0 and real views carry the product, per design); provider incident → cut the port to the fallback adapter by config (doc 10 §6.4, old adapter warm 30 days); no schema rollback needed to disable. Full rollback rehearsed once during the beta stage (evidence in §20).

## 17. Risks, mitigations, assumptions, stop/kill criteria

- Risks in play: **RISK-02** (G2 quality/cost — this phase *is* its validation point), **RISK-10** (fal.ai concentration — fallback adapter + port), **RISK-08** (AI cost overrun — caps + shadow metering), **RISK-07**-adjacent (user photos to a provider — AIC-O2 gate), **ASM-03** (G2 clears gates at ~$0.003–0.025/image, as of Aug 2026).
- **Stop/kill criteria (from doc 16 RISK-02 + SPK-2 — binding):**
  - G2: user-satisfaction eval **< 80% on diverse-body slices**, or measured unit cost > $0.11/image → **ship P11 with G2 disabled behind its flag**; MVP remains valid via G0 + avatar (doc 00 §7); log DEC.
  - Missing-view: keep-rate **< 50%**, or provider cost/latency breaks credit economics → kill/hold the feature (SPK-2 kill row); closet works on real views only; G2 unaffected; log DEC.
  - AIC-O2 fails or stalls → photo-based try-on stays off indefinitely; avatar-render-based G2 ships alone; log DEC.
  - Any nonzero anatomy-alteration or real-view-replacement finding in eval or beta → immediate flag-off + sev-2, fix before re-gate.

## 18. Demo script

Staging + real device, entitled test account (shadow credits):

1. Item with front photo only → item detail shows "Generate back view" → run it → generated view appears with **AI-generated badge + confidence**; VoiceOver announces the provenance.
2. Item **with** a real back photo → the generate control is absent for that view; blurry real back photo → retake offered, never synthesis (REQ-CAP-070 live).
3. Capture a real back photo for item 1 → generated view flips to `superseded`, real photo is canonical in views strip, collage, and presentation immediately; show lineage chain via `GET /v1/media-assets/{id}` (REQ-CAP-090, REQ-MED-070).
4. From an outfit presentation (P10), run G2 try-on on the **avatar-render base** → photorealistic preview with badge, confidence, and "visualization, not a fit guarantee" copy; toggle back to G0 collage — both coexist, neither replaced.
5. Discard a generated view → shadow-ledger refund entry shown in the admin panel; duplicate-submit the same job → single ledger entry (idempotency).
6. Flip the provider-outage chaos flag → both features show "temporarily unavailable", G0 everywhere, credits untouched; restore → recovery.
7. Show the **eval gate report**: aggregate + per-slice metrics vs §15 thresholds, unit-cost measurement, and the DEC entry recording the go decision.
8. Show spend dashboard: per-task cost tagged by provider/model/plan, under caps.

## 19. Acceptance criteria

- **AC-1 (enablement gate):** the G2 eval suite passes on the versioned consent-safe dataset — satisfaction ≥ 80% including every body-type/skin-tone slice, artifact-report < 5%, refusal < 3%, face-region + anatomy checks 100%, measured unit cost ≤ $0.0825/image incl. retries (report the FLUX 2 LoRA arm's and the self-hosted FASHN VTON v1.5 arm's cost + quality alongside — DEC-47) — **before** `tryon.g2` serves any non-internal user. Evidence: `just ml-eval` report + DEC entry (NFR-AIC-020/100, REQ-CAP-140, RISK-02).
- **AC-2 (enablement gate):** the SPK-2 missing-view eval passes — auto-check pass ≥ 80%, attribute consistency ≥ 90%, keep-rate ≥ 70% on the beta cohort, cost ≤ $0.025/view, p95 ≤ 20 s — before `views.missing-view-gen` serves non-internal users; kill path documented and rehearsed (flag-off leaves closet fully functional).
- **AC-3:** pipeline test proves a real captured view blocks synthesis of that view, and a `generated` asset can never supersede a `captured` one (property test + REQ-CAP-070); generated views are provably absent from extraction/embedding inputs (guard test).
- **AC-4:** metadata schema requires `provenance` + `confidence` on every generated asset (contract test rejects absence); UI badge visible and screen-reader-announced on both features (RNTL + Maestro artifacts); every `garment_representations` row carries its G-level with no conflation (schema test) — REQ-CAP-080/100.
- **AC-5:** uploading a real photo supersedes the generated view with immediate consumer switchover and dependent invalidation; regeneration/reprocessing never overwrites the supersession or any user correction (regression test) — REQ-CAP-090, REQ-MED-080.
- **AC-6:** every stored generation records provider, model id/version, prompt/config hash, input hash, timestamp (NFR-AIC-060 fields, doc 10 §2 common policy); identical (hash, view/composition, model version) never triggers a second paid call (cache-hit test, NFR-AIC-030).
- **AC-7:** entitlement checks + ledger consume/refund run in shadow mode with zero user-visible charging; duplicate delivery produces exactly one ledger entry; discarded/failed output always produces a compensating refund entry; flipping the shadow flag is the *only* change P13 needs to activate metering (seam test) — REQ-BIL-130.
- **AC-8:** provider-outage chaos run flips rungs 5–6 automatically, G0/real-view paths keep working, credits untouched (test + demo step 6).
- **AC-9:** AIC-O2 review artifact exists and gates `tryon.g2.photo-base`: with the review absent/failed, no code path can transmit a user photo to fal.ai (fail-closed integration test).

## 20. Definition of done

```bash
just test media && just test outfit && just test billing && just test platform   # no skips
just lint && just typecheck
just arch-check            # no provider SDK outside platform; engine untouched
just generate --check
just db-migrate && just db-rollback
just ml-eval               # try-on + missing-view suites incl. slices + cost/latency gates — green
just security-scan
just ci-parity
# chaos/outage rehearsal + flag-off rollback rehearsal executed on staging
```

Evidence: eval gate reports (aggregate + slices + unit costs) with dataset cards and versions, DEC entries for both go/no-go decisions, beta keep-rate/satisfaction telemetry, spend dashboard screenshot vs caps, ledger audit sample (consume/refund pairs), demo recording (steps 1–8), AIC-O2 review artifact (or the documented photo-base-off decision). All from actual runs — never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: `docs/modules/media.md` + `platform` + `outfit` + `billing` contracts; doc 10 §3/§7 (final providers confirmed, AIC-O2 closed, prices re-dated if changed); doc 16: SPK-2 outcome + RISK-02 validation + new DEC entries; doc 12 §4 shadow-consumption findings appended for P13; doc 07 §7 conformance note; doc 14 runbooks/alerts registered.
- [PROGRESS.md](../PROGRESS.md): `IN_PROGRESS` at start; `DONE` only with §20 evidence; if a kill criterion fired, the phase can still be `DONE` with the feature flagged off and the DEC recorded — shipping the gate's honest outcome *is* the deliverable.
- [PROGRESS.md](../PROGRESS.md) note: P12 (`fashion-intelligence`) depends on P09 only, so it may already be underway; P13 consumes this phase's shadow-metering data.

## 22. Handoff note

Written at phase end. Expected shape: P11 `ACCEPTED` (with the gate outcome recorded either way) feeds **P13** (activate `billing.credits.shadow` → live; pricing informed by shadow data) and P14 (flag/copy audit of provenance surfaces). Next session (if following SPINE order): `phases/P12-fashion-intelligence.md` sourcing spike, or `phases/P13-monetization-and-entitlements.md` T01 if P12 is running in parallel. First command: `just ml-eval` (confirm gates still green on current model versions). Interim handoffs → PROGRESS.md log via [templates/session-handoff.md](../templates/session-handoff.md).
