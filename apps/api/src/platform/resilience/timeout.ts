export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`operation timed out after ${timeoutMs} ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Rejects with `TimeoutError` after `timeoutMs` and aborts the signal handed to `operation`
 * (reason: the same `TimeoutError`), so fetch/SDK calls that accept a signal stop their work.
 */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`timeoutMs must be > 0, got ${timeoutMs}`);
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new TimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
