# P12 — Fashion Intelligence

> File name: `phases/P12-fashion-intelligence.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10). Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P12 — Fashion intelligence
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Ship a licensed-content-only, provenance-tracked, personalized fashion-intelligence feed (Discover) with moderation, and activate trend influence in the recommendation engine strictly through the post-constraint soft-scoring layer.
- **User-visible outcome:** The Discover tab shows a personalized feed of trends, runway collections, seasonal styles, and outfit inspiration — every card explains why it is shown and where it came from, supports save/follow/hide/report, and (at Plus+) trend relevance subtly re-ranks daily outfit recommendations without ever overriding practicality.
- **Why now:** The engine (P09) must exist first because trend signals enter only through its stage-6 soft scorer ([09 §4](../09-recommendation-engine.md)); the closet and profile (P06–P07, P03) must exist to personalize against. P12 sits before P14 hardening so its content pipeline and moderation surface are included in the launch qualification.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-TRD-010 | Feed is personalized (preferences, closet, region, season, climate, follows, feedback) — never generic | AC-4 |
| REQ-TRD-020 | Content covers trends, runway, seasonal styles, inspiration, relevant categories/designers/colors/silhouettes/materials | AC-3 |
| REQ-TRD-030 | Every feed item explains why it is shown | AC-5 |
| REQ-TRD-040 | Provenance, attribution, freshness on all content; dedup across sources | AC-2, AC-6 |
| REQ-TRD-050 | Licensing/copyright respected; no unauthorized scraping as foundation | AC-1 |
| REQ-TRD-060 | Idempotent ingestion jobs, editorial-quality rules, moderation, content safety, source-disappearance handling | AC-2, AC-7 |
| REQ-TRD-070 | Fashion knowledge separated from suitability; trend influence only via post-constraint stage | AC-8 |
| REQ-TRD-080 | Hide/unfollow/not-interested feed personalization, honored immediately | AC-5 |
| REQ-REC-160 *(secondary; primary P09)* | Trends influence ranking only after hard constraints are satisfied | AC-8 |
| NFR-SEC-090 *(partial; with P06, P14)* | Moderation covers ingested fashion content | AC-7 |

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P09** (per SPINE §5). Practically also consumes P03 (profile), P06–P07 (closet composition, taxonomy, embeddings), P02 (outbox/jobs/admin skeleton) — all earlier in the DAG.
- External blockers: **OQ-05** (which licensed sources/partners, at what cost) — the P12-T01 sourcing spike must close it before any build task starts; **RISK-03** (content licensing); **ASM-04** (licensable content exists at viable cost). Doc 11 §16 moderation policy applies.

## 4. In scope / out of scope

**In scope:** source register with rights basis per source; ingestion jobs (fetch → validate → dedup → summarize → taxonomy-map → publish) with provenance and freshness; content retirement on source disappearance; moderation/quarantine via `admin`; deterministic feed personalization (embeddings + rules) with per-item why-shown reasons; Discover UI with save/follow/hide/report and all states; hide/unfollow signals honored on next refresh; trend-relevance port consumed by the engine's stage-6 scorer (`RC-TREND-*`, weight cap 0.03 per [09 §4](../09-recommendation-engine.md)); tier gating seams (`trends.level`: basic at Essentials, personalized at Plus+ — enforcement activates fully in P13); ingestion observability.

**Out of scope / non-goals:** any scraping or source without a documented rights basis (prohibited, [00 §5](../00-product-vision-and-scope.md)); commerce/shopping links; user-generated or social content; per-user LLM summarization (summaries are per-content-item, amortized — [10 §2.8](../10-ai-usage-cost-and-evaluation.md)); trend influence anywhere except engine stage 6 (no feed→outfit shortcut); paywall UI (P13); localization.

## 5. Product/UX behavior

Owned journey: [02 §10](../02-user-journeys-and-information-architecture.md) (Discover). Cover every state: **empty · loading · partial · failure · retry · recovery · offline · accessibility**.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Discover feed | Personalized cards (trend/runway/seasonal/inspiration) with why-shown + source attribution; pull-to-refresh | Starter feed seeded from onboarding preferences + region/season, labeled "Getting to know your style" | Fetch failure → cached content + retry banner; below quality floor → "less new content today" note, never padding | Cached feed readable; save/hide/follow actions queue via the shared mutation queue | Cards have full text alternatives; "why shown" reachable per card; hide/report in accessibility actions menu ([02 §13.2](../02-user-journeys-and-information-architecture.md)) |
| Card detail | Full content, attribution, license line, "pairs with your …" closet connection when applicable | n/a (card always has content) | Image load failure → text content + retry | Cached detail if previously opened; otherwise "needs connection" | Alt text from structured summary; attribution announced |
| Hide / unfollow / not-interested | Immediate removal from current feed; absent from next refresh; signal logged | — | Signal write failure → optimistic UI + queued retry (idempotent) | Queued; applied on sync | Undo snackbar with non-timed equivalent (feed settings list) |
| Follow source/designer | Followed entity boosts future matching | — | Same queued-retry pattern | Queued | Standard toggle semantics announced |
| Tier gating (P13 activates billing) | Plus+ sees personalized feed; Essentials sees basic trends | Free: Discover tab shows explanatory upgrade card — not a blurred tease wall | Entitlement check fail-closed server-side; typed `ENTITLEMENT_REQUIRED` renders upsell | Cached entitlements honored per [12 §3.3](../12-pricing-entitlements-and-unit-economics.md) | Upgrade card fully readable; no dismiss-blocking |
| Report content | Report reasons sheet → moderation queue entry → confirmation | — | Queued retry | Queued | Reachable via accessibility actions |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); update each touched module's contract file.

| Module | Change | Contract update needed? |
|---|---|---|
| `fashion-intel` | New module implementation: sources register, content_items, ingestion pipeline, personalization signals, feed query service, trend-relevance port (provider side) | Yes — new module contract |
| `recommendation` | Activate stage-6 trend scorer: consume trend-relevance port, `RC-TREND-*` reason codes, weight 0.03 within clamp; zero before this phase | Yes — note trend-port dependency |
| `admin` | Moderation queue accepts fashion-intel quarantine + user reports; editor spot-check queue for summaries ([10 §2.8](../10-ai-usage-cost-and-evaluation.md)) | Yes |
| `shared-kernel` | `RC-TREND-*` reason-code entries finalized; content-type/source-rights enums | Yes (single-writer task) |
| `platform` | Content-source fetch adapters behind a `ContentSourcePort` (one adapter per licensed source/API); summarization via existing `ExplanationPort`-family LLM port | Yes — port additions |
| `billing` | None beyond consuming the existing entitlement-check seam (`trends.level`) | No |

Arch rules enforced: no `fashion-intel → outfit`/renderer edge; `recommendation` reads trend relevance only through the port (`just arch-check` rule added).

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`): `GET /feed` (cursor-paginated, tier-shaped), `GET /feed/items/:id`, `POST /feed/items/:id/signal` (save|hide|not_interested|report), `POST /feed/follows` + `DELETE /feed/follows/:id`, admin: `GET/POST /admin/moderation/content` (extends existing moderation surface).
- Event schemas added/changed: `fashionintel.content.ingested.v1`, `fashionintel.content.retired.v1`, `fashionintel.content.quarantined.v1`, `fashionintel.signal.recorded.v1` (envelope per doc 06).
- DB migrations (Drizzle): `sources` (id, name, rights_basis, license_ref, contract_ref, status, added_at), `content_items` (source_id, content_type, canonical_url/ref, license/attribution fields, fetch_time, freshness/expiry, dedup_hash, embedding vector, structured summary, taxonomy IDs, state: `draft|published|quarantined|retired`), `personalization_signals` (user, kind: save|hide|follow|not_interested|report, target, created_at), plus indexes (pgvector HNSW on content embeddings). Forward + rollback per doc 06 expand/contract policy; no destructive change to existing tables.
- Generated clients to regenerate: TS mobile client, worker Python models (`just generate`).

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Discover tab: feed list, card detail, why-shown affordance, attribution display, save/follow/hide/report, starter-feed empty state, offline cache + queued signals, upgrade card |
| Backend | `fashion-intel` module (ingestion orchestration, feed query, personalization matching, trend-relevance port); `recommendation` stage-6 activation; `admin` moderation extension |
| Workers (ML/media) | None new — summarization + embedding calls go through existing LLM/embedding ports from Trigger.dev tasks |
| Data / migrations | Tables + indexes per §7; seed: synthetic licensed-sample content fixtures in `packages/seed-data` |
| Infrastructure | Trigger.dev scheduled ingestion tasks per source (idempotent, per-source `concurrencyKey`); kill-switch flag for trend summarization ([10 §6.3](../10-ai-usage-cost-and-evaluation.md) rung 2) |
| 3D / assets | None |
| Admin / internal tools | Moderation queue view for content, source register CRUD (rights basis mandatory field — cannot save a source without one), editor spot-check queue |

