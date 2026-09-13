---
paths:
  - "apps/api/src/platform/**"
  - "apps/api/src/jobs/**"
---

# Platform adapters and pg-boss jobs

**Skill:** `backend-module` for port adapters under `platform/**`; `media-ml-pipeline` for job definitions
under `jobs/**` that drive asset/ML processing.

**Agent:** `platform-engineer` (jobs that are ML/media pipelines → `ml-engineer`).

**Proof:** `just test platform` for `platform/**`; `just test api` for `jobs/**` (no dedicated test dir
yet — job handler tests land under `apps/api/tests/`), then `just lint && just arch-check`.

**Invariants that bite here:**
1. `platform/**` depends only on `shared-kernel`, `packages/contracts`, and provider SDKs — depcruise
   `platform-leaf`; a domain-module import here fails `just arch-check`.
2. Only composition roots (`apps/api/src/jobs/**`, `app.module.ts`, `main.ts`, plus `platform/**` itself
   and `apps/api/tests/**`) may import `platform` adapters or `packages/db` — depcruise
   `composition-root-only`.
3. Domain modules never import `platform` directly, only its ports bound at the composition root —
   depcruise `modules-not-platform`.
