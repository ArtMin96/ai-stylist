// `demo.outbox-flow` handler against the real HTTP segmentation client and a local fake worker.
// The effect-once guard is an in-memory stand-in with PgIdempotencyGuard's contract (the durable
// guard itself is covered by apps/api/src/platform/tests/idempotency.docker.test.ts).
import pino from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import demoEventSchema from '@ai-stylist/contracts/events/demo.event.json' with { type: 'json' };
import { demoEvent } from '@ai-stylist/seed-data';
import { newId } from '@ai-stylist/shared-kernel';
import { fakeClock, memoryLogStream } from '@ai-stylist/test-support';

import { CircuitBreaker, type QueueJob, loggerOptions } from '../../platform/index.js';
import {
  DEMO_IMAGE_REF,
  DEMO_OUTBOX_FLOW_RETENTION_SECONDS,
  DEMO_OUTBOX_FLOW_SCOPE,
  type EffectOnceGuard,
  InvalidJobDataError,
  createDemoOutboxFlowHandler,
} from '../demo-outbox-flow.js';
import { DEMO_OUTBOX_FLOW_QUEUE } from '../queues.js';
import { HttpSegmentationClient, SegmentationError } from '../segmentation-client.js';

import {
  type FakeSegmentationWorker,
  startFakeSegmentationWorker,
} from './fake-segmentation-worker.js';

/** Canary: a payload value that must never reach the log sink. */
const NOTE_MARKER = 'note-marker-5c1e';
const demoPayload = demoEvent().payload;
/** The note limit as the contract states it (demo.event.json), not a copy of the number. */
const NOTE_MAX_LENGTH =
  demoEventSchema.$defs.DemoOutboxFlowRequestedV1Payload.properties.note.maxLength;
const LONG_NOTE = 'x'.repeat(NOTE_MAX_LENGTH + 1);

/** PgIdempotencyGuard's contract in memory: the key is recorded only when the effect resolves. */
type GuardRequest = Parameters<EffectOnceGuard['runOnce']>[0];

function memoryGuard(): EffectOnceGuard & { readonly requests: GuardRequest[] } {
  const done = new Set<string>();
  const requests: GuardRequest[] = [];
  return {
    requests,
    async runOnce(request, effect) {
      requests.push(request);
      if (done.has(request.key)) return { ran: false };
      const value = await effect();
      done.add(request.key);
      return { ran: true, value };
    },
  };
}

function job(data: unknown, attempt = 1): QueueJob {
  return {
    id: crypto.randomUUID(),
    queue: DEMO_OUTBOX_FLOW_QUEUE.name,
    data,
    attempt,
    signal: new AbortController().signal,
  };
}