## 9. AI vs deterministic decisions

Owning rows: [10 §1 #9, §2.8](../10-ai-usage-cost-and-evaluation.md).

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Trend/runway summarization → structured taxonomy summary | NL (Claude Haiku batch + cache), once per content item, never per user | Editorial text/images → taxonomy terms is an NL task | Pause summarization (kill-switch rung 2); feed serves existing summaries | < $0.005/content item amortized; ~$0.0001–0.001 per user/mo |
| Feed↔user matching (why-shown) | **Deterministic**: rules over preferences/closet/region/season/follows + precomputed embedding similarity reads | Matching is rules + vector reads; no inference call at request time | n/a (deterministic) | $0 marginal |
| Dedup across sources | Deterministic hash first, then embedding cosine (reads stored vectors) | Exact dup = hash; near-dup needs perceptual similarity | Hash-only dedup, backfill later | ≤ $0.0005/item (embedding, one-time) |
| Content safety screen | CV/provider safety filter on ingested imagery before publish | Perceptual judgment | Quarantine on classifier unavailability (fail-closed to moderation) | within ingestion job budget |
| Trend influence on recommendations | **Deterministic** — engine stage-6 scorer reads stored relevance scores | [09 §0](../09-recommendation-engine.md) invariants; no model in decision path | Weight 0 (feature flag) → engine identical to P09 | $0 marginal |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11 §6](../11-security-privacy-and-compliance.md)): licensed content = **S0**; personalization signals (saves/hides/follows) = **S1/S2** behavioral data tied to `user_id` — no new S3 data.
- Consent required / consent UI changes: none new — feed personalization uses data already collected under `core_service`; analytics events remain gated by the `analytics` purpose.
- Retention, deletion, and export impact: personalization signals deleted in the account-deletion cascade and included in export; retired/quarantined content excluded from serving; takedown path — a rights-holder request retires content within 24 h (admin action, audited).
- Threat/abuse cases added to the threat model: content-source compromise feeding malicious payloads (rights-validated sources only, media re-hosted through our pipeline scanning); scraping of our licensed content (authenticated, rate-limited reads per [11 §3.3](../11-security-privacy-and-compliance.md)); report-flooding abuse (rate limits on report endpoint).

