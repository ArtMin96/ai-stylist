import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { backoffDelayMs, retry } from '../resilience/index.js';

describe('backoffDelayMs (exponential backoff with jitter)', () => {
  it('property: every delay lies in [base, cap] for any attempt, base, cap and jitter draw', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.double({ min: 0, max: 3_600_000, noNaN: true }),
        fc.double({ min: 0, max: 3_600_000, noNaN: true }),
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
        (attempt, a, b, draw) => {
          const baseMs = Math.min(a, b);
          const capMs = Math.max(a, b);
          const delay = backoffDelayMs(attempt, { baseMs, capMs }, () => draw);
          expect(delay).toBeGreaterThanOrEqual(baseMs);
          expect(delay).toBeLessThanOrEqual(capMs);
        },
      ),
    );
  });

  it('grows exponentially up to the cap: the ceiling for attempt n is base * 2^(n-1)', () => {
    const policy = { baseMs: 100, capMs: 1_000 };
    const almostOne = () => 0.999_999_999;
    expect(backoffDelayMs(1, policy, almostOne)).toBe(100);
    expect(backoffDelayMs(3, policy, almostOne)).toBeCloseTo(400, 3);
    expect(backoffDelayMs(4, policy, almostOne)).toBeCloseTo(800, 3);
    expect(backoffDelayMs(5, policy, almostOne)).toBeCloseTo(1_000, 3);
    expect(backoffDelayMs(3, policy, () => 0)).toBe(100);
  });

  it('rejects a non-positive attempt and an inverted policy', () => {
    expect(() => backoffDelayMs(0, { baseMs: 1, capMs: 2 })).toThrow(RangeError);
    expect(() => backoffDelayMs(1.5, { baseMs: 1, capMs: 2 })).toThrow(RangeError);
    expect(() => backoffDelayMs(1, { baseMs: 5, capMs: 2 })).toThrow(RangeError);
  });
});

describe('retry', () => {
  it('retries a failing operation with backoff delays and returns the first success', async () => {
    const delays: number[] = [];
    const attempts: number[] = [];
    const result = await retry(
      (attempt) => {
        attempts.push(attempt);
        return attempt < 3 ? Promise.reject(new Error(`fail ${attempt}`)) : Promise.resolve('ok');
      },
      {
        maxAttempts: 5,
        baseMs: 100,
        capMs: 1_000,
        random: () => 0.5,
        sleep: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
      },
    );
    expect(result).toBe('ok');
    expect(attempts).toEqual([1, 2, 3]);
    expect(delays).toEqual([100, 150]);
  });

  it('stops after maxAttempts and rethrows the last error without a trailing sleep', async () => {
    let sleeps = 0;
    await expect(
      retry((attempt) => Promise.reject(new Error(`fail ${attempt}`)), {
        maxAttempts: 3,
        baseMs: 10,
        capMs: 10,
        sleep: () => {
          sleeps += 1;
          return Promise.resolve();
        },
      }),
    ).rejects.toThrow('fail 3');
    expect(sleeps).toBe(2);
  });

  it('rejects an unbounded or empty attempt budget', async () => {
    const op = () => Promise.resolve('never');
    await expect(retry(op, { maxAttempts: 0, baseMs: 1, capMs: 1 })).rejects.toThrow(RangeError);
    await expect(
      retry(op, { maxAttempts: Number.POSITIVE_INFINITY, baseMs: 1, capMs: 1 }),
    ).rejects.toThrow(RangeError);
  });
});
