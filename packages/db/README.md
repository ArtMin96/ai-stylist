# @ai-stylist/db

drizzle-kit config, composed schema entry, committed migrations, and the client/migrate helpers.
Table definitions for domain modules live in `apps/api/src/modules/<name>/internal/schema.ts` and
are re-exported from `src/schema/index.ts` once they exist (none yet in P02); the `platform`
infrastructure tables live here (`src/schema/platform.ts`). Committed migrations: `0000` pgvector,
`0001` `platform_outbox`, `0002` `platform_idempotency_keys`, each with a `down/` file.

## Recipes

| Recipe                 | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `just db-generate <n>` | drizzle-kit generate named `<n>`; reminds you to add the down file    |
| `just db-migrate`      | applies pending `migrations/*.sql` (programmatic drizzle migrator)    |
| `just db-rollback`     | rolls back the last applied migration via `migrations/down/<idx>.sql` |
| `just db-reset --yes`  | LOCAL ONLY: drops `public` + `drizzle` schemas, migrates, seeds       |
| `just db-seed`         | inserts synthetic rows from `@ai-stylist/seed-data`                   |

`DATABASE_URL` comes from the environment or the repo-root `.env` (never overridden if already
exported). Locally it points at the compose Postgres 18 + pgvector (`pgvector/pgvector:pg18`): start it with
`docker compose up -d --wait postgres` (or `just dev-api`); set `POSTGRES_HOST_PORT` in `.env` if
5432 is taken. Migrations never run on API boot. `db-reset` refuses any host other than
`localhost` / `127.0.0.1` / `::1`.

A PostgreSQL major bump cannot reuse a data directory: PG18 images store data under
`/var/lib/postgresql/18/docker` and mount the volume at `/var/lib/postgresql`, so the compose
volume is `postgres-cluster` (the PG17 one was `postgres-data`). After pulling a major bump, run
`docker compose up -d --wait postgres` (recreates the container on the new image and volume), then
`just db-reset --yes`. Local data is synthetic seed data only, so nothing is migrated across.

## Adding a migration

1. Edit the schema (module `internal/schema.ts`, re-exported from `src/schema/index.ts`).
2. `just db-generate <module>_<change>` → `migrations/NNNN_<name>.sql` + snapshot + journal
   entry. Never edit an applied migration.
3. Write `migrations/down/NNNN.sql` undoing exactly that step. drizzle-kit has no down migrations;
   the pairing is a review convention, and expand–contract (planning/06 §7) is enforced by review,
   not by tooling: a down file must only undo the additive step it pairs with.
4. `just db-migrate && just db-rollback && just db-migrate` locally; the Testcontainers suite
   (`apps/api/tests/migrations/`, run by `just test api`) repeats it on the pgvector image in CI;
   extend it when you add a migration.
