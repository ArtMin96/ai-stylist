# `src/data` — data layer

The only place mobile code talks to the backend.

- Imports from the workspace: `@ai-stylist/contracts` (generated hey-api client + types) and
  `@ai-stylist/shared-kernel` (units, IDs, reason codes, entitlement names) — nothing else
  (`mobile/workers-not-server` rule; enforced by `no-restricted-imports` here and by
  dependency-cruiser in T06). Never import `apps/api`, `packages/db`, or any server internal.
- Never hand-write request/response types: regenerate with `just generate`.
- Functions here translate transport results into UI-friendly shapes (success/failure unions);
  they contain no business rules. Decisions come from the API.
- Every call receives its `ApiConfig` (base URL, fetch) from the composition root
  (`src/app/_layout.tsx`); modules here never read env or construct clients themselves.
