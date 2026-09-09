---
name: db-migration
description: Change the PostgreSQL schema with Drizzle — tables, columns, indexes, pgvector indexes, backfills — and their migrations and rollbacks. Use whenever a change touches a modules/<name>/internal/schema.ts file, packages/db/, or produces a drizzle-kit migration.
---

# Database Schema and Migrations

## Trigger

- Any edit to `apps/api/src/modules/<name>/internal/schema.ts`, the composed schema entry or drizzle-kit config in `packages/db/`, any file in `packages/db/migrations/`, a backfill script, or a pgvector column/index.
- Not this skill: repository/query logic with no schema change (`backend-module`); wire schemas (`api-contract-change`).

## Required reading

1. `planning/06-data-api-and-event-contracts.md` — expand → migrate → contract policy, consistency rules, deletion propagation, naming.
2. `docs/modules/<owning module>.md` "Owned data" — the module that owns the table owns the migration; confirm you are in the right one.
3. `packages/db/migrations/0001_platform_outbox` and `0002_platform_idempotency_keys` — house style for ids, timestamps, naming.
4. `planning/11-security-privacy-and-compliance.md` data classification for any sensitive column (measurements, face data, photos, location).
5. `apps/api/tests/migrations/` — the forward/rollback test harness (documented test-placement exception).

## Workflow

1. Restate: owning module, end-state schema, and whether live data exists in staging/prod for the affected tables.
2. Search before write: an existing table/column/enum may already represent the concept; taxonomy, units, and reason codes have canonical owners (`closet`, `shared-kernel`) — never a parallel column.
3. Design expand → migrate → contract: additive change deployable before the code that uses it; backfill as an idempotent, batched, resumable script; drop/NOT NULL only in a later migration after no code reads the old shape.
4. Define tables in `modules/<name>/internal/schema.ts`; generate the migration with drizzle-kit via the `just db-*` recipes; read the generated SQL and fix unsafe defaults (table rewrites, missing `CONCURRENTLY`). Never `drizzle-kit push` outside local; never run drizzle-kit directly when a `just` recipe exists.
5. Write the rollback and state whether it is lossy. Sensitive columns: classification, retention, and deletion propagation stated in the PR.
6. Tests: forward + rollback in `apps/api/tests/migrations/`; repository integration tests in the owning module's `tests/`; clean apply on empty and seeded local DB.

## Validation commands

```bash
just db-reset --yes && just db-migrate && just db-seed      # local only; db-reset refuses non-local URLs
just db-rollback --yes && just db-migrate                   # rollback round-trip
just test <owning module>
just typecheck && just lint && just arch-check && just ci-parity
```

Staging apply runs on a Neon branch via the affected-module CI lane; cite that run in the PR when a staging environment exists (OPEN until P02 OQ-07 region memo — see planning/16 OQ-07).

## Output

- PR: schema diff, generated and reviewed SQL, backfill script with idempotency note, rollback statement (safe / lossy-with-detail), owning-module test updates, sensitivity note.

Done checklist: migration applies on empty + seeded DB · rollback round-trip shown · SQL reviewed by a human-readable comment in the PR · no destructive step without authorization · `docs/modules/<name>.md` Owned data updated.

## Stop / escalation

- DROP, TRUNCATE, type narrowing, or any contract-phase step → explicit human authorization with the exact SQL (CLAUDE.md "Prohibited without explicit human authorization"). Never agent-initiated.
- Backfill would lock a hot table → stop; propose a batched/job plan.
- Change spans tables owned by two modules → data-ownership question for the module contracts.
- `DATABASE_URL` is not local when running `db-reset` → the recipe refuses; do not work around it.

## Overlap

Adjacent: `backend-module` (repository code using the new shape), `api-contract-change` (wire shape, separate concern), `security-privacy-review` (sensitive columns), `release-readiness` (migration applied to staging before promotion). This skill alone owns `packages/db/migrations/` and `internal/schema.ts` files.
