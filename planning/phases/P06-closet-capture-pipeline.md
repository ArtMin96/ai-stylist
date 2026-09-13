# P06 — Closet Capture Pipeline

> Amended 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — service consolidation: pg-boss jobs, owned server + Coolify, self-managed PostgreSQL, R2 delivery model).

> File name: `phases/P06-closet-capture-pipeline.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); write "None" explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P06 — Closet capture pipeline
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Ship the capture-to-catalog vertical: fast single-item and batch capture, durable resumable upload queue, the versioned media-pipeline state machine, on-device segmentation with server fallback, vision-LLM attribute extraction with user confirmation (corrections authoritative), embedding-based dedup, and the full taxonomy including shoes and accessories — with entitlement seams flag-gated dormant.
- **User-visible outcome:** A user photographs any garment, shoe, or accessory (one at a time or ten in a row, online or offline) and gets a background-removed, auto-classified, deduplicated catalog item they confirm or correct in one tap.
- **Why now:** The closet is the substrate of every later phase (organization P07, recommendations P09, try-on P11); it depends only on P03 (accounts/consent) and runs **in parallel with P04/P05** (SPINE §5 — no avatar dependency).

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-CAP-010 | Capture clothing, shoes, AND accessories via extensible taxonomy | AC-1 |
| REQ-CAP-020 | Fast single-item loop + batch capture (≥10 items, deferred confirmation) | AC-2 |
| REQ-CAP-030 | Front-only capture sufficient for a usable item | AC-3 |
| REQ-CAP-040 | Optional back/side/detail/label/material photos per item | AC-4 |
| REQ-CAP-050 | Background removal, perspective correction, color calibration, quality checks | AC-5 |
| REQ-CAP-060 | Auto category/attribute extraction with explicit user confirmation | AC-6 |
| REQ-CAP-100 | G-ladder separation of representations (P06 slice: G0 records with level; G2+ in P11) | AC-7 |
| REQ-CAP-110 | Failure/retry/manual-edit paths for wrong segmentation/classification | AC-8 |
| REQ-CAP-120 | Dedup via visual+semantic embeddings (pgvector), never filename | AC-9 |
| REQ-CAP-130 | Durable offline/interrupted upload queue with resume (P06 slice: capture queue; browse-sync in P07) | AC-10 |
| REQ-ORG-010 | Normalized extensible taxonomy registry (P06 slice: registry + classification use; views in P07) | AC-1 |
| REQ-ORG-100 | Automatic-first with manual correction; corrections canonical (P06 slice: capture-time corrections) | AC-6 |
| REQ-MED-010 | Versioned pipeline state machine with explicit stages | AC-11 |
| REQ-MED-020 | Immutable content hash + immutable original storage | AC-12 |
| REQ-MED-030 | Upload validation + malware/content checks, moderation/quarantine (P06 slice; hardening P14) | AC-13 |
| REQ-MED-040 | EXIF/privacy strip + orientation normalization before derived storage | AC-14 |
| REQ-MED-050 | Segmentation + quality scoring as stages with per-stage confidence | AC-5 |
| REQ-MED-060 | Optimization + CDN publication with versioned manifests (P06 slice: 2D derivative set; 3D LODs in P10) | AC-15 |
| REQ-MED-070 | Full lineage original→derived→corrected→superseded (P06 slice; generated views P11) | AC-16 |
| REQ-MED-080 | Reprocessing never destroys user corrections (P06 slice) | AC-17 |
| REQ-MED-090 | Idempotent jobs, retry limits, DLQ, replay via outbox (P06 slice: media pipeline on the P02 mechanism) | AC-18 |
| REQ-BIL-130 | Entitlement seams flag-gated dormant from P06 (`closet.max_items` check point exists, enforces nothing) | AC-19 |
| NFR-SEC-050 | Upload restrictions, content scanning, signed short-lived media URLs | AC-13, AC-20 |
| NFR-SEC-090 | Moderation/quarantine for user uploads (P06 slice; fashion-intel P12, hardening P14) | AC-13 |
| NFR-PERF-050 | CDN/asset caching with safe invalidation + client disk limits (P06 slice: versioned 2D manifests; outfit assets P10) | AC-15 |
| NFR-TST-040 | Integration tests against real disposable dependencies: idempotency, retry, DLQ, reprocessing (P06 slice on the P02 harness) | AC-18 |
| NFR-AIC-020 | Per-feature AI specs: contract, thresholds, eval, latency + cost budget for segmentation/extraction/embeddings | AC-22 |
| NFR-AIC-030 | Same input never re-sent through paid models (hash-keyed cache) | AC-21 |
| NFR-AIC-060 | Provider/model/prompt version tracking on every derivation (P06 slice) | AC-16 |
| NFR-AIC-080 | AI cost metered per {task, provider, model, plan} (P06 slice: spend + cache-hit metrics; plan guardrails P13) | AC-21, AC-23 |
| NFR-TST-090 | Eval suites for segmentation/classification/dedup with sliced metrics (P06 slice) | AC-22 |
| NFR-OBS-020 | Capture→published-asset visible as one trace tree (P06 slice) | AC-23 |

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P03** (accounts, consent, onboarding). **P04 is NOT required** — P06 runs parallel to P04/P05 (SPINE §5).
- External blockers:
  - **LR-11** (CSAM scanning/reporting obligations for user uploads, by region) — blocks shipping the upload surface; engineering proceeds, moderation stage design must satisfy the counsel outcome.
  - **ASM-07** (on-device background removal good enough for most items) — validated by this phase's eval.
  - Provider accounts: fal.ai (segmentation fallback candidate), Gemini/Anthropic API (extraction candidates), Voyage (embeddings default per DEC-35; Cohere alternative) — the self-hosted eval arms (BiRefNet, Qwen3-VL, SigLIP/SigLIP2; DEC-47) need a GPU eval host, not accounts — each provider must pass the doc 11 §7.5 privacy review before receiving user images (NFR-AIC-070); garment photos are S2, not face data.

## 4. In scope / out of scope

**In scope:** capture UX (single fast loop + batch + library import); durable local upload queue with resumable R2 multipart uploads; media pipeline state machine (doc 07 §8.1 states, canonical); on-device segmentation (Apple Vision / ML Kit) + server fallback (evaluated in this phase between self-hosted BiRefNet (MIT weights) in the segmentation worker and fal.ai BiRefNet/RMBG endpoints; DEC-47); perspective correction, deterministic color extraction/calibration, quality scoring; vision-LLM structured attribute extraction with registry-generated JSON schema; confirmation/correction UX (corrections authoritative + versioned); exact (hash) and near-dup (embedding/pgvector) detection with user-confirmed merge; taxonomy registry v1 covering all REQ-CAP-010 categories incl. shoes/accessories; provenance + lineage fields on every asset; moderation/quarantine queue in `admin`; `closet.max_items` entitlement seam (dormant, flag-gated); eval suites + datasets for segmentation/classification/dedup; capture analytics + pipeline observability.

**Out of scope / non-goals for this phase:** missing-view synthesis, provenance-badged generated views, real-photo supersession of generated views (REQ-CAP-070/080/090 → [P11](P11-generative-tryon-and-views.md)); organization views, search/filter, availability states, collections, wear history, offline browse-sync (→ [P07](P07-closet-organization-and-sync.md)); G1/G3 representations and 3D optimization outputs (→ P10/P11); enforcing any entitlement limit (→ P13 turns seams on); Ximilar escalation (only if the P06 eval fails precision — doc 10 §2.2 ladder).

## 5. Product/UX behavior

Journey detail owned by [02-user-journeys §6](../02-user-journeys-and-information-architecture.md); states summarized here.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Single capture loop | Camera + framing guide → front photo → on-device cutout preview + quality check → auto-classification → one-card confirm → saved; item visible immediately in `processing` visual state | First capture ever → one-time inline coach marks (dismiss-forever) | Blur/lighting fail → specific retake guidance with **keep anyway** override; processing failure → tile "needs attention" with cause + retry/retake/edit/delete | Full loop works offline: photo, local cutout, provisional category; item marked "waiting to sync" | Camera screen fully labeled; capture triggerable via accessibility action; review card screen-reader complete; confidence conveyed in text |
| Optional views | One-tap chips after front shot: back/side/detail/label/material — all skippable, individually deletable | n/a | Per-view retake | Queued like the front view | Chips labeled with view names |
| Batch capture | Rapid-fire shooting; review afterward as swipeable confirmation stack; "accept all high-confidence, review the rest" | — | Per-item failures isolated in the stack; batch never fails atomically | Whole batch queues; ≥10 items capture-able in airplane mode | Stack navigable via screen reader; batch actions labeled |
| Pending review | Leaving mid-review keeps the stack under Capture → Pending review (resumable) | Zero pending → section hidden | — | Local state | — |
| Upload queue screen | Per-item progress; automatic background drain | Empty → hidden | Systemic failure (provider outage) → banner + auto-retry with backoff; per-item retry/cancel; photos never lost | Queue survives app kill, crash, connectivity loss, and app updates; resumes on next launch | Status changes announced |
| Confirmation/correction | Review card: category + top attributes with confidence; one-tap confirm-all; tap any field → registry-driven picker; low-confidence fields highlighted, never blocking | — | Extraction provider down → coarse label + "add details" prompt; capture never blocks (doc 10 §2.2 degraded mode) | Confirmation possible offline against provisional values; syncs as corrections | Pickers are native accessible controls; provisional/unconfirmed state announced |
| Duplicates | "Looks similar to [item]" side-by-side compare → same (merge/replace photo) / different (keep both); never auto-merge, never silent drop | — | Embedding provider down → skip near-dup (exact-hash dedup still active), backfill later | Dedup runs at sync time | Compare view labeled with item names/attributes |
| Manual edit | Item → Edit: redraw crop/mask, re-run background removal, re-categorize; corrections persist and win over reprocessing | — | Re-run failures leave last good state | Queued | Mask editor has an accessible alternative: choose among N generated crops |

## 6. Domain and architecture changes (by owning module)

| Module | Change | Contract update needed? |
|---|---|---|
| `closet` | New module goes live: items, taxonomy registry consumption, item-attribute rows (typed value + source + confidence + version), draft→confirmed lifecycle, dedup orchestration, correction semantics | Yes — create `docs/modules/closet.md` |
| `media` | Pipeline state machine (doc 07 §8.1), media_assets + derivations + lineage, upload sessions (signed URLs), EXIF strip, quarantine states, reprocessing rules | Yes — create `docs/modules/media.md` |
| `shared-kernel` | Taxonomy registry v1 (ids per doc 08 §2–3), color palette values, attribute enums — codegen to mobile pickers, API validation, classifier JSON schema | Yes |
| `platform` | Ports: `SegmentationPort`, `AttributeExtractionPort`, `EmbeddingPort` + managed adapters (fal.ai / Gemini-or-Haiku / Voyage-or-Cohere) and self-hosted eval-arm adapters (BiRefNet / Qwen3-VL / SigLIP-SigLIP2, DEC-47); R2 upload/multipart; pgvector setup (HNSW index) | Yes |
| `admin` | Moderation/quarantine queue UI + DLQ ops queue view | Yes |
| `billing` | Dormant seam: `closet.max_items` entitlement check point in the closet item-create service, behind flag `entitlement-enforcement` (off) — returns unlimited until P13 | Yes (seam documented) |
| `outfit` | `garment_representations` table with G-level field; every item gets a G0 record (REQ-CAP-100 slice) | Yes |

Dependency rules: vision/embedding provider SDKs live only in `platform` adapters (NFR-AIC-090); `closet` consumes extraction results as data via events; the classification prompt's allowed-label list is **generated from the registry** (doc 08 §10.1).

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`):
  - `POST /v1/media/uploads` (content hash, kind) → signed resumable PUT URL; `POST /v1/media/uploads/{id}/complete`
  - `GET /v1/media-assets/{id}` (state, provenance, lineage — doc 06 §3.3 shape)
  - `POST /v1/closet-items` (from confirmed draft), `GET /v1/closet-items/{id}` (doc 06 §3.2 shape), `PATCH /v1/closet-items/{id}` (corrections), `POST /v1/closet-items/{id}/reprocess`
  - `POST /v1/closet-items/{id}/dedup-decision` (merge / keep-both / replace)
