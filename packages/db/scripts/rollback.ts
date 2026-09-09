// `just db-rollback` — roll back the most recently applied migration (see src/rollback.ts).
import { createDb } from '../src/client.js';
import { rollbackLast } from '../src/rollback.js';
import { log, requireDatabaseUrl } from './env.js';

const handle = createDb(requireDatabaseUrl(), { max: 1 });
try {
  const result = await rollbackLast(handle.db);
  log(result === null ? 'db-rollback: nothing applied' : `db-rollback: rolled back ${result.tag}`);
} finally {
  await handle.close();
}
