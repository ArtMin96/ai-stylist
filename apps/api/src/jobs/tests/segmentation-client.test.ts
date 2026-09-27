// HttpSegmentationClient against a local fake worker: request shape, the correlation header,
// reply validation, the withTimeout bound and the circuit breaker.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { fakeClock } from '@ai-stylist/test-support';

import { CircuitBreaker, CircuitOpenError, TimeoutError } from '../../platform/index.js';
import { HttpSegmentationClient, SegmentationError } from '../segmentation-client.js';

import {
  type FakeSegmentationWorker,
  startFakeSegmentationWorker,
} from './fake-segmentation-worker.js';

const REQUEST = { request_id: 'evt_01J8Z8Q6X3K9V2N4M7P1R5T0AB', image_ref: 'demo/outbox-flow' };
const ECHO_REPLY = {
  ...REQUEST,
  masks: [],
  provenance: { generated: true, model: 'stub', confidence: 0 },
};
const UNKNOWN_LABEL_MASK = { label: 'hat', mask_ref: 'masks/1', score: 1 };

describe('HttpSegmentationClient', () => {
  let worker: FakeSegmentationWorker;

  beforeAll(async () => {
    worker = await startFakeSegmentationWorker();
  });

  afterAll(async () => {
    await worker.close();
  });

  beforeEach(() => {
    worker.requests.length = 0;
    worker.behaviour = 'echo';
  });

  type ClientOptions = { timeoutMs?: number; failureThreshold?: number; baseUrl?: string };

  function client(options: ClientOptions = {}) {
    return new HttpSegmentationClient({
      baseUrl: options.baseUrl ?? worker.baseUrl,
      timeoutMs: options.timeoutMs ?? 2_000,
      breaker: new CircuitBreaker(fakeClock(), {
        failureThreshold: options.failureThreshold ?? 100,
        coolDownMs: 60_000,
      }),
    });
  }

  it('POSTs the request as JSON to {base}/v1/segment and returns the parsed reply', async () => {
    const reply = await client({ baseUrl: `${worker.baseUrl}/` }).segment(REQUEST);

    expect(worker.requests).toEqual([
      { method: 'POST', path: '/v1/segment', contentType: 'application/json', json: REQUEST },
    ]);
    expect(reply).toEqual(ECHO_REPLY);
  });

  it('throws SegmentationError on a non-2xx status', async () => {
    worker.behaviour = { status: 422 };

    await expect(client().segment(REQUEST)).rejects.toBeInstanceOf(SegmentationError);
  });

  it.each([
    ['for another request', { ...ECHO_REPLY, request_id: 'evt_01J8Z8Q6X3K9V2N4M7P1R5T0AC' }],
    ['missing provenance', { ...ECHO_REPLY, provenance: undefined }],
    ['with an unknown mask label', { ...ECHO_REPLY, masks: [UNKNOWN_LABEL_MASK] }],
  ])('throws SegmentationError on a reply %s', async (_label, reply) => {
    worker.behaviour = { reply };

    await expect(client().segment(REQUEST)).rejects.toBeInstanceOf(SegmentationError);
  });

  it('gives up after timeoutMs with TimeoutError', async () => {
    worker.behaviour = 'hang';

    await expect(client({ timeoutMs: 100 }).segment(REQUEST)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('aborts when the caller signal aborts', async () => {
    worker.behaviour = 'hang';
    const controller = new AbortController();
    const reply = client().segment(REQUEST, { signal: controller.signal });
    controller.abort(new Error('job stopped'));

    await expect(reply).rejects.toThrow('job stopped');
  });

  it('sends a valid correlation id as x-correlation-id, and never an invalid one', async () => {
    await client().segment(REQUEST, { correlationId: '0192f0c1-7a3b-7c4d-8e5f-a1b2c3d4e5f6' });
    await client().segment(REQUEST, { correlationId: 'bad id\r\nx-injected: 1' });
    await client().segment(REQUEST);

    expect(worker.requests.map((r) => r.correlationId)).toEqual([
      '0192f0c1-7a3b-7c4d-8e5f-a1b2c3d4e5f6',
      undefined,
      undefined,
    ]);
  });

  it('opens the circuit after consecutive failures, then fails fast without a request', async () => {
    worker.behaviour = { status: 500 };
    const segmentation = client({ failureThreshold: 2 });

    await expect(segmentation.segment(REQUEST)).rejects.toBeInstanceOf(SegmentationError);
    await expect(segmentation.segment(REQUEST)).rejects.toBeInstanceOf(SegmentationError);
    await expect(segmentation.segment(REQUEST)).rejects.toBeInstanceOf(CircuitOpenError);

    expect(worker.requests).toHaveLength(2);
  });

  it('rejects a non-http base URL', () => {
    expect(() => client({ baseUrl: 'file:///tmp/worker' })).toThrow(TypeError);
  });
});
