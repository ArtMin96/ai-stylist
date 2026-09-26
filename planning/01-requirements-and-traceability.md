# 01 — Requirements and Traceability

**Status:** Ratified for planning · **Date:** 2026-08-24 · **Amended:** 2026-09-13 ([r7](research/r7-third-party-services-and-self-hosting-audit-2026-09-13.md), ADR-0003 — REQ-CTX-050 holiday provider; asset-delivery wording)
**Owns:** the requirement ID registry (SPINE §7). Every phase file and planning doc references IDs defined here; only IDs defined in this file may be referenced anywhere in `planning/`.

---

## 1. How to read this file

- **ID scheme** (per [SPINE.md](SPINE.md) §7): `REQ-<AREA>-NNN` for functional requirements, `NFR-<AREA>-NNN` for non-functional. IDs are numbered in steps of 10 so later inserts (e.g. `REQ-REC-085`) never force renumbering. IDs are **stable forever**: a dropped requirement is marked *Withdrawn*, never deleted or reused.
- **Areas (functional):** ONB onboarding/profile · AVA avatar · FAC face/selfie · CAP capture · ORG closet organization · MED media pipeline · CTX context providers · REC recommendation · EXP explanation/feedback · TRD fashion intelligence · CHT future chat · BIL billing/pricing · NOT notifications.
- **Areas (non-functional):** SEC security · PRV privacy/compliance · PERF performance/reliability · OBS observability · TST testing/quality · TEAM team/workflow · AIC AI usage/cost.
- **Columns:** *Requirement* is one sentence, normative ("must"). *Acceptance criterion* is objectively verifiable — a test, demo, artifact, or measurable check. *Module* uses SPINE §3 canonical names. *Phase(s)* is where the requirement is delivered (SPINE §5, P00–P15); the first listed phase is the primary delivery. *Doc* is the owning planning document with the design detail.
- **Coverage proof:** §4 maps every section of the product brief (`AI-STYLIST-FABLE-PROMPT.md`) to requirement IDs; §5 enumerates the brief's explicitly named specifics one-by-one. Together they implement brief §13.1 and §14 (every brief requirement → at least one ID).
- Capability codes A0–A3 / G0–G4, tier names, and availability states used below are defined in SPINE §4, §6, §8.

---

## 2. Functional requirements

### 2.1 ONB — Onboarding & profile

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-ONB-010 | Onboarding must be progressive, collecting only what each step needs, with the app useful before any optional field is complete. | A new user reaches closet capture having entered only the required-field set; skipped fields are editable later from settings. | `profile` | P03 | 02 |
| REQ-ONB-020 | The profile must capture height and weight with metric and imperial units and lossless conversion. | Entering 5′10″ then switching units shows 177.8 cm; stored canonical value is unit-independent (shared-kernel units). | `profile` | P03 | 03 |
| REQ-ONB-030 | The profile must support body measurements that are genuinely useful for avatar adjustment, fit, and recommendations — no vanity fields. | Each measurement field maps to at least one consumer (avatar morph, fit rule, or rec constraint) documented in doc 03; unmapped fields are rejected in review. | `profile` | P03 | 03 |
| REQ-ONB-040 | The profile must support optional body-shape info, fit preferences, proportions, brand/region sizing, and accessibility/mobility considerations. | All listed fields exist, are optional, skippable, and editable after onboarding. | `profile` | P03 | 03 |
| REQ-ONB-050 | Gender/presentation settings must be inclusive and not unnecessarily coupled to body geometry. | Presentation choice and base-mesh choice are separate fields; any presentation can pair with any base mesh. | `profile` | P03 | 03 |
| REQ-ONB-060 | The profile must capture style preferences: silhouettes, colors, patterns, materials, brands, style identities, modesty preferences, comfort priorities, dress codes, disliked items, and hard exclusions. | Each preference type is stored in normalized form; hard exclusions are flagged distinctly from soft dislikes and are consumed by REQ-REC-040. | `profile` | P03 | 03 |
| REQ-ONB-070 | The profile must capture climate tolerance (runs hot/cold) as a recommendation input. | Climate tolerance shifts the engine's warmth thresholds in a unit test (see REQ-REC-130). | `profile` | P03 | 09 |
| REQ-ONB-080 | The profile must capture lifestyle and common occasions without requiring calendar access in the first release. | Occasion presets are selectable with no calendar permission requested anywhere in v1 builds. | `profile` | P03 | 02 |
| REQ-ONB-090 | Budget and shopping preferences must not be collected until a commerce feature needs them. | v1 onboarding and profile contain no budget/shopping fields; the deferral is recorded in doc 00 non-goals. | `profile` | P03 | 00 |
| REQ-ONB-100 | The app must store locale, language, units, timezone, region, and accessibility preferences. | All six settings exist, persist, and are respected by weather, holidays, formatting, and UI. | `profile` | P03 | 02 |
| REQ-ONB-110 | Required fields must be separated from optional fields, every optional field skippable and editable later, and sensitive-data requests explained inline. | UI marks required vs optional; each sensitive field shows a "why we ask" explanation; skipping any optional field never blocks progress. | `profile` | P03 | 02 |
| REQ-ONB-120 | Consent, correction, export, and deletion flows must be reachable from settings for all profile data. | Each flow is demoed end-to-end in P03 acceptance (consent record written, field corrected, export file produced, deletion cascaded per NFR-PRV-040). | `identity` | P03 | 11 |
| REQ-ONB-130 | Every user journey must define empty, loading, partial, failure, retry, and recovery states. | Doc 02 contains a state inventory per journey; E2E tests cover at least failure+retry per critical journey (see NFR-TST-050). | all UI | P03–P14 | 02 |

### 2.2 AVA — Parametric 3D avatar

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-AVA-010 | The app must start from predefined, production-quality, inclusive parametric base models (Anny base set) covering masculine, feminine, and additional presentation/body options — never one rigid male and one rigid female stereotype. | ≥3 base configurations ship, sharing conventions and morph targets; a reviewer can produce visibly distinct non-stereotyped bodies from each. | `avatar` | P04 (proto P01) | 07 |
| REQ-AVA-020 | The selected base model must be adjusted from validated user data via body-parameter mapping with realistic bounds. | Out-of-bounds inputs are clamped with user-visible notice; mapping table (measurement → shape param) is published in doc 07 and unit-tested. | `avatar` | P04 | 07 |
| REQ-AVA-030 | Height, proportions, circumference/measurement mapping, body-composition approximation, and fit must drive the morphs. | Golden-render tests show monotonic, plausible mesh response to each measurement change. | `avatar` | P04 | 07 |
| REQ-AVA-040 | The rig/skeleton must stay compatible and topology stable across all morphs. | Skinning tests pass at parameter extremes; vertex count/topology identical across morph range. | `avatar` | P04 | 07 |
| REQ-AVA-050 | Skin tone, hair, and optional appearance customization must be inclusive. | Skin-tone range covers an inclusive scale (e.g. Monk-scale coverage documented); hair/appearance options are optional and editable. | `avatar` | P04 | 07 |
| REQ-AVA-060 | A calibration/review screen must let the user correct the generated avatar. | User adjustments persist, override derived values, and survive reprocessing (lineage per REQ-MED-080). | `avatar` | P04 | 07 |
| REQ-AVA-070 | Incomplete, conflicting, implausible, or low-confidence measurements must be handled explicitly (defaults, prompts, confidence display) — never silently invented. | Property tests inject each case; app shows the assumption or asks, and the avatar renders with a defaults notice. | `avatar` | P04 | 07 |
| REQ-AVA-080 | Avatar assets must be versioned and migratable when rig or mesh changes. | Asset manifests carry rig/mesh version; a migration test upgrades a v1 avatar to v2 without losing user calibration. | `avatar` | P04 | 07 |
| REQ-AVA-090 | The avatar must support 3–4 standardized poses (neutral; walking/casual; seated/occasion-appropriate if feasible; a fit-revealing pose that does not distort garments) plus rotation and multiple viewing angles. | On-device demo switches among ≥3 poses and rotates/zooms 360°; measured in the P01 gate. | `avatar` | P01, P04 | 07 |
| REQ-AVA-100 | The 3D view must implement camera controls, lighting, PBR materials, LOD, texture compression, asset streaming, and low-end-device fallbacks within GPU/memory/battery/thermal budgets. | P01/P14 device runs meet NFR-PERF-020 budgets on the low-tier reference device or degrade to the documented fallback. | `avatar` | P01, P04, P14 | 07 |
| REQ-AVA-110 | An accessibility alternative must exist for users who cannot or do not want the 3D view. | Full onboarding→recommendation journey completes with 3D disabled, using 2D/G0 presentation with equivalent information. | `avatar` | P04, P10 | 02 |
| REQ-AVA-120 | The recommendation engine must not couple to the renderer; avatar, garments, outfit composition, and recommendation results need stable renderer-independent contracts. | dependency-cruiser CI rule forbids `recommendation` → `avatar`/renderer imports; contracts live in `packages/contracts` and are consumed by both sides. | `outfit`, `shared-kernel` | P02, P04 | 04 |

