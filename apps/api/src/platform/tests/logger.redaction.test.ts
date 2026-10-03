// Redaction canary (doc 11 §8, doc 13 §8.1): plant a marker under every forbidden key (each word
// of the shared-kernel registry and each of its word-split examples), at the top level, nested,
// inside arrays and inside an Error, log through the API's pino options into an in-memory sink,
// and assert the marker never reaches the sink. The required ids (doc 14 §2) ride
// along: `correlation_id` inside a correlation scope, and `trace_id` / `span_id` when the process
// runs behind the telemetry `--import` entry (child process, where OTLP export must stay clean too).
//
// A logged error is an allowlist too (`err`: class, code-shaped code, cause chain): a driver error's
// free text echoes row values, so none of it may reach the sink, in process or through the API's
// error path (ProblemFilter on a Nest app, where pino-http wraps the serializer).
import { Controller, type DynamicModule, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FORBIDDEN_LOG_KEY_EXAMPLES } from '@ai-stylist/shared-kernel';
import { memoryLogStream } from '@ai-stylist/test-support';

import {
  InMemoryStorageProvider,
  PlatformModule,
  SystemClock,
  UnconfiguredHealthProbe,
  httpLoggerOptions,
} from '../index.js';
import { MAX_ERR_CAUSE_DEPTH, REDACTED, isForbiddenLogKey, loggerOptions } from '../logger.js';
import { runWithCorrelationId } from '../telemetry/correlation.js';

import { CANARY, plant } from './redaction-canary.js';
import {
  FIXTURE_CORRELATION_ID,
  FIXTURE_TEST_TIMEOUT_MS,
  type OtlpReceiver,
  runTelemetryFixture,
  startOtlpReceiver,
} from './telemetry-process.js';

const QUERY = 'insert into demo (note) values ($1)';

/**
 * Shaped like the PostgresError postgres.js throws for a unique violation (`query` and
 * `parameters` are enumerable in its debug mode): the SQLSTATE says what failed, every free-text
 * field echoes the row.
 */
function driverError(): Error {
  return Object.assign(
    new Error('duplicate key value violates unique constraint "demo_note_key"'),
    {
      name: 'PostgresError',
      severity: 'ERROR',
      code: '23505',
      detail: `Key (note)=(${CANARY}) already exists.`,
      hint: `Remove the row holding ${CANARY}.`,
      where: `SQL statement "insert into demo (note) values ('${CANARY}')"`,
      schema_name: 'public',
      table_name: 'demo',
      constraint_name: 'demo_note_key',
      query: QUERY,
      parameters: [CANARY],
    },
  );
}

/** Shaped like drizzle's DrizzleQueryError: the message itself lists the statement parameters. */
function failedQuery(): Error {
  return Object.assign(
    new Error(`Failed query: ${QUERY}\nparams: ${CANARY}`, { cause: driverError() }),
    { query: QUERY, params: [CANARY] },
  );
}

const DRIVER_ERROR_SUMMARY = { type: 'PostgresError', code: '23505' };

@Controller('v1/test/failed-query')
class FailedQueryController {
  @Get()
  fail(): never {
    throw failedQuery();
  }
}

