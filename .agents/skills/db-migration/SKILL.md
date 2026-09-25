---
name: db-migration
description: Change the PostgreSQL schema with Drizzle — tables, columns, indexes, pgvector indexes, backfills — and write the forward migration, its down file, and the migration test. Use whenever a change touches `packages/db/src/schema/`, a module's `apps/api/src/modules/<name>/internal/schema.ts`, `packages/db/migrations/`, `apps/api/tests/migrations/`, or `just db-generate` / `just db-migrate` / `just db-rollback`. Not for repository or query logic with no schema change — use `backend-module` instead; not for the wire (API/event) shape of a change — use `api-contract-change` instead.
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: platform-engineer
---

# Database Schema and Migrations

## Trigger

- Any edit to `packages/db/src/schema/`, `apps/api/src/modules/<name>/internal/schema.ts`, `packages/db/drizzle.config.ts`, any file in `packages/db/migrations/`, a backfill script, a pgvector column/index, or `apps/api/tests/migrations/`.
- Split of work: the module's engineer (`api-engineer` or `recommendation-engineer`) writes the module's `apps/api/src/modules/<name>/internal/schema.ts`; `platform-engineer` owns everything under `packages/db/` and `apps/api/tests/migrations/` and runs this workflow.
- Not this skill: repository/query logic with no schema change (`backend-module`); wire schemas (`api-contract-change`).

## Required reading

1. `packages/db/README.md` ("Adding a migration") — the four-step procedure this workflow follows.
2. `planning/06-data-api-and-event-contracts.md` §7 (expand → migrate → contract), §8 (deletion propagation), naming.
3. `docs/modules/<owning module>.md` "Owned data" — the module that owns the table owns its schema; confirm you are in the right one.
4. `packages/db/src/schema/platform.ts` and `packages/db/src/schema/index.ts` — the only Drizzle table definitions today and the composed entry `packages/db/drizzle.config.ts` reads.
5. `planning/11-security-privacy-and-compliance.md` §6 (data classes S0–S3, retention, deletion) for any sensitive column.

## Workflow

1. Restate: owning module, end-state schema, and whether live data exists in staging/prod for the affected tables.
2. Search before write — an existing table, column or enum may already hold the concept; taxonomy, units and reason codes have canonical owners (`closet`, `shared-kernel`), never a parallel column:

   ```bash
   git ls-files packages/db 'apps/api/src/modules/*/internal/schema.ts'
   rg -n -i '<table>|<column>|<concept>' packages/db/src/schema packages/db/migrations apps/api/src/modules packages/shared-kernel/registry
   ```

3. Design expand → migrate → contract: an additive change deployable before the code that uses it; a backfill as an idempotent, batched, resumable script; DROP or NOT NULL only in a later migration after no code reads the old shape.
4. Copy the structure from:

   | New thing                                                                                                                                                                | Copy from                                                              |
   | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
   | Table definition (text ULID ids, `timestamp(..., { withTimezone: true })`, snake_case columns, named `_idx`/`_uq` indexes, exported `$inferSelect`/`$inferInsert` types) | `packages/db/src/schema/platform.ts`                                   |
   | Forward migration SQL (review target)                                                                                                                                    | `packages/db/migrations/0002_platform_idempotency_keys.sql`            |
   | Down file (undoes exactly the paired step)                                                                                                                               | `packages/db/migrations/down/0002.sql`                                 |
   | Forward + rollback test on Testcontainers (`startPostgres()` inside the test, never skipped)                                                                             | `apps/api/tests/migrations/migrate.test.ts` (extend its `TABLES` list) |

5. Generate with `just db-generate <migration_name>` — the argument is a migration name such as `platform_outbox_last_error_at` or `closet_items`, not a module name. It is the only sanctioned generator. Read the generated SQL and fix unsafe defaults (table rewrites, missing `CONCURRENTLY`). Never apply outside local by any means other than `just db-migrate`, and never edit an applied migration.
6. Write `packages/db/migrations/down/<idx>.sql` and state whether it is lossy. Sensitive columns: classification (doc 11 §6), retention, and deletion propagation (doc 06 §8) stated in the PR.
7. Tests: extend `apps/api/tests/migrations/migrate.test.ts`; prove a clean apply on an empty and a seeded local DB.

## Validation commands

```bash
just db-reset --yes && just db-migrate && just db-seed      # local only; db-reset refuses non-local URLs
just db-rollback --yes && just db-migrate                   # rollback round-trip
just test api                                               # runs the Testcontainers migrations project (needs Docker)
just test <owning module>                                   # when the module's code reads the new shape
just typecheck && just lint && just arch-check
just ci-parity                                              # before PR
```

A staging apply rehearsed on a scratch database restored from a nightly backup (`docs/SERVICES-SETUP.md` §3) is OPEN — `planning/16-risks-open-questions-and-decision-log.md` OQ-07 leaves the server/region undecided, so no staging backup lane exists. Cite the local + CI round-trip in the PR; never claim a staging apply that did not run.

## Output

- PR: schema diff, generated and reviewed SQL, backfill script with idempotency note, rollback statement (safe / lossy-with-detail), migration test update, sensitivity note. Report in the `agent-operating-contract` format.

Done checklist: migration applies on empty + seeded DB · rollback round-trip shown · `migrate.test.ts` extended · SQL reviewed in a PR comment · no destructive step without authorization · `docs/modules/<name>.md` "Owned data" update reported to its owner.

## Stop / escalation

- The first domain table: no module has an `apps/api/src/modules/<name>/internal/schema.ts` yet, and re-exporting one from `packages/db/src/schema/index.ts` (the design in ADR-0001 §3 and `packages/db/README.md`) is an import `public-api-only-external` in `tools/depcruise/rules.cjs` forbids (nothing outside `apps/api/src/modules/` may import a module's internals). Stop before writing it and report the collision to the lead; it needs a rule exception (ADR) or another composition path.
- The task assumes a table from a phase that is `NOT_STARTED` in `planning/PROGRESS.md` → stop and name the phase task.
- DROP, TRUNCATE, type narrowing, or any contract-phase step → explicit human authorization with the exact SQL (CLAUDE.md "Prohibited without explicit human authorization"). Never agent-initiated.
- A backfill would lock a hot table → stop; propose a batched job plan.
- A change spans tables owned by two modules → data-ownership question for the module contracts.
- `DATABASE_URL` is not local when running `db-reset` → the recipe refuses; do not work around it.
- Docker is unavailable → `just test api` fails (it never skips); report `Not run` with the error line.

## Overlap

Adjacent: `backend-module` / `recommendation-rules` / `entitlements-billing` and the other module skills (the module's schema file and the repository code that reads it), `api-contract-change` (wire shape, separate concern), `data-lifecycle` (deletion cascade coverage of new user-owned tables), `security-privacy-review` (sensitive columns), `release-readiness` (migration applied to staging before promotion). This skill owns `packages/db/**` and `apps/api/tests/migrations/**`, and turns a module's `apps/api/src/modules/<name>/internal/schema.ts` edit into an applied, reversible migration.
