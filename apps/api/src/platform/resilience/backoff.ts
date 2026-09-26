/**
 * Exponential backoff with jitter (doc 04 §9, NFR-PERF-040). Pure: the random source is a
 * parameter so the outbox relay and tests can reuse it deterministically.
 */
export type BackoffPolicy = {
  /** Smallest delay, and the growth unit: attempt n may wait up to `baseMs * 2^(n-1)`. */
  readonly baseMs: number;
  /** Largest delay ever returned. */
  readonly capMs: number;
};

// 2^1023 is the largest finite power of two; beyond it the product would be NaN when baseMs = 0.
const MAX_EXPONENT = 1023;

/**
 * Delay before retry number `attempt` (1-based): uniform jitter in
 * `[baseMs, min(capMs, baseMs * 2^(attempt - 1))]`, so every delay lies in `[baseMs, capMs]`.
 */
export function backoffDelayMs(
  attempt: number,
  policy: BackoffPolicy,
  random: () => number = Math.random,
): number {
  const { baseMs, capMs } = policy;
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError(`attempt must be an integer >= 1, got ${attempt}`);
  }
  if (!Number.isFinite(baseMs) || baseMs < 0 || !Number.isFinite(capMs) || capMs < baseMs) {
    throw new RangeError(`backoff policy needs 0 <= baseMs <= capMs, got ${baseMs}/${capMs}`);
  }
  const ceiling = Math.min(capMs, baseMs * 2 ** Math.min(attempt - 1, MAX_EXPONENT));
  // random() should be in [0, 1); the clamp keeps the bounds even for a misbehaving source.
  return Math.min(ceiling, Math.max(baseMs, baseMs + random() * (ceiling - baseMs)));
}
