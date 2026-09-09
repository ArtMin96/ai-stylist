# @ai-stylist/db

drizzle-kit config, composed schema entry, committed migrations, and the client/migrate helpers.
Table definitions for domain modules live in `apps/api/src/modules/<name>/internal/schema.ts` and
are re-exported from `src/schema/index.ts`; the `platform` infrastructure tables live here
(`src/schema/platform.ts`).

## Recipes

| Recipe                | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `just db-migrate`     | applies pending `migrations/*.sql` (programmatic drizzle migrator)    |
| `just db-rollback`    | rolls back the last applied migration via `migrations/down/<idx>.sql` |
| `just db-reset --yes` | LOCAL ONLY: drops `public` + `drizzle` schemas, migrates, seeds       |
| `just db-seed`        | inserts synthetic rows from `@ai-stylist/seed-data`                   |

`DATABASE_URL` comes from the environment or the repo-root `.env` (never overridden if already
exported). `db-reset` refuses any host other than `localhost` / `127.0.0.1`.

## Adding a migration

1. Edit the schema (module `internal/schema.ts`, re-exported from `src/schema/index.ts`).
2. `pnpm --filter @ai-stylist/db migration:generate --name <module>_<change>` → `migrations/NNNN_<name>.sql`
   - snapshot + journal entry. Never edit an applied migration.
3. Write `migrations/down/NNNN.sql` undoing exactly that step. drizzle-kit has no down migrations;
   the pairing is a review convention, and expand–contract (planning/06 §7) is enforced by review,
   not by tooling: a down file must only undo the additive step it pairs with.
4. `just db-migrate && just db-rollback && just db-migrate` locally; CI repeats it on pgvector.
