// drizzle-kit configuration (planning/06 §7). `pnpm --filter @ai-stylist/db migration:generate --name <x>`
// writes SQL + snapshot + journal under ./migrations; apply with `just db-migrate` (never on boot).
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // Only `generate` runs through drizzle-kit; migrate/rollback/reset are scripts/*.ts so that env
  // loading, the local-only guard and the down-file convention are in one place.
  dbCredentials: { url: process.env['DATABASE_URL'] ?? 'postgres://unused' },
  strict: true,
  verbose: true,
});
