# P04 — Parametric Avatar v1

> Amended 2026-09-13 ([r7](../research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — service consolidation: pg-boss jobs, owned server + Coolify, self-managed PostgreSQL, R2 delivery model).

> File name: `phases/P04-parametric-avatar-v1.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); write "None" explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P04 — Parametric avatar v1
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Ship the A1 capability: Anny base-mesh set, deterministic measurement→morph mapping with bounds and conflict handling, a calibration/review screen, 4 standard poses with rotation/zoom, appearance customization, versioned avatar assets, and the non-3D accessibility alternative.
- **User-visible outcome:** After entering (or skipping) measurements in onboarding, the user sees a 3D avatar shaped from their data, can correct it with sliders on a calibration screen, switch among 4 poses, rotate/zoom, pick skin tone and hair — or use an equivalent non-3D path.
- **Why now:** P01 proves the native Filament render path on real devices (*re-scoped 2026-09-22, DEC-50: originally the RN+Filament path*) and P03 delivers validated measurements from `profile`; the avatar is the foundation P05 (face), P10 (outfit-on-avatar) build on, and it is the product's first "wow" moment after onboarding.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-AVA-010 | Inclusive Anny base set, ≥3 non-stereotyped base configurations | AC-1 |
| REQ-AVA-020 | Measurement→shape-param mapping with realistic bounds; clamping visible | AC-2 |
| REQ-AVA-030 | Height/proportions/circumferences/composition drive morphs monotonically | AC-3 |
| REQ-AVA-040 | Rig compatible + topology stable across all morphs | AC-4 |
| REQ-AVA-050 | Inclusive skin tone, hair, optional appearance customization | AC-5 |
| REQ-AVA-060 | Calibration/review screen; corrections persist and survive reprocessing | AC-6 |
| REQ-AVA-070 | Incomplete/conflicting/implausible measurements handled explicitly | AC-7 |
| REQ-AVA-080 | Avatar assets versioned and migratable (schema/topology/rig axes) | AC-8 |
| REQ-AVA-090 | 4 standardized poses + 360° rotation and zoom (full set; proto in P01) | AC-9 |
| REQ-AVA-100 | Camera/lighting/PBR/LOD/compression/streaming within budgets + low-end fallbacks (P04 slice; ratified P14) | AC-10 |
| REQ-AVA-110 | Non-3D accessibility alternative (P04 slice: calibration + avatar view; outfit slice in P10) | AC-11 |
| REQ-AVA-120 | Renderer-independent contracts; `recommendation` ⊥ renderer (P04 slice: `AvatarConfig`/asset-manifest contracts live; CI rule from P02 extended) | AC-12 |
| NFR-TST-060 | Golden/visual regression suite for avatar poses/morphs starts here (garment slice in P10) | AC-13 |

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P01** (render gate passed, formats ratified per REQ-MED-100), **P03** (measurements in `profile`, onboarding walking skeleton) — per SPINE §5.
- External blockers:
  - **OQ-10** (which pose set: 3 vs 4, which occasion pose) — resolve at phase start, log DEC; the plan below assumes the 4-pose set of doc 07 §4.1.
  - **RISK-06** (Anny production-asset readiness) — the P04-T01 asset-pipeline task is the validation point; MPFB2 fallback stays warm.
  - No vendor accounts or legal reviews block this phase (face/biometric items belong to P05).

## 4. In scope / out of scope

**In scope:** Anny base asset pipeline (Blender-headless → glTF/KTX2/Draco via CI); `avatar` module (configs, mapping, versioning); calibration screen with sliders, confidence display, conflict prompts; 4 poses + camera/rotation/zoom + neutral IBL lighting; skin tone/hair/appearance; avatar asset manifests + custom-domain cached delivery (public app assets, DEC-44) + client caching; low-end rendering-tier fallback incl. static renders; non-3D calibration path; golden/visual regression harness; avatar analytics events.

**Out of scope / non-goals for this phase:** face personalization (A2 → [P05](P05-selfie-face-personalization.md)); any garment on the avatar (→ [P10](P10-outfit-on-avatar.md)); G2 try-on (→ P11); A3 scan-grade twin (explicit non-goal, SPINE §4); server-side face reconstruction (doc 07 §5.2); minor/child base meshes (doc 07 §3.1); mood lighting presets beyond the neutral default (later).

## 5. Product/UX behavior

Journey detail owned by [02-user-journeys §5](../02-user-journeys-and-information-architecture.md); states summarized here.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Avatar derivation (post-measurements) | Mapping runs locally <1 s; avatar preview appears | No measurements → A0 generic base renders immediately with dismissible "add measurements" prompt; never a blank screen | Mapping error → A0 base + diagnostic event; "try again" | Mapping is deterministic client code; works offline | Non-3D users get 2D silhouette proxy + numeric summary |
| Calibration screen | Live 3D preview, grouped sliders (overall/torso/limbs), confidence indicator ("based on N of 12 measurements"), accept emits `avatar.calibrated` | Preset-only start (T0) shows all regions as "estimated" | 3D init failure (GPU/driver) → automatic non-3D fallback with same sliders as numeric fields; "Try 3D again" affordance; failure recorded as device telemetry | Slider edits persist locally, queue, sync later | Every slider screen-reader operable with value announcements; touch targets ≥44 pt; reduced motion honored |
| Conflict/implausible data | Inline "double-check the number/units" naming the specific fields; explicit user confirm stores value with `userConfirmedOutlier` | n/a | Hard-invalid input rejected inline with unit hint, not stored | Same (local validation) | Prompts never comment on the body itself — only on numbers/units (doc 07 §3.3) |
| Pose gallery + viewer | 4 poses, 360° orbit, ±30° vertical clamp, pinch-zoom 0.5–3×, double-tap reset | Assets not yet downloaded → static preview image, determinate download progress | Asset download failure → resumable retry; corrupt asset → hash check fails, re-fetch | Cached assets render offline; pose switching works once cached | Reduced-motion disables idle animation/auto-rotate; viewer exposes labels, never traps focus |
| Appearance (skin/hair) | Continuous skin-tone picker (Monk-scale coverage), hair library, tint picker | Defaults from base preset | Save failure → local retain + retry banner | Edits queue offline | Pickers labeled; color choices also named in text |
| Low-end devices | Capability detection selects tier: full 3D → reduced 3D → static per-pose renders (carousel) → 2D silhouette + numeric | Same ladder | Tier downgrade on repeated GPU failure, logged | Static renders cached | The static/2D tiers are the same surfaces the accessibility path uses — one implementation |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); update each touched module's contract file.

| Module | Change | Contract update needed? |
|---|---|---|
| `avatar` | New module goes live: `avatar_configs` (AvatarConfig v1 per doc 07 §3.2), `avatar_assets`, measurement→morph mapping service, bounds/imputation/conflict validation, versioning/migration jobs | Yes — create `docs/modules/avatar.md` |
| `profile` | Read-only consumer relationship: `avatar` subscribes to `profile.measurements.updated.v1`; no schema change | Yes — note the consumer in its contract |
| `media` | Avatar asset kind (`avatar_asset`) in the asset store; CDN manifests for avatar bundles | Yes — asset-kind addition |
| `outfit` | `OutfitPresentation` contract stub ratified (schema only, no behavior) so P10/P09 consumers have a stable seam (REQ-AVA-120) | Yes — contract file created with schema-only status |
| `shared-kernel` | Morph-target/joint/pose name registry; skin-tone palette ids | Yes |
| `platform` | R2 custom-domain (Cloudflare-cached) delivery of versioned avatar manifests — public app assets only, per DEC-44; client LRU asset cache policy | Yes |
| `recommendation` | **No change** — dependency-cruiser rule (from P02) verified to forbid `recommendation` → `avatar`/renderer | No |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`):
  - `GET/PUT /v1/avatar/config` (AvatarConfig v1: shapeParams, refinements, appearance, version triplet)
  - `POST /v1/avatar/config/derive` (re-run mapping from current measurements; server-authoritative record of a client-computed result)
  - `GET /v1/avatar/assets/manifest?topology=&rig=` (compatibility-resolved manifest)
