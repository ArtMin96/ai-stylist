# P07 — Closet Organization and Sync

> Amended 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — service consolidation: pg-boss jobs, owned server + Coolify, self-managed PostgreSQL, R2 delivery model).

> File name: `phases/P07-closet-organization-and-sync.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); write "None" explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P07 — Closet organization and sync
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Turn the captured closet into an organized, searchable wardrobe — taxonomy views, search/filter/sort, availability/laundry states, collections/capsules, season/color views, wear history with cost-per-wear — all working offline with deterministic conflict-handling sync.
- **User-visible outcome:** The user browses, searches, filters, and sorts their whole closet (including offline), marks items laundry/packed/lent, builds capsules, sees wear history and cost-per-wear, and edits anything with changes syncing safely across devices.
- **Why now:** P06 filled the closet; organization is what makes it a wardrobe rather than a photo roll, and it must exist before P09 — the engine's hard constraints consume exactly these attributes and availability states ([09-recommendation-engine.md](../09-recommendation-engine.md)).

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-ORG-010 | Extensible normalized taxonomy (P07 slice: views + registry-bump migration path proven; registry landed P06) | AC-1 |
| REQ-ORG-020 | Season + climate-suitability attributes, filterable | AC-2 |
| REQ-ORG-030 | Color palette: dominant + secondary in canonical values, user-correctable | AC-3 |
| REQ-ORG-040 | Category-specific attributes (pattern, material, cut, heel type, …) | AC-4 |
| REQ-ORG-050 | Functional attributes: warmth, breathability, water resistance, layering role, formality, dress code, activity | AC-5 |
| REQ-ORG-060 | Brand, size, purchase date, condition, care/laundry state, favorite, archive | AC-6 |
| REQ-ORG-070 | Wear history, frequency, last worn, cost-per-wear, notes (P07 slice: tracking + display; engine scoring in P09) | AC-7 |
| REQ-ORG-080 | Custom tags, saved filters, search, sort, collections/capsules, season views, color views | AC-8 |
| REQ-ORG-090 | Availability states `available/laundry/packed/lent/repair/archived` with easy changes | AC-9 |
| REQ-ORG-100 | Automatic-first with manual correction; one canonical source (P07 slice: organization surfaces) | AC-10 |
| REQ-ORG-110 | Prevent taxonomy drift, duplicate tags, inconsistent units, repeated derivation | AC-11 |
| REQ-ORG-120 | Offline browsing/editing with eventual sync and conflict handling | AC-12 |
| REQ-CAP-130 | Durable offline queues (P07 slice: full mutation sync beyond the P06 capture queue) | AC-12 |
| NFR-TST-020 | Property-based test suite for taxonomy invariants (P07 slice per doc 13 §4) | AC-13 |

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P06** (items, taxonomy registry, attribute rows, media derivatives) — per SPINE §5.
- External blockers: none external. Internal watch items: **RISK-13** (offline sync complexity — this phase's dominant risk) and **RISK-14** (taxonomy drift — quality gates live here). P04/P05 are NOT dependencies; this phase must not import anything from `avatar`.

## 4. In scope / out of scope

**In scope:** closet browse views (grid/list; grouping by category, season, color, formality, recency, wear); search (tsvector free text + structured attribute filters) and sort; saved filters (structured query objects); custom tags with dedupe suggestions + merge tool; collections/capsules; season and color views (canned saved filters); availability-state machine + bulk changes + wear-count laundry assists; lifecycle metadata CRUD (brand/size/purchase/condition/care/favorite/archive); wear events + derived wear stats + cost-per-wear; deterministic practical-attribute derivation rules (doc 08 §4.3) + user overrides; offline read-model store (expo-sqlite + Drizzle), mutation-log sync, delta pull (`/sync/changes`), conflict policy per [04 §8](../04-architecture.md); closet-item count seam remains dormant (P06 flag); taxonomy property tests + tag-hygiene metrics.

**Out of scope / non-goals for this phase:** recommendation candidacy logic and repeat-avoidance scoring (→ [P09](P09-recommendation-engine-v1.md)); outfit composition/saved outfits UI (`outfit` module → P09/P10); "did you wear this?" inference prompts beyond the opt-in setting stub (P09 feedback loop); wardrobe analytics dashboards (Plus-tier, → P13 gating; only cost-per-wear on the item ships here); multi-user closet sharing (not in v1); full offline recommendations (cached-only per doc 09; owned there).

## 5. Product/UX behavior

Journey detail owned by [02-user-journeys §7](../02-user-journeys-and-information-architecture.md); states summarized here.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Closet browse (grid/list) | Cached closet renders instantly; sync deltas apply in place with subtle indicators; grouping switcher | Empty closet → illustrated empty state, single primary action (Capture) + "how it works"; never an empty grid | Sync failure → non-blocking banner; local view stays browsable; per-item errors on the item tile | Full browse over the local index (metadata + thumbnails) | Grid tiles labeled (name, category, color, availability); grouping announced; dynamic type reflows |
| Search/filter/sort | Free text + structured chips; results as you type; saved-filter shortcut row | No results → suggestions to relax filters; filters warn when still-processing items are excluded | Search index rebuild on corruption (automatic, logged) | Search/filter/sort run entirely on the offline index | Filter chips are accessible toggles; result count announced |
| Item detail | All photos (provenance markers where relevant), attributes with confidence + edit, wear history, cost-per-wear (only when price supplied), notes, availability control, collections | Missing attributes → "add" affordances, provisional markers | Edit save failure → local retain + retry | Fully editable offline; edits queue | Every attribute row labeled; provenance/confidence conveyed in text |
| Availability changes | One-tap state chip among the six canonical states; optional metadata (return date for lent/packed); bulk select → "all packed" | — | Illegal transition impossible (UI only offers valid ones); server guard as backstop | State changes queue offline | State change announced; states also color-blind-safe (icon + label, doc 13 manual check) |
| Laundry assist | "Mark worn" can prompt laundry per user-tunable wear-count-per-category; defaults per doc 08 §6; never nagging | — | — | Works offline | Prompt dismissible; setting discoverable |
| Tags & collections | Tag creation shows existing-tag suggestions by prefix/similarity first; merge tool rewrites references; collections with ordered membership, item-in-many | No tags/collections → inline hints | Merge is transactional; failure leaves both tags intact | Create/edit offline | Tag pickers accessible; merge confirm labeled |
| Wear history | Mark outfit/item worn → wear event; item shows count, last worn, frequency, cost-per-wear = price ÷ max(wears,1), "based on your logged wears" | No wears → neutral "no wears logged yet" | — | Wear marks queue offline | Neutral, never guilt-framed copy (doc 08 §7 tone rule) |
| Two-device conflict | Edit same field on two devices offline → deterministic winner (server version); loser preserved as "conflicted copy" with one-tap re-apply | — | Conflict surfaced, never silent | Resolution occurs at sync | Conflict card screen-reader complete |

## 6. Domain and architecture changes (by owning module)

| Module | Change | Contract update needed? |
|---|---|---|
| `closet` | Availability-state machine + events; wear_events + materialized wear stats; tags/saved filters/collections; practical-attribute derivation rules (versioned, deterministic); search indexing (tsvector + attribute indexes); registry-bump migration/backfill job (doc 08 §12) | Yes |
| `profile` | Wear-count-per-wash preferences (per category) added to preferences | Yes |
| `platform` | Sync endpoint mechanics: change cursors, delta feed per module read-model; tombstone retention (30 d) | Yes |
| `shared-kernel` | Color-wheel ordering for the palette; availability-state enum (already SPINE §8) formalized as generated types; saved-filter query-object schema | Yes |
| `media` | None beyond serving thumbnails to the offline index (existing) | No |
| `recommendation` | **No change** — but `closet` public API now exposes everything doc 09 will consume (availability, practical attributes, wear stats); reviewed against doc 09 §inputs | No (consumer note only) |

Mobile: local store (expo-sqlite + Drizzle) mirroring read-model subsets of `closet`/`outfit`/`profile` + mutation log; image cache LRU disk budget default 512 MB (doc 04 §8).

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`):
  - `GET /v1/closet-items?filter=…&sort=…&q=…` (structured filter grammar from registry ids), `GET /v1/closet-items/search-index-meta`
  - `PATCH /v1/closet-items/{id}/availability` (state + optional metadata), `POST /v1/closet-items/bulk/availability`
  - `POST /v1/wear-events`, `GET /v1/closet-items/{id}/wear-history`
  - CRUD: `/v1/tags` (+ `POST /v1/tags/merge`), `/v1/saved-filters`, `/v1/collections` (+ membership ops)
  - `GET /v1/sync/changes?since=<cursor>` per module read-model (doc 04 §8 pull sync)
