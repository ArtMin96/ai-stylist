---
name: fashion-intel-ingestion
description: Build or change the `fashion-intel` module (apps/api/src/modules/fashion-intel) — the licensed-content source register (rights basis mandatory per source), the ingestion pipeline (fetch → validate → dedup → LLM summarize → taxonomy-map → publish), freshness/retirement of aging content, moderation/quarantine wiring into `admin`, deterministic feed personalization with why-shown reasons, the `trends.level` tier seam, and the trend-relevance port the recommendation engine's stage-6 soft scorer reads. Use when asked to add a content source, fix ingestion dedup or freshness, wire a `RC-TREND-*` reason code, add a Discover feed field, or work anything under planning/phases/P12-fashion-intelligence.md. Not for scoring or ranking outfits, or anything inside apps/api/src/modules/recommendation/ — use `recommendation-rules`; not for generic pg-boss job scaffolding, worker plumbing, or provider-call caching mechanics with no fashion-intel-specific rule — use `media-ml-pipeline`.

metadata:
  modules: fashion-intel
  last-reviewed: 2026-09-13
  owner-agent: recommendation-engineer
---

# Fashion-Intel Ingestion & Feed

## Trigger

- Any change inside `apps/api/src/modules/fashion-intel/` — currently a skeleton
  (`docs/modules/fashion-intel.md` status); real build is phase P12
  (`planning/phases/P12-fashion-intelligence.md`), gated on its sourcing spike (P12-T01) closing
  OQ-05 before any build task starts.
- Source register work: adding/removing a licensed source, its rights basis, or a takedown/retire
  action (admin CRUD, P12 §8).
- Ingestion pipeline work: fetch adapters, hash/embedding dedup, LLM-based summarization behind the
  existing `ExplanationPort`-family LLM port, taxonomy mapping, content-safety screening, freshness
  aging, or source-disappearance retirement (P12 §6, §9, §12 tasks P12-T04 through P12-T07).
- Feed personalization: deterministic matching against preferences/closet/region/season/follows/
  feedback, why-shown reason assembly, the `trends.level` tier seam, or the trend-relevance port
  consumed by `recommendation`'s stage-6 scorer (P12-T09, P12-T11).
- Do first, then return here: `api-contract-change` (the feed API, event schemas, and
  `RC-TREND-*` codes in P12-T02 are contract/shared-kernel work, single-writer, before this module's
  code consumes them), `db-migration` (the `sources`/`content_items`/`personalization_signals`
  tables in P12-T03).

## Required reading

1. `docs/modules/fashion-intel.md` — current status (skeleton), invariants, allowed/forbidden
   dependencies (only `profile` and `closet` today per the module dependency graph — outfit,
   recommendation, and the renderer are not reachable from here).
2. `planning/phases/P12-fashion-intelligence.md` — full phase file: §4 (in/out of scope), §6
   (module changes and the arch rule "no `fashion-intel → outfit`/renderer edge; `recommendation`
   reads trend relevance only through the port"), §7 (endpoints, events, tables), §9 (AI vs
   deterministic — summarization and dedup are the only AI calls; matching and trend influence are
   deterministic), §10 (S0/S1/S2 data classification, takedown SLA), §12 (ordered tasks P12-T01
   through P12-T15).
3. `planning/09-recommendation-engine.md` §4 — the stage-6 soft-scoring stage this module's
   trend-relevance port feeds; the weight cap (0.03) and `RC-TREND-*` reason codes live there, not
   in this module.
4. `planning/10-ai-usage-cost-and-evaluation.md` §2.8 — the summarization AI-usage entry (per-item,
   never per-user; cost/cache/fallback/eval requirements) that any new or changed summarization call
   must satisfy per root `CLAUDE.md`'s AI-usage rule.
5. `apps/api/src/modules/fashion-intel/index.ts` and the `admin` module's `index.ts` — what is
   already public for moderation wiring.

## Workflow

1. Confirm the sourcing gate: P12-T01 (rights-basis register + build/descope DEC, closing OQ-05)
   must be logged before any ingestion-pipeline build task starts. If you cannot find that DEC, this
   is design/contract work only — say so rather than building an adapter for an unlicensed source.
2. A new content source is a `ContentSourcePort` implementation (one adapter per source) bound in
   `apps/api/src/platform/`, never a direct fetch call from inside `fashion-intel`'s domain code —
   the module decides what to do with fetched content, the adapter only fetches it.
3. Every pipeline stage writes an auditable state transition on `content_items`
   (`draft → published → quarantined → retired`, P12 §7); do not skip stages or short-circuit
   dedup/safety-screen checks even under load — the safety screen is fail-closed to quarantine, not
   fail-open to publish (P12 §9).
