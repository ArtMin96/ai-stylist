# P05 — Selfie Face Personalization

> File name: `phases/P05-selfie-face-personalization.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); write "None" explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

## 1. Overview

- **Phase:** P05 — Selfie face personalization
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Ship the optional, separately consented A2 path — guided selfie capture with on-device landmark extraction producing a stylized likeness on the avatar head — with honest accuracy language, misuse protections, and a complete deletion cascade including derived assets.
- **User-visible outcome:** A user who opts in can take a guided selfie and see a stylized face that resembles them on their avatar, with a confidence indicator; a user who declines keeps a fully featured app with the generic face; either can delete face data at any time and everything derived from it disappears.
- **Why now:** The A1 avatar (P04) exists to put a face on; A2 is the highest-sensitivity feature in the product and is deliberately isolated in its own phase so consent, legal review (LR-05/LR-06), and the SPK-1 quality gate can kill or geo-gate it without touching MVP value (A2 is fully severable — doc 00 ladder, RISK-07).

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-FAC-010 | Strictly optional; privacy-preserving generic face default | AC-1 |
| REQ-FAC-020 | Guided capture: camera/lighting/pose guidance, quality validation, retake, crop, review | AC-2 |
| REQ-FAC-030 | Explicit, separate consent before any face processing | AC-3 |
| REQ-FAC-040 | On-device processing (ARKit/MediaPipe → A2); server path documented + separately consented | AC-4 |
| REQ-FAC-050 | Secure handling, retention limits, full deletion incl. derived assets | AC-5 |
| REQ-FAC-060 | Honest accuracy levels (A-ladder) + confidence indicator; no "digital twin" claims | AC-6 |
| REQ-FAC-070 | Fallback when one selfie is insufficient, incl. guided multi-angle capture | AC-7 |
| REQ-FAC-080 | Misuse protection: unauthorized face creation, third-party images (P05 slice; hardening pass in P14) | AC-8 |
| NFR-PRV-020 | Face consent is per-purpose, revocable, versioned (P05 slice of the consent registry) | AC-3 |
| NFR-PRV-040 | Deletion propagates to derived assets (P05 slice: face-scoped cascade) | AC-5 |
| NFR-PRV-050 | S3 face data: encrypted, audited access, never in logs/analytics/prompts (P05 slice) | AC-9 |

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P04** (avatar head, appearance system, asset versioning) — per SPINE §5.
- External blockers:
  - **LR-05** (BIPA-class compliance: consent wording, retention/destruction schedule) — **blocks shipping** this phase; engineering may build behind the flag, but the flag stays off until counsel signs off ([11 §12](../11-security-privacy-and-compliance.md)).
  - **LR-06** (DPIA for face processing) — due P05.
  - **OQ-06** (regional gating list for A2) — needs counsel input; ship list must exist before rollout.
  - **RISK-07** (face/biometric compliance) — pre-ship review is this phase's gate.

## 4. In scope / out of scope

**In scope:** `face_processing` consent screen + registry integration; guided selfie capture UX (live-camera-first) with on-device quality validation; on-device landmark extraction (ARKit / MediaPipe Face Landmarker); deterministic landmarks→head-morph mapping; stylized-likeness review screen with confidence indicator; multi-angle fallback capture; face-data deletion cascade (consent withdrawal and account deletion paths) incl. derived avatar assets and CDN copies; misuse protections (single-face, capture-first, self-attestation, gallery-import heuristics); regional gating mechanism; UI-copy honesty audit; SPK-1 evaluation.

**Out of scope / non-goals for this phase:** server-side face reconstruction (doc 07 §5.2 — documented path only, own consent + gate, not built); A3 scan-grade twin (explicit non-goal, SPINE §4); face search or cross-user face matching (never, doc 07 §5.3); emotion/attribute inference from faces (forbidden, [11 §11](../11-security-privacy-and-compliance.md)); apparent-minor selfie hardening beyond the baseline check (deepened in P14 with NFR-SEC-090/REQ-FAC-080).

## 5. Product/UX behavior

Journey detail owned by [02-user-journeys §4](../02-user-journeys-and-information-architecture.md); states summarized here.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Entry + consent (S1/S2) | Plain-language explanation (what happens, where processed — on device, retention, deletion), explicit opt-in | No selfie yet → Avatar studio shows generic face with dismissible "Personalize" affordance; no journey ever blocks on the selfie prompt | Declining = "Not now" → generic face selected, zero nagging | Consent screen readable offline; grant requires connection (consent record is server-side before any processing) | Screen-reader complete; consent copy at plain-language reading level; no dark patterns (equal-weight buttons) |
| Guided capture | Framing/lighting overlay, neutral-expression prompts, capture | n/a | Quality validation fail (blur/dark/multi-face/angle) → *specific* guidance ("Too dark — face a window"), retake loop; ≥2 failures → generic face offered prominently | Capture + on-device validation work offline; nothing needs upload in this path | Voice-guided capture cues; capture alternative: gallery upload (with heuristics, see misuse row) |
| Processing + review | On-device landmarks <3 s → stylized likeness applied to head; review with confidence indicator ("Good match" / "Approximate — add angles to improve") | — | Processing failure → photo retained locally only, Retry/Discard; repeated failure → generic face + diagnostic event (no image content in logs) | Fully on-device; works offline; derived parameter vector syncs later | Result review announces the confidence level in text; no fake accuracy percentage |
| Multi-angle fallback | Low landmark confidence → offer 2–3 additional ¾-view captures, each optional; confidence reflects what was provided | Any subset accepted (partial state) | Same retake loop per angle | Same | Same |
| Adjust / reject | Manual tweaks (skin tone, hair, features via P04 appearance system); Reject → generic face | — | — | Edits queue | Sliders per P04 a11y contract |
| Delete face data (Settings → Privacy) | One action: deletes selfie, landmark vectors, face-derived avatar assets; avatar reverts to generic face; confirmation shows what was removed | — | Cascade job failure → visible "deletion in progress" state until verified complete; never silently partial | Queued if offline; state visible | Deletion reachable in ≤3 taps from Settings; screen-reader labeled |
| Misuse guards | Live camera is default; gallery import runs single-face/frontal/quality heuristics + "Is this you?" attestation; clearly-different-person on re-capture → confirmation prompt, not silent accept | — | Rejected imports get specific reasons | On-device checks | Attestation is a labeled control, not buried |

## 6. Domain and architecture changes (by owning module)

Module names per [SPINE §3](../SPINE.md); update each touched module's contract file.

| Module | Change | Contract update needed? |
|---|---|---|
| `identity` | `face_processing` consent purpose wired (registry exists from P03); consent events gate processing; misuse/attestation record | Yes |
| `avatar` | `faceAsset` ref on AvatarConfig activated; head blend-shape application; `needs-recapture` state on incompatible topology bumps (doc 07 §3.7) | Yes |
| `media` | New asset kind `selfie` (device-local in v1 — server row only for the derived parameter vector); face-derived asset lineage + face-scoped deletion cascade | Yes |
| `platform` | Regional-gating config (OQ-06 list) served via feature-flag payload | Yes (flag payload schema) |
| `admin` | Face-data deletion verification view (audit of cascade completion) | Yes |

Architectural invariant reaffirmed: the selfie image never leaves the device in v1 ([10 §2.6](../10-ai-usage-cost-and-evaluation.md)); only the derived landmark parameter vector (S3) syncs, encrypted.

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`):
  - `PUT /v1/avatar/face` (upload derived face-parameter vector + rig-version binding; requires active `face_processing` consent — 403 with reason code otherwise)
  - `DELETE /v1/avatar/face` (face-scoped deletion cascade trigger)
  - Consent endpoints from P03 reused (`identity`); no new consent API shape.
