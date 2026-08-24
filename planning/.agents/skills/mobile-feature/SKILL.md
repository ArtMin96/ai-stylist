---
name: mobile-feature
description: Build or change React Native / Expo mobile screens, navigation, state, offline behavior, or platform-native bridges in apps/mobile. Use for any user-facing mobile work that is NOT 3D rendering (use native-3d-assets) and does NOT change API contracts (do api-contract-change first if it does).
---

# Mobile Feature Development

## Trigger

- Adding/changing screens, components, navigation, forms, camera capture UI, upload queues, local storage/offline sync, push-notification handling, or Expo config in `apps/mobile`.
- Adding a platform-native bridge (Expo module / Turbo module) for a non-3D capability.

**Not this skill:** Filament/avatar/garment rendering or 3D assets (`native-3d-assets`); anything requiring a new/changed server endpoint (`api-contract-change` first, then return here); paywall/entitlement UI logic (`entitlements-billing`).

## Required reading

1. Current phase file + `PROGRESS.md`.
2. `planning/02-user-journeys-and-information-architecture.md` — the journey this screen belongs to, including empty/loading/failure/offline/retry states.
3. `packages/contracts` generated client for every endpoint used — never hand-write request/response types.
4. Existing screens in the same navigator + shared UI components (semantic reuse check).

## Workflow

1. Restate the user-visible outcome and every UI state (empty, loading, partial, error, retry, offline, accessibility) in scope. Journeys doc defines these — do not invent or skip states.
2. Semantic reuse check: existing components, hooks, form validators, and error-handling patterns first. UI kit and shared hooks live where the mobile app's structure docs say; one look-alike component copied is a defect.
3. Implement UI-layer code only: no business rules in components/hooks — decisions come from the API or shared, contract-derived logic. Domain constants come from `shared-kernel` via generated packages, never re-declared.
4. Types from the generated client; if the contract lacks something, stop → `api-contract-change`.
5. Accessibility is in scope by default: labels, roles, dynamic text, touch targets ≥ 44pt, reduced-motion respect.
6. New native module or permission? That changes the native build: flag in PR that this release cannot ship OTA (doc 15 §10) and update app config + store privacy declarations notes.
7. Tests in `apps/mobile/tests/` (component + integration per doc 13): behavior-level (render states, interaction outcomes), not snapshot-everything.

## Validation

```bash
just test mobile
just lint && just typecheck
just arch-check                 # mobile must not import server internals
just dev-mobile --android       # manual verification on device/emulator — describe what you verified
```

For camera/upload/offline work, verify on a physical Android device (`adb devices`), not only the emulator, and say so in the PR.

## Output

- PR with: screens/states implemented, screenshot or screen recording per major state, test evidence, note on OTA-compatibility (JS-only vs native change).
- `PROGRESS.md` updated.

## Stop / escalate

- Contract missing or wrong for the UI's needs → stop, switch to `api-contract-change`.
- The task pulls you into recommendation logic, entitlement decisions, or media-pipeline states client-side → stop; that logic is server-owned. Ask.
- iOS-specific native behavior you cannot verify from Linux → implement, then explicitly hand off for a TestFlight/`internal`-channel check; never claim iOS verified without a build.