- Event schemas added/changed (doc 06 §4 catalog): `media.asset.uploaded.v1`, `media.asset.ready_for_processing.v1`, `media.asset.processing_failed.v1`, `media.derivation.completed.v1`, `closet.item.draft_ready.v1`, `closet.item.created.v1`, `closet.item.correction_applied.v1` — all on the P02 outbox/envelope.
- DB migrations (Drizzle): closet tables (items, item_attributes, taxonomy refs), media tables (media_assets, derivations, upload_sessions), `garment_representations`, pgvector extension + embeddings table + HNSW index, moderation queue. Forward additive; each with tested down path (`just db-rollback` on a scratch database restored from the staging backup).
- Generated clients to regenerate: mobile TS client, event types, **taxonomy registry artifacts** (mobile pickers/labels, API validation, classifier JSON schema + prompt artifact) — all via `just generate`; CI fails on staleness (NFR-TEAM-080).

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Capture screens (single/batch/library import); on-device segmentation bridge (Apple Vision subject lift / ML Kit); local quality checks; durable mutation-log upload queue + resumable uploads; confirmation/correction cards + registry pickers; dedup compare UI; manual mask/crop editor; pending-review stack |
| Backend | `closet` + `media` modules; upload session + signed URL flow; state-machine enforcement (illegal transitions rejected); correction semantics; dedup orchestration (ANN query within the user's closet only); moderation queue; entitlement seam |
| Workers (ML/media) | Python worker endpoints (versioned JSON schemas): server segmentation (fal.ai call-through and the self-hosted BiRefNet eval arm), quality scoring, perspective correction, deterministic color extraction; pg-boss pipeline jobs wiring stages with idempotency keys (`hash + task + model_version`) |
| Data / migrations | §7 migrations; taxonomy registry v1 seed; synthetic capture fixtures (garments/shoes/accessories — no real user data); eval datasets (segmentation 300-image, classification 500-item, dedup 200-triplet per doc 10 §2) |
| Infrastructure | pgvector on the self-managed PostgreSQL; optional GPU eval host for the self-hosted arms; R2 buckets + lifecycle rules (quarantine 30 d purge); malware/content scanning hook in validation stage; Cloudflare WAF/rate limits on upload endpoints (doc 11 §14: 60 img/h/user) |
| 3D / assets | None (2D derivative set only: original-private, cutout, thumbnails ×2–3, palette swatch) |
| Admin / internal tools | Moderation/quarantine queue (approve/reject, audited); DLQ ops queue with replay; pipeline-state inspector per asset |

## 9. AI vs deterministic decisions

Owning rows: [10 §2.1–2.3](../10-ai-usage-cost-and-evaluation.md). Every stored derivation records `{provider, model_id, prompt_id+version, port_version, input_content_hash, confidence}` (NFR-AIC-060).

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Background segmentation | **CV** — on-device first (Apple Vision/ML Kit, $0) → server fallback: self-hosted BiRefNet (MIT) in the segmentation worker vs fal.ai BiRefNet/RMBG, picked by the existing IoU/latency/cost gate (DEC-47) | Learned salient-object segmentation; classical thresholding unreliable | Confidence <0.60 → server retry → manual crop tool; provider down → store original, item usable un-cutout, queue for later | $0 blended target; ≤$0.001 × ~10% fallback share; on-device <1.5 s, server p95 <6 s |
| Category/attribute extraction | **CV — vision-LLM structured extraction** (Gemini Flash-class vs Claude Haiku-class vs self-hosted Qwen3-VL (Apache-2.0): pick per P06 eval on macro-F1, schema-valid output, latency, GPU cost, privacy — DEC-47), schema generated from registry | Perceptual judgments (neckline, material); no pixel rules reach usable precision | Cloud Vision coarse labels + user completes attributes; never blocks capture | ≤$0.002/item blended; batch <60 s to reviewed; interactive p95 <8 s |
| Color extraction | **Deterministic** (pixel statistics on the segmented cutout) | Measured, not judged; overrides model color output | n/a | $0 |
| Perspective correction, EXIF strip, quality checks | **Deterministic** image ops | Standard transforms | n/a | $0 |
| Embeddings / near-dup | **EMB** — Voyage multimodal-3.5 (DEC-35; Cohere alternative) vs self-hosted SigLIP/SigLIP2 (Apache-2.0) eval arm → pgvector ANN | Perceptual similarity; hashes only catch exact bytes | Provider down → exact-hash dedup only, backfill later | ≤$0.0005/item one-time; query p95 <150 ms |
| Exact dedup | **Deterministic** (SHA-256 content hash) | Byte identity | n/a | $0 |
| Confirmation | **Human** — extraction is always a proposal until confirmed (NFR-AIC-050 user-confirmation rule) | Wrong output harms trust | — | — |

Cache rule (NFR-AIC-030): all paid calls keyed by `content hash + model/prompt version`; re-uploading identical bytes triggers **zero** provider calls (cache-hit test, AC-21).

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11 §6](../11-security-privacy-and-compliance.md)): item photos + closet attributes = **S2** (originals of failed/quarantined uploads: 30 d then purge). No S3 data in this phase (no faces; capture flow warns and does not require people in item photos).
- Consent required / consent UI changes: covered by `core_service` (closet processing is the product). Sending images to fal.ai/Gemini-class/Voyage-or-Cohere requires each provider to pass the doc 11 §7.5 review and be listed on the per-integration disclosure screen (7.3). `training_data` remains default-off — correction pairs join eval datasets only under that consent (doc 08 §10.3).
- Retention, deletion, and export impact: originals immutable + private; account deletion cascade extends to all media objects under `u/<user_id>/` and closet rows (doc 11 §13.2 steps 4–5 — deletion propagates down lineage edges, doc 07 §8.4); export bundle adds closet items + attributes + original media. Quarantined content purged after 30 d on reject.
- Threat/abuse cases added to the threat model: content abuse via uploads (11 §3.5) — malware scan + content classification + quarantine + moderation queue; CSAM handling per LR-11 counsel outcome; denial-of-wallet on paid extraction (11 §3.6) — rate limits (60/h, 500/day), per-user concurrent-pipeline caps, cache-by-hash, batch APIs; scraping — signed short-lived media URLs only (NFR-SEC-050), user isolation enforced (dedup never crosses users).