## 11. Observability and analytics added in this phase

Per [14 §15](../14-observability-operations-and-analytics.md) P12 row.

- Logs/metrics/traces: ingestion job metrics (`queue.job.*` tagged `job_type=trend_ingestion`), per-source fetch failures, content freshness age, dedup collapse rate, quarantine count by reason, summarization cost (`ai.cost_usd{task=trend_summary}`), feed query latency.
- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `trend_item_viewed`, `trend_item_hidden` (with `content_type`, `reason_shown`); hide-rate per source is the kill signal per [00 §8.2](../00-product-vision-and-scope.md).
- Alerts/dashboards/runbook entries: pipeline dashboard panels for ingestion; SEV3 alert on source failing > 48 h; content-provenance audit entries (source register changes, takedowns, moderation decisions) in the audit trail; runbook addition: "content source outage / takedown request".

## 12. Ordered tasks

Small enough for one AI-assisted session each. Task IDs `P12-T##`.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P12-T01 | **Sourcing spike (gate):** licensing outreach/cost sheet per candidate source, rights-basis register drafted, build/descope decision logged as DEC (closes OQ-05; RISK-03 kill check) | — | 2 (calendar time longer; human-led) |
| P12-T02 | Contracts + shared-kernel: feed API, event schemas, content/source enums, `RC-TREND-*` codes; `just generate` | T01 = build | 1 |
| P12-T03 | Migrations: `sources`, `content_items`, `personalization_signals` + indexes; seed fixtures | T02 | 1 |
| P12-T04 | Source register service + admin CRUD (rights basis mandatory); takedown/retire action | T03 | 1 |
| P12-T05 | Ingestion job v1: fetch adapter for first licensed source → validate → hash dedup → publish draft; idempotency + retries | T03, T04 | 2 |
| P12-T06 | Ingestion enrichment: embedding dedup, summarization via LLM port (batch), taxonomy mapping with reject-unknown-IDs, content-safety screen → quarantine | T05 | 2 |
| P12-T07 | Freshness/retirement: expiry aging, source-disappearance graceful retirement, `content.retired` events | T05 | 1 |
| P12-T08 | Moderation: quarantine wiring into `admin` queue, user-report endpoint, editor spot-check queue | T05 | 1 |
| P12-T09 | Feed personalization service: deterministic matching (preferences, closet composition, region/season/climate, follows, feedback), why-shown reason assembly, tier-shaped query (`trends.level` seam), starter feed | T03, T06 | 2 |
| P12-T10 | Signals: save/hide/follow/not-interested/report persistence, immediate next-refresh honoring, idempotent offline sync | T09 | 1 |
| P12-T11 | Trend-relevance port + engine stage-6 activation: per-user item/attribute relevance scores, `RC-TREND-*` emission, weight 0.03 behind flag; extend SIM suite (trend can never resurrect an excluded outfit) | T09; single-writer on `recommendation` | 2 |
| P12-T12 | Mobile Discover: feed list + card detail + why-shown + attribution + all §5 states | T02 (client), T09 (API live) | 2 |
| P12-T13 | Mobile signals UI: save/follow/hide/report + offline queue + upgrade card | T12, T10 | 1 |
| P12-T14 | Observability + analytics events + runbook entry (§11) | T05–T11 | 1 |
| P12-T15 | Eval + qualification: summarization taxonomy-mapping eval (≥ 90 % precision), two-profile feed-difference test, full test pass, demo, docs, PROGRESS | all | 1 |

