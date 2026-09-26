// Drift guard for migration 0003_pgboss_schema: the committed SQL must be exactly what the
// installed pg-boss would install itself (getConstructionPlans via the platform queue adapter's
// `pgBossConstructionSql`, outer BEGIN/COMMIT removed). When a pg-boss upgrade changes its DDL this
// fails: add a new migration from getMigrationPlans() instead of editing 0003 (see the migration
// header). Pure file comparison, but it lives in the `migrations` project next to the round-trip
// test that applies the same SQL.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MIGRATIONS_FOLDER } from '@ai-stylist/db';

import { PGBOSS_SCHEMA_VERSION, pgBossConstructionSql } from '../../src/platform/index.js';

describe('0003_pgboss_schema matches the installed pg-boss', () => {
  it('equals getConstructionPlans("pgboss") without the outer transaction', () => {
    const plan = pgBossConstructionSql('pgboss');
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
