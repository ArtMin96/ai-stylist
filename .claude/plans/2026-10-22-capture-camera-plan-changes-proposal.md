# Proposal — planning changes for the guided capture camera

> Status: APPLIED (2026-10-22) on feat/capture-camera
> Drafted 2026-10-21. Source: 3D research artifact (claude.ai/artifact/EQxFSEvXcBBJFFDAavWxHj) §15 rows 43–48,
> the owner's answers Q5, Q14–Q17 and the underwear opt-in (artifact §14, all 2026-10-21), and the
> owner's answers of 2026-10-22 (brief §16; Q-A (b) adds the worn-mode body check).
> Companion: `.claude/plans/2026-10-22-capture-camera-brief.md` (the build brief).

`planning/**` is human-only (`.claude/rules/human-only.md`). The owner authorized the lead session to
apply exactly these diffs on `feat/capture-camera` (brief §16, 2026-10-22). Every `-` line was copied
from `origin/main` @ `846fd06` and re-checked verbatim on 2026-10-22 before applying. The DEC in §7
stays a draft for the owner; it is not added to doc 16.

## 1. Row 43 — a bad photo cannot be taken (Q14, Q15)

### 1a. `planning/02-user-journeys-and-information-architecture.md` §6.1 step 3

```diff
-3. **Instant local feedback:** on-device background removal preview + quality check (blur, lighting, garment fully in frame). Failures → specific retake guidance; user may **keep anyway** (override).
+3. **Live checks, then local feedback:** before the shot, live on-device checks lock the shutter until an item is found, fully in frame (in worn mode: the needed body parts in frame), big enough and held steady; light and tilt are hints only; the category never locks (DEC pending, Q14/Q15). The camera takes the photo itself once steady; "Take photo anyway" appears after 10 s, and at once with a screen reader. After the shot: on-device background removal preview + the same checks on the full photo; failures → specific retake guidance; user may **keep anyway** (override).
```

### 1b. `planning/phases/P06-closet-capture-pipeline.md` §5, "Single capture loop" row

```diff
-| Single capture loop | Camera + framing guide → front photo → on-device cutout preview + quality check → auto-classification → one-card confirm → saved; item visible immediately in `processing` visual state | First capture ever → one-time inline coach marks (dismiss-forever) | Blur/lighting fail → specific retake guidance with **keep anyway** override; processing failure → tile "needs attention" with cause + retry/retake/edit/delete | Full loop works offline: photo, local cutout, provisional category; item marked "waiting to sync" | Camera screen fully labeled; capture triggerable via accessibility action; review card screen-reader complete; confidence conveyed in text |
+| Single capture loop | Category pick (or "Not sure") → camera with the shape-family guide → live checks lock the shutter until the item is found, fully in frame (worn mode: the needed body parts in frame), big enough and steady → auto-capture after ~1.5 s steady → "Is the back different?" → on-device cutout preview + quality check → auto-classification → one-card confirm → saved; item visible immediately in `processing` visual state | First capture ever → one-time inline coach marks (dismiss-forever) | Live: "Take photo anyway" after 10 s locked. Post-shot: blur/lighting fail → specific retake guidance with **keep anyway** override; processing failure → tile "needs attention" with cause + retry/retake/edit/delete | Full loop works offline: live checks, photo, local cutout, provisional category; item marked "waiting to sync" | Camera screen fully labeled; spoken one-step hints; manual shutter and "Take photo anyway" reachable from the start with a screen reader; hardware shutter buttons lock with the on-screen one; review card screen-reader complete; confidence conveyed in text |
```

## 2. Row 44 — category picked first (Q16)

### 2a. `planning/02-user-journeys-and-information-architecture.md` §6.1 step 4

