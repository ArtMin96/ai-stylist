import { describe, expect, it } from 'vitest';

import { formatId } from '@ai-stylist/shared-kernel';
import { fakeClock } from '@ai-stylist/test-support';

import {
  InMemoryStorageProvider,
  MAX_PRESIGN_GET_TTL_SECONDS,
  MAX_PRESIGN_PUT_TTL_SECONDS,
  StorageError,
  clampTtl,
} from '../ports/storage.port.js';

// Synthetic user ids (valid `usr_<ULID>`).
const USER_A = formatId('user', '01JA00000000000000000000AA');
const USER_B = formatId('user', '01JB00000000000000000000BB');

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
      userId: USER_A,
      namespace: 'uploads',
      key: 'ast_1.jpg',
      contentType: 'image/jpeg',
      sizeLimitBytes: 10_000_000,
      ttlSeconds: 86_400,
    });
    expect(put.method).toBe('PUT');
    expect(put.expiresAt).toBe('2026-09-10T12:15:00.000Z');
  });

  it('rejects a TTL under one second, which would floor to an already-expired 0 s URL', () => {
    expect(() => clampTtl(0.5, 'PUT')).toThrow(StorageError);
    expect(() => clampTtl(0.999, 'GET')).toThrow(StorageError);
    expect(clampTtl(1.5, 'GET')).toBe(1);
  });

  it('caps presigned GET TTLs at 10 minutes and PUT TTLs at 15 minutes (doc 11 §5.4)', async () => {
    const clock = fakeClock('2026-09-10T12:00:00.000Z');
    const storage = new InMemoryStorageProvider(() => clock.now());
    const put = await storage.presignedPut({
      userId: USER_A,
      namespace: 'uploads',
      key: 'ast_2.jpg',
      contentType: 'image/jpeg',
      sizeLimitBytes: 10_000_000,
      ttlSeconds: 86_400,
    });
    expect(put.expiresAt).toBe('2026-09-10T12:15:00.000Z');
    const get = await storage.presignedGet({
      userId: USER_A,
      namespace: 'uploads',
      key: 'ast_2.jpg',
      ttlSeconds: 86_400,
    });
    expect(get.method).toBe('GET');
    expect(get.expiresAt).toBe('2026-09-10T12:10:00.000Z');
    const shortGet = await storage.presignedGet({
      userId: USER_A,
      namespace: 'uploads',
      key: 'ast_2.jpg',
      ttlSeconds: 60,
    });
    expect(shortGet.expiresAt).toBe('2026-09-10T12:01:00.000Z');
  });

  it('rejects unknown objects and invalid constraints', async () => {
    const storage = new InMemoryStorageProvider();
    await expect(
      storage.presignedGet({
        userId: USER_A,
        namespace: 'derived',
        key: 'missing',
        ttlSeconds: 60,
      }),
    ).rejects.toThrow(StorageError);
    await expect(
      storage.presignedPut({
        userId: USER_A,
        namespace: 'uploads',
        key: 'k',
        contentType: 'jpeg',
        sizeLimitBytes: 1,
        ttlSeconds: 60,
      }),
    ).rejects.toThrow(/contentType/);
  });

  it('stores every object under u/<user id>/ and never lets one user read the object of another (doc 11 §4.3)', async () => {
    const storage = new InMemoryStorageProvider(() => new Date('2026-09-10T12:00:00.000Z'));
    const upload = { namespace: 'uploads', key: 'ast_1.jpg', ttlSeconds: 60 } as const;
    const constraints = { contentType: 'image/jpeg', sizeLimitBytes: 1 } as const;
    const putOfA = await storage.presignedPut({ userId: USER_A, ...upload, ...constraints });
    expect(new URL(putOfA.url).pathname).toBe(`/u/${USER_A}/uploads/ast_1.jpg`);
    expect([...storage.objects.keys()]).toEqual([`u/${USER_A}/uploads/ast_1.jpg`]);

    // Same namespace and key for user B: not found until B uploads, then two separate objects.
    await expect(storage.presignedGet({ userId: USER_B, ...upload })).rejects.toThrow(StorageError);
    await storage.presignedPut({ userId: USER_B, ...upload, ...constraints });
    expect([...storage.objects.keys()].sort()).toEqual([
      `u/${USER_A}/uploads/ast_1.jpg`,
      `u/${USER_B}/uploads/ast_1.jpg`,
    ]);

    // A key naming another user's prefix stays a nested path inside the caller's own prefix.
    const nested = await storage.presignedPut({
      userId: USER_A,
      ...upload,
      key: `u/${USER_B}/uploads/ast_9.jpg`,
      ...constraints,
    });
    expect(new URL(nested.url).pathname).toBe(`/u/${USER_A}/uploads/u/${USER_B}/uploads/ast_9.jpg`);
    await expect(
      storage.presignedGet({ userId: USER_B, ...upload, key: 'ast_9.jpg' }),
    ).rejects.toThrow(StorageError);
  });
});
