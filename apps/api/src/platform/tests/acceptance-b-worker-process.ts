// The "relay/job process" that `acceptance-lifecycle.docker.test.ts` starts with `node --import tsx`
// and then SIGKILLs mid-run (AC-4, AC-8): a hard kill, no graceful stop, so its in-flight outbox
// transaction and its `active` jobs are abandoned exactly as a crashed process leaves them.
//
// Env (set by the test): ACCEPTANCE_B_DATABASE_URL (the Testcontainers database) and
// ACCEPTANCE_B_MODE: `kill-retry` (outbox relay + KILL_RETRY_QUEUE worker) or `export` (the
// export-chain workers; the step-2 effect is slow so the kill lands inside it). Prints `ready`
// on stdout once polling. Exits on its own after 2 minutes so an orphan never outlives the test.
import pino from 'pino';
import postgres from 'postgres';

import { PgIdempotencyGuard } from '../idempotency/pg-idempotency-guard.js';
import { loggerOptions } from '../logger.js';
import { OutboxRelay, type OutboxDispatchQueue } from '../outbox/outbox-relay.js';
import { PgBossQueue } from '../queue/pg-boss-queue.js';

import {
  CHILD_APPLICATION_NAME,
  EXPORT_QUEUES,
  EXPORT_STEPS,
  KILL_RETRY_QUEUE,
  SUPERVISE_INTERVAL_SECONDS,
  exportStepHandler,
  killRetryHandler,
  sleep,
} from './acceptance-b-fixtures.js';

const ORPHAN_EXIT_MS = 120_000;

async function main(): Promise<void> {
  const url = process.env.ACCEPTANCE_B_DATABASE_URL;
  const mode = process.env.ACCEPTANCE_B_MODE;
  if (url === undefined || (mode !== 'kill-retry' && mode !== 'export')) {
    throw new Error('ACCEPTANCE_B_DATABASE_URL and ACCEPTANCE_B_MODE are required');
  }
  setTimeout(() => process.exit(3), ORPHAN_EXIT_MS);
  const logger = pino(loggerOptions({ level: 'warn', service: 'api-test' }), process.stderr);
  const sql = postgres(url, { max: 4, connection: { application_name: CHILD_APPLICATION_NAME } });
  const guard = new PgIdempotencyGuard(sql);

  if (mode === 'kill-retry') {
    const queue = new PgBossQueue({
      connectionString: url,
      logger,
      queues: [KILL_RETRY_QUEUE],
      pollingIntervalSeconds: 0.5,
      superviseIntervalSeconds: SUPERVISE_INTERVAL_SECONDS,
    });
    await queue.start();
    await queue.work(KILL_RETRY_QUEUE.name, killRetryHandler({ sql, guard, effectMs: 300 }));
    // Slow sends keep a relay batch in flight long enough for the kill to land inside it.
    const slowed: OutboxDispatchQueue = {
      send: async (name, data, options) => {
        await sleep(80);
        return queue.send(name, data, options);
      },
    };
    new OutboxRelay({
      sql,
      queue: slowed,
      logger,
      routeEvent: () => KILL_RETRY_QUEUE.name,
      userIdOf: (envelope) => (envelope.actor.kind === 'user' ? envelope.actor.id : undefined),
      batchSize: 10,
      pollIntervalMs: 50,
    }).start();
  } else {
    const queue = new PgBossQueue({
      connectionString: url,
      logger,
      queues: EXPORT_QUEUES,
      pollingIntervalSeconds: 0.5,
      superviseIntervalSeconds: SUPERVISE_INTERVAL_SECONDS,
    });
    await queue.start();
    for (const [index, step] of EXPORT_STEPS.entries()) {
      const effectMs = index === 1 ? 3_000 : 50;
      await queue.work(step, exportStepHandler({ sql, guard, queue, effectMs }, index));
    }
  }
  process.stdout.write('ready\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`acceptance-b-worker-process: ${String(error)}\n`);
  process.exit(2);
});
