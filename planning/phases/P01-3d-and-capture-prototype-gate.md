# P01 — 3D and Capture Prototype Gate

> File name: `phases/P01-3d-and-capture-prototype-gate.md` per [SPINE §5](../SPINE.md). Every section below is REQUIRED (brief §10); "None" is written explicitly rather than deleting a section. Status values per [PROGRESS.md](../PROGRESS.md).

> **Re-scoped 2026-09-22 ([ADR-0004](../../docs/adr/0004-native-ios-and-android-clients.md), DEC-49/DEC-50).** React Native and Expo are gone, so the RN + `react-native-filament` go/no-go gate is **moot**. RISK-01 and ASM-01 are retired. What survives:
> 1. The **Anny asset pipeline** (P01-T02/T03). It is renderer-agnostic and can run now.
> 2. The **measurement harness** design and gate-report collation (P01-T07), rebuilt on native profiling hooks.
> 3. The **gate thresholds** G1–G6.
>
> The 3D vertical prototype becomes a **native Filament spike**, run when 3D resumes: Filament's C++ engine with Metal on iOS and the official AARs on Android, with the capture leg included. No 3D is in the apps today. Text below that names Expo, RN or EAS is kept only where marked *historical*; the tasks and gates are restated for the native spike.

## 1. Overview

- **Phase:** P01 — 3D and Capture Prototype Gate
- **Status:** `NOT_STARTED` *(mirror of PROGRESS.md; PROGRESS.md wins on conflict)*
- **Goal (one sentence):** Build a vertical **native Filament** prototype on both platforms (Metal on iOS, the Android AARs), with a morphing Anny-derived avatar, 3–4 poses, rotate/zoom and camera→local-storage batch capture, and measure it on real iOS and Android hardware to produce a formal **go/no-go decision** for the 3D surface. *(Originally: an RN + `react-native-filament` prototype; superseded 2026-09-22.)*
- **User-visible outcome:** None shipped to users. Internally: a demo APK/TestFlight build any stakeholder can hold — a morphing 3D avatar responding to touch on a mid-tier phone — plus the measured evidence that the product's riskiest bet holds (or the decision to pivot before any product code depends on it).
- **Why now:** *(2026-09-22)* The mobile stack is no longer under test (DEC-49), and RISK-01 is retired. The phase still de-risks RISK-06 (Anny assets), RISK-09 (low-end Android) and RB-5 before P04 depends on a renderer. The asset pipeline can run now; the device spike runs when 3D resumes. *Historical: RISK-01, `react-native-filament` maturity, was the #1 ranked risk.* The brief (§4 intro) and [05 §2.3](../05-technology-decisions.md) mandate a real-device prototype gate before product code. Runs after P00 (ratified gate criteria); may run in parallel with P02.

## 2. Requirements delivered

IDs from [01-requirements-and-traceability.md](../01-requirements-and-traceability.md) only. P01 is the first listed (primary) phase for each; P04/P14 re-deliver at production quality.

| ID | Requirement (short) | Acceptance criterion ref (§19) |
|---|---|---|
| REQ-AVA-090 | 3–4 standardized poses + 360° rotation/zoom (prototype proof; measured in the gate) | AC-2, AC-3 |
| REQ-AVA-100 | Camera controls, PBR materials, texture compression within GPU/memory/battery/thermal budgets (prototype scope) | AC-1…AC-5 |
| REQ-MED-100 | Canonical 3D formats ratified only after renderer comparison; prototype loads ratified formats on both platforms | AC-6 |
| NFR-PERF-020 | 3D budgets measured per device tier with low-end fallback decision | AC-5, AC-8 |
| NFR-PERF-070 | Prototype gate measures fps/memory/startup/package size on real hardware → explicit go/no-go | AC-7 |
| NFR-TST-070 | Real-device performance tests on representative tiers (first execution; device matrix input) | AC-5 |

Contributing (primary delivery elsewhere): REQ-AVA-010 (Anny base renders — "proto P01", production P04); REQ-AVA-080/asset-manifest conventions (doc 07 §9, ratified P02); OQ-08 (device floor — P01 produces the data, P14 ratifies).

## 3. Prerequisites and blocking dependencies

