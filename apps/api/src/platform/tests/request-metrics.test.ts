// `registerRequestMetrics` on a real Fastify instance with an in-memory metric reader
// (planning/14 §4): `stylist.api.request.duration` is a seconds histogram with the explicit
// semantic-convention buckets and route-template attributes (never the raw path), and
// `stylist.api.request.errors` counts 5xx responses only, from 0 for every route. The second suite
// wires it the way the API composition root does, on a Nest app's Fastify instance before init.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  METRIC_NAMES,
  REQUEST_DURATION_BUCKETS_SECONDS,
  registerRequestMetrics,
} from '../index.js';

import {
  type MemoryMetrics,
  histogramPoints,
  memoryMetrics,
  metricNamed,
  numberPoints,
  valueAt,
} from './memory-metrics.js';
import { createPlatformTestApp } from './platform-test-app.js';

const ITEM_ROUTE = '/v1/test/items/:itemId';
const BROKEN_ROUTE = '/v1/test/broken';
/** A raw path value that must never become an attribute value. */
const RAW_ID = 'itm-raw-path-7f3a';

describe('API request metrics (Fastify, in-memory reader)', () => {
  let metrics: MemoryMetrics;
  let app: FastifyInstance;

  beforeAll(async () => {
    metrics = memoryMetrics();
    app = fastify();
    // As the composition root calls it: before any route is registered.
    registerRequestMetrics(app, metrics.meter);
    app.get(ITEM_ROUTE, () => ({ ok: true }));
    app.get(BROKEN_ROUTE, () => {
      throw new Error('injected failure');
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await metrics.shutdown();
  });

  it('registers the 5xx counter at 0 for every route and for unmatched requests before any request', async () => {
    const errors = metricNamed(await metrics.collect(), METRIC_NAMES.requestErrors);

    expect(errors.descriptor.name).toBe('stylist.api.request.errors');
    for (const route of [ITEM_ROUTE, BROKEN_ROUTE]) {
      expect(valueAt(errors, { 'http.route': route, 'error.class': '5xx' })).toBe(0);
    }
    expect(valueAt(errors, { 'error.class': '5xx' })).toBe(0);
  });

  it('records the duration in seconds with explicit buckets and the route template, method and status', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/test/items/${RAW_ID}?q=${RAW_ID}` });
    expect(res.statusCode).toBe(200);

    const duration = metricNamed(await metrics.collect(), METRIC_NAMES.requestDuration);
    expect(duration.descriptor).toMatchObject({
      name: 'stylist.api.request.duration',
      unit: 's',
    });
    const [point, ...others] = histogramPoints(duration);
    expect(others).toEqual([]);
    expect(point?.attributes).toEqual({
      'http.route': ITEM_ROUTE,
      'http.request.method': 'GET',
      'http.response.status_code': 200,
    });
    expect(point?.value.buckets.boundaries).toEqual([...REQUEST_DURATION_BUCKETS_SECONDS]);
    expect(point?.value.buckets.boundaries).toEqual([
      0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
    ]);
    expect(point?.value.count).toBe(1);
    // Seconds, not milliseconds: an in-process request takes far less than a second.
    expect(point?.value.sum).toBeGreaterThan(0);
    expect(point?.value.sum).toBeLessThan(1);
    expect(JSON.stringify(point?.attributes)).not.toContain(RAW_ID);
  });

  it('counts 5xx responses per route and leaves 4xx out of the error counter', async () => {
    const missing = `/v1/test/missing/${RAW_ID}`;
    expect((await app.inject({ method: 'GET', url: BROKEN_ROUTE })).statusCode).toBe(500);
    expect((await app.inject({ method: 'GET', url: BROKEN_ROUTE })).statusCode).toBe(500);
    expect((await app.inject({ method: 'GET', url: missing })).statusCode).toBe(404);

    const collected = await metrics.collect();
    const errors = metricNamed(collected, METRIC_NAMES.requestErrors);
    expect(valueAt(errors, { 'http.route': BROKEN_ROUTE, 'error.class': '5xx' })).toBe(2);
    expect(valueAt(errors, { 'http.route': ITEM_ROUTE, 'error.class': '5xx' })).toBe(0);
    expect(valueAt(errors, { 'error.class': '5xx' })).toBe(0);
    expect(numberPoints(errors).every((p) => p.attributes['error.class'] === '5xx')).toBe(true);

    const duration = metricNamed(collected, METRIC_NAMES.requestDuration);
    const byAttributes = histogramPoints(duration).map((p) => ({
      attributes: p.attributes,
      count: p.value.count,
    }));
    expect(byAttributes).toContainEqual({
      attributes: {
        'http.route': BROKEN_ROUTE,
        'http.request.method': 'GET',
        'http.response.status_code': 500,
      },
      count: 2,
    });
    // No route matched: the attribute is omitted, never replaced by the raw path.
    expect(byAttributes).toContainEqual({
      attributes: { 'http.request.method': 'GET', 'http.response.status_code': 404 },
      count: 1,
    });
    expect(JSON.stringify(byAttributes)).not.toContain(RAW_ID);
  });
});

describe('API request metrics on a Nest + Fastify app (composition-root wiring)', () => {
  let metrics: MemoryMetrics;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    metrics = memoryMetrics();
    // No database: `/v1/health` answers 503, a real 5xx from a Nest route. `beforeInit` is where
    // `createApp` calls it: after NestFactory.create, before the routes are registered.
    app = await createPlatformTestApp({
      level: 'silent',
      beforeInit: (fastify) => registerRequestMetrics(fastify, metrics.meter),
    });
  });

  afterAll(async () => {
    await app.close();
    await metrics.shutdown();
  });

  it('starts at 0 for the Nest routes and records their templates and 5xx', async () => {
    const before = metricNamed(await metrics.collect(), METRIC_NAMES.requestErrors);
    expect(valueAt(before, { 'http.route': '/v1/health', 'error.class': '5xx' })).toBe(0);
    expect(valueAt(before, { 'http.route': '/v1/version', 'error.class': '5xx' })).toBe(0);

    expect((await app.inject({ method: 'GET', url: '/v1/version' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/health' })).statusCode).toBe(503);

    const collected = await metrics.collect();
    const errors = metricNamed(collected, METRIC_NAMES.requestErrors);
    expect(valueAt(errors, { 'http.route': '/v1/health', 'error.class': '5xx' })).toBe(1);
    expect(valueAt(errors, { 'http.route': '/v1/version', 'error.class': '5xx' })).toBe(0);
    const recorded = histogramPoints(metricNamed(collected, METRIC_NAMES.requestDuration)).map(
      (p) => p.attributes,
    );
    expect(recorded).toEqual(
      expect.arrayContaining([
        {
          'http.route': '/v1/version',
          'http.request.method': 'GET',
          'http.response.status_code': 200,
        },
        {
          'http.route': '/v1/health',
          'http.request.method': 'GET',
          'http.response.status_code': 503,
        },
      ]),
    );
  });
});
