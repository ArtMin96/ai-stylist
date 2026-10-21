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
  /**
   * Signup refused below the minimum age (DEC-60). 403, not 400: the refusal is terminal, so a
   * client must not offer to re-enter the birth year (P03 phase §5).
   */
  AGE_GATE_FAILED: { status: 403, title: 'Minimum age not met' },
  /** Needs a consent purpose the caller has not granted (doc 11 §7.2); 403 like ENTITLEMENT_REQUIRED. */
  CONSENT_REQUIRED: { status: 403, title: 'Consent required' },
  /**
   * A measurement outside its hard bounds (registry/measurement-definitions.json; doc 07 §3.3
   * severity 1): refused, not stored. 400 like VALIDATION_FAILED, with `errors[]` naming the field;
   * never echo the value (doc 11 §8).
   */
  MEASUREMENT_IMPLAUSIBLE: { status: 400, title: 'Measurement outside the accepted range' },
  /** Context facts too old to decide on (doc 06 §2). */
  CONTEXT_STALE: { status: 409, title: 'Context is stale' },
  /** Account is deleted or deletion is in progress (doc 06 §8). */
  ACCOUNT_DELETED: { status: 410, title: 'Account deleted' },
  /** Request body larger than the endpoint accepts (RFC 9110 §15.5.14). */
  CONTENT_TOO_LARGE: { status: 413, title: 'Content too large' },
  /** Request body `Content-Type` the endpoint does not accept (RFC 9110 §15.5.16). */
  UNSUPPORTED_MEDIA_TYPE: { status: 415, title: 'Unsupported media type' },
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
