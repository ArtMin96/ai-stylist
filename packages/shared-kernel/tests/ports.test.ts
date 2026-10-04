import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  CLOCK,
  FEATURE_FLAGS,
  MAX_PRESIGN_GET_TTL_SECONDS,
  MAX_PRESIGN_PUT_TTL_SECONDS,
  OUTBOX_WRITER,
  STORAGE_NAMESPACES,
  STORAGE_PROVIDER,
  StorageError,
  assertUploadConstraints,
  clampTtl,
  formatId,
  objectKeyOf,
} from '../src/index.js';

// Synthetic user id (valid `usr_<ULID>`).
const USER = formatId('user', '01JA00000000000000000000AA');

/** The refusal a call throws, or `undefined` when it does not throw. */
function refusalOf(call: () => unknown): string | undefined {
  try {
    call();
    return undefined;
  } catch (error) {
    expect(error).toBeInstanceOf(StorageError);
    return (error as StorageError).refusal;
  }
}

describe('port tokens', () => {
  it('are registry symbols, so a second installed copy of the kernel resolves the same token', () => {
    expect(CLOCK).toBe(Symbol.for('ai-stylist.clock'));
    expect(OUTBOX_WRITER).toBe(Symbol.for('ai-stylist.outbox-writer'));
    expect(STORAGE_PROVIDER).toBe(Symbol.for('ai-stylist.storage-provider'));
    expect(FEATURE_FLAGS).toBe(Symbol.for('ai-stylist.feature-flags'));
    expect(new Set([CLOCK, OUTBOX_WRITER, STORAGE_PROVIDER, FEATURE_FLAGS]).size).toBe(4);
  });
});

describe('clampTtl', () => {
  it('caps GET at 10 min and PUT at 15 min (doc 11 §5.4)', () => {
    expect(MAX_PRESIGN_GET_TTL_SECONDS).toBe(600);
    expect(MAX_PRESIGN_PUT_TTL_SECONDS).toBe(900);
    expect(clampTtl(3600, 'GET')).toBe(600);
    expect(clampTtl(3600, 'PUT')).toBe(900);
    expect(clampTtl(59.9, 'GET')).toBe(59);
  });

  it('never exceeds the cap and is at least 1 for any TTL >= 1', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1e9, noNaN: true }),
        fc.constantFrom('GET' as const, 'PUT' as const),
        (ttl, method) => {
          const cap = method === 'GET' ? MAX_PRESIGN_GET_TTL_SECONDS : MAX_PRESIGN_PUT_TTL_SECONDS;
          const clamped = clampTtl(ttl, method);
          return clamped >= 1 && clamped <= cap && Number.isInteger(clamped);
        },
      ),
    );
  });

  it('refuses a TTL under one second or not a number', () => {
    for (const ttl of [0, 0.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(refusalOf(() => clampTtl(ttl, 'PUT'))).toBe('ttl');
    }
  });
});

describe('objectKeyOf', () => {
  it('builds u/<userId>/<namespace>/<key> for every namespace', () => {
    for (const namespace of STORAGE_NAMESPACES) {
      expect(objectKeyOf({ userId: USER, namespace, key: 'a/b.jpg' })).toBe(
        `u/${USER}/${namespace}/a/b.jpg`,
      );
    }
  });

  it('refuses a malformed user id, an unknown namespace and a key that leaves its namespace', () => {
    const bad = (location: Record<string, unknown>) =>
      refusalOf(() => objectKeyOf(location as unknown as Parameters<typeof objectKeyOf>[0]));
    expect(bad({ userId: 'usr_nope', namespace: 'uploads', key: 'a' })).toBe('user_id');
    expect(bad({ userId: USER, namespace: 'other', key: 'a' })).toBe('namespace');
    for (const key of [
      '',
      '/a',
      'a//b',
      '../a',
      'a/./b',
      'a\\b',
      'a%2Fb',
      'a b',
      'x'.repeat(1100),
    ]) {
      expect(bad({ userId: USER, namespace: 'uploads', key })).toBe('key');
    }
  });
});

describe('assertUploadConstraints', () => {
  const put = { userId: USER, namespace: 'uploads' as const, key: 'a.jpg', ttlSeconds: 60 };

  it('accepts a bare media type and a positive integer size', () => {
    expect(
      refusalOf(() =>
        assertUploadConstraints({ ...put, contentType: 'image/jpeg', sizeLimitBytes: 1 }),
      ),
    ).toBeUndefined();
  });

  it('refuses a parameterised media type and a non-positive or fractional size', () => {
    expect(
      refusalOf(() =>
        assertUploadConstraints({ ...put, contentType: 'image/jpeg; q=1', sizeLimitBytes: 1 }),
      ),
    ).toBe('content_type');
    for (const sizeLimitBytes of [0, -1, 1.5]) {
      expect(
        refusalOf(() =>
          assertUploadConstraints({ ...put, contentType: 'image/png', sizeLimitBytes }),
        ),
      ).toBe('size');
    }
  });
});
