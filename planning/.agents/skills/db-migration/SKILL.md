---
name: db-migration
description: Change the PostgreSQL schema with Drizzle — new tables/columns/indexes, data backfills, pgvector indexes, and their migrations and rollbacks. Use whenever a change touches packages/db schema files or generates a drizzle-kit migration.
---

# Database Schema and Migrations

## Trigger

- Any edit to Drizzle schema definitions, any generated migration file, any data backfill script, index change, or pgvector column/index work.

**Not this skill:** query/repository logic with no schema change (`backend-module`); event/API schema shapes (`api-contract-change`).

## Required reading

1. `planning/06-data-api-and-event-contracts.md` — migration policy (expand→migrate→contract), consistency rules, deletion propagation, naming conventions.
2. The owning module's contract — the module that owns the table (SPINE §3 table) owns the schema change; confirm you're in the right one.
3. Existing schema for adjacent tables (naming, id strategy, timestamps, soft-delete conventions) — new tables must match house style, not invent one.

## Workflow

1. Restate: which module owns the data, what the end-state schema is, and whether live data exists in staging/prod for the affected tables (phase-dependent).
2. Semantic reuse check: does an existing table/column/enum already represent this concept? Taxonomy, units, and reason codes have canonical owners — never add a parallel column that duplicates `shared-kernel` or `closet` taxonomy concepts.
3. Design **expand → migrate → contract**:
   - Expand: additive change (nullable column, new table, new index `CONCURRENTLY`), deployable before code that uses it.
   - Migrate: backfill as an idempotent, batched, resumable script (job or SQL) — never a giant single-transaction UPDATE on a hot table.
   - Contract: drop/NOT NULL only in a later migration, after code no longer reads the old shape.
4. Generate the migration with drizzle-kit; **read the generated SQL** and edit where drizzle-kit's default is unsafe (e.g. table rewrite, missing `CONCURRENTLY`). Never `drizzle-kit push` outside local.
5. Write/verify the rollback path per doc 06: what `just db-rollback` will do, and whether it is lossy (say so explicitly in the PR).
6. Sensitive columns (measurements, face data, location): confirm classification + retention rules from `planning/11-security-privacy-and-compliance.md` apply — encryption/retention/deletion propagation noted in the migration PR.
7. Tests: migration applies cleanly on empty DB **and** on seeded DB (`just db-seed`); repository integration tests updated in the owning module's `tests/`; migration up→down→up passes locally.

## Validation

```bash
just db-reset && just db-migrate && just db-seed     # clean apply on local
just db-rollback && just db-migrate                  # rollback roundtrip
just test <owning-module>
just typecheck && just lint && just ci-parity
```

Staging apply happens via the deploy pipeline on a Neon branch first (doc 15 §11) — note in the PR that the branch-apply succeeded when the phase has a staging environment.

## Output

- PR containing: schema diff, generated + reviewed SQL, backfill script (if any) with idempotency note, rollback statement (safe / lossy-with-detail), owning-module test updates.

## Stop / escalate

- **Destructive operations (DROP, TRUNCATE, type narrowing, contract-phase steps) require explicit human authorization** — per CLAUDE.md, always stop and ask with the exact SQL.
- Backfill would lock a hot table or exceed maintenance windows → stop, propose a batched/job-based plan.
- The change spans tables owned by two modules → stop; data ownership question for the module contracts, not a migration decision.
