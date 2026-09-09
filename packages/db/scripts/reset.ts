// `just db-reset --yes` — LOCAL ONLY: drop everything, migrate from scratch, seed.
// Refuses any DATABASE_URL whose host is not localhost/127.0.0.1 (root CLAUDE.md "Prohibited").
import { sql } from 'drizzle-orm';

import { createDb } from '../src/client.js';
import { isLocalDatabaseUrl } from '../src/local-url.js';
import { migrate } from '../src/migrate.js';
import { log, requireDatabaseUrl } from './env.js';

if (!process.argv.includes('--yes')) {
  process.stderr.write('db-reset is destructive: re-run as `just db-reset --yes`\n');
  process.exit(1);
}

const url = requireDatabaseUrl();
if (!isLocalDatabaseUrl(url)) {
  process.stderr.write(
    `db-reset refused: DATABASE_URL host is not localhost/127.0.0.1 (${new URL(url).hostname}). ` +
      'Resetting a shared database is prohibited; use a Neon branch instead.\n',
  );
  process.exit(1);
}

const handle = createDb(url, { max: 1 });
try {
  await handle.db.execute(sql`drop schema if exists drizzle cascade`);
  await handle.db.execute(sql`drop schema public cascade`);
  await handle.db.execute(sql`create schema public`);
  log('db-reset: dropped public + drizzle schemas');
  await migrate(handle.db);
  log('db-reset: migrated');
} finally {
  await handle.close();
}
