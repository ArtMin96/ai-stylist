// The queue gauges' read (planning/14 §4 `queue.depth`, `queue.job.age_oldest`), used by
// `PgBossQueue.readStats()`. Depth comes from pg-boss's own queue stats API; pg-boss has no API for
// the age of the oldest waiting job, so that is one read-only SQL query on its job table. Counts,
// queue names and ages only: never job data.
import type { PgBoss } from 'pg-boss';

import { deadLetterQueueName } from './queue-definition.js';

export type QueueStatsSnapshot = {
  /**
   * Jobs waiting (`created` or `retry`, future-dated retries included) per queue: every configured
   * queue and its dead-letter queue. pg-boss `getQueueStats(name, { force: true })`: its cached
   * counts, recomputed when older than 60 s.
   */
  readonly depth: readonly { readonly queue: string; readonly jobs: number }[];
  /** Seconds since the oldest waiting job of each configured queue was created; 0 when none waits. */
  readonly oldestAgeSeconds: readonly { readonly jobType: string; readonly seconds: number }[];
};

/** A schema name used unquoted in SQL, as pg-boss's own statements use it. */
const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,49}$/;

/**
 * Oldest waiting (`created`/`retry`), unblocked job per queue name. The predicate equals pg-boss's
 * partial index `job_i11 (name, priority DESC, created_on, start_after) WHERE state < 'active' AND
 * NOT blocked` (migration 0003), so the read stays on the index. `job_state` is an ordered enum
 * (created < retry < active < …), as pg-boss's own stats query relies on.
 */
function oldestWaitingJobSql(schema: string): string {
  if (!SCHEMA_NAME.test(schema)) {
    throw new TypeError('PgBossQueue: schema must match [a-z_][a-z0-9_]{0,49}');
  }
  return `
    select name, extract(epoch from (now() - min(created_on)))::float8 as age_seconds
    from ${schema}.job
    where name = any($1::text[]) and state < 'active' and not blocked
    group by name`;
}

/** One gauge reading for the configured `jobTypes` (worked queues) and their dead-letter queues. */
export async function readQueueStats(
  boss: PgBoss,
  schema: string,
  jobTypes: readonly string[],
): Promise<QueueStatsSnapshot> {
  const queues = [...new Set(jobTypes.flatMap((name) => [name, deadLetterQueueName(name)]))];
  const depth: { queue: string; jobs: number }[] = [];
  for (const queue of queues) {
    const [stats] = await boss.getQueueStats(queue, { force: true });
    depth.push({ queue, jobs: stats?.queuedCount ?? 0 });
  }
  const { rows } = await boss.getDb().executeSql(oldestWaitingJobSql(schema), [[...jobTypes]]);
  const ages = new Map<string, number>();
  for (const row of rows as { name?: unknown; age_seconds?: unknown }[]) {
    if (typeof row.name === 'string') ages.set(row.name, Number(row.age_seconds));
  }
  const oldestAgeSeconds = jobTypes.map((jobType) => {
    const seconds = ages.get(jobType) ?? 0;
    return { jobType, seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 0 };
  });
  return { depth, oldestAgeSeconds };
}
