// Boots the real Nest/Fastify app in-process (same composition root as main.ts) and checks the
// platform endpoints against the generated contract types, the correlation id and request metrics
// wiring, the `demo-outbox-flow` flag gate, and the config rules of the keys the root binds.
import { metrics } from '@opentelemetry/api';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { HealthReport, ProblemDetails, VersionInfo } from '@ai-stylist/contracts/types';
import type {
  DemoOutboxFlowRequestedV1,
  EventEnvelope as ContractEnvelope,
} from '@ai-stylist/contracts/events';
import { type DbHandle, createDb, isLocalDatabaseUrl, migrate } from '@ai-stylist/db';
import { ERROR_CODES, type FeatureFlagKey, PROBLEM_TYPE_BASE } from '@ai-stylist/shared-kernel';
import { fakeFeatureFlags, memoryLogStream } from '@ai-stylist/test-support';

import { createApp } from '../src/app.module.js';
import { ConfigError, loadConfig } from '../src/config.js';
import { DEMO_ID_MAX, type DemoEventEnvelope } from '../src/dev/demo-events.controller.js';
import { isDevRouteEnabled } from '../src/dev/index.js';
import {
  CORRELATION_ID_HEADER,
  CORRELATION_ID_PATTERN,
  METRIC_NAMES,
  type OutboxWriter,
  PROBLEM_CONTENT_TYPE,
} from '../src/platform/index.js';
import {
  histogramPoints,
  memoryMetrics,
  metricNamed,
  valueAt,
} from '../src/platform/tests/memory-metrics.js';

const CANARY = 'CANARY_SENSITIVE_9f3a';
const RATE_LIMIT_MAX = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DEMO_PATH = '/v1/dev/demo-events';

// Each test uses its own client IP: the rate limit in this suite is tiny on purpose.
// Parametric on the environment (brief T05): with DATABASE_URL the docker/CI Postgres must be
// reachable, the db check is `ok` and the demo event lands in `platform_outbox`; without it the
// check is honestly `down` (503) and the demo event is refused (503), never silently dropped.
const databaseUrl = process.env['DATABASE_URL']?.trim() || undefined;

/** One run's demo ids: (aggregate kind, id, sequence) is unique in the outbox across runs. */
const RUN = crypto.randomUUID();

/**
 * One sink for every app in this file: nestjs-pino keeps a single pino-http instance per process
 * (the first app's options win), so later apps' request lines land here too. Tests find their
 * own lines by correlation id.
 */
const logs = memoryLogStream();

/** The `platform_outbox` columns (and envelope fields) the demo test reads back. */
type OutboxRow = {
  type: string;
  aggregate_id: string;
  envelope_id: string;
  correlation_id: string;
};

function isProblem(body: unknown): body is ProblemDetails {
  const p = body as ProblemDetails;
  return (
    typeof p.type === 'string' &&
    typeof p.title === 'string' &&
    typeof p.status === 'number' &&
    typeof p.code === 'string' &&
    p.code in ERROR_CODES
  );
}

/** An app without DATABASE_URL: routing, flags and the dev route, no queue/relay runtime. */
function configWithoutDatabase(overrides: Record<string, string>) {
  const { DATABASE_URL: _omit, ...env } = process.env;
  return loadConfig({ ...env, NODE_ENV: 'test', ...overrides });
}