- Hard depends on (must be `ACCEPTED`): **P00** (ratified gate thresholds and ADR set; per [SPINE §5](../SPINE.md)). P02 is **not** required — P01 may run in parallel with it and its prototype code never merges into the product monorepo (§4).
- External blockers:
  - **Physical devices in hand:** iPhone 13-class, Galaxy A52-class, plus one low-tier Android ([00 §9.1 RB-5](../00-product-vision-and-scope.md); [13 §7](../13-testing-quality-and-performance.md) tiers). No emulator numbers are acceptable evidence (brief §13; [05 §2.3](../05-technology-decisions.md)).
  - **Apple Developer Program + Play Console accounts**, the team's Mac, and the GitHub Actions macOS lane (G7 requires TestFlight + Play internal-track delivery; the signing lanes are OQ-18). *(EAS is no longer used, DEC-51.)*
  - RISK-06 / RISK-09 are the risks under test, not blockers. RISK-01 is retired.

## 4. In scope / out of scope

**In scope:**
- Standalone native spike apps (SwiftUI + Filament C++/Metal, and Compose + the Filament Android AARs) in `prototype/p01-filament/`: **spike code, explicitly disposable**. The findings and the asset tooling survive; the code is not promoted wholesale. *(Historical: one Expo SDK 55+ prebuild app.)*
- Anny → glTF asset spike: Anny base mesh exported via Blender-headless → gltfpack/glTF-Transform → `.glb` with Draco/meshopt + KTX2, ≥4 morph targets, skeleton + 3–4 pose animation clips (conventions per [07 §9](../07-3d-avatar-and-garment-pipeline.md): meters, Y-up, sRGB/linear split) — validates ASM-02/RISK-06 (A6 in [05 §8](../05-technology-decisions.md)).
- Filament scene: load the GLB, animate ≥4 blend shapes, switch 3–4 poses, orbit camera (360° h / 90° v) + pinch zoom (2–8×), PBR + IBL lighting.
- Capture leg: camera/gallery **batch** import → local file store → SQLite index → survives app restart, fully offline (gate G4).
- Measurement harness: on-device fps/frame-time capture, RSS + GPU memory sampling, cold-start timer, touch-to-response latency measurement, package-size report; raw traces archived (no hand-summarized numbers — [13 §1 rule 5](../13-testing-quality-and-performance.md)).
- G1–G7 gate execution on the device matrix; battery/thermal 10-minute session observation (baseline for [13 §12.1](../13-testing-quality-and-performance.md)).
- Go/no-go report + DEC entry; OQ-08 device-floor data; pivot execution decision if red (§17).

**Out of scope / non-goals for this phase:**
- Any product/monorepo code, module structure, CI wiring → P02. *(The EAS learnings for ADR-P02 are moot: ADR-0002 is superseded.)*
- Measurement→morph mapping from real user data, calibration UX, inclusive base-set completeness → P04 (REQ-AVA-010/020/030 production delivery).
- Upload to any server, media pipeline, background removal → P06 (P01 capture is local-only by design).
- Selfie/face anything → P05. Garment rendering on the avatar → P10/P11.
- Performance *optimization* beyond what the gate needs — the gate measures honest defaults plus documented asset-diet passes (A2 failure path), not a tuning marathon.

## 5. Product/UX behavior

Prototype-grade UX: internal users only, but the gate itself exercises real states. Accessibility work is **observational** in P01 (informing [02 §13.3](../02-user-journeys-and-information-architecture.md) non-3D-alternative design), not a deliverable.

| Flow / screen | Happy path | Empty | Failure & retry | Offline | Accessibility notes |
|---|---|---|---|---|---|
| Avatar viewer | GLB loads < first-render budget; morph sliders animate; pose buttons switch without hitch; orbit/zoom < 50 ms response | No asset downloaded → bundled fallback asset always present (prototype ships assets in-package) | Load/driver failure → error screen with retry + device-info dump captured for the report (feeds REQ-AVA-100 fallback design) | Fully offline (assets bundled) | Note gesture-only controls as a **defect to fix in P04** (button equivalents required per [02 §13.2](../02-user-journeys-and-information-architecture.md)); record reduced-motion behavior observations |
| Batch capture | Camera/gallery multi-select → thumbnails in grid < 1 s/item; SQLite rows persist | Empty grid shows count=0 state | Denied camera permission → gallery path still works; import failure → per-item error, retry re-imports idempotently (content-hash key) | **Required**: entire loop works in airplane mode (gate G4) | Volume-shutter and label observations recorded for P06 design |
| Measurement overlay | fps/memory HUD toggleable; export writes JSON trace to shareable file | n/a | Sampler failure aborts the run loudly (a silent gap would fabricate evidence) | Works offline | Internal tool — none |
| Kill/restart recovery | Relaunch after force-kill → captured items and index intact (G4) | n/a | Corrupt index → rebuild from files, report it | Offline | n/a |

