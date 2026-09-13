# P10 — Outfit on Avatar

> Amended 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — service consolidation: pg-boss jobs, owned server + Coolify, self-managed PostgreSQL, R2 delivery model).

> File name per [SPINE §5](../SPINE.md). Template: [templates/phase.md](../templates/phase.md). Status values per [PROGRESS.md](../PROGRESS.md). Presentation design owned by [07-3d-avatar-and-garment-pipeline.md](../07-3d-avatar-and-garment-pipeline.md) §4.3, §6, §10; on conflict, doc 07 wins.

## 1. Overview

- **Phase:** P10 — Outfit on avatar
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Deliver the renderer-independent `OutfitPresentation` contract and its consumers — G0 collage rendering and outfit-on-avatar presentation with multi-pose viewing and graceful non-3D fallbacks — keeping the engine and the renderer strictly decoupled, with performance budgets measured on real devices.
- **User-visible outcome:** A recommended (or saved) outfit is viewable as a composed presentation on the user's A1 avatar across 3–4 poses with rotate/zoom, and — always — as a G0 collage of their real photos; users on low-end devices or with 3D disabled get an equivalent accessible 2D path, not a degraded one.
- **Why now:** P04 delivered the calibrated A1 avatar and poses; P09 delivers structured `RecommendationResult`s. This phase is the seam between them — it must exist before P11 layers generative try-on onto the same presentation contract.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only. *(partial)* = this phase delivers its P10 slice.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-REC-180 | Selected outfit renders on the avatar in multiple poses with graceful G0/2D fallbacks; no recommendation logic in the renderer | AC-1, AC-2, AC-3 |
| REQ-AVA-110 | Accessibility alternative to the 3D view *(partial — P04 delivered avatar-screen fallback; P10 delivers the outfit-presentation fallback completing the journey)* | AC-4 |
| REQ-EXP-060 | Save, schedule, mark worn, compare alternatives *(partial — P09 delivered actions/data; P10 delivers the on-avatar/compare presentation surfaces)* | AC-5 |
| REQ-MED-060 | LODs, compressed textures/meshes, thumbnails, CDN manifests *(partial — P06 built the pipeline; P10 adds outfit-presentation derivative sets + manifest consumption in the renderer)* | AC-6 |
| NFR-PERF-050 | CDN/asset caching with safe invalidation and client disk limits *(partial — P10 exercises versioned-manifest invalidation + the client cache cap on outfit assets)* | AC-6 |
| NFR-TST-060 | Golden/visual regression covers garment rendering and outfit states *(P10 slice: outfit-on-avatar + collage goldens; avatar-only goldens landed P04)* | AC-7 |

Consumed, not delivered: REQ-AVA-090 poses (P04), REQ-REC-110 structured results (P09), REQ-AVA-120 engine ⊥ renderer contracts (delivered P02/P04 per doc 01 — exercised here by the production `OutfitPresentation` consumers, verified in AC-2), REQ-CAP-100 G-ladder separation (P06/P11 — this phase renders only G0 + avatar; G2 assets arrive P11 through the same contract).

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P04** (A1 avatar, poses, rig, asset manifests, render tiers), **P09** (`RecommendationResult`, saved outfits) — per SPINE §5.
- External blockers: none. OQ-08 (device floor) still open — P10 measures against the doc 13 §7 provisional matrix and feeds OQ-08 evidence; it does not block.

## 4. In scope / out of scope

**In scope:** `OutfitPresentation v1` value object + schema in `packages/contracts` (doc 07 §4.3); `outfit` module mapping `RecommendationResult`/saved outfits → presentations (slot→item→best renderable representation via asset manifests, `fallbackChain` resolution); mobile G0 collage renderer (deterministic layout of real cutouts by slot); outfit-on-avatar presentation for A1+G0 (avatar in pose + composed outfit panel; G1 warping explicitly not included); multi-pose switching + rotate/zoom + camera presets on the outfit view; per-screen non-3D layouts (structured list + collage + 2D posed renders per doc 07 §10.2–10.3); render-tier fallback ladder (full 3D → reduced 3D → static renders → 2D+collage); compare-alternatives side-by-side surface; outfit-asset caching under the client disk cap; golden/visual regression for the new surfaces; device performance measurement.

