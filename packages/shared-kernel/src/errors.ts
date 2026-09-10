// RFC 9457 problem details (planning/06 §2): `application/problem+json` with a stable machine
// `code` from this registry. Never leak internals or provider error bodies into `detail`.

export const ERROR_CODES = {
  VALIDATION_FAILED: { status: 400, title: 'Request validation failed' },
  UNAUTHENTICATED: { status: 401, title: 'Authentication required' },
  FORBIDDEN: { status: 403, title: 'Forbidden' },
  NOT_FOUND: { status: 404, title: 'Not found' },
  CONFLICT: { status: 409, title: 'Conflict' },
  /** Idempotency-Key replayed with a different body (doc 06 §2). */
  IDEMPOTENCY_KEY_REUSED: { status: 409, title: 'Idempotency key reused with a different request' },
  /** `If-Match` version mismatch; body carries the current state (doc 06 §2). */
  VERSION_MISMATCH: { status: 409, title: 'Resource version mismatch' },
  /** `closet.max_items` reached; upsell (doc 12 §3.3). */
  CLOSET_LIMIT_REACHED: { status: 409, title: 'Closet item limit reached' },
  /** Feature gated by an entitlement the caller lacks (doc 06 §2, doc 12). */
  ENTITLEMENT_REQUIRED: { status: 403, title: 'Entitlement required' },
  /** Context facts too old to decide on (doc 06 §2). */
  CONTEXT_STALE: { status: 409, title: 'Context is stale' },
  /** Account is deleted or deletion is in progress (doc 06 §8). */
  ACCOUNT_DELETED: { status: 410, title: 'Account deleted' },
  RATE_LIMITED: { status: 429, title: 'Too many requests' },
  INTERNAL: { status: 500, title: 'Internal error' },
  /** A checked dependency (db, provider) is down; health returns this with `checks` (doc 06 §2). */
  SERVICE_UNAVAILABLE: { status: 503, title: 'Service unavailable' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Base URI for `type`; resolved per code as `${PROBLEM_TYPE_BASE}/${code}`. */
export const PROBLEM_TYPE_BASE = 'https://errors.ai-stylist.app';

/** One field-level validation failure (doc 06 §2: JSON-pointer paths). */
export type ProblemFieldError = {
  /** JSON pointer (RFC 6901) into the request body, e.g. `/measurements/height/value`. */
  readonly pointer: string;
  readonly message: string;
  readonly code?: string;
};

/** RFC 9457 problem details as served by the API (`components/schemas/ProblemDetails`). */
export type ProblemDetails = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: ErrorCode;
  readonly detail?: string;
  readonly instance?: string;
  /** Mutable array on purpose: must be assignable to the generated contract type. */
  readonly errors?: ProblemFieldError[];
};

export type ProblemOverrides = Partial<Omit<ProblemDetails, 'code'>>;

/** Build a problem for `code`; `overrides` may replace any field except `code`. */
export function problem(code: ErrorCode, overrides: ProblemOverrides = {}): ProblemDetails {
  const base = ERROR_CODES[code];
  return {
    type: `${PROBLEM_TYPE_BASE}/${code}`,
    title: base.title,
    status: base.status,
    code,
    ...overrides,
  };
}