## 6. Domain and architecture changes (by owning module)

No product modules exist in P01 (module skeletons are P02). The architectural output is **evidence and ratified conventions**, mapped to the modules that will own them:

| Module | Change | Contract update needed? |
|---|---|---|
| `avatar` (future) | Validated: Anny GLB + morphs + poses render in Filament within budgets; renderer-boundary shape ([07 §4.3](../07-3d-avatar-and-garment-pipeline.md)) confirmed feasible | Findings feed the P02 module-contract stub + P04 |
| `media` (future) | Validated: 3D delivery formats (glTF 2.0/.glb, KTX2, Draco/meshopt) load on both platforms → REQ-MED-100 ratification input | Format conventions table in [07 §9](../07-3d-avatar-and-garment-pipeline.md) confirmed/corrected |
| `platform` (future) | ~~EAS build behavior with prebuild + native Filament module measured (feeds ADR-P02 / A3–A5)~~ moot (DEC-51). Instead: the Filament library size and build impact on the Xcode and Gradle builds is measured | No |

## 7. Public interfaces, contracts, schemas, migrations, events

- API endpoints added/changed (OpenAPI in `packages/contracts`): None (no server contact in P01).
- Event schemas added/changed: None.
- DB migrations (Drizzle): None (prototype uses local SQLite ad hoc; schema is disposable).
- Generated clients to regenerate: None.
- **Ratified by this phase:** the 3D asset conventions of [07 §9](../07-3d-avatar-and-garment-pipeline.md) (coordinate system, units, morph-target naming, texture color space, compression toolchain) are confirmed against a real renderer on both platforms — the REQ-MED-100 precondition for P02's `assets/3d` manifest schema.

## 8. Work breakdown by surface

| Surface | Work (or "None") |
|---|---|
| Mobile | Native spike apps (iOS: SwiftUI + Filament/Metal; Android: Compose + Filament AARs); Filament scene (load/morph/pose/orbit/zoom); capture grid; SQLite index; measurement HUD + trace export |
| Backend | None |
| Workers (ML/media) | None |
| Data / migrations | Local SQLite only (disposable) |
| Infrastructure | GitHub Actions macOS + Gradle builds (no EAS); Apple/Play app records for internal distribution; Git LFS for prototype assets ([05 §3.4](../05-technology-decisions.md)) |
| 3D / assets | Anny→GLB export pipeline (Blender-headless script + gltfpack + glTF-Transform, checked into `prototype/p01-filament/tools/` — this tooling **is** promoted to P04); ≥1 avatar asset at 2 LODs; pose clips |
| Admin / internal tools | Measurement-trace collation script → gate-report tables |

## 9. AI vs deterministic decisions

| Capability | AI or deterministic | Why | Fallback | Budget |
|---|---|---|---|---|
| Everything in P01 | **Deterministic** (geometry, rendering, file I/O) | Rendering, morphing, and capture indexing are exactly the problems [10 §1](../10-ai-usage-cost-and-evaluation.md) classifies "deterministic instead"; no model call is needed or permitted here | n/a | $0 AI spend — any provider call in P01 is a defect |

## 10. Security, privacy, consent, and data lifecycle

