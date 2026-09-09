---
name: mobile-feature
description: Build or change React Native / Expo screens, navigation, state, offline behaviour, or platform-native bridges in apps/mobile. Use for user-facing mobile work that is not 3D rendering (native-3d-assets) and does not change API contracts (api-contract-change first).
---

# Mobile Feature Development

## Trigger

- Adding or changing screens, components, navigation, forms, camera capture UI, upload queues, offline sync, push handling, PostHog/consent wiring, or Expo config under `apps/mobile/src/{features,data,lib}/` and `apps/mobile/src/app/`.
- Adding an Expo module / Turbo module for a non-3D capability.
- Not this skill: anything under `apps/mobile/src/render/` (`native-3d-assets`); a missing endpoint (`api-contract-change` first); entitlement decisions (`entitlements-billing`).

## Required reading

1. `planning/phases/P<NN>-*.md` current phase file and `PROGRESS.md`.
2. `planning/02-user-journeys-and-information-architecture.md` — the journey and its empty/loading/partial/failure/retry/offline/accessibility states.
3. `packages/contracts/gen/ts-client/` — generated client for every endpoint used; never hand-write request/response types.
4. `apps/mobile/src/app/_root.tsx` (composition root), the `README.md` in `apps/mobile/src/{features,data,lib}/`, and existing screens in the same navigator.

## Workflow

1. Restate the user-visible outcome and every UI state in scope; the journeys doc defines them — do not invent or skip states.
2. Search before write: existing components, hooks, validators, error patterns. One copied look-alike component is a defect.
3. UI-layer code only: no business rules in components or hooks (CLAUDE.md "No domain logic in adapters"); decisions come from the API. Constants from `packages/shared-kernel` via imports, never re-declared. Mobile imports only `packages/contracts` and `packages/shared-kernel` from the workspace (`mobile/workers-not-server`).
4. Contract missing? Stop → `api-contract-change`, then return.
5. Adapters (API client, local DB, upload queue, consent context) are constructed only in `_root.tsx` (`composition-root-only`).
6. Accessibility by default: labels, roles, dynamic type, touch targets ≥ 44pt, reduced motion.
7. Analytics events must exist in the taxonomy schema (`packages/contracts`); PostHog stays behind the consent stub (default off). No sensitive data in events or crash breadcrumbs.
8. New native module, permission, or native config → the release cannot ship OTA (doc 15 §10); flag it in the PR.
9. Tests: Jest + RN Testing Library with MSW in a `tests/` directory next to the feature (test-placement lint); Maestro flows in `apps/mobile/e2e/`. Behaviour-level assertions, not snapshot-everything.

## Validation commands

```bash
just test                             # no scoped mobile recipe in the doc 15 §5 catalog; full suite
just lint && just typecheck && just arch-check
just dev-mobile --android             # device/emulator run; describe what you verified
just generate --check                 # if a contract change preceded this work
```

Camera/upload/offline work: verify on a physical Android device (`adb devices`) and say so.

## Output

- PR: screens/states implemented, screenshot or recording per major state (no real user photos or measurements in captures), test output, OTA-compatibility note (JS-only vs native).

Done checklist: every journey state handled · types from generated client · no business logic in UI · a11y checks done · tests in `tests/` · device verification described honestly · `PROGRESS.md` updated.

## Stop / escalation

- Contract missing or wrong → `api-contract-change`.
- Task pulls recommendation logic, entitlement decisions, or pipeline states into the client → stop; server-owned.
- iOS-specific behaviour cannot be verified on Linux → implement, then hand off for a TestFlight/`internal` check; never claim iOS verified without a build (CLAUDE.md "Honesty about results").

## Overlap

Adjacent: `native-3d-assets` (everything under `src/render/` and designated 3D screens), `api-contract-change` (endpoint shapes), `entitlements-billing` (paywall reads entitlements only), `performance-profiling` (startup/interaction budgets), `release-readiness` (OTA legality).