- Event schemas added/changed: `avatar.config.updated.v1` (already cataloged in doc 06 §4), `avatar.calibrated.v1` (new; payload: avatarId, paramsVersion, refinementCount, confidenceTier). Consumer registration: `media` (asset regeneration), `outfit`.
- DB migrations (Drizzle): `00XX_avatar_add_configs.sql` (avatar_configs, avatar_assets, avatar_config_migrations audit table). Forward: additive only. Rollback: drop tables (safe pre-launch; expand–contract per doc 06 §7 once data exists).
- Generated clients to regenerate: mobile TS client + event types (`just generate`); asset-manifest JSON schema in `packages/contracts`.

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Calibration screen (3D + non-3D variants); pose gallery/viewer (orbit, zoom, camera presets, reduced motion); appearance pickers; rendering-tier capability detection + fallback ladder; asset download/cache (LRU ≤300 MB per doc 07 §9); local mapping engine (shared TS package so server and client agree) |
| Backend | `avatar` module (config CRUD, derive, versioning/migration jobs); manifest resolution endpoint; events + outbox wiring |
| Workers (ML/media) | None (mapping is deterministic; no ML worker in this phase) |
| Data / migrations | avatar tables migration; seed fixtures: 6 diverse body-preset configs + extreme-parameter configs for tests |
| Infrastructure | CI asset lane: Blender-headless export → gltfpack/glTF-Transform → `just assets-validate` gate; R2 bucket paths + manifest publication; golden-render emulator lane (nightly) |
| 3D / assets | Anny base set (`anny-adult-v1` topology, `anny-rig-v1`), morph-target library, 4 pose clips, hair mesh library, neutral studio IBL (KTX2), LOD chain; all validated by `just assets-validate` (topology/joint/morph-name checks per doc 07 §3.5) |
| Admin / internal tools | None beyond existing dashboards (see §11) |