### 2.3 FAC — Optional selfie & personalized face

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-FAC-010 | Selfie-based face personalization must be strictly optional, with a privacy-preserving generic face as the default (A0/A1). | Skipping the selfie step yields a fully functional avatar; no selfie prompt blocks any journey. | `avatar` | P05 | 07 |
| REQ-FAC-020 | Selfie capture must provide camera, lighting, and pose guidance, image-quality validation, retake, crop, and review. | Low-quality test images are rejected with actionable guidance; retake/crop/review are demoed. | `media` | P05 | 07 |
| REQ-FAC-030 | Face processing and storage require explicit, separate consent before any processing occurs. | No face bytes leave the device or enter processing before the consent record exists; verified by an integration test. | `identity` | P05 | 11 |
| REQ-FAC-040 | Face processing must run on-device where practical (ARKit/MediaPipe landmarks → A2 stylized likeness), with the server-side path documented and separately consented. | The default A2 path performs landmark extraction on-device; the server path is documented in doc 07 with its own consent gate. | `avatar`, `media` | P05 | 07 |
| REQ-FAC-050 | Selfie assets require secure upload, short-lived signed URLs, retention limits, and full deletion including account deletion and derived model-asset cleanup. | Deleting the selfie or account removes originals and all face-derived assets; verified by a deletion-cascade test (with NFR-PRV-040). | `media` | P05 | 11 |
| REQ-FAC-060 | The product must present honest accuracy levels (A-ladder) with a confidence/quality indicator — never claiming an "exact digital twin" from one selfie. | UI copy audit finds no digital-twin claims; every A2 result shows a confidence/quality indicator; A3 is documented as a non-goal. | `avatar` | P05 | 07 |
| REQ-FAC-070 | When one selfie is insufficient, a fallback must exist, including optional guided multi-angle capture. | Insufficient-quality result triggers the fallback flow; user can complete with generic face or multi-angle capture. | `media` | P05 | 07 |
| REQ-FAC-080 | The system must protect against misuse: unauthorized face creation and processing images of another person. | Liveness/ownership safeguards and abuse cases are documented in the threat model and enforced (e.g. camera-capture-preferred, attestation of self, moderation path). | `identity`, `media` | P05, P14 | 11 |

### 2.4 CAP — Virtual closet capture

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-CAP-010 | Capture must support clothing, shoes, AND accessories: tops, bottoms, dresses/one-pieces, outerwear, underwear where appropriate, shoes, bags, belts, hats, jewelry, watches, scarves, eyewear, via an extensible taxonomy. | Each listed category can be captured, classified, and saved in the P06 demo; adding a new subcategory requires data change only, no code change. | `closet` | P06 | 08 |
| REQ-CAP-020 | A fast single-item capture loop and a batch-capture flow for many items must both exist. | Batch mode captures ≥10 items in one session with per-item confirmation deferred; camera-to-catalog time measured against NFR-PERF-010. | `closet`, `media` | P06 | 07 |
| REQ-CAP-030 | Front-only capture must be sufficient as the minimum input for a usable catalog item. | An item created from one front photo is classified, searchable, and recommendable. | `closet` | P06 | 07 |
| REQ-CAP-040 | Optional back, side, detail, label, and material photos must be supported per item. | All five optional view types can be added, viewed, and individually deleted. | `closet`, `media` | P06 | 07 |
| REQ-CAP-050 | The pipeline must perform background removal, perspective correction, color calibration, and image-quality checks. | Eval set shows segmentation quality ≥ threshold defined in doc 10; failed checks route to REQ-CAP-110. | `media` | P06 | 07 |
| REQ-CAP-060 | Category detection and attribute extraction must run automatically with explicit user confirmation before facts become canonical. | Unconfirmed AI attributes are marked provisional; confirmation writes the canonical record (REQ-ORG-100). | `closet` | P06 | 08 |
| REQ-CAP-070 | AI may synthesize ONLY views the user did not supply; a real captured view must never be replaced by a generated one. | Pipeline test: submitting a real back photo blocks back-view synthesis; generated views are stored as separate derived assets, never overwriting originals. | `media` | P11 | 07 |
| REQ-CAP-080 | Every generated view must carry a provenance marker and a confidence indicator, visible in UI and stored in metadata. | Metadata schema requires `provenance` + `confidence` on derived views; UI badge test verifies visibility. | `media` | P11 | 07 |
| REQ-CAP-090 | The user must be able to replace a generated view later with a real photo, which then supersedes the generated asset. | Uploading a real back photo demotes the generated back view (lineage `superseded`), and all consumers switch to the real view. | `media` | P11 | 07 |
| REQ-CAP-100 | The system must keep a clear separation between photorealistic catalog image, 2D cutout, inferred texture, garment proxy, and simulation-ready 3D garment (G0–G4 ladder). | Every garment representation record carries its G-level; no UI or doc conflates levels; ladder documented in doc 07. | `outfit` | P06, P11 | 07 |
| REQ-CAP-110 | Failure, retry, and manual-edit paths must exist when segmentation or classification is wrong. | User can re-run, manually mask, and re-categorize; corrections persist and win over reprocessing (REQ-MED-080). | `closet`, `media` | P06 | 07 |
| REQ-CAP-120 | Duplicate and near-duplicate detection must use visual + semantic similarity (embeddings/pgvector), never filename alone. | Eval set of duplicate pairs achieves precision/recall targets from doc 10; duplicates prompt merge/keep-both, not silent drops. | `closet` | P06 | 08 |
| REQ-CAP-130 | Offline or interrupted uploads must queue durably with resumable background processing. | Airplane-mode capture of ≥5 items syncs completely after reconnect; kill-app-mid-upload resumes without data loss. | `media` | P06, P07 | 07 |
| REQ-CAP-140 | Uncertain garment-reconstruction capabilities (G3/G4, single-view synthesis quality) must sit behind R&D spikes with measurable success and kill criteria, and the product must deliver value without them. | Each research bet has hypothesis, dataset, metric, cost limit, and kill decision recorded in docs 16/07; MVP demo works at A1+G0+G2 only. | `media`, `outfit` | P11 | 07, 16 |

### 2.5 ORG — Closet organization

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-ORG-010 | The taxonomy must be extensible and normalized — canonical category/subcategory identifiers, never uncontrolled strings. | Categories live in one owned table/registry (shared-kernel IDs); free-text category entry is impossible; migration adds categories without code change. | `closet` | P06, P07 | 08 |
| REQ-ORG-020 | Items must carry season and climate-suitability attributes. | Season/climate fields exist, are filterable, and feed REC warmth rules. | `closet` | P07 | 08 |
| REQ-ORG-030 | Items must carry color palette with dominant and secondary colors in canonical color values. | Colors extracted automatically, user-correctable, stored as shared-kernel color values; color-view browsing works (REQ-ORG-080). | `closet` | P07 | 08 |
| REQ-ORG-040 | Category-specific attributes must be supported: pattern, material, texture, cut, silhouette, fit, length, sleeve, neckline, rise, heel type, and comparable per-category fields. | Attribute schema varies by category; a shoe exposes heel type but not neckline; schema documented in doc 08. | `closet` | P07 | 08 |
| REQ-ORG-050 | Functional attributes must be supported: warmth, breathability, water resistance, layering role, formality, dress code, and activity suitability. | Each is stored, editable, and consumed by the engine's constraint rules (REQ-REC-130). | `closet` | P07 | 08 |
| REQ-ORG-060 | Items must support brand, size, purchase date, condition, laundry/care state, favorite status, and archive. | All fields CRUD-complete; archive removes item from candidates without deletion. | `closet` | P07 | 08 |
| REQ-ORG-070 | Outfit history, wear frequency, last worn, cost-per-wear (when purchase price supplied), and user notes must be tracked. | Marking an outfit worn updates wear events; cost-per-wear = price ÷ wear count renders on the item once a price exists. | `closet` | P07, P09 | 08 |
| REQ-ORG-080 | Custom tags, saved filters, search, sort, collections/capsules, season views, and color views must be provided. | Each is demoed in P07; saved filters persist across sessions and offline. | `closet` | P07 | 08 |
| REQ-ORG-090 | Items must support availability states `available / laundry / packed / lent / repair / archived` with easy state changes. | State machine implemented exactly as SPINE §8; unavailable states exclude items from recommendation candidates (REQ-REC-120). | `closet` | P07 | 08 |
| REQ-ORG-100 | Organization must be automatic-first with easy manual correction, and item metadata must have one canonical source with corrections feeding future models. | A manual correction updates the canonical record, is never overwritten by re-derivation, and is exported to eval/training data per consent (REQ-EXP-080 analog). | `closet` | P06, P07 | 08 |
| REQ-ORG-110 | The plan must prevent taxonomy drift, duplicate tags, inconsistent units, and repeated derivation of the same attributes. | Tag creation dedupes case/synonyms; units come only from shared-kernel; derived attributes are cached by input hash (NFR-AIC-030). | `closet`, `shared-kernel` | P07 | 08 |
| REQ-ORG-120 | Closet browsing and editing must work offline with eventual synchronization and conflict handling. | Offline edit on two devices converges deterministically after sync; conflict policy documented in doc 06. | `closet` | P07 | 06 |

