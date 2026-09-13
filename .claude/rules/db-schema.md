---
paths:
  - "**/internal/schema.ts"
  - "packages/db/**"
---

# Drizzle schema and migrations

**Skill:** `db-migration`.

**Agent:** the owning module's usual agent writes `modules/<name>/internal/schema.ts` (e.g. `api-engineer` for `closet`);
`platform-engineer` owns the composed entry and migration config in `packages/db/`.

**Proof:** `just db-generate <name>` (never call `drizzle-kit` directly), then
`just db-reset --yes && just db-migrate && just db-seed`, `just db-rollback --yes && just db-migrate`
(round-trip), then `just test api`.

**Invariants that bite here:**
1. Expand → migrate → contract, never a same-release drop/rename — no automated check; a reviewer verifies
   the migration is additive and a rollback file exists (`packages/db/migrations/down/`).
2. Every table is defined in its owning module's `modules/<name>/internal/schema.ts`, composed once in `packages/db/` —
   never a duplicate column/enum for a concept `closet` or `shared-kernel` already owns.
3. `just db-reset` outside local is prohibited without explicit human authorization (root `CLAUDE.md`
   "Prohibited without explicit human authorization"); generate migrations only via `just db-generate
   <name>`, never the underlying ORM CLI directly — `docs-check` DC-11.