```diff
-4. **Auto-classification:** category + attributes proposed with confidence; user confirms or corrects in a single compact review card (category, color, season chips). Correction here is the primary taxonomy-quality input — see [08-closet-taxonomy-and-organization.md](08-closet-taxonomy-and-organization.md).
+4. **Auto-classification:** the category the user picked before the shot is the draft category; with "Not sure", the category is proposed with confidence as before. Attributes are proposed with confidence; the server check may only ask "Is this a <category>?" and the user's answer wins. The user confirms or corrects in a single compact review card (category, color, season chips). Correction here is the primary taxonomy-quality input — see [08-closet-taxonomy-and-organization.md](08-closet-taxonomy-and-organization.md).
```

`planning/01-requirements-and-traceability.md` REQ-CAP-060 needs no change: the confirmation step
stays.

## 3. Row 45 — batch keeps the generic guide (Q16)

### 3a. `planning/02-user-journeys-and-information-architecture.md` §6.2, first bullet

```diff
-- Rapid-fire mode: shoot many items consecutively; review happens afterward as a swipeable stack of confirmation cards.
+- Rapid-fire mode: shoot many items consecutively with the generic guide and the same live checks, no category tap per item; review happens afterward as a swipeable stack of confirmation cards.
```

### 3b. `planning/02-user-journeys-and-information-architecture.md` §6.2, second bullet (Q17)

```diff
-- Import from photo library with multi-select; each import runs the same quality checks.
+- Import from photo library with multi-select; each import runs the same quality checks after import, as tips with "keep anyway" (imports are never refused; the library is the way out for anyone the live camera locks).
```

## 4. Row 46 — guides per shape family, worn mode, category picker

### 4a. `planning/02-user-journeys-and-information-architecture.md` §6.1 step 1

```diff
-1. **Capture screen:** live camera with framing guide, background hint ("plain background works best"), flat-lay or hanging both supported. Front photo is the only required input.
+1. **Capture screen:** the user first picks a category (single capture only; "Not sure" keeps the generic guide). Live camera with one guide per shape family (top, long bottom, short bottom and skirt, one-piece, outerwear, shoes, bag, small item), background hint ("plain background works best"), and a mode switch: flat-lay, hanger, worn. Worn mode turns the edge rule off and instead locks the shutter until the body parts the garment needs are in frame (for example both shoulders and both hips for a top), checked on device by the platform's body-pose model. Underwear and swimwear get worn mode only after a one-time opt-in, off by default. Front photo is the only required input.
```

### 4b. `planning/02-user-journeys-and-information-architecture.md` §6.1 step 2 (Q5)

```diff
-2. **Optional extra views:** back, side, detail, label, material — offered as one-tap chips after the front shot, all skippable.
+2. **Optional extra views:** after the front shot the app asks once "Is the back different?" (default "Same"); "Different" reopens the camera with the back guide, skippable. Side, detail, label, material — offered as one-tap chips after the front shot, all skippable.
```

### 4c. `planning/phases/P06-closet-capture-pipeline.md` §12, tasks T04, T09, T10

```diff
-| P06-T04 | On-device segmentation bridge (Apple Vision / ML Kit) + local quality checks + cutout preview | — | 2 |
+| P06-T04 | On-device segmentation bridge (Apple Vision / ML Kit) + live capture checks and shutter lock, including the worn-mode body-part check (Apple Vision body pose / ML Kit Pose Detection) (brief `.claude/plans/2026-10-22-capture-camera-brief.md`) + post-shot quality checks + cutout preview | — | 4 |
```

```diff
-| P06-T09 | Capture UX: single fast loop + optional view chips + review card with confirm-all/pickers | P06-T04, P06-T08 | 2 |
+| P06-T09 | Capture UX: category picker + shape-family guides + single fast loop + back-photo question + optional view chips + review card with confirm-all/pickers | P06-T04, P06-T08 | 3 |
```

```diff
-| P06-T10 | Batch capture + library import + pending-review stack + "accept all high-confidence" | P06-T09 | 2 |
+| P06-T10 | Batch capture (generic guide, live checks, no category tap) + library import (post-import tips with "keep anyway") + pending-review stack + "accept all high-confidence" | P06-T09 | 2 |
```

### 4d. `planning/phases/P06-closet-capture-pipeline.md` §11, product analytics line