## 11. Observability and analytics added in this phase

- Logs/metrics/traces: one trace tree per asset from upload → outbox → pg-boss job → worker → published (NFR-OBS-020, correlation ids per doc 04 §9); metrics — queue depth, job pickup latency, oldest-unfinished job age (alert >15 min), per-stage failure rate, segmentation fallback share, extraction invalid-JSON rate, cache hit rate, per-task AI spend tagged `{task, provider, model_version, plan}` (NFR-AIC-080), DLQ depth.
- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `capture_started` (`mode`), `item_captured` (`mode`, `retake_count`), `item_processing_completed` (`duration_bucket`, `auto_category_confidence_bucket`), `item_processing_failed` (`stage`, `reason_code`), `item_attributes_corrected` (`fields_corrected_count`, `field_types`).
- Alerts/dashboards/runbook entries: dashboards — capture funnel, pipeline stage-latency/failure, data-quality metrics from doc 08 §13 (correction rate, confirm-all rate, `other`-rate, duplicate rate, time-to-cataloged, stale-derivation count), AI cost per processed item; alerts — job age >15 min, DLQ nonempty, provider failure spike, AI-spend anomaly (day-over-day ×3, doc 10 §6.2); runbooks — "media pipeline backlog", "provider outage degradation ladder" (doc 10 §6.3 rungs 3–4), "quarantine queue handling".

