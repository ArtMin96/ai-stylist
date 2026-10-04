// Signed-URL security suite (P02-T13, AC-7; doc 11 §5.4, doc 13 §8). The R2 adapter's URLs are
// sent with fetch to a local endpoint that verifies SigV4 presigned requests like S3/R2
// (./fake-s3.ts, written from the AWS spec), so "rejected" means the signature or the expiry
// refused the request, not that the adapter merely set a parameter. The signer is pinned to AWS's
// published example and to the AWS SDK signer's output. Live R2: ./r2-storage.live.sec.test.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pino from 'pino';

import { fakeClock, memoryLogStream } from '@ai-stylist/test-support';

import { loggerOptions } from '../logger.js';
import {
  InMemoryStorageProvider,
  type PresignPutRequest,
  StorageError,
  type StorageProvider,
} from '../ports/storage.port.js';
import { R2StorageProvider, r2Endpoint } from '../storage/r2-storage-provider.js';
import { presignUrl } from '../storage/sigv4-presign.js';

import { type FakeS3, startFakeS3, verifyPresignedRequest } from './fake-s3.js';

// The public example key pair of the AWS SigV4 documentation: synthetic, never a real credential.
const CREDENTIALS = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
};
const ACCOUNT_ID = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const BUCKET = 'ai-stylist-test';
const T0 = '2026-09-10T12:00:00.000Z';
const JPEG = 'image/jpeg';
const BODY = new Uint8Array(Buffer.from('synthetic upload body, not an image'));

function put(overrides: Partial<PresignPutRequest> = {}): PresignPutRequest {
  return {
    namespace: 'uploads',
    key: 'usr_1/ast_1.jpg',
    contentType: JPEG,
    sizeLimitBytes: BODY.byteLength,
    ttlSeconds: 300,
    ...overrides,
  };
}

