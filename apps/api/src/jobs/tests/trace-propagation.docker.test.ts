// P02-T09 AC-1, local proof (Linear AI-17): one trace id and one correlation id from the outbox
// append (inside the producing request's span and correlation scope) → relay dispatch → pg-boss
// job → HTTP call to a stub worker (planning/14 §2–§3). The REAL pipeline on Testcontainers
// Postgres: PgOutboxWriter → OutboxRelay → PgBossQueue → `startJobs` (demo handler,
// HttpSegmentationClient) → the fake segmentation worker, with the in-process telemetry SDK
// exporting spans into memory through the span sanitizer. `platform-docker` project: FAILS without
// Docker, never skips. Lives under jobs/tests because it drives the jobs composition root.
import { type Span, type SpanContext, SpanKind, trace } from '@opentelemetry/api';
import pino from 'pino';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrateUrl } from '@ai-stylist/db';
import { type DemoEvent, demoEvent, syntheticRandom } from '@ai-stylist/seed-data';
import { newId } from '@ai-stylist/shared-kernel';
import { type StartedPostgres, memoryLogStream, startPostgres } from '@ai-stylist/test-support';

import {
  OutboxRelay,
  PgBossQueue,
  PgOutboxWriter,
  loggerOptions,
  runWithCorrelationId,
} from '../../platform/index.js';
import type { Telemetry } from '../../platform/telemetry/lifecycle.js';
import type { ExportedSpan } from '../../platform/telemetry/span-sanitizer.js';
import { startTelemetry } from '../../platform/telemetry/telemetry.js';
import { memorySpanExporter } from '../../platform/tests/memory-span-exporter.js';
import {
  DEMO_OUTBOX_FLOW_EVENT_TYPE,
  DEMO_OUTBOX_FLOW_QUEUE,
  JOB_QUEUES,
  type RunningJobs,
  queueForEventType,
  startJobs,
  userIdOf,
} from '../index.js';

import {
  type FakeSegmentationWorker,
  startFakeSegmentationWorker,
} from './fake-segmentation-worker.js';