### 2.6 MED — Media & asset pipeline

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-MED-010 | The asset pipeline must be a versioned state machine with explicit stages and state transitions (upload → validate → strip → segment → extract → confirm → optimize → publish; failure/quarantine states). | State diagram in doc 07 matches implementation; every asset row has a valid state; illegal transitions rejected in tests. | `media` | P06 | 07 |
| REQ-MED-020 | Every original upload must get an immutable content hash and immutable storage. | Same bytes re-uploaded dedupe by hash; originals are never mutated (derived assets only). | `media` | P06 | 07 |
| REQ-MED-030 | Uploads must pass validation and malware/content checks, with moderation and quarantine states. | Malformed/oversized/disallowed files are rejected; flagged content lands in `admin` moderation queue, invisible to processing. | `media`, `admin` | P06, P14 | 07, 11 |
| REQ-MED-040 | EXIF/privacy metadata must be stripped and orientation normalized before storage of derived assets. | Derived assets contain no GPS/EXIF payload (automated check); originals retain data only within the private original store. | `media` | P06 | 11 |
| REQ-MED-050 | Background segmentation and quality scoring must be pipeline stages with per-stage confidence recorded. | Each processed item stores segmentation quality score; low scores route to manual-edit path (REQ-CAP-110). | `media` | P06 | 07 |
| REQ-MED-060 | Optimization must produce LODs, compressed textures (KTX2/Basis), compressed meshes (Draco/meshopt), thumbnails, and R2 publication (cached custom domain for delivery assets) with versioned manifests. | Delivery formats match SPINE §2 ratified formats; manifest version bumps invalidate caches safely (NFR-PERF-050). | `media`, `platform` | P06, P10 | 07 |
| REQ-MED-070 | Full lineage must connect original, generated, corrected, and superseded assets. | For any derived asset, the API returns its complete ancestry chain to the original hash. | `media` | P06, P11 | 07 |
| REQ-MED-080 | Reprocessing after model upgrades must not destroy user corrections. | Re-running the pipeline on a corrected item preserves every user-confirmed field and mask; regression test included. | `media` | P06, P11 | 07 |
| REQ-MED-090 | Processing jobs must be idempotent with idempotency keys, retry limits, dead-letter handling, and replay/versioning policy via the outbox pattern. | Duplicate job delivery produces no duplicate assets; DLQ items are visible in admin; replay documented in doc 06. | `media`, `platform` | P02, P06 | 06 |
| REQ-MED-100 | Canonical 3D formats (glTF 2.0, KTX2, Draco/meshopt) must be ratified only after renderer comparison, covering coordinate systems, units, topology, skeleton version, morph-target names, PBR materials, texture color space, animation clips, and asset manifests. | Doc 07 records the comparison + conventions table; P01 prototype loads assets in the ratified format on both platforms. | `media`, `avatar` | P01, P02 | 07 |
| REQ-MED-110 | Asynchronous media/derived-asset/notification/billing/trend/feedback work must flow through domain events + outbox, without introducing a distributed event platform before measured need. | Outbox tables + relay exist in P02 skeleton; no Kafka-class infra in v1; ordering/idempotency expectations documented in doc 06. | `platform` | P02 | 06 |

### 2.7 CTX — Context providers

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-CTX-010 | Context facts must be typed records carrying provider, source time, expiry/freshness, confidence, consent scope, and user override. | The `ContextFact` contract in `packages/contracts` includes all six fields; engine refuses untyped context. | `context` | P08 | 09 |
| REQ-CTX-020 | A weather provider (Open-Meteo behind `WeatherProvider` port) must supply current and hourly conditions. | Current + hourly facts appear for the user's location; provider swap requires only a new port implementation. | `context`, `platform` | P08 | 09 |
| REQ-CTX-030 | Forecast for a user-selected future day must be available for future-outfit planning. | Selecting a date ≤ provider horizon yields forecast facts; beyond-horizon dates degrade with an explicit missing-data note (REQ-REC-140). | `context` | P08 | 09 |
| REQ-CTX-040 | Weather facts must include temperature, feels-like, rain/snow probability, wind, humidity, UV, and indoor/outdoor plan when they materially affect clothing. | All listed signals exist in the fact schema and at least temperature/feels-like/precipitation/wind drive engine rules with tests. | `context` | P08 | 09 |
| REQ-CTX-050 | Locale-aware public holidays (embedded `date-holidays` library behind the `HolidayProvider` port — no network call) must be provided, with the user choosing whether a holiday matters. | Holiday facts appear per locale; a per-recommendation toggle includes/excludes the holiday signal and defaults are user-configurable. | `context` | P08 | 09 |
| REQ-CTX-060 | User-selected occasion, dress code, activity, location type, time of day, travel, desired style, and comfort/formality goals must be explicit context inputs. | Each input is settable per recommendation request and appears in the reason trace when it influenced the result. | `context` | P08 | 09 |
| REQ-CTX-070 | Context providers must be pluggable so calendar/schedule/venue and other future providers can be added without redesigning the engine. | A mock calendar provider is added in a test using only the public provider interface — zero engine changes; seam exercised in P15. | `context` | P08, P15 | 09 |
| REQ-CTX-080 | Cached/offline context must be usable, with context-freshness warnings when facts are stale. | Offline recommendation uses cached facts and displays a staleness warning naming the stale fact and its age. | `context`, `recommendation` | P08, P09 | 09 |
| REQ-CTX-090 | The future calendar provider must minimize data: only fields needed for outfit context, never storing full event content. | P15 design gate: calendar fact schema contains no free-text event body/title beyond an occasion classification; ratified in doc 11. | `context` | P15 | 11 |

### 2.8 REC — Recommendation engine

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-REC-010 | Recommendations must be composed only of items the user actually owns, from the real closet inventory. | Engine candidates are drawn exclusively from the user's item table; no phantom/shoppable items appear in v1 results. | `recommendation` | P09 | 09 |
| REQ-REC-020 | The engine must be a well-defined, versioned, explainable subsystem — not a single LLM prompt and not logic scattered across screens. | Engine lives in `recommendation` module behind one application service; UI contains zero scoring/constraint logic (arch check); engine version recorded on every result. | `recommendation` | P09 | 09 |
| REQ-REC-030 | The engine must implement the staged pipeline: collect normalized context → record fact metadata → evaluate hard exclusions → generate candidates → score → controlled personalization/trends → validate full outfit → deterministic rank → structured result → render (outside engine) → capture feedback. | Each stage is a named, separately testable component; pipeline diagram in doc 09 matches code structure. | `recommendation` | P09 | 09 |
| REQ-REC-040 | Hard constraints (safety, practicality, hard exclusions, availability, dress-code conflicts) must be enforced before soft-preference ranking, with defined precedence and conflict-resolution rules. | Precedence table exists in doc 09; simulation suite (NFR-TST-100) shows zero hard-constraint violations across generated scenarios. | `recommendation` | P09 | 09 |
| REQ-REC-050 | Selecting a holiday (or any soft signal) must never cause unsafe recommendations — e.g. never shorts in unsafe cold weather. | The cold-weather-holiday simulation passes: with holiday=selected and temp below the safety threshold, no cold-unsafe outfit is ever returned. | `recommendation` | P09 | 09 |
| REQ-REC-060 | Every suggested outfit must pass a final policy/compatibility validation step on the complete outfit before being returned. | Validator is the last pipeline stage; injecting an invalid pair upstream is caught by the validator in tests. | `recommendation` | P09 | 09 |
| REQ-REC-070 | Ranking must be deterministic with defined tie-breaks; no hidden randomness; "show me something different" is an explicit user-controlled mode that still honors all constraints. | Same inputs + same versions → byte-identical ranked output (repeatability test); diversity mode changes results only via a recorded user-controlled seed/cursor and never violates constraints. | `recommendation` | P09 | 09 |
| REQ-REC-080 | Scoring must combine deterministic rules with learned user-preference weights, both versioned. | Score breakdown per candidate is inspectable; rule/weight versions stored on the result; weight update path documented. | `recommendation` | P09 | 09 |
| REQ-REC-090 | Rules and models must be versioned so any past recommendation can be reproduced and debugged. | Replaying a stored recommendation (inputs + versions) reproduces the identical result in a test harness. | `recommendation` | P09 | 09 |
| REQ-REC-100 | Candidate generation must have limits and a performance strategy for large closets. | 1,000-item synthetic closet returns within the latency budget (NFR-PERF-010) with bounded candidate counts. | `recommendation` | P09 | 09 |
| REQ-REC-110 | Results must be structured and independent of UI/3D: ranked outfits with reason codes, confidence, alternatives, and missing-data notes. | Result schema in `packages/contracts` contains all four elements; renders in both 3D and accessibility (2D) clients unchanged. | `recommendation` | P09 | 09 |
| REQ-REC-120 | Items in unavailable states (laundry, packed, lent, repair, archived) must never be recommended. | Simulation: flipping an item to each unavailable state removes it from all subsequent results until restored. | `recommendation` | P09 | 09 |
| REQ-REC-130 | Scoring/compatibility must account for garment compatibility, layering, color coordination, silhouette, fit preference, repeat/wear history, climate tolerance, and personal restrictions. | Each signal has at least one rule + unit test demonstrating its effect on ranking; documented in doc 09 rule registry. | `recommendation` | P09 | 09 |
| REQ-REC-140 | Cold-start, sparse-closet, missing-context, and no-valid-outfit behaviors must be explicitly defined and helpful. | Each case returns a structured, actionable response (e.g. "add shoes to unlock outfits"), never an error or fabricated data; covered by tests. | `recommendation` | P09 | 09 |
| REQ-REC-150 | Offline/cached recommendation behavior must be defined, with freshness warnings on cached context. | Offline mode serves the last valid recommendation set flagged as cached, with staleness notes (with REQ-CTX-080). | `recommendation` | P09 | 09 |
| REQ-REC-160 | Seasonal trends and inspiration may influence ranking only after all hard practical constraints are satisfied. | Trend boost applies only within the post-validation candidate set; simulation proves a trend can never resurrect a constraint-violating outfit. | `recommendation` | P09, P12 | 09 |
| REQ-REC-170 | Experimentation (A/B, rule variants) must never corrupt deterministic safety constraints. | Experiment assignment affects only soft scoring; hard-constraint stages are excluded from experimentation by construction; verified in code review + test. | `recommendation` | P09, P13 | 09 |
| REQ-REC-180 | The selected outfit must render on the avatar in multiple poses with graceful G0/2D fallbacks, with no recommendation logic in the renderer. | P10 demo: same structured result renders as avatar presentation and as G0 collage; renderer code contains no scoring/constraint imports (arch check). | `outfit` | P10 | 07, 09 |
| REQ-REC-190 | When information is unknown, the system must expose uncertainty, ask for missing input when useful, or label the assumption — never silently invent personal facts. | Missing-data notes appear on results derived from assumptions; no default is presented as user-provided fact; copy audit + tests. | `recommendation` | P09 | 09 |

