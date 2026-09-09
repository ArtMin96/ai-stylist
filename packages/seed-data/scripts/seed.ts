// `just db-seed [--accounts N]` — insert synthetic rows into DATABASE_URL (local/staging only by
// policy; this script has no destructive step). P02: one demo outbox row (T08 relay picks it up).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb, platformOutbox } from '@ai-stylist/db';

import { demoEvent, syntheticRandom } from '../src/index.js';

const envFile = path.join(fileURLToPath(new URL('../../..', import.meta.url)), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const url = process.env['DATABASE_URL'];
if (url === undefined || url.trim() === '') {
  process.stderr.write('DATABASE_URL is not set: export it or fill it in the repo-root .env\n');
  process.exit(1);
}

const accountsFlag = process.argv.indexOf('--accounts');
if (accountsFlag !== -1) {
  process.stdout.write(
    `db-seed: --accounts ${process.argv[accountsFlag + 1] ?? '?'} ignored until the identity ` +
      'module ships its factories (no account tables exist yet)\n',
  );
}

// Fresh id per run (seed = wall clock) so repeated `just db-seed` never collides on the pk.
const event = demoEvent({}, syntheticRandom(Date.now(), new Date()));
const handle = createDb(url, { max: 1 });
try {
  await handle.db.insert(platformOutbox).values({
    id: event.id,
    type: event.type,
    aggregateKind: event.aggregate.kind,
    aggregateId: event.aggregate.id,
    sequence: event.sequence,
    payload: event,
  });
  process.stdout.write(`db-seed: inserted platform_outbox row ${event.id} (${event.type})\n`);
} finally {
  await handle.close();
}
