import { fileURLToPath } from 'node:url';

import { migrate as drizzleMigrate } from 'drizzle-orm/postgres-js/migrator';

import { type Db, createDb } from './client.js';

/** Absolute path of the committed migrations folder (SQL + meta/_journal.json + down/). */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Apply every pending migration from `migrations/` (drizzle journal semantics: entries whose
 * `when` is newer than the last row in `drizzle.__drizzle_migrations`). Idempotent.
 */
export async function migrate(db: Db): Promise<void> {
  await drizzleMigrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/**
 * Open a single-connection client for `url`, apply every pending migration, close it (also on
 * failure). Used by `just db-migrate` and by every Testcontainers test that boots a fresh database.
 */
export async function migrateUrl(url: string): Promise<void> {
  const handle = createDb(url, { max: 1 });
  try {
    await migrate(handle.db);
  } finally {
    await handle.close();
  }
}