**Out of scope / non-goals:** G2 generative try-on and missing views (P11 — arrives through this same contract); G1 2.5D overlay (post-P10 optional, may be skipped per doc 07 §6); any scoring/constraint/recommendation logic anywhere in presentation code (forbidden); pose additions or rig changes (P04 owns); entitlement activation (seams only, per REQ-BIL-130 — G2 buttons render upsell states but nothing is charged before P13); web/AR renderers (contract makes them possible; not built).

## 5. Product/UX behavior

Journey detail: [02 §8](../02-user-journeys-and-information-architecture.md) (Today card presentation), [02 §13.3](../02-user-journeys-and-information-architecture.md) (non-3D alternative).

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Outfit on avatar (from Today / saved outfit) | Avatar in `pose.neutral` wearing-context view + outfit slot panel; pose switcher (3–4 poses), 360° orbit, pinch-zoom, camera presets (full/upper/detail) | Outfit with unfilled slots (partial rec) → filled slots render; missing slots shown as labeled placeholders, never invented items | 3D init failure (GPU/memory) → automatic drop down `fallbackChain` to static renders or 2D+collage; failure recorded to device-capability telemetry; user sees the fallback, not an error wall | Cached avatar + outfit assets render offline; un-cached assets → collage view with "full view when online" note | Pose switch announced; camera controls have button equivalents (never gesture-only); reduced-motion disables idle animation/auto-rotate |
| G0 collage view (always available) | Real cutouts composed by slot (top/bottom/outer/shoes/accessories) in a deterministic layout; tap item → item detail | — | Missing cutout (processing pending) → thumbnail placeholder + state label | Fully offline from cached thumbnails | Each item labeled (name, color, category from doc 08 attributes); collage readable as a structured list — screen-reader-first parity path |
| View toggle | Explicit control: Avatar ⇄ Collage; preference persisted; users with 3D disabled default to collage | — | — | — | Toggle labeled with current mode; no information exists only in the 3D view |
| Compare alternatives | 2–3 candidates side-by-side (collage-based) with differing reason chips highlighted | Single result → control hidden | — | Works over cached alternatives | Differences announced ("Alternative 2 swaps jacket for cardigan") |
| Save/worn/schedule from presentation | Action bar identical to Today card (P09 actions); saved outfits list renders presentations | — | Optimistic + queued (P09 machinery) | Queued | Standard labeled actions |

## 6. Domain and architecture changes (by owning module)

| Module | Change | Contract update needed? |
|---|---|---|
| `outfit` | `OutfitPresentation` assembly service: slot mapping, representation resolution per item from `garment_representations` + asset manifests, `fallbackChain` policy; compare-view composition | Yes |
| `shared-kernel` | Slot IDs, representation-level enum (G0–G3), camera/pose preset identifiers (pose IDs exist from P04 — referenced, not redefined) | Yes (single-writer, first) |
| `media` | Outfit-presentation derivative set: collage-ready cutout sizes + static posed avatar renders for the non-3D path (server-rendered per doc 02 §13.3), published via versioned manifests | Yes (minor) |
| Mobile `render` boundary (`apps/mobile/src/render/`) | Outfit scene composition on Filament: avatar + pose + presentation panel; render-tier ladder; nothing outside `render/` imports Filament types (CLAUDE.md layout rule) | No (internal, behind the boundary) |
| `recommendation` | **No change.** The engine emits `RecommendationResult` only; if this phase needs anything new from it, that is a P09 contract change, sequenced separately | No |
| `avatar` | Read-only consumption of avatar config/assets; no changes | No |