### 2.9 EXP — Explanation & feedback

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-EXP-010 | Each recommendation must state concise, concrete reasons (weather suitability, occasion fit, color harmony, rarely-worn item, saved preference) produced from the engine's decision trace as stable reason codes — never hallucinated afterward. | Every displayed reason maps 1:1 to a reason code emitted by a pipeline stage; reason-code registry lives in `shared-kernel`; no LLM wording polish exists in the product path (DEC-46; NFR-AIC-040). | `recommendation`, `shared-kernel` | P09 | 09 |
| REQ-EXP-020 | Explanations must not expose private or sensitive inference in surprising language. | Explanation copy review checklist applied; sensitive attributes (body data, inferred traits) never appear verbatim in reasons; audited in P14. | `recommendation` | P09, P14 | 11 |
| REQ-EXP-030 | Users must be able to like/dislike a whole outfit. | Both actions persist and demonstrably shift future ranking (weight test). | `recommendation` | P09 | 09 |
| REQ-EXP-040 | Users must be able to replace one item while keeping the rest of the outfit. | Replacement re-runs candidate selection for that slot only; the rest of the outfit is preserved and revalidated. | `recommendation` | P09 | 09 |
| REQ-EXP-050 | Structured feedback reasons must be supported: too warm/cold, too formal/casual, uncomfortable, wrong color, wrong fit, repetitive, unavailable. | Each reason is a distinct enum consumed differently by the engine (e.g. "unavailable" flips availability state, "too warm" adjusts warmth weight). | `recommendation` | P09 | 09 |
| REQ-EXP-060 | Users must be able to save an outfit, schedule it for later, mark it as worn, and compare alternatives. | All four actions demoed; mark-as-worn writes wear history (REQ-ORG-070); scheduling binds to a future-day forecast (REQ-CTX-030). | `outfit`, `recommendation` | P09, P10 | 09 |
| REQ-EXP-070 | "Never suggest this pairing" and similar durable negative constraints must persist as hard rules until the user removes them. | The banned pairing never reappears across sessions/versions (simulation); the constraint is listed and revocable in preference transparency (REQ-EXP-090). | `recommendation` | P09 | 09 |
| REQ-EXP-080 | Every feedback type must be classified as hard rule, preference weight, temporary session signal, or training/eval data, with the mapping documented. | Doc 09 contains the complete feedback-classification table; implementation matches it (test per class). | `recommendation` | P09 | 09 |
| REQ-EXP-090 | Undo, reset-personalization, and preference transparency must be provided. | User can view every learned/stated preference, undo the last feedback action, and reset personalization to stated-preferences-only. | `recommendation`, `profile` | P09 | 09 |
| REQ-EXP-100 | Guardrails must prevent one accidental action from overfitting the profile. | A single feedback event changes any weight by no more than the documented bounded step; property test enforces the bound. | `recommendation` | P09 | 09 |

### 2.10 TRD — Fashion intelligence

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-TRD-010 | The trend feed must be personalized — never random or generic — using explicit style preferences, closet composition, region, season, climate, followed designers/brands, and feedback. | Two users with different profiles/closets receive measurably different feeds; personalization inputs are listed per feed item internally. | `fashion-intel` | P12 | 02 |
| REQ-TRD-020 | Content must cover current fashion trends, runway collections, seasonal styles, outfit inspiration, and categories/designers/colors/silhouettes/materials relevant to the user. | Each content type exists in the ingestion taxonomy and renders in the feed. | `fashion-intel` | P12 | 02 |
| REQ-TRD-030 | Every feed item must explain why it is shown. | Each item displays a why-shown reason derived from its personalization inputs. | `fashion-intel` | P12 | 02 |
| REQ-TRD-040 | All content must carry source provenance, attribution, and freshness, with deduplication across sources. | Content records store source, license, fetch time; duplicate stories collapse; attribution renders in UI. | `fashion-intel` | P12 | 04 |
| REQ-TRD-050 | Content acquisition must respect licensing/copyright; unauthorized scraping must not be the foundation of the feature. | Every ingestion source has a documented rights basis (license, API terms, or owned content) in the source register; no source without one ships. | `fashion-intel` | P12 | 11 |
| REQ-TRD-060 | Ingestion jobs, editorial-quality rules, moderation, content safety, and source-disappearance handling must be defined. | Ingestion runs as idempotent jobs; unsafe content is quarantined via `admin`; removing a source gracefully retires its content. | `fashion-intel`, `admin` | P12 | 04, 11 |
| REQ-TRD-070 | Fashion knowledge must stay separated from outfit suitability: a trend influences recommendations only via the engine's post-constraint stage. | `fashion-intel` exposes trend signals through a port consumed by `recommendation`; no direct feed→outfit shortcut exists (arch check; see REQ-REC-160). | `fashion-intel` | P12 | 09 |
| REQ-TRD-080 | Hide/unfollow/not-interested signals must feed personalization and be honored immediately. | Hiding a designer removes their content from the next feed refresh and logs the signal for personalization. | `fashion-intel` | P12 | 02 |

### 2.11 CHT — Future AI stylist chat

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-CHT-010 | Chat must not be implemented in initial phases; only the architectural seams are established early, with full foundations gated on post-launch metrics. | No chat UI/service ships before P15; application-service contracts (the seam) exist from P02 and are ratified as chat-ready in doc 04. | `assistant` | P02, P15 | 04 |
| REQ-CHT-020 | The future chat must call the same profile, closet, context, recommendation, trend, and entitlement application services as every other client — no second recommendation engine, no direct table access. | `assistant` module may import only public application services (dependency-cruiser rule exists from P02); design review confirms zero duplicated business logic. | `assistant` | P15 | 04 |
| REQ-CHT-030 | Stable application-service/tool contracts with authorization must be defined for chat tool-calls. | Tool-contract schemas exist in `packages/contracts` with per-tool authorization scopes; contract tests cover them. | `assistant`, `shared-kernel` | P15 | 04, 06 |
| REQ-CHT-040 | Conversation privacy, auditability, and safe deletion must be designed before chat ships. | Conversations are user-scoped, audit-logged, excluded from provider training (NFR-AIC-070), and deleted with the account. | `assistant` | P15 | 11 |
| REQ-CHT-050 | Prompt versioning, tool-call limits, model routing, and cost controls must govern the chat runtime. | Each chat response records prompt+model versions; per-user tool-call and spend limits enforce plan-level guardrails (REQ-BIL-100). | `assistant` | P15 | 10 |

### 2.12 BIL — Pricing, billing & entitlements

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-BIL-010 | Every new account gets a 3-day full-access trial at Pro level, server-granted at signup, with no card required. | New account immediately holds Pro entitlements with a server-side expiry 72h out; no payment sheet appears before opt-in. | `billing` | P13 | 12 |
| REQ-BIL-020 | On trial expiry the account moves automatically to a genuinely useful Free tier (SPINE §6 limits). | Expiry job downgrades entitlements to Free; Free user can still browse closet, get 1 basic recommendation/day, and export data. | `billing` | P13 | 12 |
| REQ-BIL-030 | Three paid tiers (Essentials, Plus, Pro) with clear value boundaries must exist, with all prices labeled as hypotheses requiring market and store-region testing. | Tier matrix matches SPINE §6; every price string in docs and store metadata carries the hypothesis label until validated. | `billing` | P13 | 12 |
| REQ-BIL-040 | Entitlements must be server-side capability grants — the source of truth — enforced at the API, never UI-only feature flags. | Direct API calls without entitlement fail with 403 regardless of client state; entitlements table is authoritative over store state between reconciliations. | `billing` | P13 (seams P06+) | 12 |
| REQ-BIL-050 | Monthly and annual subscriptions plus restore purchases must work on both stores via RevenueCat. | Sandbox purchase, annual/monthly switch, and restore-on-new-device all succeed on iOS and Android test builds. | `billing` | P13 | 12 |
| REQ-BIL-060 | Grace periods, billing retry, cancellation, refunds, upgrades/downgrades, family/account-sharing policy, and regional availability must be handled. | Each lifecycle event has a defined entitlement outcome (table in doc 12) and a webhook-driven test; family-sharing decision recorded. | `billing` | P13 | 12 |
| REQ-BIL-070 | Apple App Store and Google Play billing compliance must be maintained (IAP for digital goods, required disclosures). | Store review passes; compliance checklist in doc 12 signed off in P14. | `billing` | P13, P14 | 12 |
| REQ-BIL-080 | Webhook handling must be idempotent with periodic reconciliation between store state and the entitlements table. | Replaying any webhook produces no state change (test); nightly reconciliation job repairs injected drift and alerts on mismatch (NFR-OBS-030). | `billing` | P13 | 12 |
| REQ-BIL-090 | Genuinely expensive operations (G2 try-on, missing-view synthesis, priority processing) must be metered via generative credits without making normal daily use feel punitive. | Credit balances match SPINE §6 per tier; ordinary capture/recommendation/browsing consumes zero credits; meter decrements are atomic and auditable. | `billing` | P13 | 12 |
| REQ-BIL-100 | Cost-to-serve must be estimated per capability with plan-level guardrails limiting per-user variable cost. | Doc 12 contains per-capability cost tables (from r3/r4, as-of dated); runtime guardrails cap per-user AI spend per plan and alert on breach. | `billing` | P13 | 12 |
| REQ-BIL-110 | Experiments, grandfathering, plan versioning, and a clean path to change packaging later must be designed in. | Plans carry versions; existing subscribers keep grandfathered terms on repackaging (test); paywall experiments run via flags without touching entitlement enforcement. | `billing` | P13 | 12 |
| REQ-BIL-120 | On subscription expiry, user data must remain safe and exportable, and paid-derived assets must be handled predictably. | Downgrade deletes nothing; export works on Free; paid-derived assets (e.g. G2 images) remain viewable with documented behavior for regeneration. | `billing`, `closet` | P13 | 12 |
| REQ-BIL-130 | Entitlement seams (feature flags + entitlement checks) must be built into features from P06 onward so P13 only activates billing. | From P06, gated features check entitlements via the shared check; P13 enables paid tiers without refactoring feature code. | `billing`, all | P06–P13 | 12 |