- New sensitive data introduced + classification (per [11](../11-security-privacy-and-compliance.md)): **none from users** — RB-5 explicitly needs no user data. Prototype photos are team-owned test garments/objects only; no faces, no personal data in the capture set (13 §1 rule 6 fixture rule applies to prototype media too).
- Consent required / consent UI changes: None (internal builds, team devices).
- Retention, deletion, and export impact: prototype app + its local data are deleted from all devices at phase end; TestFlight/internal-track builds expire naturally. The `prototype/` directory is retained read-only as evidence.
- Threat/abuse cases added to the threat model: none new (no attack surface shipped). Note recorded for doc 11: signing credentials created for G7 are CI-lane secrets from day one ([15 §6](../15-team-workflow-and-ai-agent-operations.md)) — no certs on workstations.

## 11. Observability and analytics added in this phase

- Logs/metrics/traces for what this phase introduces: no operated service, so no production observability (NFR-OBS-090 satisfied by the nature of the phase). The phase's observability **is** the measurement harness: archived raw traces (fps/frame-time series, memory samples, startup timings, touch-latency logs) per device per run, stored with the gate report — these become the baseline artifacts [13 §12.1](../13-testing-quality-and-performance.md) compares against forever.
- Product analytics events (taxonomy per [14](../14-observability-operations-and-analytics.md)): None.
- Alerts/dashboards/runbook entries: None.

## 12. Ordered tasks

Small enough for one AI-assisted session each (~half-day). Task IDs `P01-T##` are referenced by handoff entries.