- Event schemas added/changed: `closet.item.availability_changed.v1` (activated with real consumers: recommendation cache invalidation later, sync now), `closet.item.updated.v1` payload extended additively (tags/collections refs), new `outfit.worn.v1` **stub schema only** (full producer in P09; schema landed now so wear_events ingestion is stable), new `closet.wear_event.recorded.v1`.
- DB migrations (Drizzle): wear_events, tags, saved_filters, collections (+membership), availability metadata columns, tsvector index (`CONCURRENTLY`), practical-attribute rule-version table, tombstones + change-cursor tables. Forward additive per doc 06 §7 expand–contract; each with tested down path.
- Generated clients to regenerate: mobile TS client (incl. saved-filter query-object types), event types, shared-kernel enums — `just generate`.

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Browse views + grouping; search/filter/sort UI over the local index; item detail edit surfaces; availability chips + bulk mode; tags/saved filters/collections UI; wear-history + cost-per-wear display; local store schema + mutation log + background drain + delta-pull client; conflicted-copy UX |
| Backend | `closet` endpoints (§7); state-machine guards; wear stats materialization (recompute on event); tag merge; derivation-rule engine + overrides; sync cursor/delta feed; tombstones |
| Workers (ML/media) | None (no new AI; derivation rules are deterministic TS in `closet`) |
| Data / migrations | §7 migrations; fixture closets (large: 500+ synthetic items for perf tests); labeled fixture set for derivation-rule tests; registry-bump test fixture (vN → vN+1 with split rule) |
| Infrastructure | tsvector + attribute indexes (built `CONCURRENTLY`); sync endpoint load profile added to k6 suite; offline-index size telemetry |
| 3D / assets | None |
| Admin / internal tools | Data-quality panel: `other`-rate, tag-hygiene, correction-rate, duplicate-rate trends (doc 08 §13) with drill-down |

