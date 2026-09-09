import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import * as schema from './schema/index.js';

export type DbSchema = typeof schema;
export type Db = PostgresJsDatabase<DbSchema>;

export type DbHandle = {
  readonly db: Db;
  /** Raw postgres.js client (health probes, migrations, ad-hoc SQL). */
  readonly sql: Sql;
  /** Close every connection in the pool. Idempotent. */
  close(): Promise<void>;
};

export type CreateDbOptions = {
  /** Pool size; scripts and probes use 1. Default 5. */
  readonly max?: number;
  /** Seconds to wait for a TCP connection before failing. Default 5. */
  readonly connectTimeoutSeconds?: number;
};

/** Open a Postgres connection pool + Drizzle instance for `url`. Nothing connects until first use. */
export function createDb(url: string, options: CreateDbOptions = {}): DbHandle {
  const sql = postgres(url, {
    max: options.max ?? 5,
    connect_timeout: options.connectTimeoutSeconds ?? 5,
    onnotice: () => undefined,
  });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: () => sql.end({ timeout: 5 }),
  };
}
