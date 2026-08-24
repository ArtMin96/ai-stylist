# P09 — Recommendation Engine v1

> File name per [SPINE §5](../SPINE.md). Template: [templates/phase.md](../templates/phase.md). Status values per [PROGRESS.md](../PROGRESS.md). Engine design is owned by [09-recommendation-engine.md](../09-recommendation-engine.md) — this file sequences its delivery; on conflict, doc 09 wins.

## 1. Overview

- **Phase:** P09 — Recommendation engine v1
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Ship the deterministic, versioned, explainable recommendation engine per doc 09 — hard constraints, candidate generation, scoring, final validation, reason codes, alternatives, feedback ingestion with guardrails, and replayable recommendations — proven by the simulation suite with zero hard-constraint violations.
- **User-visible outcome:** The user opens Today and gets a ranked, explained outfit composed entirely of their own available closet items, with alternatives, item replacement, the full feedback set, saved/scheduled/worn actions, a preference-transparency screen, an optional daily notification — and every "why?" answerable from reason chips.
- **Why now:** This is the product's core promise. P07 delivered the organized closet with availability states and attributes; P08 delivered typed context facts. Both are the engine's only inputs; nothing else was blocking.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only. *(partial)* = this phase delivers its P09 slice; the other listed phase completes it.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-REC-010 | Recommendations only from items the user owns | AC-2 |
| REQ-REC-020 | Engine is a versioned, explainable subsystem, not an LLM prompt or scattered logic | AC-1, AC-6 |
| REQ-REC-030 | Staged pipeline with named, separately testable stages | AC-1 |
| REQ-REC-040 | Hard constraints before soft ranking; precedence + conflict rules | AC-2 |
| REQ-REC-050 | Holiday/soft signals never cause unsafe recommendations | AC-2 |
| REQ-REC-060 | Final full-outfit validation stage | AC-2 |
| REQ-REC-070 | Deterministic ranking, defined tie-breaks, seeded "show me something different" | AC-3 |
| REQ-REC-080 | Scoring = deterministic rules × learned weights, both versioned | AC-6 |
| REQ-REC-090 | Any past recommendation reproducible (replay) | AC-6 |
| REQ-REC-100 | Candidate-gen limits + large-closet performance strategy | AC-7 |
| REQ-REC-110 | Structured renderer-independent results (reasons, confidence, alternatives, missing-data notes) | AC-4 |
| REQ-REC-120 | Unavailable items never recommended | AC-2 |
| REQ-REC-130 | Compatibility/layering/color/silhouette/fit/repeat/climate/restriction signals in scoring | AC-5 |
| REQ-REC-140 | Cold-start, sparse-closet, missing-context, no-valid-outfit behaviors defined and helpful | AC-8 |
| REQ-REC-150 | Offline/cached recommendation behavior + freshness warnings | AC-9 |
| REQ-REC-160 | Trend influence only post-constraints *(partial — seam + cap now, scorer activates P12 with weight 0 until then)* | AC-2 |
| REQ-REC-170 | Experiments never touch hard constraints *(partial — structural enforcement now; live experiments P13)* | AC-10 |
| REQ-REC-190 | Uncertainty exposed, never silently invented facts | AC-8 |
| REQ-EXP-010 | Reasons from decision-trace reason codes, never hallucinated | AC-4 |
| REQ-EXP-020 | Explanations avoid surprising sensitive language *(partial — template-layer rules now; copy audit P14)* | AC-4 |
| REQ-EXP-030 | Like/dislike whole outfit | AC-11 |
| REQ-EXP-040 | Replace one item, keep + revalidate the rest | AC-11 |
| REQ-EXP-050 | Structured feedback reasons, each consumed differently | AC-11 |
| REQ-EXP-060 | Save, schedule, mark worn, compare alternatives *(partial — actions + data now; avatar presentation surfaces P10)* | AC-11 |
| REQ-EXP-070 | "Never suggest this pairing" durable hard rule | AC-2, AC-11 |
| REQ-EXP-080 | Every feedback type classified (hard rule / weight / session / eval data) | AC-11 |
| REQ-EXP-090 | Undo, reset-personalization, preference transparency | AC-12 |
| REQ-EXP-100 | Guardrails against one-action overfitting | AC-12 |
| REQ-CTX-080 | Cached/offline context usable with staleness warnings *(P09 part: engine + result surfaces)* | AC-9 |
| REQ-ORG-070 | Outfit history / wear tracking *(partial — P07 delivered tracking + display; P09 writes wear events via mark-worn and consumes them in repeat/wear-history scoring)* | AC-11 |
| REQ-NOT-010 | Push via FCM + APNs behind a platform port, delivery tracked | AC-13 |
| REQ-NOT-020 | Notification preferences: opt-in, categories, quiet hours, timezone | AC-13 |
| REQ-NOT-030 | Daily outfit notification honoring preferences + context freshness | AC-13 |
| NFR-TST-100 | Simulation suite proves zero hard-constraint violations (incl. cold-weather-holiday) | AC-2 |
| NFR-TST-020 | Property-based suites for ranking/constraint invariants *(P09 slice per doc 13 §4; units P03, taxonomy P07)* | AC-3, AC-12 |
| NFR-TST-090 | AI/ML eval suites *(partial — explanation-polish faithfulness eval, flag-gated)* | AC-14 |
| NFR-AIC-040 | Templates from reason codes default; LLM polish optional, flag-gated, cost-tracked *(P09 slice)* | AC-14 |
| NFR-AIC-020 | Per-feature AI spec *(P09 slice: explanation-polish contract, thresholds, eval, latency + cost budget per doc 10 §2.7)* | AC-14 |