## 12. Ordered tasks

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P06-T01 | Taxonomy registry v1 in `packages/contracts`/`shared-kernel` (all doc 08 §3 categories incl. shoes/accessories + attribute applicability map) + codegen: pickers, API validation, classifier JSON schema; `just generate` wiring | — | 2 |
| P06-T02 | `media` tables + state machine skeleton: upload sessions, signed URLs, content hash, immutability, EXIF strip, state-transition enforcement + migrations | — | 2 |
| P06-T03 | Mobile durable upload queue: mutation log (ULID opIds), resumable R2 multipart, background drain, queue screen, survive-kill tests | P06-T02 | 2 |
| P06-T04 | On-device segmentation bridge (Apple Vision / ML Kit) + local quality checks + cutout preview | — | 2 |
| P06-T05 | Pipeline jobs on pg-boss (`apps/api/src/jobs/`): validate→strip→segment→extract stages with idempotency keys, retries (max 3), DLQ sweep to admin queue | P06-T02 | 2 |
| P06-T06 | Worker services: server segmentation (fal.ai and self-hosted BiRefNet eval arm via `SegmentationPort`), quality scoring, perspective correction, deterministic color extraction — versioned JSON schemas | P06-T05 | 2 |
| P06-T07 | Attribute extraction: `AttributeExtractionPort` + Gemini-class/Haiku-class adapters + self-hosted Qwen3-VL eval arm, registry-generated schema validation (invalid ids dropped), confidence thresholds, degraded coarse-label path | P06-T01, P06-T05 | 2 |
| P06-T08 | `closet` module: items, attribute rows (source/confidence/version), draft lifecycle, correction semantics (`source: user` supersedes, never deleted), events | P06-T01, P06-T02 | 2 |
| P06-T09 | Capture UX: single fast loop + optional view chips + review card with confirm-all/pickers | P06-T04, P06-T08 | 2 |
| P06-T10 | Batch capture + library import + pending-review stack + "accept all high-confidence" | P06-T09 | 2 |
| P06-T11 | Dedup: `EmbeddingPort` + Voyage adapter (Cohere alternative) + self-hosted SigLIP/SigLIP2 eval arm, pgvector HNSW, exact-hash + near-dup prompts, merge/keep-both/replace flow (user-scoped ANN only) | P06-T08 | 2 |
| P06-T12 | Manual-edit paths: mask/crop editor, re-run segmentation, re-categorize; reprocessing preserves corrections (REQ-MED-080 regression test) | P06-T09 | 2 |
| P06-T13 | Moderation: malware/content scan stage, quarantine states, admin queue (approve/reject audited), 30 d purge job; LR-11 conformance notes | P06-T05 | 1–2 |
| P06-T14 | Derivative publication: fixed derivative set (cutout, thumbnails ×2–3, palette swatch) produced once by the workers and stored in R2 (no Cloudflare Images); presigned read path for user media; custom-domain cached manifests for public assets only, with invalidation (DEC-44) | P06-T06 | 1 |
| P06-T15 | Entitlement seam: `closet.max_items` check point behind `entitlement-enforcement` flag (dormant), remaining-count advisory API field | P06-T08 | 1 |
| P06-T16 | Eval suites + datasets: segmentation (IoU), classification (accuracy/F1/invalid-rate, provider pick DEC), dedup (recall/precision) wired into `just ml-eval` | P06-T06, P06-T07, P06-T11 | 2 |
| P06-T17 | Observability + analytics + dashboards + runbooks; end-to-end trace verification; load check of upload burst profile (50 uploads/user) | P06-T05…T14 | 1–2 |