function query(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('SigV4 presigning (storage/sigv4-presign.ts)', () => {
  it('reproduces the presigned GET example published in the AWS S3 docs', () => {
    // AWS S3 API reference, "Authenticating Requests: Using Query Parameters (AWS Signature
    // Version 4)", example: GET examplebucket/test.txt, 2013-05-24, 86400 s, us-east-1.
    expect(
      presignUrl({
        method: 'GET',
        origin: 'https://examplebucket.s3.amazonaws.com',
        path: '/test.txt',
        headers: {},
        credentials: CREDENTIALS,
        region: 'us-east-1',
        service: 's3',
        signingDate: new Date('2013-05-24T00:00:00Z'),
        expiresInSeconds: 86_400,
      }),
    ).toBe(
      'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });

  it('signs an R2 PUT and GET exactly as the AWS SDK signer does', () => {
    // Expected signatures computed on 2026-10-04 with @smithy/signature-v4 5.7.4 (the signer inside
    // AWS SDK v3) for the same request: region auto, path style, UNSIGNED-PAYLOAD.
    const common = {
      origin: r2Endpoint(ACCOUNT_ID),
      path: '/ai-stylist-dev/uploads/usr_1/ast_1.jpg',
      credentials: CREDENTIALS,
      region: 'auto',
      service: 's3',
      signingDate: new Date(T0),
    } as const;
    const putUrl = presignUrl({
      ...common,
      method: 'PUT',
      headers: { 'content-type': JPEG, 'content-length': '1048576' },
      expiresInSeconds: 900,
    });
    expect(query(putUrl).get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(query(putUrl).get('X-Amz-Signature')).toBe(
      '7d56f1cba5f3f52a2bc0928da330859e44bf85f6642f764a6c5fa990d5856d47',
    );
    const getUrl = presignUrl({ ...common, method: 'GET', headers: {}, expiresInSeconds: 600 });
    expect(query(getUrl).get('X-Amz-Signature')).toBe(
      '99abc42d212bdbc9b59bfaa75f1549e0bf47910cf6314e3ba706d2330f315745',
    );
  });

  it('the local verifying endpoint accepts the AWS example and refuses it once expired', () => {
    const rawUrl =
      '/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request' +
      '&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host' +
      '&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404';
    const request = { method: 'GET', rawUrl, headers: { host: 'examplebucket.s3.amazonaws.com' } };
    const at = (instant: string) => ({
      credentials: CREDENTIALS,
      region: 'us-east-1',
      now: () => new Date(instant),
    });
    expect(verifyPresignedRequest(request, at('2013-05-24T12:00:00Z'))).toEqual({ ok: true });
    expect(verifyPresignedRequest(request, at('2013-05-25T00:00:01Z'))).toEqual({
      ok: false,
      status: 403,
      code: 'AccessDenied',
    });
    expect(
      verifyPresignedRequest(
        { ...request, rawUrl: rawUrl.replace('test.txt', 'other.txt') },
        at('2013-05-24T12:00:00Z'),
      ),
    ).toMatchObject({ ok: false, code: 'SignatureDoesNotMatch' });
  });
});

describe('R2StorageProvider signed URLs against a verifying endpoint (doc 11 §5.4)', () => {
  const clock = fakeClock(T0);
  const serverClock = fakeClock(T0);
  const logs = memoryLogStream();
  let s3: FakeS3;
  let r2: R2StorageProvider;

  beforeAll(async () => {
    s3 = await startFakeS3({
      credentials: CREDENTIALS,
      region: 'auto',
      now: () => serverClock.now(),
    });
    r2 = new R2StorageProvider({
      accountId: ACCOUNT_ID,
      ...CREDENTIALS,
      bucket: BUCKET,
      endpoint: s3.endpoint,
      clock,
      logger: pino(loggerOptions({ level: 'trace' }), logs),
    });
  });
  afterAll(async () => {
    await s3.close();
  });
  beforeEach(() => {
    clock.set(T0);
    serverClock.set(T0);
    s3.objects.clear();
  });

  const upload = (url: string, body: Uint8Array<ArrayBuffer> = BODY, contentType = JPEG) =>
    fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body });
  const errorCode = async (res: Response) => /<Code>(\w+)<\/Code>/.exec(await res.text())?.[1];

  it('signs host, content-type and content-length into a PUT and clamps TTLs (PUT 15 min, GET 10 min)', async () => {
    const minted = await r2.presignedPut(put({ ttlSeconds: 86_400 }));
    const url = new URL(minted.url);
    expect(url.origin).toBe(s3.endpoint);
    expect(url.pathname).toBe(`/${BUCKET}/uploads/usr_1/ast_1.jpg`);
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20260910T120000Z');
    expect(url.searchParams.get('X-Amz-Credential')).toBe(
      `${CREDENTIALS.accessKeyId}/20260910/auto/s3/aws4_request`,
    );
    expect(minted).toMatchObject({ method: 'PUT', expiresAt: '2026-09-10T12:15:00.000Z' });

    const read = await r2.presignedGet({
      namespace: 'uploads',
      key: 'usr_1/ast_1.jpg',
      ttlSeconds: 86_400,
    });
    expect(query(read.url).get('X-Amz-SignedHeaders')).toBe('host');
    expect(query(read.url).get('X-Amz-Expires')).toBe('600');
    expect(read).toMatchObject({ method: 'GET', expiresAt: '2026-09-10T12:10:00.000Z' });

    // A shorter TTL is kept; expiresAt never runs past the URL's real expiry (whole seconds).
    clock.set('2026-09-10T12:00:00.750Z');
    const short = await r2.presignedGet({
      namespace: 'uploads',
      key: 'usr_1/ast_1.jpg',
      ttlSeconds: 60,
    });
    expect(query(short.url).get('X-Amz-Expires')).toBe('60');
    expect(short.expiresAt).toBe('2026-09-10T12:01:00.000Z');
  });

  it('round-trips an upload of the signed type and size through the signed URLs', async () => {
    const minted = await r2.presignedPut(put());
    expect((await upload(minted.url)).status).toBe(200);
    const read = await r2.presignedGet({
      namespace: 'uploads',
      key: 'usr_1/ast_1.jpg',
      ttlSeconds: 60,
    });
    const res = await fetch(read.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(JPEG);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BODY);
  });

  it('rejects an expired PUT and GET URL', async () => {
    const minted = await r2.presignedPut(put({ ttlSeconds: 60 }));
    serverClock.set(new Date(Date.parse(minted.expiresAt) + 1000));
    const res = await upload(minted.url);
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('AccessDenied');
    expect(s3.objects.size).toBe(0);

    serverClock.set(T0);
    expect((await upload((await r2.presignedPut(put())).url)).status).toBe(200);
    const read = await r2.presignedGet({
      namespace: 'uploads',
      key: 'usr_1/ast_1.jpg',
      ttlSeconds: 30,
    });
    serverClock.set(new Date(Date.parse(read.expiresAt) + 1000));
    const late = await fetch(read.url);
    expect(late.status).toBe(403);
    expect(await errorCode(late)).toBe('AccessDenied');
  });

  it('rejects an upload of another content type', async () => {
    const minted = await r2.presignedPut(put());
    const res = await upload(minted.url, BODY, 'text/html');
    expect(res.status).toBe(403);
    expect(await errorCode(res)).toBe('SignatureDoesNotMatch');
    expect(s3.objects.size).toBe(0);
  });

  it('rejects a body larger or smaller than the signed size', async () => {
    const minted = await r2.presignedPut(put());
    const larger = new Uint8Array([...BODY, 0x41]);
    const smaller = BODY.slice(0, BODY.byteLength - 1);
    for (const body of [larger, smaller]) {
      const res = await upload(minted.url, body);
      expect(res.status).toBe(403);
      expect(await errorCode(res)).toBe('SignatureDoesNotMatch');
    }
    expect(s3.objects.size).toBe(0);
  });

  it('rejects a URL edited to another namespace, key, bucket or a longer expiry', async () => {
    const minted = await r2.presignedPut(put());
    const edits = [
      minted.url.replace('/uploads/', '/derived/'),
      minted.url.replace('/usr_1/', '/usr_2/'),
      minted.url.replace(`/${BUCKET}/`, '/ai-stylist-other/'),
      minted.url.replace('X-Amz-Expires=300', 'X-Amz-Expires=600'),
    ];
    for (const url of edits) {
      expect(url).not.toBe(minted.url);
      const res = await upload(url);
      expect(res.status).toBe(403);
      expect(await errorCode(res)).toBe('SignatureDoesNotMatch');
    }
    expect(s3.objects.size).toBe(0);
  });

  it('mints a URL far inside the P02 signed-URL budget (p95 ≤ 100 ms)', async () => {
    const durations: number[] = [];
    for (let i = 0; i < 500; i += 1) {
      const started = performance.now();
      await r2.presignedPut(put({ key: `usr_1/ast_${i}.jpg` }));
      durations.push(performance.now() - started);
    }
    durations.sort((a, b) => a - b);
    expect(durations[Math.ceil(durations.length * 0.95) - 1]).toBeLessThan(100);
  });
});

describe('presign refusals (both StorageProvider adapters)', () => {
  const logs = memoryLogStream();
  const providers: [string, StorageProvider][] = [
    [
      'R2StorageProvider',
      new R2StorageProvider({
        accountId: ACCOUNT_ID,
        ...CREDENTIALS,
        bucket: BUCKET,
        clock: fakeClock(T0),
        logger: pino(loggerOptions({ level: 'trace' }), logs),
      }),
    ],
    ['InMemoryStorageProvider', new InMemoryStorageProvider(() => new Date(T0))],
  ];

  async function refusal(attempt: Promise<unknown>): Promise<StorageError> {
    try {
      await attempt;
    } catch (error) {
      if (error instanceof StorageError) return error;
      throw error;
    }
    throw new Error('expected the request to be refused');
  }

  const ESCAPING_KEYS = [
    '../derived/usr_1/x.jpg',
    'usr_1/../../derived/x.jpg',
    '..',
    '.',
    '/usr_1/x.jpg',
    'usr_1//x.jpg',
    'usr_1/./x.jpg',
    'usr_1/x.jpg/',
    '%2e%2e/derived/x.jpg',
    'usr_1\\..\\..\\derived\\x.jpg',
    'usr_1/x y.jpg',
    'usr_1/x.jpg?X-Amz-Expires=604800',
    'usr_1/x.jpg#fragment',
    'usr_1/x\u0000.jpg',
    'usr_1/ü.jpg',
    '',
    `usr_1/${'a'.repeat(1024)}`,
  ];

  for (const [name, provider] of providers) {
    it(`${name}: refuses keys that could leave the namespace, for PUT and GET, without echoing them`, async () => {
      for (const key of ESCAPING_KEYS) {
        for (const attempt of [
          provider.presignedPut(put({ key })),
          provider.presignedGet({ namespace: 'uploads', key, ttlSeconds: 60 }),
        ]) {
          const error = await refusal(attempt);
          expect(error.refusal).toBe('key');
          if (key.length > 2) expect(error.message).not.toContain(key);
        }
      }
    });

    it(`${name}: refuses a foreign namespace`, async () => {
      for (const namespace of ['private', 'uploads/../derived', 'Uploads', '']) {
        const request = put({ namespace: namespace as PresignPutRequest['namespace'] });
        expect((await refusal(provider.presignedPut(request))).refusal).toBe('namespace');
      }
    });

    it(`${name}: refuses a content type that is not a bare media type, and a bad size or TTL`, async () => {
      for (const contentType of [
        'jpeg',
        'image/',
        '/jpeg',
        ' image/jpeg',
        'image/jpeg; charset=binary',
        'image/jpeg\r\nx-amz-acl: public-read',
        '',
      ]) {
        const error = await refusal(provider.presignedPut(put({ contentType })));
        expect(error.refusal).toBe('content_type');
        expect(error.message).toMatch(/contentType/);
      }
      for (const sizeLimitBytes of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
        expect((await refusal(provider.presignedPut(put({ sizeLimitBytes })))).refusal).toBe(
          'size',
        );
      }
      for (const ttlSeconds of [0, 0.5, -60, Number.NaN]) {
        expect((await refusal(provider.presignedPut(put({ ttlSeconds })))).refusal).toBe('ttl');
        const get = provider.presignedGet({ namespace: 'uploads', key: 'usr_1/a.jpg', ttlSeconds });
        expect((await refusal(get)).refusal).toBe('ttl');
      }
    });
  }

  it('R2StorageProvider logs the refusal reason, never the rejected value', () => {
    const refused = logs.records().filter((record) => record.msg === 'presign refused');
    expect(refused.length).toBeGreaterThan(0);
    const allowed = new Set(['level', 'time', 'service', 'component', 'provider', 'method']);
    for (const record of refused) {
      expect(
        Object.keys(record)
          .filter((key) => !allowed.has(key))
          .sort(),
      ).toEqual(['msg', 'refusal']);
    }
    expect(logs.text()).not.toMatch(/\.\.|usr_1|charset|public-read|image\/|%2e/);
  });
});

describe('the URL query never reaches the logs', () => {
  it('logs method, namespace and TTL of a mint, never the URL, its query, the key, the type or a credential', async () => {
    const logs = memoryLogStream();
    const r2 = new R2StorageProvider({
      accountId: ACCOUNT_ID,
      ...CREDENTIALS,
      bucket: BUCKET,
      clock: fakeClock(T0),
      logger: pino(loggerOptions({ level: 'trace' }), logs),
    });
    const minted = [
      await r2.presignedPut(put({ key: 'usr_7/ast_7.jpg' })),
      await r2.presignedGet({ namespace: 'derived', key: 'usr_7/ast_7_thumb.jpg', ttlSeconds: 60 }),
    ];
    const lines = logs.records().filter((record) => record.msg === 'presigned url minted');
    expect(lines).toEqual([
      expect.objectContaining({ method: 'PUT', namespace: 'uploads', ttlSeconds: 300 }),
      expect.objectContaining({ method: 'GET', namespace: 'derived', ttlSeconds: 60 }),
    ]);
    const text = logs.text();
    for (const { url } of minted) {
      const { search, pathname } = new URL(url);
      expect(text).not.toContain(search.slice(1));
      expect(text).not.toContain(pathname);
      expect(text).not.toContain(query(url).get('X-Amz-Signature'));
    }
    for (const forbidden of [
      'X-Amz',
      'usr_7',
      'ast_7',
      JPEG,
      ACCOUNT_ID,
      BUCKET,
      CREDENTIALS.accessKeyId,
      CREDENTIALS.secretAccessKey,
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe('R2StorageProvider options', () => {
  const base = {
    accountId: ACCOUNT_ID,
    ...CREDENTIALS,
    bucket: BUCKET,
    logger: pino({ level: 'silent' }),
  };

  it('signs for https://<account>.r2.cloudflarestorage.com/<bucket>/ by default', async () => {
    const r2 = new R2StorageProvider({ ...base, clock: fakeClock(T0) });
    const { url } = await r2.presignedGet({
      namespace: 'avatars',
      key: 'usr_1/a.glb',
      ttlSeconds: 60,
    });
    expect(
      url.startsWith(
        `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/avatars/usr_1/a.glb?`,
      ),
    ).toBe(true);
  });

  it('refuses malformed options without echoing a value', () => {
    const cases: Record<string, Partial<typeof base> & { endpoint?: string }> = {
      accountId: { accountId: 'evil.example/x?' },
      accessKeyId: { accessKeyId: 'AKIA/../x' },
      secretAccessKey: { secretAccessKey: 'has whitespace in it' },
      bucket: { bucket: 'Bad_Bucket' },
      endpoint: { endpoint: 'http://r2.example' },
    };
    for (const [option, override] of Object.entries(cases)) {
      const build = () => new R2StorageProvider({ ...base, ...override });
      expect(build).toThrow(new RegExp(`R2: ${option}`));
      const value = Object.values(override)[0] ?? '';
      expect(() => build()).not.toThrow(value);
    }
    expect(() => new R2StorageProvider({ ...base, endpoint: 'https://r2.example/bucket' })).toThrow(
      /R2: endpoint/,
    );
  });
});