## 9. AI vs deterministic decisions

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Practical attributes (warmth, breathability, water resistance, layering role, dress code, activity) | **Deterministic** versioned rules from material/insulation/length/category (doc 08 §4.3), user-overridable | Rule-derivable from confirmed attributes; an LLM would re-derive cached facts (NFR-AIC-010 violation) | User edits any value | $0 |
| Search/filter/sort | **Deterministic** (Postgres tsvector + indexed attribute rows; offline: SQLite queries) | Query problem, not perception | — | $0 |
| Season/color views | **Deterministic** (canned saved filters over `attr.season` + palette ordering) | Data grouping | — | $0 |
| Tag dedupe suggestions | **Deterministic** (prefix + case/similarity match per doc 08 §8) | String similarity suffices at tag scale | Allow creation anyway | $0 |
| Cost-per-wear, wear stats | **Deterministic** arithmetic, materialized on event | — | — | $0 |
| Sync conflict resolution | **Deterministic** per-field-class policy (doc 04 §8) | Correctness demands determinism | Conflicted-copy surfacing | $0 |

**This phase introduces zero AI calls.** Style-similarity reuse of P06 embeddings is deferred to P09/P12 (doc 08 §11).

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11 §6](../11-security-privacy-and-compliance.md)): wear history, tags, collections, saved filters — **S2** (wardrobe history explicitly listed; note LR-12: wardrobe data can make sensitive traits inferable — disclosure wording due P14). Offline device store holds S2 closet data: protected by OS app sandbox + device encryption; session rules per doc 11 §4.2; local store purged on sign-out and remote-wipe honored on account deletion.
- Consent required / consent UI changes: none new (`core_service` covers organization). Analytics events remain consent-gated.
- Retention, deletion, and export impact: wear events, tags, saved filters, collections join the deletion cascade and the export bundle (export adds wear history + collections per doc 11 §13.1); tombstones (sync) purge after 30 d and are covered by the cascade.
- Threat/abuse cases added to the threat model: sync endpoint enumeration/scraping → cursors are per-user, authorization on every delta row (user-isolation tests per doc 11 §4.3); conflicted-copy channel must not leak another user's data (property: all sync payloads scoped to the authenticated user).

