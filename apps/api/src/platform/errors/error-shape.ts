// The only fields of a thrown value the queue adapter and the outbox relay persist or log, the
// logger writes for an error and each link of its cause chain (../logger.ts), and the platform's
// spans record (../telemetry/trace-context.ts): its class name and, for a Postgres error, its
// SQLSTATE code. Never the message: driver and pg-boss messages can echo statement parameters (job
// data, event payloads), and handler errors may quote the job. A class name is kept only when it
// is identifier-shaped: any code can set `Error.name` to free text. The shapes are
// `LOG_REDACTION_RULES` of @ai-stylist/shared-kernel (registry/log-redaction.json), the one source
// the workers read too; never a local copy. Also `isError`, the Error test of every walk
// (../logger.ts, ../outbox/outbox-relay.ts).
import { LOG_REDACTION_RULES } from '@ai-stylist/shared-kernel';

export type ErrorSummary = {
  /**
   * `Error.name` when it is identifier-shaped (`errorNameShape`), else `'Error'`; `typeof` for a
   * non-Error throw (which could be anything, even the payload).
   */
  readonly errorName: string;
  /**
   * Postgres SQLSTATE (`error.code`, e.g. `57P01`) when the value carries one; also a Node system
   * code such as `ECONNREFUSED`. Only a short code-shaped string (`codeShape`) is kept, never free
   * text.
   */
  readonly pgCode?: string;
};

const { errorNameShape, codeShape } = LOG_REDACTION_RULES;

/**
 * `Error.isError` (ES2026: Node 24, absent on Node 22); the ES2022 lib this repo compiles against
 * lacks its type, so it is typed optional.
 */
const ErrorWithIsError = Error as ErrorConstructor & {
  isError?: (value: unknown) => value is Error;
};

/**
 * Whether `value` is an Error. With `Error.isError`, of any realm: `instanceof Error` misses one
 * made in a `vm` context or another realm, whose enumerable fields (a driver's `detail`) a walk
 * would then copy. Without it (Node 22), `instanceof Error`, read at each call so a runtime that
 * lacks the method never throws from a log call.
 */
export function isError(value: unknown): value is Error {
  return typeof ErrorWithIsError.isError === 'function'
    ? ErrorWithIsError.isError(value)
    : value instanceof Error;
}

export function errorSummary(error: unknown): ErrorSummary {
  const errorName = isError(error) ? classNameOf(error) : typeof error;
  const pgCode = pgCodeOf(error);
  return pgCode === undefined ? { errorName } : { errorName, pgCode };
}

function classNameOf(error: Error): string {
  const name: unknown = error.name;
  return typeof name === 'string' && errorNameShape.test(name) ? name : 'Error';
}

function pgCodeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    return typeof code === 'string' && codeShape.test(code) ? code : undefined;
  }
  return undefined;
}
