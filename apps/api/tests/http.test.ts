// Boots the real Nest/Fastify app in-process (same composition root as main.ts) and checks the
// platform endpoints against the generated contract types.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { HealthReport, ProblemDetails, VersionInfo } from '@ai-stylist/contracts/types';
import type { DemoOutboxFlowRequestedV1 } from '@ai-stylist/contracts/events';
import { ERROR_CODES, PROBLEM_TYPE_BASE } from '@ai-stylist/shared-kernel';
import { memoryLogStream } from '@ai-stylist/test-support';

import { createApp } from '../src/app.module.js';
import { loadConfig } from '../src/config.js';
import { PROBLEM_CONTENT_TYPE } from '../src/platform/index.js';

const CANARY = 'CANARY_SENSITIVE_9f3a';
const RATE_LIMIT_MAX = 3;

// Each test uses its own client IP: the rate limit in this suite is tiny on purpose.
// Parametric on the environment (brief T05): with DATABASE_URL the docker/CI Postgres must be
// reachable and the db check is `ok`; without it the check is honestly `down` (503).
const databaseUrl = process.env['DATABASE_URL']?.trim() || undefined;

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

describe('api (Fastify in-process)', () => {
  let app: NestFastifyApplication;
  const logs = memoryLogStream();

  beforeAll(async () => {
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
    app = await createApp({ config, logStream: logs });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
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

  it('POST /v1/dev/demo-events returns 202 with a demo.outbox-flow.requested.v1 envelope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/dev/demo-events',
      remoteAddress: '10.1.0.4',
      payload: { demoId: 'demo-run-7', note: 'hello outbox' },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json<DemoOutboxFlowRequestedV1 & { id: string; aggregate: { id: string } }>();
    expect(body.type).toBe('demo.outbox-flow.requested.v1');
    expect(body.id).toMatch(/^evt_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    expect(body.payload).toMatchObject({ demoId: 'demo-run-7', note: 'hello outbox' });
    expect(body.aggregate.id).toBe('demo-run-7');
  });

  it('does not log forbidden request material (authorization header, body, query)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/dev/demo-events?token=${CANARY}`,
      remoteAddress: '10.1.0.5',
      headers: { authorization: `Bearer ${CANARY}`, cookie: `session=${CANARY}` },
      payload: { demoId: 'demo-run-8', note: CANARY, password: CANARY },
    });
    expect(res.statusCode).toBe(202);
    const text = logs.text();
    expect(text).toContain('/v1/dev/demo-events'); // the request WAS logged ...
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
    const body = limited.json<ProblemDetails>();
    expect(isProblem(body)).toBe(true);
    expect(body).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      title: ERROR_CODES.RATE_LIMITED.title,
    });
  });
});