## 9. AI vs deterministic decisions

For each AI use in this phase: classification (per brief §3.1), why deterministic code is insufficient, contract, fallback, cost budget — or link to the owning row in [10-ai-usage-cost-and-evaluation.md](../10-ai-usage-cost-and-evaluation.md).

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Measurement→morph mapping | **Deterministic** (fitted linear/low-order regression, doc 07 §3.3) | Anny params are interpretable; no model call needed; runs on device | n/a — it is the fallback | $0 marginal |
| Missing-measurement imputation | **Deterministic** (same regression; flagged `source: "estimated"`) | Statistical imputation, no generation | Show "estimated" + prompt to add fields | $0 |
| Bounds/conflict validation | **Deterministic** (anthropometric corridors) | Rule-based | n/a | $0 |
| Rendering/LOD/tier selection | **Deterministic** (device capability heuristics) | Geometry/perf logic | Static renders → 2D | $0 |

**This phase introduces zero paid AI calls.** Any proposal to add one requires the doc-10 entry first (NFR-AIC-010).

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11](../11-security-privacy-and-compliance.md)): `avatar_configs` derive from body measurements → **S3** handling (derived data inherits max input class, doc 11 §6). No face data in this phase.
- Consent required / consent UI changes: none new — avatar derivation is covered by `core_service` (measurements consent handled in P03). No photos are processed.
- Retention, deletion, and export impact: avatar configs + assets join the account-deletion cascade (doc 11 §13.2 step 4–5) and the data export bundle (config JSON + rendered avatar assets marked derived). Deletion test added.
- Threat/abuse cases added to the threat model: none new (no new upload surface). Verify avatar params never appear in logs/analytics (forbidden-field lint; params are body-derived S3).

## 11. Observability and analytics added in this phase

- Logs/metrics/traces for what this phase introduces: avatar derive/calibrate spans with correlation ids; asset-manifest fetch latency; client metrics batched: 3D first-render time, fps bucket, rendering-tier distribution, 3D-init failure rate by device model; CDN cache hit rate for avatar assets (target ≥90%, NFR-PERF-050 hypothesis).
- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `avatar_created` (`base_model`, `capability`), `avatar_calibration_adjusted` (`params_changed_count`), `avatar_pose_changed` (`pose_id`). Calibration correction magnitude + abandonment tracked as eval signal for the mapping regression (doc 07 §3.4; anonymized parameter deltas only, never photos).
- Alerts/dashboards/runbook entries: dashboard panels — 3D-init failure rate, tier distribution, first-render p95 per device tier, asset 404/hash-mismatch rate; alert on 3D-init failure >5% of sessions on mid/high tier; runbook entry "avatar assets failing to load" (manifest rollback procedure, §16).

## 12. Ordered tasks

