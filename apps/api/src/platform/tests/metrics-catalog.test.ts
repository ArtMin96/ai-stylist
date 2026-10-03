// The emitted `stylist.api.*` / `stylist.queue.*` instruments match the PromQL the dashboards and
// alerts in docs/observability/grafana/** query. Every instrument is exercised once against an
// in-memory reader, converted with Grafana Cloud's OTLP → Prometheus rules
// (docs/observability/grafana.md "Metric names in PromQL": `.`/`-` → `_`, unit `s` → `_seconds`,
// monotonic counters `_total`, histograms `_bucket/_sum/_count`), and every series name and label
// those files use must be one the process emits. A renamed instrument or attribute fails here, not
// as a blank panel or a silent alert. `stylist_ci_*` (the CI emitter, tooling) is out of scope.
import { readFileSync, readdirSync } from 'node:fs';

import { DataPointType, type MetricData } from '@opentelemetry/sdk-metrics';
import fastify from 'fastify';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { QueueMetrics, registerRequestMetrics } from '../index.js';

import { type MemoryMetrics, memoryMetrics } from './memory-metrics.js';

const GRAFANA_DIR = new URL('../../../../../docs/observability/grafana/', import.meta.url);
/** Labels Grafana Cloud adds from the resource (`service.name`, the environment) and `le`. */
const RESOURCE_LABELS = ['service_name', 'job', 'deployment_environment_name', 'le'];
const OWN_SERIES = /\bstylist_(?:api|queue)_[a-z0-9_]+/g;
const QUERIES_OWN_SERIES = /\bstylist_(?:api|queue)_/;

function prometheusName(name: string): string {
  return name.replace(/[.-]/g, '_');
}

/** The Prometheus series names one OTel metric becomes. */
function seriesOf(metric: MetricData): string[] {
  const base =
    prometheusName(metric.descriptor.name) + (metric.descriptor.unit === 's' ? '_seconds' : '');
  switch (metric.dataPointType) {
    case DataPointType.HISTOGRAM:
      return [`${base}_bucket`, `${base}_sum`, `${base}_count`];
    case DataPointType.SUM:
      return [metric.isMonotonic ? `${base}_total` : base];
    default:
      return [base];
  }
}

/** Every PromQL expression in the dashboards and alert rules. */
function grafanaExpressions(): string[] {
  const expressions: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object' && value !== null) {
      for (const [key, inner] of Object.entries(value)) {
        if (key === 'expr' && typeof inner === 'string') expressions.push(inner);
        else visit(inner);
      }
    }
  };
  for (const dir of ['dashboards', 'alerts']) {
    const folder = new URL(`${dir}/`, GRAFANA_DIR);
    for (const file of readdirSync(folder).filter((f) => f.endsWith('.json'))) {
      visit(JSON.parse(readFileSync(new URL(file, folder), 'utf8')) as unknown);
    }
  }
  return expressions;
}

/** Label names an expression uses in `by (…)` / `without (…)` groupings and `{…}` matchers. */
function labelsIn(expression: string): string[] {
  const labels: string[] = [];
  for (const [, list] of expression.matchAll(/\b(?:by|without)\s*\(([^)]*)\)/g)) {
    labels.push(...(list ?? '').split(',').map((l) => l.trim()));
  }
  for (const [, matchers] of expression.matchAll(/stylist_(?:api|queue)_[a-z0-9_]+\{([^}]*)\}/g)) {
    for (const [, label] of (matchers ?? '').matchAll(/([a-z_][a-z0-9_]*)\s*(?:=~|!~|!=|=)/g)) {
      labels.push(label ?? '');
    }
  }
  return labels.filter((l) => l !== '');
}

describe('metrics catalog vs docs/observability/grafana PromQL', () => {
  let metrics: MemoryMetrics;
  let emitted: MetricData[];

  beforeAll(async () => {
    metrics = memoryMetrics();
    const app = fastify();
    registerRequestMetrics(app, metrics.meter);
    app.get('/v1/test/ok', () => ({ ok: true }));
    app.get('/v1/test/broken', () => {
      throw new Error('injected');
    });
    await app.inject({ method: 'GET', url: '/v1/test/ok' });
    await app.inject({ method: 'GET', url: '/v1/test/broken' });
    await app.close();
    const queue = new QueueMetrics({
      jobTypes: ['demo.outbox-flow'],
      deadLetterSources: ['demo.outbox-flow'],
      logger: pino({ level: 'silent' }),
      meter: metrics.meter,
    });
    queue.observeQueues(() =>
      Promise.resolve({
        depth: [{ queue: 'demo.outbox-flow', jobs: 1 }],
        oldestAgeSeconds: [{ jobType: 'demo.outbox-flow', seconds: 1 }],
      }),
    );
    emitted = await metrics.collect();
  });

  afterAll(async () => {
    await metrics.shutdown();
  });

  it('emits every stylist_api_* / stylist_queue_* series the dashboards and alerts query', () => {
    const emittedSeries = new Set(emitted.flatMap(seriesOf));
    const queried = new Set(grafanaExpressions().flatMap((e) => e.match(OWN_SERIES) ?? []));

    expect(queried.size).toBeGreaterThan(0);
    expect([...queried].filter((series) => !emittedSeries.has(series))).toEqual([]);
    expect([...emittedSeries].sort()).toEqual([
      'stylist_api_request_duration_seconds_bucket',
      'stylist_api_request_duration_seconds_count',
      'stylist_api_request_duration_seconds_sum',
      'stylist_api_request_errors_total',
      'stylist_queue_depth',
      'stylist_queue_job_age_oldest_seconds',
      'stylist_queue_job_completions_total',
      'stylist_queue_job_dlq_total',
      'stylist_queue_job_failures_total',
      'stylist_queue_job_retries_total',
    ]);
  });

  it('carries every label those expressions group or filter by', () => {
    const emittedLabels = new Set(RESOURCE_LABELS);
    for (const metric of emitted) {
      const points: readonly { readonly attributes: object }[] = metric.dataPoints;
      for (const point of points) {
        for (const key of Object.keys(point.attributes)) emittedLabels.add(prometheusName(key));
      }
    }
    const ownExpressions = grafanaExpressions().filter((e) => QUERIES_OWN_SERIES.test(e));

    expect(ownExpressions.length).toBeGreaterThan(0);
    const used = new Set(ownExpressions.flatMap(labelsIn));
    expect([...used].filter((label) => !emittedLabels.has(label))).toEqual([]);
  });
});
