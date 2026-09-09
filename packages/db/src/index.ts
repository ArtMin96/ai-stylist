// Public API of @ai-stylist/db: client factory, programmatic migrate, schema, local-url guard.
export { createDb, type CreateDbOptions, type Db, type DbHandle, type DbSchema } from './client.js';
export { MIGRATIONS_FOLDER, migrate } from './migrate.js';
export { isLocalDatabaseUrl } from './local-url.js';
export * as schema from './schema/index.js';
export * from './schema/platform.js';
export { rollbackLast, type RollbackResult } from './rollback.js';