Invariant checked continuously: dependency-cruiser forbids `recommendation` → `outfit`-presentation/renderer imports **and** renderer → `recommendation` imports; renderer code contains zero scoring/constraint logic (REQ-REC-180 arch check).

## 7. Public interfaces, contracts, schemas, migrations, events

- **Contracts:** `OutfitPresentation v1` schema in `packages/contracts` exactly per doc 07 §4.3 (`outfitId`, `recommendationId?`, `avatarRef` opaque to engine, `slots[]` with `{level, assetRef, provenance, confidence}`, `requestedPose`, `requestedCamera`, `fallbackChain`). Versioned per doc 06 conventions.
- **API (OpenAPI 3.1):** `GET /v1/outfits/{id}/presentation` (+ `?pose=&camera=`); `GET /v1/recommendations/{id}/presentation` (per-rank). Read-only; no new mutations (actions reuse P09 endpoints).
- **Event schemas:** none new (consumes `media.derivation.completed.v1` for derivative availability).
- **DB migrations (Drizzle):** none beyond a nullable `presentation_prefs` (view-mode preference) on profile — additive, trivially reversible. `garment_representations` exists from P06.
- **Generated clients:** regenerate TS client (`just generate`, CI `--check`).

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Outfit-on-avatar scene (inside `render/` boundary), pose/camera controls, view toggle, collage renderer, compare view, fallback-ladder integration, asset prefetch + LRU cache under disk cap, reduced-motion handling |
| Backend | `outfit` presentation assembly, representation resolution, presentation endpoints |
| Workers (ML/media) | Static posed avatar render job (server-side 2D renders per pose for the non-3D path) — deterministic Filament/headless render, no AI |
| Data / migrations | `presentation_prefs` column |
| Infrastructure | Custom-domain cached manifest wiring for outfit derivative sets (public app assets only; user-specific renders stay presigned per DEC-44); device-farm lane configured for the outfit-view perf runs |
| 3D / assets | Outfit-view scene tuning (lighting preset reuse from P04, neutral IBL — color-accuracy rule doc 07 §4.2); `just assets-validate` extended to presentation asset manifests |
| Admin / internal tools | None |

## 9. AI vs deterministic decisions

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Presentation assembly, slot mapping, fallback resolution | **Deterministic** | Pure mapping over structured data | n/a | $0 |
| Collage layout | **Deterministic** (slot-based layout rules) | Composition is geometry, not generation (doc 10 §1 principle) | n/a | $0 |
| Static posed renders (non-3D path) | **Deterministic** (headless render of the same AvatarConfig) | Same assets, fixed camera/lighting — no model involved | Client-side reduced 3D | ~$0 (render job compute only) |
| Any garment warping/generation | **None in P10** | G1 skipped for now; G2 is P11 with its own doc 10 rows | G0 collage | $0 |

P10 introduces **zero AI calls**. Every generated pixel that will arrive in P11 flows through this contract's `provenance`/`confidence` fields — built and tested now with `provenance: "captured"` assets.

## 10. Security, privacy, consent, and data lifecycle

- **New sensitive data:** none new — presentations reference existing avatar configs and item cutouts. Static posed renders are avatar-derived assets: classified with avatar assets per [11](../11-security-privacy-and-compliance.md), included in deletion cascade + lineage (extend the coverage test to the new derivative kind).
- **Consent:** no new scopes. Presentation endpoints enforce owner-only access (sec-suite authz matrix rows added for both new endpoints).
- **Retention/deletion/export:** presentation prefs exported with profile; derivatives follow media lineage deletion (doc 06 §8 step 2).
- **Threat/abuse cases:** signed-URL scoping on presentation assets (existing NFR-SEC-050 machinery — new asset kinds added to the signed-upload/read tests).

## 11. Observability and analytics added in this phase

