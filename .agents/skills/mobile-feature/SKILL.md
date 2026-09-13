---
name: mobile-feature
description: Build or change React Native / Expo screens, navigation, forms, camera capture UI, offline sync, push handling, or PostHog/consent wiring under apps/mobile/src/features/, apps/mobile/src/data/, apps/mobile/src/lib/, and apps/mobile/src/app/. Use for expo-router routes, RNTL component work, a new non-3D Expo/Turbo module, or "screen", "navigation", "offline queue" tasks. Not for anything under apps/mobile/src/render/ or a designated 3D screen — use `native-3d-assets`; not for a missing or changed endpoint — use `api-contract-change` first; not for Maestro/e2e flows under apps/mobile/e2e/ — use `e2e-device-testing`.

metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: mobile-engineer
---

# Mobile Feature Development

## Trigger

- Adding or changing screens, components, navigation, forms, camera capture UI, upload queues, offline sync, push handling, PostHog/consent wiring, or Expo config under `apps/mobile/src/features/`, `apps/mobile/src/data/`, `apps/mobile/src/lib/`, and `apps/mobile/src/app/`.
- Adding an Expo module / Turbo module for a non-3D capability.
- Not this skill: anything under `apps/mobile/src/render/` or a designated 3D screen under `apps/mobile/src/features/avatar/**` (`native-3d-assets`); a missing endpoint (`api-contract-change` first); entitlement decisions (`entitlements-billing`); Maestro flows under `apps/mobile/e2e/` (`e2e-device-testing`).

## Required reading

1. `planning/phases/P<NN>-*.md` current phase file and `PROGRESS.md`.
2. `planning/02-user-journeys-and-information-architecture.md` — the journey and its empty/loading/partial/failure/retry/offline/accessibility states.
3. `packages/contracts/gen/ts-client/` — generated client for every endpoint used; never hand-write request/response types.
4. `apps/mobile/src/app/_layout.tsx` (composition root; expo-router names the root layout `_layout.tsx`), `apps/mobile/src/features/README.md`, `apps/mobile/src/data/README.md`, `apps/mobile/src/lib/README.md`, and existing screens in the same navigator.

## Workflow

1. Restate the user-visible outcome and every UI state in scope; the journeys doc defines them — do not invent or skip states.
2. Search before write: existing components, hooks, validators, error patterns. One copied look-alike component is a defect.
3. UI-layer code only: no business rules in components or hooks (CLAUDE.md "No domain logic in adapters"); decisions come from the API. Constants from `packages/shared-kernel` via imports, never re-declared. Mobile imports only `packages/contracts` and `packages/shared-kernel` from the workspace (`mobile-workers-not-server`).
4. Contract missing? Stop → `api-contract-change`, then return.
5. Adapters (API client, local DB, upload queue, consent context) are constructed only in `_layout.tsx` (`composition-root-only`).
6. Accessibility by default: labels, roles, dynamic type, touch targets ≥ 44pt, reduced motion.
7. Analytics events must exist in the taxonomy schema (`packages/contracts`); PostHog stays behind the consent stub (default off). No sensitive data in events or crash breadcrumbs.
8. New native module, permission, or native config → the release cannot ship OTA (doc 15 §10); flag it in the PR.
9. Tests: Jest + RN Testing Library with MSW in a tests directory (test-placement lint) next to the feature, e.g. `apps/mobile/src/features/<x>/tests/`. Behaviour-level assertions, not snapshot-everything. Tests never live under `apps/mobile/src/app/` — expo-router bundles every file there. Maestro flows in `apps/mobile/e2e/` are a different skill (`e2e-device-testing`) — write the screen so it is reachable by testID/accessibility label, then hand off.

## Validation commands

```bash
just test mobile                      # Jest + RNTL + MSW
just lint && just typecheck && just arch-check
just dev-mobile --android             # device/emulator run; describe what you verified
just generate --check                 # if a contract change preceded this work
```

Camera/upload/offline work: verify on a physical Android device (`adb devices`) and say so.

## Output

- PR: screens/states implemented, screenshot or recording per major state (no real user photos or measurements in captures), test output, OTA-compatibility note (JS-only vs native).

Done checklist: every journey state handled · types from generated client · no business logic in UI · a11y checks done · tests placed next to the feature · device verification described honestly · `PROGRESS.md` updated.

## Stop / escalation

- Contract missing or wrong → `api-contract-change`.
- Task pulls recommendation logic, entitlement decisions, or pipeline states into the client → stop; server-owned.
- A Maestro/e2e flow needs adding or changing → `e2e-device-testing` (agent: `test-engineer`), not this skill.
- iOS-specific behaviour cannot be verified on Linux → implement, then hand off for a TestFlight/`internal` check; never claim iOS verified without a build (CLAUDE.md "Honesty about results").

## Overlap

Adjacent: `native-3d-assets` (everything under `apps/mobile/src/render/` and designated 3D screens under `apps/mobile/src/features/avatar/**`), `api-contract-change` (endpoint shapes), `entitlements-billing` (paywall reads entitlements only), `e2e-device-testing` (Maestro flows in `apps/mobile/e2e/`; agent `test-engineer`), `performance-profiling` (startup/interaction budgets), `release-readiness` (OTA legality).
