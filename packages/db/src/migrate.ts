import { fileURLToPath } from 'node:url';

import { migrate as drizzleMigrate } from 'drizzle-orm/postgres-js/migrator';

import type { Db } from './client.js';

/** Absolute path of the committed migrations folder (SQL + meta/_journal.json + down/). */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Apply every pending migration from `migrations/` (drizzle journal semantics: entries whose
 * `when` is newer than the last row in `drizzle.__drizzle_migrations`). Idempotent.
 */
export async function migrate(db: Db): Promise<void> {
  await drizzleMigrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