Consumed, not delivered: REQ-ONB-070 (climate tolerance, P03), REQ-ORG-090 availability states (P07). REQ-REC-180 is P10.

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P07** (closet attributes, availability states, wear history, offline sync), **P08** (ContextSnapshot) — per SPINE §5.
- External blockers: none hard. OQ (doc 09 §14): default weight vector values and safety-threshold table need review — conservative defaults unblock the build; ratification is a phase task (P09-T02), not a blocker. FCM/APNs credentials provisioned for T16.

## 4. In scope / out of scope

**In scope:** doc 09 §§3–11 and §13 in full — hard-constraint rule registry (`H-SAFE/H-EXCL/H-PAIR/H-AVAIL/H-DRESS/H-COMP`) with versioned thresholds; slot-based candidate generation with K/B bounds and precomputed pair scores; fixed-point scoring with the eight scorers (trend scorer wired at weight 0); stage-7 final validation; deterministic ranking + tie-breaks + seeded shuffle; reason-code registry in `shared-kernel` + template rendering; `RecommendationResult` contract; feedback ingestion with the full §8.1 mapping, §8.2 guardrails, undo, reset, transparency screen; versioned replayable `RecommendationRecord` + `just rec-replay`; degraded modes (cold start, sparse closet, missing context, no-valid-outfit); client prefetch/offline cache; simulation suite SIM-01…08 + property tests + goldens in CI; safety-acknowledgment flow (§4.3); daily notification (REQ-NOT-*); optional Haiku explanation polish behind a flag with its faithfulness eval.

**Out of scope / non-goals:** rendering on the avatar and `OutfitPresentation` (P10); trend scorer activation with nonzero weight (P12); live A/B experiments and Free-tier daily-limit *enforcement activation* (P13 — but the entitlement seam checks ship now per REQ-BIL-130); calendar/travel providers (P15); any on-device engine fork (doc 09 §11 — server-side only); commerce/shopping links in gap notes (doc 09 §10.2).

## 5. Product/UX behavior