### 2.13 NOT — Notifications

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| REQ-NOT-010 | Push notifications must be delivered via FCM + APNs behind a platform port, with delivery tracking. | Test push reaches iOS and Android devices; deliveries are recorded; provider swap touches only `platform`. | `notifications`, `platform` | P09 | 04 |
| REQ-NOT-020 | Users must control notification preferences: per-category opt-in/out, consent-first, quiet hours, and timezone-aware scheduling. | No notification is sent without opt-in; category toggles and quiet hours are honored in scheduling tests. | `notifications` | P09 | 02 |
| REQ-NOT-030 | A daily outfit-recommendation notification must be available, honoring preferences, timezone, and context freshness. | Opted-in user receives the daily notification at their chosen local time with a fresh recommendation; opted-out user never does. | `notifications`, `recommendation` | P09 | 02 |

---

## 3. Non-functional requirements

### 3.1 SEC — Security

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| NFR-SEC-010 | A threat model and abuse cases must be documented and maintained, covering face misuse, account takeover, media abuse, webhook forgery, and admin abuse. | Threat model exists from P00, is updated each phase that adds attack surface, and is re-reviewed in P14. | `identity`, all | P00, P14 | 11 |
| NFR-SEC-020 | Authentication must use better-auth with Apple + Google sign-in, passkeys/MFA support, and secure session storage on device (Keychain/Keystore). | Auth flows pass security tests; tokens are never stored in plain AsyncStorage; session revocation works. | `identity` | P03 | 11 |
| NFR-SEC-030 | Authorization with strict user/tenant isolation must apply to every endpoint, plus separate admin access controls with audit. | Isolation test suite proves user A can never read/write user B's items, media, recommendations, or entitlements; admin actions require role + are audit-logged (NFR-OBS-070). | `identity`, `admin` | P03, P14 | 11 |
| NFR-SEC-040 | Encryption must apply in transit (TLS) and at rest, with managed keys and secret rotation. | TLS enforced everywhere (no cleartext endpoints); storage/DB encryption at rest verified; secret-rotation runbook exists and is drilled once pre-launch. | `platform` | P02, P14 | 11 |
| NFR-SEC-050 | Media access must use short-lived signed URLs with upload restrictions (type, size, rate). | Expired/unsigned URL requests fail; oversized or wrong-type uploads are rejected server-side; covered by security tests. | `media`, `platform` | P06 | 11 |
| NFR-SEC-060 | Least privilege and explicit consent must govern every external integration and permission. | Permission matrix in doc 11 lists each integration's scopes and consent gate; app requests OS permissions only at point of use. | `identity`, `platform` | P02–P14 | 11 |
| NFR-SEC-070 | Rate limits, abuse prevention, and account recovery must be implemented. | Rate limits verified by test on auth, upload, and AI endpoints; account recovery flow demoed without support intervention. | `identity`, `platform` | P03, P14 | 11 |
| NFR-SEC-080 | An incident-response plan sized for a small team must exist before launch. | Doc 14 runbooks include incident severity levels, roles, comms, and a post-incident review template; one drill completed in P14. | `admin` | P14 | 14 |
| NFR-SEC-090 | Content moderation must cover user-uploaded media and ingested fashion content. | Moderation queue in `admin` receives flagged items from both pipelines; quarantined content is excluded from serving. | `admin`, `media`, `fashion-intel` | P06, P12, P14 | 11 |
| NFR-SEC-100 | Security test suites must cover authorization, user isolation, signed uploads, webhook replay, rate limits, and deletion. | The listed suites run in CI (pre-release tier at minimum) and gate release. | all | P13, P14 | 13 |
| NFR-SEC-110 | Dependency updates, vulnerability scans, license/SBOM generation, secret scanning, and a supply-chain policy must run continuously. | CI includes vuln + secret scans on every PR; SBOM produced per release; policy documented in doc 15. | `platform` | P02 | 15 |

### 3.2 PRV — Privacy & compliance

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| NFR-PRV-010 | Body measurements, selfies, face-derived geometry, location, calendar events, and wardrobe history must be classified and handled as sensitive data. | Data-classification table in doc 11 assigns class, storage, retention, and access rules to every field; schema review enforces it. | all | P00, P03 | 11 |
| NFR-PRV-020 | Explicit, granular, auditable consent must gate each sensitive data category, with per-integration consent records. | Consent records (who/what/when/version) exist for face, location, analytics, and future calendar; withdrawing consent halts the corresponding processing. | `identity` | P03, P05 | 11 |
| NFR-PRV-030 | Full data export must be available to every user on every tier, including Free and expired accounts. | Export produces a complete machine-readable archive (profile, items, media links, outfits, feedback) within the documented SLA; works on Free tier. | `identity` | P03, P13 | 11 |
| NFR-PRV-040 | Account deletion must cascade across all stores: DB rows, originals, derived assets, avatar/face assets, custom-domain caches, and search/vector indexes, with backup-deletion limitations documented and disclosed. | Deletion test verifies no user-linked artifact remains queryable post-deletion; backup expiry window is documented in the privacy policy. | `identity`, `media` | P03, P05, P14 | 11 |
| NFR-PRV-050 | Retention limits must be defined per data class, with the strictest applied to face data under biometric-data rules (e.g. BIPA-class statutes). | Retention table exists; face originals auto-expire per policy; biometric handling is flagged for legal review in the register. | `media`, `identity` | P05, P14 | 11 |
| NFR-PRV-060 | GDPR/UK GDPR, CCPA/CPRA, and app-store privacy disclosures must be addressed, with a legal-review register for every statement needing counsel — the plan is not legal advice. | Privacy nutrition labels / Data safety forms completed; legal-review register in doc 11 lists open items with owners; no planning doc presents legal conclusions as settled. | `identity` | P00, P14 | 11 |
| NFR-PRV-070 | The age policy must be explicit: define minimum age, enforcement (age gate at signup), and whether minors are supported — never left implicit. | P00 decision records the minimum age; signup enforces it; store listings match. | `identity` | P00, P03 | 11 |
| NFR-PRV-080 | Logging must prohibit sensitive photos, tokens, raw calendar text, and unnecessary personal data, enforced by redaction. | Log-redaction tests inject sensitive payloads and verify they never reach log sinks; logging rules documented in doc 14. | all | P02 | 14 |
| NFR-PRV-090 | The product must never do body shaming, attractiveness scoring, health diagnosis, or unsupported inference from appearance, and must use inclusive language with user-correction controls. | Copy/feature audit in P14 confirms no such feature or language exists; every derived personal attribute is user-correctable; explicitly listed in doc 00 non-goals. | all | P00, P14 | 00, 11 |
| NFR-PRV-100 | Location privacy must offer precise vs coarse location and manual city entry for weather. | All three modes work; weather functions fully on manual city with no location permission granted. | `context`, `identity` | P08 | 11 |
| NFR-PRV-110 | Product analytics must be consent-based with an explicit event taxonomy and no raw sensitive payloads. | Analytics events validate against the taxonomy schema; audit shows no measurement values, photos, or free-text sensitive data in any event. | `platform` | P02, P14 | 14 |

### 3.3 PERF — Performance & reliability

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| NFR-PERF-010 | Measurable budgets must be defined as hypotheses then measured — app startup, interaction response, recommendation latency, camera-to-catalog time, asset download, and 3D first-render — never just "fast". | Doc 13 budget table gives initial numeric targets per journey, each marked hypothesis/measured; P14 replaces hypotheses with device-measured values. | all | P00, P14 | 13 |
| NFR-PERF-020 | 3D budgets must cover frame rate/frame time, memory, GPU memory, package size, battery, thermal, network, and cache for representative low-, mid-, and high-tier devices, with low-end fallbacks. | P01 gate and P14 report record measurements per device tier against the budget table; low-tier device stays within budget or triggers the documented fallback. | `avatar` | P01, P14 | 13 |
| NFR-PERF-030 | Backend budgets must define availability targets, API latency percentiles, queue latency, job completion times, error budgets, and recovery objectives. | SLO table exists in doc 13; dashboards (NFR-OBS-030) track each; alerts fire on error-budget burn. | `platform` | P02, P14 | 13 |
| NFR-PERF-040 | Resilience patterns are mandatory: bounded queues, timeouts, retries with jitter, circuit breakers, cancellation, backpressure, and graceful degradation for provider failures. | Chaos-style tests degrade each external provider; the app degrades gracefully (cached context, G0 fallback, queued uploads) without crashes. | `platform`, all | P02–P14 | 13 |
| NFR-PERF-050 | Public-asset caching (R2 custom domain) and client asset caching must have safe invalidation and client disk limits. | Versioned manifests guarantee stale assets are never served after invalidation; client cache respects its disk cap under test. | `media`, `platform` | P06, P10 | 13 |
| NFR-PERF-060 | Load testing and real-device performance testing must precede any performance claim; benchmark results must never be fabricated. | Pre-launch load test + device-lab results are archived as evidence; docs cite only measured numbers with dates. | all | P14 | 13 |
| NFR-PERF-070 | The P01 prototype gate must measure frame rate, memory, startup, and package size on real iOS and Android hardware with representative avatar + garments, poses, and rotate/zoom, producing a go/no-go decision. | P01 report contains the measurements and an explicit go/no-go with fallback decision if no-go (*2026-09-22: the prototype is the native Filament spike; the RN-era "native Filament bridge" fallback is moot, DEC-50*). | `avatar` | P01 | 05, 13 |

