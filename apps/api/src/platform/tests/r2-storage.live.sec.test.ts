// Live R2 round-trip (P02-T13): the same constraints as r2-storage.sec.test.ts, enforced by R2
// itself. Runs only on an explicit opt-in, `R2_LIVE_TEST=1`, in addition to the R2_* keys (direnv
// loads them from `.env` after `just secrets-sync`): `R2_LIVE_TEST=1 just test platform` then
// writes to the bucket R2_BUCKET names. Credentials alone never run it, so a shell that happens to
// hold staging or prod keys does not touch that bucket. Without the opt-in the suite is skipped,
// which is the only skip (CI sets no opt-in and has no R2 credentials). Opted in without the four
// keys it fails instead of skipping (the R2 adapter is not bound; a partial set fails loadConfig).
// Writes and overwrites one synthetic object of a synthetic user,
// `u/usr_0000000000000000000000TEST/uploads/live-test/round-trip.txt`, so repeated runs never
// accumulate objects.
import { beforeAll, describe, expect, it } from 'vitest';
import pino from 'pino';

import { formatId } from '@ai-stylist/shared-kernel';
import { fakeClock } from '@ai-stylist/test-support';

import { type AppConfig, loadConfig } from '../../config.js';
import { loggerOptions } from '../logger.js';
import { type Clock, SystemClock } from '../ports/clock.port.js';
import { createStorageProvider } from '../storage/create-storage-provider.js';
import { R2StorageProvider } from '../storage/r2-storage-provider.js';

const LIVE_OPT_IN = process.env.R2_LIVE_TEST === '1';
/** A synthetic user that owns no real data: the live object's prefix. */
const LIVE_USER = formatId('user', '0000000000000000000000TEST');
const OTHER_USER = formatId('user', '0000000000000000000000TESS');

describe.runIf(LIVE_OPT_IN)(
  'R2 live round-trip (runs only with R2_LIVE_TEST=1 and the R2_* keys; skipped otherwise)',
  () => {
    // Loaded when the suite runs, never while a skipped suite is collected.
    let config: AppConfig;
    beforeAll(() => {
      config = loadConfig(process.env);
      // The suite writes a synthetic object; never let it touch a staging or prod bucket.
      if (config.APP_ENV === 'staging' || config.APP_ENV === 'prod') {
        throw new Error('the R2 live suite runs against local or dev buckets only');
      }
    });
    const logger = pino(loggerOptions({ level: 'silent' }));
    const provider = (clock: Clock = new SystemClock()) =>
      createStorageProvider({
        accountId: config.R2_ACCOUNT_ID,
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
        bucket: config.R2_BUCKET,
        clock,
        logger,
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
