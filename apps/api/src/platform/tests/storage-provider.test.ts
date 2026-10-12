// Which StorageProvider the composition root binds (P02-T13): `createStorageProvider`. No R2 key →
// in-memory, only when the caller allows it (`allowsInMemory`, required); any key → the R2 adapter,
// which refuses a missing or malformed key by name. The boot rules of the R2_* keys (presence,
// all-or-none, the staging/prod refusal) are apps/api/src/config.ts, tested in
// apps/api/tests/config.test.ts: platform tests do not import the app's config.
// `R2_JURISDICTION` (DEC-61) selects the endpoint host the URLs are signed for; the factory refuses
// an unknown value whichever provider it binds.
import { describe, expect, it } from 'vitest';
import pino from 'pino';

import { type PresignedUrl, formatId } from '@ai-stylist/shared-kernel';
import { fakeClock, memoryLogStream } from '@ai-stylist/test-support';

import { loggerOptions } from '../logger.js';
import { createStorageProvider } from '../storage/create-storage-provider.js';
import { InMemoryStorageProvider } from '../storage/in-memory-storage-provider.js';
import { R2_JURISDICTIONS, R2StorageProvider } from '../storage/r2-storage-provider.js';

import { verifyPresignedRequest } from './fake-s3.js';

// Synthetic values only (the secret is AWS's public documentation example).
const R2 = {
  R2_ACCOUNT_ID: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  R2_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  R2_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  R2_BUCKET: 'ai-stylist-test',
} as const;
const T0 = '2026-09-10T12:00:00.000Z';

type R2Env = Partial<Record<keyof typeof R2 | 'R2_JURISDICTION', string>>;

function factoryConfig(env: R2Env, allowsInMemory = true) {
  const logs = memoryLogStream();
  return {
    logs,
    config: {
      allowsInMemory,
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      jurisdiction: env.R2_JURISDICTION,
      clock: fakeClock(T0),
      logger: pino(loggerOptions({ level: 'info' }), logs),
    },
  };
}

/** The message `build` throws, or `''` when it does not throw. */
function refusalMessage(build: () => unknown): string {
  try {
    build();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
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
      const message = refusalMessage(() => createStorageProvider(config));
      expect(message).toContain(`(${key})`);
      expect(message).not.toContain(value);
      expect(logs.text()).not.toContain(value);
    }
  });
});

