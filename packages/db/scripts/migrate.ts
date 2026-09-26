// `just db-migrate` — apply pending migrations from packages/db/migrations.
import { migrateUrl } from '../src/migrate.js';
import { log, requireDatabaseUrl } from './env.js';

await migrateUrl(requireDatabaseUrl());
log('db-migrate: up to date');
