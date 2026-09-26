// The pg-boss schema this repository installs through migrations (packages/db
// 0003_pgboss_schema), exposed so the drift test in apps/api/tests/migrations/ need not import
// pg-boss itself (pg-boss stays under apps/api/src/platform/** and apps/api/src/jobs/**).
import { getConstructionPlans } from 'pg-boss';

/** pg-boss schema version 0003 installs (pg-boss 12.34.0 package.json `pgboss.schema`). */
export const PGBOSS_SCHEMA_VERSION = 42;

/**
 * The DDL the installed pg-boss would run to create its tables in `schema` (the schema itself not
 * included), wrapped in pg-boss's own BEGIN/COMMIT.
 */
export function pgBossConstructionSql(schema: string): string {
  return getConstructionPlans(schema, { createSchema: false });
}