- **Logs/metrics/traces:** render-tier distribution (how many users land on each fallback rung), 3D init failure rate by device model, outfit first-render time, pose-switch latency, presentation-asset cache hit rate, manifest-version mismatch count (must be 0 after invalidation — NFR-PERF-050).
- **Product analytics (consent-gated):** `outfit_presentation_viewed` (mode: avatar|collage|static|2d), `outfit_pose_switched`, `outfit_view_toggled`, `outfit_compare_opened`, `render_fallback_triggered` (tier + reason enum, no device fingerprinting beyond model class).
- **Alerts/dashboards/runbooks:** alert on 3D-init failure rate > 10% on mid-tier devices (regression signal for RISK-01/RISK-09); dashboard: render-tier mix + first-render p95 per tier; runbook: "3D failure spike after release" (check Filament/asset manifest versions → roll back manifest → escalate to renderer fallback ladder). Per-phase observability rule 14 §15 satisfied.

## 12. Ordered tasks

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P10-T01 | Contracts: `OutfitPresentation v1` schema + presentation endpoints + `shared-kernel` slot/level/camera enums; regenerate clients | — | 1 |
| P10-T02 | `outfit` presentation assembly: slot mapping from `RecommendationResult`/saved outfits, representation resolution from `garment_representations` + manifests, `fallbackChain` policy; tests first (fixtures at every representation mix) | T01 | 2 |
| P10-T03 | Media: collage derivative sizes + versioned manifest entries; static posed-render job (headless, deterministic) for the non-3D path | T01 | 2 |
| P10-T04 | Mobile: G0 collage renderer + item labels + structured-list parity view | T01 | 2 |
| P10-T05 | Mobile: outfit-on-avatar scene inside `render/` — avatar + pose + outfit panel, pose switcher, orbit/zoom/camera presets, reduced-motion | T02 | 2–3 |
| P10-T06 | Render-tier fallback ladder integration: capability detection reuse (P04), automatic downgrade on init failure, telemetry hook | T05, T03 | 1–2 |
| P10-T07 | View toggle + preference persistence + compare-alternatives surface | T04, T05 | 1 |
| P10-T08 | Asset prefetch + LRU disk-cache cap + manifest-invalidation handling on the outfit path (NFR-PERF-050) | T03, T05 | 1 |
| P10-T09 | Golden/visual regression: outfit-on-avatar matrix (representative morph presets × 4 poses × 2 cameras with a fixture outfit) + collage goldens; wire to nightly + PR-smoke lanes (doc 13 §6); `just golden-accept` flow | T05, T04 | 1–2 |
| P10-T10 | Sec-suite rows (authz on presentation endpoints, signed assets), deletion-lineage coverage for new derivatives | T02, T03 | 1 |
| P10-T11 | Device performance runs: low/mid/high matrix, outfit first-render + pose-switch + memory/GPU/battery vs §15 budgets; archive raw traces; feed OQ-08 | T05–T08 | 1–2 |
| P10-T12 | Observability + analytics + dashboards + runbook | T06 | 1 |
| P10-T13 | Demo, docs (module contracts, doc 07 conformance note), PROGRESS | all | 1 |

## 13. Parallelization

- **Can run in parallel:** after T01: {T02 backend} ∥ {T03 media/worker} ∥ {T04 mobile collage} (disjoint modules/apps); T09 goldens split collage (after T04) ∥ avatar-scene (after T05); T10 ∥ T09.
- **Must be serial:** T01 alone first (`packages/contracts` + `shared-kernel` single-writer); T05 → T06 → T08 (same `render/` files); T11/T12/T13 last. One agent per worktree; `render/` boundary files are single-writer within the phase.

## 14. Test-first plan (by module and level)