- Event schemas added/changed: `identity.consent.changed.v1` consumers extended (`media`, `avatar` halt/purge on `face_processing` withdrawal); new `avatar.face.applied.v1` (avatarId, rigVersion, confidenceTier — no biometric payload, ids only per doc 06 outbox rules); new `media.face_assets.deleted.v1` (cascade completion, audited).
- DB migrations (Drizzle): `00XX_avatar_add_face_vector.sql` (encrypted face-parameter vector column/table keyed to rig version + consent record id), `00XX_media_add_face_lineage.sql`. Forward additive; rollback = drop (expand–contract per doc 06 §7 once live).
- Generated clients to regenerate: mobile TS client + event types (`just generate`).

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Consent screen (S1/S2); guided capture with overlay + on-device quality validation; ARKit (iOS) / MediaPipe Face Landmarker (Android) integration behind one native-bridge interface; landmarks→head-morph deterministic mapping; review + confidence UI; multi-angle flow; delete-face-data flow; gallery-import heuristics + attestation |
| Backend | Face-vector endpoint with consent guard (integration-tested: no processing/storage before consent record exists); face-scoped deletion cascade job (Trigger.dev, idempotent, audited steps); regional gating check |
| Workers (ML/media) | None (processing is on-device; no server ML path in v1) |
| Data / migrations | Face-vector + lineage migrations; synthetic face-vector fixtures (never real biometric data — [13 §2](../13-testing-quality-and-performance.md)) |
| Infrastructure | Encryption-at-rest verification for the face-vector store; flag + regional gating config; audit-log wiring for every S3 face-data access |
| 3D / assets | Head blend-shape set for likeness mapping (extends P04 morph library, same topology rules); stylized-likeness tuning presets |
| Admin / internal tools | Deletion-cascade verification view; moderation hook stub for the (future) server path — documented, not built |