### 3.4 OBS — Observability & analytics

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| NFR-OBS-010 | Structured logs with correlation IDs and strict redaction must span API and workers. | A single correlation ID traces one request across API → outbox → worker in the log store; redaction per NFR-PRV-080. | `platform` | P02 | 14 |
| NFR-OBS-020 | Distributed traces must cover API requests and asynchronous asset jobs end-to-end. | A capture-to-published-asset trace is viewable as one trace tree including queue hops. | `platform` | P02, P06 | 14 |
| NFR-OBS-030 | Metrics must cover latency, errors, queue depth, job age, provider failures, cache effectiveness, recommendation validity, 3D asset failures, billing reconciliation, and cost per active user. | Each listed metric has a dashboard panel and an owner; billing-reconciliation mismatch and rec-validity alerts exist. | `platform`, all | P02–P13 | 14 |
| NFR-OBS-040 | Crash reporting must cover mobile and backend (PostHog, Sentry optional). | Forced test crashes on both platforms appear in the crash tool with symbolicated stacks. | `platform` | P02 | 14 |
| NFR-OBS-050 | Dashboards, alerts, runbooks, small-team on-call expectations, and incident reviews must exist for everything operated. | Every alert links to a runbook; on-call rotation documented; incident-review template used after the P14 drill. | `admin`, `platform` | P02, P14 | 14 |
| NFR-OBS-060 | Product analytics must follow an explicit owned event taxonomy (consent-gated per NFR-PRV-110). | Event taxonomy doc lists every event, owner, and properties; unknown events are rejected in CI schema check. | `platform` | P02 | 14 |
| NFR-OBS-070 | Audit trails must record admin access, consent changes, asset deletions, recommendation versions, and entitlement changes. | Each action type produces an immutable audit row; audit query demoed in P14. | `admin` | P03–P14 | 14 |
| NFR-OBS-080 | Feature flags must have owners, expiry dates, and safe rollout/rollback. | Flag registry lists owner + expiry per flag; CI warns on expired flags; a rollback is demoed. | `platform` | P02 | 14 |
| NFR-OBS-090 | Every phase must add the observability needed to operate what it introduces. | Phase template contains a mandatory observability section; phase DoD includes its dashboards/alerts live. | all | P02–P15 | 14 |
| NFR-OBS-100 | A product-metric tree with guardrails must exist: onboarding completion, time-to-first-value, avatar/closet/recommendation quality rates, conversion/retention, AI cost, crash-free sessions, privacy guardrails, and fairness slices — each with owner, source, privacy class, target-or-baseline, and the decision it informs; engagement must never be optimized at the expense of trust, wellbeing, or privacy. | Doc 14 metric tree covers every brief-§12 metric with all five attributes; guardrail metrics (constraint violations, consent, deletion completion, sensitive-logging incidents) have alerts. | `platform`, all | P00, P14, P15 | 14 |

### 3.5 TST — Testing & quality

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| NFR-TST-010 | Every domain/module must have its own `tests/` directory and module-owned test-support/fixture packages; tests must not scatter through production sources (framework exceptions documented). | Repo lint verifies test placement; fixtures/builders live in module test-support packages; exception list exists in doc 13. | all | P02 | 13 |
| NFR-TST-020 | Pure domain unit tests plus property-based tests must cover rules, constraints, scoring, normalization, state transitions, measurements, unit conversions, taxonomy, and ranking invariants. | Property-test suites exist for units/measurements (P03), taxonomy (P07), and ranking/constraints (P09); CI runs them on every PR. | all | P03–P09 | 13 |
| NFR-TST-030 | Contract tests must cover mobile/backend APIs, events, providers, model outputs, and version compatibility. | Generated client and server validate against the same OpenAPI 3.1 contract in CI; provider ports have contract tests with recorded fixtures; breaking changes fail CI. | `shared-kernel`, `platform` | P02+ | 13 |
| NFR-TST-040 | Integration tests must run against real disposable dependencies where useful, including job idempotency, retry, cancellation, dead-letter, reprocessing, migration, backup, and restore tests. | Testcontainers-style Postgres/R2-compatible integration suites run in CI; a restore drill from backup is executed and documented pre-launch. | `platform`, `media` | P02, P06, P14 | 13 |
| NFR-TST-050 | Mobile component/integration tests and E2E tests must cover onboarding, closet capture, recommendation, purchase/restore, deletion, and degraded external providers. | The six E2E journeys run in the nightly CI tier on both platforms and gate release. | all | P03–P14 | 13 |
| NFR-TST-060 | Golden/visual regression tests must cover avatar poses, garment rendering, colors, and important UI states. | Golden-image suite runs nightly; diffs above threshold fail and require explicit approval. | `avatar`, `outfit` | P04, P10 | 13 |
| NFR-TST-070 | Real-device performance tests must run on representative low/mid/high iOS and Android tiers. | Device matrix defined in doc 13; nightly/pre-release device runs record metrics against NFR-PERF budgets. | all | P01, P14 | 13 |
| NFR-TST-080 | Accessibility tests plus manual screen-reader, dynamic-text, contrast, reduced-motion, and touch-target checks are required. | Automated a11y checks in CI; manual checklist executed and archived in P14 for the six core journeys. | all | P14 | 13 |
| NFR-TST-090 | AI/ML evaluation suites must use versioned, consent-safe datasets with task metrics, demographic/skin-tone/body-shape slices where ethically and legally appropriate, hallucination/invalid-output checks, and cost/latency regression gates. | Each AI feature (segmentation, classification, dedup, try-on, explanations) has an eval suite meeting doc 10 thresholds; eval regression blocks model/prompt changes. | `media`, `recommendation` | P06, P09, P11 | 10, 13 |
| NFR-TST-100 | Recommendation simulations must prove hard constraints are never violated — including cold-weather-holiday cases, unavailable/laundry items, conflicting dress codes, sparse closets, and future forecasts. | Simulation suite generates scenario matrices for all five cases; zero violations is a release gate; violation metric feeds NFR-OBS-100. | `recommendation` | P09 | 09, 13 |
| NFR-TST-110 | Bug fixes require a regression test that demonstrably fails before the fix; no skipped tests to green CI; flaky tests are defects fixed or quarantined with an owner and deadline — never silently retried forever. | PR template requires failing-test evidence for fixes; CI forbids skip annotations without linked issue; flaky quarantine list has owner+deadline per entry. | all | P02+ | 13 |
| NFR-TST-120 | CI must run in tiers: fast PR gates, targeted affected-module tests, nightly device/render/ML suites, and pre-release full qualification, with test-data factories and privacy-safe fixtures. | All four tiers exist in GitHub Actions; PR gate median time meets doc 13 target; fixtures contain no real user data. | `platform` | P02 | 13 |
| NFR-TST-130 | Tests must assert observable behavior, not implementation call shapes, with minimized mocking. | Code-review checklist enforces behavior-first assertions; provider ports are faked at the boundary, not deep-mocked internally. | all | P02+ | 13 |

