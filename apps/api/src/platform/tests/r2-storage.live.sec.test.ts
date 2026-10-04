// Live R2 round-trip (P02-T13): the same constraints as r2-storage.sec.test.ts, enforced by R2
// itself. Runs only on an explicit opt-in, `R2_LIVE_TEST=1`, in addition to the R2_* keys (direnv
// loads them from `.env` after `just secrets-sync`): `R2_LIVE_TEST=1 just test platform` then
// writes to the bucket R2_BUCKET names. Credentials alone never run it, so a shell that happens to
// hold staging or prod keys does not touch that bucket. Without the opt-in the suite is skipped,
// which is the only skip (CI sets no opt-in and has no R2 credentials). Opted in without the four
// keys it fails instead of skipping (the factory is told the in-memory provider is not allowed, and
// the R2 adapter refuses a missing key by name).
// Writes and overwrites one synthetic object of a synthetic user,
// `u/usr_0000000000000000000000TEST/uploads/live-test/round-trip.txt`, so repeated runs never
// accumulate objects.
//
// It reads the four R2_* keys and APP_ENV from `process.env` itself and calls
// `createStorageProvider` directly: platform tests never import the app's config.
import { beforeAll, describe, expect, it } from 'vitest';
import pino from 'pino';

import { type Clock, formatId } from '@ai-stylist/shared-kernel';
import { fakeClock } from '@ai-stylist/test-support';

import { loggerOptions } from '../logger.js';
import { createStorageProvider } from '../storage/create-storage-provider.js';
import { R2StorageProvider } from '../storage/r2-storage-provider.js';
import { SystemClock } from '../system-clock.js';

/**
 * Buckets the live suite may write to. Bucket names follow `ai-stylist-<env>` (docs/SERVICES-SETUP.md
 * §6: the dev bucket is `ai-stylist-dev`, then `ai-stylist-staging` and `ai-stylist-prod`; public
 * assets are `ai-stylist-assets-<env>`, backups `ai-stylist-pg-backups`). Only a name that ends in
 * `-dev` or `-local` passes, so the documented dev bucket does and a staging, prod or backup bucket
 * never does, whatever APP_ENV says: a dev shell that sourced another environment's keys refuses
 * instead of writing there.
 */
const LIVE_BUCKET_NAME = /-(dev|local)$/;

/** APP_ENV values the live suite runs under (unset means `local`, the config default). */
const LIVE_APP_ENVS: ReadonlySet<string> = new Set(['', 'local', 'dev']);

/** Why the live suite refuses this environment, or `undefined` when it may run. Names no value. */
function liveTargetRefusal(env: {
  readonly APP_ENV?: string | undefined;
  readonly R2_BUCKET?: string | undefined;
}): string | undefined {
  if (!LIVE_APP_ENVS.has(env.APP_ENV?.trim() ?? '')) {
    return 'the R2 live suite runs with APP_ENV unset, local or dev only';
  }
  if (!LIVE_BUCKET_NAME.test(env.R2_BUCKET?.trim() ?? '')) {
    return 'the R2 live suite writes only to a bucket whose name ends in -dev or -local (R2_BUCKET)';
  }
  return undefined;
}

const LIVE_OPT_IN = process.env.R2_LIVE_TEST === '1';
/** A synthetic user that owns no real data: the live object's prefix. */
const LIVE_USER = formatId('user', '0000000000000000000000TEST');
const OTHER_USER = formatId('user', '0000000000000000000000TESS');