## 13. Parallelization

- Can run in parallel: **{T05, T04}** after T03 (disjoint: ingestion task code vs admin service); **{T07, T08}** after T05; **{T09}** vs **{T07, T08}** (feed query vs pipeline maintenance — disjoint files); **{T12}** UI scaffolding against generated client fixtures while T09 lands server-side; **{T14}** alongside T12/T13.
- Must be serial: T01 gates everything (no build before a licensed source exists); T02 (contracts + shared-kernel are single-writer, land first per [15 §12.3](../15-team-workflow-and-ai-agent-operations.md)); T03 before all persistence work; T11 is single-writer on `recommendation` and must not run parallel to any other engine change; T15 last.

## 14. Test-first plan (by module and level)

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `fashion-intel` | Rights-basis validation (source without basis unpersistable); freshness/retirement logic; why-shown assembly; dedup thresholds | Personalization determinism: same profile+closet+content set ⇒ identical feed order; hide ⇒ item absent for all subsequent refreshes | Feed API + event schemas validate against `packages/contracts`; recorded-fixture contract test per source adapter | Ingestion job idempotency (run twice, one content row); quarantine excluded from serving; Testcontainers pg + pgvector | Maestro: open Discover → why-shown → hide → refresh shows item gone |
| `recommendation` | Trend scorer clamp (≤ 0.03 contribution); `RC-TREND-*` emitted only from stage 6 | Trend bonus never changes hard-constraint outcomes (extends [13 §11](../13-testing-quality-and-performance.md) invariants) | Result schema unchanged (additive reason codes only) | SIM suite extension: SIM-01 rerun with max trend boost — still zero violations | — |
| `admin` | Moderation state transitions for content | — | Admin endpoints in contract | Report → queue → quarantine → excluded-from-feed round trip | — |
| Mobile `features/discover` | Card/why-shown/attribution components; state machines for §5 states | — | Generated client only | Offline signal queue drain (MSW) | Golden snapshots for empty/failure/upgrade states |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Feed query p95 ≤ 400 ms (cursor page, warm); ingestion job per item p95 ≤ hours-class SLA per [10 §2.8](../10-ai-usage-cost-and-evaluation.md) | API metrics + job metrics dashboards |
| Cost | Summarization < $0.005/content item; trend AI share ≤ $0.001/user/mo amortized; embedding ≤ $0.0005/item one-time | `ai.cost_usd{task}` metrics vs provider bills |
| AI quality | Taxonomy-mapping precision ≥ 90 % (editor spot-check eval, [10 §2.8](../10-ai-usage-cost-and-evaluation.md)); invalid-taxonomy-ID rate < 0.5 % | `just ml-eval` trend suite + spot-check queue stats |
| Reliability | Ingestion idempotency: zero duplicate published items on replay; source outage degrades to aged-out content with no feed error | Integration suite + `pipeline.*` metrics |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): `discover-feed` (mobile tab visibility; owner ML; expiry ≤ 90 d after full rollout), `engine-trend-scorer` (stage-6 weight on/off; owner BE; becomes permanent kill-switch class, listed in runbook 10), `trend-summarization` (permanent kill-switch, [10 §6.3](../10-ai-usage-cost-and-evaluation.md) rung 2).
- Migration/backward-compatibility plan: all schema additive; engine results remain schema-compatible (new reason codes are additive within the registry version); clients without the Discover tab are unaffected.
- Rollback plan: (1) `engine-trend-scorer` off → engine byte-identical to P09 behavior (verified by replay test); (2) `discover-feed` off → tab hidden, ingestion keeps running or is paused via task disable; (3) DB rollback via `just db-rollback` (tables are new, contract-phase only); (4) full descope path = RISK-03 kill criterion (below).

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); add phase-local ones there, not here.

