# `src/lib` — cross-cutting app infrastructure

Small, framework-adjacent building blocks that `src/app/_layout.tsx` (the composition root)
assembles into the `AppServices` every screen reads via `useAppServices()`. Nothing here talks to
the backend directly (that's `src/data`) or renders UI (that's `src/features`).

- `config.ts` — reads and validates `EXPO_PUBLIC_*` env vars into a typed `MobileConfig`
  (`parseConfig` is the pure validator; `readPublicEnv()` isolates the literal
  `process.env.EXPO_PUBLIC_*` member accesses Expo's inliner requires). Only `_layout.tsx` calls
  `readPublicEnv()`; everything else receives `MobileConfig` as a value.
- `analytics/` — the `Analytics` port (`port.ts`) and its P02 consent-gated no-op sink
  (`consent-stub.ts`), re-exported from `index.ts`. Consent defaults to off; nothing reaches a
  sink until `setConsent(true)`. Product code depends on the `Analytics` type only — the
  composition root picks the implementation, and every event name must exist in the analytics
  taxonomy schema in `packages/contracts` (`mobile-feature` skill, doc 11).
- `app-services.tsx` — the `AppServicesContext` / `useAppServices()` pair that hands the
  composition root's adapters (config, API client, analytics) down to screens without prop
  drilling. Only `_layout.tsx` (and tests) construct an `AppServices` value.

Rules (CLAUDE.md, `mobile-feature` skill):

- **`composition-root-only`:** adapters are constructed in `src/app/_layout.tsx` only; code here
  defines the shapes (`MobileConfig`, `Analytics`) and pure helpers, never a concrete network or
  SDK call.
- No business rules live here — this layer is infrastructure plumbing, not decision-making;
  decisions come from the API via `src/data`.
- `EXPO_PUBLIC_*` values are inlined into the JS bundle at build time: never put a secret behind
  one, and never read `process.env` outside `config.ts`'s `readPublicEnv()`.
- Tests live in a `tests/` directory next to the code they cover (`config.test.ts` in
  `src/lib/tests/`, analytics tests in `src/lib/analytics/tests/`) — test-placement lint.
