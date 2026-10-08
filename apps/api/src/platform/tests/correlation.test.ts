// The correlation id adapter on a real Nest + Fastify app with the platform's logger and an
// in-process telemetry SDK (@fastify/otel request spans into an in-memory exporter): a valid
// `x-correlation-id` is echoed, a missing or bad one is replaced by a minted id, controllers read
// it with `currentCorrelationId()` (also after body parsing), every pino line of the request
// carries `correlation_id`, and so does the request span (planning/14 §2–§3).
import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CORRELATION_ID_EXAMPLES } from '@ai-stylist/shared-kernel';
import { memoryLogStream } from '@ai-stylist/test-support';

import {
  CORRELATION_ID_HEADER,
  currentCorrelationId,
  isValidCorrelationId,
  registerCorrelationId,
} from '../index.js';
import type { Telemetry } from '../telemetry/lifecycle.js';
import { startTelemetry } from '../telemetry/telemetry.js';

import { memorySpanExporter } from './memory-span-exporter.js';
import { createPlatformTestApp } from './platform-test-app.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PATH = '/v1/test/correlation';

type Probe = { readonly correlationId: string | undefined };

@Controller('v1/test/correlation')
class CorrelationProbeController {
  constructor(@Inject(Logger) private readonly logger: Logger) {}

  @Get()
  read(): Probe {
    this.logger.log('probe handler');
    return { correlationId: currentCorrelationId() };
  }

  @Post()
  @HttpCode(200)
  write(@Body() _body: unknown): Probe {
    this.logger.log('probe handler');
    return { correlationId: currentCorrelationId() };
  }
}

describe('correlation id (Nest + Fastify, in-process)', () => {
  const logs = memoryLogStream();
  const spans = memorySpanExporter();
  let telemetry: Telemetry;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Before the Fastify instance exists: @fastify/otel instruments it on initialization.
    telemetry = startTelemetry({ service: 'api', spanExporter: spans });
    app = await createPlatformTestApp({
      logs,
      controllers: [CorrelationProbeController],
      beforeInit: registerCorrelationId,
    });
  });

  afterAll(async () => {
    await app.close();
    await telemetry.shutdown();
  });

  // The shared-kernel vectors, which the envelope schema itself is tested on in
  // packages/contracts/tests/events.test.ts: the header check accepts exactly what an envelope does.
  it.each(CORRELATION_ID_EXAMPLES.accepted)('accepts the envelope-valid id %j', (id) => {
    expect(isValidCorrelationId(id)).toBe(true);
  });

  it.each(CORRELATION_ID_EXAMPLES.rejected)('rejects the envelope-invalid id %j', (id) => {
    expect(isValidCorrelationId(id)).toBe(false);
  });

  it.each([undefined, 7, ['corr-1']])('rejects a non-string %j', (value) => {
    expect(isValidCorrelationId(value)).toBe(false);
  });

  it('echoes a valid client id and exposes it to the controller', async () => {
    const res = await app.inject({
      method: 'GET',
      url: PATH,
      headers: { [CORRELATION_ID_HEADER]: 'corr-client-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers[CORRELATION_ID_HEADER]).toBe('corr-client-1');
    expect(res.json()).toEqual({ correlationId: 'corr-client-1' });
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['129 characters', 'x'.repeat(129)],
    ['with a space', 'corr 1'],
    ['with a semicolon', 'corr;1'],
  ])('mints a new id when the client id is %s', async (_label, sent) => {
    const res = await app.inject({
      method: 'GET',
      url: PATH,
      headers: sent === undefined ? {} : { [CORRELATION_ID_HEADER]: sent },
    });

    const minted = res.headers[CORRELATION_ID_HEADER];
    expect(minted).toMatch(UUID);
    expect(res.json()).toEqual({ correlationId: minted });
  });

  it('keeps the id across body parsing, on every log line of the request and its span', async () => {
    const id = 'corr-post-2';
    const before = logs.records().length;

    const res = await app.inject({
      method: 'POST',
      url: PATH,
      headers: { [CORRELATION_ID_HEADER]: id },
      payload: { demo: 'x' },
    });

    expect(res.json()).toEqual({ correlationId: id });
    const lines = logs.records().slice(before);
    const messages = lines.map((line) => line['msg']);
    expect(messages).toContain('probe handler');
    expect(messages).toContain('request completed');
    for (const line of lines) expect(line['correlation_id'], String(line['msg'])).toBe(id);
    await telemetry.flush();
    const tagged = spans.spans.filter((span) => span.attributes['correlation_id'] === id);
    expect(tagged.map((span) => span.name)).toContain('request');
  });
});
