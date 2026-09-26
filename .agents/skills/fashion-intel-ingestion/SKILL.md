---
name: fashion-intel-ingestion
description: Build or change the `fashion-intel` module (apps/api/src/modules/fashion-intel) — the licensed-content source register (rights basis mandatory per source), the ingestion pipeline (fetch → validate → dedup → summarize → taxonomy-map → publish), freshness and retirement of aging content, quarantine events for moderation, deterministic Discover feed personalization with why-shown reasons, the `trends.level` tier seam, and the trend-relevance scores the recommendation engine's stage-6 scorer reads through a port. Use when asked to add a content source, fix ingestion dedup or freshness, wire `RC-TREND-*` relevance, add a Discover feed field, or work on anything in planning/phases/P12-fashion-intelligence.md. Not for scoring or ranking outfits, or anything inside apps/api/src/modules/recommendation/ — use `recommendation-rules`; not for the admin moderation queue itself — use `admin-moderation`; not for generic pg-boss job or worker plumbing — use `media-ml-pipeline`.
metadata:
  modules: fashion-intel
  last-reviewed: 2026-09-26
  owner-agent: recommendation-engineer
---

# Fashion-Intel Ingestion & Feed

## Trigger

- Any change inside `apps/api/src/modules/fashion-intel/`. Today it is a P02 skeleton (empty `FashionIntelModule`, an internal README, one smoke test). The real build is P12 (`planning/phases/P12-fashion-intelligence.md`), gated on the sourcing spike P12-T01 closing OQ-05 before any build task starts.
- Source register: adding or retiring a licensed source, its rights basis, a takedown (P12-T04).
- Ingestion: fetch adapters, hash/embedding dedup, summarization, taxonomy mapping, content-safety screen, freshness aging, source-disappearance retirement (P12-T05 to P12-T07).
- Feed: deterministic matching against preferences/closet/region/season/follows/feedback, why-shown reasons, the `trends.level` seam, the trend-relevance scores `recommendation` reads (P12-T09, P12-T11).
- Do first, then return: `api-contract-change` (feed API, event schemas, `RC-TREND-*` codes, the shared trend-relevance port interface — P12-T02, single-writer), `db-migration` (`sources`, `content_items`, `personalization_signals` — P12-T03).

## Required reading

1. `docs/modules/fashion-intel.md` — status (skeleton), invariants, allowed dependencies: `profile` and `closet` public APIs only.
2. `planning/phases/P12-fashion-intelligence.md` §4 (scope), §6 (module changes and arch rules), §7 (endpoints, events, tables), §9 (AI vs deterministic: summarization and dedup are the only AI calls), §10 (S0/S1/S2 classes, takedown SLA), §12 (tasks P12-T01 to P12-T15).
3. `planning/09-recommendation-engine.md` §4 — the stage-6 soft scorer; the weight cap (0.03) and `RC-TREND-*` live there, not here.
4. `planning/10-ai-usage-cost-and-evaluation.md` §2.8 — summarization: once per content item per prompt version, never per user; cost, cache, fallback, eval.
5. `tools/depcruise/rules.cjs` `ALLOWED_EDGES` — `fashion-intel` → `profile`, `closet`; nothing reaches `fashion-intel` except `assistant`. There is no edge between `fashion-intel` and `admin` or `recommendation` in either direction.

## Workflow

1. Confirm the sourcing gate: the P12-T01 DEC (rights-basis register + build/descope decision, closing OQ-05) must be in `planning/16-risks-open-questions-and-decision-log.md`. Without it, this is design work only; say so rather than building an adapter for an unlicensed source.
2. Search before write:

   ```bash
   git ls-files apps/api/src/modules/fashion-intel apps/api/src/platform
   rg -n -i 'source|rights|content_item|trend|feed|dedup|summar' apps/api/src packages/contracts packages/shared-kernel/registry
   ```