## 13. Parallelization

- Can run in parallel: **Group A** contracts/taxonomy (T01) ∥ **Group B** media backend (T02→T05→T06) ∥ **Group C** mobile capture foundation (T03, T04). After T01+T02: **T07** (extraction) ∥ **T08** (closet module) — disjoint modules. After T08/T09: **T10** ∥ **T11** ∥ **T12** ∥ **T13** ∥ **T15** (disjoint surfaces: mobile batch, dedup backend, edit paths, admin, billing seam). Parallel sessions own disjoint file sets per [CLAUDE.md](../CLAUDE.md); `packages/contracts` and `shared-kernel` (T01, endpoint schemas) are single-writer — sequence those merges first (producers before consumers).
- Must be serial: T01 before T07/T08 (registry consumers); T02 before T03/T05; T05 before T06/T07/T13; T09 before T10/T12; T16 after its subjects; T17 last.

## 14. Test-first plan (by module and level)

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `media` | Hash/dedup keys, EXIF strip, state guards | State machine: illegal transitions always rejected; every asset row in a valid state (REQ-MED-010) | Asset schema (doc 06 §3.3) vs OpenAPI; event schemas pinned | Testcontainers PG + R2-compatible store: pipeline stages, **idempotency (duplicate delivery → no duplicate assets)**, retry, DLQ, reprocess-preserves-corrections (NFR-TST-040) | Trace-tree check: capture→published as one trace |
| `closet` | Draft lifecycle, correction supersession, attribute typing | Registry-id-only invariant: no free-string categories/attributes ever persisted (REQ-ORG-010) | Item schema (doc 06 §3.2); `closet.item.*` events | Dedup decision flows; user-scoped ANN isolation test | — |
| `platform` (ports) | Adapter mapping | — | Provider ports contract-tested with recorded fixtures (NFR-TST-030) | Degrade-each-provider tests → documented fallback per doc 10 (NFR-AIC-050) | — |
| Workers | Color extraction on color-card fixtures (golden, doc 13 §6) | — | Versioned JSON schema validation | Worker round-trip via a local pg-boss job process | — |
| Mobile | Queue drain logic, quality-check thresholds | Mutation log: replay after crash reproduces identical queue state | Generated client compile | RNTL: capture/review/correction flows | Maestro: single + batch capture (camera mocked in emulator, real on device); **airplane-mode ≥5-item capture → full sync on reconnect; kill-app-mid-upload resumes (REQ-CAP-130)**; a11y pass on capture + review |
| ML eval | — | — | — | `just ml-eval`: segmentation IoU ≥0.92 mean, catastrophic <2%; classification category accuracy ≥92%, attribute macro-F1 ≥0.80, invalid-JSON/ID <0.5%; dedup recall ≥0.90 @ precision ≥0.95 — with garment-diversity/skin-tone slices (NFR-TST-090) | — |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