4. Summarization is per-content-item and cached by content hash, never per-user (P12 §4 non-goal:
   "per-user LLM summarization"); if a change would call the LLM port once per feed request instead
   of once per ingested item, that is the AI-cost invariant breaking — stop and redesign around the
   cache.
5. Feed matching and trend-relevance scoring are deterministic reads over stored preferences,
   embeddings, and rules — no inference call at feed-request time (P12 §9). If a task asks for an
   LLM call inside the feed-serving path, that is out of scope for this module's deterministic
   design; escalate rather than adding it.
6. The trend-relevance port is the _only_ channel `recommendation` may read this module's data
   through; the reverse edge (`fashion-intel` importing `outfit`, `recommendation`'s internals, or
   anything renderer-related) is forbidden by the module dependency graph
   (`allowed-edges-only` arch-check rule) — `fashion-intel`'s allowed dependencies are `profile` and
   `closet` only.
7. Moderation: quarantined content and user reports route into `admin`'s existing moderation queue
   via its public API, never a new parallel moderation surface inside `fashion-intel`.
8. Tests in `apps/api/src/modules/fashion-intel/tests/`: unit for dedup/freshness/personalization
   rules, contract tests for the feed API and events, Testcontainers integration where the pgvector
   embedding index or repositories are exercised. P12-T15 adds the taxonomy-mapping eval (≥ 90%
   precision) and a two-profile feed-difference test — reuse those, do not fork a second eval
   harness.

## Validation commands

```bash
just test fashion-intel
just lint && just typecheck && just arch-check    # arch-check enforces the fashion-intel dependency graph
just generate --check                              # only if the feed API, events, or RC-TREND-* codes changed
just ml-eval                                        # taxonomy-mapping / summarization eval, once P12-T15 exists
just security-scan                                  # content-source adapters touch external fetches
just ci-parity                                      # before PR
```

## Output

- A diff scoped to `apps/api/src/modules/fashion-intel/` (plus `packages/contracts`/
  `packages/db` in their own commits when the feed API, events, or tables changed, and
  `apps/api/src/platform/` for a new `ContentSourcePort` adapter), with real test output;
  `docs/modules/fashion-intel.md` updated when the public surface, invariants, events, or
  dependencies changed.

Done checklist: scoped tests green · `lint`/`typecheck`/`arch-check` green (no forbidden edge to
`outfit`/`recommendation`/renderer) · every content-source fetch behind a `ContentSourcePort`
adapter · summarization cached per content-item, never per-user · quarantine/report flow lands in
`admin`'s existing queue · contract doc updated · `PROGRESS.md` updated.

## Stop / escalation

- No rights-basis on record for a source, or P12-T01's DEC is missing → stop; this is
  `RISK-03`/`OQ-05` territory, not something to route around with a "best-effort" fetch.
- A task asks `fashion-intel` to import `outfit`, `recommendation`'s internals, or anything
  renderer-related → forbidden edge; the trend-relevance port is the only sanctioned channel — stop
  and redirect to the port design instead.
- A task asks for scoring/ranking of outfits, or a second influence path into recommendations
  outside the stage-6 port → `recommendation-rules` owns that; stop rather than adding a shortcut
  here.
- Ingested imagery, licensing terms, or content-safety classification are ambiguous → `admin`
  moderation and `security-privacy-review` (content-source compromise, report-flooding abuse per
  P12 §10) before publish.
- A schema, endpoint, or reason-code change surfaces mid-task → pause, run `db-migration` /
  `api-contract-change` as their own step, then continue.

## Overlap

Adjacent: `api-contract-change` (feed API, event schemas, `RC-TREND-*` codes land in
`packages/contracts`/`shared-kernel` first), `db-migration` (`sources`/`content_items`/
`personalization_signals` tables first), `recommendation-rules` (owns stage-6 scoring itself and
every other engine rule; this skill only produces the relevance scores the port exposes),
`media-ml-pipeline` (owns the generic pg-boss job runner and LLM/embedding port _implementations_;
this skill owns the fashion-intel-specific pipeline stages and business rules that call them),
`admin-moderation` (owns the moderation queue UI/workflow this module's quarantine and reports feed
into), `assistant-chat` (may read this module's public feed query via `query_trends`, never its
internals), `architecture-review` (reviews the result). This skill owns
`apps/api/src/modules/fashion-intel/internal/`, its `index.ts`, and its `ContentSourcePort`/
trend-relevance port contracts.