Journey detail owned by [02 §8–§9](../02-user-journeys-and-information-architecture.md); the table maps its states.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Today: recommendation card | Ranked outfit + 2–3 reason chips + confidence; context strip (P08) above; alternatives rail | Empty closet → guided capture CTA ("Add 5 items…"); sparse → partial outfit labeled `partial` + `RC-GAP-*` hints — never a blank card | Compute failure → cached previous + retry; **no-valid-outfit** → honest blocking-constraints explanation + actionable fixes, never a relaxed result | Last cached recommendation with "offline — based on data from <time>"; reasons render client-side from codes, no network needed | Reason chips are labeled buttons; result readable as structured list (renderer-independent by construction); confidence announced |
| "Show me something different" | Labeled control; deterministic seeded advance; same taps ⇒ same sequence | — | — | Advances over cached alternatives only | Announced as "alternative N of M" |
| Replace one item | Slot picker showing only constraint-valid swaps; rest of outfit kept + revalidated | No valid swap → explains why (reason codes) | Failed write → optimistic UI + queued retry | Queued with idempotency key | Picker fully labeled |
| Feedback set | All 02 §9.2 actions; dislike asks optional structured "why"; undo affordance ≥ 5 s | — | Idempotent retries; durable failure → non-blocking notice | Queued, synced in event order | Every action reachable non-gesturally |
| Preference transparency (You → Style preferences) | Learned tendencies in plain language + the events behind them; hard exclusions/never-pair rules; climate calibration — all editable/deletable; reset-personalization with kept-vs-cleared summary | New user → stated preferences only | — | Read from cache; edits queue | Plain-language list; destructive reset double-confirmed |
| Daily notification | Opted-in users get the outfit at chosen local time, context-fresh | — | Delivery failure recorded; no retry storm | n/a | Notification text = template reasons, no sensitive data |
| Future-day planning (Plus seam) | Date pick → forecast-based plan; saved to date; forecast-shift flag (no silent regeneration) | — | Beyond-horizon per P08 | Cached | Standard controls |

## 6. Domain and architecture changes (by owning module)

| Module | Change | Contract update needed? |
|---|---|---|
| `recommendation` | **New module**: stages 3–8 + 10 (doc 09 §1), rule registry + versioned ruleset config, candidate gen, scorers, validator, ranker, feedback ingestion, weights store, replay harness, sim suite | Yes — new module contract |
| `shared-kernel` | Reason-code registry (all `RC-*` namespaces, doc 09 §7); ruleset/threshold config schema; feedback enums | Yes (single-writer, first) |
| `context` | Exposes `ContextSnapshot` to the engine (read-only consumption; built in P08) | No |
| `closet` | Emits item-changed events already (P07); adds read model for eligible-item snapshot hashing | Minor |
| `outfit` | Saved outfits, scheduled outfits, mark-worn (writes wear events via closet), `outfits`/`outfit_items` tables | Yes |
| `notifications` | **New module slice**: scheduling + delivery over the prefs/quiet-hours storage landed in P03; `platform` FCM/APNs port | Yes |
| `platform` | FCM/APNs adapter; optional `ExplanationPort` (Haiku polish) adapter | Yes |
| `profile` | Reset-personalization touchpoint; transparency reads | Minor |

Invariants enforced this phase: `recommendation` ⊥ `avatar`/renderer (dependency-cruiser rule from P02 now has real code to bite on); UI contains zero scoring/constraint logic (arch check + review); no wall-clock reads inside stages 3–8 (lint rule + tests).

## 7. Public interfaces, contracts, schemas, migrations, events