Small enough for one AI-assisted session each. Task IDs `P04-T##` are referenced by handoff entries.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P04-T01 | Anny asset pipeline: Blender-headless export → glTF/KTX2/Draco, topology/rig validation in `just assets-validate`; produce `anny-adult-v1` base + LOD chain (RISK-06 validation point) | — | 2 |
| P04-T02 | Morph-target library + shared-kernel name registry; CI checks (vertex count/order identical across morphs, joint weights sum 1) | P04-T01 | 1 |
| P04-T03 | Pose clips (4, per OQ-10 DEC) + neutral IBL + manifest schema in `packages/contracts`; `just generate` | P04-T01 | 1 |
| P04-T04 | Mapping engine package (TS, shared mobile/server): regression, bounds, imputation w/ `source: "estimated"`, conflict severities 1–3, unit-confusion checks; property tests | — | 2 |
| P04-T05 | `avatar` backend module: tables, config CRUD + derive endpoint, events, outbox wiring, migration `00XX_avatar_add_configs.sql` up/down | P04-T04 | 1 |
| P04-T06 | Manifest resolution endpoint + R2 publication + client asset cache (LRU, hash verification) | P04-T03, P04-T05 | 1 |
| P04-T07 | Mobile 3D viewer: scene setup, orbit/zoom/camera presets, pose switching, reduced-motion, thermal/fps caps | P04-T03, P04-T06 | 2 |
| P04-T08 | Calibration screen (3D variant): sliders bound to params + curated blend shapes, refinement deltas, confidence indicator, reset/undo, `avatar.calibrated` emit | P04-T04, P04-T07 | 2 |
| P04-T09 | Conflict/implausible-data UX: prompts, `userConfirmedOutlier` flow, estimated markers | P04-T08 | 1 |
| P04-T10 | Appearance customization: skin-tone picker (Monk-scale coverage review), hair library + tint, optional face-shape sliders | P04-T07 | 1–2 |
| P04-T11 | Rendering-tier detection + fallback ladder incl. static per-pose renders; non-3D calibration path (numeric fields + 2D silhouette) | P04-T07, P04-T08 | 2 |
| P04-T12 | Avatar asset/config versioning + migration: lazy config migration fn, topology/rig re-derivation job replaying refinements, fixture-based migration test (v1→v2) | P04-T05 | 1 |
| P04-T13 | Golden/visual regression harness: deterministic render matrix (presets × poses × 2 cameras), SSIM/pixelmatch diff, baseline store, `just golden-accept` flow, nightly lane | P04-T07 | 2 |
| P04-T14 | Observability + analytics events; deletion-cascade + export coverage for avatar data; device-lane battery/thermal measurement run | P04-T08, P04-T11 | 1 |

## 13. Parallelization

- Can run in parallel: **Group A** (assets: T01→T02→T03, files under `assets/` + contracts) ∥ **Group B** (mapping: T04, pure TS package) ∥ **Group C** (backend: T05 after T04 lands, `apps/api/src/modules/avatar/`). After T06/T07: **T08–T09** (calibration UI) ∥ **T10** (appearance) ∥ **T12** (versioning, backend-only) ∥ **T13** (golden harness, test infra). Disjoint file sets per the parallel-session rules in [CLAUDE.md](../CLAUDE.md).
- Must be serial: T01→T02→T03 (each consumes the previous artifact); T04→T05 (server imports the mapping package); T07 before any 3D UI task; contract/schema changes (`packages/contracts`, `shared-kernel`) are single-writer — sequence T03, T05, T06 contract edits.

## 14. Test-first plan (by module and level)

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `avatar` (mapping pkg) | Mapping table per doc 07 (each measurement→param), clamping notices, imputation flags | fast-check: monotonic mesh response per measurement (REQ-AVA-030); bounds never exceeded; imputed values always flagged; conflict severities injected (REQ-AVA-070) | AvatarConfig v1 schema round-trip vs OpenAPI | derive endpoint persists + emits events (Testcontainers PG) | — |
| `avatar` (backend) | Config CRUD, version triplet rules | Migration fn idempotence | `just generate --check` clean; event schema pinned | v1→v2 migration preserves refinements (REQ-AVA-080) | — |
| 3D / assets | — | — | Manifest schema validation | `just assets-validate`: topology stability, morph names, joint weights (REQ-AVA-040) | Golden matrix: presets × 4 poses × 2 cameras incl. parameter extremes (NFR-TST-060); skinning at extremes |
| Mobile | Slider state, tier-detection logic | — | Generated client compile + mock-server contract test | Calibration flow with native UI tests (Compose/Robolectric; iOS models + simulator) incl. non-3D variant | Maestro: measurements→avatar→calibrate→pose-switch on emulator; device lane measures §15 budgets; a11y checks (labels, non-3D alternative presence is an automated check per doc 13 §7) |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

