---
paths:
  - "apps/mobile/src/**"
---

# Mobile app (Expo / React Native)

**Skill:** `mobile-feature` (contract shape changes go through `api-contract-change` first; `src/render/**`
is covered by `render-3d.md`, not this file).

**Agent:** `mobile-engineer`.

**Proof:** `just test mobile`, then `just lint && just typecheck && just arch-check`.

**Invariants that bite here:**
1. Only `src/render/**` and `src/features/avatar/**` may import Filament or `src/render/**` — depcruise
   `render-boundary` fails any other file that reaches into the render layer.
2. From the workspace, mobile imports only `packages/contracts` and `packages/shared-kernel` — depcruise
   `mobile-workers-not-server` fails an import of another `apps/*` or `packages/db`.
3. Test files outside a tests/ directory fail eslint's quality/test-placement rule; Maestro flows in
   `apps/mobile/e2e/**` are the documented exception (see `tests.md`).
