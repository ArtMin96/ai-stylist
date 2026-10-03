// The only fields of a thrown value the queue adapter and the outbox relay persist or log, and the
// logger writes for an error and each link of its cause chain (../logger.ts): its class name and,
// for a Postgres error, its SQLSTATE code. Never the message: driver and pg-boss messages can echo
// statement parameters (job data, event payloads), and handler errors may quote the job.

export type ErrorSummary = {
  /** `Error.name`, or `typeof` for a non-Error throw (which could be anything, even the payload). */
  readonly errorName: string;
  /**
   * Postgres SQLSTATE (`error.code`, e.g. `57P01`) when the value carries one; also a Node system
   * code such as `ECONNREFUSED`. Only a short code-shaped string is kept, never free text.
   */
  readonly pgCode?: string;
};

const CODE_SHAPE = /^[A-Z0-9_]{1,32}$/;

export function errorSummary(error: unknown): ErrorSummary {
  const errorName = error instanceof Error ? error.name : typeof error;
  const pgCode = pgCodeOf(error);
  return pgCode === undefined ? { errorName } : { errorName, pgCode };
}

function pgCodeOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    return typeof code === 'string' && CODE_SHAPE.test(code) ? code : undefined;
  }
  return undefined;
}