All values are hypotheses from [13 §12](../13-testing-quality-and-performance.md)/[07 §10](../07-3d-avatar-and-garment-pipeline.md) until measured on the §7-of-doc-13 device matrix; P04 measures, P14 ratifies.

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | 3D first render ≤5/3/2 s (low/mid/high); viewer ≥30/60/60 fps; app memory (3D screen) ≤700/900/1200 MB; GPU memory ≤250/400/600 MB; base avatar bundle ≤2 MB; battery ≤4/3/3% per 10-min 3D session; no sustained thermal throttle in 10 min | Device-lane runs (builds from the `ios`/`android` workflows on a device farm + local P01 devices), raw traces archived; `just assets-validate` for bundle size |
| Cost | $0 marginal AI; CDN egress $0 (R2); asset storage delta <$1/mo at launch scale | R2 dashboard; cost panel per doc 14 |
| AI quality | n/a this phase (no AI calls). Mapping quality proxy: calibration correction magnitude baseline established; RISK-05 gate ≥90% "recognize my shape" in calibration testing | Pilot-user calibration test protocol + `avatar_calibration_adjusted` analytics |
| Reliability | 3D-init failure ≤5% of sessions mid/high tier (fallback covers the rest); asset cache hit ≥90%; manifest fetch p95 ≤300 ms | Client metrics + CDN dashboards |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): `avatar-3d-enabled` (kill switch to static-render/2D ladder; owner MOB, expiry P14 ratification), `avatar-calibration-v1` (owner MOB, expiry end of P05). Registered per [14 §11](../14-observability-operations-and-analytics.md) flag policy.
- Migration/backward-compatibility plan: first release of avatar tables — additive migration only. Asset compatibility via manifest `(topology, rig, minClientVersion)`; older clients resolve older manifests (doc 07 §3.7/§9). AvatarConfig `schema: 1` is the baseline; migration functions required from the first bump onward (tested in P04-T12).
- Rollback plan: (1) flip `avatar-3d-enabled` off → non-3D ladder serves everything (no data loss); (2) manifest rollback = re-point manifest alias to previous semver (assets are immutable, hash-addressed); (3) DB rollback via `just db-rollback` (tables additive, down path tested on a scratch database restored from the staging backup); (4) mobile release rollback per store staged-rollout policy (doc 15).

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); add phase-local ones there, not here.

- Risks in play: **RISK-05** (measurement→morph accuracy/trust), **RISK-06** (Anny production-asset readiness; ASM-02), ~~RISK-01~~ (retired 2026-09-22; the residual renderer risk is Filament C++ integration on both platforms, the first heavy production use), **RISK-09** (low-end performance), **RISK-16** (capacity).
- **Stop/kill criteria for this phase:**
  - RISK-06: asset pipeline cannot produce stable morphing glTF (topology validation keeps failing) by end of P04-T02's second session → switch base meshes to MPFB2, log DEC, re-run T01–T02.
  - RISK-05: <90% "recognize my shape" in calibration testing after one mapping-tuning iteration → make manual sliders the primary path with auto-mapping assistive-only; log DEC.
  - RISK-09: mid-tier device cannot hold ≥30 fps at lowest LOD → cap mid-tier at reduced-3D tier, raise with renderer optimization backlog; low tier already defaults to non-3D.

## 18. Demo script

Exact steps proving the vertical slice end-to-end on a real device/environment.

1. On a real mid-tier Android device and a real iPhone (doc 13 §7 matrix), sign in as a fresh P03 test account; complete measurements at tier T2 (height, weight, bust, waist, hips), switching units once to show lossless conversion feeding the same mapping.
2. Observe the derived avatar appear on the calibration screen with the confidence indicator ("based on 5 of 12 measurements") and at least one "estimated" region marker (AC-2, AC-7).
3. Enter an implausible waist value (severity-2 conflict); show the named-field double-check prompt; confirm it; show `userConfirmedOutlier` stored (server record) (AC-7).
4. Adjust two sliders; accept; re-run "derive from measurements"; show the slider deltas survive re-derivation (AC-6).
5. Open the pose gallery: switch through all 4 poses, rotate 360°, pinch-zoom; toggle reduced motion and show idle animation stops (AC-9).
6. Change skin tone across the ramp and pick a hair style; show persistence after app restart (AC-5).
7. Enable the non-3D setting: repeat calibration via numeric fields + 2D silhouette; VoiceOver/TalkBack pass over the sliders (AC-11).
8. Show the same avatar on a low-tier device rendering via the static-render carousel (fallback ladder) (AC-10).
9. Show the nightly golden-render diff report (green) and one intentionally broken morph failing the diff (AC-13, evidence capture).
10. Run the account-deletion flow on a throwaway account; verify avatar rows and R2 avatar assets are gone (deletion evidence, §10).