```diff
-- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `capture_started` (`mode`), `item_captured` (`mode`, `retake_count`), `item_processing_completed` (`duration_bucket`, `auto_category_confidence_bucket`), `item_processing_failed` (`stage`, `reason_code`), `item_attributes_corrected` (`fields_corrected_count`, `field_types`).
+- Product analytics events (taxonomy per [14 §9](../14-observability-operations-and-analytics.md)): `capture_started` (`mode`, `shape_family`, `capture_mode`), `item_captured` (`mode`, `retake_count`, `trigger`, `shape_family`, `capture_mode`, `side`, `time_to_capture_ms`, `screen_reader_on`), `capture_shutter_unlocked` (`shape_family`, `capture_mode`, `time_to_unlock_ms`), `capture_anyway_shown` (`shape_family`, `capture_mode`, `lock_reason`), `capture_abandoned` (`shape_family`, `capture_mode`, `last_hint`, `time_open_ms`), `capture_back_answered` (`shape_family`, `back_different`), `capture_import_checked` (`tip_count`, `kept_anyway`), `item_processing_completed` (`duration_bucket`, `auto_category_confidence_bucket`), `item_processing_failed` (`stage`, `reason_code`), `item_attributes_corrected` (`fields_corrected_count`, `field_types`).
```

The P06 line names properties, not their values, so `capture_anyway_shown.lock_reason` needs no
value list here. Its values (`no-item`, `cut-off`, `body-parts-missing`, `too-small`, `not-steady`)
are in the brief §9 and land in `packages/contracts/events/analytics/events.json`.

## 5. Row 47 — doc 10 row for the live checks

### 5a. `planning/10-ai-usage-cost-and-evaluation.md` §2, row 11

```diff
-| 11 | Image quality checks (blur, exposure, framing) | DET | No | Laplacian variance / histogram heuristics on device |
+| 11 | Image quality checks (blur, exposure, framing) | DET | No | Laplacian variance / histogram heuristics on device; live "item found / fully in frame / big enough / steady" rules run on the item outline from the platform's on-device model (Apple Vision foreground instance mask; Google ML Kit Object Detection, bundled, single object, stream mode). In worn mode a second platform model checks that the needed body parts are in frame: Apple Vision body pose (built in) / Google ML Kit Pose Detection (bundled base model), on device. $0, no provider, no data leaves the phone. Fallback when a platform model is unavailable or too slow: no lock, tips only, "Take photo anyway" at once. Eval: the capture frame set (misses = 0; false locks ≤ 10 %) and the device test of artifact §13 |
```

The rules are deterministic; only the item outline and, in worn mode, the body keypoints come from
platform models. No new provider, contract or consent purpose (artifact §17.8, "Privacy: none new").
ML Kit Pose Detection (`com.google.mlkit:pose-detection:18.0.0-beta5`, base model, about +10.1 MB)
is the one new Android library; the owner approved it on 2026-10-22 (Q-A (b)).

## 6. Row 48 — the shutter stays reachable with a screen reader

### 6a. `planning/02-user-journeys-and-information-architecture.md` §13.2, "Capture" row

```diff
-| **Capture** | Voice-over capture flow with audible framing feedback; batch review cards navigable sequentially; quality warnings announced |
+| **Capture** | Voice-over capture flow with audible framing feedback, one instruction at a time; a manual shutter ("Take photo anyway") is reachable from the start with VoiceOver/TalkBack; no capture timeout; photo-library import always one tap away; batch review cards navigable sequentially; quality warnings announced |
```

## 7. Decision log

A new DEC in `planning/16-risks-open-questions-and-decision-log.md` should record the owner's
answers Q5, Q8, Q14–Q19 and the underwear worn-mode opt-in of 2026-10-21 (artifact §14), and the
answers of 2026-10-22 (brief §16), so the rows above rest on a recorded decision. Its number and
wording are the owner's. It is not added to doc 16 by this proposal.

### 7a. Draft wording for the owner (not applied)

The row follows the doc 16 table (`| DEC | Decision | Rationale | Source |`). `DEC-NN` is a
placeholder; the owner picks the number.