## 9. AI vs deterministic decisions

Owning row: [10 §2.6](../10-ai-usage-cost-and-evaluation.md) (Selfie → stylized face likeness A2, classification: conventional CV, on-device).

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Face landmark extraction | **CV model, on-device only** (ARKit / MediaPipe) | Landmark detection is learned CV; no deterministic substitute | Guided retake ×2 → generic face (A0/A1) | $0 marginal; <3 s on-device |
| Landmarks → head morphs | **Deterministic** (mapping math we own) | Geometric mapping, no model | n/a | $0 |
| Quality validation (blur/exposure/single-face) | **Deterministic + on-device CV primitives** | Standard image checks | "Keep anyway" is NOT offered for faces (quality gates the likeness result honesty) | $0 |
| Gallery-import misuse heuristics | **Deterministic rules over on-device detections** | Rule thresholds on landmark/face-count output | Reject with reason; live capture preferred | $0 |

**Zero server-side AI calls and zero paid AI calls in this phase.** The server reconstruction path stays a documented, separately gated future capability (doc 07 §5.2).

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11 §6](../11-security-privacy-and-compliance.md)): selfies (device-local only), face landmark vectors, face-personalized avatar assets — all **S3** (biometric-adjacent). Encrypted at rest; every access audited; break-glass only.
- Consent required / consent UI changes: `face_processing` purpose — explicit, separate, revocable, versioned policy doc, dedicated screen (never bundled — [11 §7.2](../11-security-privacy-and-compliance.md)). BIPA-grade handling nationwide per LR-05: retention/destruction schedule shown at consent time (delete on withdrawal, account deletion, or 3 y inactivity — whichever first); no sale/lease/trade; no cross-user comparison, no identification use, ever.
- Retention, deletion, and export impact: original selfie discarded after derivation by default (opt-in keep for re-derivation, device-local); withdrawal runs doc 11 §13.2 steps 3–5 scoped to face assets (selfies, landmark vectors, A2 avatar assets, CDN copies) and reverts to generic face; account deletion includes the same set; export bundle includes the face-parameter vector + derived assets marked with provenance; hard delete ≤30 d of request.
- Threat/abuse cases added to the threat model: unauthorized face creation / processing another person's image (11 §3.1) — mitigations shipped here: capture-first UX, single-face + frontal heuristics on imports, "is this you?" attestation, different-person-on-recapture confirmation, ToS prohibition; moderation path reserved for the server path. No face search, no cross-user matching (structural mitigation per 11 §11). Apparent-minor selfie rejection per age policy (11 §10).

## 11. Observability and analytics added in this phase

