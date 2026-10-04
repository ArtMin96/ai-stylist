// The only fields of a thrown value the queue adapter and the outbox relay persist or log, and the
// logger writes for an error and each link of its cause chain (../logger.ts): its class name and,
// for a Postgres error, its SQLSTATE code. Never the message: driver and pg-boss messages can echo
// statement parameters (job data, event payloads), and handler errors may quote the job. A class
// name is kept only when it is identifier-shaped: any code can set `Error.name` to free text.

export type ErrorSummary = {
  /**
   * `Error.name` when it is identifier-shaped (`NAME_SHAPE`), else `'Error'`; `typeof` for a
   * non-Error throw (which could be anything, even the payload).
   */
  readonly errorName: string;
  /**
   * Postgres SQLSTATE (`error.code`, e.g. `57P01`) when the value carries one; also a Node system
   * code such as `ECONNREFUSED`. Only a short code-shaped string is kept, never free text.
   */
  readonly pgCode?: string;
};

const CODE_SHAPE = /^[A-Z0-9_]{1,32}$/;
/** A class name: an identifier, dots allowed (`grpc.ServiceError`), at most 64 characters. */
const NAME_SHAPE = /^[A-Za-z_$][\w$.]{0,63}$/;

export function errorSummary(error: unknown): ErrorSummary {
  const errorName = error instanceof Error ? classNameOf(error) : typeof error;
  const pgCode = pgCodeOf(error);
  return pgCode === undefined ? { errorName } : { errorName, pgCode };
}

function classNameOf(error: Error): string {
  const name: unknown = error.name;
  return typeof name === 'string' && NAME_SHAPE.test(name) ? name : 'Error';
}

function pgCodeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    return typeof code === 'string' && CODE_SHAPE.test(code) ? code : undefined;
  }
  return undefined;
}