```
| DEC-NN | **(2026-10-22) Guided capture camera, version 1.** Single capture: the user picks a category first, or "Not sure" (generic guide); the camera shows one guide per shape family (top, long bottom, short bottom and skirt, one-piece, outerwear, shoes, bag, small item) with flat-lay, hanger and worn modes. Live on-device checks lock the shutter until the item is found, fully in frame, big enough and steady; in worn mode the edge rule is off and the shutter locks instead until the body parts the garment needs are in frame. Light and tilt are hints only, and the category never locks (Q14 (a), Q15 (a)). The camera takes the photo itself once steady; "Take photo anyway" appears after 10 s, and at once with a screen reader (Q14 (a)). Batch keeps the generic guide with no category tap and no back question (Q16 (a), Q-C (a)). Library imports get the same checks as tips with "keep anyway", and are never refused (Q17 (a)). After the front photo the app asks once "Is the back different?" (default "Same"); for shoes it asks "Add a photo of the pair?" through the same step (Q5 (a), Q-D (a)). Worn photos of underwear and swimwear appear only after a one-time opt-in, off by default, stored on the device only; it passes the `security-privacy-review` skill before it ships. Spoken hints only with VoiceOver/TalkBack on, plus a speaker button for anyone else (Q-B (a)). On the camera branch the entry point is an "Add item" button on the Home placeholder in Dev builds only (Q-F (a)). The Galaxy A12 class (Android 10, minSdk 29) is the floor phone the camera is sized and tested for (Q8 (a)). Android libraries approved on the camera branch: CameraX 1.6.x, ML Kit Object Detection 17.0.x and ML Kit Pose Detection base 18.0.0-beta5 (Q-A (b), 2026-10-22); iOS uses Apple Vision only. The patent check covers the camera and stays a pre-launch item for whichever market comes first; it does not hold up the build (Q18). The camera is built now in small versions, each tried on a Galaxy A12-class phone and an iPhone 11; a version the cheapest phones cannot run, or that users find annoying, is dropped or reworked (Q19). Outside the log it changes doc 02 §6.1, §6.2 and §13.2, doc 10 §2 row 11, and P06 §5, §11 and §12 (T04, T09, T10) | Not all users take good photos, and a bad photo spoils the cut-out, the labels and the recommendations. No vendor sells a guided camera for clothes, so it is built from the platforms' free on-device models; the rules stay deterministic and no photo leaves the phone. A locked shutter with a timed way out follows the ID-scanning apps the research found, and keeps the camera usable for blind users and in hard cases | Owner answers Q5, Q8, Q14–Q19 and the underwear opt-in (2026-10-21, research artifact §14); owner answers Q-A (b), Q-B (a), Q-C (a), Q-D (a), Q-F (a) (2026-10-22, `.claude/plans/2026-10-22-capture-camera-brief.md` §16); `.claude/plans/2026-10-22-capture-camera-plan-changes-proposal.md` |
```

A second draft row, for ADR-0012 (owner-approved 2026-10-22, security finding B1):

```
| DEC-NN | **(2026-10-22) ML Kit's usage-reporting channel is off on Android.** The app manifest removes the `datatransport` CCT backend's registration (`backend:com.google.android.datatransport.cct.CctBackendFactory`, `tools:node="remove"`); the runtime stays because ML Kit needs it, and `just android-check` fails if the registration returns in the release manifest. ML Kit object and pose detection still run on device. Model-update and accelerator allow-list downloads from Google remain possible; a device network capture is device-only. Rejected: accepting Google as a processor of usage data; dropping ML Kit | The capture camera uses no AI provider and keeps photos and results on the phone (doc 10 row 11); ML Kit's usage reports would make Google an unnamed processor of usage data the product does not need | Owner decision 2026-10-22; `docs/adr/0012-ml-kit-usage-reporting-off.md`; emulator evidence 2026-10-22 (probe: object and pose detection run; logcat: "Transport backend 'cct' is not registered", "Unknown backend … deleting event batch") |
```
