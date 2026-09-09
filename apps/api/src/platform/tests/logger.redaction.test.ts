// Redaction canary (doc 11 §8, doc 13 §8.1): plant a marker under every forbidden key, at the top
// level, nested, inside arrays and inside an Error, log through the API's pino options into an
// in-memory sink, and assert the marker never reaches the sink.
import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { memoryLogStream } from '@ai-stylist/test-support';

import { FORBIDDEN_LOG_KEYS, REDACTED, isForbiddenLogKey, loggerOptions } from '../logger.js';

const CANARY = 'CANARY_SENSITIVE_9f3a';

function plant(): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const key of FORBIDDEN_LOG_KEYS) flat[key] = CANARY;
  return {
    ...flat,
    accessToken: CANARY,
    refresh_token: CANARY,
    'x-api-token': CANARY,
    imageBase64: CANARY,
    faceGeometry: { landmarks: [CANARY] },
    user: { email: CANARY, profile: { measurements: { height: CANARY }, id: 'usr_ok' } },
    items: [{ photo: CANARY }, [{ selfie: CANARY }]],
    req: {
      headers: { authorization: CANARY },
      body: { password: CANARY },
      url: `/x?token=${CANARY}`,
    },
    safe: 'visible-value',
  };
}

describe('logger redaction canary', () => {
  it('never writes a planted marker to the sink, at any depth', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'trace' }), sink);
    logger.info(plant(), 'canary');
    logger.warn({ err: Object.assign(new Error('boom'), { token: CANARY }) }, 'error canary');
    logger
      .child({ cookie: CANARY, ctx: { token: CANARY } })
      .info({ nested: { lat: CANARY, lng: CANARY } }, 'child canary');
    logger.flush();

    const text = sink.text();
    expect(sink.records().length).toBe(3);
    expect(text).toContain('visible-value');
    expect(text).toContain('usr_ok');
    expect(text).not.toContain(CANARY);
    const first = sink.records()[0]!;
    expect(first['password']).toBe(REDACTED);
    expect((first['user'] as { profile: { measurements: unknown } }).profile.measurements).toBe(
      REDACTED,
    );
  });

  it('keeps the request allowlist to id/method/url path and res to statusCode', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    logger.info(
      {
        req: {
          id: 'req-1',
          method: 'GET',
          url: `/v1/x?sig=${CANARY}`,
          headers: { authorization: CANARY },
          remoteAddress: '10.0.0.1',
        },
        res: { statusCode: 200, headers: { 'set-cookie': CANARY } },
      },
      'request completed',
    );
    const record = sink.records()[0]!;
    expect(record['req']).toEqual({ id: 'req-1', method: 'GET', url: '/v1/x' });
    expect(record['res']).toEqual({ statusCode: 200 });
    expect(sink.text()).not.toContain(CANARY);
  });

  it.each(['token', 'accessToken', 'refresh_token', 'body', 'imageUrl', 'lat', 'user-email'])(
    'treats %s as forbidden',
    (key) => expect(isForbiddenLogKey(key)).toBe(true),
  );

  it.each(['userId', 'status', 'latency', 'template', 'count', 'imagination'])(
    'keeps %s loggable',
    (key) => expect(isForbiddenLogKey(key)).toBe(false),
  );
});
