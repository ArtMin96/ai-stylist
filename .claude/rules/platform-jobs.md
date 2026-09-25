---
paths:
  - "apps/api/src/platform/**"
  - "apps/api/src/jobs/**"
  - "packages/seed-data/**"
  - "docker-compose.yml"
---

# Platform adapters, pg-boss jobs, seed data, local services

**Skill:** `backend-module` for port adapters under `apps/api/src/platform/`; `media-ml-pipeline` for
pg-boss job definitions under `apps/api/src/jobs/` that drive asset or ML processing; `db-migration`
for seed data.

**Agent:** `platform-engineer` (the Python worker a job calls → `ml-engineer`).

**Proof:** `just test platform` for `apps/api/src/platform/**`; `just test api` for
`apps/api/src/jobs/**`, whose handler tests live in `apps/api/src/jobs/tests/**` (collected by the
vitest `src/**/tests/**` glob); `just db-reset --yes` (drops, migrates and reseeds the local database)
for `packages/seed-data/**`; `just dev-api` for `docker-compose.yml`; then
`just lint && just typecheck && just arch-check`.

**Invariants that bite here:**
1. `apps/api/src/platform/**` depends only on `packages/shared-kernel/`, `packages/contracts/` and provider
   SDKs — depcruise `platform-leaf` (`just arch-check`).
2. Only the composition roots (`apps/api/src/app.module.ts`, `apps/api/src/main.ts`,
   `apps/api/src/jobs/**`) import platform adapters or `packages/db/`; `apps/api/src/dev/**`,
   `apps/api/tests/**` and the seed CLI `packages/seed-data/scripts/seed.ts` are the other allowed
   importers — depcruise `composition-root-only`.
3. Domain modules never import `platform`; they use ports bound at the composition root — depcruise
   `modules-not-platform`.
4. Provider SDKs (`pg-boss`, `@aws-sdk/*`, `@cloudflare/*`, `@fal-ai/*`, `posthog-*`, `@sentry/*`,
   `firebase-admin`) are imported only here — depcruise `domain-no-provider-sdk` on the module side.
5. A new port interface is declared by the consuming module (or `packages/shared-kernel/`), never under
   `apps/api/src/platform/ports/`; that directory and `InMemoryStorageProvider` are P02-interim layout,
   not a pattern to copy (reviewer-checked).
6. Seed data is synthetic, never copied from production (root `CLAUDE.md` "Security and privacy
   rules") (reviewer-checked).
7. A module test in `apps/api/src/modules/<name>/tests/` never imports `packages/db/` — depcruise `composition-root-only` (`just arch-check`). A task that needs a Postgres-backed repository test for a module is a stop for the lead (open question in `.claude/plans/s6-claude-foundation-human-proposals.md` §C2 (b)).
