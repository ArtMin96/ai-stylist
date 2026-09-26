// PgIdempotencyGuard against a real, migrated Postgres (Testcontainers, `platform-docker` project).
// P02-T08 lead decision D2: durable effect-once per key in the handler, on
// `platform_idempotency_keys`. FAILS without Docker, never skips.
import postgres, { type Sql } from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

import { migrateUrl } from '@ai-stylist/db';
import { newId } from '@ai-stylist/shared-kernel';
import { type StartedPostgres, startPostgres } from '@ai-stylist/test-support';

import {
  IdempotencyKeyBusyError,
  IdempotencyKeyConflictError,
  PgIdempotencyGuard,
} from '../idempotency/pg-idempotency-guard.js';

const SCOPE = 'job:test.effect';
const RETENTION_SECONDS = 3_600;

describe('PgIdempotencyGuard (Testcontainers Postgres)', () => {
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;

  afterAll(async () => {
    await sql?.end();
    await pg?.stop();
  });

  /** Started lazily inside the first test so a missing Docker daemon FAILS a test (never skips). */
  async function boot(): Promise<Sql> {
    if (sql !== undefined) return sql;
    pg = await startPostgres();
    await migrateUrl(pg.url);
    sql = postgres(pg.url, { max: 4 });
    return sql;
  }

  async function keyRows(db: Sql, key: string): Promise<number> {
    const rows = await db<{ n: number }[]>`
      select count(*)::int as n from platform_idempotency_keys where key = ${key}`;
    return rows[0]?.n ?? -1;
  }

  it('runs the effect once when the same key is used twice', async () => {
    const db = await boot();
    const guard = new PgIdempotencyGuard(db);
    const key = newId('event');
    let runs = 0;
    const effect = () => {
      runs += 1;
      return Promise.resolve(runs);
    };

    const request = { key, scope: SCOPE, retentionSeconds: RETENTION_SECONDS };

    const first = await guard.runOnce(request, effect);
    const second = await guard.runOnce(request, effect);

    expect(first).toEqual({ ran: true, value: 1 });
    expect(second).toEqual({ ran: false });
    expect(runs).toBe(1);
    expect(await keyRows(db, key)).toBe(1);
  });

  it('releases the key when the effect throws, so a retry runs it again and then only once', async () => {
    const db = await boot();
    const guard = new PgIdempotencyGuard(db);
    const key = newId('event');
    const request = { key, scope: SCOPE, retentionSeconds: RETENTION_SECONDS };
    let runs = 0;

    await expect(
      guard.runOnce(request, () => {
        runs += 1;
        return Promise.reject(new Error('provider unavailable'));
      }),
    ).rejects.toThrow('provider unavailable');
    expect(await keyRows(db, key)).toBe(0);

    const retry = await guard.runOnce(request, () => {
      runs += 1;
      return Promise.resolve('done');
    });
    const again = await guard.runOnce(request, () => {
      runs += 1;
      return Promise.resolve('duplicate');
    });

    expect(retry).toEqual({ ran: true, value: 'done' });
    expect(again).toEqual({ ran: false });
    expect(runs).toBe(2);
    expect(await keyRows(db, key)).toBe(1);
  });

  it('fails a concurrent call on an in-flight key with IdempotencyKeyBusyError after claimWaitMs', async () => {
    const db = await boot();
    const guard = new PgIdempotencyGuard(db, { claimWaitMs: 200 });
    const key = newId('event');
    const request = { key, scope: SCOPE, retentionSeconds: RETENTION_SECONDS };
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let claimedFirst: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      claimedFirst = resolve;
    });

    const first = guard.runOnce(request, async () => {
      claimedFirst();
      await held;
      return 'first';
    });
    await started;
    await expect(guard.runOnce(request, () => Promise.resolve('second'))).rejects.toBeInstanceOf(
      IdempotencyKeyBusyError,
    );
    release();

    expect(await first).toEqual({ ran: true, value: 'first' });
    expect(await guard.runOnce(request, () => Promise.resolve('third'))).toEqual({ ran: false });
  });

  it('rejects a completed key reused under another scope', async () => {
    const db = await boot();
    const guard = new PgIdempotencyGuard(db);
    const key = newId('event');
    await guard.runOnce({ key, scope: SCOPE, retentionSeconds: RETENTION_SECONDS }, () =>
      Promise.resolve(),
    );

    await expect(
      guard.runOnce({ key, scope: 'job:other', retentionSeconds: RETENTION_SECONDS }, () =>
        Promise.resolve(),
      ),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
  });

  it('re-claims an expired key and runs the effect again', async () => {
    const db = await boot();
    const guard = new PgIdempotencyGuard(db);
    const key = newId('event');
    const request = { key, scope: SCOPE, retentionSeconds: RETENTION_SECONDS };
    await guard.runOnce(request, () => Promise.resolve());
    await db`update platform_idempotency_keys set expires_at = now() - interval '1 second'
      where key = ${key}`;

    expect(await guard.runOnce(request, () => Promise.resolve('again'))).toEqual({
      ran: true,
      value: 'again',
    });
    expect(await keyRows(db, key)).toBe(1);
  });
});