describe.runIf(LIVE_OPT_IN)(
  'R2 live round-trip (runs only with R2_LIVE_TEST=1 and the R2_* keys; skipped otherwise)',
  () => {
    // Read when the suite runs, never while a skipped suite is collected.
    let env: Readonly<Record<string, string | undefined>> = {};
    beforeAll(() => {
      env = process.env;
      // The suite writes a synthetic object; never let it touch a staging, prod or backup bucket.
      const refusal = liveTargetRefusal(env);
      if (refusal !== undefined) throw new Error(refusal);
    });
    const logger = pino(loggerOptions({ level: 'silent' }));
    const provider = (clock: Clock = new SystemClock()) =>
      createStorageProvider({
        accountId: env['R2_ACCOUNT_ID'],
        accessKeyId: env['R2_ACCESS_KEY_ID'],
        secretAccessKey: env['R2_SECRET_ACCESS_KEY'],
        bucket: env['R2_BUCKET'],
        clock,
        logger,
        // The live suite tests R2: without the keys it fails, never falls back to in-memory.
        allowsInMemory: false,
      });
    const location = {
      userId: LIVE_USER,
      namespace: 'uploads',
      key: 'live-test/round-trip.txt',
    } as const;
    const body = new Uint8Array(
      Buffer.from(`ai-stylist r2 live round-trip ${new Date().toISOString()}`),
    );
    const upload = (url: string, payload = body, contentType = 'text/plain') =>
      fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body: payload });

    it('binds the R2 adapter from the environment', () => {
      expect(provider()).toBeInstanceOf(R2StorageProvider);
    });

    it("R2 refuses another type, another size, an edited URL and another user's prefix, then accepts the signed upload", async () => {
      const minted = await provider().presignedPut({
        ...location,
        contentType: 'text/plain',
        sizeLimitBytes: body.byteLength,
        ttlSeconds: 120,
      });
      expect(new URL(minted.url).pathname).toContain(`/u/${LIVE_USER}/uploads/`);
      expect((await upload(minted.url, body, 'image/png')).status).toBe(403);
      expect((await upload(minted.url, new Uint8Array([...body, 0x41]))).status).toBe(403);
      expect((await upload(minted.url.replace('/uploads/', '/derived/'))).status).toBe(403);
      expect(
        (await upload(minted.url.replace(`/u/${LIVE_USER}/`, `/u/${OTHER_USER}/`))).status,
      ).toBe(403);
      expect(
        (await upload(minted.url.replace('X-Amz-Expires=120', 'X-Amz-Expires=600'))).status,
      ).toBe(403);
      expect((await upload(minted.url)).status).toBe(200);

      const read = await provider().presignedGet({ ...location, ttlSeconds: 120 });
      const res = await fetch(read.url);
      expect(res.status).toBe(200);
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(body);
    });

    it('R2 refuses an expired GET URL', async () => {
      // Signed "five minutes ago" for one minute: expired when it reaches R2.
      const past = fakeClock(new Date(Date.now() - 5 * 60_000));
      const expired = await provider(past).presignedGet({ ...location, ttlSeconds: 60 });
      expect((await fetch(expired.url)).status).toBe(403);
    });
  },
);

// Always runs (no network, no credentials): the target guard above.
describe('R2 live suite target guard', () => {
  it.each(['ai-stylist-dev', 'ai-stylist-local', 'ai-stylist-assets-dev'])(
    'allows the bucket %s with APP_ENV unset, local or dev',
    (R2_BUCKET) => {
      for (const APP_ENV of [undefined, '', 'local', 'dev']) {
        expect(liveTargetRefusal({ APP_ENV, R2_BUCKET })).toBeUndefined();
      }
    },
  );

  it.each([
    'ai-stylist-staging',
    'ai-stylist-prod',
    'ai-stylist-pg-backups',
    'ai-stylist-dev-archive',
    'ai-stylist-test',
    '',
  ])('refuses the bucket %j', (R2_BUCKET) => {
    expect(liveTargetRefusal({ APP_ENV: 'dev', R2_BUCKET })).toMatch(/-dev or -local/);
  });

  it.each(['staging', 'prod', 'production'])(
    'refuses APP_ENV=%s even for a dev bucket',
    (APP_ENV) => {
      expect(liveTargetRefusal({ APP_ENV, R2_BUCKET: 'ai-stylist-dev' })).toMatch(/APP_ENV/);
    },
  );
});