All hypotheses per [13 §12](../13-testing-quality-and-performance.md) / [10 §2, §5–6](../10-ai-usage-cost-and-evaluation.md) until measured in this phase.

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Capture→queued+thumbnail ≤6/4/3 s (low/mid/high); full item processing (upload→classified) p95 ≤60 s; 50-item batch ≤15 min; job pickup p95 ≤30 s; on-device segmentation <1.5 s; dedup query p95 <150 ms | Device-lane runs + pipeline metrics dashboards, raw traces archived |
| Cost | Extraction ≤$0.002/item blended (Gemini 3.5 Flash $0.0012 / Haiku 4.5 $0.0037; batch halves); segmentation ≈$0 (≈$0.006 × ~10% server fallback); embedding ≤$0.0005/item (Voyage ≈ $0.0003); prices verified 2026-09-09, [r6](../research/r6-pricing-verification-2026-09-09.md); onboarding spike within $0.10–0.30/user (SPINE §6 anchor, RISK-08); per-plan caps + global $500/mo cap active (doc 10 §6.1) | Per-task spend metrics `{task, provider, model_version, plan}`; weekly provider-dashboard reconciliation |
| AI quality | Eval gates in §14 (IoU ≥0.92, category ≥92%, dedup 0.90/0.95); post-launch KPIs: classification correction rate, confirm-all rate, `other`-rate, duplicate rate baselined (doc 08 §13) | `just ml-eval` on versioned datasets; analytics dashboards |
| Reliability | Zero lost captures under kill/offline tests; duplicate job delivery → zero duplicate assets; DLQ items always visible in admin; cache hit rate tracked (identical re-upload → 0 provider calls) | Integration suite + chaos-style provider degradation tests + queue metrics |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): `capture-batch-mode` (owner MOB, expiry P07), `server-segmentation-fallback` (kill rung 4 of doc 10 §6.3; owner ML, permanent ops control — registered with justification), `vision-llm-extraction` (kill rung 3 → coarse labels; owner ML, permanent ops control), `entitlement-enforcement` (**off/dormant**; owner BE; flips on in P13; expiry = P13 exit).
- Migration/backward-compatibility plan: all-new tables (additive). Taxonomy registry semver'd from v1; additive changes safe for old clients (unknown-id-tolerant readers, doc 08 §12); classifier prompt artifact pinned to registry version. Pipeline versioned (`pipelineVersion`) so later model upgrades reprocess selectively without touching originals.
- Rollback plan: (1) degradation ladder before rollback — flags per doc 10 §6.3 rungs 3–4 keep capture working with zero AI; (2) mobile: capture UI behind release rollout, queue format versioned so a downgrade never corrupts queued items; (3) DB `just db-rollback` per migration (down paths tested on a scratch database restored from the staging backup); (4) pipeline stage rollback = re-point task version, replay from outbox (90 d window, doc 04 §9.2) — originals immutable, all derived data rebuildable (doc 06 §5).