## 19. Acceptance criteria

Objectively verifiable statements — no "works well".

- AC-1: ≥3 base starting presets ship on one `anny-adult-v1` topology; a reviewer produces three visibly distinct, non-stereotyped bodies from them in the demo; presentation/gender fields in `profile` place no constraint on reachable body parameters (code inspection + test).
- AC-2: The measurement→param mapping table is published in doc 07 §3.3 form and unit-tested; out-of-bounds input produces a stored clamp record and a user-visible notice.
- AC-3: Property tests demonstrate monotonic, plausible mesh response (vertex-displacement direction checks) for each mapped measurement; golden renders show the progression for 3 measurements.
- AC-4: `just assets-validate` proves identical vertex count/order across all morph targets and valid skinning at parameter extremes; CI fails on violation.
- AC-5: Skin-tone picker coverage is documented against a Monk-scale-like reference in the P04 design review note; hair library spans ≥3 curl/texture classes; all appearance fields optional and editable.
- AC-6: A calibration correction survives (a) re-derivation from changed measurements and (b) the v1→v2 config migration test; "reset to my measurements" requires explicit confirm.
- AC-7: Automated tests inject missing, conflicting, and implausible inputs; each yields the documented behavior (imputed+flagged, named-field prompt, confidence display) — never a silently invented value.
- AC-8: Avatar manifests carry `(schema, topology, rig)` versions; the migration test upgrades a v1 fixture config to v2 without losing user calibration; unmappable refinements are surfaced, not dropped.
- AC-9: On-device demo (video evidence) switches among 4 poses and rotates/zooms; pose set matches the OQ-10 DEC entry.
- AC-10: Device-lane report records fps, first-render, memory, GPU memory, battery, thermal per tier against §15; low-tier device serves the documented fallback ladder.
- AC-11: The calibration + avatar-view journey completes end-to-end with 3D disabled, via numeric fields + 2D/static presentation; automated check asserts the non-3D alternative exists for every 3D screen.
- AC-12: dependency-cruiser CI proves no `recommendation` → `avatar`/renderer import; `AvatarConfig` and asset-manifest schemas live in `packages/contracts` and the generated client consumes them (`just generate --check` clean).
- AC-13: Golden suite runs nightly on the render matrix; an introduced visual regression fails the diff and requires explicit `just golden-accept` with a named change.

## 20. Definition of done

Exact commands and evidence required:

```bash
just test avatar          # all pass, no skips (module tests incl. mapping pkg)
just test profile         # consumer-side event tests
just lint && just typecheck
just arch-check           # module boundaries incl. recommendation ⊥ avatar rule
just generate --check     # contracts/clients not stale
just assets-validate      # 3D asset gate green
just db-migrate && just db-rollback && just db-migrate   # on a scratch database restored from the staging backup: up/down/up proven
just ci-parity            # full PR gate locally
# phase-specific: nightly golden lane green; device-lane run on low/mid/high per doc 13 §7
```

Evidence to attach/link: device-lane metric readouts (raw traces archived), demo video of §18 on two real devices, golden-diff report, migration test output, deletion-cascade test output, Monk-scale coverage review note — never fabricated (CLAUDE.md honesty rules).

## 21. Documentation and PROGRESS.md updates

- Docs to update: create `docs/modules/avatar.md`; update `docs/modules/{media,outfit,profile,shared-kernel,platform}.md` for the §6 changes; doc 07 §3.3 mapping table published with the fitted coefficients; doc 16: DEC for OQ-10 pose set (+ any RISK-05/06 outcomes); runbook "avatar assets failing to load" in doc 14's runbook set; ADR if MPFB2 fallback triggered.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence; `ACCEPTED` only after a different session/PO verifies §18.

## 22. Handoff note

Where exactly the next session starts (phase, task ID, first command). Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md).

On P04 `ACCEPTED`: next sessions may start **P05-T01** (`phases/P05-selfie-face-personalization.md`) and/or continue **P06** (independent — P06 depends only on P03). First command for the next session: `just doctor`, then read the target phase file top-to-bottom.