## 11. Observability and analytics added in this phase

- Logs/metrics/traces: sync metrics — drain latency, queue depth on device (telemetry buckets), delta-feed latency p95, conflict rate per field class, tombstone counts; search latency (server + on-device buckets); derivation-rule version distribution; offline-index size distribution.
- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `closet_search_used` (`filter_types`, `result_count_bucket`), `item_availability_changed` (`state`), `collection_created` (`type`). Data-quality metrics from doc 08 §13 (tag hygiene, `other`-rate, availability freshness) get dashboard panels with owners.
- Alerts/dashboards/runbook entries: alert on sync conflict rate >2% of mutations (hypothesis threshold — RISK-13 signal) and on delta-feed p95 breach; dashboard: sync health (queue age, conflict classes), closet data-quality panel; runbook: "sync divergence investigation" (how to diff device state vs server, and how to force a clean re-pull without losing queued mutations).

## 12. Ordered tasks

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P07-T01 | Availability-state machine in `closet`: six canonical states + metadata, transition guards, bulk ops, `availability_changed` events; migrations | — | 1 |
| P07-T02 | Lifecycle metadata CRUD (brand table, size w/ region system, purchase, condition, care, favorite, archive+reason) | — | 1 |
| P07-T03 | Practical-attribute derivation rules (versioned, deterministic) + user overrides + fixture-based rule tests | — | 1–2 |
| P07-T04 | Wear events + materialized stats + cost-per-wear; `wear_event.recorded` + `outfit.worn` stub schemas | P07-T01 | 1 |
| P07-T05 | Tags (dedupe suggestions, merge tool), saved filters (structured query objects), collections/capsules — backend + contracts | — | 2 |
| P07-T06 | Server search: tsvector + attribute indexes (`CONCURRENTLY`), filter grammar, sort options | P07-T03 | 1–2 |
| P07-T07 | Mobile local store: expo-sqlite schema, read-model mirror, image cache LRU (512 MB), hydration from server | — | 2 |
| P07-T08 | Mutation-log sync: ordered durable log, background drain, `GET /sync/changes` delta pull with cursors, tombstones | P07-T07 | 2 |
| P07-T09 | Conflict policy implementation per doc 04 §8 classes 1–4 + conflicted-copy UX; two-device convergence test harness | P07-T08 | 2 |
| P07-T10 | Browse UI: grid/list, grouping (category/season/color/formality/recency/wear), season + color views | P07-T07 | 2 |
| P07-T11 | Search/filter/sort UI on the offline index + saved-filter row; offline parity tests | P07-T08, P07-T10 | 2 |
| P07-T12 | Item detail: attribute edit surfaces w/ confidence, availability chips, wear history, cost-per-wear, notes, collections membership | P07-T04, P07-T05, P07-T10 | 2 |
| P07-T13 | Laundry assist (wear-count-per-wash prefs in `profile`, prompt logic) + bulk availability UX | P07-T01, P07-T12 | 1 |
| P07-T14 | Taxonomy registry-bump drill: vN→vN+1 fixture with a split rule; backfill job; saved filters/tags survive the bump (doc 08 §12) | P07-T05, P07-T06 | 1 |
| P07-T15 | Property-test suite: taxonomy invariants (registry-ids-only, applicability map honored, derivation-rule monotonicity, state-machine safety, conflict-resolution determinism/idempotence) | P07-T01, T03, T09 | 1 |
| P07-T16 | Observability, analytics, data-quality admin panel, sync-health dashboard, runbook; k6 sync-load profile | P07-T08…T12 | 1 |

