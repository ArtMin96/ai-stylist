import { describe, expect, it } from 'vitest';

import {
  fakeClock,
  fakeFeatureFlags,
  fakeStorageProvider,
  memoryLogStream,
  recordingOutboxWriter,
} from '../src/index.js';

describe('fakeClock', () => {
  it('is deterministic and advances only when told', () => {
    const clock = fakeClock('2026-03-01T10:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-03-01T10:00:00.000Z');
    clock.advance(60_000);
    expect(clock.now().toISOString()).toBe('2026-03-01T10:01:00.000Z');
    clock.set('2027-01-01T00:00:00.000Z');
    expect(clock.now().getUTCFullYear()).toBe(2027);
  });
});

describe('fakeFeatureFlags', () => {
  it('answers the given values, flips with set, and reads an unset key as off', async () => {
    const flags = fakeFeatureFlags<'flag-a' | 'flag-b'>({ 'flag-a': true });
    expect(await flags.isEnabled('flag-a')).toBe(true);
    expect(await flags.isEnabled('flag-b')).toBe(false);
    flags.set('flag-a', false);
    flags.set('flag-b', true);
    expect(await flags.isEnabled('flag-a')).toBe(false);
    expect(await flags.isEnabled('flag-b')).toBe(true);
  });

  it('does not share state between fakes or mutate the given values', async () => {
    const values = { 'flag-a': true };
    const first = fakeFeatureFlags(values);
    const second = fakeFeatureFlags(values);
    first.set('flag-a', false);
    expect(await second.isEnabled('flag-a')).toBe(true);
    expect(values).toEqual({ 'flag-a': true });
  });
});

describe('recordingOutboxWriter', () => {
  it('records every appended envelope in order and resolves', async () => {
    const outbox = recordingOutboxWriter<{ id: string }>();
    await outbox.append({ id: 'evt_a' });
    await outbox.append({ id: 'evt_b' }, { tx: 'ignored' });
    expect(outbox.appended).toEqual([{ id: 'evt_a' }, { id: 'evt_b' }]);
  });
});

describe('fakeStorageProvider', () => {
  it('signs deterministic URLs, expires at now + ttl, and records each request', async () => {
    const clock = fakeClock('2026-03-01T10:00:00.000Z');
    const storage = fakeStorageProvider(() => clock.now());
    const location = { userId: 'usr_x', namespace: 'uploads', key: 'a/b.jpg' };

    const put = await storage.presignedPut({
      ...location,
      contentType: 'image/jpeg',
      sizeLimitBytes: 10,
      ttlSeconds: 60,
    });
    const get = await storage.presignedGet({ ...location, ttlSeconds: 30 });

    expect(put).toEqual({
      method: 'PUT',
      url: 'fake://storage/u/usr_x/uploads/a/b.jpg?method=PUT',
      expiresAt: '2026-03-01T10:01:00.000Z',
    });
    expect(get.method).toBe('GET');
    expect(get.expiresAt).toBe('2026-03-01T10:00:30.000Z');
    expect(storage.requests.map((r) => r.method)).toEqual(['PUT', 'GET']);
  });
});

describe('memoryLogStream', () => {
  it('collects lines and parses JSON records', async () => {
    const stream = memoryLogStream();
    await new Promise<void>((resolve) =>
      stream.write('{"level":30,"msg":"a"}\n{"level":40,"msg":"b"}\nnot json\n', () => resolve()),
    );
    expect(stream.lines()).toHaveLength(3);
    expect(stream.records().map((r) => r['msg'])).toEqual(['a', 'b']);
  });
});