- Risks in play: **RISK-03** (content licensing — primary), RISK-08 (AI cost), RISK-16 (scope — P12 feed is first on the cut ladder), ASM-04, OQ-05.
- **Stop/kill criteria for this phase:**
  - T01 finds no licensable source within content budget → **descope the trend feed to closet-derived inspiration** (deterministic, zero licensing), log DEC, close the phase at that reduced scope (RISK-03 kill criterion). An unlicensed feed never launches.
  - Simulation shows any trend-induced hard-constraint violation → `engine-trend-scorer` stays off; sev-2 defect; phase cannot pass AC-8 until zero.
  - Post-launch hide-rate kill signal per source ([00 §8.2](../00-product-vision-and-scope.md)) → source curation action, not a phase blocker.

## 18. Demo script

On a real device against staging, two test users with different profiles/closets (from `packages/seed-data` personas):

1. `just db-seed` staging personas; run one full ingestion cycle for the licensed source (`trigger.dev` task run visible in dashboard).
2. As user A (minimal profile): open Discover → starter feed labeled "Getting to know your style"; every card shows source attribution.
3. As user B (rich profile + 100-item closet): open Discover → visibly different feed; tap "why you're seeing this" on a card → reasons name concrete inputs (e.g. region/season + a followed designer + closet composition).
4. Hide a designer's card → confirm immediate removal; pull-to-refresh → that designer's content absent.
5. Report a card → show it appearing in the admin moderation queue; quarantine it → refresh → gone from feed.
6. Airplane mode → Discover still shows cached feed; save a card offline → reconnect → save synced.
7. Request today's recommendation as user B with `engine-trend-scorer` on: result shows an `RC-TREND-*` reason chip on a re-ranked near-tie; run `just rec-replay <id>` to show trend contribution capped in the trace. Flip weather fixture to −5 °C with a trending-shorts content item present → no shorts outfit appears (SIM-01 live confirmation).
8. Show ingestion dashboard panels (job counts, dedup collapses, cost) and the source register with rights basis per source.