- Logs/metrics/traces: consent grant/withdraw counts (by policy version); landmark extraction success rate + duration buckets (device-side, aggregated — **no image data, no landmark payloads**, forbidden-field lint enforced); deletion-cascade job metrics (started/completed/duration, orphan-scan results); regional-gate denials count.
- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `selfie_face_enrolled` (`capability: A2`, `quality_bucket`), `selfie_face_removed`. Consent-gated per `analytics` purpose; properties are enums/buckets only.
- Alerts/dashboards/runbook entries: alert on deletion-cascade failure or orphan detected (privacy guardrail metric, NFR-OBS-100); dashboard: enrollment funnel (consent shown → granted → capture success → kept), SPK-1 acceptance rate by demographic slice (consented eval panel only); runbook: "face-data deletion cascade stuck" (manual replay via idempotent job re-trigger).

## 12. Ordered tasks

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P05-T01 | Consent screen + `face_processing` wiring: policy-versioned copy (LR-05 wording placeholder pending counsel), grant/withdraw flows, consent-gate integration test (no processing before record exists) | — | 1 |
| P05-T02 | Native landmark bridge: one TS interface, ARKit + MediaPipe implementations, extraction confidence output; device smoke tests both platforms | — | 2 |
| P05-T03 | Guided capture UX: overlay, on-device quality validation with specific guidance, retake loop, crop/review | P05-T02 | 2 |
| P05-T04 | Landmarks→head-morph deterministic mapping + head blend-shape assets; stylized-likeness tuning; unit + golden tests | P05-T02 | 2 |
| P05-T05 | Review screen: confidence indicator, accept/adjust/reject, apply-to-avatar (`avatar.face.applied.v1`), honest-copy strings | P05-T03, P05-T04 | 1 |
| P05-T06 | Multi-angle fallback flow (2–3 optional angles, partial-subset handling) | P05-T05 | 1 |
| P05-T07 | Backend: face-vector endpoint with consent guard + encryption; migrations; rig-version binding + `needs-recapture` on topology bump | P05-T01 | 1 |
| P05-T08 | Face-scoped deletion cascade: Trigger.dev job (idempotent, audited), consent-withdrawal trigger, account-deletion integration, orphan verification scan; deletion-cascade test | P05-T07 | 2 |
| P05-T09 | Misuse protections: gallery-import heuristics, self-attestation, different-person re-capture confirmation, apparent-minor rejection | P05-T03 | 1 |
| P05-T10 | Regional gating (OQ-06 list via flag payload) + kill-switch flag; rollout wiring | P05-T07 | 1 |
| P05-T11 | Observability + analytics; UI-copy honesty audit (no "twin"/"exact" strings — automated lexicon check in CI over copy files) | P05-T05 | 1 |
| P05-T12 | SPK-1 evaluation run: pilot panel across skin-tone/lighting/face-shape slices; measure acceptance, extraction success, latency; write gate report | P05-T05, P05-T06 | 1–2 |

## 13. Parallelization

- Can run in parallel: **T01** (consent, `identity` + settings files) ∥ **T02** (native bridge, `apps/mobile` native dirs) ∥ **T07** (backend module files). Then **T03/T04** in parallel (capture UI vs mapping+assets — disjoint). Later: **T08** (backend cascade) ∥ **T09** (mobile misuse guards) ∥ **T11** (obs/copy audit).
- Must be serial: T02 → T03/T04 → T05 → T06/T12 (each consumes the previous surface); `packages/contracts` edits (T07 endpoint schemas, T05 event schema) are single-writer — sequence them; T12 (SPK-1) requires the full loop working.

## 14. Test-first plan (by module and level)

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| `identity` | Consent purpose gating logic | Consent history append-only invariant | Consent API vs OpenAPI | **Consent-before-processing test: face endpoint 403s and no bytes are processed/stored without an active consent record (REQ-FAC-030)** | Maestro: consent decline path leaves full app value |
| `avatar` | Landmarks→morph mapping math | Mapping bounded within head blend-shape ranges for arbitrary landmark inputs | Face-vector schema; `avatar.face.applied.v1` pinned | Rig-bump → `needs-recapture` state test | Golden renders: likeness presets across skin tones on avatar head |
| `media` | Lineage rows for face-derived assets | — | Deletion event schema | **Deletion-cascade test: withdrawal removes selfie refs, vectors, derived assets, CDN copies; orphan scan clean (REQ-FAC-050 / NFR-PRV-040)**; Testcontainers PG + R2-compatible store | — |
| Mobile | Quality-validation thresholds; misuse heuristics | — | Generated client compile | Capture flow RNTL with mocked bridge | Device tests (real iOS + Android): extraction success/latency on guided captures; low-quality images rejected with specific guidance (REQ-FAC-020); a11y pass on consent + capture + review |
| Security suite | — | — | — | `*.sec.test.ts`: face fields never in logs/analytics/crash payloads (forbidden-field lint, NFR-PRV-050); S3 access audited | Copy-lexicon check: no "digital twin"/"exact" claims (REQ-FAC-060) |

