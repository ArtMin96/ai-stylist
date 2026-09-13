---
name: db-migration
description: Change the PostgreSQL schema with Drizzle — tables, columns, indexes, pgvector indexes, backfills — and write their forward migrations and rollbacks. Use whenever a change touches a `modules/<name>/internal/schema.ts` file, the composed schema entry in `packages/db/`, or adds a file under `packages/db/migrations/`. Not for repository or query logic with no schema change — use `backend-module` instead; not for the wire (API/event) shape of a change — use `api-contract-change` instead.

metadata:
  modules:
  last-reviewed: 2026-09-13
  owner-agent: platform-engineer
---

# Database Schema and Migrations

## Trigger

- Any edit to `apps/api/src/modules/<name>/internal/schema.ts`, the composed schema entry or migration config in `packages/db/`, any file in `packages/db/migrations/`, a backfill script, or a pgvector column/index.
- Not this skill: repository/query logic with no schema change (`backend-module`); wire schemas (`api-contract-change`).

## Required reading

1. `planning/06-data-api-and-event-contracts.md` — expand → migrate → contract policy, consistency rules, deletion propagation, naming.
2. `docs/modules/<owning module>.md` "Owned data" — the module that owns the table owns the migration; confirm you are in the right one.
3. `packages/db/migrations/0001_platform_outbox.sql` and `packages/db/migrations/0002_platform_idempotency_keys.sql` — house style for ids, timestamps, naming.
4. `planning/11-security-privacy-and-compliance.md` data classification for any sensitive column (measurements, face data, photos, location).
5. `apps/api/tests/migrations/` — the forward/rollback test harness (documented test-placement exception).

## Workflow

1. Restate: owning module, end-state schema, and whether live data exists in staging/prod for the affected tables.
2. Search before write: an existing table/column/enum may already represent the concept; taxonomy, units, and reason codes have canonical owners (`closet`, `shared-kernel`) — never a parallel column.
3. Design expand → migrate → contract: additive change deployable before the code that uses it; backfill as an idempotent, batched, resumable script; drop/NOT NULL only in a later migration after no code reads the old shape.
4. Define tables in `modules/<name>/internal/schema.ts`; generate the migration with `just db-generate <name>` — this is the only sanctioned generator; read the generated SQL and fix unsafe defaults (table rewrites, missing `CONCURRENTLY`). Never invoke the ORM CLI directly when a `just` recipe exists, and never apply outside local by any means other than `just db-migrate`.
5. Write the rollback in `packages/db/migrations/down/<idx>.sql` and state whether it is lossy. Schema ownership is split, not shared: the module owner edits `modules/<name>/internal/schema.ts`; `platform-engineer` generates and tests the migration. Sensitive columns: classification, retention, and deletion propagation stated in the PR.
6. Tests: forward + rollback in `apps/api/tests/migrations/`; repository integration tests in the owning module's `apps/api/src/modules/<name>/tests/`; clean apply on empty and seeded local DB.

## Validation commands

```bash
just db-reset --yes && just db-migrate && just db-seed      # local only; db-reset refuses non-local URLs
just db-rollback --yes && just db-migrate                   # rollback round-trip
just test <owning module>
just typecheck && just lint && just arch-check && just ci-parity
```

Whether a staging apply can be proven first on a scratch database restored from a nightly backup (`docs/SERVICES-SETUP.md` §3) is OPEN — see `planning/16-risks-open-questions-and-decision-log.md` OQ-07: the server/region is not decided yet, so no staging backup lane exists to restore from. Until that resolves, cite the local + CI round-trip above in the PR; never claim a staging apply that did not run. Local and CI runs use Testcontainers/ephemeral databases.

## Output

- PR: schema diff, generated and reviewed SQL, backfill script with idempotency note, rollback statement (safe / lossy-with-detail), owning-module test updates, sensitivity note.

Done checklist: migration applies on empty + seeded DB · rollback round-trip shown · SQL reviewed by a human-readable comment in the PR · no destructive step without authorization · `docs/modules/<name>.md` Owned data updated.

## Stop / escalation

- DROP, TRUNCATE, type narrowing, or any contract-phase step → explicit human authorization with the exact SQL (CLAUDE.md "Prohibited without explicit human authorization"). Never agent-initiated.
- Backfill would lock a hot table → stop; propose a batched/job plan.
- Change spans tables owned by two modules → data-ownership question for the module contracts.
- `DATABASE_URL` is not local when running `db-reset` → the recipe refuses; do not work around it.

## Overlap

Adjacent: `backend-module` (repository code using the new shape), `api-contract-change` (wire shape, separate concern), `security-privacy-review` (sensitive columns), `release-readiness` (migration applied to staging before promotion). This skill alone owns `packages/db/migrations/` and turns any module's `modules/<name>/internal/schema.ts` edit into an applied migration.