## 19. Acceptance criteria

Objectively verifiable statements — no "works well".

- AC-1: Every row in `sources` has a non-null, reviewed rights basis (license, API terms, or owned content); a source insert without one is rejected by test and by admin UI. Zero content rows reference a source outside the register.
- AC-2: Replaying any ingestion event/job produces zero duplicate published content rows (idempotency test output attached); every published content row stores source, license/attribution, fetch time, and freshness expiry.
- AC-3: Each content type (trend, runway, seasonal, inspiration) exists in the ingestion taxonomy and at least one item of each renders in the feed in the demo.
- AC-4: The two-profile test asserts feed difference: overlap of top-20 items between seeded users A and B is below the documented threshold, and each feed item's stored personalization inputs are queryable.
- AC-5: 100 % of rendered feed cards display a why-shown reason derived from stored personalization inputs (UI test); a hide signal removes the target from the next refresh (integration test) and is recorded for personalization.
- AC-6: Duplicate stories across two fixture sources collapse into one published item (hash + embedding dedup test).
- AC-7: Quarantined/reported content is excluded from all feed queries (test), and retiring a source retires its content gracefully with no feed errors.
- AC-8: The extended simulation suite passes with the trend scorer at maximum clamp: zero hard-constraint violations across all scenarios; the arch-check forbids any `fashion-intel` import path into `outfit`/renderer and any engine access to trend data except via the port.
- AC-9: `just ml-eval` trend-summarization suite reports taxonomy-mapping precision ≥ 90 % and invalid-ID rate < 0.5 % on the versioned eval set.

## 20. Definition of done

Exact commands and evidence required:

```bash
just test fashion-intel      # all pass, no skips
just test recommendation     # incl. extended simulation suite, zero violations
just test admin
just lint && just typecheck  # clean
just arch-check              # module boundaries hold (incl. new trend-port rules)
just generate --check        # contracts fresh
just ml-eval --suite trend-summary   # ≥ thresholds in §15
just ci-parity               # green before phase-closing PR
```

Evidence to attach/link: ingestion-run dashboard screenshot; two-profile feed diff test output; SIM suite output (0 violations) with trend scorer at max; eval report; demo recording per §18; signed-off sourcing decision (DEC entry). Never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: new `docs/modules/fashion-intel.md` module contract; `recommendation` contract (trend port); [09](../09-recommendation-engine.md) §4 note that RC-TREND is active; doc 16: DEC entry for sourcing outcome, close OQ-05, update RISK-03/ASM-04; doc 14 runbook addition; source register linked from doc 11 takedown process.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence; note descope explicitly if RISK-03 kill fired.

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md). Expected content: next phase is **P13 — Monetization and entitlements** (`phases/P13-monetization-and-entitlements.md`, start at P13-T01 store-compliance spike; first command: `just doctor` then read the P13 file and [12](../12-pricing-entitlements-and-unit-economics.md)). Flag to P13: the `trends.level` seam is live and waiting for real tier grants; if P12 was descoped, P13 must remove `trends.level` from paywall copy (record in DEC).