Per [13](../13-testing-quality-and-performance.md); tests in each module's `tests/`.

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `outfit` | slot mapping, representation resolution, fallback-chain policy per mix | fast-check: resolution always yields a renderable level (G0 exists for every item — doc 07 §6 invariant); resolution is deterministic in manifest order | `OutfitPresentation` schema round-trip; renders unchanged from the same `RecommendationResult` in avatar and 2D clients (REQ-REC-110 tie-in) | Testcontainers: presentation endpoints over fixture data | — |
| `media` | derivative-set completeness | — | manifest schema (`just assets-validate`) | posed-render job idempotency; manifest version bump invalidates safely | — |
| Mobile `render` | scene-graph assembly units (pure parts) | — | consumes generated client | RNTL: view toggle, compare, fallback states, offline | **Golden matrix (§12 T09)**; Maestro: rec → avatar view → pose switch → collage toggle; forced-3D-failure fallback flow |
| Cross-cutting | — | — | dependency-cruiser: `recommendation` ⊥ renderer both directions (CI) | — | device perf lane (T11) |

## 15. Budgets introduced or measured

All values hypotheses until the T11 device runs (doc 13 §12.1 anchors); measured on the doc 13 §7 matrix, raw traces archived.

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | Outfit-on-avatar first render ≤ 3 s mid-tier / ≤ 5 s low-tier (aligned with 3D-first-render row); pose switch ≤ 500 ms; ≥ 30 fps mid-tier during orbit; memory/GPU within doc 13 §12.1 rows; collage render ≤ 1 s any tier | device-farm perf lane (T11), per-tier |
| Cost | $0 AI; posed-render job compute within existing worker budget; CDN egress $0 (R2) | infra metrics |
| AI quality | n/a this phase (provenance/confidence plumbing verified with `captured` assets) | contract tests |
| Reliability | 3D init failure always lands on a working fallback rung (0 error-wall states); asset cache respects disk cap under test; stale manifest never served after invalidation | chaos/fault-injection tests + NFR-PERF-050 cache test |

## 16. Rollout, flags, migration, compatibility, rollback

- **Feature flags (owner + expiry):** `outfit.avatar-presentation` (owner MOB; expiry P11 acceptance) — collage view ships unflagged as the permanent baseline; `outfit.compare` (owner MOB; expiry P14). G2-related UI seams render behind `tryon.g2` flag defined here but **dormant until P11/P13** (owner ML).
- **Migration/backward-compat:** additive contract + endpoints; older clients simply never request presentations. `OutfitPresentation` is versioned — P11 adds G2 levels within v1 (additive enum use, `fallbackChain` already tolerates unknown-to-client levels by skipping down).
- **Rollback plan:** flip `outfit.avatar-presentation` off → all outfits render as G0 collage (designed-good fallback, not a degraded state); manifest rollback = re-point manifest version (client caches keyed by version); revert deploy last. No data migrations to unwind beyond one nullable column.

## 17. Risks, mitigations, assumptions, stop/kill criteria