describe('api (Fastify in-process)', () => {
  let app: NestFastifyApplication;
  let db: DbHandle | undefined;
  const flags = fakeFeatureFlags<FeatureFlagKey>({ 'demo-outbox-flow': true });

  beforeAll(async () => {
    if (databaseUrl) {
      // The app boots the pg-boss queue and the outbox relay, which need a migrated database
      // (`just db-migrate`). Applying pending migrations is idempotent; never on a remote DB.
      if (!isLocalDatabaseUrl(databaseUrl)) {
        throw new Error('http.test.ts migrates DATABASE_URL and only runs against a local one');
      }
      db = createDb(databaseUrl, { max: 1 });
      await migrate(db.db);
    }
    const config = loadConfig({
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      APP_VERSION: '1.2.3',
      GIT_COMMIT: 'abc123',
      BUILD_TIME: '2026-09-10T00:00:00Z',
      RATE_LIMIT_MAX: String(RATE_LIMIT_MAX),
      RATE_LIMIT_WINDOW_MS: '60000',
    });
    app = await createApp({ config, logStream: logs, featureFlags: flags });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    try {
      await db?.close();
    } finally {
      await app.close();
    }
  });

  it(`GET /v1/health reports db=${databaseUrl ? 'ok (DATABASE_URL set)' : 'down (no DATABASE_URL)'}`, async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health', remoteAddress: '10.1.0.1' });
    if (databaseUrl) {
      expect(res.statusCode, `DATABASE_URL is set but the db check failed: ${res.body}`).toBe(200);
      const body = res.json<HealthReport>();
      expect(body).toEqual({ status: 'ok', checks: { db: 'ok' } });
    } else {
      expect(res.statusCode).toBe(503);
      expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
      const body = res.json<ProblemDetails & { checks: HealthReport['checks'] }>();
      expect(isProblem(body)).toBe(true);
      expect(body.status).toBe(503);
      expect(body.checks).toEqual({ db: 'down' });
    }
  });

  it('GET /v1/version serves APP_VERSION / GIT_COMMIT / BUILD_TIME', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/version', remoteAddress: '10.1.0.2' });
    expect(res.statusCode).toBe(200);
    const body = res.json<VersionInfo>();
    expect(body).toEqual({ version: '1.2.3', commit: 'abc123', builtAt: '2026-09-10T00:00:00Z' });
  });

  it('unknown routes answer application/problem+json in the contract shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope', remoteAddress: '10.1.0.3' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    const body = res.json<ProblemDetails>();
    expect(isProblem(body)).toBe(true);
    expect(body).toMatchObject({
      type: `${PROBLEM_TYPE_BASE}/NOT_FOUND`,
      title: ERROR_CODES.NOT_FOUND.title,
      status: 404,
      code: 'NOT_FOUND',
      instance: '/nope',
    });
  });

  it('echoes a valid x-correlation-id and mints one when it is absent or invalid', async () => {
    const given = `corr-http-1-${RUN}`;
    const echoed = await app.inject({
      method: 'GET',
      url: '/v1/version',
      remoteAddress: '10.1.0.7',
      headers: { [CORRELATION_ID_HEADER]: given },
    });
    expect(echoed.statusCode).toBe(200);
    expect(echoed.headers[CORRELATION_ID_HEADER]).toBe(given);

    const absent = await app.inject({ method: 'GET', url: '/nope', remoteAddress: '10.1.0.7' });
    expect(absent.statusCode).toBe(404); // a problem response carries it too
    expect(absent.headers[CORRELATION_ID_HEADER]).toMatch(UUID);
    expect(absent.headers[CORRELATION_ID_HEADER]).toMatch(CORRELATION_ID_PATTERN);

    const invalid = await app.inject({
      method: 'GET',
      url: '/v1/version',
      remoteAddress: '10.1.0.7',
      headers: { [CORRELATION_ID_HEADER]: 'bad id;x' },
    });
    expect(invalid.headers[CORRELATION_ID_HEADER]).toMatch(UUID);
  });

  it(`POST /v1/dev/demo-events ${databaseUrl ? 'returns 202 and appends one platform_outbox row' : 'answers a 503 problem (no DATABASE_URL, no outbox)'}`, async () => {
    const demoId = `demo-run-7-${RUN}`;
    const correlationId = `corr-demo-7-${RUN}`;
    const res = await app.inject({
      method: 'POST',
      url: DEMO_PATH,
      remoteAddress: '10.1.0.4',
      headers: { [CORRELATION_ID_HEADER]: correlationId },
      payload: { demoId, note: 'hello outbox' },
    });
    expect(res.headers[CORRELATION_ID_HEADER]).toBe(correlationId);
    if (databaseUrl) {
      expect(res.statusCode, `DATABASE_URL is set but the append failed: ${res.body}`).toBe(202);
      const body = res.json<DemoOutboxFlowRequestedV1 & ContractEnvelope>();
      expect(body.type).toBe('demo.outbox-flow.requested.v1');
      expect(body.id).toMatch(/^evt_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
      expect(body.payload).toMatchObject({ demoId, note: 'hello outbox' });
      expect(body.aggregate.id).toBe(demoId);
      expect(body.correlationId).toBe(correlationId);
      // The relay may already have dispatched it: the row exists either way, exactly once.
      const rows = await db!.sql<OutboxRow[]>`
        select type, aggregate_id, payload->>'id' as envelope_id,
          payload->>'correlationId' as correlation_id
        from platform_outbox where id = ${body.id}`;
      expect(rows).toEqual([
        {
          type: 'demo.outbox-flow.requested.v1',
          aggregate_id: demoId,
          envelope_id: body.id,
          correlation_id: correlationId,
        },
      ]);
    } else {
      expect(res.statusCode).toBe(503);
      expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
      const body = res.json<ProblemDetails>();
      expect(isProblem(body)).toBe(true);
      expect(body).toMatchObject({
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        detail: 'outbox unavailable: DATABASE_URL is not set',
      });
    }
  });

  it('POST /v1/dev/demo-events with demo-outbox-flow off answers a 404 problem and appends nothing', async () => {
    const demoId = `demo-run-10-${RUN}`;
    flags.set('demo-outbox-flow', false);
    try {
      const res = await app.inject({
        method: 'POST',
        url: DEMO_PATH,
        remoteAddress: '10.1.0.8',
        payload: { demoId },
      });
      // 404, not the 503 an attempted append answers without a database: the gate runs first.
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
      expect(res.headers[CORRELATION_ID_HEADER]).toMatch(UUID);
      const body = res.json<ProblemDetails>();
      expect(isProblem(body)).toBe(true);
      expect(body).toMatchObject({ status: 404, code: 'NOT_FOUND', instance: DEMO_PATH });
      if (databaseUrl) {
        const rows = await db!.sql`select id from platform_outbox where aggregate_id = ${demoId}`;
        expect(rows).toHaveLength(0);
      }
    } finally {
      flags.set('demo-outbox-flow', true);
    }
  });

  it('POST /v1/dev/demo-events rejects an over-long demoId with a 400 problem', async () => {
    const res = await app.inject({
      method: 'POST',
      url: DEMO_PATH,
      remoteAddress: '10.1.0.6',
      payload: { demoId: 'd'.repeat(DEMO_ID_MAX + 1) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    const body = res.json<ProblemDetails>();
    expect(isProblem(body)).toBe(true);
    expect(body).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    expect(body.errors?.map((e) => e.pointer)).toEqual(['/demoId']);
  });

  it('does not log forbidden request material (authorization header, body, query)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${DEMO_PATH}?token=${CANARY}`,
      remoteAddress: '10.1.0.5',
      headers: { authorization: `Bearer ${CANARY}`, cookie: `session=${CANARY}` },
      payload: { demoId: `demo-run-8-${RUN}`, note: CANARY, password: CANARY },
    });
    expect(res.statusCode).toBe(databaseUrl ? 202 : 503);
    const text = logs.text();
    expect(text).toContain(DEMO_PATH); // the request WAS logged ...
    expect(text).not.toContain(CANARY); // ... without any of the planted values
  });

  it(`returns a 429 problem after ${RATE_LIMIT_MAX} requests from one client`, async () => {
    const hit = () =>
      app.inject({ method: 'GET', url: '/v1/version', remoteAddress: '203.0.113.7' });
    const responses = [];
    for (let i = 0; i < RATE_LIMIT_MAX + 1; i++) responses.push(await hit());
    expect(responses.slice(0, RATE_LIMIT_MAX).map((r) => r.statusCode)).toEqual(
      Array.from({ length: RATE_LIMIT_MAX }, () => 200),
    );
    const limited = responses[RATE_LIMIT_MAX]!;
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.headers[CORRELATION_ID_HEADER]).toMatch(UUID);
    const body = limited.json<ProblemDetails>();
    expect(isProblem(body)).toBe(true);
    expect(body).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      title: ERROR_CODES.RATE_LIMITED.title,
    });
  });
});

