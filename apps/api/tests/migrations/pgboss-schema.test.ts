// Drift guard for migration 0003_pgboss_schema: the committed SQL must be exactly what the
// installed pg-boss would install itself (getConstructionPlans, outer BEGIN/COMMIT removed). When a
// pg-boss upgrade changes its DDL this fails: add a new migration from getMigrationPlans() instead
// of editing 0003 (see the migration header). Pure file comparison, but it lives in the
// `migrations` project next to the round-trip test that applies the same SQL.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getConstructionPlans } from 'pg-boss';
import { describe, expect, it } from 'vitest';

import { MIGRATIONS_FOLDER } from '@ai-stylist/db';

/** pg-boss schema version 0003 installs (pg-boss 12.34.0 package.json `pgboss.schema`). */
const PGBOSS_SCHEMA_VERSION = 42;

describe('0003_pgboss_schema matches the installed pg-boss', () => {
  it('equals getConstructionPlans("pgboss") without the outer transaction', () => {
    const plan = getConstructionPlans('pgboss', { createSchema: false });
    const body = plan.replace(/^\s*BEGIN;\n/, '').replace(/\n\s*COMMIT;\s*$/, '\n');
    const migration = readFileSync(path.join(MIGRATIONS_FOLDER, '0003_pgboss_schema.sql'), 'utf8');
    const [head, installed, ...rest] = migration.split('--> statement-breakpoint\n');

    expect(rest).toEqual([]);
    expect(head?.trimEnd().endsWith('CREATE SCHEMA "pgboss";')).toBe(true);
    expect(installed).toBe(body);
    expect(body).toContain(
      `INSERT INTO pgboss.version(version) VALUES ('${PGBOSS_SCHEMA_VERSION}')`,
    );
  });
});