### 3.6 TEAM — Team, workflow & repository standards

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| NFR-TEAM-010 | Development must be Linux-first: Android and backend fully excellent on Ubuntu, with production iOS builds, signing, and store delivery on hosted macOS CI (EAS Build or GitHub Actions macOS) — never implying the full iOS lifecycle runs locally on Ubuntu. | An Ubuntu-only developer ships an Android build and a TestFlight build (via CI) following doc 15; the macOS dependency is documented, with the EAS-vs-GHA ADR decided in P02. *Amended 2026-09-22 (DEC-51): the lane is GHA macOS; iOS app-target work additionally uses the team's Mac.* | `platform` | P02 | 15 |
| NFR-TEAM-020 | The monorepo (pnpm workspaces + Turborepo) must visibly separate mobile app, backend, ML/media workers, shared contracts/generated clients, domain modules, infra adapters, 3D assets + tooling, admin tools, and docs/ADRs/phases — with no generic `utils` dump and large binaries in an artifact store, not Git. | Repo layout matches doc 15 map; lint forbids `utils` catch-alls; Git history contains no large binaries (checked by CI hook). | all | P02 | 15 |
| NFR-TEAM-030 | Module boundaries must be enforced in CI (ESLint boundaries + dependency-cruiser): small public entry points, no internal imports, no business logic in UI components, controllers, DB models, provider SDK wrappers, or job handlers, with composition roots, transaction boundaries, and forbidden dependencies per SPINE §3. | Arch-check CI fails on any boundary violation; each module has a module-contract file listing interface, owned data, invariants, events, dependencies, forbidden dependencies, tests, and extension points. | all | P02 | 04, 15 |
| NFR-TEAM-040 | AI agents must follow the semantic search-before-write workflow (describe intent → search by behavior and structure, not name-only → read candidates fully → reuse/extend canonical code → justify any new implementation → run duplication/architecture checks) — never copy-and-diverge, and no speculative abstractions. | The workflow is mandatory in CLAUDE.md; duplication/clone-detection check runs in CI; review rejects PRs lacking the reuse justification when new near-duplicate code appears. | all | P02+ | 15 |
| NFR-TEAM-050 | Production files must stay small and single-purpose with review thresholds and documented exceptions — never splitting coherent code merely to satisfy a line count. | File-size review threshold documented in doc 15; exceptions carry a justification comment; reviewers enforce. | all | P02+ | 15 |
| NFR-TEAM-060 | A root `just` task runner must provide memorable commands for bootstrap, dev, test, lint, typecheck, format, architecture checks, generation, migrations, mobile builds, 3D asset validation, ML evaluation, security checks, and CI parity; scripts must be readable, idempotent where practical, fail-fast, and print actionable errors. | `just --list` shows all listed commands; each CI job runs the same `just` target a developer runs locally; script review checklist applied. | `platform` | P02 | 15 |
| NFR-TEAM-070 | Toolchain versions must be pinned (mise/asdf) with a one-command Ubuntu bootstrap and an environment doctor. | Fresh Ubuntu machine reaches a running dev environment with one documented command; `just doctor` diagnoses missing pieces. | `platform` | P02 | 15 |
| NFR-TEAM-080 | Every shared concept — API schemas, event schemas, taxonomy, units, color values, measurement definitions, asset manifests, reason codes, entitlement names — must have one canonical owner with generated clients/types; generated files clearly marked; CI fails on stale generation. | Ownership table in doc 06; regeneration in CI is diff-clean or the build fails; mobile/backend/workers import, never copy, shared schemas. | `shared-kernel` | P02 | 06 |
| NFR-TEAM-090 | A strict root `CLAUDE.md` operating contract must exist covering: required reading order, scope restatement, semantic search-before-write, module-boundary preservation, single source of truth, deterministic-before-AI, current-docs-not-guessing, smallest coherent change, per-module tests with failing-regression proof, scoped checks and full gates, performance measured before/after, no fabricated results, sensitive-data protection, no destructive actions without authorization, progress-ledger updates, and leave-buildable-or-report — plus source-of-truth priority, invariants, standard commands, completion checklist, and handoff protocol. | root `CLAUDE.md` contains every listed rule; permanent rules live there while phase detail stays in phase files; spot-check finds no contradiction with SPINE. | all | P02 | 15, CLAUDE.md |
| NFR-TEAM-100 | A small, focused project-specific AI skill library must ship as actual SKILL.md files — each with trigger, required reading, workflow, validation commands, output, and stop/escalation conditions — covering at minimum: mobile features/native bridges, 3D asset changes + device validation, backend module changes, recommendation rules + evals, media/ML pipeline, DB migrations, API/event schema changes + regeneration, security/privacy review, subscription/entitlement changes, testing/regression, performance profiling, release readiness, and architecture/duplicate review — with no two skills overlapping completely. | `.agents/skills/` contains a SKILL.md per listed area with all six sections; overlap review documented. | all | P02 | 15 |
| NFR-TEAM-110 | Branching/review model for small tracer-bullet changes, commit/PR conventions, CODEOWNERS, an ADR template + decision log, definition of ready/done, and an issue template (scope, non-goals, dependencies, acceptance criteria, test plan, observability, rollout, rollback) must exist. | All templates exist under `templates/`; ADR log seeded with SPINE decisions in P00; sample PR follows conventions. | all | P00, P02 | 15, 16 |
| NFR-TEAM-120 | Secrets strategy with `.env.example` (no real secrets) and secret-scanning must be in place. | `.env.example` covers every required variable with placeholders; secret scanner blocks real credentials in CI. | `platform` | P02 | 15 |
| NFR-TEAM-130 | Database migration and rollback policy plus dev/staging/production data isolation with safe seed data must exist. | drizzle-kit migrations have a tested rollback path; environments use separate databases/credentials; seeds contain no real user data. | `platform` | P02 | 06, 15 |
| NFR-TEAM-140 | Android and iOS CI/CD must cover signing, internal distribution, staged rollout, crash gates, and rollback strategy. | Both store pipelines run from CI; staged rollout config + crash-gate thresholds documented; a rollback is rehearsed pre-launch. | `platform` | P02, P14 | 15 |
| NFR-TEAM-150 | `PROGRESS.md` must be a durable status ledger with exact status vocabulary and next-session instructions, updated before every session end, plus a session-handoff template. | Ledger exists with the defined vocabulary; CLAUDE.md completion checklist requires the update; handoff template in `templates/`. | all | P02+ | 15 |
| NFR-TEAM-160 | Phase completion requires tests, evidence, documentation, operability, privacy/security work, and a working vertical demo — never just code existing. | Phase template's definition-of-done lists exact commands/evidence; PROGRESS.md marks a phase complete only with the evidence linked. | all | P02–P15 | 15 |

### 3.7 AIC — AI usage, cost & evaluation

| ID | Requirement | Acceptance criterion | Module | Phase(s) | Doc |
|---|---|---|---|---|---|
| NFR-AIC-010 | Paid and generative AI usage must be minimized: deterministic code, geometry, CV, rules, DB queries, or cached computation must be used wherever they reliably solve the problem, and every proposed AI use must be classified (necessary generative/reconstruction; conventional CV/ML; embedding/similarity; ranking/personalization; optional NL explanation; deterministic instead). | Doc 10 contains the complete AI/non-AI decision table with a classification and why-not-deterministic justification per feature; review rejects unclassified AI calls. | all | P00, P06+ | 10 |
| NFR-AIC-020 | Every AI-backed feature must specify: input/output contract with structured schema, provider abstraction/portability, on-device vs server decision, quality threshold and confidence handling, eval dataset + success metrics, and latency + cost budget. | Doc 10 has the full per-feature specification table; each AI call site validates output against its JSON schema; missing spec blocks the feature. | all | P06, P09, P11 | 10 |
| NFR-AIC-030 | The same input must never be re-sent through expensive models: hash inputs, store derived results with lineage, deduplicate, batch, preprocess, and invalidate only affected derivatives via idempotent jobs. | Re-submitting an identical photo triggers zero provider calls (cache-hit test); cache hit rate is a tracked metric (NFR-OBS-030). | `media`, `platform` | P06 | 10 |
| NFR-AIC-040 | Small/specialized models must be tried before large general models, and natural-language explanations must be generated from structured reason codes with templates as the only product path (LLM wording polish removed 2026-09-13 — DEC-46; any future NL polish needs a new doc-10 entry + eval). | Model-selection ladder documented per feature; explanation templates cover all reason codes; no LLM call exists in the explanation path. | `recommendation`, `media` | P09, P11 | 10 |
| NFR-AIC-050 | Fallback behavior must be defined for every model/provider being slow, unavailable, expensive, or low-confidence, with a human/user confirmation step wherever wrong output would harm trust. | Degrading each provider in tests produces the documented fallback (queue, cache, on-device, or G0); low-confidence classification always routes to user confirmation (REQ-CAP-060). | all | P06+ | 10 |
| NFR-AIC-060 | Prompt, model, and version tracking must make AI outputs reproducible. | Every stored AI derivation records provider, model, version, prompt/params hash; reruns with identical versions reproduce results within documented tolerance. | `media`, `recommendation` | P06+ | 10 |
| NFR-AIC-070 | Customer data must not be used for provider training by default; providers must have zero/short retention; face/body media may go only to providers passing privacy review; explicit informed consent and contracts are required for any exception. | Provider register in doc 10 records each provider's training/retention terms (as-of dated); face/body media provider list is privacy-review-approved; no-training default verified per contract. | `platform` | P00, P06+ | 10, 11 |
| NFR-AIC-080 | AI cost must be metered and observable: AI calls, tokens/GPU-seconds, cache hit rate, cost per processed item, cost per active/paid user, and failure/fallback rate. | Dashboards show each metric; per-plan cost guardrails alert on breach (REQ-BIL-100). | `billing`, `platform` | P06, P13 | 10, 14 |
| NFR-AIC-090 | Provider/model migration must be possible: no provider-specific types in the domain core; all AI providers behind owned ports with recorded replacement cost and fallback. | Arch check forbids provider SDK imports outside `platform`; provider evaluation table (doc 05/10) records lock-in, fallback, and replacement cost per provider. | `platform`, all | P02 | 05, 10 |
| NFR-AIC-100 | Every research bet (single-selfie face reconstruction, single-view missing-side synthesis, arbitrary-garment 3D reconstruction, realistic cloth fit, shared 3D engine size/battery impact) must specify user problem, hypothesis, prototype, dataset, target devices, success metric, cost limit, privacy review, fallback, and kill decision. | Doc 16 research-bet register contains all five named bets with all ten fields; no research bet blocks MVP value (REQ-CAP-140). | all | P00, P11 | 16 |

---

## 4. Brief-coverage matrix

Every section of `AI-STYLIST-FABLE-PROMPT.md` mapped to the requirement IDs that cover it. Prefixes: R = REQ, N = NFR. This table is the §13.1/§14 coverage proof; phase-writers verifying coverage start here.

