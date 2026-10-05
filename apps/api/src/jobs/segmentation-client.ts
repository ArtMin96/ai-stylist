// HTTP client for the segmentation worker (`workers/ml/segmentation`, `POST /v1/segment`).
// Translation only: it sends the request it is given and returns the parsed reply; which job calls
// it, with what, is decided by the handler. Every call is bounded by `withTimeout` and passes
// through a `CircuitBreaker` (doc 04 §9, NFR-PERF-040).
//
// The request/response types are the generated worker contract (`@ai-stylist/contracts/workers`,
// source `packages/contracts/workers/segmentation/segmentation.v1.json`); the reply is validated at
// runtime against that schema's `$defs/SegmentResponse`, so a contract change applies here with
// nothing to copy (the Ajv 2020-12 setup of `demo-outbox-flow.ts`). Whatever the contract says
// holds: today an unknown field or mask label is rejected (`additionalProperties: false`, the
// `MaskLabel` enum). This client and its `SegmentationClient` type stay in `jobs/` until `media`
// consumes segmentation (P06); then the port moves to `modules/media/index.ts` and the adapter to
// `platform`.
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import type { SegmentRequest, SegmentResponse } from '@ai-stylist/contracts/workers';
import segmentationSchema from '@ai-stylist/contracts/workers/segmentation/segmentation.v1.json' with { type: 'json' };

import {
  CORRELATION_ID_HEADER,
  type CircuitBreaker,
  isValidCorrelationId,
  withTimeout,
} from '../platform/index.js';

export type {
  MaskLabel,
  MaskRef,
  SegmentRequest,
  SegmentResponse,
} from '@ai-stylist/contracts/workers';

/** Compiled once, at module load, from the contract schema itself. */
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
ajv.addSchema(segmentationSchema);
const segmentResponseValidator = ajv.getSchema<SegmentResponse>(
  `${segmentationSchema.$id}#/$defs/SegmentResponse`,
);
// Fail at module load (process start), not on the first request, if the contract's $id or
// $defs name ever changes.
if (segmentResponseValidator === undefined) {
  throw new Error('segmentation contract: $defs/SegmentResponse not found in the worker schema');
}
const validateSegmentResponse: ValidateFunction<SegmentResponse> = segmentResponseValidator;

/** Per-call options: cancellation and the operation's correlation id (planning/14 §2). */
export type SegmentCallOptions = {
  readonly signal?: AbortSignal;
  /** Sent as `x-correlation-id` when it is a valid id; the job's envelope `correlationId`. */
  readonly correlationId?: string;
};

/** What a job handler depends on; tests may substitute any object of this shape. */
export type SegmentationClient = {
  segment(request: SegmentRequest, options?: SegmentCallOptions): Promise<SegmentResponse>;
};

/** Non-2xx status or a reply that is not a `SegmentResponse` for this request. Carries no body. */
export class SegmentationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SegmentationError';
  }
}

export type HttpSegmentationClientOptions = {
  /** Worker origin, e.g. `http://127.0.0.1:8001`; passed in by the composition root. */
  readonly baseUrl: string;
  /** Upper bound of one call including reading the reply, ms. */
  readonly timeoutMs: number;
  readonly breaker: CircuitBreaker;
  /** Injected for tests; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
};

export class HttpSegmentationClient implements SegmentationClient {
  private readonly url: URL;
  private readonly timeoutMs: number;
  private readonly breaker: CircuitBreaker;
  private readonly fetch: typeof fetch;

  constructor(options: HttpSegmentationClientOptions) {
    const base = new URL(options.baseUrl);
    if (base.protocol !== 'http:' && base.protocol !== 'https:') {
      throw new TypeError('HttpSegmentationClient: baseUrl must be http(s)');
    }
    this.url = new URL('v1/segment', base.href.endsWith('/') ? base : `${base.href}/`);
    this.timeoutMs = options.timeoutMs;
    this.breaker = options.breaker;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  /**
   * Throws `SegmentationError`, `TimeoutError`, `CircuitOpenError` or a network error. The W3C
   * `traceparent` header comes from the undici instrumentation when telemetry runs.
   */
  async segment(
    request: SegmentRequest,
    options: SegmentCallOptions = {},
  ): Promise<SegmentResponse> {
    const { signal, correlationId } = options;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(isValidCorrelationId(correlationId) ? { [CORRELATION_ID_HEADER]: correlationId } : {}),
    };
    return this.breaker.execute(() =>
      withTimeout(async (timeoutSignal) => {
        const response = await this.fetch(this.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(request),
          signal: signal === undefined ? timeoutSignal : AbortSignal.any([timeoutSignal, signal]),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new SegmentationError(`segmentation worker responded ${response.status}`);
        }
        const reply: unknown = await response.json();
        if (!validateSegmentResponse(reply) || reply.request_id !== request.request_id) {
          throw new SegmentationError('segmentation worker reply does not match the request');
        }
        return reply;
      }, this.timeoutMs),
    );
  }
}