describe('demo.outbox-flow handler', () => {
  let worker: FakeSegmentationWorker;
  let guard: ReturnType<typeof memoryGuard>;
  let logs: ReturnType<typeof memoryLogStream>;
  let handle: (job: QueueJob) => Promise<void>;

  beforeAll(async () => {
    worker = await startFakeSegmentationWorker();
  });

  afterAll(async () => {
    await worker.close();
  });

  beforeEach(() => {
    worker.requests.length = 0;
    worker.behaviour = 'echo';
    guard = memoryGuard();
    logs = memoryLogStream();
    handle = createDemoOutboxFlowHandler({
      guard,
      segmentation: new HttpSegmentationClient({
        baseUrl: worker.baseUrl,
        timeoutMs: 2_000,
        breaker: new CircuitBreaker(fakeClock(), { failureThreshold: 100, coolDownMs: 1 }),
      }),
      logger: pino(loggerOptions({ level: 'debug', service: 'jobs-test' }), logs),
    });
  });

  it('calls the segmentation worker once per envelope id when the job runs twice', async () => {
    const event = demoEvent({ payload: { note: NOTE_MARKER } });

    await handle(job(event, 1));
    await handle(job(event, 2));

    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0]).toMatchObject({
      method: 'POST',
      path: '/v1/segment',
      contentType: 'application/json',
      json: { request_id: event.id, image_ref: DEMO_IMAGE_REF },
    });
    expect(guard.requests).toEqual([
      {
        key: event.id,
        scope: 'job:demo.outbox-flow',
        retentionSeconds: DEMO_OUTBOX_FLOW_RETENTION_SECONDS,
      },
      {
        key: event.id,
        scope: DEMO_OUTBOX_FLOW_SCOPE,
        retentionSeconds: DEMO_OUTBOX_FLOW_RETENTION_SECONDS,
      },
    ]);
    expect(DEMO_OUTBOX_FLOW_RETENTION_SECONDS).toBe(90 * 86_400);
  });

  it('calls the worker again for a different envelope id', async () => {
    await handle(job(demoEvent({ id: newId('event') })));
    await handle(job(demoEvent({ id: newId('event') })));

    expect(worker.requests).toHaveLength(2);
  });

  it.each([
    ['not an object', 'evt'],
    ['another event type', { ...demoEvent(), type: 'closet.item.created.v1' }],
    ['a malformed event id', { ...demoEvent(), id: 'evt_not-a-ulid' }],
    ['a missing correlationId', { ...demoEvent(), correlationId: undefined }],
    ['an unknown payload field', { ...demoEvent(), payload: { ...demoPayload, extra: 1 } }],
    ['a note over maxLength', { ...demoEvent(), payload: { ...demoPayload, note: LONG_NOTE } }],
  ])('rejects %s without calling the worker', async (_label, data) => {
    await expect(handle(job(data))).rejects.toBeInstanceOf(InvalidJobDataError);

    expect(worker.requests).toHaveLength(0);
    expect(guard.requests).toHaveLength(0);
  });

  it('accepts a note of exactly the contract maxLength', async () => {
    await handle(job(demoEvent({ payload: { note: 'x'.repeat(NOTE_MAX_LENGTH) } })));

    expect(worker.requests).toHaveLength(1);
  });

  it('tolerates unknown envelope fields (envelope.json)', async () => {
    await handle(job({ ...demoEvent(), futureEnvelopeField: 'x' }));

    expect(worker.requests).toHaveLength(1);
  });

  it('accepts an envelope carrying a valid W3C traceparent', async () => {
    const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

    await handle(job({ ...demoEvent(), traceparent }));

    expect(worker.requests).toHaveLength(1);
  });

  it('rejects a malformed traceparent without calling the worker', async () => {
    const data = { ...demoEvent(), traceparent: '00-abc-def-01' };

    const error = await handle(job(data)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidJobDataError);
    expect((error as Error).message).toContain('traceparent');
    expect(worker.requests).toHaveLength(0);
  });

  it("sends the envelope's correlation id to the worker as x-correlation-id", async () => {
    const event = demoEvent({ correlationId: 'corr-demo-flow-1' });

    await handle(job(event));

    expect(worker.requests.map((r) => r.correlationId)).toEqual(['corr-demo-flow-1']);
  });

  it('omits x-correlation-id for an id outside the accepted format', async () => {
    await handle(job(demoEvent({ correlationId: 'has spaces and / slashes' })));

    expect(worker.requests.map((r) => r.correlationId)).toEqual([undefined]);
  });

  it('throws when the worker fails (pg-boss retries) and the retry calls it again', async () => {
    const event = demoEvent();
    worker.behaviour = { status: 503 };

    await expect(handle(job(event, 1))).rejects.toBeInstanceOf(SegmentationError);

    worker.behaviour = 'echo';
    await handle(job(event, 2));
    await handle(job(event, 3));

    expect(worker.requests).toHaveLength(2);
  });

  it('logs ids, type and attempt, never the payload', async () => {
    const event = demoEvent({ payload: { note: NOTE_MARKER, demoId: 'demo-log-canary' } });

    await handle(job(event, 1));
    await handle(job(event, 2));

    expect(logs.text()).not.toContain(NOTE_MARKER);
    expect(logs.text()).not.toContain('demo-log-canary');
    const records = logs.records().filter((r) => r.eventId === event.id);
    expect(records.map((r) => [r.attempt, r.ran, r.eventType, r.msg])).toEqual([
      [1, true, 'demo.outbox-flow.requested.v1', 'demo outbox flow handled'],
      [2, false, 'demo.outbox-flow.requested.v1', 'demo outbox flow already handled'],
    ]);
  });

  it('reports invalid data by path, without echoing values', async () => {
    const data = { ...demoEvent(), payload: { demoId: 'x', requestedAt: NOTE_MARKER } };

    const error = await handle(job(data)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidJobDataError);
    expect((error as Error).message).toContain('payload.requestedAt');
    expect((error as Error).message).not.toContain(NOTE_MARKER);
  });

  it('names missing and unknown fields by path', async () => {
    const { correlationId: _dropped, ...withoutCorrelation } = demoEvent();
    const data = { ...withoutCorrelation, payload: { ...demoPayload, [NOTE_MARKER]: 1 } };

    const error = await handle(job(data)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidJobDataError);
    expect((error as Error).message).toContain('correlationId');
    expect((error as Error).message).toContain(`payload.${NOTE_MARKER}`);
  });
});