| Brief section | Topic | Covering requirement IDs |
|---|---|---|
| §1 | Product vision; grounded, explainable, never invent facts | R-REC-010/020/190, R-EXP-010, R-AVA-010, R-CAP-010, R-TRD-010; docs 00 |
| §2 (intro) | Full journey incl. empty/loading/partial/failure/retry/recovery | R-ONB-130 |
| §2.1 | Onboarding and profile | R-ONB-010…130, R-ONB-120 + N-PRV-020/030/040 (consent/correction/export/deletion) |
| §2.2 | Optional selfie and personalized face | R-FAC-010…080, N-PRV-020/040/050 |
| §2.3 | Parametric 3D avatar | R-AVA-010…120, R-ONB-050, N-PERF-020/070, R-MED-100 |
| §2.4 | Virtual closet capture | R-CAP-010…140, R-MED-010…080, N-AIC-030/050 |
| §2.5 | Closet organization | R-ORG-010…120 |
| §2.6 | Daily and future outfit recommendations | R-REC-010…190, R-CTX-010…080 |
| §2.7 | Recommendation explanation and feedback | R-EXP-010…100 |
| §2.8 | Fashion intelligence | R-TRD-010…080, R-REC-160 |
| §2.9 | Future AI stylist chat | R-CHT-010…050 |
| §2.10 | Pricing and subscriptions | R-BIL-010…130 |
| §3.1 | AI as bounded capability | N-AIC-010…100 |
| §3.2 | Modular-monolith architecture, modules, single source of truth | N-TEAM-030/080, R-AVA-120; SPINE §3, doc 04 |
| §3.3 | Recommendation engine as first-class domain | R-REC-020…170, R-CTX-010/070, R-EXP-010/080/100, N-TST-100 |
| §3.4 | Event-driven extension without premature distribution | R-MED-090/110 |
| §3.5 | 3D and media asset pipeline | R-MED-010…110, R-AVA-080 |
| §3.6 | Security, privacy, and safety by design | N-SEC-010…110, N-PRV-010…110, N-AIC-070 |
| §3.7 | Performance and reliability | N-PERF-010…070, R-CAP-130, R-ORG-120 |
| §4 (intro) | Weighted decision matrices, primary sources, prototype gates | N-PERF-070; SPINE §2, doc 05 |
| §4.1 | Mobile application and 3D surface choice | N-PERF-070, R-AVA-100/120; doc 05 (native SwiftUI/Compose + Filament C++ decision, DEC-49/50; originally RN+Expo+Filament) |
| §4.2 | Linux-first development reality | N-TEAM-010 |
| §4.3 | Backend and data | N-TEAM-020/080/130, R-MED-090/110, R-CAP-120 (pgvector); doc 05 |
| §4.4 | External providers behind ports | R-CTX-020/050, R-NOT-010, N-AIC-070/090, N-OBS-040; doc 05 |
| §5.1 | Repository structure | N-TEAM-020 |
| §5.2 | Deep modules and dependency rules | N-TEAM-030, R-AVA-120, R-CHT-020 |
| §5.3 | No duplication and semantic reuse checks | N-TEAM-040 |
| §5.4 | File and script discipline; `just`; pinned tools | N-TEAM-050/060/070, N-TST-010 |
| §5.5 | Schema and generation discipline | N-TEAM-080 |
| §6 | Testing and quality strategy | N-TST-010…130, N-SEC-100 |
| §7 | Observability, analytics, and operations | N-OBS-010…090, N-PRV-080/110, N-SEC-080 |
| §8 | Small-team and AI-assisted development setup | N-TEAM-010/070/110/120/130/140, N-SEC-110 |
| §8.1 | Required `CLAUDE.md` | N-TEAM-090, N-TEAM-150 |
| §8.2 | Project-specific AI skills | N-TEAM-100 |
| §9 | Required planning deliverables | SPINE §9 file map (meta — the planning package itself); N-TEAM-110/150 |
| §10 | Phase design requirements | SPINE §5 phases; N-TEAM-160, N-OBS-090 (meta — enforced by `templates/phase.md`) |
| §11 | MVP boundaries and progressive fidelity | R-CAP-100/140, N-AIC-100, R-FAC-060; docs 00, 16 |
| §12 | Product metrics and quality bars | N-OBS-100 |
| §13 | Output quality rules | Meta-rules for authors — enforced by SPINE §10 writing rules; determinism/honesty instances: R-REC-070/190, R-FAC-060, N-PERF-060, N-AIC-010 |
| §14 | Final audit | This file §4+§5 are the audit instrument; audit executed in P00 and re-run at P14 |

Sections §9, §10, §13, §14 are instructions about the planning package itself rather than product requirements; they are satisfied by the existence and structure of `planning/` (SPINE §5/§9/§10) plus the meta-requirements cited. **No brief section is unmapped.**

---

## 5. Named-specifics coverage list

The brief's explicitly named specifics (brief §14 audit list), each with its owning requirement ID(s):

| # | Brief-named specific | ID(s) |
|---|---|---|
| 1 | Front-only capture as minimum input | REQ-CAP-030 |
| 2 | Optional back/side/detail/label/material views | REQ-CAP-040 |
| 3 | AI fills ONLY missing views, never replaces a real captured view | REQ-CAP-070 |
| 4 | Provenance marker + confidence on every generated view | REQ-CAP-080 |
| 5 | Later replacement of a generated view with a real photo | REQ-CAP-090 |
| 6 | Clothing AND shoes AND accessories all supported | REQ-CAP-010 |
| 7 | 3–4 standardized poses plus rotation/multiple viewing angles | REQ-AVA-090 |
| 8 | Predefined adjustable inclusive avatars — not two stereotypes | REQ-AVA-010, REQ-ONB-050 |
| 9 | Optional selfie face + honest accuracy levels (no "digital twin" claims) | REQ-FAC-010, REQ-FAC-060 |
| 10 | Weather, forecast, holidays, and explicit occasions as context | REQ-CTX-020…060 |
| 11 | Holiday must never cause shorts in unsafe cold (precedence rule) | REQ-REC-050, REQ-REC-040, NFR-TST-100 |
| 12 | Deterministic tie-breaks; no hidden randomness | REQ-REC-070 |
| 13 | "Never suggest this pairing" durable negative constraint | REQ-EXP-070 |
| 14 | Laundry/availability states (available/laundry/packed/lent/repair/archived) | REQ-ORG-090, REQ-REC-120 |
| 15 | Season, color, and category organization (+ richer metadata) | REQ-ORG-010/020/030/080 |
| 16 | Cost-per-wear when purchase price supplied | REQ-ORG-070 |
| 17 | Duplicate detection by visual + semantic similarity, not filename | REQ-CAP-120 |
| 18 | Offline/interrupted upload queues, resumable processing | REQ-CAP-130, REQ-ORG-120 |
| 19 | Trend-feed provenance/attribution + no unauthorized scraping | REQ-TRD-040, REQ-TRD-050 |
| 20 | Future chat reuses the same application services (no fork, no direct tables) | REQ-CHT-020 |
| 21 | 3-day trial → Free tier + 3 paid tiers | REQ-BIL-010/020/030 |
| 22 | Entitlements enforced server-side (source of truth) | REQ-BIL-040 |
| 23 | Metering of genuinely expensive operations (generative credits) | REQ-BIL-090 |
| 24 | Data safe + exportable on subscription expiry; paid assets predictable | REQ-BIL-120, NFR-PRV-030 |
| 25 | Consent, correction, export, and deletion flows | REQ-ONB-120, NFR-PRV-020/030/040 |
| 26 | Explicit age policy (never implicit) | NFR-PRV-070 |
| 27 | On-device processing preference (face, background removal) | REQ-FAC-040, NFR-AIC-010/020 |
| 28 | No body shaming, attractiveness scoring, or unsupported appearance inference | NFR-PRV-090 |
| 29 | Calendar/future context providers addable without engine redesign | REQ-CTX-070, REQ-CTX-090 |
| 30 | Every suggestion personalized, traceable, explainable, never random | REQ-REC-020/070/090, REQ-EXP-010 |
| 31 | Trends influence recommendations only after hard constraints pass | REQ-REC-160, REQ-TRD-070 |
| 32 | Valuable fallback if advanced 3D reconstruction fails its R&D gate | REQ-CAP-140, NFR-AIC-100 |
| 33 | Linux-first development + real macOS requirement for iOS delivery | NFR-TEAM-010 |
| 34 | Per-module `tests/` directories; module isolation; single sources of truth; small files; readable scripts | NFR-TST-010, NFR-TEAM-030/050/060/080 |
| 35 | `CLAUDE.md`, AI skills, progress/handoff rules | NFR-TEAM-090/100/150 |

---

## 6. Requirement counts

| Area | Count | | Area | Count |
|---|---|---|---|---|
| ONB | 13 | | SEC | 11 |
| AVA | 12 | | PRV | 11 |
| FAC | 8 | | PERF | 7 |
| CAP | 14 | | OBS | 10 |
| ORG | 12 | | TST | 13 |
| MED | 11 | | TEAM | 16 |
| CTX | 9 | | AIC | 10 |
| REC | 19 | | | |
| EXP | 10 | | | |
| TRD | 8 | | | |
| CHT | 5 | | | |
| BIL | 13 | | | |
| NOT | 3 | | | |
| **Functional** | **137** | | **Non-functional** | **78** |

**Total: 215 requirements.** Insert new requirements at unused numbers (steps of 10 leave room, e.g. `REQ-REC-085`); never renumber or reuse an ID.
