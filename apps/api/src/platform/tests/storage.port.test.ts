import { describe, expect, it } from 'vitest';

import { fakeClock } from '@ai-stylist/test-support';

import {
  InMemoryStorageProvider,
  MAX_PRESIGN_GET_TTL_SECONDS,
  MAX_PRESIGN_PUT_TTL_SECONDS,
  StorageError,
  clampTtl,
} from '../ports/storage.port.js';

describe('StorageProvider port (in-memory fake)', () => {
  it('clamps TTLs per method (GET 10 min, PUT 15 min) and rejects non-positive TTLs', async () => {
    expect(clampTtl(3600, 'PUT')).toBe(MAX_PRESIGN_PUT_TTL_SECONDS);
    expect(clampTtl(3600, 'GET')).toBe(MAX_PRESIGN_GET_TTL_SECONDS);
    expect(clampTtl(60, 'PUT')).toBe(60);
    expect(clampTtl(60, 'GET')).toBe(60);
    expect(() => clampTtl(0, 'PUT')).toThrow(StorageError);
    expect(() => clampTtl(0, 'GET')).toThrow(StorageError);
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

  it('caps presigned GET TTLs at 10 minutes and PUT TTLs at 15 minutes (doc 11 §5.4)', async () => {
    const clock = fakeClock('2026-09-10T12:00:00.000Z');
    const storage = new InMemoryStorageProvider(() => clock.now());
    const put = await storage.presignedPut({
      namespace: 'uploads',
      key: 'usr_1/ast_2.jpg',
      contentType: 'image/jpeg',
      sizeLimitBytes: 10_000_000,
      ttlSeconds: 86_400,
    });
    expect(put.expiresAt).toBe('2026-09-10T12:15:00.000Z');
    const get = await storage.presignedGet({
      namespace: 'uploads',
      key: 'usr_1/ast_2.jpg',
      ttlSeconds: 86_400,
    });
    expect(get.method).toBe('GET');
    expect(get.expiresAt).toBe('2026-09-10T12:10:00.000Z');
    const shortGet = await storage.presignedGet({
      namespace: 'uploads',
      key: 'usr_1/ast_2.jpg',
      ttlSeconds: 60,
    });
    expect(shortGet.expiresAt).toBe('2026-09-10T12:01:00.000Z');
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