// DEC-61: the storage jurisdiction comes from configuration, never from code. A jurisdictional
// bucket is served only from its own endpoint host, and the host is a signed header, so a URL
// minted for another host is refused by R2.
describe('createStorageProvider: R2_JURISDICTION selects the endpoint host', () => {
  const DEFAULT_HOST = `${R2.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  // Written out, not derived from R2_JURISDICTIONS: each host is pinned by this table.
  const JURISDICTION_HOSTS = {
    eu: `${R2.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
    us: `${R2.R2_ACCOUNT_ID}.us.r2.cloudflarestorage.com`,
    fedramp: `${R2.R2_ACCOUNT_ID}.fedramp.r2.cloudflarestorage.com`,
  } as const;
  const JURISDICTION_REFUSAL =
    'R2: jurisdiction (R2_JURISDICTION) must be empty or one of eu, us, fedramp';
  const OBJECT = {
    userId: formatId('user', '01JA00000000000000000000AA'),
    namespace: 'uploads',
    key: 'ast_1.jpg',
  } as const;
  const PUT_HEADERS = { 'content-type': 'image/jpeg', 'content-length': '1024' } as const;

  /** A PUT and a GET URL from the provider the factory binds, each with the headers it signed. */
  async function mintWith(jurisdiction: string | undefined) {
    const provider = createStorageProvider(
      factoryConfig(
        jurisdiction === undefined ? R2 : { ...R2, R2_JURISDICTION: jurisdiction },
        false,
      ).config,
    );
    expect(provider).toBeInstanceOf(R2StorageProvider);
    return [
      {
        minted: await provider.presignedPut({
          ...OBJECT,
          contentType: PUT_HEADERS['content-type'],
          sizeLimitBytes: Number(PUT_HEADERS['content-length']),
          ttlSeconds: 300,
        }),
        signedHeaders: PUT_HEADERS,
      },
      { minted: await provider.presignedGet({ ...OBJECT, ttlSeconds: 60 }), signedHeaders: {} },
    ];
  }

  /** Whether an endpoint that receives the request under `host` accepts the URL's signature. */
  function isSignedFor(
    host: string,
    minted: PresignedUrl,
    signedHeaders: Readonly<Record<string, string>>,
  ): boolean {
    const { pathname, search } = new URL(minted.url);
    return verifyPresignedRequest(
      { method: minted.method, rawUrl: pathname + search, headers: { ...signedHeaders, host } },
      {
        credentials: {
          accessKeyId: R2.R2_ACCESS_KEY_ID,
          secretAccessKey: R2.R2_SECRET_ACCESS_KEY,
        },
        region: 'auto',
        now: () => new Date(T0),
      },
    ).ok;
  }

  it('pins a host for every jurisdiction the adapter allows', () => {
    expect(Object.keys(JURISDICTION_HOSTS).sort()).toEqual([...R2_JURISDICTIONS].sort());
  });

  it.each(Object.entries(JURISDICTION_HOSTS))(
    'jurisdiction %s mints PUT and GET URLs on https://%s and signs for that host',
    async (jurisdiction, host) => {
      for (const { minted, signedHeaders } of await mintWith(jurisdiction)) {
        expect(minted.url).toContain(
          `https://${host}/${R2.R2_BUCKET}/u/${OBJECT.userId}/uploads/ast_1.jpg?`,
        );
        expect(new URL(minted.url).host).toBe(host);
        expect(isSignedFor(host, minted, signedHeaders)).toBe(true);
        // The same URL sent to the default endpoint host fails the signature check.
        expect(isSignedFor(DEFAULT_HOST, minted, signedHeaders)).toBe(false);
      }
    },
  );

  it('signs for the default endpoint host when the jurisdiction is unset, empty or blank', async () => {
    for (const jurisdiction of [undefined, '', '   ']) {
      for (const { minted, signedHeaders } of await mintWith(jurisdiction)) {
        expect(new URL(minted.url).host).toBe(DEFAULT_HOST);
        expect(isSignedFor(DEFAULT_HOST, minted, signedHeaders)).toBe(true);
        expect(isSignedFor(JURISDICTION_HOSTS.eu, minted, signedHeaders)).toBe(false);
      }
    }
  });

  it('trims surrounding whitespace like the other keys', async () => {
    for (const jurisdiction of [' eu ', '\teu\n']) {
      for (const { minted, signedHeaders } of await mintWith(jurisdiction)) {
        expect(new URL(minted.url).host).toBe(JURISDICTION_HOSTS.eu);
        expect(isSignedFor(JURISDICTION_HOSTS.eu, minted, signedHeaders)).toBe(true);
      }
    }
  });

  it('refuses an unknown jurisdiction, naming the key and the allowed values and nothing else', () => {
    for (const value of [
      'EU',
      'europe',
      'eu-central-1',
      'apac',
      'e u',
      'eu,us',
      'eu.evil.example',
      'eu/x',
      'eu#',
    ]) {
      const { config, logs } = factoryConfig({ ...R2, R2_JURISDICTION: value });
      expect(refusalMessage(() => createStorageProvider(config))).toBe(JURISDICTION_REFUSAL);
      expect(logs.records()).toEqual([]);
    }
  });

  // No R2 key: the in-memory provider is bound and the jurisdiction selects nothing yet. It is
  // checked all the same, so a typo fails the first boot, not the day the R2 keys are added.
  it('checks the jurisdiction when no R2 key is set: a known one binds in-memory, a typo is refused', () => {
    const known = factoryConfig({ R2_JURISDICTION: 'eu' });
    expect(createStorageProvider(known.config)).toBeInstanceOf(InMemoryStorageProvider);
    expect(known.logs.records()).toEqual([
      expect.objectContaining({ component: 'storage', provider: 'in-memory' }),
    ]);

    const typo = factoryConfig({ R2_JURISDICTION: 'ue' });
    expect(refusalMessage(() => createStorageProvider(typo.config))).toBe(JURISDICTION_REFUSAL);
    expect(typo.logs.records()).toEqual([]);

    // The jurisdiction is not one of the R2 keys: alone it never selects the R2 adapter.
    expect(() =>
      createStorageProvider(factoryConfig({ R2_JURISDICTION: 'eu' }, false).config),
    ).toThrow(/does not allow the in-memory provider/);
  });
});
