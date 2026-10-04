// Config rules of the keys the composition root binds to storage (apps/api/src/config.ts): the
// local-or-dev predicate shared by the dev routes and the in-memory storage provider, R2 presence
// and all-or-none, and the staging/prod refusal. The shape of each R2 key is the R2 adapter's rule,
// checked when `createApp` builds it: a malformed key fails boot by name, never by value.
import { describe, expect, it } from 'vitest';

import { memoryLogStream } from '@ai-stylist/test-support';

import { createApp } from '../src/app.module.js';
import { ConfigError, isLocalOrDevDeployment, loadConfig } from '../src/config.js';

// Synthetic values only (the secret is AWS's public documentation example).
const R2 = {
  R2_ACCOUNT_ID: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  R2_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  R2_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  R2_BUCKET: 'ai-stylist-test',
} as const;

/** Only the keys under test (the ambient environment must not decide the outcome). */
function configError(env: Record<string, string>): ConfigError {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError');
}

// Owner decision: no default deployment. An unset APP_ENV used to mean `local`, which turned on the
// dev routes and the in-memory storage provider in any process that forgot to name itself.
describe('config: APP_ENV is required (fail closed)', () => {
  const MESSAGE = 'invalid configuration: APP_ENV: required, one of local, dev, staging, prod';

  it('refuses to load without APP_ENV, naming the key', () => {
    for (const env of [
      {},
      { APP_ENV: '' },
      { APP_ENV: '  ' },
      { NODE_ENV: 'test' },
      { NODE_ENV: 'development', ...R2 },
    ]) {
      expect(configError(env).message).toBe(MESSAGE);
    }
  });

  it('refuses an unknown APP_ENV without echoing the value', () => {
    const value = 'sandbox-synthetic-value';
    const error = configError({ APP_ENV: value });
    expect(error.message).toBe(MESSAGE);
    expect(error.message).not.toContain(value);
  });

  it.each(['local', 'dev', 'staging', 'prod'])('loads with APP_ENV=%s', (APP_ENV) => {
    expect(loadConfig({ APP_ENV, ...R2 }).APP_ENV).toBe(APP_ENV);
  });
});

describe('isLocalOrDevDeployment (dev routes and the in-memory storage provider) fails closed', () => {
  it.each([
    ['development', 'local', true],
    ['test', 'dev', true],
    ['development', 'staging', false],
    ['development', 'prod', false],
    ['production', 'local', false],
    ['production', 'dev', false],
  ] as const)('NODE_ENV=%s APP_ENV=%s → %s', (NODE_ENV, APP_ENV, expected) => {
    expect(isLocalOrDevDeployment({ NODE_ENV, APP_ENV })).toBe(expected);
  });
});

describe('config: R2 keys', () => {
  it('accepts all four keys, and treats empty values as unset', () => {
    expect(loadConfig({ APP_ENV: 'local', ...R2 })).toMatchObject(R2);
    const unset = loadConfig({ APP_ENV: 'local', R2_ACCOUNT_ID: '', R2_ACCESS_KEY_ID: ' ' });
    expect(unset.R2_ACCOUNT_ID).toBeUndefined();
    expect(unset.R2_ACCESS_KEY_ID).toBeUndefined();
  });

  it('refuses a partial set, naming the missing keys', () => {
    expect(configError({ APP_ENV: 'local', R2_BUCKET: R2.R2_BUCKET }).message).toBe(
      'invalid configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: required when any R2_* key is set',
    );
  });

  // doc 15 §11: staging and prod use real R2 buckets; in-memory URLs there would be silent loss.
  const DEPLOYED = [
    { APP_ENV: 'staging' },
    { APP_ENV: 'prod' },
    { NODE_ENV: 'test', APP_ENV: 'staging' },
    { NODE_ENV: 'development', APP_ENV: 'prod' },
    { NODE_ENV: 'production', APP_ENV: 'prod' },
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
      expect(isLocalOrDevDeployment(loadConfig({ ...env, ...R2 }))).toBe(false);
      expect(loadConfig({ ...env, ...R2 })).toMatchObject(R2);
    }
  });

  it('keeps the in-memory provider for local, dev and test runs', () => {
    for (const env of [
      { APP_ENV: 'local' },
      { APP_ENV: 'dev' },
      { NODE_ENV: 'test', APP_ENV: 'local' },
      { NODE_ENV: 'test', APP_ENV: 'dev' },
      { NODE_ENV: 'development', APP_ENV: 'local' },
      { NODE_ENV: ' ', APP_ENV: 'dev' },
    ]) {
      const config = loadConfig(env);
      expect(isLocalOrDevDeployment(config)).toBe(true);
      expect(config.R2_ACCOUNT_ID).toBeUndefined();
    }
  });

  // The shape check lives in the R2 adapter only; `AppModule.forRoot` builds it inside `createApp`.
  it.each([
    ['R2_ACCOUNT_ID', 'evil.example/x?'],
    ['R2_ACCESS_KEY_ID', 'key/with/slashes'],
    ['R2_SECRET_ACCESS_KEY', 'synthetic secret with spaces'],
    ['R2_BUCKET', 'Not_A_Bucket'],
  ])(
    'a malformed %s loads but fails boot, naming the key and never the value',
    async (key, value) => {
      // Every deployment: staging, where the adapter must be R2, and local.
      for (const APP_ENV of ['staging', 'local']) {
        const config = loadConfig({
          NODE_ENV: 'test',
          APP_ENV,
          LOG_LEVEL: 'silent',
          ...R2,
          [key]: value,
        });
        const logs = memoryLogStream();
        const boot = createApp({ config, logStream: logs });
        await expect(boot).rejects.toThrow(`(${key})`);
        const message = await boot.then(
          () => '',
          (error: unknown) => (error instanceof Error ? error.message : String(error)),
        );
        expect(message).not.toContain(value);
        expect(logs.text()).not.toContain(value);
      }
    },
  );
});
