// Which StorageProvider the composition root binds (P02-T13): `createStorageProvider` and the R2
// keys of apps/api/src/config.ts. All four R2 keys → R2; none → in-memory (local, dev and test
// only: staging, prod and NODE_ENV=production refuse to boot); some → refused.
import { describe, expect, it } from 'vitest';
import pino from 'pino';

import { fakeClock, memoryLogStream } from '@ai-stylist/test-support';

import { ConfigError, allowsInMemoryStorage, loadConfig } from '../../config.js';
import { loggerOptions } from '../logger.js';
import { InMemoryStorageProvider } from '../ports/storage.port.js';
import { createStorageProvider } from '../storage/create-storage-provider.js';
import { R2StorageProvider } from '../storage/r2-storage-provider.js';

// Synthetic values only (the secret is AWS's public documentation example).
const R2 = {
  R2_ACCOUNT_ID: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  R2_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  R2_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  R2_BUCKET: 'ai-stylist-test',
} as const;

function factoryConfig(env: Partial<Record<keyof typeof R2, string>>) {
  const logs = memoryLogStream();
  return {
    logs,
    config: {
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

  // Defence in depth behind `loadConfig`: the composition root passes `allowsInMemoryStorage`.
  it('refuses the in-memory provider when the environment does not allow it', () => {
    const { config, logs } = factoryConfig({});
    expect(() => createStorageProvider({ ...config, allowsInMemory: false })).toThrow(
      'storage: no R2 keys, and this environment does not allow the in-memory provider; set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET',
    );
    expect(logs.records()).toEqual([]);
    for (const env of [
      { NODE_ENV: 'production', APP_ENV: 'local' },
      { NODE_ENV: 'development', APP_ENV: 'staging' },
      { NODE_ENV: 'development', APP_ENV: 'prod' },
    ] as const) {
      const allowsInMemory = allowsInMemoryStorage(env);
      expect(() => createStorageProvider({ ...config, allowsInMemory }), env.APP_ENV).toThrow(
        /does not allow the in-memory provider/,
      );
    }
    const local = allowsInMemoryStorage({ NODE_ENV: 'development', APP_ENV: 'local' });
    expect(createStorageProvider({ ...config, allowsInMemory: local })).toBeInstanceOf(
      InMemoryStorageProvider,
    );
    expect(
      createStorageProvider({ ...factoryConfig(R2).config, allowsInMemory: false }),
    ).toBeInstanceOf(R2StorageProvider);
  });

  it('binds R2 when all four keys are set, and logs no key value', () => {
    const { config, logs } = factoryConfig(R2);
    expect(createStorageProvider(config)).toBeInstanceOf(R2StorageProvider);
    expect(logs.records()).toEqual([
      expect.objectContaining({ component: 'storage', provider: 'r2' }),
    ]);
    for (const value of Object.values(R2)) expect(logs.text()).not.toContain(value);
  });

  it('refuses a partial R2 configuration, naming the missing keys and no value', () => {
    const { R2_SECRET_ACCESS_KEY: _secret, R2_BUCKET: _bucket, ...partial } = R2;
    const { config } = factoryConfig(partial);
    expect(() => createStorageProvider(config)).toThrow(
      'storage: R2 is partly configured; set R2_SECRET_ACCESS_KEY, R2_BUCKET as well',
    );
  });
});

describe('config: R2 keys', () => {
  function configError(env: Record<string, string>): ConfigError {
    try {
      loadConfig(env);
    } catch (error) {
      if (error instanceof ConfigError) return error;
      throw error;
    }
    throw new Error('expected a ConfigError');
  }

  it('accepts all four keys, and treats empty values as unset', () => {
    expect(loadConfig({ ...R2 })).toMatchObject(R2);
    const unset = loadConfig({ R2_ACCOUNT_ID: '', R2_ACCESS_KEY_ID: ' ' });
    expect(unset.R2_ACCOUNT_ID).toBeUndefined();
    expect(unset.R2_ACCESS_KEY_ID).toBeUndefined();
  });

  it('refuses a partial set, naming the missing keys', () => {
    expect(configError({ R2_BUCKET: R2.R2_BUCKET }).message).toBe(
      'invalid configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: required when any R2_* key is set',
    );
  });

  it('refuses malformed values without echoing them', () => {
    const cases = {
      R2_ACCOUNT_ID: 'evil.example/x?',
      R2_ACCESS_KEY_ID: 'key/with/slashes',
      R2_SECRET_ACCESS_KEY: 'synthetic secret with spaces',
      R2_BUCKET: 'Not_A_Bucket',
    };
    for (const [key, value] of Object.entries(cases)) {
      const error = configError({ ...R2, [key]: value });
      expect(error.message).toMatch(new RegExp(`^invalid configuration: ${key}: `));
      expect(error.message).not.toContain(value);
    }
  });

  // doc 15 §11: staging and prod use real R2 buckets; in-memory URLs there would be silent loss.
  const DEPLOYED = [
    { APP_ENV: 'staging' },
    { APP_ENV: 'prod' },
    { NODE_ENV: 'test', APP_ENV: 'staging' },
    { NODE_ENV: 'development', APP_ENV: 'prod' },
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', APP_ENV: 'local' },
    { NODE_ENV: 'production', APP_ENV: 'dev' },
  ];

  it('refuses to boot without R2 keys when APP_ENV is staging or prod or NODE_ENV is production', () => {
    for (const env of DEPLOYED) {
      // One fixed message for every environment: it names the keys and the rule, never a value.
      expect(configError(env).message).toBe(
        'invalid configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET: ' +
          'required when APP_ENV is staging or prod or NODE_ENV is production ' +
          '(the in-memory storage provider is for local and dev only)',
      );
      expect(allowsInMemoryStorage(loadConfig({ ...env, ...R2 }))).toBe(false);
      expect(loadConfig({ ...env, ...R2 })).toMatchObject(R2);
    }
  });

  it('keeps the in-memory provider for local, dev and test runs', () => {
    for (const env of [
      {},
      { APP_ENV: 'local' },
      { APP_ENV: 'dev' },
      { NODE_ENV: 'test' },
      { NODE_ENV: 'test', APP_ENV: 'dev' },
      { NODE_ENV: 'development', APP_ENV: 'local' },
      { NODE_ENV: '', APP_ENV: ' ' },
    ]) {
      const config = loadConfig(env);
      expect(allowsInMemoryStorage(config)).toBe(true);
      expect(config.R2_ACCOUNT_ID).toBeUndefined();
    }
  });
});