## 13. Parallelization

- Can run in parallel: backend **Group A** (T01, T02, T03, T05 — disjoint `closet` submodules/files, but their `packages/contracts` edits are single-writer: land schema PRs sequentially first) ∥ mobile **Group B** (T07 foundation). Then T04/T06 ∥ T08. UI wave: T10 ∥ T12-prep; after T08: T09 ∥ T11. Final: T13 ∥ T14 ∥ T15 ∥ T16.
- Must be serial: T07→T08→T09 (sync stack builds on itself — and RISK-13 says keep this stack single-owner, one engineer/agent track, to contain complexity); T10 before T11/T12; contracts changes sequenced (producers before consumers per [CLAUDE.md](../CLAUDE.md) parallel rules).

## 14. Test-first plan (by module and level)

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `closet` | State-machine transitions, cost-per-wear arithmetic, tag merge, derivation rules on fixtures | fast-check (NFR-TST-020): only registry ids persist; attribute applicability map never violated (shoe never gets neckline); availability transitions closed over the six states; derivation rules deterministic for same inputs + version | Filter grammar, saved-filter schema, all §7 endpoints vs OpenAPI; event schemas pinned | Testcontainers PG: search correctness incl. tsvector, registry-bump backfill (T14) preserves `source: user` and rewrites saved filters | — |
| `platform` (sync) | Cursor logic, tombstone purge | **Conflict resolution: deterministic, commutative-per-policy, idempotent — two-device operation sequences converge to identical state (REQ-ORG-120)**; losing user edits always surface as conflicted copies, never dropped | `/sync/changes` schema | Delta-feed under concurrent writers; user-isolation on sync rows (sec test) | — |
| `profile` | Wear-count-per-wash prefs | — | Prefs schema | — | — |
| Mobile | Local query parity (same filter → same results online/offline), LRU eviction | Mutation-log replay after crash yields identical state | Generated client compile | RNTL: browse/filter/detail/conflict-card flows | Maestro: full offline session (airplane mode: browse, search, edit attributes, change availability, favorite, add to collection → reconnect → converged server state); two-device convergence demo; a11y pass incl. color-blind check of color views; perf: 500-item closet scroll/search on low-tier device |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Closet browse first paint from cache <500 ms warm; search-as-you-type results <200 ms on-device (500-item closet, low tier); server search p95 <250 ms (doc 13 §12.2 CRUD class); sync drain of 50 queued mutations <10 s on reconnect; delta pull p95 <400 ms | Device-lane runs on the 500-item fixture closet; server dashboards; k6 sync profile |
| Cost | $0 new AI spend (§9); storage delta for wear/tags/sync tables negligible (<$1/mo at launch scale); no new providers | Cost dashboards (doc 14) |
| AI quality | n/a (no AI). Data-quality proxies owned here: tag near-duplicate pairs <5/100 tags; `other`-rate baseline recorded; availability-freshness metric baselined (doc 08 §13) | Data-quality admin panel |
| Reliability | Two-device convergence: 100% of generated operation sequences converge in the property suite; conflict rate <2% of mutations in beta (RISK-13 signal); zero lost mutations under kill/offline chaos tests; offline functional requirement verified (doc 13 §12.1 row) | Property suite + Maestro chaos runs + sync metrics |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): `offline-sync-v1` (owner MOB, expiry P09 start) — off ⇒ online-first with the P06 capture queue only (exactly the RISK-13 fallback posture); `laundry-assist` (owner PO, expiry P09) — prompt logic can be disabled without touching states.
- Migration/backward-compatibility plan: additive migrations; tsvector index built `CONCURRENTLY`; local-store schema carries its own version + migration functions (device DBs migrate on app update; a failed local migration falls back to full re-hydration from server — queued mutations preserved by version-tolerant log format). Registry bumps follow doc 08 §12 (additive minor safe for old clients; split/merge majors ship with migration rules — drilled in T14).
- Rollback plan: (1) flip `offline-sync-v1` off → devices switch to online reads + queued uploads; local data retained, no loss; (2) server rollback via `just db-rollback` per migration (down paths tested; tsvector index drop is safe); (3) mobile release rollback per staged-rollout policy; local store format is backward-tolerant one version (tested).

