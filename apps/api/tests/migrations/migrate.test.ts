// Forward + rollback migration test on a throwaway Testcontainers Postgres (pgvector image).
// Requires Docker: startPostgres() throws (test fails, never skips) when the daemon is unreachable.
import { sql } from 'drizzle-orm';
import { PgBoss } from 'pg-boss';
import { afterAll, describe, expect, it } from 'vitest';

import { type DbHandle, createDb, migrate, rollbackLast } from '@ai-stylist/db';
import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

const TABLES = ['platform_outbox', 'platform_idempotency_keys'];

// Production PostgreSQL major (ADR-0003; compose and CI use pgvector/pgvector:pg<major>). The test
// fails when the Testcontainers image drifts from it, so migrations are always proven on this major.
const POSTGRES_MAJOR = 18;

/** pg-boss schema version installed by 0003_pgboss_schema (pg-boss 12.34.0). */
const PGBOSS_SCHEMA_VERSION = 42;

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

  /** Installed pg-boss schema version, or null when the `pgboss` schema is absent. */
  async function pgbossVersion(): Promise<number | null> {
    const schema = await handle.db.execute<{ n: number }>(
      sql`select count(*)::int as n from information_schema.schemata where schema_name = 'pgboss'`,
    );
    if (schema[0]?.n === 0) return null;
    const rows = await handle.db.execute<{ version: number }>(
      sql`select version from pgboss.version`,
    );
    return rows[0]?.version ?? null;
  }

  /** pg-boss accepts the migrated schema without migrating it (the PgBossQueue setting). */
  async function pgbossStartsWithoutMigrating(url: string): Promise<void> {
    const boss = new PgBoss({ connectionString: url, migrate: false, max: 1 });
    boss.on('error', () => undefined);
    await boss.start();
    await boss.createQueue('migrations.smoke');
    expect(await boss.send('migrations.smoke', {})).not.toBeNull();
    await boss.stop({ graceful: false });
  }

  it('migrates up, rolls back the pg-boss schema and both platform tables, and migrates again', async () => {
    // Inside the test (not beforeAll) so a missing Docker daemon is a FAILED test, not a skip.
    pg = await startPostgres();
    handle = createDb(pg.url, { max: 1 });

    const version = await handle.db.execute<{ n: number }>(
      sql`select current_setting('server_version_num')::int as n`,
    );
    expect(Math.floor((version[0]?.n ?? 0) / 10000)).toBe(POSTGRES_MAJOR);

    await migrate(handle.db);
    expect(await tables()).toEqual([...TABLES].sort());
    expect(await hasVector()).toBe(true);
    expect(await pgbossVersion()).toBe(PGBOSS_SCHEMA_VERSION);
    await pgbossStartsWithoutMigrating(pg.url);

    expect((await rollbackLast(handle.db))?.tag).toBe('0003_pgboss_schema');
    expect(await pgbossVersion()).toBeNull();
    expect(await tables()).toEqual([...TABLES].sort());
    expect((await rollbackLast(handle.db))?.tag).toBe('0002_platform_idempotency_keys');
    expect(await tables()).toEqual(['platform_outbox']);
    expect((await rollbackLast(handle.db))?.tag).toBe('0001_platform_outbox');
    expect(await tables()).toEqual([]);
    expect(await hasVector()).toBe(true); // 0000_enable_pgvector stays applied

    await migrate(handle.db);
    expect(await tables()).toEqual([...TABLES].sort());
    expect(await pgbossVersion()).toBe(PGBOSS_SCHEMA_VERSION);
    await pgbossStartsWithoutMigrating(pg.url);
    await migrate(handle.db); // idempotent
    const applied = await handle.db.execute<{ n: number }>(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    );
    expect(applied[0]?.n).toBe(4);
  });
});
