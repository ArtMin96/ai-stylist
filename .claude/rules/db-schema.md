---
paths:
  - "apps/api/src/modules/*/internal/schema.ts"
  - "packages/db/**"
  - "apps/api/tests/migrations/**"
---

# Drizzle schema and migrations

**Skill:** `db-migration`.

**Agent:** the module's agent writes `apps/api/src/modules/<name>/internal/schema.ts` (`api-engineer`, or
`recommendation-engineer` for recommendation, outfit, context and fashion-intel). `platform-engineer`
owns `packages/db/**` (composed schema entry, migrations, down files) and `apps/api/tests/migrations/**`.

**Proof:** `just db-generate <name>`, then `just db-reset --yes && just db-migrate && just db-seed`, then
`just db-rollback --yes && just db-migrate` (round trip), then `just test api`, which runs
`apps/api/tests/migrations/` and needs Docker.

**Invariants that bite here:**
1. Expand → migrate → contract; never a same-release drop or rename. Every forward migration has a
   rollback file in `packages/db/migrations/down/` (reviewer-checked).
2. Every table is defined in its owning module's `apps/api/src/modules/<name>/internal/schema.ts` and
   composed once in `packages/db/`; never a duplicate column or enum for a concept `closet` or
   `shared-kernel` already owns (reviewer-checked).
3. `packages/db/migrations/meta/` is written by `just db-generate` only — the PreToolUse path guard
   `scripts/hooks/guard-protected-paths.sh` denies hand edits.
4. Migrations come only from `just db-generate <name>`, never the ORM CLI — `docs-check` DC-11 in
   skills, agents and rules; `scripts/hooks/guard-bash.sh` denies the ORM CLI's `push` subcommand.
5. `just db-reset` runs against a local database only — `packages/db/scripts/reset.ts` refuses a
   non-local `DATABASE_URL`, and root `CLAUDE.md` prohibits it elsewhere without human authorization.
