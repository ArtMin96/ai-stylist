import { describe, expect, it } from 'vitest';

import { fakeClock } from '@ai-stylist/test-support';

import {
  InMemoryStorageProvider,
  MAX_PRESIGN_TTL_SECONDS,
  StorageError,
  clampTtl,
} from '../ports/storage.port.js';

describe('StorageProvider port (in-memory fake)', () => {
  it('caps presigned TTLs at 15 minutes', async () => {
    expect(clampTtl(3600)).toBe(MAX_PRESIGN_TTL_SECONDS);
    expect(clampTtl(60)).toBe(60);
    expect(() => clampTtl(0)).toThrow(StorageError);
    const clock = fakeClock('2026-09-10T12:00:00.000Z');
    const storage = new InMemoryStorageProvider(() => clock.now());
    const put = await storage.presignedPut({
      namespace: 'uploads',
      key: 'usr_1/ast_1.jpg',
      contentType: 'image/jpeg',
      sizeLimitBytes: 10_000_000,
      ttlSeconds: 86_400,
    });
    expect(put.method).toBe('PUT');
    expect(put.expiresAt).toBe('2026-09-10T12:15:00.000Z');
  });

  it('rejects unknown objects and invalid constraints', async () => {
    const storage = new InMemoryStorageProvider();
    await expect(
      storage.presignedGet({ namespace: 'derived', key: 'missing', ttlSeconds: 60 }),
    ).rejects.toThrow(StorageError);
    await expect(
      storage.presignedPut({
        namespace: 'uploads',
        key: 'k',
        contentType: 'jpeg',
        sizeLimitBytes: 1,
        ttlSeconds: 60,
      }),
    ).rejects.toThrow(/contentType/);
  });
});
