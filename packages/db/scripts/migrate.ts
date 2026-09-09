// `just db-migrate` — apply pending migrations from packages/db/migrations.
import { createDb } from '../src/client.js';
import { migrate } from '../src/migrate.js';
import { log, requireDatabaseUrl } from './env.js';

const handle = createDb(requireDatabaseUrl(), { max: 1 });
try {
  await migrate(handle.db);
  log('db-migrate: up to date');
} finally {
  await handle.close();
}