@Module({})
class ErrorPathTestModule {}

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

  it('redacts every forbidden example of the registry and leaves every allowed one readable', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    const allowed = Object.fromEntries(
      FORBIDDEN_LOG_KEY_EXAMPLES.allowed.map((key) => [key, `visible-${key}`]),
    );
    logger.info(plant(), 'forbidden examples');
    logger.info(allowed, 'allowed examples');

    const [redacted, readable] = sink.records();
    for (const key of FORBIDDEN_LOG_KEY_EXAMPLES.forbidden) {
      expect(redacted?.[key], key).toBe(REDACTED);
    }
    expect(readable).toMatchObject(allowed);
    expect(sink.text()).not.toContain(CANARY);
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

  // `stripQuery` (../logger.ts) is the one cut for the logged request url, the problem `instance`
  // and the span URL attributes: a fragment can carry a token as a query string can.
  it('cuts a logged url at the first ? or #, whichever comes first', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    logger.info({ req: { url: `/v1/x?sig=${CANARY}#${CANARY}` } }, 'query then fragment');
    logger.info({ req: { url: `/v1/x#${CANARY}?sig=${CANARY}` } }, 'fragment then query');
    logger.info({ req: { url: '/v1/x' } }, 'neither');

    const logged = sink.records().map((record) => record['req']);
    expect(logged).toEqual([{ url: '/v1/x' }, { url: '/v1/x' }, { url: '/v1/x' }]);
    expect(sink.text()).not.toContain(CANARY);
  });

  it('keeps err to the error class and SQLSTATE: no PostgresError detail or other driver text', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    logger.error({ err: driverError() }, 'driver error canary');

    expect(sink.records()[0]?.['err']).toEqual(DRIVER_ERROR_SUMMARY);
    expect(sink.text()).not.toContain(CANARY);
  });

  it('summarises the cause chain the same way, bounded, without a message or stack', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    const circular: Error & { cause?: unknown } = new Error(`loop ${CANARY}`);
    circular.cause = circular;
    logger.error({ err: failedQuery() }, 'wrapped driver error canary');
    logger.error({ err: circular }, 'circular cause canary');

    const [wrapped, loop] = sink.records();
    expect(wrapped?.['err']).toEqual({ type: 'Error', cause: DRIVER_ERROR_SUMMARY });
    expect(JSON.stringify(loop?.['err']).match(/"cause"/g)).toHaveLength(MAX_ERR_CAUSE_DEPTH);
    expect(sink.text()).not.toContain(CANARY);
  });

  it('logs a thrown non-Error by its type only and drops a code that is free text', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    const thrownObject = { note: CANARY };
    const freeTextCode = Object.assign(new Error('x'), { code: `bad ${CANARY}` });
    const systemCode = Object.assign(new TypeError('fetch failed'), { code: 'ECONNREFUSED' });
    logger.error({ err: thrownObject }, 'thrown object canary');
    logger.error({ err: CANARY }, 'thrown string canary');
    logger.error({ err: freeTextCode }, 'free-text code canary');
    logger.error({ err: systemCode }, 'system code');

    expect(sink.records().map((record) => record['err'])).toEqual([
      { type: 'object' },
      { type: 'string' },
      { type: 'Error' },
      { type: 'TypeError', code: 'ECONNREFUSED' },
    ]);
    expect(sink.text()).not.toContain(CANARY);
  });

  it('summarises an Error under any other key, at any depth, the same way', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    const job = { lastError: failedQuery(), attempts: [driverError()] };
    logger.error({ failure: driverError(), job }, 'nested error canary');

    const record = sink.records()[0];
    expect(record?.['failure']).toEqual(DRIVER_ERROR_SUMMARY);
    expect(record?.['job']).toEqual({
      lastError: { type: 'Error', cause: DRIVER_ERROR_SUMMARY },
      attempts: [DRIVER_ERROR_SUMMARY],
    });
    expect(sink.text()).not.toContain(CANARY);
  });

  describe('through the API error path (Nest app, ProblemFilter, pino-http)', () => {
    const logs = memoryLogStream();
    let app: NestFastifyApplication;

    beforeAll(async () => {
      const clock = new SystemClock();
      const root: DynamicModule = {
        module: ErrorPathTestModule,
        imports: [
          PlatformModule.forRoot({
            logger: { pinoHttp: httpLoggerOptions({ level: 'info' }, logs) },
            version: { version: 'test', commit: 'test', builtAt: '2026-10-03T00:00:00Z' },
            clock,
            healthProbe: new UnconfiguredHealthProbe(),
            storage: new InMemoryStorageProvider(() => clock.now()),
          }),
        ],
        controllers: [FailedQueryController],
      };
      app = await NestFactory.create<NestFastifyApplication>(root, new FastifyAdapter(), {
        bufferLogs: true,
        abortOnError: false,
      });
      app.useLogger(app.get(Logger));
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('logs an unhandled driver error as class, code and cause; no marker in logs or the 500', async () => {
      const res = await app.inject({ method: 'GET', url: `/v1/test/failed-query?sig=${CANARY}` });

      expect(res.statusCode).toBe(500);
      expect(res.json()).toMatchObject({ instance: '/v1/test/failed-query' });
      expect(res.body).not.toContain(CANARY);
      const errorLines = logs
        .records()
        .filter((line) => 'err' in line)
        .map((line) => ({ msg: line['msg'], context: line['context'], err: line['err'] }));
      expect(errorLines).toEqual([
        {
          msg: 'unhandled error',
          context: 'ProblemFilter',
          err: { type: 'Error', cause: DRIVER_ERROR_SUMMARY },
        },
        { msg: 'request errored', err: { type: 'Error' } },
      ]);
      expect(logs.text()).not.toContain(CANARY);
    });
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

  it.each(FORBIDDEN_LOG_KEY_EXAMPLES.forbidden)('treats %s as forbidden', (key) =>
    expect(isForbiddenLogKey(key)).toBe(true),
  );

  it.each(FORBIDDEN_LOG_KEY_EXAMPLES.allowed)('keeps %s loggable', (key) =>
    expect(isForbiddenLogKey(key)).toBe(false),
  );

  describe('behind the telemetry --import entry (child process, OTLP to a stub receiver)', () => {
    let receiver: OtlpReceiver;

    beforeAll(async () => {
      receiver = await startOtlpReceiver();
    });

    afterAll(async () => {
      await receiver.close();
    });

    // Spawns a cold `tsx --import` child: 5 s is too short under full-suite load.
    it(
      'carries trace_id, span_id and correlation_id; no marker in stdout or OTLP',
      { timeout: FIXTURE_TEST_TIMEOUT_MS },
      async () => {
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
      },
    );
  });
});
