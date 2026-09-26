// The Postgres schema pg-boss (DEC-41, apps/api/src/platform/queue) keeps its job tables in.
// Declared here only so drizzle-kit records it in the migration stream: migration
// `0003_pgboss_schema` creates it and installs pg-boss's own DDL into it (planning/06 §7: never on
// app boot; `PgBossQueue` runs pg-boss with `migrate: false`). No Drizzle tables are defined in it:
// pg-boss owns every object inside, and nothing but the queue adapter reads them.
import { pgSchema } from 'drizzle-orm/pg-core';

export const pgbossSchema = pgSchema('pgboss');