New bug fixes require a regression test that fails before the fix. Tests live in each module's `tests/` directory.

## 15. Budgets introduced or measured

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance | On-device landmark extraction + likeness application <3 s (doc 10 §2.6); guided capture loop (open → accepted result) p50 <60 s | Device-lane runs on doc 13 §7 matrix; client duration buckets |
| Cost | **$0 marginal AI** (on-device only); no new server cost beyond storage of small vectors | Cost dashboard delta (doc 14) |
| AI quality | SPK-1 gate: ≥70% of pilot users keep the derived face after review; landmark extraction succeeds on ≥90% of guided captures across skin-tone/lighting slices; no material quality gap across demographic slices | SPK-1 eval protocol (P05-T12), consented panel, sliced results in the gate report |
| Reliability | Deletion cascade completes with zero orphans in verification scan, ≤30 d worst case (target: hours); consent-gate violations = 0 (test-enforced) | Cascade job metrics + orphan scan; sec test suite |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): `face-personalization-enabled` (master kill switch + regional gating payload per OQ-06; owner BE; expiry P14 review — likely permanent as a compliance control, re-registered with justification per doc 14 §11). Flag **off by default**; turns on only after LR-05/LR-06 sign-off, per region.
- Migration/backward-compatibility plan: face vectors bound to rig version; a P04 topology/rig bump moves faces to `needs-recapture` with an honest explanation — never a silent degraded approximation (doc 07 §3.7). Clients without the feature simply never see A2 fields (additive API).
- Rollback plan: (1) flip `face-personalization-enabled` off globally or per region → new enrollment stops; existing A2 faces keep rendering (or, under a compliance order, run the face-scoped cascade for the affected region — a documented admin action, human-authorized); (2) DB rollback via `just db-rollback` (additive tables); (3) A2 is fully severable: the product retains full value on generic faces (REQ-FAC-010).

## 17. Risks, mitigations, assumptions, stop/kill criteria

