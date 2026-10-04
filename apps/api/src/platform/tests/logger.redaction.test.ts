// Redaction canary (doc 11 §8, doc 13 §8.1): plant a marker under every forbidden key (each word
// of the shared-kernel registry and each of its word-split examples), at the top level, nested,
// inside arrays and inside an Error, log through the API's pino options into an in-memory sink,
// and assert the marker never reaches the sink. The required ids (doc 14 §2) ride
// along: `correlation_id` inside a correlation scope, and `trace_id` / `span_id` when the process
// runs behind the telemetry `--import` entry (child process, where OTLP export must stay clean too).
//
// A logged error is an allowlist too (`err`: class, code-shaped code, cause chain): a driver error's
// free text echoes row values, so none of it may reach the sink, in process or through the API's
// error path (ProblemFilter on a Nest app, where pino-http wraps the serializer). Neither may `msg`
// (error text, interpolated arguments), child-logger bindings, or an unknown route's 404 `detail`.
import vm from 'node:vm';

import { Controller, Get, Logger as NestLogger } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FORBIDDEN_LOG_KEY_EXAMPLES, PROBLEM_TYPE_BASE } from '@ai-stylist/shared-kernel';
import { memoryLogStream } from '@ai-stylist/test-support';

import {
  MAX_ERR_CAUSE_DEPTH,
  REDACTED,
  childLogger,
  isForbiddenLogKey,
  loggerOptions,
} from '../logger.js';
import { PROBLEM_CONTENT_TYPE } from '../problem.filter.js';
import { runWithCorrelationId } from '../telemetry/correlation.js';