- **API (OpenAPI 3.1):** `POST /v1/recommendations` (targetDate, occasion, shuffleCounter, safetyAcknowledgment?); `GET /v1/recommendations/{id}` (result per [06 §3.5](../06-data-api-and-event-contracts.md)); `POST /v1/recommendations/{id}/feedback`; `GET/DELETE /v1/me/preferences/learned` + never-pair CRUD (transparency); `POST /v1/outfits` / `POST /v1/outfits/{id}/worn` / schedule; notification-prefs endpoints. Idempotency keys on all mutations.
- **Event schemas:** `recommendation.generated.v1`, `recommendation.feedback_received.v1`, `outfit.saved.v1`, `outfit.worn.v1` (doc 06 catalog); consumers per catalog.
- **DB migrations (Drizzle, expand-only):** `recommendations`, `reason_traces`, `feedback_events` (event-sourced, undo-capable), `user_weights` (+ version hashes), `rulesets` (content-hashed config), `item_pair_scores`, `outfits`, `outfit_items`, `deliveries` (the `notification_prefs` table exists from P03's preference-storage migration — extended additively here only if scheduling needs new columns). Rollback: additive; down paths drop tables; `feedback_events`/`outfits` are user data → documented `-- IRREVERSIBLE` down + export coverage (doc 06 §7/§8; add all to the deletion-cascade coverage test).
- **Generated clients:** TS client, event types, Python models — `just generate`, CI `--check`.

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Today card, alternatives rail, shuffle control, replace-item picker, feedback surface + undo, transparency screen, offline cache + prefetch, staleness/partial/no-valid-outfit states, notification prefs UI |
| Backend | Everything in §6: engine, feedback, replay, transparency APIs, notifications scheduling, sim suite |
| Workers (ML/media) | None (explanation polish is an API-side batch call through `ExplanationPort`, no new worker) |
| Data / migrations | §7 tables + pair-score incremental maintenance job (Trigger.dev, idempotent) |
| Infrastructure | FCM/APNs credentials; k6 load profile "morning spike" (doc 13 §12.3) wired for the P09 gate |
| 3D / assets | None |
| Admin / internal tools | Replay entry point for support ("why did it suggest this?") reading `rec-replay` output; violation-auditor job dashboard |

## 9. AI vs deterministic decisions

Per doc 09 §0 the engine is ~95% deterministic; the only paid AI is optional explanation polish. Owning rows: [10 §1 #7/#8, §2.7](../10-ai-usage-cost-and-evaluation.md).

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Constraints, candidates, scoring, ranking, validation, tie-breaks | **Deterministic** (rules + data queries + fixed-point math) | Doc 10 #7: never an LLM in the decision path | n/a | ~$0/recommendation |
| Learned preference weights | **RANK** — bounded per-user linear weights updated by explicit feedback rules | Simple, inspectable, versioned; no neural ranker in v1 | Onboarding baseline weights | $0 (no inference calls) |
| Color harmony / similarity reads | Deterministic math + **precomputed** embeddings (capture-time, P06) | Engine only reads stored vectors — zero inference at request time | Attribute-only scoring | $0 at request time |
| Explanations | **Templates from reason codes (default)**; optional **NL** Haiku polish (batch + prompt cache), flag-gated | Doc 10 §2.7; polish may only rephrase template output; faithfulness validator rejects invented facts | Templates (permanent fallback; kill-switch rung 1, doc 10 §6.3) | ≤ $0.0001/explanation; ≤ $0.001/recommendation total; $0 with polish off |

## 10. Security, privacy, consent, and data lifecycle

- **New sensitive data:** wardrobe-history-derived preference weights and feedback events; decision traces referencing context (location-coarse) facts. Classified per [11](../11-security-privacy-and-compliance.md); traces carry IDs and codes, never free text or media.
- **Consent:** no new consent scopes; explanation polish sends **only reason codes + template sentences** to Anthropic (approved provider, no-training/7-day retention per DEC-29) — never raw profile/closet data. Analytics on feedback are consent-gated (NFR-PRV-110).
- **Retention/deletion/export:** trace retention window per doc 11 (open item doc 09 §14 — resolve to a number in P09-T02 and record in doc 11); recommendations/feedback/outfits/weights included in export and the deletion cascade (coverage test extended).
- **Threat/abuse cases added:** feedback-poisoning of another user (authz: feedback only on own recs — sec suite matrix); replay endpoint information disclosure (support role + audit log per NFR-OBS-070); notification content leaking wardrobe details (template review — codes only).
- **Explanation language:** template layer enforces REQ-EXP-020 (no body-data or inferred-trait phrasing); blocklist per 11 §17 wired into the polish validator.

## 11. Observability and analytics added in this phase

- **Metrics (doc 14 §4 registrations):** hard-constraint violation rate from the **independent post-hoc auditor job** re-running stage-7 rules on served results (target 0 — invariant; any nonzero = sev-2 alert, doc 09 §13.1); practical validity; engine p95 / end-to-end p95; candidate-pool sizes; no-valid-outfit rate; feedback-undo rate; weight-clamp saturation; notification delivery success; explanation-polish spend + template-fallback rate.
- **Product analytics events:** `rec_requested`, `rec_shown`, `rec_shuffle`, `rec_feedback` (kind enum only), `rec_item_replaced`, `outfit_saved|worn|scheduled`, `prefs_reset`, `transparency_viewed` — schema-validated, no attribute values or item names.
- **Alerts/dashboards/runbooks:** violation-rate alert (page immediately); rec-validity dashboard; runbooks: "violation alert fired" (freeze ruleset rollout → replay offending rec → fix + regression sim), "engine latency regression", "notification delivery failures". Replay (`just rec-replay <id>`) documented as the support entry point (audit-trailed).

## 12. Ordered tasks

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P09-T01 | Contracts + `shared-kernel`: reason-code registry, `RecommendationResult`/`RecommendationRecord`/feedback schemas, OpenAPI paths, events; regenerate | — | 1–2 |
| P09-T02 | Versioned ruleset config: hard-rule thresholds (conservative safety defaults), base weights w₀ + clamps, K/B params; content-hash versioning; threshold-review sign-off recorded | T01 | 1 |
| P09-T03 | Stage 3 hard rules: `H-SAFE/H-EXCL/H-PAIR/H-AVAIL/H-DRESS/H-COMP` registry, precedence, violation reason codes; unit + property tests first | T02 | 2 |
| P09-T04 | Candidate generation: slot model, per-slot pre-scoring, top-K, beam-B composition, complexity-bound tests (1,000-item synthetic closet) | T03 | 2 |
| P09-T05 | `item_pair_scores` precompute + incremental maintenance consuming `closet.item.*` events (idempotent job); ruleset-version cache keying | T02 | 1 |
| P09-T06 | Scorers 1–8 (fixed-point), trend scorer wired at weight 0; scoring breakdown inspection; determinism harness (no wall clock, stable iteration) | T03, T05 | 2 |
| P09-T07 | Stage 7 final validation + no-valid-outfit path with top blocking constraints; stage 8 ranking + tie-break tuple + seeded shuffle (§6.3–6.4) | T06 | 1–2 |
| P09-T08 | `RecommendationRecord` persistence: snapshots, versions, seed, trace; `just rec-replay` + CI byte-equality invariant | T07 | 1–2 |
| P09-T09 | Reason-code trace selection + template rendering (localization-ready) + missing-data notes + degraded modes §10.1–10.4 | T07 | 2 |
| P09-T10 | Feedback ingestion: full §8.1 mapping, guardrails §8.2 (bounded deltas, min-evidence, decay, clamps), event-sourced undo, never-pair creation, availability-correction path | T08 | 2 |
| P09-T11 | Transparency screen APIs + reset-personalization + safety-acknowledgment flow (§4.3) | T10 | 1 |
| P09-T12 | **Simulation suite SIM-01…SIM-08 + property tests + goldens** (`testdata/recommendation/golden/`), wired to PR-affected + nightly CI tiers (doc 13 §11, §13); `just rec-golden-update` reviewed-diff flow | T07, T09 | 2 |
| P09-T13 | Mobile: Today card, alternatives, shuffle, replace-item, states (empty/sparse/partial/no-valid/offline/stale) | T01 | 2–3 |
| P09-T14 | Mobile: feedback surface + undo + transparency screen + reset | T13, T11 | 2 |
| P09-T15 | Prefetch + offline cache + freshness warnings + offline feedback queue (idempotency keys) | T13 | 1–2 |
| P09-T16 | Notifications: prefs, quiet hours, timezone scheduling, FCM/APNs port + daily-outfit notification (context-fresh) | T08 | 2 |
| P09-T17 | Violation-auditor job + observability + analytics + runbooks (§11) | T08, T12 | 1 |
| P09-T18 | Explanation polish (flag-gated): `ExplanationPort` Haiku batch+cache adapter, faithfulness validator + eval set (doc 10 §2.7), cost tracking | T09 | 1–2 |
| P09-T19 | Load test (k6 morning-spike profile), perf-budget measurement, entitlement-seam checks (`recs.daily_limit` advisory, flag-dormant per REQ-BIL-130) | T07–T16 | 1 |
| P09-T20 | Demo, module contracts, docs, deletion/export coverage, PROGRESS | all | 1 |

## 13. Parallelization

- **Can run in parallel:** T03 ∥ T05 (disjoint files); after T07: {T08, T09} ∥ T13 (backend vs mobile); T10/T11 ∥ T13–T15; T16 ∥ T12; T18 anytime after T09.
- **Must be serial:** T01 → T02 alone first (`shared-kernel` + `packages/contracts` single-writer); T03 → T04 → T06 → T07 (each consumes the previous stage's types); T12 after T07+T09 (needs real pipeline); T17/T19/T20 last. Parallel sessions get disjoint write sets per CLAUDE.md.

## 14. Test-first plan (by module and level)

Written before implementation per task; suites per [13 §3–§5, §11](../13-testing-quality-and-performance.md).

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `recommendation` | every rule, scorer, tie-break, guardrail delta, degraded mode | fast-check: determinism; hard-constraint dominance (violating candidate never appears); tie-break totality; monotonicity; clamp bounds; feedback-delta ≤ ε (doc 13 §4) | `RecommendationResult` schema; reasons must map 1:1 to trace entries (doc 09 §7 contract test) | Testcontainers: full pipeline on seeded closets; replay byte-equality; pair-score incremental job idempotency | **Sim suite SIM-01…08** (PR-affected + nightly); latency measured vs §15 |
| `outfit` | save/worn/schedule logic | — | outfit events | wear-event write-through to closet | — |
| `notifications` | quiet-hours/timezone math | — | port contract (fake FCM/APNs) | scheduling job; opt-out honored | device push smoke (both platforms) |
| `shared-kernel` | reason-code registry completeness (every emitted code registered; every code has a template) | — | enum sync in contracts | — | — |
| Mobile | card states, template rendering from codes | — | generated client handshake | RNTL: feedback flows, transparency, offline states (MSW) | Maestro: recommendation → explanation → feedback; degraded-provider flow (doc 13 §7) |
| `platform` (`ExplanationPort`) | validator rejects unsupported facts | — | recorded Haiku fixtures | flag-off ⇒ zero provider calls | faithfulness eval in nightly ML lane |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/`.

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Engine compute p95 < 300 ms (500-item closet); rec endpoint p50/p95 400 ms/1.5 s (200-item, doc 13 §12.2); request→rendered ≤ 2.5 s mid-tier (doc 13 §12.1); 1,000-item closet within bounds (REQ-REC-100) | k6 (morning-spike profile) + device runs; raw traces archived |
| Cost | ≤ $0.001/recommendation with polish on; **$0 with polish off**; polish monthly spend within doc 10 §6.1 plan caps | per-task spend metric `{task, provider, model_version, plan}` |
| AI quality | Polish faithfulness ≥ 99.5%, hallucination < 0.5% (doc 10 §2.7 gate); template-fallback rate tracked | nightly eval lane (doc 13 §10) |
| Reliability | Hard-constraint violation rate **0** (invariant); no-valid-outfit responses always structured; graceful behavior with every provider degraded (NFR-PERF-040) | auditor job + sim suite + chaos tests |

## 16. Rollout, flags, migration, compatibility, rollback

- **Feature flags (owner + expiry):** `rec.engine` master (owner BE; expiry P10 acceptance); `rec.explanation-polish` (owner ML; no expiry — it is the permanent kill-switch rung 1, doc 10 §6.3); `rec.daily-notification` (owner BE; expiry P14); entitlement-seam flags `recs.daily_limit`/`recs.future_planning` **dormant until P13** (owner BE; expiry P13 activation) per REQ-BIL-130.
- **Migration/backward-compat:** all-new tables; ruleset changes always ship as a new `rulesetVersion` with changelog — old versions remain loadable for replay (doc 09 §9). Mobile additive within `/v1`.
- **Rollback plan:** flip `rec.engine` off → Today reverts to the P08 context strip + capture CTA (no fabricated results); revert deploy; rulesets roll back by re-pointing the active `rulesetVersion` (config, no migration); DB down-migrations documented per table (§7). A ruleset rollback is rehearsed once in this phase (evidence in §20).

## 17. Risks, mitigations, assumptions, stop/kill criteria

- Risks in play: **RISK-15** (cold-start trust — sparse-closet strategy + `RC-GAP-*` honesty; not killable: if cold-start validity stays low, gate recommendations behind a minimum-closet prompt rather than showing bad results); **RISK-14** (taxonomy/data quality feeding bad constraints — correction-rate metrics watched); **RISK-08** (AI cost — bounded here to polish; kill-switch rung 1).
- **Stop/kill criteria for this phase:** (a) sim suite cannot reach **0 hard-constraint violations** after the defense-in-depth fixes → **release-blocked, period** — the engine does not ship with a nonzero violation rate (NFR-TST-100 is a release gate); (b) engine p95 > 2× budget on the 500-item closet after the doc 09 §5 bounds are tuned → reduce K/B and re-measure before adding any complexity; (c) replay byte-equality unachievable cross-platform → escalate as an architecture defect (fixed-point audit), do not weaken the invariant.

## 18. Demo script

Real device + staging backend, fixture closet (~60 items incl. laundry states):

1. Open Today → outfit card with reason chips ("Warm layers for −5 °C", "Matches your office occasion"), confidence, alternatives rail. Tap a chip → plain-language sentence + underlying fact with freshness.
2. Set a fixture **holiday on a −5 °C day** → show that no shorts/sandals appear at any rank; tap "show me something different" 5× — sequence is deterministic and still safe (SIM-01 live).
3. Move the recommended top to `laundry` in the closet → refresh → it never reappears; reason trace on the replacement references availability.
4. Replace one item → picker shows only valid swaps; rest of outfit kept.
5. Dislike with "too warm" → next suggestion adjusts; open transparency screen → the new learned tendency is listed with the event behind it; undo it → weight delta reversed.
6. Add "never suggest this pairing" → regenerate repeatedly incl. shuffle — the pairing never returns (SIM-08 live); show the rule listed + deletable in transparency.
7. Sparse-closet account → partial outfit labeled with `RC-GAP-*` hint ("no weather-appropriate outer layer"), no fabricated items; black-tie occasion on the casual closet → honest no-valid-outfit with blocking constraints.
8. Airplane mode → cached recommendation renders with offline/staleness label; feedback queues and syncs on reconnect.
9. Run `just rec-replay <id-from-step-1>` → byte-identical result diff shown.
10. Trigger the daily notification on the test device at the chosen local time; opted-out account receives nothing.

## 19. Acceptance criteria

- **AC-1:** each doc 09 pipeline stage is a named, separately testable component; the pipeline diagram in doc 09 §1 matches code structure (module review artifact); UI packages contain zero scoring/constraint imports (`just arch-check` output attached).
- **AC-2 (release gate):** **the doc 13 §11 simulation suite passes with ZERO hard-constraint violations** across all SIM-01…SIM-08 scenarios and the N ≥ 10,000 generated matrix — explicitly including SIM-01 **cold-weather-holiday** (0 shorts/sandals/bare-legs at all ranks and all shuffle counters), SIM-02 unavailable-state exclusion for all six states, SIM-03 conflicting dress codes → structured no-valid-outfit, and SIM-08 never-pair under shuffle exhaustion. Evidence: CI run link + artifact (NFR-TST-100, REQ-REC-040/050/060/120, REQ-EXP-070).
- **AC-3:** SIM-07 determinism: 100 repeated runs with permuted item insertion order ⇒ byte-identical results; shuffle counter stored and reproducible.
- **AC-4:** `RecommendationResult` contains reasons, confidence, alternatives, and missing-data notes (schema test); a contract test fails if any displayed reason lacks a matching decision-trace entry; templates exist for every registered reason code (registry-completeness test); no body-data phrasing in any template (blocklist test).
- **AC-5:** each REQ-REC-130 signal has ≥ 1 rule/scorer + a unit test demonstrating its ranking effect (test list mapped to signals in the PR).
- **AC-6:** `just rec-replay <recommendationId>` reproduces a stored recommendation byte-identically (CI-enforced); every result records engine/ruleset/weights/profile/snapshot versions.
- **AC-7:** 1,000-item synthetic closet returns within the §15 latency budget with bounded candidate counts (k6/report artifact).
- **AC-8:** cold-start, sparse-closet, missing-context, and no-valid-outfit each return the doc 09 §10 structured responses in tests and demo — never an error, never invented data; missing-data notes appear whenever an assumption was used.
- **AC-9:** offline device serves the cached recommendation flagged as cached with staleness notes naming fact + age (Maestro artifact).
- **AC-10:** experiment config schema has no `hard.*`/`validation.*` fields; CI rejects a fixture experiment definition touching them (doc 09 §12 structural test).
- **AC-11:** every feedback type in the doc 09 §8.1 table has a test proving its distinct classified effect; single-item replace preserves + revalidates the rest; "unavailable" flips closet state.
- **AC-12:** property test enforces the bounded-step guardrail (no single event moves any weight > ε); undo reverses the exact delta; reset returns to onboarding baseline keeping hard exclusions.
- **AC-13:** opted-in device receives the daily notification at local time with a fresh recommendation on both platforms; opted-out receives nothing; quiet hours honored (scheduling tests + device evidence).
- **AC-14:** with `rec.explanation-polish` off, zero provider calls occur (test); with it on, faithfulness eval ≥ 99.5% and violating outputs are discarded to templates (eval report).

## 20. Definition of done

```bash
just test recommendation   # unit + pbt + integration + SIM suite — all pass, no skips
just test outfit && just test notifications
just lint && just typecheck
just arch-check            # recommendation ⊥ avatar/renderer; no logic in UI/controllers
just generate --check
just db-migrate && just db-rollback     # exercised on a Neon branch
just rec-replay <sample-id>             # byte-equal replay demonstrated
just ml-eval               # explanation-polish faithfulness gate (flag-on path)
just ci-parity
# k6 morning-spike run against staging; device Maestro flows (both platforms)
```

Evidence: sim-suite CI artifact (zero violations), replay diff output, k6 + device latency reports (raw traces), notification device screenshots, ruleset-rollback rehearsal notes, dashboards live (violation auditor, validity, latency, cost). Never fabricated (NFR-PERF-060).

## 21. Documentation and PROGRESS.md updates

- Docs to update: new `docs/modules/recommendation.md`, `outfit`, `notifications` contracts; doc 09 §14 open items resolved or moved to doc 16 (default weights → tuned values; threshold review sign-off; trace retention → doc 11); doc 14 metrics/alerts/runbooks registered; doc 16: new DEC entries for ruleset v1 ratification.
- [PROGRESS.md](../PROGRESS.md): `IN_PROGRESS` at start; `DONE` only with §20 evidence; handoff entries per rules.

## 22. Handoff note

Written at phase end. Expected shape: P09 `ACCEPTED` unblocks **P10** (with P04). Next session starts at `phases/P10-outfit-on-avatar.md` task P10-T01; first command: `just test recommendation` (green baseline), then read doc 07 §4.3 (`OutfitPresentation`) before touching `outfit` rendering. Interim handoffs → PROGRESS.md log via [templates/session-handoff.md](../templates/session-handoff.md).