- Risks in play: **RISK-07** (face/biometric compliance — the phase's dominant risk), **RISK-16** (capacity). Related: SPK-1 (doc 07 §11), OQ-06, LR-05/LR-06.
- **Stop/kill criteria for this phase:**
  - **SPK-1 kill:** acceptance <50% after two tuning rounds, **or** a material quality gap across demographic slices that tuning does not close → ship generic face + appearance customization only; the server path (doc 07 §5.2) stays a separate future gate; log DEC.
  - **Legal kill/gate:** counsel flags unresolvable exposure in a region (RISK-07) → geo-gate or disable A2 there via the flag; A2 remains beta and fully severable.
  - **Hard stop:** any discovered path where face bytes leave the device, or processing occurs before consent → stop the rollout immediately, treat as an incident (doc 14 §9 outline), fix + regression test before re-enabling.

## 18. Demo script

1. Fresh account (P03/P04 complete, generic face). Show Avatar studio: "Personalize" affordance is dismissible; dismiss it; complete a recommendation-free browse to prove nothing blocks on the selfie (AC-1).
2. Enter the flow: show the consent screen naming on-device processing, retention schedule, and deletion; decline → generic face retained, no nag (AC-3, AC-1).
3. Re-enter and consent (grant recorded server-side; show the consent record + policy version via admin/audit view) (AC-3).
4. Attempt capture in a dark room → specific "too dark" guidance; retake in good light → landmarks extracted on-device (<3 s, airplane mode ON to prove no network) (AC-2, AC-4).
5. Review the stylized likeness with its confidence indicator; read the copy aloud — "resembles you", never "exact"/"twin" (AC-6).
6. Force a low-confidence result (extreme angle) → multi-angle fallback offered; complete with one extra angle; confidence indicator updates (AC-7).
7. Import a gallery photo with two faces → rejected with reason; import a clearly different person → attestation/confirmation prompt (AC-8).
8. Settings → Privacy → delete face data: avatar reverts to generic face; run the cascade verification (admin view + orphan scan output) showing selfie refs, vectors, and derived assets gone (AC-5).
9. Show the regional-gating flag denying the feature for a configured region account (AC-10).
10. Present the SPK-1 gate report with sliced metrics (AC-11).

## 19. Acceptance criteria

- AC-1: Skipping or declining the selfie yields a fully functional app; automated E2E proves no journey blocks on a selfie prompt; the generic face is presented as a first-class equal option (copy review).
- AC-2: Low-quality test images (blur/dark/multi-face/angle fixtures) are rejected with actionable, specific guidance; retake, crop, and review are demonstrated on device.
- AC-3: Integration test proves no face bytes are processed and no face data stored before an active `face_processing` consent record exists; consent is per-purpose, versioned, revocable, append-only.
- AC-4: The default A2 path performs landmark extraction on-device (demonstrated in airplane mode); the server path exists only as documentation (doc 07 §5.2) with its own consent gate described; code search shows no selfie upload path.
- AC-5: Deleting face data (withdrawal) and account deletion each remove originals, landmark vectors, and all face-derived assets including CDN copies — verified by the deletion-cascade test and the orphan scan; retention/destruction schedule matches the consent-screen copy.
- AC-6: Automated copy-lexicon check finds no "digital twin"/"exact likeness" claims; every A2 result shows a confidence/quality indicator; A3 documented as a non-goal.
- AC-7: Low-confidence results trigger the fallback flow; the user can complete with the generic face or multi-angle capture; partial angle subsets are accepted.
- AC-8: Misuse safeguards are implemented and threat-model-documented: capture-first default, single-face/frontal import heuristics, self-attestation, different-person confirmation, apparent-minor rejection; each has a test.
- AC-9: Security suite proves face data never appears in logs, analytics events, or crash reports; every face-data access produces an audit row.
- AC-10: Regional gating works: a flagged region receives no A2 entry points; the gate list is config, not code.
- AC-11: SPK-1 report exists with measured acceptance, extraction success, and latency, sliced by skin tone/lighting/face shape — real measurements, never fabricated; the ship/kill decision is logged as a DEC.

## 20. Definition of done

```bash
just test avatar && just test media && just test identity   # all pass, no skips
just lint && just typecheck
just arch-check
just generate --check
just db-migrate && just db-rollback && just db-migrate      # Neon branch, up/down/up
just security-scan
just ci-parity
# phase-specific: device runs (iOS + Android) for extraction latency/success;
# deletion-cascade + consent-gate integration tests green; copy-lexicon check green;
# SPK-1 eval report produced
```

Evidence to attach/link: airplane-mode demo video, deletion-cascade test output + orphan-scan result, consent-gate test output, SPK-1 sliced metrics report, LR-05/LR-06 sign-off reference (or the explicit `BLOCKED` state if pending), audit-log samples (ids only). Never fabricated.

## 21. Documentation and PROGRESS.md updates

- Docs to update: `docs/modules/{avatar,media,identity,platform,admin}.md`; doc 11 §7.2 consent copy finalized post-counsel; doc 16: SPK-1 outcome DEC, OQ-06 resolution DEC; doc 14 runbook "face-data deletion cascade stuck"; doc 07 §5 marked "as-built" where behavior settled.
- [PROGRESS.md](../PROGRESS.md): set status per its rules; use `BLOCKED` (naming LR-05/LR-06/OQ-06) if engineering is done but legal gates remain; `DONE` only with §20 evidence.

## 22. Handoff note

On P05 `ACCEPTED` (or `BLOCKED` on legal with engineering complete): next session starts **P06-T01** if P06 has not already begun in parallel (P06 depends only on P03 — SPINE §5), else continues the P06/P07 track at the task recorded in PROGRESS.md. First command: `just doctor`, then read `phases/P06-closet-capture-pipeline.md`.