- Risks in play: **RISK-01** (`react-native-filament` maturity — outfit scene is heavier than P04's avatar-only scene; mitigation: measured early in T05/T11, fallback ladder is product-grade); **RISK-09** (low-end performance — non-3D path is a feature, not a crutch); **ASM-01** revalidated under outfit load.
- **Stop/kill criteria for this phase:** mid-tier devices cannot hold ≥ 30 fps / memory budget on the outfit scene after one optimization pass (LOD, texture budget, panel simplification) → ship the phase with **static posed renders as the default avatar mode** on affected tiers (fallback rung 3), log a DEC entry, and file the renderer escalation per RISK-01's ladder — do not slip the phase chasing frames. Accessibility parity failure (any information available only in 3D) → release-blocked until fixed (REQ-AVA-110 is not negotiable).

## 18. Demo script

Real devices — one mid-tier and one low-tier from the doc 13 §7 matrix:

1. From Today (P09), open the top recommendation → outfit renders on the calibrated A1 avatar in `pose.neutral`; orbit 360°, zoom, switch camera preset to detail (shoes).
2. Switch through all shipped poses — outfit presentation follows; reduced-motion setting on → idle animation and auto-rotate stop.
3. Toggle to G0 collage → same outfit as composed real cutouts with labels; VoiceOver/TalkBack pass: read the outfit as a structured list end-to-end.
4. Open compare → two alternatives side-by-side with differing reason chips highlighted.
5. Save the outfit; open it from Saved → identical presentation via `GET /v1/outfits/{id}/presentation`.
6. On the low-tier device (or with the 3D kill flag): open the same outfit → automatic static-render/2D fallback, full information parity, telemetry event visible on the dashboard.
7. Airplane mode → cached outfit renders (avatar + collage); un-cached alternative shows the collage-with-note path.
8. Show `just arch-check` output proving `recommendation` ⊥ renderer, and the golden-suite run for the outfit matrix.

## 19. Acceptance criteria

- **AC-1:** the same `RecommendationResult` renders as avatar presentation and as G0 collage with no engine round-trip difference (contract test + demo steps 1–3) — REQ-REC-180.
- **AC-2:** `just arch-check` proves zero imports between `recommendation` and renderer/`avatar` in either direction, and renderer packages contain no scoring/constraint code (CI output attached) — REQ-AVA-120/REQ-REC-180.
- **AC-3:** forced 3D init failure on-device lands on the next `fallbackChain` rung with full information parity and no error wall (Maestro fault-injection artifact); every screen showing the outfit has a defined non-3D layout (checklist in PR).
- **AC-4:** full onboarding→recommendation→outfit-view journey completes with 3D disabled, using the collage/structured-list path with equivalent information; screen-reader pass recorded (REQ-AVA-110 P10 slice).
- **AC-5:** save/schedule/mark-worn/compare all work from the presentation surfaces on device (Maestro + demo step 4–5).
- **AC-6:** presentation assets ship via versioned manifests; manifest bump invalidates client caches safely (0 stale serves in test) and the client cache respects its disk cap (NFR-PERF-050 test output).
- **AC-7:** golden suite covers the outfit matrix (presets × poses × cameras) + collage compositions; a seeded rendering change fails the diff and requires explicit `just golden-accept` (demonstrated once in a fixture PR) — NFR-TST-060.
- **AC-8:** device-measured budgets recorded for low/mid/high tiers with raw traces archived; each metric either meets §15 or triggers the documented fallback tier (no unexplained misses) — evidence feeds OQ-08.

## 20. Definition of done

```bash
just test outfit           # incl. presentation assembly + contract tests — no skips
just test media
just lint && just typecheck
just arch-check            # engine ⊥ renderer, both directions
just generate --check
just assets-validate       # presentation manifests + formats
just db-migrate && just db-rollback
just ci-parity
# nightly golden matrix green; device-farm perf lane run with archived traces (T11)
```

Evidence: demo recordings on mid- and low-tier devices (incl. fallback + screen-reader passes), golden-suite baseline PR, device perf report (raw traces, per doc 13 §1 rule 5 — never summarized by hand), render-tier dashboard screenshot.

## 21. Documentation and PROGRESS.md updates

- Docs to update: `docs/modules/outfit.md` (presentation service + contract), `media` contract (new derivative kinds), doc 07 §4.3 conformance note (contract ratified as implemented), doc 13 §12.1 rows updated from hypothesis → measured where T11 ratifies, doc 16: OQ-08 evidence appended; any tier-default DEC from §17.
- [PROGRESS.md](../PROGRESS.md): `IN_PROGRESS` at start; `DONE` only with §20 evidence; handoff entries per rules.

## 22. Handoff note

Written at phase end. Expected shape: P10 `ACCEPTED` unblocks **P11** (with P06). Next session starts at `phases/P11-generative-tryon-and-views.md` task P11-T01; first command: `just test outfit` (green baseline), then read doc 10 §2.4–2.5 and doc 07 §7 before touching anything generative — P11 is eval-gated and nothing user-facing turns on without the gate. Interim handoffs → PROGRESS.md log via [templates/session-handoff.md](../templates/session-handoff.md).