## 17. Risks, mitigations, assumptions, stop/kill criteria

- Risks in play: **RISK-13** (offline sync complexity — mitigations: scope limited to closet mutations, single-writer sync stack, conflict policy fixed up-front from doc 04 §8, `offline-sync-v1` flag as posture fallback), **RISK-14** (taxonomy drift — quality metrics + registry-bump drill live here), **RISK-16** (capacity). Assumption: ASM-06 (cadence).
- **Stop/kill criteria for this phase:**
  - **RISK-13 kill:** sync defects persist at P07 exit (convergence property suite red, or beta conflict-loss reports) → ship **online-first with queued uploads only** (`offline-sync-v1` off), move full offline editing to a later phase, log DEC. P07 can still be `DONE` on the reduced scope with the DEC recorded — P09 does not depend on offline editing.
  - Search/browse perf on the 500-item low-tier fixture misses budget by >2× after one optimization pass → cut on-device free-text search to prefix-only (structured filters unaffected), log DEC.
  - Registry-bump drill (T14) reveals migration-rule gaps → block any real taxonomy bump until fixed (this gates doc 08 §12 governance, not the phase itself).

## 18. Demo script

1. Start with the P06 demo closet (~30 items across all categories) on device A. Open Closet: grid renders instantly from cache; switch grouping to season, then color (palette-wheel order), then formality (AC-2, AC-8).
2. Search "linen" → free text hits; add filters: category=tops, season=summer, availability=available; sort by cost-per-wear; save as "summer office"; kill and reopen the app → saved filter persists (AC-8).
3. Open a shoe's detail: it exposes heel type but no neckline (applicability map); correct its dominant color via the palette picker (AC-3, AC-4).
4. Show functional attributes on a puffer (warmth 5, layering outer — rule-derived), override breathability manually; re-run derivation → override survives (AC-5, AC-10).
5. Set brand/size/purchase price on a jacket; mark it worn twice → wear count, last worn, and cost-per-wear = price÷2 render with the "based on your logged wears" label (AC-6, AC-7).
6. One-tap laundry on a tee; bulk-select 4 items → "packed" with a return date; verify laundry/packed items are visually muted and filterable (AC-9).
7. Create tag "Work"; attempt to create "work" → existing-tag suggestion; merge tool combines a deliberate duplicate pair (AC-11).
8. Build a "Lisbon trip" capsule; add an item to it and to a second collection (AC-8).
9. Airplane mode on device A: browse, search, edit an attribute, change availability, favorite an item, add to a collection — all work; reconnect → server state converges (AC-12).
10. Two-device conflict: edit the same item name offline on devices A and B with different values; sync both → deterministic winner, loser shown as a conflicted copy with one-tap re-apply (AC-12).
11. Run the registry-bump drill on staging: vN→vN+1 split rule migrates items, saved filters keep working, `source: user` categories retained (AC-1).
12. Show the data-quality admin panel (tag hygiene, `other`-rate) and the sync-health dashboard (AC-14).

## 19. Acceptance criteria

