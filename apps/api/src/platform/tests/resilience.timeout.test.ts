import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeoutError, withTimeout } from '../resilience/index.js';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the operation result when it settles before the deadline', async () => {
    const pending = withTimeout(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('done'), 50)),
      100,
    );
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with TimeoutError after N ms and aborts the signal with the same error', async () => {
    let seen: AbortSignal | undefined;
    const pending = withTimeout((signal) => {
      seen = signal;
      return new Promise<never>(() => undefined);
    }, 100);
    const outcome = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(99);
    expect(seen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await outcome;
    expect(seen?.aborted).toBe(true);
    expect(seen?.reason).toBeInstanceOf(TimeoutError);
    expect((seen?.reason as TimeoutError).timeoutMs).toBe(100);
  });

  it('propagates the operation error and clears the timer', async () => {
    await expect(withTimeout(() => Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects a non-positive timeout', async () => {
    await expect(withTimeout(() => Promise.resolve(1), 0)).rejects.toThrow(RangeError);
  });
});
