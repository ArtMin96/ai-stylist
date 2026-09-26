import { type BackoffPolicy, backoffDelayMs } from './backoff.js';

export type RetryOptions = BackoffPolicy & {
  /** Total calls including the first; the loop is always bounded. */
  readonly maxAttempts: number;
  /** Injected for tests; defaults to a `setTimeout` sleep. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injected for tests; defaults to `Math.random`. */
  readonly random?: () => number;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Calls `operation` until it resolves or `maxAttempts` calls have failed, waiting
 * `backoffDelayMs(n)` after failed call n. Rethrows the last error.
 */
export async function retry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxAttempts, sleep = defaultSleep, random = Math.random } = options;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(`maxAttempts must be an integer >= 1, got ${maxAttempts}`);
  }
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      await sleep(backoffDelayMs(attempt, options, random));
    }
  }
}