- AC-1: Categories/attributes render exclusively from the registry (no free-string category anywhere — property-tested); the vN→vN+1 bump drill migrates data by rule, ambiguous cases fall to `.other` + review nudge, saved filters and user tags survive via the mapping.
- AC-2: Season/climate fields exist on items, are filterable and user-overridable, and are exposed through the `closet` public API in the shape doc 09 consumes.
- AC-3: Dominant + secondary colors are stored as shared-kernel palette ids + raw hex, user-correctable; color-view browsing works in palette-wheel order.
- AC-4: Attribute schema varies by category per the applicability map — verified by the shoe/neckline test and its property generalization.
- AC-5: All six functional attributes are stored, editable, rule-derived deterministically (versioned rules), and override-able; overrides survive re-derivation.
- AC-6: Brand, size (+region system), purchase date/price, condition, care state, favorite, and archive are CRUD-complete; archive removes the item from default views and (by API contract) from future candidate sets without deletion; unarchive restores fully.
- AC-7: Marking worn creates wear events; wear count/last-worn/frequency materialize; cost-per-wear renders only when a price exists, computed as price ÷ max(wearCount, 1).
- AC-8: Custom tags, saved filters, search, sort, collections, season views, and color views are each demonstrated; saved filters persist across sessions and offline.
- AC-9: The availability machine implements exactly `available|laundry|packed|lent|repair|archived` (SPINE §8); transitions are one-tap + bulk; illegal transitions rejected server-side (test).
- AC-10: A manual correction updates the canonical record and is never overwritten by re-derivation (regression test); correction events flow to the eval dataset path per consent (doc 08 §10.3).
- AC-11: Tag creation dedupes case/prefix/similarity variants via suggestions; the merge tool rewrites references transactionally; units come only from shared-kernel; derived attributes are cache-keyed and not re-derived when inputs are unchanged (NFR-AIC-030 discipline — verified: zero derivation reruns on untouched items during the demo).
- AC-12: Full browse/search/filter/sort and all §5 edit types work in airplane mode; the two-device property/E2E suite converges deterministically; a losing edit is preserved as a conflicted copy — never silently dropped; kill-app chaos tests lose zero mutations.
- AC-13: The taxonomy/state/conflict property suites (doc 13 §4 set for P07) run in CI on every PR.
- AC-14: Data-quality panel and sync-health dashboard are live with owners; the conflict-rate alert exists.

## 20. Definition of done

```bash
just test closet && just test profile && just test platform   # all pass, no skips
just lint && just typecheck
just arch-check              # closet/avatar isolation intact; no renderer deps
just generate --check
just db-migrate && just db-rollback && just db-migrate        # a scratch database restored from the staging backup, up/down/up (incl. CONCURRENTLY index)
just ci-parity
# phase-specific: Maestro offline suite + two-device convergence run green on both platforms;
# 500-item low-tier perf run within §15 budgets; registry-bump drill output; k6 sync profile
```

Evidence to attach/link: convergence property-suite output, two-device demo video, offline session video, perf readouts (500-item fixture, low tier), registry-bump drill log, data-quality panel screenshot, migration up/down output. Never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: `docs/modules/{closet,profile,platform,shared-kernel}.md`; doc 08 marked as-built for §5–§9/§12; doc 04 §8 confirmed as-built (or DEC on any conflict-policy deviation); doc 16: DECs for any RISK-13 scope decision; doc 14 runbook "sync divergence investigation"; doc 13 §4 property-suite inventory updated.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence; note that **P09 is unblocked once P08 is also `ACCEPTED`** (P09 hard-depends on P07 + P08 per SPINE §5).

## 22. Handoff note

On P07 `ACCEPTED`: next session starts **P08-T01** (`phases/P08-context-providers.md`) if P08 has not run in parallel already (P08 depends only on P03), otherwise **P09-T01** (`phases/P09-recommendation-engine-v1.md`). First command: `just doctor`; then read the target phase file, and for P09 read [09-recommendation-engine.md](../09-recommendation-engine.md) §inputs against the `closet` public API shipped here.
