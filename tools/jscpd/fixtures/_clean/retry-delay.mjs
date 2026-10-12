// Clone-check fixture (tools/jscpd/README.md): unrelated to every other `_clean` file.
export function retryDelayMs(attempt, { baseMs = 250, capMs = 30_000 } = {}) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError(`attempt must be a positive integer, got ${attempt}`);
  }
  const exponential = baseMs * 2 ** (attempt - 1);
  return Math.min(exponential, capMs);
}
