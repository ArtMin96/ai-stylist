// Which StorageProvider the composition root binds (P02-T13): `createStorageProvider`. No R2 key →
// in-memory, only when the caller allows it (`allowsInMemory`, required); any key → the R2 adapter,
// which refuses a missing or malformed key by name. The boot rules of the R2_* keys (presence,
// all-or-none, the staging/prod refusal) are apps/api/src/config.ts, tested in
// apps/api/tests/config.test.ts: platform tests do not import the app's config.
import { describe, expect, it } from 'vitest';
import pino from 'pino';

import { fakeClock, memoryLogStream } from '@ai-stylist/test-support';

import { loggerOptions } from '../logger.js';
import { createStorageProvider } from '../storage/create-storage-provider.js';
import { InMemoryStorageProvider } from '../storage/in-memory-storage-provider.js';
import { R2StorageProvider } from '../storage/r2-storage-provider.js';

// Synthetic values only (the secret is AWS's public documentation example).
const R2 = {
  R2_ACCOUNT_ID: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  R2_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  R2_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  R2_BUCKET: 'ai-stylist-test',
} as const;

function factoryConfig(env: Partial<Record<keyof typeof R2, string>>, allowsInMemory = true) {
  const logs = memoryLogStream();
  return {
    logs,
    config: {
      allowsInMemory,
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      clock: fakeClock('2026-09-10T12:00:00.000Z'),
      logger: pino(loggerOptions({ level: 'info' }), logs),
    },
  };
}

describe('createStorageProvider', () => {
  it('binds the in-memory provider when no R2 key is set (empty and blank values count as unset)', () => {
    for (const env of [{}, { R2_ACCOUNT_ID: '', R2_BUCKET: '  ' }]) {
      const { config, logs } = factoryConfig(env);
      expect(createStorageProvider(config)).toBeInstanceOf(InMemoryStorageProvider);
      expect(logs.records()).toEqual([
        expect.objectContaining({ component: 'storage', provider: 'in-memory' }),
      ]);
    }
  });

  // Defence in depth behind `loadConfig`: the composition root passes `isLocalOrDevDeployment`.
  it('refuses the in-memory provider when the environment does not allow it', () => {
    const { config, logs } = factoryConfig({}, false);
    expect(() => createStorageProvider(config)).toThrow(
      'storage: no R2 keys, and this environment does not allow the in-memory provider; set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET',
    );
    expect(() => createStorageProvider({ ...config, bucket: ' ' })).toThrow(
      /does not allow the in-memory provider/,
    );
    expect(logs.records()).toEqual([]);
    expect(createStorageProvider(factoryConfig(R2, false).config)).toBeInstanceOf(
      R2StorageProvider,
    );
  });

  it('binds R2 when all four keys are set, and logs no key value', () => {
    const { config, logs } = factoryConfig(R2);
    expect(createStorageProvider(config)).toBeInstanceOf(R2StorageProvider);
    expect(logs.records()).toEqual([
      expect.objectContaining({ component: 'storage', provider: 'r2' }),
    ]);
    for (const value of Object.values(R2)) expect(logs.text()).not.toContain(value);
  });

  // `loadConfig` refuses a partial set first; behind it, the adapter refuses the empty key.
  it('refuses a partial R2 configuration, naming a missing key and no value', () => {
    const { R2_SECRET_ACCESS_KEY: _secret, ...partial } = R2;
    const { config, logs } = factoryConfig(partial);
    expect(() => createStorageProvider(config)).toThrow(
      'R2: secretAccessKey (R2_SECRET_ACCESS_KEY) must be non-empty without whitespace',
    );
    expect(logs.records()).toEqual([]);
  });

  it('refuses a malformed key by name, never echoing its value', () => {
    const cases = {
      R2_ACCOUNT_ID: 'evil.example/x?',
      R2_ACCESS_KEY_ID: 'key/with/slashes',
      R2_SECRET_ACCESS_KEY: 'synthetic secret with spaces',
      R2_BUCKET: 'Not_A_Bucket',
    };
    for (const [key, value] of Object.entries(cases)) {
      const { config, logs } = factoryConfig({ ...R2, [key]: value });
      let message = '';
      try {
        createStorageProvider(config);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain(`(${key})`);
      expect(message).not.toContain(value);
      expect(logs.text()).not.toContain(value);
    }
  });
});