## 17. Risks, mitigations, assumptions, stop/kill criteria

- Risks in play: **RISK-08** (AI cost overrun — metering starts here), **RISK-10** (fal.ai concentration), **RISK-14** (taxonomy drift/data quality), **RISK-16** (capacity). Assumptions: **ASM-07** (on-device segmentation share), **ASM-10** (users grant photo data). Legal: **LR-11**.
- **Stop/kill criteria for this phase:**
  - Classification eval below gate (category <92% or invalid-rate ≥0.5%) after prompt/model iteration across both candidate providers → escalate per DEC-25 ladder to Ximilar trial; if still failing → raise user-confirmation prominence (all fields require tap) and log DEC; capture still ships (extraction is assistive, not blocking).
  - On-device segmentation success <60% of items (ASM-07 wrong) → server fallback becomes primary for affected device classes; re-run doc 10 cost model; if projected cost >2× SPINE §6 anchors → RISK-08 playbook before rollout continues.
  - Measured AI cost/user >2× anchor during beta → freeze rollout, execute doc 10 §6.3 ladder + cost-reduction playbook.
  - LR-11 outcome demands scanning we cannot implement in-phase → uploads ship geo-limited or behind review-first moderation until compliant; log DEC.

## 18. Demo script

1. On a real device, fresh P03 account: capture a shirt in the single loop — show framing guide, on-device cutout preview, auto-classified review card, one-tap confirm; item appears in closet in `processing` then `published` state (timed: capture→thumbnail within budget) (AC-2, AC-3, AC-5, AC-6).
2. Add optional label + detail photos via chips; delete the detail photo individually (AC-4).
3. Capture one item from each of the 14 top-level categories including sneakers, a handbag, a necklace, and sunglasses; each classifies and saves (AC-1).
4. Batch mode: capture 10 items rapid-fire; review as a stack; "accept all high-confidence, review the rest"; leave mid-review and resume from Pending review (AC-2).
5. Airplane mode ON: capture 5 items (local cutout + provisional category shown, "waiting to sync"); kill the app; reconnect → queue resumes and all 5 sync with zero loss (AC-10).
6. Re-upload an identical photo → "already in your closet" via hash, zero provider calls (show cache-hit metric) (AC-9, AC-21).
7. Photograph the same shirt again at a different angle → near-dup prompt with side-by-side; choose "same item, new photo" → merged (AC-9).
8. Force a bad segmentation (dark-on-dark fixture) → low quality score routes to manual crop; redraw mask; correct the category via picker; trigger reprocess → correction survives (AC-8, AC-17).
9. Show an item's lineage via API: original hash → cutout → thumbnails, with provider/model/prompt versions on each derivation (AC-16); EXIF check shows no GPS in derived assets (AC-14).
10. Upload a disallowed test file → rejected; upload flagged test content → `quarantined`, visible only in the admin moderation queue; approve → resumes pipeline (AC-13).
11. Show the dormant `closet.max_items` seam: flag off → unlimited; flag on in a staging toggle → advisory count appears and create is gated (then flag back off) (AC-19).
12. Show the pipeline dashboard: one capture's full trace tree, stage latencies, spend-per-task panel (AC-23).

## 19. Acceptance criteria

