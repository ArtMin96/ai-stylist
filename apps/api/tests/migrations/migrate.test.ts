// Forward + rollback migration test on a throwaway Testcontainers Postgres (pgvector image).
// Requires Docker: startPostgres() throws (test fails, never skips) when the daemon is unreachable.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { type DbHandle, createDb, migrate, rollbackLast } from '@ai-stylist/db';
import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

const TABLES = ['platform_outbox', 'platform_idempotency_keys'];

describe('packages/db migrations (Testcontainers)', () => {
  let pg: StartedPostgres | undefined;
  let handle: DbHandle;

  afterAll(async () => {
    await handle?.close();
    await pg?.stop();
  });

  async function tables(): Promise<string[]> {
    const rows = await handle.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    return rows.map((r) => r.table_name);
  }

  async function hasVector(): Promise<boolean> {
    const rows = await handle.db.execute<{ extname: string }>(
      sql`select extname from pg_extension where extname = 'vector'`,
    );
    return rows.length === 1;
  }

  it('migrates up, rolls back both platform tables, and migrates again', async () => {
    // Inside the test (not beforeAll) so a missing Docker daemon is a FAILED test, not a skip.
    pg = await startPostgres();
    handle = createDb(pg.url, { max: 1 });

    await migrate(handle.db);
    expect(await tables()).toEqual([...TABLES].sort());
    expect(await hasVector()).toBe(true);

    expect((await rollbackLast(handle.db))?.tag).toBe('0002_platform_idempotency_keys');
    expect(await tables()).toEqual(['platform_outbox']);
    expect((await rollbackLast(handle.db))?.tag).toBe('0001_platform_outbox');
    expect(await tables()).toEqual([]);
    expect(await hasVector()).toBe(true); // 0000_enable_pgvector stays applied

    await migrate(handle.db);
    expect(await tables()).toEqual([...TABLES].sort());
    await migrate(handle.db); // idempotent
    const applied = await handle.db.execute<{ n: number }>(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    );
    expect(applied[0]?.n).toBe(3);
  });
});