/** Canary: a payload value that must never reach a span or the log sink. */
const PAYLOAD_MARKER = 'payload-marker-t09-4e1a';
const CORRELATION_ID = 'corr-ac1-3f9e';
const CARRIED = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('P02-T09 AC-1: one trace and one correlation id, outbox append → worker call', () => {
  const spans = memorySpanExporter();
  const logs = memoryLogStream();
  const logger = pino(loggerOptions({ level: 'debug', service: 'api-test' }), logs);
  const random = syntheticRandom();
  let telemetry: Telemetry | undefined;
  let pg: StartedPostgres | undefined;
  let sql: Sql | undefined;
  let sender: PgBossQueue | undefined;
  let worker: FakeSegmentationWorker | undefined;
  let jobs: RunningJobs | undefined;

  beforeAll(async () => {
    telemetry = startTelemetry({ service: 'jobs', spanExporter: spans });
    pg = await startPostgres();
    await migrateUrl(pg.url);
    sql = postgres(pg.url, { max: 2 });
    // The relay's composition (app.module.ts): the same queue list the job runtime works.
    sender = new PgBossQueue({ connectionString: pg.url, queues: JOB_QUEUES, logger });
    await sender.start();
    worker = await startFakeSegmentationWorker();
    jobs = await startJobs({
      databaseUrl: pg.url,
      segmentationBaseUrl: worker.baseUrl,
      logger,
      pollingIntervalSeconds: 0.5,
    });
  });

  afterAll(async () => {
    await jobs?.stop();
    await sender?.stop();
    await sql?.end();
    await worker?.close();
    await pg?.stop();
    await telemetry?.shutdown();
  });

  function event(overrides: Parameters<typeof demoEvent>[0] = {}): DemoEvent {
    return demoEvent(
      { aggregate: { kind: 'demo_run', id: `run-${newId('event')}` }, ...overrides },
      random,
    );
  }

  async function storedTraceparent(db: Sql, eventId: string): Promise<unknown> {
    const [row] = await db<{ payload: Record<string, unknown> }[]>`
      select payload from platform_outbox where id = ${eventId}`;
    return row?.payload['traceparent'];
  }

  /** Flushes until a span matching `match` was exported (the job runs asynchronously). */
  async function exportedSpan(match: (span: ExportedSpan) => boolean): Promise<ExportedSpan> {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      await telemetry?.flush();
      const found = spans.spans.find(match);
      if (found !== undefined) return found;
      await sleep(100);
    }
    throw new Error('timed out waiting for an exported span');
  }

  it('AC-1: the relay, the job and the worker call join the producing span; the worker gets the correlation id', async () => {
    if (sql === undefined || sender === undefined || worker === undefined) throw new Error('boot');
    const db = sql;
    const envelope = event({ correlationId: CORRELATION_ID, payload: { note: PAYLOAD_MARKER } });

    // The API request producing the event (in the API: the http / @fastify/otel server span).
    const produce = async (span: Span): Promise<SpanContext> => {
      await runWithCorrelationId(CORRELATION_ID, () => new PgOutboxWriter(db).append(envelope));
      span.end();
      return span.spanContext();
    };
    const producer = await trace.getTracer('p02-t09-ac1').startActiveSpan('POST demo', produce);
    const { traceId } = producer;
    expect(await storedTraceparent(db, envelope.id)).toBe(`00-${traceId}-${producer.spanId}-01`);

    const relay = new OutboxRelay({
      sql: db,
      queue: sender,
      logger,
      routeEvent: queueForEventType,
      userIdOf,
    });
    expect(await relay.pollOnce()).toMatchObject({ claimed: 1, dispatched: 1 });

    const jobName = `job.process ${DEMO_OUTBOX_FLOW_QUEUE.name}`;
    const dispatchName = `outbox.dispatch ${DEMO_OUTBOX_FLOW_EVENT_TYPE}`;
    const job = await exportedSpan((span) => span.name === jobName);
    const dispatch = await exportedSpan((span) => span.name === dispatchName);
    const jobSpanId = job.spanContext().spanId;
    const isWorkerCall = (span: ExportedSpan) =>
      span.kind === SpanKind.CLIENT && span.parentSpanContext?.spanId === jobSpanId;
    const call = await exportedSpan(isWorkerCall);

    // One trace: producer → { dispatch (PRODUCER), job (CONSUMER) → worker call (CLIENT) }.
    for (const span of [dispatch, job, call]) expect(span.spanContext().traceId).toBe(traceId);
    expect(dispatch.kind).toBe(SpanKind.PRODUCER);
    expect(dispatch.parentSpanContext?.spanId).toBe(producer.spanId);
    expect(job.kind).toBe(SpanKind.CONSUMER);
    expect(job.parentSpanContext?.spanId).toBe(producer.spanId);
    expect(dispatch.attributes).toMatchObject({
      'outbox.event.id': envelope.id,
      'outbox.event.type': DEMO_OUTBOX_FLOW_EVENT_TYPE,
      'messaging.destination.name': DEMO_OUTBOX_FLOW_QUEUE.name,
      correlation_id: CORRELATION_ID,
    });
    expect(job.attributes).toMatchObject({
      'messaging.destination.name': DEMO_OUTBOX_FLOW_QUEUE.name,
      'job.attempt': 1,
      correlation_id: CORRELATION_ID,
    });

    // The worker request: the call span's traceparent (undici) and the envelope's correlation id.
    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0]?.traceparent).toBe(`00-${traceId}-${call.spanContext().spanId}-01`);
    expect(worker.requests[0]?.correlationId).toBe(CORRELATION_ID);

    // The job's log lines carry the correlation id; nothing carries the payload.
    const records = logs.records();
    const handled = records.find((r) => r['eventId'] === envelope.id && r['ran'] === true);
    expect(handled?.['correlation_id']).toBe(CORRELATION_ID);
    const exported = JSON.stringify(spans.spans.map((s) => [s.name, s.attributes, s.events]));
    expect(exported).not.toContain(PAYLOAD_MARKER);
    expect(logs.text()).not.toContain(PAYLOAD_MARKER);
  });

  it('stores no traceparent for an untraced append, and keeps one the producer set', async () => {
    if (sql === undefined) throw new Error('boot');
    const db = sql;
    const untraced = event();
    const explicit = event({ traceparent: CARRIED });

    await new PgOutboxWriter(db).append(untraced);
    await trace.getTracer('p02-t09-ac1').startActiveSpan('other request', async (span) => {
      await new PgOutboxWriter(db).append(explicit);
      span.end();
    });

    expect(await storedTraceparent(db, untraced.id)).toBeUndefined();
    expect(await storedTraceparent(db, explicit.id)).toBe(CARRIED);
  });
});
