// Redaction canary (doc 11 §8, doc 13 §8.1): plant a marker under every forbidden key, at the top
// level, nested, inside arrays and inside an Error, log through the API's pino options into an
// in-memory sink, and assert the marker never reaches the sink. The required ids (doc 14 §2) ride
// along: `correlation_id` inside a correlation scope, and `trace_id` / `span_id` when the process
// runs behind the telemetry `--import` entry (child process, where OTLP export must stay clean too).
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { memoryLogStream } from '@ai-stylist/test-support';

import { REDACTED, isForbiddenLogKey, loggerOptions } from '../logger.js';
import { runWithCorrelationId } from '../telemetry/correlation.js';

import { CANARY, plant } from './redaction-canary.js';
import {
  FIXTURE_CORRELATION_ID,
  type OtlpReceiver,
  runTelemetryFixture,
  startOtlpReceiver,
} from './telemetry-process.js';

describe('logger redaction canary', () => {
  it('never writes a planted marker to the sink, at any depth', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'trace' }), sink);
    logger.info(plant(), 'canary');
    logger.warn({ err: Object.assign(new Error('boom'), { token: CANARY }) }, 'error canary');
    logger
      .child({ cookie: CANARY, ctx: { token: CANARY } })
      // eslint-disable-next-line quality/no-log-request-body -- canary plants forbidden keys on purpose
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
          // eslint-disable-next-line quality/no-log-request-body -- canary plants forbidden keys on purpose
          headers: { authorization: CANARY },
          remoteAddress: '10.0.0.1',
        },
        // eslint-disable-next-line quality/no-log-request-body -- canary plants forbidden keys on purpose
        res: { statusCode: 200, headers: { 'set-cookie': CANARY } },
      },
      'request completed',
    );
    const record = sink.records()[0]!;
    expect(record['req']).toEqual({ id: 'req-1', method: 'GET', url: '/v1/x' });
    expect(record['res']).toEqual({ statusCode: 200 });
    expect(sink.text()).not.toContain(CANARY);
  });

  it('adds correlation_id to each line in a correlation scope, children too, no marker', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    runWithCorrelationId('corr-canary-1', () => {
      logger.info(plant(), 'canary');
      logger.child({ component: 'child' }).info('child line');
      runWithCorrelationId(undefined, () => logger.info('explicitly unscoped'));
    });
    logger.info('outside');

    const ids = sink.records().map((record) => [record['msg'], record['correlation_id']]);
    expect(ids).toEqual([
      ['canary', 'corr-canary-1'],
      ['child line', 'corr-canary-1'],
      ['explicitly unscoped', undefined],
      ['outside', undefined],
    ]);
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

  describe('behind the telemetry --import entry (child process, OTLP to a stub receiver)', () => {
    let receiver: OtlpReceiver;

    beforeAll(async () => {
      receiver = await startOtlpReceiver();
    });

    afterAll(async () => {
      await receiver.close();
    });

    it('carries trace_id, span_id and correlation_id; no marker in stdout or OTLP', async () => {
      const run = await runTelemetryFixture({
        entry: 'jobs',
        receiverUrl: receiver.url,
        env: { OTEL_EXPORTER_OTLP_ENDPOINT: receiver.url },
      });

      expect(run.code, run.stderr).toBe(0);
      const canary = run.records.find((record) => record['msg'] === 'canary');
      expect(canary).toMatchObject({
        correlation_id: FIXTURE_CORRELATION_ID,
        safe: 'visible-value',
        password: REDACTED,
      });
      expect(canary?.['trace_id']).toMatch(/^[0-9a-f]{32}$/);
      expect(canary?.['span_id']).toMatch(/^[0-9a-f]{16}$/);
      expect(run.stdout).not.toContain(CANARY);
      expect(receiver.bodies('/v1/logs').length).toBeGreaterThan(0);
      for (const request of receiver.requests) {
        expect(request.body.includes(CANARY), request.path).toBe(false);
      }
    });
  });
});
