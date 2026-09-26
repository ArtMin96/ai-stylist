// HTTP client for the segmentation worker (`workers/ml/segmentation`, `POST /v1/segment`).
// Translation only: it sends the request it is given and returns the parsed reply; which job calls
// it, with what, is decided by the handler. Every call is bounded by `withTimeout` and passes
// through a `CircuitBreaker` (doc 04 §9, NFR-PERF-040).
//
// The request/response shapes mirror
// `workers/ml/segmentation/src/ai_stylist_segmentation/schemas.py` minimally. That file's own
// TODO moves the worker schemas into `packages/contracts`; once it does, these types come from the
// generated contract instead (out of scope for P02-T08).
import { z } from 'zod';

import { type CircuitBreaker, withTimeout } from '../platform/index.js';

const MASK_LABELS = [
  'top',
  'bottom',
  'dress',
  'outerwear',
  'shoes',
  'accessory',
  'background',
] as const;

export type MaskLabel = (typeof MASK_LABELS)[number];

/** `SegmentRequest` (schemas.py): an object reference only, never image bytes or user data. */
export type SegmentRequest = {
  /** Caller correlation id, 1–128 chars. */
  readonly request_id: string;
  /** R2 object key of the source image, 1–1024 chars. */
  readonly image_ref: string;
  readonly hint?: MaskLabel;
};

const segmentResponseSchema = z.object({
  request_id: z.string(),
  image_ref: z.string(),
  masks: z.array(
    z.object({
      label: z.enum(MASK_LABELS),
      mask_ref: z.string().min(1),
      score: z.number().min(0).max(1),
    }),
  ),
  provenance: z.object({
    generated: z.boolean(),
    model: z.string().min(1),
    confidence: z.number().min(0).max(1),
  }),
});

/** `SegmentResponse` (schemas.py): mask references plus the provenance/confidence marker. */
export type SegmentResponse = z.infer<typeof segmentResponseSchema>;

/** What a job handler depends on; tests may substitute any object of this shape. */
export type SegmentationClient = {
  segment(request: SegmentRequest, signal?: AbortSignal): Promise<SegmentResponse>;
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

  /** Throws `SegmentationError`, `TimeoutError`, `CircuitOpenError` or a network error. */
  async segment(request: SegmentRequest, signal?: AbortSignal): Promise<SegmentResponse> {
    return this.breaker.execute(() =>
      withTimeout(async (timeoutSignal) => {
        const response = await this.fetch(this.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(request),
          signal: signal === undefined ? timeoutSignal : AbortSignal.any([timeoutSignal, signal]),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new SegmentationError(`segmentation worker responded ${response.status}`);
        }
        const parsed = segmentResponseSchema.safeParse(await response.json());
        if (!parsed.success || parsed.data.request_id !== request.request_id) {
          throw new SegmentationError('segmentation worker reply does not match the request');
        }
        return parsed.data;
      }, this.timeoutMs),
    );
  }
}
