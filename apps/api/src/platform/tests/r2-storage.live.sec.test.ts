// Live R2 round-trip (P02-T13): the same constraints as r2-storage.sec.test.ts, enforced by R2
// itself. Runs only when the R2_* keys are in the environment (direnv loads them from `.env` after
// `just secrets-sync`), then `just test platform` uses the configured dev bucket; without them the
// suite is skipped, which is the only skip (CI has no R2 credentials). Some but not all keys set →
// loadConfig fails the file instead of skipping. Writes and overwrites one synthetic object,
// `uploads/live-test/round-trip.txt`, so repeated runs never accumulate objects.
import { describe, expect, it } from 'vitest';
import pino from 'pino';

import { fakeClock } from '@ai-stylist/test-support';

import { loadConfig } from '../../config.js';
import { loggerOptions } from '../logger.js';
import { SystemClock } from '../ports/clock.port.js';
import { createStorageProvider } from '../storage/create-storage-provider.js';
import { R2StorageProvider } from '../storage/r2-storage-provider.js';

const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const credentialsPresent = R2_KEYS.some((key) => (process.env[key] ?? '').trim() !== '');

describe.runIf(credentialsPresent)(
  'R2 live round-trip (runs only when R2_* credentials are set; skipped without them)',
  () => {
    const config = loadConfig(process.env);
    const logger = pino(loggerOptions({ level: 'silent' }));
    const provider = (clock = new SystemClock()) =>
      createStorageProvider({
        accountId: config.R2_ACCOUNT_ID,
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
        bucket: config.R2_BUCKET,
        clock,
        logger,
      });
    const location = { namespace: 'uploads', key: 'live-test/round-trip.txt' } as const;
    const body = new Uint8Array(
      Buffer.from(`ai-stylist r2 live round-trip ${new Date().toISOString()}`),
    );
    const upload = (url: string, payload = body, contentType = 'text/plain') =>
      fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body: payload });

    it('binds the R2 adapter from the environment', () => {
      expect(provider()).toBeInstanceOf(R2StorageProvider);
    });

    it('R2 refuses another type, another size and an edited URL, then accepts the signed upload', async () => {
      const minted = await provider().presignedPut({
        ...location,
        contentType: 'text/plain',
        sizeLimitBytes: body.byteLength,
        ttlSeconds: 120,
      });
      expect((await upload(minted.url, body, 'image/png')).status).toBe(403);
      expect((await upload(minted.url, new Uint8Array([...body, 0x41]))).status).toBe(403);
      expect((await upload(minted.url.replace('/uploads/', '/derived/'))).status).toBe(403);
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