3. Copy the structure from the `backend-module` sibling table (`.agents/skills/backend-module/SKILL.md` Workflow step 4): port type + token shape `apps/api/src/platform/ports/health-probe.port.ts`, adapter `apps/api/src/platform/pg-health-probe.ts`, controller `apps/api/src/platform/version.controller.ts`, fake `packages/test-support/src/clock.ts`, module test `apps/api/src/modules/fashion-intel/tests/fashion-intel.smoke.test.ts`, event schema `packages/contracts/events/demo.event.json`.
4. A content source is a `ContentSourcePort` implementation (one adapter per source): the port is declared in `fashion-intel`'s `index.ts`, the adapter lives in `apps/api/src/platform/` (`platform-engineer`), and it is bound in `apps/api/src/app.module.ts`. The module decides what to do with fetched content; the adapter only fetches.
5. Summarization goes through a summarization port this module declares (doc 10 §2.8), cached by content hash and prompt version, called once per ingested item. No LLM port exists in code: `ExplanationPort` was removed (DEC-46), although `planning/phases/P12-fashion-intelligence.md` §6 still names it. The provider must be on the doc 10/11 approved list.
6. Every pipeline stage writes an auditable state transition on `content_items` (`draft → published → quarantined → retired`, P12 §7). The safety screen fails closed to quarantine, never open to publish, even under load.
7. Feed matching and trend relevance are deterministic reads over stored preferences, embeddings and rules — no model call at feed-request time (P12 §9).
8. `recommendation` reads trend relevance only through the stage-6 port. Neither module may import the other, so the port interface lives in `packages/shared-kernel` (two modules share it) and the composition root binds this module's implementation to it.
9. Moderation: quarantine and user reports leave this module as events (`fashionintel.content.quarantined.v1`, and `fashionintel.signal.recorded.v1` with kind `report`, P12 §7). `admin` consumes them; there is no import edge either way.
10. Tests in `apps/api/src/modules/fashion-intel/tests/`: unit tests for dedup, freshness and personalization rules with injected time; contract tests for the feed API and events. P12-T15 adds the taxonomy-mapping eval (≥ 90% precision) and a two-profile feed-difference test — extend those, never fork a second harness.

## Validation commands

```bash
just test fashion-intel
just lint && just typecheck && just arch-check    # arch-check enforces ALLOWED_EDGES
just generate --check                              # only if the feed API, events, or RC-TREND-* codes changed
just ml-eval                                       # stub (exit 2, P02-T17) until P12-T15; report "Not run: stub"
just security-scan                                 # content-source adapters fetch external data
just ci-parity                                     # before PR
```

## Output

- A diff scoped to `apps/api/src/modules/fashion-intel/` (plus `packages/contracts` / `packages/db` in their own commits when the feed API, events, or tables changed, and `apps/api/src/platform/` for a new adapter), with real test output; `docs/modules/fashion-intel.md` updated when the public surface, invariants, events, or dependencies changed. Report in the `agent-operating-contract` format.

Done checklist: scoped tests green · `lint`/`typecheck`/`arch-check` green · every fetch behind a `ContentSourcePort` adapter · summarization cached per content item, never per user · quarantine leaves as an event, no `admin` import · contract doc updated · `PROGRESS.md` line suggested.

## Stop / escalation

- No rights basis on record for a source, or P12-T01's DEC is missing → stop; `RISK-03`/`OQ-05` territory.
- The task needs pg-boss jobs, the outbox relay, or event consumption → unless P02-T08 is `DONE` in `planning/phases/P02-repo-foundations-and-ci.md` (`apps/api/src/jobs/README.md`), stop and sequence after it.
- The P12-T04 admin CRUD or the P12-T08 moderation wiring needs a synchronous call between `admin` and `fashion-intel` → doc 04 §4.1 allows neither direction; stop and ask the lead for the decision (events only, or an ADR adding an edge).
- A task asks `fashion-intel` to import `outfit`, `recommendation`, or anything renderer-related → forbidden edge; redirect to the port design.
- A task asks for outfit scoring or a second influence path into recommendations outside stage 6 → `recommendation-rules`.
- The trend-relevance port interface is not in `packages/shared-kernel` yet → request it via `api-contract-change` (P12-T02); do not declare a private copy.
- A model call at feed-request time, or per-user summarization → breaks doc 10 §2.8; stop and redesign around the cache.
- Ambiguous imagery, licensing terms, or safety classification → `security-privacy-review` (content-source compromise, report flooding, P12 §10) before publish.

## Overlap

Adjacent: `api-contract-change` (feed API, events, `RC-TREND-*`, the shared port interface land first), `db-migration` (`sources`/`content_items`/`personalization_signals` first), `recommendation-rules` (owns stage-6 scoring and the weight cap; this skill only produces the relevance scores the port exposes), `admin-moderation` (owns the moderation queue that consumes this module's quarantine events), `media-ml-pipeline` (owns pg-boss handler plumbing and embedding/LLM adapters), `assistant-chat` (may call this module's public feed query), `architecture-review` (reviews the result). This skill owns `apps/api/src/modules/fashion-intel/**`, its `ContentSourcePort` and summarization port declarations, and its side of the trend-relevance port.