- AC-1: Every category listed in REQ-CAP-010 can be captured, classified, and saved in the demo; adding a new subcategory is a registry data change + regeneration, no code change (demonstrated on a test registry bump).
- AC-2: Batch mode captures ≥10 items in one session with deferred per-item confirmation; camera-to-catalog time recorded against the §15 budget.
- AC-3: An item created from one front photo is classified, searchable (by API), and carries the attribute set doc 09 requires for candidacy.
- AC-4: All five optional view types can be added, viewed, and individually deleted.
- AC-5: Segmentation, perspective correction, deterministic color extraction, and quality checks run as pipeline stages with per-stage confidence stored; eval meets the doc 10 thresholds (AC-22).
- AC-6: Unconfirmed AI attributes are marked provisional; confirmation writes the canonical record; corrections are stored `source: user`, supersede without deleting the proposal, and win over any reprocessing.
- AC-7: Every item has a G0 `garment_representations` record carrying its level; no other levels exist yet and no UI conflates levels.
- AC-8: Re-run, manual mask, and re-categorize paths all work; corrections persist (regression-tested).
- AC-9: Exact dedup by content hash and near-dup by embedding both prompt the user (merge/keep-both/replace); nothing is silently dropped; dedup eval meets recall ≥0.90 @ precision ≥0.95; ANN search is provably scoped to the requesting user.
- AC-10: Airplane-mode capture of ≥5 items syncs completely after reconnect; kill-app-mid-upload resumes without data loss (automated + demo evidence).
- AC-11: Implemented states match doc 07 §8.1 exactly (state names canonical); illegal transitions rejected in tests; every asset row is in a valid state (DB constraint + test).
- AC-12: Same bytes re-uploaded dedupe by SHA-256; originals are never mutated (immutability test).
- AC-13: Malformed/oversized/disallowed files rejected; flagged content lands in the admin quarantine queue, invisible to processing; approve/reject audited; rejects purge in 30 d.
- AC-14: Automated check proves derived assets contain no GPS/EXIF payload; originals retain metadata only in the private original store.
- AC-15: Derivative set (cutout, thumbnails, palette swatch) publishes to R2 with versioned manifests (user media presigned; public manifests on the custom-domain cache, DEC-44); stale assets are never served after invalidation (test per NFR-PERF-050).
- AC-16: For any derived asset the API returns its complete ancestry to the original hash, including `{provider, model, version, prompt hash}` per derivation.
- AC-17: Re-running the pipeline on a corrected item preserves every user-confirmed field and mask (regression test that failed before the implementation).
- AC-18: Duplicate job delivery produces no duplicate assets; exhausted retries land in DLQ visible in admin; replay works from the outbox.
- AC-19: The `closet.max_items` check point exists behind the off `entitlement-enforcement` flag, enforcing nothing; a staging flag flip demonstrates the seam works (409 + upsell code per doc 12 §3).
- AC-20: All media reads use signed short-lived URLs; direct object access without a signature fails (sec test).
- AC-21: Cache-hit test: resubmitting an identical photo triggers zero provider calls; cache hit rate is a live metric.
- AC-22: `just ml-eval` runs the three suites on versioned datasets and meets: segmentation IoU ≥0.92 mean / catastrophic <2%; classification category ≥92%, macro-F1 ≥0.80, invalid <0.5%; dedup 0.90/0.95 — with documented slices; the provider picks (Gemini-class vs Haiku-class vs self-hosted Qwen3-VL; self-hosted BiRefNet vs fal.ai; Voyage vs self-hosted SigLIP) are logged as a DEC with eval evidence.
- AC-23: A capture-to-published trace is viewable as one trace tree including queue hops.

## 20. Definition of done

```bash
just test closet && just test media && just test outfit && just test billing   # all pass, no skips
just lint && just typecheck
just arch-check            # provider SDKs only in platform; module boundaries hold
just generate --check      # contracts + taxonomy codegen not stale
just db-migrate && just db-rollback && just db-migrate   # a scratch database restored from the staging backup, up/down/up incl. pgvector
just ml-eval               # all three suites meet §19 AC-22 gates
just security-scan
just ci-parity
# phase-specific: Maestro offline/kill-resume suite green on both platforms;
# device-lane capture-latency run; provider-degradation (chaos) tests green
```

Evidence to attach/link: eval reports (sliced), device timing readouts, airplane-mode/kill-resume test video + logs, trace-tree screenshot, cache-hit metric readout, cost-per-item dashboard snapshot, moderation queue demo, migration up/down output. Never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: create `docs/modules/{closet,media}.md`; update `{platform,admin,billing,outfit,shared-kernel}` contracts; doc 10 §3: provider-pick DEC recorded; doc 16: DECs (extraction provider, any ASM-07/LR-11 outcomes); doc 08 marked as-built where the registry landed; runbooks (§11) added to doc 14's set.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence; note in the ledger that P07 is unblocked.

## 22. Handoff note

On P06 `ACCEPTED`: next session starts **P07-T01** (`phases/P07-closet-organization-and-sync.md`) — P07's hard dependency is exactly this phase. If the P04/P05 track is still open, both tracks may proceed in parallel worktrees with disjoint modules. First command: `just doctor`, then read the P07 phase file and the doc 04 §8 sync design before touching code.