| ID | Task | Depends on | Est. sessions |
|---|---|---|---|
| P01-T01 | Workspace bring-up: `prototype/p01-filament/` native spike apps (Xcode project + Gradle project) linking Filament's C++ engine (Metal / official AARs; record exact Filament pins); runs on both dev devices. **Deferred until 3D resumes.** *(Superseded: Expo SDK 55+ prebuild app with `react-native-filament`.)* | — | 1–2 |
| P01-T02 | **(Can run now; renderer-agnostic.)** Anny asset spike: Blender-headless export of one Anny base → `.glb` with ≥4 morph targets + skeleton; gltfpack (Draco/meshopt) + glTF-Transform (KTX2, morph pruning); document mesh stats + conventions vs [07 §9](../07-3d-avatar-and-garment-pipeline.md) | — | 2 |
| P01-T03 | Pose clips: author/adapt 3–4 pose animations (neutral, walking/casual, seated-or-occasion, fit-reveal per [07 §4.1](../07-3d-avatar-and-garment-pipeline.md)) into the GLB; verify topology stable across morph extremes (A6) | P01-T02 | 1 |
| P01-T04 | Filament scene (per platform, native): load GLB, IBL + PBR setup, morph-weight animation loop (≥4 blend shapes), pose switching | P01-T01, P01-T02 | 2–3 |
| P01-T05 | Interaction: orbit camera 360°/90°, pinch zoom 2–8×, with touch-timestamp instrumentation for the <50 ms G2 measurement | P01-T04 | 1 |
| P01-T06 | Capture leg: camera + gallery batch import → file store + SQLite index; offline + kill/restart survival (G4) | P01-T01 | 2 |
| P01-T07 | Measurement harness: fps/frame-time capture, RSS/GPU memory sampling, cold-start timer, JSON trace export + collation script. Native hooks: `os_signpost`/MetricKit on iOS, FrameMetrics/Perfetto on Android. The trace format and collation script can be built now; device capture needs P01-T04 | P01-T04 (device capture) | 1–2 |
| P01-T08 | Delivery lane (G7): TestFlight (GitHub Actions macOS or the team's Mac) + Play internal track from the same commit; record build times/cost/flakes (A5 evidence). Reuses the P02-T14 signing lanes (OQ-18). *(Superseded: EAS build profiles for ADR-P02.)* | P01-T04, P01-T06 | 1–2 |
| P01-T09 | Gate runs: execute G1–G6 on iPhone 13-class + Galaxy A52-class + low-tier Android; 10-min battery/thermal session; archive raw traces | P01-T03, P01-T05, P01-T06, P01-T07, P01-T08 | 2 |
| P01-T10 | Asset-diet pass **only if** G5/G6 red (A2 path): LOD/KTX2/Draco tuning + app thinning / R8 size reports (*historical: Expo Atlas tree-shaking*); re-run affected gates; both runs kept in the report | P01-T09 | 1 |
| P01-T11 | Gate report + decision: G1–G7 table with measurements vs thresholds; explicit **go / no-go(+pivot rung)**; DEC entry; OQ-08 device-floor data; update docs 16/07/13; PROGRESS.md + handoff | P01-T09 (T10 if run) | 1 |

## 13. Parallelization

- Can run in parallel: **Group A** {P01-T01} ∥ **Group B** {P01-T02→T03} — app scaffold and asset pipeline are disjoint (different directories, different toolchains). After T01+T02: **Group C** {P01-T04→T05} ∥ **Group D** {P01-T06} — renderer code vs capture code are disjoint files. P01-T07 and P01-T08 are disjoint from each other (harness code vs build config) once T04/T06 exist.
- Must be serial: T09 needs everything green; T10 strictly after T09 (it exists only on a red G5/G6); T11 last. Physical-device time in T09 is inherently serial per device — schedule both devs' devices concurrently.
- One git worktree per agent; `prototype/p01-filament/` package.json/lockfile is single-writer (sequence dependency changes) per [15 §12.3](../15-team-workflow-and-ai-agent-operations.md).

## 14. Test-first plan (by module and level)

Prototype code gets prototype-grade tests: enough to trust the measurements, no more. The gate itself is the test.

| Module | Unit | Property | Contract | Integration | E2E / device / visual |
|---|---|---|---|---|---|
| Asset pipeline (`tools/`) | Export script: morph-target names/count, node scale/orientation assertions on output GLB | Morph weights ∈ [0,1] never produce NaN/degenerate vertices (sampled param sweep) | Output validates with official glTF validator + KTX2 checks (pre-figuring `just assets-validate`) | Full pipeline run on Anny source in CI-less script, exit non-zero on any check | Visual spot-check renders archived |
| Viewer app | Morph/pose state logic (pure Swift / Kotlin) | None | None | None (Filament rendering is validated on-device, not mocked) | **G1–G3, G5–G6 device runs are the test**; traces archived |
| Capture leg | SQLite index ops; content-hash idempotency | Re-import of identical bytes is a no-op (hash property) | None | Restart-survival script (kill → relaunch → assert rows/files) | **G4 device run offline** |
| Measurement harness | Trace-format serialization | None | None | Harness self-test: known synthetic frame loop reports expected fps ±1 | n/a |

New bug fixes require a regression test that fails before the fix. Tests live in `prototype/p01-filament/tests/` (module-`tests/` rule applies even to spike code).

## 15. Budgets introduced or measured

**This phase converts hypotheses into measurements** — the first real numbers in the project ([13 §12.1](../13-testing-quality-and-performance.md) rows marked P01). Gate thresholds ratified in P00 from [05 §2.3](../05-technology-decisions.md):

| Budget | Target (hypothesis until measured) | How measured |
|---|---|---|
| Performance — G1 morphing avatar fps | **≥60 fps iPhone 13-class; ≥50 fps Galaxy A52-class** (≥4 blend shapes animating) | Harness frame-time capture, 60 s sustained, raw trace archived |
| Performance — G2 touch latency | **< 50 ms** touch-to-response (rotate/zoom) | Touch-timestamp → frame-commit instrumentation |
| Performance — G3 pose switch | No visible hitch; frame-time budget held during switch | Frame-time trace across 20 consecutive switches |
| Performance — 3D first render | ≤ 4 s mid-tier (hypothesis, [13 §12.1](../13-testing-quality-and-performance.md)) | Cold-start timer to first rendered frame |
| Performance — G5 package size | **< 100 MB** IPA and APK/AAB | Artifact sizes from the G7 builds (App Store Connect / Play size reports) |
| Performance — G6 memory | **< 300 MB** RSS including 3D engine + assets | RSS sampling during G1 run |
| Performance — battery/thermal | ≤ ~3% drain / 10-min session; no sustained throttle (hypotheses, [07 §10.1](../07-3d-avatar-and-garment-pipeline.md)) | OS battery stats + thermal-state log across the 10-min session |
| Cost | Prototype spend ≤ existing dev accounts + GHA macOS minutes within the iOS lane envelope ($30–50/mo from P02) | GHA billing page, screenshots archived |
| AI quality | n/a — no AI in P01 | n/a |
| Reliability | G4: 0 data loss across 10 kill/restart cycles with ≥20 captured items | Scripted restart-survival runs |

## 16. Rollout, flags, migration, compatibility, rollback

- Feature flags (owner + expiry date): None (nothing ships to users).
- Migration/backward-compatibility plan: None. Prototype code is quarantined in `prototype/`; nothing in `apps/` may import it (P02 arch-check adds an explicit forbidden-edge rule).
- Rollback plan: none needed for users. If the gate is red, the "rollback" is the **pivot ladder** (§17) — an ADR + DEC entry, then re-planning of P04/P10 scope; the prototype directory and report are retained as the evidence trail either way.

## 17. Risks, mitigations, assumptions, stop/kill criteria

Link RISK-NN/ASM-NN in [16](../16-risks-open-questions-and-decision-log.md); phase-local ones are added there, not here.

- Risks in play: ~~**RISK-01** (`react-native-filament` maturity)~~ retired 2026-09-22; **RISK-06** (Anny production-asset readiness — A6 spike), **RISK-09** (low-end Android — first low-tier data), **RISK-12** (iOS delivery lane — G7 exercises it, feeds ADR-P02). Assumptions under test: **ASM-02** (partial), **A1 (native Filament restatement), A2, A6** ([05 §8](../05-technology-decisions.md)); ASM-01 and A3/A4 are retired or moot. This phase *is* **RB-5**.
- **Stop/kill criteria for this phase (the formal go/no-go gate):**
  - **GO:** all of G1–G7 pass on the mid-tier pair (low-tier informs OQ-08/fallback design but does not block GO — [07 §10.2](../07-3d-avatar-and-garment-pipeline.md) makes low-tier non-3D-by-default acceptable). → DEC entry; P04 unblocked.
  - **NO-GO:** any of G1–G3 fail after one honest tuning iteration, or G5/G6 fail structurally after the T10 asset diet, or a blocking Filament defect has no upstream fix path. → ADR + DEC entry, then re-plan P04/P10. Options, in order: an asset diet / LOD per device tier; a non-3D (A0/G0) experience below a documented device floor (RISK-09); a different renderer for the failing platform. RealityKit is excluded for the avatar path by DEC-50 unless the asset-format constraint changes.
  - *Historical pivot ladder (RN era, moot since 2026-09-22):* (1) JSI-bridged native Filament; (2) a platform-native 3D view embedded in RN; (3) fully native Swift/Kotlin, the rung DEC-49 took for other reasons; (4) Flutter only if flutter_filament stabilised.
  - **Time-box:** if the gate cannot produce a decision within the phase budget (measurement blocked > 1 week by tooling), escalate to **[PO]** rather than shipping partial numbers — no fabricated or emulator evidence, ever (brief §13).

## 18. Demo script

Exact steps proving the vertical slice end-to-end on real devices:

1. Install the TestFlight build on the iPhone 13-class device and the Play-internal build on the Galaxy A52-class device (both native spike apps, from the same commit — G7).
2. Enable airplane mode on both devices.
3. Launch: avatar renders (timer visible in HUD); read out first-render ms.
4. Drag morph sliders: ≥4 blend shapes animate; HUD shows sustained fps (≥60 / ≥50).
5. Rotate 360° and pinch-zoom 2–8×; HUD shows touch-latency < 50 ms.
6. Switch through all poses twice; no visible hitch; frame-time HUD stays in budget.
7. Batch-import 10 photos from the gallery; grid populates; force-kill the app; relaunch — all 10 items present (still offline).
8. Show the measurement export: JSON traces for this session; open the collated gate report showing G1–G7 vs thresholds for all three devices.
9. Show `PROGRESS.md` + doc 16: the DEC entry recording GO (or the pivot ADR if NO-GO).

## 19. Acceptance criteria

Objectively verifiable statements — no "works well". Every number from a real, named device with an archived raw trace.

- AC-1: G1 — with ≥4 blend shapes animating continuously for 60 s, measured fps ≥ 60 on the iPhone 13-class device and ≥ 50 on the Galaxy A52-class device; raw frame-time traces archived and linked from the gate report.
- AC-2: G2 — p95 touch-to-response latency < 50 ms for rotate and zoom on both mid-tier devices (instrumented, not eyeballed).
- AC-3: G3 — 20 consecutive pose switches among ≥3 poses with zero frame-time spikes beyond the per-tier frame budget in the trace.
- AC-4: G4 — with airplane mode on: batch-import ≥10 items, force-kill, relaunch → all items and index intact; 10 scripted kill/restart cycles show 0 data loss.
- AC-5: G5/G6 — IPA and APK/AAB artifact sizes < 100 MB each (App Store Connect / Play size report screenshot); RSS < 300 MB sampled during the AC-1 run on both mid-tier devices; low-tier device measured and recorded (pass or documented fallback trigger per [07 §10.2](../07-3d-avatar-and-garment-pipeline.md)).
- AC-6: the rendered asset is a glTF 2.0 `.glb` with KTX2 textures and Draco-or-meshopt geometry, passing the glTF validator, loaded successfully on **both** platforms — REQ-MED-100's renderer-comparison precondition recorded in [doc 07 §9](../07-3d-avatar-and-garment-pipeline.md).
- AC-7: the gate report exists with all G1–G7 rows (measured value, threshold, device, date, trace link) and an explicit **GO / NO-GO(+pivot rung)** decision recorded as a DEC entry in [doc 16](../16-risks-open-questions-and-decision-log.md); NFR-PERF-070 satisfied.
- AC-8: 10-minute continuous 3D session on both mid-tier devices: battery drain and thermal-state log recorded (baseline values, compared against the [07 §10.1](../07-3d-avatar-and-garment-pipeline.md) hypotheses); OQ-08 device-floor data appended to doc 16.
- AC-9: G7 — both store builds (TestFlight + Play internal) came from the same commit; the two native Filament integrations load the **same** GLB/manifest with no per-platform asset forks (diff-audit note in the report); lane cost/flake data recorded (A5). *(Superseded wording: "zero platform-specific workarounds … EAS cost/flake data for ADR-P02".)*

## 20. Definition of done

Exact commands and evidence required. The monorepo `just` catalog does not exist until P02; P01 uses prototype-local equivalents (this exception ends with P01):

```bash
cd prototype/p01-filament
# native spike tests (all pass, no skips): swift test / xcodebuild test for ios/, ./gradlew test for android/
# (RN-era `pnpm test / lint / typecheck` superseded 2026-09-22)
node tools/validate-asset.mjs assets/avatar.glb   # glTF validator + KTX2/Draco checks green (or `just assets-validate`)
node tools/collate-gate-report.mjs traces/        # emits gate-report.md from raw traces only
# device evidence: raw trace files in traces/<device>/<date>/ committed via LFS
```

Evidence to attach/link: gate report with per-device measurement tables; raw trace files; build artifacts + size screenshots; TestFlight/Play-internal build IDs; the DEC entry. Never fabricated, never emulator-sourced.

## 21. Documentation and PROGRESS.md updates

- Docs to update: [doc 16](../16-risks-open-questions-and-decision-log.md) (DEC go/no-go, RISK-01/-06/-09 status, OQ-08 data); [doc 07 §9–§10](../07-3d-avatar-and-garment-pipeline.md) (conventions confirmed/corrected, measured budget baselines); [doc 13 §12.1](../13-testing-quality-and-performance.md) (P01-marked rows get measured values, labels flipped from hypothesis); [doc 05](../05-technology-decisions.md) (A1/A2/A5/A6 assumption outcomes). *(The ADR-P02 EAS note is moot.)*
- [PROGRESS.md](../PROGRESS.md): set status per its rules; `DONE` only with §20 evidence; the go/no-go outcome goes in the Notes column explicitly.

## 22. Handoff note

Written at phase end; interim handoffs go to the PROGRESS.md log via [session-handoff.md](../templates/session-handoff.md).

Next session starts: **on GO** → P04 planning is unblocked but P04 also requires P03 (`ACCEPTED`); if P02 is still in flight, join it (its next open task per PROGRESS.md) — first command: `just doctor` in the monorepo. Hand the asset-pipeline tooling (`prototype/p01-filament/tools/`) to P02-T13 (assets-validate recipe) and P04. **On NO-GO** → next session executes the chosen pivot rung: write the pivot ADR, update SPINE via a superseding DEC entry, and re-estimate P04/P10 before any further product work.
