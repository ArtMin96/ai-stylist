// RFC 9457 problem details (planning/06 §2): `application/problem+json` with a stable machine
// `code` from the error-code registry. Never leak internals or provider error bodies into `detail`.
//
// The codes live in packages/shared-kernel/registry/error-codes.json (schema beside it, checked in
// packages/contracts/tests/kernel-registries.test.ts); a new code is a registry entry, never a
// literal here.
import registry from '../registry/error-codes.json' with { type: 'json' };

type ErrorCodeDefinition = {
  readonly status: number;
  readonly title: string;
  /** What the code means and when the API answers it. */
  readonly description: string;
};

/** Union of the registered codes, e.g. `'NOT_FOUND'`. */
export type ErrorCode = keyof typeof registry.codes;

/** Every registered code with its HTTP status, `title` and description, in registry order. */
export const ERROR_CODES: { readonly [C in ErrorCode]: ErrorCodeDefinition } = registry.codes;

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
