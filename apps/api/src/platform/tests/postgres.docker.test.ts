// Smoke test for the `platform-docker` vitest project (apps/api/vitest.config.ts): platform adapters
// that need a real Postgres (pg-boss queue, outbox relay) run here on a throwaway Testcontainers
// database. Requires Docker: startPostgres() throws (test fails, never skips) when it is unreachable.
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

describe('platform Docker suite (Testcontainers)', () => {
  let pg: StartedPostgres | undefined;
  let client: Sql | undefined;

  afterAll(async () => {
    await client?.end();
    await pg?.stop();
  });

  it('reaches a throwaway Postgres', async () => {
    // Inside the test (not beforeAll) so a missing Docker daemon is a FAILED test, not a skip.
    pg = await startPostgres();
    client = postgres(pg.url, { max: 1 });

    const rows = await client<{ one: number }[]>`select 1 as one`;
    expect(rows[0]?.one).toBe(1);
  });
});
