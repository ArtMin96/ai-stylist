// Regression (AI-9, live AC-10 run): `PgOutboxWriter` on the pool the API actually builds,
// `createDb(url).sql` from @ai-stylist/db. `drizzle()` replaces that client's json/jsonb
// serializers with identity functions, so a `sql.json(envelope)` parameter reached the wire as a
// raw object and every `POST /v1/dev/demo-events` failed in Bind with ERR_INVALID_ARG_TYPE. The
// writer's other Docker test used a bare `postgres()` client and never saw it.
// Testcontainers (`platform-docker` project): FAILS without Docker, never skips.
import { afterAll, describe, expect, it } from 'vitest';

import { type DbHandle, createDb, migrate } from '@ai-stylist/db';
import { newId } from '@ai-stylist/shared-kernel';
import { demoEvent, syntheticRandom } from '@ai-stylist/seed-data';
import { type StartedPostgres, memoryLogStream, startPostgres } from '@ai-stylist/test-support';
import pino from 'pino';

import { loggerOptions } from '../logger.js';
import { OutboxRelay } from '../outbox/outbox-relay.js';
import { PgOutboxWriter } from '../outbox/pg-outbox-writer.js';

describe('PgOutboxWriter on the createDb() client the API uses', () => {
  let pg: StartedPostgres | undefined;
  let handle: DbHandle | undefined;
  const random = syntheticRandom();

  afterAll(async () => {
    await handle?.close();
    await pg?.stop();
  });

  async function boot(): Promise<DbHandle> {
    if (handle === undefined) {
      pg = await startPostgres();
      // Same construction as app.module.ts.
      handle = createDb(pg.url, { max: 5 });
      await migrate(handle.db);
    }
    return handle;
  }

  function event() {
    return demoEvent({ aggregate: { kind: 'demo_run', id: `run-${newId('event')}` } }, random);
  }

  async function storedPayload(h: DbHandle, id: string): Promise<unknown> {
    const [row] = await h.sql<{ payload: unknown; kind: string }[]>`
      select payload, jsonb_typeof(payload) as kind from platform_outbox where id = ${id}`;
    // An object column, not a JSON string stored as a jsonb scalar.
    expect(row?.kind).toBe('object');
    return row?.payload;
  }

  it('appends without a caller transaction and the payload round-trips', async () => {
    const h = await boot();
    const envelope = event();
    await new PgOutboxWriter(h.sql).append(envelope);
    expect(await storedPayload(h, envelope.id)).toEqual(envelope);
  });

  it('appends on a caller transaction and the payload round-trips', async () => {
    const h = await boot();
    const envelope = event();
    const writer = new PgOutboxWriter(h.sql);
    await h.sql.begin(async (tx) => {
      await writer.append(envelope, tx);
    });
    expect(await storedPayload(h, envelope.id)).toEqual(envelope);
  });

  it('the relay on the same client claims the row and sends the envelope object', async () => {
    const h = await boot();
    const envelope = event();
    await new PgOutboxWriter(h.sql).append(envelope);
    const sent: { data: object; idempotencyKey: string }[] = [];
    const relay = new OutboxRelay({
      sql: h.sql,
      queue: {
        send: (_queue, data, options) => {
          sent.push({ data, idempotencyKey: options.idempotencyKey });
          return Promise.resolve({ jobId: options.idempotencyKey, enqueued: true });
        },
      },
      logger: pino(loggerOptions({ level: 'silent', service: 'api-test' }), memoryLogStream()),
      routeEvent: () => 'test.outbox.createdb',
    });
    const result = await relay.pollOnce();
    expect(result).toMatchObject({ dispatched: result.claimed, failed: 0, retrying: 0 });
    expect(sent.find((s) => s.idempotencyKey === envelope.id)?.data).toEqual(envelope);
  });
});