describe('dev demo route: one correlation id end to end (recording outbox, no database)', () => {
  let app: NestFastifyApplication;
  const flags = fakeFeatureFlags<FeatureFlagKey>({ 'demo-outbox-flow': true });
  const appended: unknown[] = [];
  const recordingOutbox: OutboxWriter = {
    append: (envelope) => {
      appended.push(envelope);
      return Promise.resolve();
    },
  };

  beforeAll(async () => {
    const config = configWithoutDatabase({ APP_ENV: 'local', LOG_LEVEL: 'info' });
    app = await createApp({
      config,
      logStream: logs,
      featureFlags: flags,
      outboxWriter: recordingOutbox,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (headers: Record<string, string>, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: DEMO_PATH, headers, payload });

  it("the envelope carries the request's x-correlation-id, as do its logs and the response header", async () => {
    const correlationId = `corr-e2e-1-${RUN}`;
    const appendedBefore = appended.length;

    const res = await post({ [CORRELATION_ID_HEADER]: correlationId }, { demoId: `e2e-1-${RUN}` });

    expect(res.statusCode).toBe(202);
    expect(res.headers[CORRELATION_ID_HEADER]).toBe(correlationId);
    const envelope = res.json<DemoEventEnvelope>();
    expect(envelope.correlationId).toBe(correlationId);
    expect(appended.slice(appendedBefore)).toEqual([envelope]);
    const isCompletion = (line: Record<string, unknown>) =>
      line['msg'] === 'request completed' && line['correlation_id'] === correlationId;
    const completed = logs.records().filter(isCompletion);
    expect(completed).toHaveLength(1);
    expect(completed[0]?.['req']).toMatchObject({ method: 'POST', url: DEMO_PATH });
    expect(completed[0]?.['res']).toEqual({ statusCode: 202 });
  });

  it.each([
    ['absent', {}],
    ['invalid', { [CORRELATION_ID_HEADER]: 'not valid;id' }],
  ])('a minted id (header %s) is the one the envelope carries', async (_label, headers) => {
    const res = await post(headers, { note: 'minted' });

    expect(res.statusCode).toBe(202);
    const minted = res.headers[CORRELATION_ID_HEADER];
    expect(minted).toMatch(UUID);
    expect(res.json<DemoEventEnvelope>().correlationId).toBe(minted);
  });

  it('ignores a correlationId in the body: the header is the only input', async () => {
    const res = await post(
      { [CORRELATION_ID_HEADER]: `corr-header-3-${RUN}` },
      { correlationId: `corr-body-3-${RUN}` },
    );

    expect(res.statusCode).toBe(202);
    expect(res.json<DemoEventEnvelope>().correlationId).toBe(`corr-header-3-${RUN}`);
  });

  it('flag off: 404 problem+json and nothing appended; flag back on: 202', async () => {
    const appendedBefore = appended.length;
    flags.set('demo-outbox-flow', false);
    try {
      const off = await post({ [CORRELATION_ID_HEADER]: `corr-off-4-${RUN}` }, { note: 'off' });
      expect(off.statusCode).toBe(404);
      expect(off.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
      expect(off.headers[CORRELATION_ID_HEADER]).toBe(`corr-off-4-${RUN}`);
      expect(off.json<ProblemDetails>()).toMatchObject({ status: 404, code: 'NOT_FOUND' });
      expect(appended).toHaveLength(appendedBefore);
    } finally {
      flags.set('demo-outbox-flow', true);
    }
    const on = await post({}, { note: 'on' });
    expect(on.statusCode).toBe(202);
    expect(appended).toHaveLength(appendedBefore + 1);
  });
});

describe('createApp wires request metrics (global meter) without changing responses', () => {
  let app: NestFastifyApplication;
  const recorded = memoryMetrics();

  beforeAll(async () => {
    // Before createApp: `registerRequestMetrics` takes the global meter when it is called.
    expect(metrics.setGlobalMeterProvider({ getMeter: () => recorded.meter })).toBe(true);
    const config = configWithoutDatabase({
      LOG_LEVEL: 'silent',
      APP_VERSION: '1.2.3',
      GIT_COMMIT: 'abc123',
      BUILD_TIME: '2026-09-10T00:00:00Z',
    });
    app = await createApp({ config, logStream: logs, featureFlags: fakeFeatureFlags() });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    try {
      await app.close();
    } finally {
      metrics.disable();
      await recorded.shutdown();
    }
  });

  it('GET /v1/version answers as before and is measured by its route template', async () => {
    const zero = metricNamed(await recorded.collect(), METRIC_NAMES.requestErrors);
    expect(valueAt(zero, { 'http.route': '/v1/version', 'error.class': '5xx' })).toBe(0);

    const res = await app.inject({ method: 'GET', url: '/v1/version' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json<VersionInfo>()).toEqual({
      version: '1.2.3',
      commit: 'abc123',
      builtAt: '2026-09-10T00:00:00Z',
    });
    const collected = await recorded.collect();
    const durations = histogramPoints(metricNamed(collected, METRIC_NAMES.requestDuration));
    expect(durations.map((point) => point.attributes)).toContainEqual({
      'http.route': '/v1/version',
      'http.request.method': 'GET',
      'http.response.status_code': 200,
    });
  });
});

describe('dev routes fail closed', () => {
  it.each([
    ['development', 'local', true],
    ['test', 'dev', true],
    ['development', 'staging', false],
    ['development', 'prod', false],
    ['production', 'local', false],
    ['production', 'dev', false],
  ] as const)('NODE_ENV=%s APP_ENV=%s → enabled=%s', (NODE_ENV, APP_ENV, enabled) => {
    expect(isDevRouteEnabled({ NODE_ENV, APP_ENV })).toBe(enabled);
  });

  it('POST /v1/dev/demo-events is not registered when APP_ENV=staging (NODE_ENV=test)', async () => {
    // No DATABASE_URL: this app only needs routing, not the queue/relay runtime.
    const config = configWithoutDatabase({ APP_ENV: 'staging', LOG_LEVEL: 'silent' });
    const staging = await createApp({ config, logStream: logs });
    try {
      await staging.init();
      await staging.getHttpAdapter().getInstance().ready();
      const res = await staging.inject({
        method: 'POST',
        url: DEMO_PATH,
        payload: { demoId: `demo-run-9-${RUN}` },
      });
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
      expect(res.json<ProblemDetails>()).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    } finally {
      await staging.close();
    }
  });
});

describe('config: PostHog keys', () => {
  const HOST = 'https://eu.i.posthog.com';
  const PROJECT_KEY = 'phc_synthetic_test';

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

  it('accepts a project key with an http(s) host, and treats empty values as unset', () => {
    expect(loadConfig({ POSTHOG_API_KEY: PROJECT_KEY, POSTHOG_HOST: HOST })).toMatchObject({
      POSTHOG_API_KEY: PROJECT_KEY,
      POSTHOG_HOST: HOST,
    });
    const unset = loadConfig({ POSTHOG_API_KEY: '', POSTHOG_HOST: ' ' });
    expect(unset.POSTHOG_API_KEY).toBeUndefined();
    expect(unset.POSTHOG_HOST).toBeUndefined();
  });

  it('refuses a personal phx_ key without echoing it', () => {
    const personal = 'phx_synthetic_personal';
    const error = configError({ POSTHOG_API_KEY: personal, POSTHOG_HOST: HOST });
    expect(error.message).toBe(
      'invalid configuration: POSTHOG_API_KEY: must be a PostHog project key (phc_…); a personal phx_ key is refused',
    );
    expect(error.message).not.toContain(personal);
  });

  it('refuses a key without a host', () => {
    expect(configError({ POSTHOG_API_KEY: PROJECT_KEY }).message).toBe(
      'invalid configuration: POSTHOG_HOST: required when POSTHOG_API_KEY is set',
    );
  });

  it('refuses a host that is not an http(s) URL without echoing it', () => {
    const error = configError({
      POSTHOG_API_KEY: PROJECT_KEY,
      POSTHOG_HOST: 'ftp://synthetic.example',
    });
    expect(error.message).toMatch(/^invalid configuration: POSTHOG_HOST: /);
    expect(error.message).not.toContain('synthetic.example');
  });
});