import { createPlatformTestApp } from './platform-test-app.js';
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

  // pino writes child bindings without the log formatter, so they get the same rules only through
  // `childLogger`: every forbidden word and word-split variant, at any depth, and Errors summarised.
  it('redacts child-logger bindings like a logged object, word-split keys and Errors included', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    childLogger(logger, { ...plant(), accessToken: CANARY, lastFailure: driverError() }).info(
      'child bindings canary',
    );

    const record = sink.records()[0];
    expect(record).toMatchObject({
      safe: 'visible-value',
      password: REDACTED,
      accessToken: REDACTED,
      lastFailure: DRIVER_ERROR_SUMMARY,
    });
    expect(sink.text()).not.toContain(CANARY);
  });

  // Called without a message, pino copies `err.message` into `msg`; printf-style arguments are
  // interpolated into it. Neither passes the allowlist, so neither may reach the sink.
  it('never writes error text or interpolation arguments into msg', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    // A message that is not a string is outside pino's types; callers can still pass one.
    const untypedInfo: (...args: unknown[]) => void = logger.info.bind(logger);
    logger.error(driverError());
    logger.error({ err: driverError() });
    logger.error({ err: { message: CANARY } });
    logger.info('note %s', CANARY);
    // eslint-disable-next-line quality/no-log-request-body -- canary plants forbidden keys on purpose
    logger.info({ id: 'evt_1' }, 'payload %o', { sessionToken: CANARY });
    untypedInfo({ id: 'evt_2' }, { note: CANARY });

    expect(sink.records().map((record) => [record['msg'], record['err']])).toEqual([
      ['error logged', DRIVER_ERROR_SUMMARY],
      ['error logged', DRIVER_ERROR_SUMMARY],
      ['error logged', { type: 'object' }],
      ['note %s', undefined],
      ['payload %o', undefined],
      [undefined, undefined],
    ]);
    expect(sink.text()).not.toContain(CANARY);
  });

  // A message that is not a string reaches `msg` as it is: only a string first argument is kept.
  it('drops a first argument that is neither a string nor an object', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    const untypedInfo: (...args: unknown[]) => void = logger.info.bind(logger);
    untypedInfo(31415926);
    untypedInfo(true);
    untypedInfo(undefined, 27182818);
    logger.info('kept message');

    expect(sink.records().map((record) => record['msg'])).toEqual([
      undefined,
      undefined,
      undefined,
      'kept message',
    ]);
    expect(sink.text()).not.toMatch(/31415926|27182818|"msg":true/);
  });

  // An Error made in another realm (a `vm` context, a worker's structured clone) fails
  // `instanceof Error`; it is still an Error and gets the same allowlist, never its own fields.
  it('summarises a cross-realm Error like any Error: no enumerable field reaches the sink', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    const foreign = () =>
      Object.assign(vm.runInNewContext('new Error("x")') as Error, {
        code: '23505',
        detail: `Key (note)=(${CANARY}) already exists.`,
      });
    logger.error({ err: foreign() }, 'cross-realm err');
    logger.error({ failure: foreign(), job: { attempts: [foreign()] } }, 'cross-realm nested');
    logger.error(foreign());
    childLogger(logger, { lastFailure: foreign() }).info('cross-realm binding');

    const [err, nested, bare, bound] = sink.records();
    const summary = { type: 'Error', code: '23505' };
    expect(err?.['err']).toEqual(summary);
    expect(nested).toMatchObject({ failure: summary, job: { attempts: [summary] } });
    expect([bare?.['msg'], bare?.['err']]).toEqual(['error logged', summary]);
    expect(bound?.['lastFailure']).toEqual(summary);
    expect(sink.text()).not.toContain(CANARY);
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

  it('logs an error name that is not identifier-shaped as Error, in the cause chain too', () => {
    const sink = memoryLogStream();
    const logger = pino(loggerOptions({ level: 'info' }), sink);
    const freeTextName = Object.assign(new Error('x'), { name: `Error: ${CANARY}` });
    logger.error({ err: new Error('wrapper', { cause: freeTextName }) }, 'free-text name canary');

    expect(sink.records()[0]?.['err']).toEqual({ type: 'Error', cause: { type: 'Error' } });
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
      app = await createPlatformTestApp({ logs, controllers: [FailedQueryController] });
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

    it('logs a Nest Logger.error(error) without a message as error logged; no marker', () => {
      const before = logs.records().length;
      app.get(Logger).error(failedQuery());

      const added = logs.records().slice(before);
      expect(added.map((line) => ({ msg: line['msg'], err: line['err'] }))).toEqual([
        { msg: 'error logged', err: { type: 'Error', cause: DRIVER_ERROR_SUMMARY } },
      ]);
      expect(logs.text()).not.toContain(CANARY);
    });

    // nestjs-pino writes the last optional argument of a Nest Logger call as `context`, unchanged:
    // a stack (`error(message, err.stack)`) or a value (`warn(message, value)`) would be written raw.
    it('keeps a Nest Logger context only when it is a name; a stack or a value is redacted', () => {
      const before = logs.records().length;
      const stack = `Error: ${CANARY}\n    at handler (/app/src/demo.ts:1:1)`;
      new NestLogger().error('stack as context', stack);
      NestLogger.error('static stack as context', stack);
      new NestLogger().warn('value as context', { note: CANARY });
      new NestLogger().log('free text as context', `note ${CANARY}`);
      new NestLogger().log('number as context', 31415926);
      new NestLogger('DemoService').log('named context');
      NestLogger.log('static named context', 'demo.Worker');

      const added = logs.records().slice(before);
      expect(added.map((line) => [line['msg'], line['context']])).toEqual([
        ['stack as context', REDACTED],
        ['static stack as context', REDACTED],
        ['value as context', REDACTED],
        ['free text as context', REDACTED],
        ['number as context', REDACTED],
        ['named context', 'DemoService'],
        ['static named context', 'demo.Worker'],
      ]);
      expect(logs.text()).not.toMatch(new RegExp(`${CANARY}|31415926`));
    });

    // Fastify answers a malformed path (FST_ERR_BAD_URL) itself, before routing and ProblemFilter;
    // its default body is plain JSON that quotes the whole URL, query included.
    it('answers a malformed URL with a problem body: path only, no detail, no query', async () => {
      const res = await app.inject({ method: 'GET', url: `/v1/nope%zz?sig=${CANARY}` });

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
      expect(res.json()).toEqual({
        type: `${PROBLEM_TYPE_BASE}/VALIDATION_FAILED`,
        title: 'Request validation failed',
        status: 400,
        code: 'VALIDATION_FAILED',
        instance: '/v1/nope%zz',
      });
      expect(res.body).not.toContain(CANARY);
      expect(logs.text()).not.toContain(CANARY);
    });

    it('answers an unknown route with its path only: no query in detail, instance or logs', async () => {
      const res = await app.inject({ method: 'GET', url: `/v1/nope?sig=${CANARY}` });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({
        code: 'NOT_FOUND',
        instance: '/v1/nope',
        detail: 'Cannot GET /v1/nope',
      });
      expect(res.body).not.toContain(CANARY);
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
